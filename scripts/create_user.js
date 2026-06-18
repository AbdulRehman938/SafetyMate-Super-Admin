import fs from 'fs'
import path from 'path'
import { initializeApp } from 'firebase/app'
import { getFirestore, doc, setDoc } from 'firebase/firestore'
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth'

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

const email = process.argv[2]
const password = process.argv[3]
const fullName = process.argv[4] || 'Training Provider User'
const role = process.argv[5] || 'TRAINING_PROVIDER'

if (!email || !password) {
  console.log('\n--- SafetyMate User Creation Utility ---')
  console.log('Usage: node scripts/create_user.js <email> <password> [fullName] [role]\n')
  process.exit(1)
}

async function run() {
  try {
    console.log(`\nCreating Auth user for ${email}...`)
    const userCredential = await createUserWithEmailAndPassword(auth, email, password)
    const uid = userCredential.user.uid
    console.log(`Auth user created! UID: ${uid}`)

    console.log(`Creating Firestore profile with role "${role}"...`)
    await setDoc(doc(db, 'user_profiles', uid), {
      email,
      fullName,
      role,
      createdAt: new Date()
    })
    console.log('Success: User profile created in Firestore!')
    
    // Sign out to clean up local auth state
    await signOut(auth)
    console.log('Done.\n')
  } catch (error) {
    console.error('\nError creating user:', error.message || error, '\n')
  }
}

run()
