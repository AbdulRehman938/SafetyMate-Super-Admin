import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  collection, query, onSnapshot, orderBy,
  addDoc, updateDoc, doc, serverTimestamp, where,
  getDoc, setDoc
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../../../config/firebase.js'
import { useAuth } from '../../../app/providers/authContext.js'

/**
 * useFireDetectionData — real-time Firestore streams for Fire Detection dashboard.
 *
 * Collections (all prefixed fd_ to isolate from other dashboards):
 *   fd_assets       — registered fire hydrants/assets
 *   fd_alerts       — fire alerts, sensor failures, system warnings
 *   fd_activity_log — technician action log entries
 *   fd_zones        — monitored zones/areas
 */
export function useFireDetectionData() {
  const { authUser } = useAuth()

  const [assets,       setAssets]       = useState([])
  const [panels,     setPanels]     = useState([])
  const [alerts,       setAlerts]       = useState([])
  const [activityLog,  setActivityLog]  = useState([])
  const [zones,        setZones]        = useState([])
  const [systemMetrics, setSystemMetrics] = useState(null)
  const [complianceNotifications, setComplianceNotifications] = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)

  /* ── Assets stream ── */
  useEffect(() => {
    const q = query(collection(db, 'fd_assets'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q,
      (snap) => {
        setAssets(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        setLoading(false)
      },
      (err) => {
        console.warn('fd_assets stream error:', err.message)
        setError(err.message)
        setLoading(false)
      },
    )
    return () => unsub()
  }, [])

  /* ── Alerts stream (open only) ── */
  useEffect(() => {
    const q = query(
      collection(db, 'fd_alerts'),
      where('status', '!=', 'resolved'),
      orderBy('severity', 'desc'),
      orderBy('createdAt', 'desc'),
    )
    const unsub = onSnapshot(q,
      (snap) => setAlerts(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => console.warn('fd_alerts stream error:', err.message),
    )
    return () => unsub()
  }, [])

  /* ── Activity log stream (latest 50) ── */
  useEffect(() => {
    const q = query(collection(db, 'fd_activity_log'), orderBy('timestamp', 'desc'))
    const unsub = onSnapshot(q,
      (snap) => setActivityLog(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => console.warn('fd_activity_log stream error:', err.message),
    )
    return () => unsub()
  }, [])

  /* ── System Metrics stream ── */
  useEffect(() => {
    const q = doc(db, 'fd_system_metrics', 'main')
    const unsub = onSnapshot(q,
      (snap) => {
        if (snap.exists()) {
          setSystemMetrics(snap.data())
        }
      },
      (err) => console.warn('fd_system_metrics stream error:', err.message),
    )
    return () => unsub()
  }, [])

  /* ── Panels stream ── */
  useEffect(() => {
    const q = query(collection(db, 'fd_panels'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q,
      (snap) => {
        setPanels(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        setLoading(false)
      },
      (err) => {
        console.warn('fd_panels stream error:', err.message)
        setLoading(false)
      },
    )
    return () => unsub()
  }, [])

  /* ── Zones stream ── */
  useEffect(() => {
    const q = query(collection(db, 'fd_zones'), orderBy('name', 'asc'))
    const unsub = onSnapshot(q,
      (snap) => setZones(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => console.warn('fd_zones stream error:', err.message),
    )
    return () => unsub()
  }, [])

  /* ── Compliance Notifications stream ── */
  useEffect(() => {
    const q = doc(db, 'fd_compliance_notifications', 'main')
    const unsub = onSnapshot(q,
      (snap) => {
        if (snap.exists()) {
          setComplianceNotifications(snap.data())
        } else {
          // Default configuration
          setComplianceNotifications({
            ninetyDayEarlyAlert: true,
            thirtyDayCriticalAlert: true,
            sevenDayUrgentAlert: true,
            expiredAlert: false,
            emailProtocol: true,
            smsDirect: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        }
        setLoading(false)
      },
      (err) => {
        console.warn('fd_compliance_notifications stream error:', err.message)
        setLoading(false)
      }
    )
    return () => unsub()
  }, [])

  /* ── CRUD ── */
  const addAsset = useCallback(async (data) => {
    return addDoc(collection(db, 'fd_assets'), {
      ...data,
      status: data.status ?? 'operational',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: authUser?.uid ?? '',
    })
  }, [authUser])

  const updateAsset = useCallback(async (id, data) => {
    return updateDoc(doc(db, 'fd_assets', id), {
      ...data,
      updatedAt: serverTimestamp(),
    })
  }, [])

  const addAlert = useCallback(async (data) => {
    return addDoc(collection(db, 'fd_alerts'), {
      ...data,
      status: 'open',
      createdAt: serverTimestamp(),
      createdBy: authUser?.uid ?? '',
    })
  }, [authUser])

  const resolveAlert = useCallback(async (id) => {
    return updateDoc(doc(db, 'fd_alerts', id), {
      status: 'resolved',
      resolvedAt: serverTimestamp(),
      resolvedBy: authUser?.uid ?? '',
    })
  }, [authUser])

  const addActivityEntry = useCallback(async (data) => {
    return addDoc(collection(db, 'fd_activity_log'), {
      ...data,
      timestamp: serverTimestamp(),
      createdBy: authUser?.uid ?? '',
    })
  }, [authUser])

  const addZone = useCallback(async (data) => {
    return addDoc(collection(db, 'fd_zones'), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: authUser?.uid ?? '',
    })
  }, [authUser])

  const updateZone = useCallback(async (id, data) => {
    return updateDoc(doc(db, 'fd_zones', id), {
      ...data,
      updatedAt: serverTimestamp(),
    })
  }, [])

  const addPanel = useCallback(async (data) => {
    return addDoc(collection(db, 'fd_panels'), {
      ...data,
      status: data.status ?? 'nominal',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: authUser?.uid ?? '',
    })
  }, [authUser])

  const updatePanel = useCallback(async (id, data) => {
    return updateDoc(doc(db, 'fd_panels', id), {
      ...data,
      updatedAt: serverTimestamp(),
    })
  }, [])

  const updateComplianceNotifications = useCallback(async (data) => {
    return setDoc(doc(db, 'fd_compliance_notifications', 'main'), {
      ...data,
      updatedAt: serverTimestamp(),
    }, { merge: true })
  }, [])

  const saveInspectionDraft = useCallback(async (assetId, draftData) => {
    const draftRef = doc(db, 'fd_inspections_drafts', `${assetId}_${authUser?.uid}`)
    return setDoc(draftRef, {
      ...draftData,
      assetId,
      userId: authUser?.uid,
      updatedAt: serverTimestamp(),
    }, { merge: true })
  }, [authUser])

  const loadInspectionDraft = useCallback(async (assetId) => {
    const draftRef = doc(db, 'fd_inspections_drafts', `${assetId}_${authUser?.uid}`)
    const snap = await getDoc(draftRef)
    if (snap.exists()) {
      return snap.data()
    }
    return null
  }, [authUser])

  const logIncident = useCallback(async (incidentData) => {
    return addDoc(collection(db, 'fd_incidents'), {
      ...incidentData,
      status: 'open',
      createdAt: serverTimestamp(),
      createdBy: authUser?.uid ?? '',
    })
  }, [authUser])

  const uploadInspectionImage = useCallback(async (file, assetId, type) => {
    if (!file) return null
    const fileName = `${assetId}_${type}_${Date.now()}_${file.name}`
    const storageRef = ref(storage, `fd_inspections/${fileName}`)
    await uploadBytes(storageRef, file)
    const downloadURL = await getDownloadURL(storageRef)
    return downloadURL
  }, [])

  /* ── Derived stats (100% from Firestore, no dummy data) ── */
  const totalAssets = assets.length
  const operationalAssets = assets.filter((a) => a.status === 'operational').length
  const faultAssets = assets.filter((a) => a.status === 'fault').length
  const pendingAssets = assets.filter((a) => a.status === 'pending').length

  const totalPanels = panels.length
  const panelsRequiringReplacement = panels.filter(p => p.status === 'degraded').length
  const avgSystemSensitivity = useMemo(() => {
    if (panels.length === 0) return null
    const total = panels.reduce((sum, p) => sum + (p.sensitivity || 0), 0)
    return total / panels.length
  }, [panels])

  const criticalAlerts = alerts.filter((a) => a.severity === 'critical').length
  const warningAlerts = alerts.filter((a) => a.severity === 'warning').length
  const infoAlerts = alerts.filter((a) => a.severity === 'info').length

  const avgFlowRate = useMemo(() => {
    if (assets.length === 0) return null
    const flowRates = assets.map((a) => a.flowRate || 0).filter((r) => r > 0)
    if (flowRates.length === 0) return null
    const avg = flowRates.reduce((sum, r) => sum + r, 0) / flowRates.length
    return (avg / 1000).toFixed(1) // Convert to kL/m
  }, [assets])

  return {
    assets, panels, alerts, activityLog, zones, systemMetrics, complianceNotifications,
    loading, error,
    // derived
    totalAssets, operationalAssets, faultAssets, pendingAssets,
    totalPanels, panelsRequiringReplacement, avgSystemSensitivity,
    criticalAlerts, warningAlerts, infoAlerts,
    avgFlowRate,
    // actions
    addAsset, updateAsset,
    addAlert, resolveAlert,
    addActivityEntry,
    addZone, updateZone,
    addPanel, updatePanel,
    updateComplianceNotifications,
    saveInspectionDraft, loadInspectionDraft, logIncident, uploadInspectionImage,
  }
}
