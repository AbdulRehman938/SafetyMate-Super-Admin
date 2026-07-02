import fs from 'fs'
import path from 'path'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
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

const db = getFirestore()

const newEmail = process.argv[2]

if (!newEmail) {
  console.log('\n--- SafetyMate Super Admin Email Replacement Utility ---')
  console.log('Usage: node scripts/replace_super_admin_email.js <new_email>\n')
  console.log('Example: node scripts/replace_super_admin_email.js safetymateadmin@yopmail.com\n')
  console.log()
  process.exit(1)
}

async function run() {
  try {
    console.log('\nSearching for current SUPER_ADMIN user...')
    const snap = await db.collection('user_profiles').where('role', '==', 'SUPER_ADMIN').get()

    if (snap.empty) {
      console.error('\nError: No SUPER_ADMIN user found in Firestore.\n')
      process.exit(1)
    }

    const adminDoc = snap.docs[0]
    const adminUid = adminDoc.id
    const currentData = adminDoc.data()

    console.log('\nCurrent Super Admin Found:')
    console.log(` - UID: ${adminUid}`)
    console.log(` - Email: ${currentData.email || 'N/A'}`)
    console.log(` - Full Name: ${currentData.fullName || 'N/A'}`)
    console.log(` - Role: ${currentData.role || 'N/A'}`)

    if (currentData.email === newEmail) {
      console.log('\nInfo: The new email is the same as the current email. No action taken.\n')
      process.exit(0)
    }

    console.log(`\nUpdating email to "${newEmail}"...`)
    
    // Update in Firestore
    await db.collection('user_profiles').doc(adminUid).update({ email: newEmail })
    console.log('✓ Firestore user_profiles updated')
    
    // Update in Firebase Authentication
    const auth = getAuth()
    await auth.updateUser(adminUid, { email: newEmail })
    console.log('✓ Firebase Authentication updated')
    
    console.log('\nSuccess: Super Admin email updated in both Firestore and Firebase Authentication!')
    console.log('The user can now sign in with the new email and their existing password.\n')
  } catch (error) {
    console.error('\nError updating super admin email in Firestore:', error.message || error, '\n')
  }
}

run()
