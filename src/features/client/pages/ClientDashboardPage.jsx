import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../../app/providers/authContext.js'
import { HealthScoreDonut } from '../components/HealthScoreDonut.jsx'
import { SentinelAlertsFeed } from '../components/SentinelAlertsFeed.jsx'
import { SideDrawer } from '../components/SideDrawer.jsx'
import { HiraReviewForm } from '../components/HiraReviewForm.jsx'
import { AlertTriangle, FileText, ShieldAlert, FolderOpen, Award, Users, Package, BarChart3, Settings, Truck, Flame, GraduationCap, HardHat } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { db } from '../../../config/firebase.js'
import { normalizeEvidenceUrls } from '../alertDetailHelpers.js'
import { AlertDetailReadonly } from '../components/AlertDetailReadonly.jsx'
import { isWorkforceRole } from '../workforceRoles.js'

/** Foundation: all dashboard queries will be scoped with organizationId from user_profiles. */

const MODULE_CARDS = [
  { key: 'safety_files', label: 'Safety Files', icon: FolderOpen, description: 'Access certificates and compliance documents', route: '/client/certificates' },
  { key: 'risk_assessment', label: 'Risk Assessments', icon: FileText, description: 'Manage HIRA assessments and reviews', route: '/client/risk-assessment' },
  { key: 'training', label: 'Training Management', icon: GraduationCap, description: 'Training courses and certifications', route: '/training/dashboard' },
  { key: 'fleet', label: 'Fleet Management', icon: Truck, description: 'Vehicle tracking and inspections', route: '/client/fleet' },
  { key: 'fire_safety', label: 'Fire Safety System', icon: Flame, description: 'Fire extinguisher and detection systems', route: '/client/fire-ext' },
  { key: 'contractors', label: 'Contractor Management', icon: HardHat, description: 'Manage contractor access and compliance', route: '/client/workforce' },
  { key: 'reports', label: 'Reports & Analytics', icon: BarChart3, description: 'View compliance reports and analytics', route: '/client/dashboard' },
  { key: 'incidents', label: 'Incidents', icon: AlertTriangle, description: 'Report and track safety incidents', route: '/client/incidents' },
  { key: 'settings', label: 'Settings', icon: Settings, description: 'Account and organization settings', route: '/client/dashboard' },
]

