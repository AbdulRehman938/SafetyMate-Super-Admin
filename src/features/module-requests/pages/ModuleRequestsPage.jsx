/**
 * ModuleRequestsPage — Super Admin
 * Shows one collapsed row per company.
 * Expanding a row shows the latest unique request per module (deduped).
 */
import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  collection, doc, onSnapshot, orderBy,
  query, updateDoc, serverTimestamp, getDoc,
} from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import {
  CheckCircle2, XCircle, Search, Flame, Siren,
  Truck, LayoutGrid, ChevronDown, ChevronRight, Loader2,
} from 'lucide-react'
import { db, app } from '../../../config/firebase.js'
import { useToast } from '../../../shared/toast/toastContext.js'

// ── Constants ─────────────────────────────────────────────────────────────────

const MODULE_META = {
  fleet:             { label: 'Fleet Management',         icon: Truck,  color: '#7ab5ff' },
  fire_extinguisher: { label: 'Fire Extinguisher Safety', icon: Flame,  color: '#ffb56e' },
  fire_detection:    { label: 'Fire Detection & Alarms',  icon: Siren,  color: '#ff9aa2' },
}

const STATUS_META = {
  pending:   { label: 'Pending',   bg: 'rgba(58,130,255,0.1)',   border: 'rgba(58,130,255,0.25)',  color: '#7ab5ff' },
  granted:   { label: 'Granted',   bg: 'rgba(22,201,136,0.1)',   border: 'rgba(22,201,136,0.25)',  color: '#4deba0' },
  dismissed: { label: 'Dismissed', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.2)',  color: 'rgba(148,163,184,0.7)' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(val) {
  if (!val) return '—'
  const date = typeof val?.toDate === 'function' ? val.toDate() : new Date(val)
  if (isNaN(date)) return '—'
  const diff = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diff < 60)    return `${diff}s ago`
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function StatusPill({ status }) {
  const m = STATUS_META[status] || STATUS_META.pending
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 10px', borderRadius: 999,
      fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
      background: m.bg, border: `1px solid ${m.border}`, color: m.color, whiteSpace: 'nowrap',
    }}>
      {m.label}
    </span>
  )
}

function OrgPlanCell({ organizationId }) {
  const [plan, setPlan] = useState(null)
  useEffect(() => {
    if (!organizationId) return
    getDoc(doc(db, 'organizations', organizationId))
      .then((snap) => setPlan(snap.exists() ? (snap.data().plan || '—') : '—'))
      .catch(() => setPlan('—'))
  }, [organizationId])
  if (!plan) return <span style={{ fontSize: 12, color: 'var(--muted2)' }}>…</span>
  return (
    <span style={{
      display: 'inline-flex', padding: '3px 10px', borderRadius: 999,
      fontSize: 11.5, fontWeight: 600,
      border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)',
      color: 'rgba(235,242,255,0.85)', whiteSpace: 'nowrap',
    }}>
      {plan}
    </span>
  )
}

/**
 * Groups all requests by company, then within each company dedupes by moduleKey
 * keeping only the LATEST request per module.
 * Returns array of { organizationId, organizationName, latestAt, modules: [...latestReqPerModule] }
 */
function groupAndDedupe(requests) {
  // Map: orgId → { orgId, orgName, latestAt, moduleMap: { moduleKey → latestReq } }
  const orgMap = {}

  for (const req of requests) {
    const orgId = req.organizationId
    if (!orgId) continue

    if (!orgMap[orgId]) {
      orgMap[orgId] = {
        organizationId:   orgId,
        organizationName: req.organizationName || orgId,
        latestAt:         req.createdAt,
        moduleMap:        {},
      }
    }

    const entry = orgMap[orgId]

    // Update latestAt for the company row
    const reqTime = typeof req.createdAt?.toDate === 'function'
      ? req.createdAt.toDate().getTime()
      : new Date(req.createdAt || 0).getTime()
    const curTime = typeof entry.latestAt?.toDate === 'function'
      ? entry.latestAt.toDate().getTime()
      : new Date(entry.latestAt || 0).getTime()
    if (reqTime > curTime) entry.latestAt = req.createdAt

    // Keep only the latest request per moduleKey
    const existing = entry.moduleMap[req.moduleKey]
    if (!existing) {
      entry.moduleMap[req.moduleKey] = req
    } else {
      const existTime = typeof existing.createdAt?.toDate === 'function'
        ? existing.createdAt.toDate().getTime()
        : new Date(existing.createdAt || 0).getTime()
      if (reqTime > existTime) entry.moduleMap[req.moduleKey] = req
    }
  }

  // Convert to array sorted by latestAt desc
  return Object.values(orgMap)
    .map((entry) => ({
      ...entry,
      modules: Object.values(entry.moduleMap)
        .sort((a, b) => {
          const ta = typeof a.createdAt?.toDate === 'function' ? a.createdAt.toDate().getTime() : 0
          const tb = typeof b.createdAt?.toDate === 'function' ? b.createdAt.toDate().getTime() : 0
          return tb - ta
        }),
    }))
    .sort((a, b) => {
      const ta = typeof a.latestAt?.toDate === 'function' ? a.latestAt.toDate().getTime() : 0
      const tb = typeof b.latestAt?.toDate === 'function' ? b.latestAt.toDate().getTime() : 0
      return tb - ta
    })
}

