import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

// 1. Load service account
const serviceAccountPath = join(process.cwd(), 'serviceAccountKey.json')
if (!existsSync(serviceAccountPath)) {
  console.error('❌ Error: serviceAccountKey.json not found in the project root.')
  process.exit(1)
}

let serviceAccount
try {
  serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'))
} catch (error) {
  console.error('❌ Error parsing serviceAccountKey.json:', error.message)
  process.exit(1)
}

// 2. Load storage bucket name from .env
const envPath = join(process.cwd(), '.env')
let storageBucket = undefined
if (existsSync(envPath)) {
  try {
    const envContent = readFileSync(envPath, 'utf-8')
    envContent.split(/\r?\n/).forEach((line) => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
      if (match) {
        const key = match[1]
        let value = match[2] || ''
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1)
        if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1)
        if (key === 'VITE_FIREBASE_STORAGE_BUCKET') {
          storageBucket = value.trim()
        }
      }
    })
  } catch (err) {
    console.warn('⚠️ Could not read .env file:', err.message)
  }
}

// 3. Initialize Firebase Admin SDK
try {
  if (getApps().length === 0) {
    initializeApp({
      credential: cert(serviceAccount),
      storageBucket: storageBucket,
    })
  }
} catch (error) {
  console.error('❌ Error initializing Firebase Admin:', error.message)
  process.exit(1)
}

const db = getFirestore()

// Helper: delete documents in batches of 400
async function deleteDocuments(collectionName, docs) {
  if (docs.length === 0) return 0
  const BATCH_SIZE = 400
  let deleted = 0
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = db.batch()
    const chunk = docs.slice(i, i + BATCH_SIZE)
    chunk.forEach((d) => {
      batch.delete(db.collection(collectionName).doc(d.id))
    })
    await batch.commit()
    deleted += chunk.length
  }
  return deleted
}

async function run() {
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║       TRAINING PROVIDER DATA CLEARANCE UTILITY             ║')
  console.log('╚════════════════════════════════════════════════════════════╝')
  console.log('\n⚠️  WARNING: This will permanently delete training provider dashboard data.')
  
  const confirmFlag = process.argv.includes('--confirm')
  if (!confirmFlag) {
    console.log('\nUsage: node scripts/clear_training_provider_data.js --confirm')
    console.log('Refusing to run without --confirm flag.\n')
    process.exit(1)
  }

  console.log('\n🚀 Starting clearance...')

  try {
    // 1. Delete all training_sessions (provider-scheduled sessions)
    const sessionSnap = await db.collection('training_sessions').get()
    const sessionsDeleted = await deleteDocuments('training_sessions', sessionSnap.docs)
    console.log(`✅ Deleted ${sessionsDeleted} documents from "training_sessions"`)

    // 2. Delete all training_requests (legacy requests collection)
    const legacyReqSnap = await db.collection('training_requests').get()
    const legacyReqDeleted = await deleteDocuments('training_requests', legacyReqSnap.docs)
    console.log(`✅ Deleted ${legacyReqDeleted} documents from "training_requests"`)

    // 3. Delete provider-issued certificates (ocr_bulk_upload, manual_issuance)
    const certSnap = await db.collection('certificates')
      .where('source', 'in', ['ocr_bulk_upload', 'manual_issuance'])
      .get()
    const certsDeleted = await deleteDocuments('certificates', certSnap.docs)
    console.log(`✅ Deleted ${certsDeleted} provider-issued documents from "certificates"`)

    // 4. Delete requests in files_documents where category is TRAINING_REQUEST
    const fileDocSnap = await db.collection('files_documents')
      .where('category', '==', 'TRAINING_REQUEST')
      .get()
    const fileDocsDeleted = await deleteDocuments('files_documents', fileDocSnap.docs)
    console.log(`✅ Deleted ${fileDocsDeleted} active requests from "files_documents"`)

    // 5. Delete training provider notifications
    const PROVIDER_NOTIF_TYPES = [
      'training_request',
      'certificate_registered',
      'certificate_issued',
      'session_scheduled',
    ]

    const notifIds = new Set()
    
    // Query by role
    const roleSnap = await db.collection('notifications')
      .where('recipientRole', '==', 'TRAINING_PROVIDER')
      .get()
    roleSnap.docs.forEach((d) => notifIds.add(d.id))

    // Query by type
    for (const type of PROVIDER_NOTIF_TYPES) {
      const typeSnap = await db.collection('notifications')
        .where('type', '==', type)
        .get()
      typeSnap.docs.forEach((d) => notifIds.add(d.id))
    }

    const notifDocs = [...notifIds].map((id) => ({ id }))
    const notifsDeleted = await deleteDocuments('notifications', notifDocs)
    console.log(`✅ Deleted ${notifsDeleted} notification documents from "notifications"`)

    // 6. Optional storage file deletion
    if (storageBucket) {
      try {
        const bucket = getStorage().bucket()
        const [files] = await bucket.getFiles({ prefix: 'certificates/' })
        if (files.length > 0) {
          console.log(`\n📦 Found ${files.length} certificate files in storage. Deleting...`)
          for (const file of files) {
            await file.delete()
            console.log(`   🗑️ Deleted file: ${file.name}`)
          }
          console.log('✅ Storage certificate files cleared.')
        } else {
          console.log('\n📦 No certificate files found in storage.')
        }
      } catch (storageError) {
        console.warn('\n⚠️ Storage files cleanup skipped or failed:', storageError.message)
      }
    }

    console.log('\n🎉 Training Provider dashboard data cleared successfully!\n')
    process.exit(0)
  } catch (error) {
    console.error('\n❌ Clearance failed:', error)
    process.exit(1)
  }
}

run()
