/**
 * seed_fleet_vehicles.js
 * Seeds Firestore fleet collections using SUPER_ADMIN credentials.
 * Follows the same auth pattern as create_test_requests.js.
 *
 * Usage (from project root):
 *   node scripts/seed_fleet_vehicles.js <super_admin_email> <super_admin_password>
 *
 * Example:
 *   node scripts/seed_fleet_vehicles.js admin@safetymate.com YourPassword123
 */

import fs from 'fs'
import path from 'path'
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth'

// ── Load .env ─────────────────────────────────────────────────────────────────
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
  apiKey:            env.VITE_FIREBASE_API_KEY,
  authDomain:        env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             env.VITE_FIREBASE_APP_ID,
}

// ── Firebase init ─────────────────────────────────────────────────────────────
const app  = initializeApp(firebaseConfig)
const db   = getFirestore(app)
const auth = getAuth(app)

// ── CLI args (same pattern as create_test_requests.js) ────────────────────────
const adminEmail    = process.argv[2]
const adminPassword = process.argv[3]

if (!adminEmail || !adminPassword) {
  console.log('\n--- SafetyMate Fleet Seed Utility ---')
  console.log('Usage: node scripts/seed_fleet_vehicles.js <super_admin_email> <super_admin_password>\n')
  console.log('Example:')
  console.log('  node scripts/seed_fleet_vehicles.js admin@safetymate.com YourPassword123\n')
  process.exit(1)
}

// ── Vehicle seed data ─────────────────────────────────────────────────────────
const VEHICLES = [
  {
    unitId: 'VX-702', vehicleType: 'Hauler', category: 'Heavy Duty',
    driverName: 'James Mokoena', site: 'Sector 7G - Perimeter',
    department: 'Operations', status: 'active',
    healthScore: 98, fuelLevel: 72, mileageKm: 12450,
    crewAssigned: true,
    lat: -26.2041, lng: 28.0473,
    fuelEfficiency: 'A+', engineLoad: 14, tirePressure: 'Nominal', uptime: 99.2,
    lastService: new Date('2024-10-01'), nextService: new Date('2025-01-01'),
  },
  {
    unitId: 'GT-119', vehicleType: 'Utility', category: 'Support',
    driverName: 'Sara Dlamini', site: 'Sector 7G - Perimeter',
    department: 'Rapid Response', status: 'active',
    healthScore: 76, fuelLevel: 45, mileageKm: 8320,
    crewAssigned: true,
    lat: -26.2120, lng: 28.0521,
    fuelEfficiency: 'B', engineLoad: 22, tirePressure: 'Nominal', uptime: 97.1,
    lastService: new Date('2024-09-15'), nextService: new Date('2024-12-15'),
  },
  {
    unitId: 'MS-990', vehicleType: 'Hauler', category: 'Standard',
    driverName: 'Thabo Nkosi', site: 'East Gate Complex',
    department: 'Logistics', status: 'active',
    healthScore: 88, fuelLevel: 91, mileageKm: 5670,
    crewAssigned: true,
    lat: -26.1980, lng: 28.0610,
    fuelEfficiency: 'A', engineLoad: 18, tirePressure: 'Nominal', uptime: 98.5,
    lastService: new Date('2024-10-20'), nextService: new Date('2025-01-20'),
  },
  {
    unitId: 'VX-442', vehicleType: 'Hauler', category: 'Heavy Duty',
    driverName: '', site: 'Workshop Bay 3',
    department: 'Maintenance', status: 'maintenance',
    healthScore: 41, fuelLevel: 18, mileageKm: 31200,
    crewAssigned: false,
    lat: -26.2200, lng: 28.0390,
    fuelEfficiency: 'C-', engineLoad: 0, tirePressure: 'Low', uptime: 71.0,
    lastService: new Date('2024-07-01'), nextService: new Date('2024-10-01'),
  },
  {
    unitId: 'VX-901', vehicleType: 'Utility', category: 'Support',
    driverName: 'Lerato Sithole', site: 'North Perimeter',
    department: 'Security', status: 'active',
    healthScore: 92, fuelLevel: 63, mileageKm: 4110,
    crewAssigned: true,
    lat: -26.1900, lng: 28.0480,
    fuelEfficiency: 'A+', engineLoad: 11, tirePressure: 'Nominal', uptime: 99.8,
    lastService: new Date('2024-10-24'), nextService: new Date('2025-01-24'),
  },
  {
    unitId: 'BT-330', vehicleType: 'Bus', category: 'Standard',
    driverName: 'Andile Zulu', site: 'Main Entrance',
    department: 'Operations', status: 'active',
    healthScore: 85, fuelLevel: 55, mileageKm: 19800,
    crewAssigned: true,
    lat: -26.2060, lng: 28.0540,
    fuelEfficiency: 'B+', engineLoad: 25, tirePressure: 'Nominal', uptime: 96.4,
    lastService: new Date('2024-09-01'), nextService: new Date('2024-12-01'),
  },
  {
    unitId: 'TK-551', vehicleType: 'Tanker', category: 'Heavy Duty',
    driverName: 'Nomsa Khumalo', site: 'Fuel Depot Alpha',
    department: 'Logistics', status: 'active',
    healthScore: 79, fuelLevel: 100, mileageKm: 22100,
    crewAssigned: true,
    lat: -26.2150, lng: 28.0450,
    fuelEfficiency: 'B', engineLoad: 30, tirePressure: 'Nominal', uptime: 94.7,
    lastService: new Date('2024-08-15'), nextService: new Date('2024-11-15'),
  },
  {
    unitId: 'CR-210', vehicleType: 'Crane', category: 'Heavy Duty',
    driverName: 'Sipho Mahlangu', site: 'Construction Zone B',
    department: 'Operations', status: 'active',
    healthScore: 94, fuelLevel: 48, mileageKm: 7900,
    crewAssigned: true,
    lat: -26.2080, lng: 28.0600,
    fuelEfficiency: 'A', engineLoad: 45, tirePressure: 'Nominal', uptime: 99.1,
    lastService: new Date('2024-11-01'), nextService: new Date('2025-02-01'),
  },
]

