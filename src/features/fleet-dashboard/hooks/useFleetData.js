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
} from 'firebase/firestore'
import { db } from '../../../config/firebase.js'
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
    return addDoc(collection(db, 'fleet_vehicles'), {
      ...data,
      healthScore: data.healthScore ?? 100,
      status: data.status ?? 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: authUser?.uid ?? '',
    })
  }, [authUser])

  const updateVehicle = useCallback(async (id, data) => {
    return updateDoc(doc(db, 'fleet_vehicles', id), {
      ...data,
      updatedAt: serverTimestamp(),
    })
  }, [])

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
    addFuelLog,
    resolveAlert, addAlert,
    refreshAlerts,
  }
}
