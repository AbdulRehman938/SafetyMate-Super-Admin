import fs from 'fs'
import path from 'path'
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs } from 'firebase/firestore'
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

const adminEmail = process.argv[2]
const adminPassword = process.argv[3]

if (!adminEmail || !adminPassword) {
  console.log('\n--- SafetyMate Organization List Utility ---')
  console.log('Usage: node scripts/list_organizations.js <super_admin_email> <super_admin_password>\n')
  console.log('Example: node scripts/list_organizations.js admin@safetymate.com password\n')
  process.exit(1)
}

async function run() {
  try {
    console.log('\nAuthenticating as Super Admin...')
    await signInWithEmailAndPassword(auth, adminEmail, adminPassword)
    console.log('Authentication successful!')

    console.log('\nFetching organizations from Firestore...\n')

    const orgsRef = collection(db, 'organizations')
    const snap = await getDocs(orgsRef)

    if (snap.empty) {
      console.log('No organizations found in Firestore.\n')
      process.exit(0)
    }

    console.log('Organizations:')
    console.log('─'.repeat(80))
    
    snap.docs.forEach((docSnap) => {
      const data = docSnap.data()
      console.log(`ID: ${docSnap.id}`)
      console.log(`Name: ${data.name || data.companyName || data.organizationName || 'N/A'}`)
      console.log(`Email: ${data.email || 'N/A'}`)
      console.log(`Industry: ${data.industry || 'N/A'}`)
      console.log(`Created: ${data.createdAt ? new Date(data.createdAt).toLocaleDateString() : 'N/A'}`)
      console.log('─'.repeat(80))
    })

    console.log(`\nTotal: ${snap.size} organization(s)\n`)
  } catch (error) {
    console.error('\nError fetching organizations:', error.message || error, '\n')
  }
}

run()