// ── Alerts (keyed by unitId, vehicleId filled in after vehicles created) ───────
const ALERTS = [
  { unitId: 'VX-702', vehicleUnit: 'UNIT VX-702', message: 'Brake Pressure Drop',        severity: 'critical' },
  { unitId: 'GT-119', vehicleUnit: 'UNIT GT-119', message: 'Service Overdue',             severity: 'critical' },
  { unitId: 'VX-442', vehicleUnit: 'UNIT VX-442', message: 'Tire Pressure Below Minimum', severity: 'critical' },
  { unitId: 'BT-330', vehicleUnit: 'UNIT BT-330', message: 'Next service in < 500km',     severity: 'warning'  },
]

// ── Inspections ───────────────────────────────────────────────────────────────
const INSPECTIONS = [
  { unitId: 'VX-702', inspectionType: 'Pre-trip',          outcome: 'pass',        inspector: 'J. Mokoena', notes: 'All systems nominal. Brakes checked.' },
  { unitId: 'GT-119', inspectionType: 'Scheduled Service', outcome: 'conditional', inspector: 'Workshop',   notes: 'Oil change done. Left mirror requires replacement.' },
  { unitId: 'MS-990', inspectionType: 'Pre-trip',          outcome: 'pass',        inspector: 'T. Nkosi',   notes: 'Passed all pre-departure checks.' },
  { unitId: 'VX-442', inspectionType: 'Roadworthy',        outcome: 'fail',        inspector: 'Workshop',   notes: 'Front axle wear exceeds tolerance. Grounded for repair.' },
  { unitId: 'VX-901', inspectionType: 'Pre-trip',          outcome: 'pass',        inspector: 'L. Sithole', notes: 'Fleet ready. GPS calibrated.' },
  { unitId: 'BT-330', inspectionType: 'Post-trip',         outcome: 'pass',        inspector: 'A. Zulu',    notes: 'No issues post-trip. Fuel topped up.' },
  { unitId: 'TK-551', inspectionType: 'Pre-trip',          outcome: 'pass',        inspector: 'N. Khumalo', notes: 'Tanker seals checked. Fuel cap secured.' },
  { unitId: 'CR-210', inspectionType: 'Scheduled Service', outcome: 'pass',        inspector: 'S. Mahlangu', notes: 'Crane hydraulics serviced. Load test passed.' },
]

