/**
 * Cleanup Script: Remove provider-scheduled sessions from training_requests collection
 * 
 * This script removes all documents from the training_requests collection that are NOT
 * client requests (i.e., provider-scheduled sessions). Client requests have source: 'client_request'.
 * 
 * Run with: node scripts/cleanup-training-requests.js
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import fs from 'fs'

// Initialize Firebase Admin SDK
// You need to have your service account key at the path below
// Or set the GOOGLE_APPLICATION_CREDENTIALS environment variable
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || './serviceAccountKey.json'

try {
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'))
  
  initializeApp({
    credential: cert(serviceAccount)
  })
} catch (error) {
  console.error('Failed to load service account key.')
  console.error('Please set GOOGLE_APPLICATION_CREDENTIALS environment variable or place service-account-key.json in the project root.')
  console.error('Error:', error.message)
  process.exit(1)
}

const db = getFirestore()

async function cleanupTrainingRequests() {
  console.log('🔍 Starting cleanup of training_requests collection...\n')
  
  try {
    // Get all documents from training_requests
    const snapshot = await db.collection('training_requests').get()
    const allDocs = snapshot.docs
    
    console.log(`📊 Found ${allDocs.length} total documents in training_requests`)
    
    // Separate client requests from provider-scheduled sessions
    const clientRequests = []
    const providerSessions = []
    
    allDocs.forEach(doc => {
      const data = doc.data()
      const source = data.source
      
      if (source === 'client_request') {
        clientRequests.push({ id: doc.id, ...data })
      } else {
        // This includes: source: 'provider_scheduled', missing source, or any other value
        providerSessions.push({ id: doc.id, ...data, source: source || 'missing' })
      }
    })
    
    console.log(`\n✅ Client requests (will be kept): ${clientRequests.length}`)
    console.log(`🗑️  Provider-scheduled sessions (will be deleted): ${providerSessions.length}`)
    
    if (providerSessions.length === 0) {
      console.log('\n✨ No provider-scheduled sessions found. Nothing to delete.')
      return
    }
    
    // Confirm before deletion
    console.log('\n⚠️  WARNING: This will permanently delete the above provider-scheduled sessions.')
    console.log('These sessions should have been migrated to the training_sessions collection.')
    
    // Ask for confirmation (in a real script, you might want to add a prompt)
    // For now, we'll proceed with deletion since the user requested it
    
    console.log('\n🗑️  Deleting provider-scheduled sessions...')
    
    let deletedCount = 0
    let errorCount = 0
    
    // Delete in batches (Firestore allows max 500 operations per batch)
    const batchSize = 500
    
    for (let i = 0; i < providerSessions.length; i += batchSize) {
      const batch = db.batch()
      const batchDocs = providerSessions.slice(i, i + batchSize)
      
      batchDocs.forEach(doc => {
        batch.delete(db.collection('training_requests').doc(doc.id))
      })
      
      try {
        await batch.commit()
        deletedCount += batchDocs.length
        console.log(`   Deleted batch ${Math.floor(i / batchSize) + 1}: ${batchDocs.length} documents`)
      } catch (error) {
        console.error(`   Error in batch ${Math.floor(i / batchSize) + 1}:`, error.message)
        errorCount += batchDocs.length
      }
    }
    
    console.log(`\n✅ Cleanup complete!`)
    console.log(`   Successfully deleted: ${deletedCount}`)
    console.log(`   Errors: ${errorCount}`)
    console.log(`   Client requests remaining: ${clientRequests.length}`)
    
  } catch (error) {
    console.error('\n❌ Error during cleanup:', error)
    process.exit(1)
  }
}

// Run the cleanup
cleanupTrainingRequests()
  .then(() => {
    console.log('\n🎉 Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error)
    process.exit(1)
  })
