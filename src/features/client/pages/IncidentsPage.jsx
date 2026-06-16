import { useEffect, useMemo, useState } from 'react'
import { doc, onSnapshot, query, collection, where, orderBy, updateDoc, serverTimestamp } from 'firebase/firestore'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../../app/providers/authContext.js'
import { db } from '../../../config/firebase.js'
import {
  formatDate,
  normalizeEvidenceUrls,
  normalizeIncidentStatus,
  normalizeSeverity,
} from '../alertDetailHelpers.js'
import { AlertDetailReadonly } from '../components/AlertDetailReadonly.jsx'
import { SideDrawer } from '../components/SideDrawer.jsx'

export function IncidentsPage() {
  const { profile, organizationId } = useAuth()
  const orgId = profile?.organizationId ?? organizationId
  const [searchParams, setSearchParams] = useSearchParams()

  const [incidents, setIncidents] = useState([])
  const [loading, setLoading] = useState(true)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const [updateStatus, setUpdateStatus] = useState('investigating')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null) // { tone, message }

  useEffect(() => {
    if (!orgId) {
      setIncidents([])
      setLoading(false)
      return undefined
    }

    setLoading(true)
    // TODO: Wire to Firestore where('organizationId', '==', orgId) — incidents for org
    const incidentsQ = query(
      collection(db, 'incidents'),
      where('organizationId', '==', orgId),
      orderBy('createdAt', 'desc'),
    )

    const unsub = onSnapshot(
      incidentsQ,
      (snap) => {
        const rows = snap.docs.map((d) => {
          const data = d.data() || {}
          const evidenceUrls = normalizeEvidenceUrls(data.evidenceUrls)
          return {
            id: d.id,
            createdAt: data.createdAt || null,
            reportedBy: data.reportedByName || data.reportedBy || data.workerName || '—',
            severity: data.severity || data.riskLevel || data.priority || 'Low',
            type: data.type || data.category || '—',
            status: data.status || 'pending',
            description: data.description || data.summary || '—',
            location: data.location || data.siteName || data.site || '—',
            exactTime: data.exactTime || data.occurredAt || data.createdAt || null,
            occurredAt: data.occurredAt || data.exactTime || data.createdAt || null,
            gpsLocation: data.gpsLocation ?? data.locationGeo ?? data.coordinates ?? null,
            evidenceUrls,
            investigationNotes: data.investigationNotes || data.managerNotes || data.notes || '',
          }
        })
        setIncidents(rows)
        setLoading(false)
      },
      () => {
        setIncidents([])
        setLoading(false)
      },
    )

    return () => unsub()
  }, [orgId])

  // Deep-link support from Sentinel Alerts: /client/incidents?open=<incidentId>
  useEffect(() => {
    const openId = searchParams.get('open')
    if (!openId) return
    if (!incidents.length) return
    const match = incidents.find((i) => i.id === openId)
    if (!match) return
    openDrawer(match)
    // Clean URL to avoid reopening on subsequent renders.
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('open')
      return next
    }, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incidents, searchParams, setSearchParams])

  const kpis = useMemo(() => {
    const openInvestigations = incidents.filter((i) => String(i.status || '').toLowerCase() !== 'closed').length
    return { openInvestigations, total: incidents.length }
  }, [incidents])

  function showToast(nextToast) {
    setToast(nextToast)
    window.setTimeout(() => setToast(null), 2400)
  }

  function openDrawer(incident) {
    setSelected(incident)
    const current = String(incident?.status || '').toLowerCase()
    setUpdateStatus(current === 'closed' ? 'closed' : 'investigating')
    setNotes(String(incident?.investigationNotes || ''))
    setDrawerOpen(true)
  }

  function closeDrawer() {
    setDrawerOpen(false)
    setSelected(null)
    setSaving(false)
    setNotes('')
  }

  async function saveUpdates(e) {
    e.preventDefault()
    if (!selected?.id) return
    setSaving(true)
    try {
      // TODO: Wire to Firestore where('organizationId', '==', orgId) — enforce via rules
      await updateDoc(doc(db, 'incidents', selected.id), {
        status: updateStatus,
        investigationNotes: notes,
        updatedAt: serverTimestamp(),
      })
      showToast({ tone: 'success', message: 'Incident updated.' })
      closeDrawer()
    } catch {
      showToast({ tone: 'error', message: 'Could not update incident.' })
      setSaving(false)
    }
  }

  return (
    <section className="client-page client-incidents-page">
      <header className="client-dash-header">
        <h1>Incidents</h1>
        <p className="client-dash-sub">Track, investigate, and resolve workplace incidents.</p>
      </header>

      <div className="client-risk-kpis">
        <article className="client-card client-kpi client-kpi--danger">
          <p className="client-kpi-label">Open Investigations</p>
          <p className="client-kpi-value">{String(kpis.openInvestigations).padStart(2, '0')}</p>
        </article>
        <article className="client-card client-kpi">
          <p className="client-kpi-label">Total Incidents</p>
          <p className="client-kpi-value">{String(kpis.total).padStart(2, '0')}</p>
        </article>
      </div>

      <article className="client-card client-risk-table-card">
        <div className="client-risk-toolbar">
          <div>
            <h2>Incident Reports</h2>
            <p className="client-risk-toolbar-sub">{loading ? 'Loading…' : `${incidents.length} total`}</p>
          </div>
        </div>

        <div className="client-table-wrap">
          <table className="client-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Reported By</th>
                <th>Severity</th>
                <th>Type</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {!loading && incidents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="client-table-empty">
                    No incidents found.
                  </td>
                </tr>
              ) : null}
              {incidents.map((i) => {
                const sev = normalizeSeverity(i.severity)
                const sevTone =
                  sev === 'High' ? 'client-pill--danger' : sev === 'Medium' ? 'client-pill--warn' : 'client-pill--warn'
                const st = String(i.status || '').toLowerCase()
                const stLabel = normalizeIncidentStatus(st)
                const stTone = st === 'closed' ? 'client-pill--ok' : stLabel === 'Investigating' ? 'client-pill--warn' : 'client-pill--warn'

                return (
                  <tr key={i.id} className="client-row-click" onClick={() => openDrawer(i)} role="button" tabIndex={0}>
                    <td>{formatDate(i.createdAt)}</td>
                    <td className="client-td-strong">{i.reportedBy}</td>
                    <td>
                      <span className={`client-pill ${sevTone}`}>{sev}</span>
                    </td>
                    <td className="client-td-muted">{i.type}</td>
                    <td>
                      <span className={`client-pill ${stTone}`}>{stLabel}</span>
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
        title={selected ? `Incident: ${selected.type}` : 'Incident'}
      >
        {selected ? (
          <form className="client-drawer-form" onSubmit={saveUpdates}>
            <AlertDetailReadonly
              variant="incident"
              type={selected.type}
              severity={selected.severity}
              statusRaw={selected.status}
              description={selected.description}
              occurredAt={selected.occurredAt}
              gpsLocation={selected.gpsLocation}
              evidenceUrls={selected.evidenceUrls}
            />

            <label htmlFor="incident-status">Update Status</label>
            <select
              id="incident-status"
              className="client-select"
              value={updateStatus}
              onChange={(e) => setUpdateStatus(e.target.value)}
              disabled={saving}
            >
              <option value="investigating">Investigating</option>
              <option value="closed">Closed</option>
            </select>

            <label htmlFor="incident-notes">Investigation Notes / Resolution</label>
            <textarea
              id="incident-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add findings, corrective actions, and final resolution…"
              disabled={saving}
            />

            <button type="submit" className="client-btn client-btn--primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save Updates'}
            </button>
          </form>
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

