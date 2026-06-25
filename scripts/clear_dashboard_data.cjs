/**
 * Script to clear all data from the three dashboards:
 * - Fleet Dashboard
 * - Fire Extinguisher Dashboard  
 * - Training Dashboard
 * 
 * ⚠️  WARNING: This script will permanently delete ALL data from the specified collections.
 * Use with caution and ensure you have backups if needed.
 */

const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { readFileSync } = require('fs');
const { join } = require('path');

// Read service account key
const serviceAccountPath = join(__dirname, '../serviceAccountKey.json');
let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
  console.log('✅ Service account key loaded successfully');
} catch (error) {
  console.error('❌ Error reading serviceAccountKey.json:', error.message);
  console.error('   Make sure the file exists in the project root directory.');
  process.exit(1);
}

// Initialize Firebase Admin
try {
  if (getApps().length === 0) {
    initializeApp({
      credential: cert(serviceAccount)
    });
  }
  console.log('✅ Firebase Admin initialized successfully');
} catch (error) {
  console.error('❌ Error initializing Firebase Admin:', error.message);
  console.error('   Full error:', error);
  process.exit(1);
}

const db = getFirestore();

// Collections to clear for each dashboard
const COLLECTIONS_TO_CLEAR = {
  fleet: [
    'fleet_vehicles',
    'fleet_inspections',
    'fleet_fuel_logs',
    'fleet_alerts'
  ],
  fireExtinguisher: [
    'fe_assets',
    'fe_inspections',
    'fe_alerts',
    'fe_activity_log'
  ],
  training: [
    'training_requests',
    'certificates'
  ]
};

/**
 * Delete all documents in a collection
 * @param {string} collectionName - Name of the collection to clear
 * @returns {Promise<number>} Number of documents deleted
 */
async function clearCollection(collectionName) {
  console.log(`\n📁 Clearing collection: ${collectionName}`);
  
  try {
    const snapshot = await db.collection(collectionName).get();
    const count = snapshot.size;
    
    if (count === 0) {
      console.log(`   ✅ Collection is already empty`);
      return 0;
    }
    
    console.log(`   📊 Found ${count} documents to delete`);
    
    // Delete documents in batches (Firestore limit is 500 per batch)
    const batchSize = 500;
    let deleted = 0;
    
    for (let i = 0; i < snapshot.docs.length; i += batchSize) {
      const batch = db.batch();
      const chunk = snapshot.docs.slice(i, i + batchSize);
      
      chunk.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      deleted += chunk.length;
      console.log(`   🗑️  Deleted ${deleted}/${count} documents`);
    }
    
    console.log(`   ✅ Successfully deleted ${count} documents from ${collectionName}`);
    return count;
  } catch (error) {
    console.error(`   ❌ Error clearing ${collectionName}:`, error.message);
    throw error;
  }
}

/**
 * Clear all collections for a specific dashboard
 * @param {string} dashboardName - Name of the dashboard
 * @param {string[]} collections - Array of collection names to clear
 * @returns {Promise<number>} Total documents deleted
 */
async function clearDashboard(dashboardName, collections) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚨 CLEARING ${dashboardName.toUpperCase()} DASHBOARD DATA`);
  console.log('='.repeat(60));
  
  let totalDeleted = 0;
  
  for (const collection of collections) {
    try {
      const deleted = await clearCollection(collection);
      totalDeleted += deleted;
    } catch (error) {
      console.error(`   ⚠️  Failed to clear ${collection}, continuing...`);
    }
  }
  
  console.log(`\n✅ ${dashboardName} dashboard cleared: ${totalDeleted} documents deleted`);
  return totalDeleted;
}

/**
 * Main execution function
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║       DASHBOARD DATA CLEARANCE SCRIPT                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('\n⚠️  WARNING: This will permanently delete ALL data from:');
  console.log('   • Fleet Dashboard (vehicles, inspections, fuel logs, alerts)');
  console.log('   • Fire Extinguisher Dashboard (assets, inspections, alerts, activity)');
  console.log('   • Training Dashboard (training requests, certificates)');
  console.log('\n📋 Collections that will be cleared:');
  
  Object.entries(COLLECTIONS_TO_CLEAR).forEach(([dashboard, collections]) => {
    console.log(`\n   ${dashboard.toUpperCase()}:`);
    collections.forEach(col => console.log(`     - ${col}`));
  });
  
  console.log('\n' + '='.repeat(60));
  console.log('\n⏳  Waiting 10 seconds before starting...');
  console.log('   Press Ctrl+C to cancel if this is not intended.\n');
  
  // Countdown
  for (let i = 10; i > 0; i--) {
    console.log(`   ${i}...`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n🚀 Starting data clearance...\n');
  
  let grandTotal = 0;
  
  // Clear each dashboard
  try {
    grandTotal += await clearDashboard('Fleet', COLLECTIONS_TO_CLEAR.fleet);
    grandTotal += await clearDashboard('Fire Extinguisher', COLLECTIONS_TO_CLEAR.fireExtinguisher);
    grandTotal += await clearDashboard('Training', COLLECTIONS_TO_CLEAR.training);
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL DASHBOARDS CLEARED SUCCESSFULLY');
    console.log('='.repeat(60));
    console.log(`📊 Total documents deleted: ${grandTotal}`);
    console.log('\n✨ All dashboard data has been permanently removed.');
    
  } catch (error) {
    console.error('\n❌ ERROR during data clearance:', error);
    process.exit(1);
  }
}

// Run the script
main().then(() => {
  console.log('\n👋 Script completed. Exiting...');
  process.exit(0);
}).catch((error) => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});
