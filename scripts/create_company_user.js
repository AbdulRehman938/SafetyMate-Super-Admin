import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, FieldValue }      from 'firebase-admin/firestore'
import { getAuth }                       from 'firebase-admin/auth'
import { readFileSync, existsSync }      from 'fs'
import { resolve, dirname }              from 'path'
import { fileURLToPath }                 from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── 1. Initialise Firebase Admin (same pattern as clear_fleet_database.js) ───
const KEY_PATH = resolve(__dirname, '../serviceAccountKey.json')

if (!getApps().length) {
  if (existsSync(KEY_PATH)) {
    const serviceAccount = JSON.parse(readFileSync(KEY_PATH, 'utf8'))
    initializeApp({ credential: cert(serviceAccount) })
    console.log('✔  Firebase Admin initialised from serviceAccountKey.json')
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    initializeApp()
    console.log('✔  Firebase Admin initialised from GOOGLE_APPLICATION_CREDENTIALS')
  } else {
    console.error(
      '\n❌  No credentials found.\n' +
      '   Place serviceAccountKey.json in the project root, or set\n' +
      '   GOOGLE_APPLICATION_CREDENTIALS to your service account key path.\n'
    )
    process.exit(1)
  }
}

const db        = getFirestore()
const adminAuth = getAuth()

// ── 2. Parse CLI flags ────────────────────────────────────────────────────────
function parseArgs(argv) {
  const result = {}
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i]
    const val = argv[i + 1]
    if (key.startsWith('--') && val && !val.startsWith('--')) {
      result[key.slice(2)] = val
      i++
    } else if (key.startsWith('--')) {
      result[key.slice(2)] = true
    }
  }
  return result
}

const args     = parseArgs(process.argv.slice(2))
const email    = args['email']
const password = args['password']
const fullName = args['name']     || 'Company Admin'
const orgName  = args['org-name']
const orgId    = args['org-id']
const role     = ['COMPANY', 'client_admin'].includes(args['role'])
  ? args['role']
  : 'COMPANY'

// ── 3. Validate ───────────────────────────────────────────────────────────────
if (!email || !password) {
  printUsage()
  process.exit(1)
}

if (!orgName && !orgId) {
  console.error('\n❌  Provide either --org-name (new org) or --org-id (existing org).\n')
  printUsage()
  process.exit(1)
}

if (password.length < 6) {
  console.error('\n❌  Password must be at least 6 characters.\n')
  process.exit(1)
}

function printUsage() {
  console.log(`
─── SafetyMate Company User Creation — Usage ──────────────────────────────────

  MODE A  New organisation + new user:
    node scripts/create_company_user.js --email admin@company.com --password Pass@2026 --name "Full Name" --org-name "Company Name"

  MODE B  Existing organisation, new user:
    node scripts/create_company_user.js --email admin@company.com --password Pass@2026 --name "Full Name" --org-id <Firestore org doc ID>

  Optional:
    --role  COMPANY | client_admin   (default: COMPANY)

───────────────────────────────────────────────────────────────────────────────
`)
}

// ── 4. Main ───────────────────────────────────────────────────────────────────
async function run() {
  const mode = orgId ? 'B — existing org' : 'A — new org'

  console.log(`
─── SafetyMate Company Compliance User Creation ───────────────────────────────
  Mode         : ${mode}
  Email        : ${email}
  Full Name    : ${fullName}
  Role         : ${role}
  ${orgId ? `Org ID       : ${orgId}` : `Org Name     : ${orgName}`}
───────────────────────────────────────────────────────────────────────────────
`)

  // ── Step 1: Resolve or create the organisation ──────────────────────────────
  let resolvedOrgId
  let resolvedOrgName

  if (orgId) {
    // MODE B — verify the org exists
    console.log(`🔍  Verifying organisation "${orgId}" in Firestore…`)
    const orgSnap = await db.collection('organizations').doc(orgId).get()
    if (!orgSnap.exists) {
      console.error(`\n❌  No organisation found with ID: "${orgId}"\n    Double-check the Firestore document ID.\n`)
      process.exit(1)
    }
    const data      = orgSnap.data()
    resolvedOrgId   = orgId
    resolvedOrgName = data.name || data.companyName || orgId
    console.log(`✅  Organisation found: "${resolvedOrgName}"`)
  } else {
    // MODE A — create a new organisation document
    console.log(`🏢  Creating new organisation "${orgName}" in Firestore…`)

    const now    = new Date()
    const expiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30-day trial

    const orgPayload = {
      name:           orgName.trim(),
      status:         'active',
      plan:           'Starter',
      monthlyPrice:   199,
      allocatedUsers: 10,
      billingMode:    'manual',
      billingCycle:   'Monthly',
      createdAt:      FieldValue.serverTimestamp(),
      subscriptionExpiry: expiry,
      primaryContact: {
        fullName,
        email,
        phone: '',
      },
      address: {
        street:     '',
        city:       '',
        postalCode: '',
        country:    '',
      },
    }

    const orgRef    = await db.collection('organizations').add(orgPayload)
    resolvedOrgId   = orgRef.id
    resolvedOrgName = orgName.trim()
    console.log(`✅  Organisation created  —  ID: ${resolvedOrgId}`)
  }

  // ── Step 2: Create (or fetch) Firebase Auth user ────────────────────────────
  let uid
  console.log(`\n📧  Creating Firebase Auth account for "${email}"…`)
  try {
    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: fullName,
      emailVerified: false,
    })
    uid = userRecord.uid
    console.log(`✅  Auth account created  —  UID: ${uid}`)
  } catch (err) {
    if (err.code === 'auth/email-already-exists') {
      console.log(`⚠️   Email already exists — fetching existing UID…`)
      const existing = await adminAuth.getUserByEmail(email)
      uid = existing.uid
      console.log(`ℹ️   Existing Auth UID: ${uid}`)
    } else {
      console.error(`\n❌  Auth error: ${err.message}\n`)
      process.exit(1)
    }
  }

  // ── Step 3: Write Firestore user_profiles document ──────────────────────────
  console.log(`\n📄  Writing Firestore user_profiles/${uid}…`)
  try {
    const profileRef  = db.collection('user_profiles').doc(uid)
    const existingSnap = await profileRef.get()

    if (existingSnap.exists) {
      const existing = existingSnap.data()
      console.log(`ℹ️   Existing profile found — current role: "${existing.role}"`)
      console.log(`    Updating to role "${role}", org "${resolvedOrgName}"…`)
    }

    await profileRef.set(
      {
        email,
        fullName,
        role,
        organizationId:   resolvedOrgId,
        organizationName: resolvedOrgName,
        createdAt: existingSnap.exists
          ? existingSnap.data().createdAt
          : FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )

    console.log(`✅  Firestore profile saved successfully!`)
  } catch (err) {
    console.error(`\n❌  Firestore error: ${err.message}\n`)
    process.exit(1)
  }

  // ── Step 4: Print summary ───────────────────────────────────────────────────
  console.log(`
─── ✅  Done — Summary ────────────────────────────────────────────────────────
  UID              : ${uid}
  Email            : ${email}
  Password         : ${password}
  Full Name        : ${fullName}
  Role             : ${role}
  Organisation ID  : ${resolvedOrgId}
  Organisation Name: ${resolvedOrgName}
───────────────────────────────────────────────────────────────────────────────

🏢  User is ready. Sign in at the app to open the Company Compliance Dashboard.
    Dashboard route : /client/dashboard
`)

  process.exit(0)
}

run().catch((err) => {
  console.error(`\n❌  Unexpected error: ${err.message || err}\n`)
  process.exit(1)
})
