import fs from 'fs'
import path from 'path'
import { initializeApp } from 'firebase/app'
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore'
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

// Check if organization_id is provided (based on argument count)
const hasOrgId = process.argv.length >= 8
const organizationId = hasOrgId ? process.argv[5] : ''
const adminEmail = hasOrgId ? process.argv[6] : process.argv[5]
const adminPassword = hasOrgId ? process.argv[7] : process.argv[6]

if (!uid || !email || !fullName || !adminEmail || !adminPassword) {
  console.log('\n--- SafetyMate User Profile Creation Utility ---')
  console.log('Usage: node scripts/create_user_profile.js <uid> <email> <full_name> [organization_id] <super_admin_email> <super_admin_password>\n')
  console.log('Example: node scripts/create_user_profile.js abc123 user@example.com "John Doe" org123 admin@safetymate.com password\n')
  console.log('Or without organization_id:')
  console.log('Example: node scripts/create_user_profile.js abc123 user@example.com "John Doe" admin@safetymate.com password\n')
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
    
    if (snap.exists()) {
      console.log('\nUser profile already exists in Firestore.')
      console.log(` - Email: ${snap.data().email || 'N/A'}`)
      console.log(` - Full Name: ${snap.data().fullName || 'N/A'}`)
      console.log(` - Role: ${snap.data().role || 'N/A'}`)
      console.log('\nNo action taken.\n')
      process.exit(0)
    }

    console.log(`\nCreating user profile for UID: ${uid}`)
    console.log(` - Email: ${email}`)
    console.log(` - Full Name: ${fullName}`)
    console.log(` - Organization ID: ${organizationId || 'None'}`)

    const profileData = {
      uid,
      email,
      fullName,
      role: 'COMPANY', // Default role for client
      organizationId: organizationId || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    await setDoc(userRef, profileData)
    console.log('\nSuccess: User profile created in Firestore!')
    console.log('\nNow run the role update script:')
    console.log(`node scripts/update_user_role.js ${uid} client_admin ${adminEmail} ${adminPassword}\n`)
  } catch (error) {
    console.error('\nError creating user profile in Firestore:', error.message || error, '\n')
  }
}

run()
