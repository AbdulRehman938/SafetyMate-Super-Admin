/**
 * seed_exact_fleet_twins.js
 * Seeds exactly 1,284 vehicles, 12 critical alerts, and detailed logs.
 * Authenticates as the Fleet user.
 *
 * Usage:
 *   node scripts/seed_exact_fleet_twins.js fleet@safetymate.com Fleet@2024
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
  deleteDoc,
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

const email    = process.argv[2] || 'fleet@safetymate.com'
const password = process.argv[3] || 'Fleet@2024'

async function run() {
  try {
    console.log(`Authenticating as ${email}...`)
    const userCred = await signInWithEmailAndPassword(auth, email, password)
    const uid = userCred.user.uid
    console.log(`Authenticated! UID: ${uid}\n`)

    // Helper function to clear collection
    async function clearCollection(colName) {
      console.log(`Clearing collection ${colName}...`)
      const snap = await getDocs(collection(db, colName))
      const chunks = []
      let temp = []
      snap.docs.forEach((doc, idx) => {
        temp.push(doc.ref)
        if (temp.length === 400 || idx === snap.docs.length - 1) {
          chunks.push(temp)
          temp = []
        }
      })
      for (const chunk of chunks) {
        const batch = writeBatch(db)
        chunk.forEach((ref) => batch.delete(ref))
        await batch.commit()
      }
      console.log(`  Cleared ${snap.size} documents.`)
    }

    // Clear all existing collections first
    await clearCollection('fleet_vehicles')
    await clearCollection('fleet_alerts')
    await clearCollection('fleet_inspections')
    await clearCollection('fleet_fuel_logs')

    // Create 1,284 Vehicles
    console.log('\nSeeding 1,284 vehicles...')
    const vehiclesData = []

    // 1. Specific vehicle: VX-702
    vehiclesData.push({
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
    })

    // 2. Specific vehicle: UT-104
    vehiclesData.push({
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
    })

    // 3. Specific vehicle: SP-449
    vehiclesData.push({
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
    })

    // Generate rest (1,281 vehicles)
    const types = ['Hauler', 'Utility', 'Support', 'Tanker', 'Crane', 'Bus']
    const modelsByType = {
      Hauler: ['Volvo FH16', 'Scania R500', 'MAN TGX'],
      Utility: ['Ford F-150', 'Toyota Hilux', 'Isuzu D-Max'],
      Support: ['Mercedes Sprinter', 'Ford Transit', 'Toyota Quantum'],
      Tanker: ['Mercedes Actros Tanker', 'Volvo FMX Tanker'],
      Crane: ['Liebherr LTM', 'Tadano ATF'],
      Bus: ['Mercedes Benz Bus', 'Scania Bus']
    }
    const sites = ['Sector 7G', 'North Ridge', 'South Bay', 'East Gate', 'Fuel Point Delta']

    // We want EXACTLY 1,240 active/operational vehicles.
    // VX-702 is active. UT-104 is maintenance. SP-449 is suspended.
    // So out of 1284, we need 1240 active, 44 non-active (maintenance / suspended).
    // Let's generate 42 non-active and 1239 active to get exactly 1240 active and 44 non-active.
    let activeNeeded = 1239
    let nonActiveNeeded = 42

    for (let i = 4; i <= 1284; i++) {
      const type = types[Math.floor(Math.random() * types.length)]
      const models = modelsByType[type]
      const model = models[Math.floor(Math.random() * models.length)]
      const site = sites[Math.floor(Math.random() * sites.length)]
      
      const isActive = activeNeeded > 0
      if (isActive) activeNeeded--
      else nonActiveNeeded--

      const status = isActive ? 'active' : (Math.random() > 0.5 ? 'maintenance' : 'suspended')
      // Let's give active vehicles higher health (75-100), others lower (30-74)
      const healthScore = isActive 
        ? Math.floor(Math.random() * 26) + 75 
        : Math.floor(Math.random() * 45) + 30

      vehiclesData.push({
        unitId: `VX-${i}`,
        plateNumber: `GP-${Math.floor(Math.random()*900 + 100)}-${String.fromCharCode(65 + Math.floor(Math.random()*26))}${String.fromCharCode(65 + Math.floor(Math.random()*26))}`,
        vin: `VIN-${Math.random().toString(36).substring(2, 10).toUpperCase()}-${i}`,
        vehicleType: type,
        category: type === 'Hauler' || type === 'Tanker' || type === 'Crane' ? 'Heavy Duty' : 'Standard',
        model: model,
        driverName: Math.random() > 0.15 ? `Driver ${i}` : '',
        site: site,
        department: 'Operations',
        status: status,
        healthScore: healthScore,
        fuelLevel: Math.floor(Math.random() * 81) + 20,
        mileageKm: Math.floor(Math.random() * 380000) + 15000,
        crewAssigned: status === 'active' && Math.random() > 0.2,
        lat: -26.20 + (Math.random() - 0.5) * 0.05,
        lng: 28.04 + (Math.random() - 0.5) * 0.05,
        fuelEfficiency: Math.random() > 0.5 ? 'A' : 'B',
        engineLoad: Math.floor(Math.random() * 30),
        tirePressure: 'Nominal',
        uptime: parseFloat((90 + Math.random() * 10).toFixed(1)),
        lastService: new Date('2024-09-01'),
        nextService: new Date('2024-12-01'),
      })
    }

    // Write vehicles in batches of 400
    const vehicleDocIdsMap = {} // unitId -> Firestore ID
    const chunks = []
    let temp = []
    vehiclesData.forEach((v, idx) => {
      temp.push(v)
      if (temp.length === 400 || idx === vehiclesData.length - 1) {
        chunks.push(temp)
        temp = []
      }
    })

    console.log(`Writing ${chunks.length} batches of vehicles...`)
    let batchIndex = 1
    for (const chunk of chunks) {
      const batch = writeBatch(db)
      chunk.forEach((v) => {
        const docRef = doc(collection(db, 'fleet_vehicles'))
        vehicleDocIdsMap[v.unitId] = docRef.id
        batch.set(docRef, {
          ...v,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      })
      await batch.commit()
      console.log(`  Batch ${batchIndex++} committed.`)
    }

    // Now seed alerts (defects)
    console.log('\nSeeding defects/alerts...')
    const alertsToSeed = []

    // Specific alerts for VX-702 matching details page:
    // 1. Headlight LH Flicker (CRITICAL, Resolved)
    alertsToSeed.push({
      vehicleId: vehicleDocIdsMap['VX-702'],
      vehicleUnit: 'UNIT VX-702',
      message: 'Headlight Assembly - LH Flicker',
      severity: 'critical',
      status: 'resolved',
      createdAt: new Date('2024-10-04'),
      resolvedAt: new Date('2024-10-06'),
      reference: '#DEF-891',
    })
    // 2. Brake Pressure Sensor Error (MINOR, Pending)
    alertsToSeed.push({
      vehicleId: vehicleDocIdsMap['VX-702'],
      vehicleUnit: 'UNIT VX-702',
      message: 'Brake Fluid Pressure Sensor Error',
      severity: 'minor',
      status: 'pending',
      createdAt: new Date('2024-10-12'),
      reference: '#DEF-815',
    })
    // 3. Cab Door Seal Degradation (LOW, Escalated)
    alertsToSeed.push({
      vehicleId: vehicleDocIdsMap['VX-702'],
      vehicleUnit: 'UNIT VX-702',
      message: 'Cab Door Seal Degradation',
      severity: 'low',
      status: 'escalated',
      createdAt: new Date('2024-10-28'),
      reference: '#DEF-847',
    })

    // We want EXACTLY 12 active critical alerts in the system.
    // Let's pick 12 other vehicles and add 1 critical alert for each.
    for (let i = 1; i <= 12; i++) {
      const targetUnitId = `VX-${i + 10}` // vehicles VX-11 to VX-22
      alertsToSeed.push({
        vehicleId: vehicleDocIdsMap[targetUnitId],
        vehicleUnit: `UNIT ${targetUnitId}`,
        message: 'Critical system defect detected',
        severity: 'critical',
        status: 'open',
        createdAt: new Date(),
        reference: `#DEF-${100 + i}`,
      })
    }

    // Save alerts in a batch
    const alertsBatch = writeBatch(db)
    alertsToSeed.forEach((a) => {
      const docRef = doc(collection(db, 'fleet_alerts'))
      alertsBatch.set(docRef, a)
    })
    await alertsBatch.commit()
    console.log(`  Seeded ${alertsToSeed.length} alerts.`);

    // Seed some inspections and fuel logs for VX-702 to ensure charts are populated
    console.log('\nSeeding inspections and fuel logs...');
    const inspectionsBatch = writeBatch(db);
    
    const inspectionsData = [
      { vehicleId: vehicleDocIdsMap['VX-702'], unitId: 'VX-702', inspectionType: 'Safety Audit', outcome: 'pass', inspector: 'H. Raheem', notes: 'Brake lines verified, pressure nominal.', inspectedAt: new Date('2024-10-15') },
      { vehicleId: vehicleDocIdsMap['VX-702'], unitId: 'VX-702', inspectionType: 'Daily Pre-Trip', outcome: 'pass', inspector: 'J. Mokoena', notes: 'All fluids checked. Headlight resolved.', inspectedAt: new Date('2024-10-06') }
    ];
    inspectionsData.forEach(ins => {
      const docRef = doc(collection(db, 'fleet_inspections'));
      inspectionsBatch.set(docRef, ins);
    });
    await inspectionsBatch.commit();

    const fuelBatch = writeBatch(db);
    const fuelData = [
      { vehicleId: vehicleDocIdsMap['VX-702'], unitId: 'VX-702', litres: 120, costPerLitre: 22.8, station: 'Depot Alpha', odometer: 452180, loggedAt: new Date('2024-10-25') },
      { vehicleId: vehicleDocIdsMap['VX-702'], unitId: 'VX-702', litres: 110, costPerLitre: 22.8, station: 'Depot Alpha', odometer: 451800, loggedAt: new Date('2024-10-10') }
    ];
    fuelData.forEach(f => {
      const docRef = doc(collection(db, 'fleet_fuel_logs'));
      fuelBatch.set(docRef, f);
    });
    await fuelBatch.commit();

    console.log('\n======================================');
    console.log('  Seeding completed successfully!');
    console.log(`  Seeded ${vehiclesData.length} vehicles.`);
    console.log(`  (Active: 1240, Non-Active: 44)`);
    console.log(`  Seeded ${alertsToSeed.length} alerts.`);
    console.log('======================================\n');

    await signOut(auth)
  } catch (err) {
    console.error('Error seeding data:', err.message || err)
    process.exit(1)
  }
}

run()
