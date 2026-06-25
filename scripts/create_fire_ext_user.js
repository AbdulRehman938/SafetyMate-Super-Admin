/**
 * create_fire_ext_user.js
 * ─────────────────────────────────────────────────────────────
 * Creates a Firebase Auth user + Firestore user_profiles doc
 * with role = FIRE_EXTINGUISHER so they can access the
 * Fireguard Command Center dashboard.
 *
 * Usage:
 *   node scripts/create_fire_ext_user.js
 *
 * Requirements:
 *   serviceAccountKey.json in project root  OR
 *   GOOGLE_APPLICATION_CREDENTIALS env var set
 * ─────────────────────────────────────────────────────────────
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getAuth }                      from 'firebase-admin/auth'
import { getFirestore, FieldValue }     from 'firebase-admin/firestore'
import { readFileSync, existsSync }      from 'fs'
import { resolve, dirname }              from 'path'
import { fileURLToPath }                 from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

/* ── Credentials ─────────────────────────────────────────── */
const KEY_PATH = resolve(__dirname, '../serviceAccountKey.json')

if (!getApps().length) {
  if (existsSync(KEY_PATH)) {
    initializeApp({ credential: cert(JSON.parse(readFileSync(KEY_PATH, 'utf8'))) })
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    initializeApp()
  } else {
    console.error('✖  No credentials found. Place serviceAccountKey.json in project root.')
    process.exit(1)
  }
}

const adminAuth = getAuth()
const db        = getFirestore()

/* ── User configuration — edit these before running ───────── */
const USER = {
  email:        'firetech@safetymate.dev',   // change to your preferred email
  password:     'FireSafe@2024!',            // min 8 chars, must contain upper + number
  fullName:     'Fire Safety Technician',
  role:         'FIRE_EXTINGUISHER',
  phone:        '',                          // optional
  organization: 'SafetyMate Demo',
}

/* ── Main ─────────────────────────────────────────────────── */
async function main() {
  console.log('\n🔥  Creating FIRE_EXTINGUISHER user')
  console.log('────────────────────────────────────')
  console.log(`  Email:    ${USER.email}`)
  console.log(`  Name:     ${USER.fullName}`)
  console.log(`  Role:     ${USER.role}`)
  console.log('')

  /* 1. Create Firebase Auth account */
  let uid
  try {
    const existing = await adminAuth.getUserByEmail(USER.email).catch(() => null)
    if (existing) {
      uid = existing.uid
      console.log(`  ℹ  Auth user already exists — uid: ${uid}`)
    } else {
      const record = await adminAuth.createUser({
        email:         USER.email,
        password:      USER.password,
        displayName:   USER.fullName,
        emailVerified: true,
      })
      uid = record.uid
      console.log(`  ✔  Auth user created — uid: ${uid}`)
    }
  } catch (err) {
    console.error(`  ✖  Failed to create Auth user: ${err.message}`)
    process.exit(1)
  }

  /* 2. Write / overwrite user_profiles document */
  try {
    await db.collection('user_profiles').doc(uid).set({
      uid,
      fullName:       USER.fullName,
      email:          USER.email,
      phone:          USER.phone || null,
      role:           USER.role,
      organization:   USER.organization,
      status:         'active',
      createdAt:      FieldValue.serverTimestamp(),
      updatedAt:      FieldValue.serverTimestamp(),
    }, { merge: true })
    console.log(`  ✔  user_profiles/${uid} written`)
  } catch (err) {
    console.error(`  ✖  Failed to write Firestore profile: ${err.message}`)
    process.exit(1)
  }

  console.log('')
  console.log('✅  Done! Login credentials:')
  console.log(`    Email   : ${USER.email}`)
  console.log(`    Password: ${USER.password}`)
  console.log('    Role    : FIRE_EXTINGUISHER')
  console.log('    URL     : /extinguisher/dashboard')
  console.log('')
  process.exit(0)
}

main().catch((err) => {
  console.error('✖  Fatal:', err.message)
  process.exit(1)
})
