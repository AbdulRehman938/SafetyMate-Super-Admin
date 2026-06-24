/**
 * clear_fleet_database.js
 * ─────────────────────────────────────────────────────────────
 * Safely wipes ONLY the four Fleet Dashboard Firestore collections:
 *
 *   fleet_vehicles       — registered vehicle records
 *   fleet_inspections    — daily inspection logs & drafts
 *   fleet_fuel_logs      — fuel fill entries
 *   fleet_alerts         — vehicle alert / anomaly records
 *
 * DOES NOT touch any other collection in the database, including:
 *   user_profiles, organizations, training_requests, certificates,
 *   notifications, incidents, sos_alerts, hira_assessments,
 *   invoices, billing_events, security_audit_logs, etc.
 *
 * Usage:
 *   node scripts/clear_fleet_database.js
 *
 * Requirements:
 *   firebase-admin must be installed:
 *     npm install firebase-admin --save-dev
 *
 *   Authentication — one of:
 *   (a) Place serviceAccountKey.json in the project root, OR
 *   (b) Set GOOGLE_APPLICATION_CREDENTIALS env var to the key file path
 *
 * ⚠  IRREVERSIBLE — confirm the target project before running.
 * ─────────────────────────────────────────────────────────────
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore }                  from 'firebase-admin/firestore'
import { readFileSync, existsSync }      from 'fs'
import { resolve, dirname }              from 'path'
import { fileURLToPath }                 from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

/* ── These are the ONLY collections this script will touch ── */
const FLEET_ONLY_COLLECTIONS = [
  'fleet_vehicles',
  'fleet_inspections',
  'fleet_fuel_logs',
  'fleet_alerts',
]

/* ── Initialise Firebase Admin ───────────────────────────── */
const KEY_PATH = resolve(__dirname, '../serviceAccountKey.json')

if (!getApps().length) {
  if (existsSync(KEY_PATH)) {
    const serviceAccount = JSON.parse(readFileSync(KEY_PATH, 'utf8'))
    initializeApp({ credential: cert(serviceAccount) })
    console.log('✔  Firebase Admin initialised from serviceAccountKey.json')
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    initializeApp()
    console.log('✔  Firebase Admin initialised from GOOGLE_APPLICATION_CREDENTIALS')
  } else {
    console.error(
      '\n✖  No credentials found.\n' +
      '   Place serviceAccountKey.json in the project root, or set\n' +
      '   GOOGLE_APPLICATION_CREDENTIALS to your service account key path.\n'
    )
    process.exit(1)
  }
}

const db = getFirestore()

/**
 * Delete every document in a collection in batches of up to 400.
 * Returns the total number of documents deleted.
 */
async function deleteCollection(name, batchSize = 400) {
  const ref   = db.collection(name)
  let total   = 0

  for (;;) {
    const snap = await ref.limit(batchSize).get()
    if (snap.empty) break

    const batch = db.batch()
    snap.docs.forEach((d) => batch.delete(d.ref))
    await batch.commit()

    total += snap.size
    process.stdout.write(`  ${name}: ${total} deleted…\r`)
  }

  return total
}

/* ── Main ─────────────────────────────────────────────────── */
async function main() {
  console.log('\n🗑️   SafetyMate — Fleet Dashboard Data Clear')
  console.log('──────────────────────────────────────────────')
  console.log('Targeting ONLY these collections:')
  FLEET_ONLY_COLLECTIONS.forEach((c) => console.log(`  • ${c}`))
  console.log('\nAll other collections (user_profiles, organizations,')
  console.log('training_requests, certificates, notifications, etc.)')
  console.log('will NOT be touched.\n')

  let grandTotal = 0

  for (const col of FLEET_ONLY_COLLECTIONS) {
    try {
      const n = await deleteCollection(col)
      console.log(`  ✔  ${col.padEnd(22)} ${n} document${n !== 1 ? 's' : ''} deleted`)
      grandTotal += n
    } catch (err) {
      console.error(`  ✖  ${col} — error: ${err.message}`)
    }
  }

  console.log('\n──────────────────────────────────────────────')
  console.log(`✅  Done — ${grandTotal} fleet document${grandTotal !== 1 ? 's' : ''} deleted.`)
  console.log('    Fleet dashboard is clean and ready for the client.')
  console.log('    No other data was affected.\n')
  process.exit(0)
}

main().catch((err) => {
  console.error('\n✖  Fatal error:', err.message)
  process.exit(1)
})
