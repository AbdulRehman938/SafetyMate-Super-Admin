/**
 * clear_module_databases.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Wipes Firestore data for one or more of these three dashboards:
 *
 *   Fleet Management
 *     fleet_vehicles        registered vehicle records
 *     fleet_inspections     inspection logs & drafts
 *     fleet_fuel_logs       fuel fill entries
 *     fleet_alerts          vehicle alert / anomaly records
 *
 *   Fire Extinguisher Safety
 *     fe_assets             extinguisher asset registry
 *     fe_inspections        inspection records & drafts
 *     fe_alerts             compliance alert records
 *     fe_activity_log       audit / activity log entries
 *
 *   Fire Detection & Alarms
 *     fd_assets             detector / hydrant asset registry
 *     fd_panels             fire panel records
 *     fd_zones              zone definitions
 *     fd_alerts             detection alert records
 *     fd_activity_log       audit / activity log entries
 *     fd_incidents          incident reports
 *
 * ── DOES NOT TOUCH ───────────────────────────────────────────────────────────
 *   user_profiles, organizations, training_requests, certificates,
 *   notifications, incidents, sos_alerts, hira_assessments, ppe_assets,
 *   invoices, billing_events, security_audit_logs — or ANY other collection.
 *
 * ── Usage ────────────────────────────────────────────────────────────────────
 *   node scripts/clear_module_databases.js                  # clears ALL three
 *   node scripts/clear_module_databases.js --fleet          # fleet only
 *   node scripts/clear_module_databases.js --fire-ext       # fire extinguisher only
 *   node scripts/clear_module_databases.js --fire-det       # fire detection only
 *   node scripts/clear_module_databases.js --fleet --fire-ext  # two at once
 *
 * ── Requirements ─────────────────────────────────────────────────────────────
 *   serviceAccountKey.json in the project root, OR
 *   GOOGLE_APPLICATION_CREDENTIALS env var pointing to your key file.
 *
 * ⚠  IRREVERSIBLE — verify the correct Firebase project before running.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore }                  from 'firebase-admin/firestore'
import { readFileSync, existsSync }      from 'fs'
import { resolve, dirname }              from 'path'
import { fileURLToPath }                 from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Firestore collection lists per dashboard ──────────────────────────────────

const DASHBOARD_COLLECTIONS = {
  fleet: {
    label: 'Fleet Management',
    emoji: '🚗',
    collections: [
      'fleet_vehicles',
      'fleet_inspections',
      'fleet_fuel_logs',
      'fleet_alerts',
    ],
  },
  'fire-ext': {
    label: 'Fire Extinguisher Safety',
    emoji: '🔥',
    collections: [
      'fe_assets',
      'fe_inspections',
      'fe_alerts',
      'fe_activity_log',
    ],
  },
  'fire-det': {
    label: 'Fire Detection & Alarms',
    emoji: '🚨',
    collections: [
      'fd_assets',
      'fd_panels',
      'fd_zones',
      'fd_alerts',
      'fd_activity_log',
      'fd_incidents',
    ],
  },
}

// ── Parse CLI flags ───────────────────────────────────────────────────────────

const args = process.argv.slice(2)

// If no flags given → clear all three
const clearAll  = args.length === 0
const targets   = clearAll
  ? Object.keys(DASHBOARD_COLLECTIONS)
  : Object.keys(DASHBOARD_COLLECTIONS).filter((key) => args.includes(`--${key}`))

if (targets.length === 0) {
  console.error(
    '\n❌  Unknown flag(s). Valid flags: --fleet  --fire-ext  --fire-det\n' +
    '    Run with no flags to clear all three dashboards.\n'
  )
  process.exit(1)
}

// ── Initialise Firebase Admin ─────────────────────────────────────────────────

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
      '\n❌  No credentials found.\n' +
      '   Place serviceAccountKey.json in the project root, or set\n' +
      '   GOOGLE_APPLICATION_CREDENTIALS to your service account key path.\n'
    )
    process.exit(1)
  }
}

const db = getFirestore()

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Delete every document in `collectionName` in batches of up to 400.
 * Returns the total number of documents deleted.
 */
async function deleteCollection(collectionName, batchSize = 400) {
  const ref   = db.collection(collectionName)
  let   total = 0

  for (;;) {
    const snap = await ref.limit(batchSize).get()
    if (snap.empty) break

    const batch = db.batch()
    snap.docs.forEach((d) => batch.delete(d.ref))
    await batch.commit()

    total += snap.size
    process.stdout.write(`    ${collectionName}: ${total} deleted…\r`)
  }

  // Clear the inline progress line
  process.stdout.write(' '.repeat(60) + '\r')
  return total
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // Build the full list of collections we will touch
  const allTargetedCollections = targets.flatMap(
    (key) => DASHBOARD_COLLECTIONS[key].collections
  )

  console.log('\n🗑️   SafetyMate — Module Dashboard Data Clear')
  console.log('══════════════════════════════════════════════════════')
  console.log('Dashboards selected:')
  targets.forEach((key) => {
    const { label, emoji, collections } = DASHBOARD_COLLECTIONS[key]
    console.log(`  ${emoji}  ${label}`)
    collections.forEach((c) => console.log(`        • ${c}`))
  })
  console.log('\nAll other collections will NOT be touched.')
  console.log('══════════════════════════════════════════════════════\n')

  let grandTotal = 0

  for (const key of targets) {
    const { label, emoji, collections } = DASHBOARD_COLLECTIONS[key]
    console.log(`${emoji}  Clearing ${label}…`)

    for (const col of collections) {
      try {
        const n = await deleteCollection(col)
        const label = n === 0 ? '(already empty)' : `${n} document${n !== 1 ? 's' : ''} deleted`
        console.log(`  ✔  ${col.padEnd(24)} ${label}`)
        grandTotal += n
      } catch (err) {
        console.error(`  ✖  ${col.padEnd(24)} ERROR: ${err.message}`)
      }
    }

    console.log()
  }

  console.log('══════════════════════════════════════════════════════')
  console.log(`✅  Done — ${grandTotal} document${grandTotal !== 1 ? 's' : ''} deleted across ${targets.length} dashboard${targets.length !== 1 ? 's' : ''}.`)
  console.log('    The selected dashboards are clean and ready for client handover.')
  console.log('    No other data was affected.')
  console.log('══════════════════════════════════════════════════════\n')

  process.exit(0)
}

main().catch((err) => {
  console.error('\n❌  Fatal error:', err.message)
  process.exit(1)
})
