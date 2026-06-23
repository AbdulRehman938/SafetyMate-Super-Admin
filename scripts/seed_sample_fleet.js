/**
 * seed_sample_fleet.js
 * Seeds a few sample vehicles, alerts, inspections, and fuel logs.
 * Authenticates as the Fleet user.
 *
 * Usage:
 *   node scripts/seed_sample_fleet.js
 */

import fs from 'fs'
import path from 'path'
import { initializeApp } from 'firebase/app'
import {
  getFirestore,
  collection,
  doc,
  writeBatch,
  getDocs,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore'
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth'

// 1. Load config from .env
const envPath = path.resolve(process.cwd(), '.env')
if (!fs.existsSync(envPath)) {
  console.error('Error: .env file not found.')
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

const app  = initializeApp(firebaseConfig)
const db   = getFirestore(app)
const auth = getAuth(app)

const email    = 'fleet@safetymate.com'
const password = 'Fleet@2024'

async function run() {
  try {
    console.log(`Authenticating as ${email}...`)
    const userCred = await signInWithEmailAndPassword(auth, email, password)
    const uid = userCred.user.uid
    console.log(`Authenticated! UID: ${uid}\n`)

    // We fetch existing vehicles to check for duplicates
    const existingSnap = await getDocs(collection(db, 'fleet_vehicles'))
    const existingUnitIds = new Set(existingSnap.docs.map(d => d.data().unitId))
    console.log(`Found ${existingUnitIds.size} existing vehicles in the DB.`)

    const vehiclesToSeed = [
      {
        unitId: 'VX-702',
        plateNumber: 'TX-992-K',
        vin: '8XF-2940-SHL',
        vehicleType: 'Hauler',
        category: 'Heavy Duty',
        model: 'Volvo FH16',
        driverName: 'James Mokoena',
        site: 'Sector 7G',
        department: 'Operations',
        status: 'active',
        healthScore: 94,
        fuelLevel: 72,
        mileageKm: 452180,
        crewAssigned: true,
        lat: -26.2041,
        lng: 28.0473,
        fuelEfficiency: 'A+',
        engineLoad: 14,
        tirePressure: 'Nominal',
        uptime: 99.2,
        lastService: new Date('2024-10-01'),
        nextService: new Date('2025-01-01'),
      },
      {
        unitId: 'UT-104',
        plateNumber: 'NY-881-A',
        vin: '1FT-8392-LOK',
        vehicleType: 'Utility',
        category: 'Standard',
        model: 'Ford F-150',
        driverName: 'Sara Dlamini',
        site: 'North Ridge',
        department: 'Logistics',
        status: 'maintenance',
        healthScore: 78,
        fuelLevel: 45,
        mileageKm: 82450,
        crewAssigned: true,
        lat: -26.2120,
        lng: 28.0521,
        fuelEfficiency: 'B',
        engineLoad: 22,
        tirePressure: 'Nominal',
        uptime: 97.1,
        lastService: new Date('2024-09-15'),
        nextService: new Date('2024-12-15'),
      },
      {
        unitId: 'SP-449',
        plateNumber: 'CA-552-L',
        vin: '3WD-7482-PQA',
        vehicleType: 'Support',
        category: 'Support',
        model: 'Mercedes Sprinter',
        driverName: 'Thabo Nkosi',
        site: 'South Bay',
        department: 'Maintenance',
        status: 'suspended',
        healthScore: 54,
        fuelLevel: 18,
        mileageKm: 112900,
        crewAssigned: false,
        lat: -26.2200,
        lng: 28.0390,
        fuelEfficiency: 'C-',
        engineLoad: 0,
        tirePressure: 'Low',
        uptime: 71.0,
        lastService: new Date('2024-07-01'),
        nextService: new Date('2024-10-01'),
      },
      {
        unitId: 'GT-119',
        plateNumber: 'MP-291-K',
        vin: '4HG-3829-MNO',
        vehicleType: 'Utility',
        category: 'Standard',
        model: 'Toyota Hilux',
        driverName: 'Sara Dlamini',
        site: 'Sector 7G',
        department: 'Operations',
        status: 'active',
        healthScore: 82,
        fuelLevel: 60,
        mileageKm: 120500,
        crewAssigned: true,
        lat: -26.2110,
        lng: 28.0490,
        fuelEfficiency: 'A',
        engineLoad: 18,
        tirePressure: 'Nominal',
        uptime: 98.2,
        lastService: new Date('2024-08-10'),
        nextService: new Date('2024-11-10'),
      },
      {
        unitId: 'BT-330',
        plateNumber: 'GP-883-M',
        vin: '9PL-9238-ZXY',
        vehicleType: 'Bus',
        category: 'Standard',
        model: 'Mercedes Benz Bus',
        driverName: 'Andile Zulu',
        site: 'North Ridge',
        department: 'Logistics',
        status: 'active',
        healthScore: 88,
        fuelLevel: 85,
        mileageKm: 19800,
        crewAssigned: true,
        lat: -26.2060,
        lng: 28.0540,
        fuelEfficiency: 'B+',
        engineLoad: 25,
        tirePressure: 'Nominal',
        uptime: 96.4,
        lastService: new Date('2024-09-01'),
        nextService: new Date('2024-12-01'),
      }
    ]

    const vehiclesToInsert = vehiclesToSeed.filter(v => !existingUnitIds.has(v.unitId))

    if (vehiclesToInsert.length === 0) {
      console.log('Sample vehicles already exist in database. Skipping vehicle insertion.')
    } else {
      console.log(`Seeding ${vehiclesToInsert.length} vehicles...`)
      const batch = writeBatch(db)
      const idMap = {}
      vehiclesToInsert.forEach((v) => {
        const docRef = doc(collection(db, 'fleet_vehicles'))
        idMap[v.unitId] = docRef.id
        batch.set(docRef, {
          ...v,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      })
      await batch.commit()
      console.log('Vehicles seeded successfully.')

      // Now add alerts/defects for VX-702
      if (idMap['VX-702']) {
        console.log('Seeding defects for VX-702...')
        const alertsBatch = writeBatch(db)
        const alerts = [
          {
            vehicleId: idMap['VX-702'],
            vehicleUnit: 'UNIT VX-702',
            message: 'Headlight Assembly - LH Flicker',
            severity: 'critical',
            status: 'resolved',
            createdAt: new Date('2024-10-04'),
            resolvedAt: new Date('2024-10-06'),
            reference: '#DEF-891',
          },
          {
            vehicleId: idMap['VX-702'],
            vehicleUnit: 'UNIT VX-702',
            message: 'Brake Fluid Pressure Sensor Error',
            severity: 'minor',
            status: 'pending',
            createdAt: new Date('2024-10-12'),
            reference: '#DEF-815',
          },
          {
            vehicleId: idMap['VX-702'],
            vehicleUnit: 'UNIT VX-702',
            message: 'Cab Door Seal Degradation',
            severity: 'low',
            status: 'escalated',
            createdAt: new Date('2024-10-28'),
            reference: '#DEF-847',
          }
        ]
        alerts.forEach((a) => {
          const docRef = doc(collection(db, 'fleet_alerts'))
          alertsBatch.set(docRef, a)
        })
        await alertsBatch.commit()

        console.log('Seeding inspections and fuel logs for VX-702...')
        const inspectionsBatch = writeBatch(db)
        const inspections = [
          { vehicleId: idMap['VX-702'], unitId: 'VX-702', inspectionType: 'Safety Audit', outcome: 'pass', inspector: 'H. Raheem', notes: 'Brake lines verified, pressure nominal.', inspectedAt: new Date('2024-10-15') },
          { vehicleId: idMap['VX-702'], unitId: 'VX-702', inspectionType: 'Daily Pre-Trip', outcome: 'pass', inspector: 'J. Mokoena', notes: 'All fluids checked. Headlight resolved.', inspectedAt: new Date('2024-10-06') }
        ]
        inspections.forEach(ins => {
          const docRef = doc(collection(db, 'fleet_inspections'))
          inspectionsBatch.set(docRef, ins)
        })
        await inspectionsBatch.commit()

        const fuelBatch = writeBatch(db)
        const fuel = [
          { vehicleId: idMap['VX-702'], unitId: 'VX-702', litres: 120, costPerLitre: 22.8, station: 'Depot Alpha', odometer: 452180, loggedAt: new Date('2024-10-25') },
          { vehicleId: idMap['VX-702'], unitId: 'VX-702', litres: 110, costPerLitre: 22.8, station: 'Depot Alpha', odometer: 451800, loggedAt: new Date('2024-10-10') }
        ]
        fuel.forEach(f => {
          const docRef = doc(collection(db, 'fleet_fuel_logs'))
          fuelBatch.set(docRef, f)
        })
        await fuelBatch.commit()
      }
    }

    console.log('\nSeed script complete.')
    await signOut(auth)
  } catch (err) {
    console.error('Error seeding sample data:', err.message || err)
    process.exit(1)
  }
}

run()
