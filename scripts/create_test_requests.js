import fs from 'fs'
import path from 'path'
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, addDoc } from 'firebase/firestore'
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth'

// 1. Load configuration from .env
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

// 2. Initialize Firebase Client
const app = initializeApp(firebaseConfig)
const db = getFirestore(app)
const auth = getAuth(app)

const adminEmail = process.argv[2]
const adminPassword = process.argv[3]

if (!adminEmail || !adminPassword) {
  console.log('\n--- SafetyMate Test Seeding Utility ---')
  console.log('Usage: node scripts/create_test_requests.js <super_admin_email> <super_admin_password>\n')
  process.exit(1)
}

const screenshotRequests = [
  // Seed data removed — use clear_training_dashboard_data.js to wipe test data.
  // Add real-shaped entries here only for local dev if needed.
]

async function run() {
  try {
    console.log('\nAuthenticating as Super Admin...')
    await signInWithEmailAndPassword(auth, adminEmail, adminPassword)
    console.log('Authentication successful!')

    if (screenshotRequests.length === 0) {
      console.log('\nNo seed data configured. Add entries to screenshotRequests[] to seed, or use real app flows.')
      await signOut(auth)
      console.log('Done.\n')
      return
    }

    console.log('\nSeeding Firestore collection "training_requests"...')
    for (const req of screenshotRequests) {
      const docRef = await addDoc(collection(db, 'training_requests'), req)
      console.log(`Added request for ${req.company} (ID: ${docRef.id})`)
    }
    console.log('Seeding successful!')

    // Sign out to clean up local auth state
    await signOut(auth)
    console.log('Done.\n')
  } catch (error) {
    console.error('\nError seeding training requests:', error.message || error, '\n')
  }
}

run()
