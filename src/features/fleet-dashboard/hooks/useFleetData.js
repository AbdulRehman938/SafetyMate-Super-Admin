import { useState, useEffect, useCallback } from 'react'
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  where,
  getDocs,
  getDoc,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../../../config/firebase.js'
import { useAuth } from '../../../app/providers/authContext.js'

/**
 * useFleetData — real-time Firestore streams for all fleet collections.
 * Collections:
 *   fleet_vehicles   — vehicle registry
 *   fleet_inspections — inspection log entries
 *   fleet_fuel_logs  — fuel fill events
 *   fleet_alerts     — critical / warning alerts
 */
export function useFleetData() {
  const { authUser } = useAuth()
  const [vehicles, setVehicles]       = useState([])
  const [inspections, setInspections] = useState([])
  const [fuelLogs, setFuelLogs]       = useState([])
  const [alerts, setAlerts]           = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)
  const [refreshKey, setRefreshKey]   = useState(0)

  // Manual refresh — increments key which remounts all streams
  const refreshAlerts = useCallback(() => setRefreshKey((k) => k + 1), [])

  // ── Stream: vehicles ────────────────────────────────────────
  useEffect(() => {
    const q = query(collection(db, 'fleet_vehicles'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q,
      (snap) => {
        setVehicles(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        setLoading(false)
      },
      (err) => {
        console.warn('fleet_vehicles stream error:', err.message)
        setError(err.message)
        setLoading(false)
      },
    )
    return () => unsub()
  }, [])

  // ── Stream: inspections ─────────────────────────────────────
  useEffect(() => {
    const q = query(collection(db, 'fleet_inspections'), orderBy('inspectedAt', 'desc'))
    const unsub = onSnapshot(q,
      (snap) => setInspections(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => console.warn('fleet_inspections stream error:', err.message),
    )
    return () => unsub()
  }, [])

  // ── Stream: fuel logs ───────────────────────────────────────
  useEffect(() => {
    const q = query(collection(db, 'fleet_fuel_logs'), orderBy('loggedAt', 'desc'))
    const unsub = onSnapshot(q,
      (snap) => setFuelLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => console.warn('fleet_fuel_logs stream error:', err.message),
    )
    return () => unsub()
  }, [])

  // ── Stream: alerts ──────────────────────────────────────────
  useEffect(() => {
    const q = query(collection(db, 'fleet_alerts'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q,
      (snap) => setAlerts(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => console.warn('fleet_alerts stream error:', err.message),
    )
    return () => unsub()
  }, [refreshKey])

  // ── Vehicle CRUD ────────────────────────────────────────────
  const addVehicle = useCallback(async (data) => {
    // Check for duplicate plate number
    if (data.plateNumber) {
      const plateQuery = query(
        collection(db, 'fleet_vehicles'),
        where('plateNumber', '==', data.plateNumber.toUpperCase())
      )
      const plateSnapshot = await getDocs(plateQuery)
      if (!plateSnapshot.empty) {
        throw new Error('A vehicle with this plate number already exists')
      }
    }

    // Check for duplicate VIN
    if (data.vin) {
      const vinQuery = query(
        collection(db, 'fleet_vehicles'),
        where('vin', '==', data.vin.toUpperCase())
      )
      const vinSnapshot = await getDocs(vinQuery)
      if (!vinSnapshot.empty) {
        throw new Error('A vehicle with this VIN already exists')
      }
    }

    let imageUrl = data.image
    
    // If image is a File object, upload to Firebase Storage
    if (data.image instanceof File) {
      try {
        const fileName = `vehicle_${Date.now()}_${data.image.name}`
        const storageRef = ref(storage, `fleet_vehicles/${fileName}`)
        const snapshot = await uploadBytes(storageRef, data.image)
        imageUrl = await getDownloadURL(snapshot.ref)
      } catch (error) {
        console.error('Failed to upload vehicle image:', error)
        throw new Error('Failed to upload image')
      }
    }
    
    return addDoc(collection(db, 'fleet_vehicles'), {
      ...data,
      image: imageUrl,
      healthScore: data.healthScore ?? 100,
      status: data.status ?? 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: authUser?.uid ?? '',
    })
  }, [authUser, storage])

  const updateVehicle = useCallback(async (id, data) => {
    let imageUrl = data.image
    
    // If image is a File object, upload to Firebase Storage
    if (data.image instanceof File) {
      try {
        const fileName = `vehicle_${Date.now()}_${data.image.name}`
        const storageRef = ref(storage, `fleet_vehicles/${fileName}`)
        const snapshot = await uploadBytes(storageRef, data.image)
        imageUrl = await getDownloadURL(snapshot.ref)
      } catch (error) {
        console.error('Failed to upload vehicle image:', error)
        throw new Error('Failed to upload image')
      }
    }
    
    // Fetch current vehicle to check approval status
    const vehicleDoc = await getDoc(doc(db, 'fleet_vehicles', id))
    const currentVehicle = vehicleDoc.data()
    
    // If vehicle was approved, reset to pending when edited
    const updateData = {
      ...data,
      image: imageUrl,
      updatedAt: serverTimestamp(),
    }
    
    if (currentVehicle?.complianceStatus === 'Approved') {
      updateData.complianceStatus = 'Pending'
    }
    
    return updateDoc(doc(db, 'fleet_vehicles', id), updateData)
  }, [storage])

  const deleteVehicle = useCallback(async (id) => {
    return deleteDoc(doc(db, 'fleet_vehicles', id))
  }, [])

  // ── Inspection CRUD ─────────────────────────────────────────
  const addInspection = useCallback(async (data) => {
    const docRef = await addDoc(collection(db, 'fleet_inspections'), {
      ...data,
      inspectedAt: serverTimestamp(),
      createdBy: authUser?.uid ?? '',
    })
    // Update vehicle status if needed
    if (data.vehicleId && data.outcome) {
      await updateDoc(doc(db, 'fleet_vehicles', data.vehicleId), {
        lastInspection: serverTimestamp(),
        status: data.outcome === 'fail' ? 'maintenance' : 'active',
        updatedAt: serverTimestamp(),
      })
    }
    return docRef
  }, [authUser])

  /** Upsert a draft inspection — creates on first save, updates on subsequent saves */
  const upsertDraftInspection = useCallback(async (vehicleId, draftId, data) => {
    if (draftId) {
      // update existing draft
      await updateDoc(doc(db, 'fleet_inspections', draftId), {
        ...data,
        status: 'draft',
        updatedAt: serverTimestamp(),
      })
      return draftId
    }
    // create new draft
    const ref = await addDoc(collection(db, 'fleet_inspections'), {
      ...data,
      vehicleId,
      status: 'draft',
      inspectedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: authUser?.uid ?? '',
    })
    return ref.id
  }, [authUser])

  /** Finalise a draft: set status submitted + update vehicle */
  const finaliseInspection = useCallback(async (draftId, vehicleId, data) => {
    if (draftId) {
      await updateDoc(doc(db, 'fleet_inspections', draftId), {
        ...data,
        status: 'submitted',
        inspectedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    } else {
      await addDoc(collection(db, 'fleet_inspections'), {
        ...data,
        vehicleId,
        status: 'submitted',
        inspectedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: authUser?.uid ?? '',
      })
    }
    // update vehicle record with inspection data and odometer
    await updateDoc(doc(db, 'fleet_vehicles', vehicleId), {
      lastInspection: serverTimestamp(),
      mileageKm: data.currentKm,
      status: data.outcome === 'fail' ? 'maintenance' : 'active',
      updatedAt: serverTimestamp(),
    })
  }, [authUser])

  // ── Fuel log CRUD ───────────────────────────────────────────
  const addFuelLog = useCallback(async (data) => {
    return addDoc(collection(db, 'fleet_fuel_logs'), {
      ...data,
      loggedAt: serverTimestamp(),
      createdBy: authUser?.uid ?? '',
    })
  }, [authUser])

  // ── Alert CRUD ──────────────────────────────────────────────
  const resolveAlert = useCallback(async (id) => {
    return updateDoc(doc(db, 'fleet_alerts', id), {
      status: 'resolved',
      resolvedAt: serverTimestamp(),
      resolvedBy: authUser?.uid ?? '',
    })
  }, [authUser])

  const addAlert = useCallback(async (data) => {
    return addDoc(collection(db, 'fleet_alerts'), {
      ...data,
      status: 'open',
      createdAt: serverTimestamp(),
      createdBy: authUser?.uid ?? '',
    })
  }, [authUser])

  // ── Derived stats ───────────────────────────────────────────
  const activeVehicles  = vehicles.filter((v) => v.status === 'active').length
  const totalVehicles   = vehicles.length
  const crewReady       = vehicles.filter((v) => v.crewAssigned && v.status === 'active').length
  const openAlerts      = alerts.filter((a) => a.status !== 'resolved')
  const criticalAlerts  = openAlerts.filter((a) => a.severity === 'critical')
  const avgHealth = vehicles.length
    ? Math.round(vehicles.reduce((s, v) => s + (v.healthScore ?? 100), 0) / vehicles.length)
    : 0

  return {
    vehicles, inspections, fuelLogs, alerts,
    loading, error,
    // stats
    activeVehicles, totalVehicles, crewReady,
    openAlerts, criticalAlerts, avgHealth,
    // actions
    addVehicle, updateVehicle, deleteVehicle,
    addInspection,
    upsertDraftInspection,
    finaliseInspection,
    addFuelLog,
    resolveAlert, addAlert,
    refreshAlerts,
  }
}
