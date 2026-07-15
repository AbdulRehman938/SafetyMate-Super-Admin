import fs from 'fs'
import path from 'path'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

// 1. Load service account key
const serviceAccountPath = path.resolve(process.cwd(), 'serviceAccountKey.json')
if (!fs.existsSync(serviceAccountPath)) {
  console.error('Error: serviceAccountKey.json not found. Run this from the project root.')
  process.exit(1)
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'))

// 2. Initialize Firebase Admin SDK
if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
  })
}

const uid = process.argv[2]
const newEmail = process.argv[3]

if (!uid || !newEmail) {
  console.log('\n--- Firebase Auth Email Update Utility ---')
  console.log('Usage: node scripts/update_auth_email.js <uid> <new_email>\n')
  console.log('Example: node scripts/update_auth_email.js wSueEnBTRjOFtdOwMwUTYOejAP02 safetymateadmin@yopmail.com\n')
  console.log()
  process.exit(1)
}

async function run() {
  try {
    const auth = getAuth()
    
    console.log('\nFetching user from Firebase Authentication...')
    const userRecord = await auth.getUser(uid)
    
    console.log('\nCurrent User:')
    console.log(` - UID: ${userRecord.uid}`)
    console.log(` - Email: ${userRecord.email || 'N/A'}`)
    
    if (userRecord.email === newEmail) {
      console.log('\nInfo: The new email is the same as the current email. No action taken.\n')
      process.exit(0)
    }
    
    console.log(`\nUpdating email to "${newEmail}"...`)
    await auth.updateUser(uid, { email: newEmail })
    console.log('✓ Firebase Authentication updated successfully!')
    console.log('\nThe user can now sign in with the new email and their existing password.\n')
  } catch (error) {
    console.error('\nError updating email in Firebase Authentication:', error.message || error, '\n')
  }
}

run()
