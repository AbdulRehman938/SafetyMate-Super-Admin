/**
 * create_fleet_user.js
 * Creates a Firebase Auth user + Firestore profile with role = 'FLEET'
 *
 * Usage (from project root):
 *   node scripts/create_fleet_user.js <email> <password> [fullName]
 *
 * Example:
 *   node scripts/create_fleet_user.js fleet@safetymate.com Fleet@2024 "Fleet Manager"
 */

import fs from 'fs'
import path from 'path'
import { initializeApp } from 'firebase/app'
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore'
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth'

// ── Load .env ─────────────────────────────────────────────────────────────────
const envPath = path.resolve(process.cwd(), '.env')
if (!fs.existsSync(envPath)) {
  console.error('\n❌  Error: .env file not found. Run this script from the project root.\n')
  process.exit(1)
}

const envContent = fs.readFileSync(envPath, 'utf-8')
const env = {}
envContent.split(/\r?\n/).forEach((line) => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
  if (match) {
    let value = match[2] || ''
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1)
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1)
    env[match[1]] = value.trim()
  }
})

const firebaseConfig = {
  apiKey:            env.VITE_FIREBASE_API_KEY,
  authDomain:        env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             env.VITE_FIREBASE_APP_ID,
}

// ── CLI args ──────────────────────────────────────────────────────────────────
const email    = process.argv[2]
const password = process.argv[3]
const fullName = process.argv[4] || 'Fleet Manager'

if (!email || !password) {
  console.log('\n─── SafetyMate Fleet User Creation ───────────────────────────')
  console.log('Usage: node scripts/create_fleet_user.js <email> <password> [fullName]\n')
  console.log('Example:')
  console.log('  node scripts/create_fleet_user.js fleet@safetymate.com Fleet@2024 "Fleet Manager"\n')
  process.exit(1)
}

// ── Firebase init ─────────────────────────────────────────────────────────────
const app  = initializeApp(firebaseConfig)
const auth = getAuth(app)
const db   = getFirestore(app)

async function run() {
  console.log('\n─── SafetyMate Fleet User Creation ───────────────────────────')
  console.log(`  Email    : ${email}`)
  console.log(`  Full Name: ${fullName}`)
  console.log(`  Role     : FLEET`)
  console.log('──────────────────────────────────────────────────────────────\n')

  let uid

  // ── Step 1: Create Firebase Auth account ────────────────────────────────────
  try {
    console.log('📧  Creating Firebase Auth account…')
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    uid = cred.user.uid
    console.log(`✅  Auth account created  —  UID: ${uid}`)
  } catch (err) {
    // If email already exists, sign in and fetch the UID instead
    if (err.code === 'auth/email-already-in-use') {
      console.log('⚠️   Email already in use — signing in to retrieve UID…')
      const cred = await signInWithEmailAndPassword(auth, email, password)
      uid = cred.user.uid
      console.log(`ℹ️   Existing Auth UID: ${uid}`)
    } else {
      console.error('\n❌  Auth error:', err.message, '\n')
      process.exit(1)
    }
  }

  // ── Step 2: Write / overwrite Firestore user_profiles doc ───────────────────
  try {
    console.log('\n📄  Writing Firestore user_profiles document…')
    const profileRef  = doc(db, 'user_profiles', uid)
    const existingSnap = await getDoc(profileRef)

    if (existingSnap.exists()) {
      const existing = existingSnap.data()
      console.log(`ℹ️   Existing profile found — current role: "${existing.role}"`)
      console.log('    Updating role to FLEET…')
    }

    await setDoc(profileRef, {
      email,
      fullName,
      role: 'FLEET',
      createdAt: existingSnap.exists() ? existingSnap.data().createdAt : new Date(),
      updatedAt: new Date(),
    }, { merge: true })

    console.log('✅  Firestore profile saved successfully!\n')
  } catch (err) {
    console.error('\n❌  Firestore error:', err.message, '\n')
    process.exit(1)
  }

  // ── Step 3: Sign out ─────────────────────────────────────────────────────────
  await signOut(auth)

  console.log('─── Summary ─────────────────────────────────────────────────')
  console.log(`  UID      : ${uid}`)
  console.log(`  Email    : ${email}`)
  console.log(`  Password : ${password}`)
  console.log(`  Role     : FLEET`)
  console.log('─────────────────────────────────────────────────────────────')
  console.log('\n🚛  Fleet user is ready. Sign in at the app to open the Fleet Dashboard.\n')
}

run().catch((err) => {
  console.error('\n❌  Unexpected error:', err.message || err, '\n')
  process.exit(1)
})
