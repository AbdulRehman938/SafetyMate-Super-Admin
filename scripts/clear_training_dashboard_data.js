import fs from 'fs'
import path from 'path'
import { initializeApp } from 'firebase/app'
import {
  getFirestore,
  collection,
  getDocs,
  writeBatch,
  doc,
  query,
  where,
} from 'firebase/firestore'
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth'

const envPath = path.resolve(process.cwd(), '.env')
if (!fs.existsSync(envPath)) {
  console.error('Error: .env file not found. Run this from the project root.')
  process.exit(1)
}

const envContent = fs.readFileSync(envPath, 'utf-8')
const env = {}
envContent.split(/\r?\n/).forEach((line) => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
  if (match) {
    const key = match[1]
    let value = match[2] || ''
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1)
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1)
    env[key] = value.trim()
  }
})

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)
const auth = getAuth(app)

const adminEmail = process.argv[2]
const adminPassword = process.argv[3]
const confirmFlag = process.argv.includes('--confirm')

const PROVIDER_CERT_SOURCES = ['ocr_bulk_upload', 'manual_issuance']
const PROVIDER_NOTIF_TYPES = [
  'training_request',
  'certificate_registered',
  'certificate_issued',
  'session_scheduled',
]

if (!adminEmail || !adminPassword) {
  console.log('\n--- Clear Training Dashboard Data ---')
  console.log(
    'Removes ALL training_requests, provider notifications, and provider-issued certificates.',
  )
  console.log(
    'Usage: node scripts/clear_training_dashboard_data.js <super_admin_email> <super_admin_password> --confirm\n',
  )
  process.exit(1)
}

if (!confirmFlag) {
  console.error('\nRefusing to run without --confirm flag. This permanently deletes data.\n')
  process.exit(1)
}

async function deleteCollectionDocs(collectionName, docs) {
  if (docs.length === 0) return 0
  const BATCH_SIZE = 400
  let deleted = 0
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = writeBatch(db)
    const chunk = docs.slice(i, i + BATCH_SIZE)
    chunk.forEach((d) => batch.delete(doc(db, collectionName, d.id)))
    await batch.commit()
    deleted += chunk.length
  }
  return deleted
}

async function run() {
  try {
    console.log('\nAuthenticating as Super Admin...')
    await signInWithEmailAndPassword(auth, adminEmail, adminPassword)
    console.log('Authentication successful!\n')

    // 1. training_requests
    const reqSnap = await getDocs(collection(db, 'training_requests'))
    const reqDeleted = await deleteCollectionDocs('training_requests', reqSnap.docs)
    console.log(`Deleted ${reqDeleted} training_requests`)

    // 2. Provider-issued certificates only (does not touch company/client certificates)
    const certSnap = await getDocs(
      query(collection(db, 'certificates'), where('source', 'in', PROVIDER_CERT_SOURCES)),
    )
    const certDeleted = await deleteCollectionDocs('certificates', certSnap.docs)
    console.log(`Deleted ${certDeleted} provider-issued certificates`)

    // 3. Training provider notifications
    const roleNotifSnap = await getDocs(
      query(collection(db, 'notifications'), where('recipientRole', '==', 'TRAINING_PROVIDER')),
    )
    const typeNotifSnaps = await Promise.all(
      PROVIDER_NOTIF_TYPES.map((type) =>
        getDocs(query(collection(db, 'notifications'), where('type', '==', type))),
      ),
    )

    const notifIds = new Set()
    roleNotifSnap.docs.forEach((d) => notifIds.add(d.id))
    typeNotifSnaps.forEach((snap) => snap.docs.forEach((d) => notifIds.add(d.id)))

    const notifDocs = [...notifIds].map((id) => ({ id }))
    const notifDeleted = await deleteCollectionDocs('notifications', notifDocs)
    console.log(`Deleted ${notifDeleted} notifications`)

    console.log('\nTraining dashboard data cleared. Refresh the app to see empty pages.\n')
    await signOut(auth)
  } catch (error) {
    console.error('\nClear failed:', error.message || error, '\n')
    process.exit(1)
  }
}

run()