// ── Fuel logs ─────────────────────────────────────────────────────────────────
const FUEL_LOGS = [
  { unitId: 'VX-702', litres: 120, costPerLitre: 22.80, station: 'Site Depot Alpha',  odometer: 12300 },
  { unitId: 'GT-119', litres: 65,  costPerLitre: 22.80, station: 'Site Depot Alpha',  odometer: 8200  },
  { unitId: 'MS-990', litres: 90,  costPerLitre: 23.10, station: 'Fuel Point East',   odometer: 5500  },
  { unitId: 'VX-901', litres: 55,  costPerLitre: 22.80, station: 'Site Depot Alpha',  odometer: 4050  },
  { unitId: 'BT-330', litres: 200, costPerLitre: 22.50, station: 'Main Depot',        odometer: 19600 },
  { unitId: 'TK-551', litres: 400, costPerLitre: 22.80, station: 'Fuel Depot Alpha',  odometer: 21900 },
  { unitId: 'CR-210', litres: 110, costPerLitre: 23.00, station: 'Construction Depot', odometer: 7800 },
  { unitId: 'VX-702', litres: 95,  costPerLitre: 22.80, station: 'Site Depot Alpha',  odometer: 12100 },
  { unitId: 'MS-990', litres: 80,  costPerLitre: 22.90, station: 'Fuel Point East',   odometer: 5300  },
]

// ── Main ──────────────────────────────────────────────────────────────────────
async function run() {
  try {
    console.log('\n--- SafetyMate Fleet Seed Utility ---')
    console.log('Authenticating as Super Admin...')
    await signInWithEmailAndPassword(auth, adminEmail, adminPassword)
    console.log('Authentication successful!\n')

    // 1. Insert vehicles — collect docId map
    console.log('Seeding fleet_vehicles...')
    const idMap = {}   // unitId → Firestore docId
    for (const v of VEHICLES) {
      const { lastService, nextService, ...rest } = v
      const ref = await addDoc(collection(db, 'fleet_vehicles'), {
        ...rest,
        lastService:  lastService  || null,
        nextService:  nextService  || null,
        createdAt:    serverTimestamp(),
        updatedAt:    serverTimestamp(),
      })
      idMap[v.unitId] = ref.id
      console.log(`  + ${v.unitId} (${v.vehicleType} | ${v.status}) → ${ref.id}`)
    }

    // 2. Insert alerts
    console.log('\nSeeding fleet_alerts...')
    for (const a of ALERTS) {
      const { unitId, ...rest } = a
      await addDoc(collection(db, 'fleet_alerts'), {
        ...rest,
        vehicleId: idMap[unitId] ?? null,
        status:    'open',
        createdAt: serverTimestamp(),
      })
      console.log(`  + ${a.vehicleUnit}: ${a.message} [${a.severity}]`)
    }

    // 3. Insert inspections
    console.log('\nSeeding fleet_inspections...')
    for (const ins of INSPECTIONS) {
      const { unitId, ...rest } = ins
      await addDoc(collection(db, 'fleet_inspections'), {
        ...rest,
        vehicleId:   idMap[unitId] ?? null,
        inspectedAt: serverTimestamp(),
      })
      console.log(`  + ${unitId} — ${ins.inspectionType} (${ins.outcome})`)
    }

    // 4. Insert fuel logs
    console.log('\nSeeding fleet_fuel_logs...')
    for (const f of FUEL_LOGS) {
      const { unitId, ...rest } = f
      await addDoc(collection(db, 'fleet_fuel_logs'), {
        ...rest,
        vehicleId:  idMap[unitId] ?? null,
        totalCost:  rest.litres * rest.costPerLitre,
        loggedAt:   serverTimestamp(),
      })
      console.log(`  + ${unitId} — ${rest.litres}L @ R${rest.costPerLitre}/L = R${(rest.litres * rest.costPerLitre).toFixed(2)}`)
    }

    await signOut(auth)

    console.log('\n=== Seeding Complete ===')
    console.log(`  ${VEHICLES.length}    vehicles`)
    console.log(`  ${ALERTS.length}     alerts`)
    console.log(`  ${INSPECTIONS.length}    inspections`)
    console.log(`  ${FUEL_LOGS.length}     fuel logs`)
    console.log('\nSign in as fleet@safetymate.com / Fleet@2024 to see all data.\n')

  } catch (error) {
    console.error('\nError seeding fleet data:', error.message || error, '\n')
    process.exit(1)
  }
}

run()
