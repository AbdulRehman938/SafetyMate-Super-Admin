import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  collection, query, onSnapshot, orderBy,
  addDoc, updateDoc, doc, serverTimestamp, where,
} from 'firebase/firestore'
import { db } from '../../../config/firebase.js'
import { useAuth } from '../../../app/providers/authContext.js'

/**
 * useFireExtData — real-time Firestore streams for Fire Extinguisher dashboard.
 *
 * Collections (all prefixed fe_ to isolate from other dashboards):
 *   fe_assets       — registered extinguisher / suppression assets
 *   fe_inspections  — inspection & maintenance records
 *   fe_alerts       — critical failures, tamper alerts, upcoming expiries
 *   fe_activity_log — technician action log entries
 */
export function useFireExtData() {
  const { authUser } = useAuth()

  const [assets,      setAssets]      = useState([])
  const [inspections, setInspections] = useState([])
  const [alerts,      setAlerts]      = useState([])
  const [activityLog, setActivityLog] = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)

  /* ── Assets stream ── */
  useEffect(() => {
    const q = query(collection(db, 'fe_assets'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q,
      (snap) => {
        setAssets(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        setLoading(false)
      },
      (err) => {
        console.warn('fe_assets stream error:', err.message)
        setError(err.message)
        setLoading(false)
      },
    )
    return () => unsub()
  }, [])

  /* ── Inspections stream ── */
  useEffect(() => {
    const q = query(collection(db, 'fe_inspections'), orderBy('inspectedAt', 'desc'))
    const unsub = onSnapshot(q,
      (snap) => setInspections(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => console.warn('fe_inspections stream error:', err.message),
    )
    return () => unsub()
  }, [])

  /* ── Alerts stream (open only) ── */
  useEffect(() => {
    const q = query(
      collection(db, 'fe_alerts'),
      where('status', '!=', 'resolved'),
      orderBy('status'),
      orderBy('createdAt', 'desc'),
    )
    const unsub = onSnapshot(q,
      (snap) => setAlerts(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => console.warn('fe_alerts stream error:', err.message),
    )
    return () => unsub()
  }, [])

  /* ── Activity log stream (latest 50) ── */
  useEffect(() => {
    const q = query(collection(db, 'fe_activity_log'), orderBy('timestamp', 'desc'))
    const unsub = onSnapshot(q,
      (snap) => setActivityLog(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => console.warn('fe_activity_log stream error:', err.message),
    )
    return () => unsub()
  }, [])

  /* ── CRUD ── */
  const addAsset = useCallback(async (data) => {
    return addDoc(collection(db, 'fe_assets'), {
      ...data,
      status: data.status ?? 'compliant',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: authUser?.uid ?? '',
    })
  }, [authUser])

  const updateAsset = useCallback(async (id, data) => {
    return updateDoc(doc(db, 'fe_assets', id), {
      ...data,
      updatedAt: serverTimestamp(),
    })
  }, [])

  const addInspection = useCallback(async (data) => {
    const ref = await addDoc(collection(db, 'fe_inspections'), {
      ...data,
      inspectedAt: serverTimestamp(),
      createdBy: authUser?.uid ?? '',
    })
    // update asset status
    if (data.assetId) {
      await updateDoc(doc(db, 'fe_assets', data.assetId), {
        lastInspectedAt: serverTimestamp(),
        status: data.outcome === 'failed' ? 'non_compliant' : 'compliant',
        updatedAt: serverTimestamp(),
      })
    }
    return ref
  }, [authUser])

  /** Upsert a draft inspection — creates first time, updates on re-save */
  const upsertDraftInspection = useCallback(async (draftId, data) => {
    if (draftId) {
      await updateDoc(doc(db, 'fe_inspections', draftId), {
        ...data,
        status: 'draft',
        updatedAt: serverTimestamp(),
      })
      return draftId
    }
    const ref = await addDoc(collection(db, 'fe_inspections'), {
      ...data,
      status: 'draft',
      inspectedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: authUser?.uid ?? '',
    })
    return ref.id
  }, [authUser])

  /** Finalise — submit the inspection + update asset status */
  const finaliseInspection = useCallback(async (draftId, data) => {
    const allPassed = Object.values(data.checklist || {}).every((v) => v === 'pass')
    const hasFail   = Object.values(data.checklist || {}).some((v) => v === 'fail')
    const outcome   = hasFail ? 'failed' : allPassed ? 'passed' : 'conditional'

    if (draftId) {
      await updateDoc(doc(db, 'fe_inspections', draftId), {
        ...data,
        outcome,
        status: 'submitted',
        inspectedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    } else {
      await addDoc(collection(db, 'fe_inspections'), {
        ...data,
        outcome,
        status: 'submitted',
        inspectedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: authUser?.uid ?? '',
      })
    }
    if (data.assetId) {
      await updateDoc(doc(db, 'fe_assets', data.assetId), {
        lastInspectedAt: serverTimestamp(),
        status: hasFail ? 'non_compliant' : 'compliant',
        updatedAt: serverTimestamp(),
      })
    }
    return outcome
  }, [authUser])

  const addAlert = useCallback(async (data) => {
    return addDoc(collection(db, 'fe_alerts'), {
      ...data,
      status: 'open',
      createdAt: serverTimestamp(),
      createdBy: authUser?.uid ?? '',
    })
  }, [authUser])

  const resolveAlert = useCallback(async (id) => {
    return updateDoc(doc(db, 'fe_alerts', id), {
      status: 'resolved',
      resolvedAt: serverTimestamp(),
      resolvedBy: authUser?.uid ?? '',
    })
  }, [authUser])

  const addActivityEntry = useCallback(async (data) => {
    return addDoc(collection(db, 'fe_activity_log'), {
      ...data,
      timestamp: serverTimestamp(),
      createdBy: authUser?.uid ?? '',
    })
  }, [authUser])

  /* ── Derived stats (100% from Firestore, no dummy data) ── */
  const totalAssets     = assets.length
  const compliantAssets = assets.filter((a) => a.status === 'compliant').length
  const complianceRate  = totalAssets > 0
    ? Math.round((compliantAssets / totalAssets) * 100)
    : null

  const overdueInspections = useMemo(() => {
    const now = new Date().getTime()
    return assets.filter((a) => {
      if (!a.nextInspectionDate) return false
      const ts = a.nextInspectionDate?.toMillis
        ? a.nextInspectionDate.toMillis()
        : new Date(a.nextInspectionDate).getTime()
      return ts < now
    }).length
  }, [assets])

  const upcomingExpiries = useMemo(() => {
    const now        = new Date().getTime()
    const thirtyDays = 30 * 24 * 60 * 60 * 1000
    return assets.filter((a) => {
      if (!a.certExpiry) return false
      const ts = a.certExpiry?.toMillis
        ? a.certExpiry.toMillis()
        : new Date(a.certExpiry).getTime()
      return ts > now && ts < now + thirtyDays
    }).length
  }, [assets])

  return {
    assets, inspections, alerts, activityLog,
    loading, error,
    // derived
    totalAssets, compliantAssets, complianceRate,
    overdueInspections, upcomingExpiries,
    // actions
    addAsset, updateAsset,
    addInspection, upsertDraftInspection, finaliseInspection,
    addAlert, resolveAlert,
    addActivityEntry,
  }
}
