import { doc, getDoc, onSnapshot, collection, query, where, orderBy, updateDoc, serverTimestamp } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  Building2,
  CheckCircle2,
  FlameKindling,
  History,
  Loader2,
  Send,
  ShieldCheck,
  Siren,
  Truck,
  XCircle,
} from 'lucide-react'
import { app, db } from '../../../config/firebase.js'
import { useToast } from '../../../shared/toast/toastContext.js'

// ── Module definitions the Super Admin can toggle ─────────────────────────────
const MODULE_DEFS = [
  {
    key: 'fleet',
    label: 'Fleet Management',
    desc: 'Vehicle tracking, inspections, fuel intelligence.',
    icon: Truck,
    color: '#7ab5ff',
  },
  {
    key: 'fire_extinguisher',
    label: 'Fire Extinguisher Safety',
    desc: 'Extinguisher registry, inspections and compliance.',
    icon: FlameKindling,
    color: '#ffb56e',
  },
  {
    key: 'fire_detection',
    label: 'Fire Detection & Alarms',
    desc: 'Detector registry, panels, inspections and compliance.',
    icon: Siren,
    color: '#ff9aa2',
  },
]

export function CompanyDetailPage() {
  const { companyId } = useParams()
  const navigate      = useNavigate()
  const { state }     = useLocation()
  const toast         = useToast()

  const [loading, setLoading]       = useState(true)
  const [company, setCompany]       = useState(state?.company || null)

  // Live module state from Firestore
  const [enabledModules, setEnabledModules] = useState([])
  const [saving, setSaving]                 = useState(false)

  // Pending requests from companies
  const [pendingRequests, setPendingRequests] = useState([])
  const [requestsLoading, setRequestsLoading] = useState(true)

  // ── Load company doc ────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    async function run() {
      if (company) {
        setLoading(false)
        setEnabledModules(Array.isArray(company.modules) ? company.modules : [])
        return
      }
      setLoading(true)
      try {
        const snap = await getDoc(doc(db, 'organizations', companyId)).catch(() => null)
        if (cancelled) return
        const data = snap?.exists?.() ? { id: snap.id, ...snap.data() } : null
        setCompany(data)
        setEnabledModules(Array.isArray(data?.modules) ? data.modules : [])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [company, companyId])

  // ── Live listen for modules changes ────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'organizations', companyId),
      (snap) => {
        if (snap.exists()) {
          setEnabledModules(Array.isArray(snap.data().modules) ? snap.data().modules : [])
        }
      },
      () => {},
    )
    return () => unsub()
  }, [companyId])

  // ── Live listen for pending module requests ─────────────────────
  useEffect(() => {
    setRequestsLoading(true)
    const q = query(
      collection(db, 'module_requests'),
      where('organizationId', '==', companyId),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc'),
    )
    const unsub = onSnapshot(
      q,
      (s) => {
        setPendingRequests(s.docs.map((d) => ({ id: d.id, ...d.data() })))
        setRequestsLoading(false)
      },
      () => setRequestsLoading(false),
    )
    return () => unsub()
  }, [companyId])

  // ── Toggle a module on/off locally ─────────────────────────────
  function toggleModule(key) {
    setEnabledModules((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    )
  }

  // ── Save modules to Firestore via Cloud Function ────────────────
  async function handleSaveModules() {
    setSaving(true)
    try {
      const functions = getFunctions(app)
      const updateFn  = httpsCallable(functions, 'updateCompanyModules')
      await updateFn({ organizationId: companyId, modules: enabledModules })
      toast.push({ type: 'success', title: 'Saved', message: 'Module access updated and company notified.' })
    } catch (err) {
      toast.push({ type: 'error', title: 'Failed', message: err?.message || 'Could not update modules.' })
    } finally {
      setSaving(false)
    }
  }

  // ── Grant access from a pending request ────────────────────────
  async function handleGrantFromRequest(req) {
    const key = req.moduleKey
    if (!key) return
    const newModules = enabledModules.includes(key) ? enabledModules : [...enabledModules, key]
    setSaving(true)
    try {
      const functions = getFunctions(app)
      const updateFn = httpsCallable(functions, 'updateCompanyModules')
      await updateFn({ organizationId: companyId, modules: newModules })
      setEnabledModules(newModules)
      await updateDoc(doc(db, 'module_requests', req.id), {
        status: 'granted',
        grantedAt: serverTimestamp(),
      })
      toast.push({ type: 'success', title: 'Access Granted', message: `${req.moduleLabel} enabled for ${company?.name}.` })
    } catch (err) {
      toast.push({ type: 'error', title: 'Failed', message: err?.message || 'Could not grant access.' })
    } finally {
      setSaving(false)
    }
  }

  // ── Dismiss a pending request ───────────────────────────────────
  async function handleDismissRequest(req) {
    try {
      await updateDoc(doc(db, 'module_requests', req.id), {
        status: 'dismissed',
        dismissedAt: serverTimestamp(),
      })
      toast.push({ type: 'success', title: 'Dismissed', message: 'Request dismissed.' })
    } catch (err) {
      toast.push({ type: 'error', title: 'Failed', message: err?.message || 'Could not dismiss request.' })
    }
  }

  // ── Render ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <section className="stack-gap">
        <article className="dashboard-card">Loading company…</article>
      </section>
    )
  }

  if (!company) {
    return (
      <section className="stack-gap">
        <article className="dashboard-card">Company not found.</article>
      </section>
    )
  }

  const name = company.name || company.companyName || '—'

  return (
    <section className="stack-gap">
      {/* ── Header ── */}
      <header className="card-head">
        <div>
          <h2>{name}</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted2)', fontFamily: 'monospace' }}>
            ID: {companyId}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            className="secondary-btn"
            onClick={() => navigate(`/company/${companyId}/billing-history`, { state: { company } })}
          >
            <History size={14} /> Billing History
          </button>
          <button
            type="button"
            className="primary-btn"
            onClick={() => navigate('/announcements', { state: { preselectCompany: { id: companyId, name } } })}
          >
            <Send size={14} /> Send Notification
          </button>
        </div>
      </header>

      {/* ── Plan ── */}
      <article className="dashboard-card">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span className="notify-section-ic"><Building2 size={14} /></span>
          <div>
            <p style={{ margin: 0, color: 'var(--muted2)', fontSize: 12 }}>Plan</p>
            <b style={{ fontSize: 16 }}>{company.plan || company.planName || '—'}</b>
          </div>
        </div>
      </article>

      {/* ── Pending Module Requests ── */}
      {pendingRequests.length > 0 && (
        <article className="dashboard-card">
          <div className="card-head" style={{ marginBottom: 14 }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
              Pending Module Requests
            </h2>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '3px 10px',
              borderRadius: 999, background: 'rgba(239,68,68,0.12)',
              color: '#f87171', border: '1px solid rgba(239,68,68,0.25)',
            }}>
              {pendingRequests.length} pending
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pendingRequests.map((req) => (
              <div key={req.id} style={{
                display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                gap: 14, padding: '14px 16px',
                border: '1px solid rgba(58,130,255,0.2)',
                background: 'rgba(58,130,255,0.06)',
                borderRadius: 10,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: '0 0 3px', fontWeight: 700, fontSize: 13.5, color: 'rgba(235,242,255,0.95)' }}>
                    {req.moduleLabel}
                  </p>
                  <p style={{ margin: '0 0 4px', fontSize: 12, color: 'rgba(148,163,184,0.8)' }}>
                    Requested by <strong>{req.requesterName}</strong> ({req.requesterEmail})
                  </p>
                  {req.message && (
                    <p style={{ margin: 0, fontSize: 12, color: 'rgba(148,163,184,0.65)', fontStyle: 'italic' }}>
                      "{req.message}"
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleGrantFromRequest(req)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '7px 14px', borderRadius: 8,
                      border: '1px solid rgba(22,201,136,0.3)',
                      background: 'rgba(22,201,136,0.1)', color: '#4deba0',
                      fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    <CheckCircle2 size={13} /> Grant
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleDismissRequest(req)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '7px 14px', borderRadius: 8,
                      border: '1px solid rgba(255,83,95,0.25)',
                      background: 'rgba(255,83,95,0.08)', color: '#ff9aa2',
                      fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    <XCircle size={13} /> Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        </article>
      )}

      {/* ── Module Access Toggles ── */}
      <article className="dashboard-card">
        <div className="card-head" style={{ marginBottom: 18 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Module Access</h2>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted2)' }}>
              Toggle which platform modules this company can access. Changes take effect immediately.
            </p>
          </div>
          <button
            type="button"
            className="primary-btn"
            disabled={saving}
            onClick={handleSaveModules}
            style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 120 }}
          >
            {saving
              ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</>
              : <><ShieldCheck size={14} /> Save Access</>
            }
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {MODULE_DEFS.map((mod) => {
            const Icon    = mod.icon
            const enabled = enabledModules.includes(mod.key)
            return (
              <div
                key={mod.key}
                onClick={() => toggleModule(mod.key)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && toggleModule(mod.key)}
                aria-pressed={enabled}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
                  border: enabled
                    ? `1px solid rgba(22,201,136,0.3)`
                    : '1px solid rgba(255,255,255,0.08)',
                  background: enabled
                    ? 'rgba(22,201,136,0.06)'
                    : 'rgba(255,255,255,0.02)',
                  transition: 'border-color 150ms, background 150ms',
                  userSelect: 'none',
                }}
              >
                {/* Module icon */}
                <div style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: enabled ? 'rgba(22,201,136,0.12)' : 'rgba(255,255,255,0.04)',
                  border: enabled ? '1px solid rgba(22,201,136,0.25)' : '1px solid rgba(255,255,255,0.07)',
                  color: enabled ? '#4deba0' : mod.color,
                  transition: 'background 150ms, border-color 150ms, color 150ms',
                }}>
                  <Icon size={18} />
                </div>

                {/* Label + desc */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: 'rgba(235,242,255,0.95)' }}>
                    {mod.label}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'rgba(148,163,184,0.7)' }}>
                    {mod.desc}
                  </p>
                </div>

                {/* Toggle switch */}
                <div style={{
                  position: 'relative', width: 44, height: 24, flexShrink: 0,
                  borderRadius: 999, cursor: 'pointer',
                  background: enabled ? '#16c988' : 'rgba(255,255,255,0.12)',
                  transition: 'background 200ms',
                }}>
                  <div style={{
                    position: 'absolute', top: 3,
                    left: enabled ? 23 : 3,
                    width: 18, height: 18, borderRadius: '50%',
                    background: '#fff',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
                    transition: 'left 200ms cubic-bezier(0.16,1,0.3,1)',
                  }} />
                </div>

                {/* Status badge */}
                <span style={{
                  fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em',
                  textTransform: 'uppercase', padding: '3px 9px', borderRadius: 999,
                  background: enabled ? 'rgba(22,201,136,0.12)' : 'rgba(255,255,255,0.04)',
                  border: enabled ? '1px solid rgba(22,201,136,0.25)' : '1px solid rgba(255,255,255,0.08)',
                  color: enabled ? '#4deba0' : 'rgba(148,163,184,0.6)',
                  minWidth: 60, textAlign: 'center',
                  transition: 'all 150ms',
                }}>
                  {enabled ? 'Active' : 'Off'}
                </span>
              </div>
            )
          })}
        </div>
      </article>
    </section>
  )
}
