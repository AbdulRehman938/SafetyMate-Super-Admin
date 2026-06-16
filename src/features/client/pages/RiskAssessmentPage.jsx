import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../../app/providers/authContext.js'
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { useSearchParams } from 'react-router-dom'
import { db } from '../../../config/firebase.js'
import { SideDrawer } from '../components/SideDrawer.jsx'
import { HiraReviewForm } from '../components/HiraReviewForm.jsx'

function toDate(value) {
  if (!value) return null
  if (typeof value?.toDate === 'function') return value.toDate()
  if (value instanceof Date) return value
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function formatDate(value) {
  const d = toDate(value)
  if (!d) return '—'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).format(d)
}

function normalizeStatus(raw) {
  const s = String(raw || '').toLowerCase()
  if (s === 'approved') return 'Approved'
  if (s === 'revision_required') return 'Revision'
  return 'Pending'
}

function normalizeRisk(raw) {
  const s = String(raw || '').toLowerCase()
  if (s === 'high') return 'High'
  if (s === 'medium') return 'Medium'
  if (s === 'low') return 'Low'
  return raw ? String(raw) : '—'
}

export function RiskAssessmentPage() {
  const { profile, organizationId } = useAuth()
  const currentOrgId = profile?.organizationId ?? organizationId
  const [searchParams, setSearchParams] = useSearchParams()

  const [loading, setLoading] = useState(true)
  const [hiras, setHiras] = useState([])
  const [statusFilter, setStatusFilter] = useState('all') // all | pending | approved | revision_required

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedHira, setSelectedHira] = useState(null)
  const [toast, setToast] = useState(null) // { tone, message }

  useEffect(() => {
    if (!currentOrgId) {
      setHiras([])
      setLoading(false)
      return undefined
    }

    setLoading(true)
    // TODO: Wire to Firestore where('organizationId', '==', currentOrgId) — fetch HIRAs for org
    const hiraQ = query(
      collection(db, 'hira_assessments'),
      where('organizationId', '==', currentOrgId),
      orderBy('createdAt', 'desc'),
      limit(500),
    )

    const unsub = onSnapshot(
      hiraQ,
      (snap) => {
        const rows = snap.docs.map((d) => {
          const data = d.data() || {}
          return {
            id: d.id,
            createdAt: data.createdAt || null,
            siteName: data.siteName || data.projectName || data.locationName || data.site || '—',
            taskDescription: data.taskDescription || data.task || data.description || '—',
            riskLevel: data.riskLevel || data.risk || data.level || '—',
            status: data.status || 'pending',
          }
        })
        setHiras(rows)
        setLoading(false)
      },
      () => {
        setHiras([])
        setLoading(false)
      },
    )

    return () => unsub()
  }, [currentOrgId])

  // Deep-link support from Sentinel Alerts: /client/risk-assessment?open=<hiraId>
  useEffect(() => {
    const openId = searchParams.get('open')
    if (!openId) return
    if (!hiras.length) return
    const match = hiras.find((h) => h.id === openId)
    if (!match) return
    openDrawer(match)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('open')
      return next
    }, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hiras, searchParams, setSearchParams])

  const kpis = useMemo(() => {
    const pendingReviews = hiras.filter((h) => String(h.status || '').toLowerCase() === 'pending').length
    const highRiskActive = hiras.filter((h) => {
      const level = String(h.riskLevel || '').toLowerCase()
      const status = String(h.status || '').toLowerCase()
      return level === 'high' && status === 'approved'
    }).length
    return {
      pendingReviews,
      highRiskActive,
      totalAssessments: hiras.length,
    }
  }, [hiras])

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return hiras
    return hiras.filter((h) => String(h.status || '').toLowerCase() === statusFilter)
  }, [hiras, statusFilter])

  function openDrawer(hira) {
    setSelectedHira(hira)
    setDrawerOpen(true)
  }

  function closeDrawer() {
    setDrawerOpen(false)
    setSelectedHira(null)
  }

  function showToast(nextToast) {
    setToast(nextToast)
    window.setTimeout(() => setToast(null), 2200)
  }

  return (
    <section className="client-page client-risk-page">
      <header className="client-dash-header">
        <h1>Risk Assessment</h1>
        <p className="client-dash-sub">HIRA assessments and review workflow.</p>
      </header>

      <div className="client-risk-kpis">
        <article className="client-card client-kpi">
          <p className="client-kpi-label">Pending Reviews</p>
          <p className="client-kpi-value">{String(kpis.pendingReviews).padStart(2, '0')}</p>
        </article>
        <article className="client-card client-kpi client-kpi--danger">
          <p className="client-kpi-label">High Risk Active</p>
          <p className="client-kpi-value">{String(kpis.highRiskActive).padStart(2, '0')}</p>
        </article>
        <article className="client-card client-kpi">
          <p className="client-kpi-label">Total Assessments</p>
          <p className="client-kpi-value">{String(kpis.totalAssessments).padStart(2, '0')}</p>
        </article>
      </div>

      <article className="client-card client-risk-table-card">
        <div className="client-risk-toolbar">
          <div>
            <h2>Assessments</h2>
            <p className="client-risk-toolbar-sub">{loading ? 'Loading…' : `${filtered.length} shown`}</p>
          </div>
          <label className="client-risk-filter">
            <span>Filter by Status</span>
            <select className="client-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="revision_required">Revision Required</option>
            </select>
          </label>
        </div>

        <div className="client-table-wrap">
          <table className="client-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Project / Site</th>
                <th>Task Description</th>
                <th>Risk Level</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {!loading && filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="client-table-empty">
                    No assessments found.
                  </td>
                </tr>
              ) : null}
              {filtered.map((h) => {
                const risk = normalizeRisk(h.riskLevel)
                const riskTone =
                  risk === 'High' ? 'client-pill--danger' : risk === 'Medium' ? 'client-pill--warn' : 'client-pill--ok'
                const status = String(h.status || '').toLowerCase()
                const statusLabel = normalizeStatus(status)
                const statusTone =
                  status === 'approved'
                    ? 'client-pill--ok'
                    : status === 'revision_required'
                      ? 'client-pill--danger'
                      : 'client-pill--warn'

                return (
                  <tr key={h.id} className="client-row-click" onClick={() => openDrawer(h)} role="button" tabIndex={0}>
                    <td>{formatDate(h.createdAt)}</td>
                    <td className="client-td-strong">{h.siteName}</td>
                    <td className="client-td-muted">{h.taskDescription}</td>
                    <td>
                      <span className={`client-pill ${riskTone}`}>{risk}</span>
                    </td>
                    <td>
                      <span className={`client-pill ${statusTone}`}>{statusLabel}</span>
                    </td>
                    <td className="client-td-actions" onClick={(e) => e.stopPropagation()}>
                      <button type="button" className="client-btn client-btn--primary" onClick={() => openDrawer(h)}>
                        Review
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </article>

      <SideDrawer
        isOpen={drawerOpen}
        onClose={closeDrawer}
        title={selectedHira ? `HIRA Review: ${selectedHira.siteName}` : 'HIRA Review'}
      >
        {selectedHira ? (
          <HiraReviewForm
            hira={selectedHira}
            onDone={closeDrawer}
            onToast={showToast}
          />
        ) : null}
      </SideDrawer>

      {toast ? (
        <div
          className={`client-toast ${toast.tone === 'error' ? 'client-toast--error' : 'client-toast--success'}`}
          role="status"
          aria-live="polite"
        >
          {toast.message}
        </div>
      ) : null}
    </section>
  )
}

