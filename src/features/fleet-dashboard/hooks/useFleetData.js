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
      status: data.status ?? 'inactive',
      readyForAssign: false, // Vehicle not ready for assignment until inspected
      isAssigned: false, // Vehicle not assigned to any site
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
    
    // Build update data - only include image if it was provided
    const updateData = {
      ...data,
      updatedAt: serverTimestamp(),
    }
    
    // Only include image if it was provided (not undefined)
    if (imageUrl !== undefined) {
      updateData.image = imageUrl
    }
    
    // If vehicle was approved, reset to pending when edited
    if (currentVehicle?.complianceStatus === 'Approved') {
      updateData.complianceStatus = 'Pending'
    }
    
    // If site is being removed (set to null), set status to inactive
    if (data.site === null && currentVehicle?.site) {
      updateData.status = 'inactive'
      updateData.crewAssigned = false
      updateData.readyForAssign = false // Needs new inspection after being unassigned
      updateData.isAssigned = false // No longer assigned
    }
    
    // If site is being set (not null), mark as assigned
    if (data.site && !currentVehicle?.site) {
      // Vehicle is being assigned for the first time
      updateData.isAssigned = true
      if (currentVehicle?.complianceStatus === 'Approved') {
        updateData.status = 'active'
        updateData.crewAssigned = true
        updateData.readyForAssign = false
      }
    } else if (data.site && currentVehicle?.site && data.site !== currentVehicle?.site) {
      // Vehicle is being reassigned to a different site
      updateData.isAssigned = true
    }
    
    return updateDoc(doc(db, 'fleet_vehicles', id), updateData)
  }, [storage])

  const deleteVehicle = useCallback(async (id) => {
    return deleteDoc(doc(db, 'fleet_vehicles', id))
  }, [])

  // ── Vehicle Approval/Rejection ─────────────────────────────────────
  const approveVehicle = useCallback(async (id) => {
    // Check if vehicle has at least one inspection
    const vehicleInspections = inspections.filter((i) => i.vehicleId === id)
    if (vehicleInspections.length === 0) {
      throw new Error('Vehicle must complete at least one inspection before being approved.')
    }
    
    // Check if vehicle is currently in maintenance
    const vehicle = vehicles.find((v) => v.id === id)
    if (vehicle?.status === 'maintenance') {
      throw new Error('Vehicle is currently under maintenance and cannot be approved. Please complete maintenance and pass inspection first.')
    }
    
    return updateDoc(doc(db, 'fleet_vehicles', id), {
      complianceStatus: 'Approved',
      status: 'inactive', // Set to inactive after approval, not active
      updatedAt: serverTimestamp(),
    })
  }, [inspections, vehicles])

  const rejectVehicle = useCallback(async (id) => {
    return updateDoc(doc(db, 'fleet_vehicles', id), {
      complianceStatus: 'Rejected',
      status: 'suspended',
      updatedAt: serverTimestamp(),
    })
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
    // Get current vehicle status to determine post-inspection status
    const vehicleDoc = await getDoc(doc(db, 'fleet_vehicles', vehicleId))
    const currentVehicle = vehicleDoc.data()
    const wasInMaintenance = currentVehicle?.status === 'maintenance'
    
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
    
    // Determine post-inspection status
    let newStatus
    let complianceStatus = currentVehicle?.complianceStatus || 'Pending'
    let readyForAssign = currentVehicle?.readyForAssign ?? false
    
    if (data.outcome === 'fail') {
      // Failed inspection → maintenance
      newStatus = 'maintenance'
      complianceStatus = 'Pending' // Reset to pending when failed
    } else if (wasInMaintenance) {
      // Passing inspection after maintenance → inactive (needs re-approval)
      newStatus = 'inactive'
      complianceStatus = 'Pending' // Reset to pending, requires re-approval
    } else if (currentVehicle?.site) {
      // Passing inspection and already assigned to site → active
      newStatus = 'active'
    } else {
      // Passing inspection but not assigned → inactive
      newStatus = 'inactive'
    }
    
    // Set readyForAssign to true if inspection passed and vehicle is not assigned
    // This means vehicle has been inspected and is ready for assignment
    // Check both isAssigned and site for backward compatibility
    const isNotAssigned = !currentVehicle?.isAssigned && !currentVehicle?.site
    if (data.outcome !== 'fail' && isNotAssigned) {
      readyForAssign = true
    }
    
    // update vehicle record with inspection data and odometer
    await updateDoc(doc(db, 'fleet_vehicles', vehicleId), {
      lastInspection: serverTimestamp(),
      mileageKm: data.currentKm,
      status: newStatus,
      complianceStatus,
      readyForAssign,
      updatedAt: serverTimestamp(),
    })
  }, [authUser])

  // ── Fuel log CRUD ───────────────────────────────────────────
  const addFuelLog = useCallback(async (data) => {
    // Find the vehicle to get unitId
    const vehicle = vehicles.find(v => v.id === data.vehicleId)
    const unitId = vehicle?.unitId || data.vehicleId
    
    let receiptUrl = null
    
    // If receipt is a base64 dataUrl, upload to Firebase Storage
    if (data.receipt && data.receipt.startsWith('data:')) {
      try {
        // Convert base64 to blob
        const response = await fetch(data.receipt)
        const blob = await response.blob()
        
        // Generate filename
        const fileName = `fuel_receipt_${Date.now()}_${data.vehicleId}`
        const storageRef = ref(storage, `fuel_receipts/${fileName}`)
        
        // Upload to Storage
        const snapshot = await uploadBytes(storageRef, blob)
        receiptUrl = await getDownloadURL(snapshot.ref)
      } catch (error) {
        console.error('Failed to upload receipt:', error)
        // Continue without receipt if upload fails
      }
    }
    
    return addDoc(collection(db, 'fleet_fuel_logs'), {
      ...data,
      receipt: receiptUrl, // Store Storage URL instead of base64
      unitId: unitId, // Store unitId for proper vehicle identification
      loggedAt: serverTimestamp(),
      createdBy: authUser?.uid ?? '',
    })
  }, [authUser, vehicles, storage])

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
    approveVehicle, rejectVehicle,
  }
}
