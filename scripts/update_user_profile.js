import fs from 'fs'
import path from 'path'
import { initializeApp } from 'firebase/app'
import { getFirestore, doc, updateDoc, getDoc } from 'firebase/firestore'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'

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

const uid = process.argv[2]
const email = process.argv[3]
const fullName = process.argv[4]
const organizationId = process.argv[5]
const adminEmail = process.argv[6]
const adminPassword = process.argv[7]

if (!uid || !email || !adminEmail || !adminPassword) {
  console.log('\n--- SafetyMate User Profile Update Utility ---')
  console.log('Usage: node scripts/update_user_profile.js <uid> <email> [full_name] [organization_id] <super_admin_email> <super_admin_password>\n')
  console.log('Example: node scripts/update_user_profile.js abc123 user@example.com "John Doe" org123 admin@safetymate.com password\n')
  console.log()
  process.exit(1)
}

async function run() {
  try {
    console.log('\nAuthenticating as Super Admin...')
    await signInWithEmailAndPassword(auth, adminEmail, adminPassword)
    console.log('Authentication successful!')

    const userRef = doc(db, 'user_profiles', uid)
    const snap = await getDoc(userRef)
    
    if (!snap.exists()) {
      console.error(`\nError: User profile with UID "${uid}" not found in Firestore "user_profiles" collection.\n`)
      process.exit(1)
    }

    const currentData = snap.data()
    console.log('\nCurrent User Profile:')
    console.log(` - Email: ${currentData.email || 'N/A'}`)
    console.log(` - Full Name: ${currentData.fullName || 'N/A'}`)
    console.log(` - Role: ${currentData.role || 'N/A'}`)
    console.log(` - Organization ID: ${currentData.organizationId || 'None'}`)

    const updates = {
      email,
      updatedAt: new Date().toISOString(),
    }

    if (fullName) {
      updates.fullName = fullName
    }
    if (organizationId) {
      updates.organizationId = organizationId
    }

    console.log(`\nUpdating profile...`)
    console.log(` - Email: ${email}`)
    if (fullName) console.log(` - Full Name: ${fullName}`)
    if (organizationId) console.log(` - Organization ID: ${organizationId}`)

    await updateDoc(userRef, updates)
    console.log('\nSuccess: User profile updated successfully!\n')
  } catch (error) {
    console.error('\nError updating user profile in Firestore:', error.message || error, '\n')
  }
}

run()