// ── Main component ────────────────────────────────────────────────────────────

export function ModuleRequestsPage() {
  const navigate = useNavigate()
  const toast    = useToast()

  const [requests, setRequests]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState({})   // { [reqId]: true }
  const [expanded, setExpanded]   = useState({})   // { [orgId]: true }

  // Filters
  const [search, setSearch]             = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterModule, setFilterModule] = useState('all')

  // ── Live feed ─────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true)
    const q = query(collection(db, 'module_requests'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q,
      (snap) => { setRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoading(false) },
      () => setLoading(false),
    )
    return () => unsub()
  }, [])

  // ── Group + dedupe ────────────────────────────────────────────
  const grouped = useMemo(() => {
    // Apply module/status filter BEFORE grouping (filters on the deduped module rows)
    let base = requests
    if (filterModule !== 'all') base = base.filter((r) => r.moduleKey === filterModule)
    if (filterStatus !== 'all') base = base.filter((r) => r.status === filterStatus)
    if (search.trim()) {
      const s = search.toLowerCase()
      base = base.filter((r) =>
        r.organizationName?.toLowerCase().includes(s) ||
        r.organizationId?.toLowerCase().includes(s) ||
        r.requesterName?.toLowerCase().includes(s) ||
        r.requesterEmail?.toLowerCase().includes(s) ||
        r.moduleLabel?.toLowerCase().includes(s),
      )
    }
    return groupAndDedupe(base)
  }, [requests, filterStatus, filterModule, search])

  // ── KPI counts (from raw unfiltered data) ─────────────────────
  const counts = useMemo(() => ({
    all:       requests.length,
    pending:   requests.filter((r) => r.status === 'pending').length,
    granted:   requests.filter((r) => r.status === 'granted').length,
    dismissed: requests.filter((r) => r.status === 'dismissed').length,
  }), [requests])

  function toggleExpand(orgId) {
    setExpanded((p) => ({ ...p, [orgId]: !p[orgId] }))
  }

  // ── Grant access ─────────────────────────────────────────────
  async function handleGrant(req) {
    setSaving((p) => ({ ...p, [req.id]: true }))
    try {
      const orgSnap = await getDoc(doc(db, 'organizations', req.organizationId))
      const cur = Array.isArray(orgSnap.data()?.modules) ? orgSnap.data().modules : []
      const next = cur.includes(req.moduleKey) ? cur : [...cur, req.moduleKey]
      const fns = getFunctions(app)
      await httpsCallable(fns, 'updateCompanyModules')({ organizationId: req.organizationId, modules: next })
      await updateDoc(doc(db, 'module_requests', req.id), { status: 'granted', grantedAt: serverTimestamp() })
      toast.push({ type: 'success', title: 'Access Granted', message: `${req.moduleLabel} enabled for ${req.organizationName}.` })
    } catch (err) {
      toast.push({ type: 'error', title: 'Failed', message: err?.message || 'Could not grant.' })
    } finally {
      setSaving((p) => ({ ...p, [req.id]: false }))
    }
  }

  // ── Dismiss ───────────────────────────────────────────────────
  async function handleDismiss(req) {
    setSaving((p) => ({ ...p, [req.id]: true }))
    try {
      await updateDoc(doc(db, 'module_requests', req.id), { status: 'dismissed', dismissedAt: serverTimestamp() })
      toast.push({ type: 'success', title: 'Dismissed', message: 'Request dismissed.' })
    } catch (err) {
      toast.push({ type: 'error', title: 'Failed', message: err?.message || 'Could not dismiss.' })
    } finally {
      setSaving((p) => ({ ...p, [req.id]: false }))
    }
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <section className="stack-gap">

      {/* Header */}
      <div className="dash-title-wrap">
        <p className="subtle" style={{ margin: '0 0 4px', fontSize: 11, letterSpacing: '0.1em', color: 'var(--muted2)', textTransform: 'uppercase' }}>
          SUPER ADMIN / MODULE REQUESTS
        </p>
        <h1 style={{ margin: 0, fontSize: '1.55rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'rgba(235,242,255,0.97)' }}>
          Module Access Requests
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--muted2)' }}>
          One row per company — expand to see each module's latest request.
        </p>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12 }}>
        {[
          { key: 'all',       label: 'Total Requests', color: '#7ab5ff'  },
          { key: 'pending',   label: 'Pending',        color: '#f59e0b'  },
          { key: 'granted',   label: 'Granted',        color: '#4deba0'  },
          { key: 'dismissed', label: 'Dismissed',      color: 'rgba(148,163,184,0.7)' },
        ].map(({ key, label, color }) => (
          <button key={key} type="button" onClick={() => setFilterStatus(key === filterStatus ? 'all' : key)}
            style={{
              display: 'flex', flexDirection: 'column', gap: 6, padding: '16px 18px',
              borderRadius: 12, textAlign: 'left', cursor: 'pointer',
              border: filterStatus === key ? '1px solid rgba(58,130,255,0.35)' : '1px solid var(--border)',
              background: filterStatus === key ? 'rgba(58,130,255,0.08)' : 'linear-gradient(180deg,var(--surface),var(--surface2))',
              transition: 'border-color 150ms, background 150ms',
            }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted2)' }}>{label}</span>
            <span style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, color }}>{loading ? '—' : counts[key]}</span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="dashboard-card" style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 0 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted2)', pointerEvents: 'none' }} />
            <input type="text" placeholder="Search company, requester, module…" value={search} onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', height: 38, paddingLeft: 36, paddingRight: 12, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--inputBg)', color: 'var(--text)', font: 'inherit', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          {[
            { val: filterModule, set: setFilterModule, opts: [['all','All Modules'],['fleet','Fleet'],['fire_extinguisher','Fire Extinguisher'],['fire_detection','Fire Detection']] },
            { val: filterStatus, set: setFilterStatus, opts: [['all','All Statuses'],['pending','Pending'],['granted','Granted'],['dismissed','Dismissed']] },
          ].map(({ val, set, opts }, i) => (
            <select key={i} value={val} onChange={(e) => set(e.target.value)}
              style={{ height: 38, padding: '0 12px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--inputBg)', color: 'var(--text)', font: 'inherit', fontSize: 13, outline: 'none', cursor: 'pointer' }}>
              {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          ))}
          <span style={{ fontSize: 12, color: 'var(--muted2)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
            {grouped.length} compan{grouped.length !== 1 ? 'ies' : 'y'}
          </span>
        </div>
      </div>

      {/* Company rows */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px', color: 'var(--muted2)' }}>
          <Loader2 size={24} className="spin" />
        </div>
      ) : grouped.length === 0 ? (
        <div className="dashboard-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--muted2)' }}>
          <LayoutGrid size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
          <p>No module access requests found.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {grouped.map((org) => {
            const isExpanded = expanded[org.organizationId]
            const Icon = ChevronDown
            return (
              <div key={org.organizationId} className="dashboard-card" style={{ overflow: 'hidden' }}>
                {/* Company row header */}
                <button
                  type="button"
                  onClick={() => toggleExpand(org.organizationId)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '14px 16px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ flex: '0 0 auto' }}>
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(235,242,255,0.95)' }}>
                        {org.organizationName}
                      </span>
                      <OrgPlanCell organizationId={org.organizationId} />
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--muted2)' }}>
                      {org.organizationId} • {org.modules.length} module{org.modules.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div style={{ flex: '0 0 auto', fontSize: 12, color: 'var(--muted2)' }}>
                    {timeAgo(org.latestAt)}
                  </div>
                </button>

                {/* Expanded module requests */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px', background: 'rgba(0,0,0,0.15)' }}>
                    {org.modules.map((req) => {
                      const meta = MODULE_META[req.moduleKey] || { label: req.moduleLabel, icon: LayoutGrid, color: '#7ab5ff' }
                      const ModuleIcon = meta.icon
                      const isSaving = saving[req.id]
                      return (
                        <div
                          key={req.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: '10px 12px',
                            marginBottom: 8,
                            borderRadius: 8,
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.06)',
                          }}
                        >
                          <div style={{ flex: '0 0 auto', width: 32, height: 32, borderRadius: 8, background: `${meta.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ModuleIcon size={16} style={{ color: meta.color }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(235,242,255,0.9)' }}>
                                {meta.label}
                              </span>
                              <StatusPill status={req.status} />
                            </div>
                            <span style={{ fontSize: 12, color: 'var(--muted2)' }}>
                              {req.requesterName} • {req.requesterEmail}
                            </span>
                          </div>
                          <div style={{ flex: '0 0 auto', fontSize: 12, color: 'var(--muted2)' }}>
                            {timeAgo(req.createdAt)}
                          </div>
                          <div style={{ flex: '0 0 auto', display: 'flex', gap: 6 }}>
                            {req.status === 'pending' && (
                              <>
                                <button
                                  type="button"
                                  disabled={isSaving}
                                  onClick={() => handleGrant(req)}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                                    borderRadius: 6, border: '1px solid rgba(22,201,136,0.3)',
                                    background: isSaving ? 'rgba(22,201,136,0.1)' : 'rgba(22,201,136,0.15)',
                                    color: '#4deba0', fontSize: 12, fontWeight: 600, cursor: isSaving ? 'not-allowed' : 'pointer',
                                  }}
                                >
                                  {isSaving ? <Loader2 size={12} className="spin" /> : <CheckCircle2 size={12} />}
                                  Grant
                                </button>
                                <button
                                  type="button"
                                  disabled={isSaving}
                                  onClick={() => handleDismiss(req)}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                                    borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)',
                                    background: isSaving ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.15)',
                                    color: '#f87171', fontSize: 12, fontWeight: 600, cursor: isSaving ? 'not-allowed' : 'pointer',
                                  }}
                                >
                                  {isSaving ? <Loader2 size={12} className="spin" /> : <XCircle size={12} />}
                                  Dismiss
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
