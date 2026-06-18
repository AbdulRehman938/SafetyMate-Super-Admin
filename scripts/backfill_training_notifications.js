import fs from 'fs'
import path from 'path'
import { initializeApp } from 'firebase/app'
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  query,
  where,
  limit,
  serverTimestamp,
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

if (!adminEmail || !adminPassword) {
  console.log('\n--- Backfill Training Request Notifications ---')
  console.log(
    'Usage: node scripts/backfill_training_notifications.js <super_admin_email> <super_admin_password>\n',
  )
  process.exit(1)
}

async function notificationExists(reqId) {
  const q = query(
    collection(db, 'notifications'),
    where('sourceId', '==', reqId),
    where('type', '==', 'training_request'),
    limit(1),
  )
  const snap = await getDocs(q)
  return !snap.empty
}

async function run() {
  try {
    console.log('\nAuthenticating as Super Admin...')
    await signInWithEmailAndPassword(auth, adminEmail, adminPassword)
    console.log('Authentication successful!')

    const reqSnap = await getDocs(collection(db, 'training_requests'))
    let created = 0
    let skipped = 0

    for (const docSnap of reqSnap.docs) {
      const data = docSnap.data() || {}
      const status = String(data.status || 'pending').toLowerCase()
      if (status !== 'pending') {
        skipped++
        continue
      }

      if (await notificationExists(docSnap.id)) {
        skipped++
        continue
      }

      const company = data.company || data.clientName || 'A company'
      const course = data.course || data.courseName || 'a course'
      const workers = data.workers || data.workerCount || 0
      const reqIdLabel = data.reqId || `#${docSnap.id.slice(0, 8).toUpperCase()}`

      await addDoc(collection(db, 'notifications'), {
        type: 'training_request',
        recipientRole: 'TRAINING_PROVIDER',
        recipientUid: null,
        sourceId: docSnap.id,
        title: 'New Training Request',
        message: `${company} requested training for "${course}" (${workers} workers)`,
        meta: reqIdLabel,
        navigateTo: '/training/requests',
        readBy: {},
        createdAt: serverTimestamp(),
      })
      created++
      console.log(`Created notification for request ${reqIdLabel}`)
    }

    console.log(`\nDone. Created ${created}, skipped ${skipped}.`)
    await signOut(auth)
  } catch (error) {
    console.error('\nBackfill failed:', error.message || error, '\n')
    process.exit(1)
  }
}

run()