export function ClientDashboardPage() {
  const { profile, organizationId, modules } = useAuth()
  const orgId = profile?.organizationId ?? organizationId
  const navigate = useNavigate()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [respondAlert, setRespondAlert] = useState(null)
  const [responseNotes, setResponseNotes] = useState('')
  const [markResolved, setMarkResolved] = useState(false)
  const [managerFeedback, setManagerFeedback] = useState('')
  const [incidentAssignee, setIncidentAssignee] = useState('')
  const [sentinelAlerts, setSentinelAlerts] = useState([])
  const [alertsLoading, setAlertsLoading] = useState(true)
  const [toast, setToast] = useState(null) // { tone: 'success'|'error', message: string }
  const [dismissedAlertKeys, setDismissedAlertKeys] = useState(() => ({})) // { [alertType:id]: true }

  const [ppeAssets, setPpeAssets] = useState([])
  const [ppeLoading, setPpeLoading] = useState(true)

  const [criticalCount, setCriticalCount] = useState(0)
  const [standardCount, setStandardCount] = useState(0)
  const [workforceStats, setWorkforceStats] = useState({
    total: 0,
    active: 0,
    probation: 0,
    restricted: 0,
  })

  const healthScore = useMemo(() => {
    const score = 100 - criticalCount * 15 - standardCount * 5
    return Math.max(0, Math.min(100, Math.round(score)))
  }, [criticalCount, standardCount])

  const workforceRows = useMemo(() => {
    const total = Number(workforceStats.total || 0)
    const pct = (n) => (total > 0 ? Math.round((Number(n || 0) / total) * 100) : 0)
    return [
      { key: 'cleared', label: 'Fully Cleared', pct: pct(workforceStats.active), className: 'client-wf-seg--ok' },
      { key: 'probation', label: 'Probationary', pct: pct(workforceStats.probation), className: 'client-wf-seg--mid' },
      { key: 'restricted', label: 'Restricted', pct: pct(workforceStats.restricted), className: 'client-wf-seg--low' },
    ]
  }, [workforceStats])

  useEffect(() => {
    if (!orgId) {
      setCriticalCount(0)
      setStandardCount(0)
      setWorkforceStats({ total: 0, active: 0, probation: 0, restricted: 0 })
      return undefined
    }

    // TODO: Wire to Firestore where('organizationId', '==', orgId) — KPI aggregations
    const sosCountQ = query(
      collection(db, 'sos_alerts'),
      where('organizationId', '==', orgId),
      where('status', '!=', 'resolved'),
      orderBy('status'),
    )

    const incidentsCountQ = query(
      collection(db, 'incidents'),
      where('organizationId', '==', orgId),
      where('status', '!=', 'closed'),
      orderBy('status'),
    )

    const hiraPendingQ = query(
      collection(db, 'hira_assessments'),
      where('organizationId', '==', orgId),
      where('status', 'in', ['pending', 'revision_required']),
    )

    const workersQ = query(collection(db, 'user_profiles'), where('organizationId', '==', orgId))

    let sos = 0
    let inc = 0
    let hira = 0

    const publishCritical = () => setCriticalCount((sos || 0) + (inc || 0))
    const publishStandard = () => setStandardCount(hira || 0)

    const unsubSos = onSnapshot(
      sosCountQ,
      (snap) => {
        sos = snap.size
        publishCritical()
      },
      () => {
        sos = 0
        publishCritical()
      },
    )

    const unsubInc = onSnapshot(
      incidentsCountQ,
      (snap) => {
        inc = snap.size
        publishCritical()
      },
      () => {
        inc = 0
        publishCritical()
      },
    )

    const unsubHira = onSnapshot(
      hiraPendingQ,
      (snap) => {
        hira = snap.size
        publishStandard()
      },
      () => {
        hira = 0
        publishStandard()
      },
    )

    const unsubWorkers = onSnapshot(
      workersQ,
      (snap) => {
        const docs = snap.docs.map((d) => d.data() || {}).filter((d) => isWorkforceRole(d.role))
        const total = docs.length
        const active = docs.filter((d) => String(d.status || '').toLowerCase() === 'active').length
        const probation = docs.filter((d) => String(d.status || '').toLowerCase() === 'probation').length
        const restricted = docs.filter((d) => String(d.status || '').toLowerCase() === 'restricted').length
        setWorkforceStats({ total, active, probation, restricted })
      },
      () => setWorkforceStats({ total: 0, active: 0, probation: 0, restricted: 0 }),
    )

    return () => {
      unsubSos()
      unsubInc()
      unsubHira()
      unsubWorkers()
    }
  }, [orgId])

  useEffect(() => {
    if (!orgId) {
      setPpeAssets([])
      setPpeLoading(false)
      return undefined
    }
    setPpeLoading(true)
    const qy = query(
      collection(db, 'ppe_assets'),
      where('organizationId', '==', orgId),
      orderBy('updatedAt', 'desc'),
      limit(6),
    )
    const unsub = onSnapshot(
      qy,
      (snap) => {
        const rows = snap.docs.map((d) => {
          const data = d.data() || {}
          return {
            id: d.id,
            assetId: data.assetId || d.id,
            assigneeName: data.assigneeName || data.recipientName || '—',
            category: data.category || '—',
            size: data.size || '',
            quantity: Number(data.quantity ?? 0) || 0,
            status: data.status || '—',
            issueDate: data.issueDate || null,
            expiryDate: data.expiryDate || null,
            updatedAt: data.updatedAt || data.createdAt || null,
          }
        })
        setPpeAssets(rows)
        setPpeLoading(false)
      },
      () => {
        setPpeAssets([])
        setPpeLoading(false)
      },
    )
    return () => unsub()
  }, [orgId])

  const ppeSummary = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const in30 = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
    const toDate = (v) => {
      if (!v) return null
      if (typeof v?.toDate === 'function') return v.toDate()
      if (v instanceof Date) return v
      const d = new Date(v)
      return Number.isNaN(d.getTime()) ? null : d
    }
    const startOfDay = (d) => {
      const x = new Date(d)
      x.setHours(0, 0, 0, 0)
      return x
    }
    let active = 0
    let expiring = 0
    let expired = 0
    for (const a of ppeAssets) {
      const st = String(a.status || '').toUpperCase()
      if (st && st !== 'ACTIVE') continue
      const exp = toDate(a.expiryDate)
      if (!exp) {
        active += 1
        continue
      }
      const e = startOfDay(exp)
      if (e.getTime() < today.getTime()) expired += 1
      else if (e.getTime() <= in30.getTime()) expiring += 1
      else active += 1
    }
    return { active, expiring, expired }
  }, [ppeAssets])

  useEffect(() => {
    if (!orgId) {
      setSentinelAlerts([])
      setAlertsLoading(false)
      return undefined
    }

    setAlertsLoading(true)

    let sosLoaded = false
    let hiraLoaded = false
    let incidentsLoaded = false

    let lastSos = []
    let lastHira = []
    let lastIncidents = []

    const toMillis = (value) => {
      if (!value) return 0
      if (typeof value?.toDate === 'function') return value.toDate().getTime()
      if (value instanceof Date) return value.getTime()
      const d = new Date(value)
      return Number.isNaN(d.getTime()) ? 0 : d.getTime()
    }

    const publish = () => {
      if (!(sosLoaded && hiraLoaded && incidentsLoaded)) return
      const combined = [...lastSos, ...lastHira, ...lastIncidents]
        .sort((a, b) => (b.ts || 0) - (a.ts || 0))
        .slice(0, 12)
      const filtered = combined.filter((a) => !dismissedAlertKeys[`${a.alertType}:${a.id}`])
      setSentinelAlerts(filtered)
      setAlertsLoading(false)
    }

    // TODO: Wire to Firestore where('organizationId', '==', orgId) — alerts are always org-scoped
    const sosQ = query(
      collection(db, 'sos_alerts'),
      where('organizationId', '==', orgId),
      orderBy('triggeredAt', 'desc'),
      limit(5),
    )
    const hiraQ = query(
      collection(db, 'hira_assessments'),
      where('organizationId', '==', orgId),
      orderBy('createdAt', 'desc'),
      limit(5),
    )
    const incidentsQ = query(
      collection(db, 'incidents'),
      where('organizationId', '==', orgId),
      orderBy('createdAt', 'desc'),
      limit(5),
    )

    const unsubSos = onSnapshot(
      sosQ,
      (snap) => {
        lastSos = snap.docs.map((d) => {
          const data = d.data() || {}
          const ts = toMillis(data.triggeredAt || data.createdAt)
          return {
            id: d.id,
            alertType: 'sos_alerts',
            type: 'CRITICAL',
            tone: 'critical',
            icon: AlertTriangle,
            title: data.organizationName || data.companyName || data.siteName || 'SOS Alert',
            description: String(data.message || data.description || 'SOS alert active'),
            actionLabel: 'RESPOND NOW',
            ts,
            detailType: data.sosType || data.alertCategory || data.type || 'SOS',
            detailSeverity: data.severity || 'critical',
            detailStatus: data.status || 'pending',
            detailDescription: String(data.message || data.description || data.notes || 'SOS alert active'),
            detailOccurredAt: data.triggeredAt || data.createdAt || null,
            detailGps: data.gpsLocation ?? data.locationGeo ?? data.coordinates ?? null,
            detailEvidenceUrls: normalizeEvidenceUrls(data.evidenceUrls),
          }
        })
        sosLoaded = true
        publish()
      },
      () => {
        lastSos = []
        sosLoaded = true
        publish()
      },
    )

    const unsubHira = onSnapshot(
      hiraQ,
      (snap) => {
        lastHira = snap.docs.map((d) => {
          const data = d.data() || {}
          const ts = toMillis(data.createdAt)
          return {
            id: d.id,
            alertType: 'hira_assessments',
            type: 'REVIEW',
            tone: 'warning',
            icon: FileText,
            title: data.title || data.assessmentName || 'HIRA Assessment',
            description: String(data.summary || data.description || 'New HIRA requires manager review.'),
            actionLabel: 'APPROVE HIRA',
            siteName:
              data.siteName || data.projectName || data.locationName || data.site || data.organizationName || '',
            ts,
            detailType: data.category || data.assessmentType || data.hiraType || 'HIRA Assessment',
            detailSeverity: data.riskLevel || data.severity || data.riskRating || '',
            detailStatus: data.status || 'pending',
            detailDescription: String(
              data.summary || data.description || data.notes || 'New HIRA requires manager review.',
            ),
            detailOccurredAt: data.createdAt || data.submittedAt || data.updatedAt || null,
            detailGps: data.gpsLocation ?? data.locationGeo ?? data.coordinates ?? null,
            detailEvidenceUrls: normalizeEvidenceUrls(data.evidenceUrls || data.attachmentUrls),
          }
        })
        hiraLoaded = true
        publish()
      },
      () => {
        lastHira = []
        hiraLoaded = true
        publish()
      },
    )

    const unsubIncidents = onSnapshot(
      incidentsQ,
      (snap) => {
        lastIncidents = snap.docs
          .map((d) => {
            const data = d.data() || {}
          const ts = toMillis(data.createdAt)
          return {
            id: d.id,
            alertType: 'incidents',
            type: 'INCIDENT',
            tone: 'warning',
            icon: ShieldAlert,
            title: data.title || data.incidentTitle || data.type || 'Incident Reported',
            description: String(data.summary || data.description || 'New incident requires review.'),
            actionLabel: 'VIEW DETAILS',
            severity: data.severity || data.riskLevel || data.priority || '—',
            incidentDescription: String(data.description || data.summary || ''),
            ts,
            detailType: data.type || data.category || '—',
            detailSeverity: data.severity || data.riskLevel || data.priority || 'Low',
            detailStatus: data.status || 'pending',
            detailDescription: String(data.description || data.summary || ''),
            detailOccurredAt: data.occurredAt || data.exactTime || data.createdAt || null,
            detailGps: data.gpsLocation ?? data.locationGeo ?? data.coordinates ?? null,
            detailEvidenceUrls: normalizeEvidenceUrls(data.evidenceUrls),
          }
          })
          // If an incident is closed, it should disappear from the Sentinel feed.
          .filter((a) => String(a.detailStatus || '').toLowerCase() !== 'closed')
        incidentsLoaded = true
        publish()
      },
      () => {
        lastIncidents = []
        incidentsLoaded = true
        publish()
      },
    )

    return () => {
      unsubSos()
      unsubHira()
      unsubIncidents()
    }
  }, [orgId])

  function openRespondDrawer(alert) {
    setRespondAlert(alert)
    setResponseNotes('')
    setMarkResolved(false)
    setManagerFeedback('')
    setIncidentAssignee('')
    setDrawerOpen(true)
  }

  function dismissAlert(alert) {
    if (!alert?.id || !alert?.alertType) return
    const key = `${alert.alertType}:${alert.id}`
    setDismissedAlertKeys((prev) => (prev[key] ? prev : { ...prev, [key]: true }))
    setSentinelAlerts((prev) => prev.filter((a) => `${a.alertType}:${a.id}` !== key))
  }

  function handleSentinelAction(alert) {
    if (!alert) return
    // For “View details” style items, deep-link to the related page.
    if (alert.alertType === 'incidents') {
      navigate(`/client/incidents?open=${encodeURIComponent(alert.id)}`)
      return
    }
    if (alert.alertType === 'hira_assessments') {
      navigate(`/client/risk-assessment?open=${encodeURIComponent(alert.id)}`)
      return
    }
    // SOS stays in-dashboard (respond workflow lives here for now).
    openRespondDrawer(alert)
  }

  function closeDrawer() {
    setDrawerOpen(false)
    setRespondAlert(null)
    setResponseNotes('')
    setMarkResolved(false)
    setManagerFeedback('')
    setIncidentAssignee('')
  }

  function showToast(nextToast) {
    setToast(nextToast)
    window.setTimeout(() => setToast(null), 2200)
  }

  async function updateAlertDoc(collectionName, docId, patch, okMessage) {
    // TODO: Wire to Firestore where('organizationId', '==', orgId) — ensure write rules enforce org ownership
    await updateDoc(doc(db, collectionName, docId), patch)
    showToast({ tone: 'success', message: okMessage })
  }

  async function handleSubmitResponse(e) {
    e.preventDefault()
    if (!respondAlert) return
    if (!orgId) return

    try {
      if (respondAlert.alertType === 'sos_alerts') {
        await updateAlertDoc(
          'sos_alerts',
          respondAlert.id,
          {
            status: markResolved ? 'resolved' : 'acknowledged',
            managerResponse: responseNotes,
            respondedAt: serverTimestamp(),
          },
          markResolved ? 'SOS marked resolved.' : 'SOS response saved.',
        )
        closeDrawer()
        return
      }

      if (respondAlert.alertType === 'incidents') {
        if (!incidentAssignee) {
          showToast({ tone: 'error', message: 'Please assign an investigator.' })
          return
        }
        await updateAlertDoc(
          'incidents',
          respondAlert.id,
          {
            status: 'investigation_assigned',
            investigator: incidentAssignee,
            assignedAt: serverTimestamp(),
          },
          'Investigator assigned.',
        )
        closeDrawer()
        return
      }

      // fallback (shouldn’t happen): acknowledge
      await updateAlertDoc(
        respondAlert.alertType,
        respondAlert.id,
        { status: 'acknowledged', managerResponse: responseNotes, respondedAt: serverTimestamp() },
        'Saved.',
      )
      closeDrawer()
    } catch {
      showToast({ tone: 'error', message: 'Could not save. Please try again.' })
    }
  }

  const visibleModules = useMemo(() => {
    const userModules = modules || []
    return MODULE_CARDS.filter(card => {
      if (card.key === 'safety_files' || card.key === 'risk_assessment' || card.key === 'incidents' || card.key === 'contractors' || card.key === 'reports' || card.key === 'settings') {
        return true
      }
      if (card.key === 'fleet') return userModules.includes('fleet')
      if (card.key === 'fire_safety') return userModules.includes('fire_extinguisher') || userModules.includes('fire_detection')
      if (card.key === 'training') return userModules.includes('training')
      return true
    })
  }, [modules])

  return (
    <section className="client-page client-dashboard-page">

      <div className="client-dash-main">
        <div className="client-dash-feed-col">
          <article className="client-card client-card--feed">
            <div className="client-feed-head">
              <h2>Sentinel Alerts</h2>
              <span className="client-feed-meta">Live feed</span>
            </div>
            {/* TODO: Wire to Firestore where('organizationId', '==', orgId) for sos_alerts, hira_assessments, incidents */}
            {alertsLoading ? (
              <div className="client-alerts-loading" role="status" aria-live="polite">
                <span className="client-spinner" aria-hidden />
                Checking for alerts…
              </div>
            ) : null}
            {!alertsLoading ? (
              <SentinelAlertsFeed
                alerts={sentinelAlerts}
                onAction={(a) => handleSentinelAction(a)}
                onDismiss={(a) => dismissAlert(a)}
              />
            ) : null}
          </article>
        </div>

        <aside className="client-dash-aside">
          <article className="client-card client-card--wf">
            <h2>Workforce Ready</h2>
            {/* TODO: Wire to Firestore where('organizationId', '==', orgId) for workforce readiness breakdown */}
            <div className="client-wf-bars" role="img" aria-label="Workforce readiness by status">
              {workforceRows.map((row) => (
                <div key={row.key} className="client-wf-row">
                  <div className="client-wf-label">
                    <span>{row.label}</span>
                    <span>{row.pct}%</span>
                  </div>
                  <div className="client-wf-track">
                    <div
                      className={`client-wf-seg ${row.className}`}
                      style={{ width: `${row.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="client-card client-card--ppe">
            <div className="client-ppe-head">
              <h2>PPE Assets</h2>
              <span className="client-feed-meta">
                {ppeLoading ? 'Loading…' : `${ppeAssets.length} tracked`}
              </span>
            </div>
            <div className="client-ppe-kpis" aria-label="PPE summary">
              <div className="client-ppe-kpi">
                <span className="client-ppe-kpi-label">Active</span>
                <span className="client-ppe-kpi-value">{String(ppeSummary.active).padStart(2, '0')}</span>
              </div>
              <div className="client-ppe-kpi">
                <span className="client-ppe-kpi-label">Expiring</span>
                <span className="client-ppe-kpi-value">{String(ppeSummary.expiring).padStart(2, '0')}</span>
              </div>
              <div className="client-ppe-kpi">
                <span className="client-ppe-kpi-label">Expired</span>
                <span className="client-ppe-kpi-value">{String(ppeSummary.expired).padStart(2, '0')}</span>
              </div>
            </div>
            {!ppeLoading && !ppeAssets.length ? (
              <p className="client-td-muted" style={{ margin: 0, fontSize: 13 }}>
                No PPE assets yet.
              </p>
            ) : null}
            {ppeAssets.length ? (
              <ul className="client-ppe-list">
                {ppeAssets.map((a) => {
                  const st = String(a.status || '').toUpperCase()
                  const pill =
                    st === 'ACTIVE' ? 'client-pill--ok' : st === 'REVOKED' ? 'client-pill--danger' : 'client-pill--warn'
                  return (
                    <li key={a.id} className="client-ppe-item">
                      <div className="client-ppe-item-main">
                        <span className="client-ppe-title">
                          {a.category}
                          {a.size ? <span className="client-td-muted"> • {a.size}</span> : null}
                          {a.quantity ? <span className="client-td-muted"> • Qty {a.quantity}</span> : null}
                        </span>
                        <span className="client-td-muted">{a.assigneeName}</span>
                      </div>
                      <span className={`client-pill ${pill}`}>{st || '—'}</span>
                    </li>
                  )
                })}
              </ul>
            ) : null}
          </article>

          <article className="client-card client-card--status">
            <h2>System Status</h2>
            {/* TODO: Wire to Firestore where('organizationId', '==', orgId) for edge / node health */}
            <div className="client-status-row">
              <span className="client-status-pulse" aria-hidden />
              <div>
                <p className="client-status-title">All Nodes Operational</p>
                <p className="client-status-sub">Last check: moments ago</p>
              </div>
            </div>
          </article>
        </aside>
      </div>

      <SideDrawer
        isOpen={drawerOpen}
        onClose={closeDrawer}
        title={respondAlert ? `Respond: ${respondAlert.title}` : 'Response'}
      >
        {respondAlert?.alertType === 'hira_assessments' ? (
          <div className="client-drawer-form">
            <AlertDetailReadonly
              variant="hira"
              type={respondAlert.detailType}
              severity={respondAlert.detailSeverity}
              statusRaw={respondAlert.detailStatus}
              description={respondAlert.detailDescription}
              occurredAt={respondAlert.detailOccurredAt}
              gpsLocation={respondAlert.detailGps}
              evidenceUrls={respondAlert.detailEvidenceUrls}
            />
            <HiraReviewForm
              hira={{ id: respondAlert.id, siteName: respondAlert.siteName }}
              onDone={closeDrawer}
              onToast={showToast}
            />
          </div>
        ) : respondAlert?.alertType === 'incidents' ? (
          <form className="client-drawer-form" onSubmit={handleSubmitResponse}>
            <AlertDetailReadonly
              variant="incident"
              type={respondAlert.detailType}
              severity={respondAlert.detailSeverity}
              statusRaw={respondAlert.detailStatus}
              description={respondAlert.detailDescription}
              occurredAt={respondAlert.detailOccurredAt}
              gpsLocation={respondAlert.detailGps}
              evidenceUrls={respondAlert.detailEvidenceUrls}
            />

            <label htmlFor="client-incident-assignee">Assign for Investigation</label>
            <select
              id="client-incident-assignee"
              name="assignee"
              className="client-select"
              value={incidentAssignee}
              onChange={(e) => setIncidentAssignee(e.target.value)}
              required
            >
              <option value="" disabled>
                Select investigator…
              </option>
              <option value="Ayesha Khan">Ayesha Khan</option>
              <option value="Omar Ali">Omar Ali</option>
              <option value="Hassan Raza">Hassan Raza</option>
              <option value="Fatima Noor">Fatima Noor</option>
            </select>

            <div className="client-drawer-split">
              <button type="submit" className="client-btn client-btn--primary client-btn--wide">
                Assign Investigator
              </button>
              <button
                type="button"
                className="client-btn client-btn--ghost client-btn--wide"
                onClick={() => window.print()}
              >
                Download Incident Report
              </button>
            </div>
          </form>
        ) : respondAlert ? (
          <form className="client-drawer-form" onSubmit={handleSubmitResponse}>
            <AlertDetailReadonly
              variant="sos"
              type={respondAlert.detailType}
              severity={respondAlert.detailSeverity}
              statusRaw={respondAlert.detailStatus}
              description={respondAlert.detailDescription}
              occurredAt={respondAlert.detailOccurredAt}
              gpsLocation={respondAlert.detailGps}
              evidenceUrls={respondAlert.detailEvidenceUrls}
            />

            <label htmlFor="client-response-notes">Response Notes</label>
            <textarea
              id="client-response-notes"
              name="responseNotes"
              value={responseNotes}
              onChange={(e) => setResponseNotes(e.target.value)}
              placeholder="Describe actions taken or follow-up required…"
              required
            />
            <label className="client-toggle-row">
              <input
                type="checkbox"
                checked={markResolved}
                onChange={(e) => setMarkResolved(e.target.checked)}
              />
              <span>Mark as Resolved</span>
            </label>
            <button type="submit" className="client-btn client-btn--primary">
              Save Response
            </button>
          </form>
        ) : null}
      </SideDrawer>

      {toast ? (
        <div className={`client-toast ${toast.tone === 'error' ? 'client-toast--error' : 'client-toast--success'}`} role="status" aria-live="polite">
          {toast.message}
        </div>
      ) : null}
    </section>
  )
}
