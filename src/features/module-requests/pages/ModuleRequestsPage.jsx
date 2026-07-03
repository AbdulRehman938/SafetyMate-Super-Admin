import { useEffect, useState, useMemo } from 'react'
import {
  collection, doc, onSnapshot, orderBy,
  query, updateDoc, serverTimestamp, getDoc,
} from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import {
  CheckCircle2, XCircle, Search, Flame, Siren, Truck,
  LayoutGrid, ChevronDown, ChevronRight, Loader2,
  PauseCircle, PlayCircle, AlertTriangle, X, Clock,
} from 'lucide-react'
import { db, app } from '../../../config/firebase.js'
import { useToast } from '../../../shared/toast/toastContext.js'

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

const PAUSE_PRESETS = [
  { label: '1 Day',    days: 1  },
  { label: '3 Days',   days: 3  },
  { label: '7 Days',   days: 7  },
  { label: '14 Days',  days: 14 },
  { label: '30 Days',  days: 30 },
  { label: 'Custom',   days: null },
]

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

function formatDate(date) {
  if (!date) return ''
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function isPauseActive(until) {
  if (!until) return false
  const d = typeof until?.toDate === 'function' ? until.toDate() : new Date(until)
  return d > new Date()
}

function StatusPill({ status }) {
  const m = STATUS_META[status] || STATUS_META.pending
  return (
    <span style={{ display:'inline-flex', alignItems:'center', padding:'3px 10px', borderRadius:999,
      fontSize:11, fontWeight:700, letterSpacing:'0.05em', textTransform:'uppercase',
      background:m.bg, border:`1px solid ${m.border}`, color:m.color, whiteSpace:'nowrap' }}>
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
  if (!plan) return <span style={{ fontSize:12, color:'var(--muted2)' }}>…</span>
  return (
    <span style={{ display:'inline-flex', padding:'3px 10px', borderRadius:999,
      fontSize:11.5, fontWeight:600, border:'1px solid rgba(255,255,255,0.1)',
      background:'rgba(255,255,255,0.04)', color:'rgba(235,242,255,0.85)', whiteSpace:'nowrap' }}>
      {plan}
    </span>
  )
}

function groupAndDedupe(requests) {
  const orgMap = {}
  for (const req of requests) {
    const orgId = req.organizationId
    if (!orgId) continue
    if (!orgMap[orgId]) {
      orgMap[orgId] = { organizationId: orgId, organizationName: req.organizationName || orgId, latestAt: req.createdAt, moduleMap: {} }
    }
    const entry = orgMap[orgId]
    const reqTime = typeof req.createdAt?.toDate === 'function' ? req.createdAt.toDate().getTime() : new Date(req.createdAt || 0).getTime()
    const curTime = typeof entry.latestAt?.toDate === 'function' ? entry.latestAt.toDate().getTime() : new Date(entry.latestAt || 0).getTime()
    if (reqTime > curTime) entry.latestAt = req.createdAt
    const existing = entry.moduleMap[req.moduleKey]
    if (!existing) { entry.moduleMap[req.moduleKey] = req }
    else {
      const existTime = typeof existing.createdAt?.toDate === 'function' ? existing.createdAt.toDate().getTime() : new Date(existing.createdAt || 0).getTime()
      if (reqTime > existTime) entry.moduleMap[req.moduleKey] = req
    }
  }
  return Object.values(orgMap)
    .map((entry) => ({
      ...entry,
      modules: Object.values(entry.moduleMap).sort((a, b) => {
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

// ── Confirmation Modal (Revoke) ───────────────────────────────────────────────
function ConfirmRevokeModal({ req, onConfirm, onCancel, saving }) {
  const meta = MODULE_META[req.moduleKey] || { label: req.moduleLabel, color: '#ff9aa2' }
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(4,8,20,0.78)', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:600, padding:20 }}>
      <div style={{ background:'linear-gradient(180deg,rgba(14,20,42,0.98),rgba(9,13,28,0.98))', border:'1px solid rgba(255,255,255,0.1)', borderRadius:16, width:'100%', maxWidth:420, padding:28, boxShadow:'0 24px 64px rgba(0,0,0,0.6)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
          <div style={{ width:42, height:42, borderRadius:10, background:'rgba(255,83,95,0.12)', border:'1px solid rgba(255,83,95,0.25)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <AlertTriangle size={20} style={{ color:'#ff9aa2' }} />
          </div>
          <div>
            <p style={{ margin:0, fontSize:15, fontWeight:700, color:'rgba(235,242,255,0.97)' }}>Revoke Module Access</p>
            <p style={{ margin:'3px 0 0', fontSize:12, color:'var(--muted2)' }}>{req.organizationName}</p>
          </div>
        </div>
        <p style={{ margin:'0 0 22px', fontSize:13, color:'rgba(148,163,184,0.85)', lineHeight:1.6 }}>
          This will remove <strong style={{ color: meta.color }}>{meta.label}</strong> access from <strong style={{ color:'rgba(235,242,255,0.9)' }}>{req.organizationName}</strong> immediately. The company will be notified and the module will appear as locked in their dashboard.
        </p>
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button type="button" onClick={onCancel} style={{ padding:'8px 18px', borderRadius:8, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.04)', color:'var(--muted)', fontSize:13, fontWeight:600, cursor:'pointer' }}>
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={saving}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 18px', borderRadius:8, border:'1px solid rgba(255,83,95,0.35)', background:'rgba(255,83,95,0.15)', color:'#ff9aa2', fontSize:13, fontWeight:700, cursor:saving?'not-allowed':'pointer', opacity:saving?0.6:1 }}>
            {saving ? <Loader2 size={13} className="spin" /> : <XCircle size={13} />}
            Revoke Access
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Pause Modal (Access or Requests) ─────────────────────────────────────────
function PauseModal({ type, req, org, onConfirm, onCancel, saving }) {
  const [preset, setPreset] = useState(7)
  const [customDate, setCustomDate] = useState('')
  const [reason, setReason] = useState('')
  const isCustom = preset === null
  const isRequests = type === 'requests'
  const label = isRequests ? 'Module Requests' : (MODULE_META[req?.moduleKey]?.label || req?.moduleLabel || 'Module')

  function getUntilDate() {
    if (isCustom) return customDate ? new Date(customDate).toISOString() : null
    const d = new Date()
    d.setDate(d.getDate() + preset)
    return d.toISOString()
  }

  const untilDate = getUntilDate()
  const canSubmit = isCustom ? !!customDate : !!preset

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(4,8,20,0.78)', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:600, padding:20 }}>
      <div style={{ background:'linear-gradient(180deg,rgba(14,20,42,0.98),rgba(9,13,28,0.98))', border:'1px solid rgba(255,255,255,0.1)', borderRadius:16, width:'100%', maxWidth:460, padding:28, boxShadow:'0 24px 64px rgba(0,0,0,0.6)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <PauseCircle size={20} style={{ color:'#fbbf24' }} />
            <p style={{ margin:0, fontSize:15, fontWeight:700, color:'rgba(235,242,255,0.97)' }}>
              Pause {isRequests ? 'Requests' : 'Module Access'}
            </p>
          </div>
          <button type="button" onClick={onCancel} style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer' }}><X size={16} /></button>
        </div>
        <p style={{ margin:'0 0 16px', fontSize:13, color:'rgba(148,163,184,0.8)', lineHeight:1.55 }}>
          {isRequests
            ? `Temporarily block <strong>${org?.organizationName}</strong> from submitting new module requests.`
            : `Temporarily pause <strong>${label}</strong> access for <strong>${org?.organizationName || req?.organizationName}</strong>.`
          }
        </p>

        <p style={{ margin:'0 0 8px', fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'rgba(148,163,184,0.6)' }}>Duration</p>
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:14 }}>
          {PAUSE_PRESETS.map((p) => (
            <button key={p.label} type="button"
              onClick={() => { setPreset(p.days); setCustomDate('') }}
              style={{ padding:'6px 14px', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer', border: preset===p.days ? '1px solid rgba(251,191,36,0.45)' : '1px solid rgba(255,255,255,0.1)', background: preset===p.days ? 'rgba(251,191,36,0.12)' : 'rgba(255,255,255,0.04)', color: preset===p.days ? '#fbbf24' : 'rgba(148,163,184,0.8)' }}>
              {p.label}
            </button>
          ))}
        </div>

        {isCustom && (
          <input type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)} min={new Date().toISOString().split('T')[0]}
            style={{ width:'100%', height:38, padding:'0 12px', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, background:'var(--inputBg)', color:'var(--text)', font:'inherit', fontSize:13, outline:'none', marginBottom:12, boxSizing:'border-box' }} />
        )}

        <p style={{ margin:'0 0 8px', fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'rgba(148,163,184,0.6)' }}>Reason (optional)</p>
        <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Subscription expired, under review…"
          style={{ width:'100%', height:38, padding:'0 12px', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, background:'var(--inputBg)', color:'var(--text)', font:'inherit', fontSize:13, outline:'none', marginBottom:18, boxSizing:'border-box' }} />

        {untilDate && (
          <div style={{ display:'flex', alignItems:'center', gap:7, padding:'10px 14px', borderRadius:8, background:'rgba(251,191,36,0.08)', border:'1px solid rgba(251,191,36,0.2)', marginBottom:18, fontSize:12.5, color:'rgba(251,191,36,0.9)' }}>
            <Clock size={13} /> Pause will lift on <strong>{formatDate(untilDate)}</strong>
          </div>
        )}

        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button type="button" onClick={onCancel} style={{ padding:'8px 18px', borderRadius:8, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.04)', color:'var(--muted)', fontSize:13, fontWeight:600, cursor:'pointer' }}>
            Cancel
          </button>
          <button type="button" disabled={saving || !canSubmit} onClick={() => onConfirm({ until: untilDate, reason })}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 18px', borderRadius:8, border:'1px solid rgba(251,191,36,0.3)', background:'rgba(251,191,36,0.12)', color:'#fbbf24', fontSize:13, fontWeight:700, cursor:saving||!canSubmit?'not-allowed':'pointer', opacity:saving||!canSubmit?0.6:1 }}>
            {saving ? <Loader2 size={13} className="spin" /> : <PauseCircle size={13} />} Apply Pause
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function ModuleRequestsPage() {
  const toast = useToast()

  const [requests, setRequests]   = useState([])
  const [orgs, setOrgs]           = useState({}) // { [orgId]: orgDoc }
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState({})
  const [expanded, setExpanded]   = useState({})

  const [search, setSearch]             = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterModule, setFilterModule] = useState('all')

  // Modal state
  const [confirmRevoke, setConfirmRevoke]   = useState(null)  // req object
  const [pauseModal, setPauseModal]         = useState(null)  // { type, req?, org }

  // Live requests feed
  useEffect(() => {
    setLoading(true)
    const q = query(collection(db, 'module_requests'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q,
      (snap) => { setRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoading(false) },
      () => setLoading(false),
    )
    return () => unsub()
  }, [])

  // Live org docs feed (for pause state)
  useEffect(() => {
    if (requests.length === 0) return
    const orgIds = [...new Set(requests.map((r) => r.organizationId).filter(Boolean))]
    const unsubs = orgIds.map((orgId) =>
      onSnapshot(doc(db, 'organizations', orgId), (snap) => {
        if (snap.exists()) setOrgs((p) => ({ ...p, [orgId]: { id: snap.id, ...snap.data() } }))
      }, () => {})
    )
    return () => unsubs.forEach((u) => u())
  }, [requests.length])

  const grouped = useMemo(() => {
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

  const counts = useMemo(() => ({
    all:       requests.length,
    pending:   requests.filter((r) => r.status === 'pending').length,
    granted:   requests.filter((r) => r.status === 'granted').length,
    dismissed: requests.filter((r) => r.status === 'dismissed').length,
  }), [requests])

  function toggleExpand(orgId) { setExpanded((p) => ({ ...p, [orgId]: !p[orgId] })) }

  async function handleGrant(req) {
    setSaving((p) => ({ ...p, [req.id]: true }))
    try {
      const orgSnap = await getDoc(doc(db, 'organizations', req.organizationId))
      const cur = Array.isArray(orgSnap.data()?.modules) ? orgSnap.data().modules : []
      const next = cur.includes(req.moduleKey) ? cur : [...cur, req.moduleKey]
      await httpsCallable(getFunctions(app), 'updateCompanyModules')({ organizationId: req.organizationId, modules: next })
      await updateDoc(doc(db, 'module_requests', req.id), { status: 'granted', grantedAt: serverTimestamp() })
      toast.push({ type: 'success', title: 'Access Granted', message: `${req.moduleLabel} enabled for ${req.organizationName}.` })
    } catch (err) {
      toast.push({ type: 'error', title: 'Failed', message: err?.message || 'Could not grant.' })
    } finally {
      setSaving((p) => ({ ...p, [req.id]: false }))
    }
  }

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

  async function handleRevoke(req) {
    setSaving((p) => ({ ...p, [req.id]: true }))
    try {
      const orgSnap = await getDoc(doc(db, 'organizations', req.organizationId))
      const cur = Array.isArray(orgSnap.data()?.modules) ? orgSnap.data().modules : []
      const next = cur.filter((k) => k !== req.moduleKey)
      await httpsCallable(getFunctions(app), 'updateCompanyModules')({ organizationId: req.organizationId, modules: next })
      await updateDoc(doc(db, 'module_requests', req.id), { status: 'dismissed', revokedAt: serverTimestamp() })
      toast.push({ type: 'success', title: 'Access Revoked', message: `${req.moduleLabel} removed from ${req.organizationName}.` })
    } catch (err) {
      toast.push({ type: 'error', title: 'Failed', message: err?.message || 'Could not revoke.' })
    } finally {
      setSaving((p) => ({ ...p, [req.id]: false }))
      setConfirmRevoke(null)
    }
  }

  async function handlePause({ until, reason }) {
    if (!pauseModal) return
    const { type, req, org } = pauseModal
    const orgId = org?.organizationId || req?.organizationId
    const moduleKey = req?.moduleKey
    const savingKey = `pause-${orgId}-${moduleKey || 'requests'}`
    setSaving((p) => ({ ...p, [savingKey]: true }))
    try {
      await httpsCallable(getFunctions(app), 'updateCompanyPause')({
        organizationId: orgId, type, moduleKey: moduleKey || '', until, reason,
      })
      toast.push({ type: 'success', title: 'Pause Applied', message: `Pause set until ${formatDate(until)}.` })
      setPauseModal(null)
    } catch (err) {
      toast.push({ type: 'error', title: 'Failed', message: err?.message || 'Could not apply pause.' })
    } finally {
      setSaving((p) => ({ ...p, [savingKey]: false }))
    }
  }

  async function handleLiftPause(type, orgId, moduleKey) {
    const savingKey = `lift-${orgId}-${moduleKey || 'requests'}`
    setSaving((p) => ({ ...p, [savingKey]: true }))
    try {
      await httpsCallable(getFunctions(app), 'updateCompanyPause')({
        organizationId: orgId, type, moduleKey: moduleKey || '', until: null, reason: '',
      })
      toast.push({ type: 'success', title: 'Pause Lifted', message: 'Access restored immediately.' })
    } catch (err) {
      toast.push({ type: 'error', title: 'Failed', message: err?.message || 'Could not lift pause.' })
    } finally {
      setSaving((p) => ({ ...p, [savingKey]: false }))
    }
  }

  return (
    <section className="stack-gap">
      <div className="dash-title-wrap">
        <p className="subtle" style={{ margin:'0 0 4px', fontSize:11, letterSpacing:'0.1em', color:'var(--muted2)', textTransform:'uppercase' }}>SUPER ADMIN / MODULE REQUESTS</p>
        <h1 style={{ margin:0, fontSize:'1.55rem', fontWeight:800, letterSpacing:'-0.02em', color:'rgba(235,242,255,0.97)' }}>Module Access Requests</h1>
        <p style={{ margin:'6px 0 0', fontSize:13, color:'var(--muted2)' }}>One row per company — expand to manage module access, pause and revoke.</p>
      </div>

      {/* KPI cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:12 }}>
        {[{ key:'all', label:'Total Requests', color:'#7ab5ff' },{ key:'pending', label:'Pending', color:'#f59e0b' },{ key:'granted', label:'Granted', color:'#4deba0' },{ key:'dismissed', label:'Dismissed', color:'rgba(148,163,184,0.7)' }].map(({ key, label, color }) => (
          <button key={key} type="button" onClick={() => setFilterStatus(key === filterStatus ? 'all' : key)}
            style={{ display:'flex', flexDirection:'column', gap:6, padding:'16px 18px', borderRadius:12, textAlign:'left', cursor:'pointer', border: filterStatus===key ? '1px solid rgba(58,130,255,0.35)' : '1px solid var(--border)', background: filterStatus===key ? 'rgba(58,130,255,0.08)' : 'linear-gradient(180deg,var(--surface),var(--surface2))', transition:'border-color 150ms, background 150ms' }}>
            <span style={{ fontSize:11, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--muted2)' }}>{label}</span>
            <span style={{ fontSize:'2rem', fontWeight:800, letterSpacing:'-0.03em', lineHeight:1, color }}>{loading ? '—' : counts[key]}</span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="dashboard-card" style={{ padding:'14px 16px' }}>
        <div style={{ display:'flex', flexWrap:'wrap', gap:10, alignItems:'center' }}>
          <div style={{ position:'relative', flex:'1 1 220px', minWidth:0 }}>
            <Search size={14} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--muted2)', pointerEvents:'none' }} />
            <input type="text" placeholder="Search company, requester, module…" value={search} onChange={(e) => setSearch(e.target.value)}
              style={{ width:'100%', height:38, paddingLeft:36, paddingRight:12, border:'1px solid var(--border)', borderRadius:10, background:'var(--inputBg)', color:'var(--text)', font:'inherit', fontSize:13, outline:'none', boxSizing:'border-box' }} />
          </div>
          {[{ val:filterModule, set:setFilterModule, opts:[['all','All Modules'],['fleet','Fleet'],['fire_extinguisher','Fire Extinguisher'],['fire_detection','Fire Detection']] },
            { val:filterStatus, set:setFilterStatus, opts:[['all','All Statuses'],['pending','Pending'],['granted','Granted'],['dismissed','Dismissed']] }
          ].map(({ val, set, opts }, i) => (
            <select key={i} value={val} onChange={(e) => set(e.target.value)}
              style={{ height:38, padding:'0 12px', border:'1px solid var(--border)', borderRadius:10, background:'var(--inputBg)', color:'var(--text)', font:'inherit', fontSize:13, outline:'none', cursor:'pointer' }}>
              {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          ))}
          <span style={{ fontSize:12, color:'var(--muted2)', marginLeft:'auto', whiteSpace:'nowrap' }}>{grouped.length} compan{grouped.length!==1?'ies':'y'}</span>
        </div>
      </div>

      {/* Company rows */}
      {loading ? (
        <div style={{ display:'flex', justifyContent:'center', padding:40, color:'var(--muted2)' }}><Loader2 size={24} className="spin" /></div>
      ) : grouped.length === 0 ? (
        <div className="dashboard-card" style={{ padding:40, textAlign:'center', color:'var(--muted2)' }}>
          <LayoutGrid size={32} style={{ marginBottom:12, opacity:0.5 }} />
          <p>No module access requests found.</p>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {grouped.map((org) => {
            const isExpanded = expanded[org.organizationId]
            const orgLive = orgs[org.organizationId]
            const reqPaused = isPauseActive(orgLive?.requestsPausedUntil)
            const reqPausedUntil = orgLive?.requestsPausedUntil

            return (
              <div key={org.organizationId} className="dashboard-card" style={{ overflow:'hidden' }}>
                {/* Company header row */}
                <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 16px' }}>
                  <button type="button" onClick={() => toggleExpand(org.organizationId)}
                    style={{ background:'none', border:'none', cursor:'pointer', color:'var(--muted)', flexShrink:0, display:'flex', padding:4 }}>
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                  <button type="button" onClick={() => toggleExpand(org.organizationId)}
                    style={{ flex:1, background:'none', border:'none', cursor:'pointer', textAlign:'left', minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2, flexWrap:'wrap' }}>
                      <span style={{ fontSize:14, fontWeight:600, color:'rgba(235,242,255,0.95)' }}>{org.organizationName}</span>
                      <OrgPlanCell organizationId={org.organizationId} />
                      {reqPaused && (
                        <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 8px', borderRadius:999, background:'rgba(251,191,36,0.1)', border:'1px solid rgba(251,191,36,0.25)', color:'#fbbf24', fontSize:10.5, fontWeight:700 }}>
                          <PauseCircle size={10} /> Requests Paused {reqPausedUntil ? `until ${formatDate(typeof reqPausedUntil.toDate==='function'?reqPausedUntil.toDate():reqPausedUntil)}` : ''}
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize:12, color:'var(--muted2)' }}>{org.organizationId} • {org.modules.length} module{org.modules.length!==1?'s':''} • {timeAgo(org.latestAt)}</span>
                  </button>
                  {/* Company-level: Pause Requests button */}
                  {reqPaused ? (
                    <button type="button" disabled={saving[`lift-${org.organizationId}-requests`]}
                      onClick={() => handleLiftPause('requests', org.organizationId, null)}
                      style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:7, border:'1px solid rgba(22,201,136,0.3)', background:'rgba(22,201,136,0.1)', color:'#4deba0', fontSize:11.5, fontWeight:600, cursor:'pointer', flexShrink:0 }}>
                      <PlayCircle size={12} /> Lift Request Pause
                    </button>
                  ) : (
                    <button type="button"
                      onClick={() => setPauseModal({ type:'requests', org })}
                      style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:7, border:'1px solid rgba(251,191,36,0.25)', background:'rgba(251,191,36,0.08)', color:'#fbbf24', fontSize:11.5, fontWeight:600, cursor:'pointer', flexShrink:0 }}>
                      <PauseCircle size={12} /> Pause Requests
                    </button>
                  )}
                </div>

                {/* Expanded module rows */}
                {isExpanded && (
                  <div style={{ borderTop:'1px solid var(--border)', padding:'12px 16px', background:'rgba(0,0,0,0.15)' }}>
                    {org.modules.map((req) => {
                      const meta = MODULE_META[req.moduleKey] || { label: req.moduleLabel, icon: LayoutGrid, color: '#7ab5ff' }
                      const ModuleIcon = meta.icon
                      const isSaving = saving[req.id]
                      const modPaused = isPauseActive(orgLive?.pausedModules?.[req.moduleKey]?.until)
                      const modPausedUntil = orgLive?.pausedModules?.[req.moduleKey]?.until
                      const savingLiftKey = `lift-${req.organizationId}-${req.moduleKey}`

                      return (
                        <div key={req.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 12px', marginBottom:8, borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
                          <div style={{ flex:'0 0 auto', width:32, height:32, borderRadius:8, background:`${meta.color}20`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                            <ModuleIcon size={16} style={{ color:meta.color }} />
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2, flexWrap:'wrap' }}>
                              <span style={{ fontSize:13, fontWeight:600, color:'rgba(235,242,255,0.9)' }}>{meta.label}</span>
                              <StatusPill status={req.status} />
                              {modPaused && (
                                <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 8px', borderRadius:999, background:'rgba(251,191,36,0.1)', border:'1px solid rgba(251,191,36,0.25)', color:'#fbbf24', fontSize:10.5, fontWeight:700 }}>
                                  <PauseCircle size={10} /> Access Paused {modPausedUntil ? `until ${formatDate(typeof modPausedUntil.toDate==='function'?modPausedUntil.toDate():modPausedUntil)}` : ''}
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize:12, color:'var(--muted2)' }}>{req.requesterName} • {req.requesterEmail} • {timeAgo(req.createdAt)}</span>
                          </div>
                          <div style={{ display:'flex', gap:6, flexShrink:0, flexWrap:'wrap' }}>
                            {req.status === 'pending' && (
                              <>
                                <button type="button" disabled={isSaving} onClick={() => handleGrant(req)}
                                  style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 11px', borderRadius:6, border:'1px solid rgba(22,201,136,0.3)', background:'rgba(22,201,136,0.15)', color:'#4deba0', fontSize:12, fontWeight:600, cursor:isSaving?'not-allowed':'pointer', opacity:isSaving?0.6:1 }}>
                                  {isSaving ? <Loader2 size={11} className="spin" /> : <CheckCircle2 size={11} />} Grant
                                </button>
                                <button type="button" disabled={isSaving} onClick={() => handleDismiss(req)}
                                  style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 11px', borderRadius:6, border:'1px solid rgba(239,68,68,0.3)', background:'rgba(239,68,68,0.1)', color:'#f87171', fontSize:12, fontWeight:600, cursor:isSaving?'not-allowed':'pointer', opacity:isSaving?0.6:1 }}>
                                  {isSaving ? <Loader2 size={11} className="spin" /> : <XCircle size={11} />} Dismiss
                                </button>
                              </>
                            )}
                            {req.status === 'granted' && (
                              <>
                                {modPaused ? (
                                  <button type="button" disabled={saving[savingLiftKey]} onClick={() => handleLiftPause('module_access', req.organizationId, req.moduleKey)}
                                    style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 11px', borderRadius:6, border:'1px solid rgba(22,201,136,0.3)', background:'rgba(22,201,136,0.1)', color:'#4deba0', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                                    {saving[savingLiftKey] ? <Loader2 size={11} className="spin" /> : <PlayCircle size={11} />} Lift Pause
                                  </button>
                                ) : (
                                  <button type="button" onClick={() => setPauseModal({ type:'module_access', req, org })}
                                    style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 11px', borderRadius:6, border:'1px solid rgba(251,191,36,0.25)', background:'rgba(251,191,36,0.08)', color:'#fbbf24', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                                    <PauseCircle size={11} /> Pause Access
                                  </button>
                                )}
                                <button type="button" disabled={isSaving} onClick={() => setConfirmRevoke(req)}
                                  style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 11px', borderRadius:6, border:'1px solid rgba(239,68,68,0.3)', background:'rgba(239,68,68,0.1)', color:'#f87171', fontSize:12, fontWeight:600, cursor:isSaving?'not-allowed':'pointer', opacity:isSaving?0.6:1 }}>
                                  {isSaving ? <Loader2 size={11} className="spin" /> : <XCircle size={11} />} Revoke
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

      {/* Confirmation modal for Revoke */}
      {confirmRevoke && (
        <ConfirmRevokeModal req={confirmRevoke} saving={!!saving[confirmRevoke.id]}
          onConfirm={() => handleRevoke(confirmRevoke)} onCancel={() => setConfirmRevoke(null)} />
      )}

      {/* Pause modal */}
      {pauseModal && (
        <PauseModal type={pauseModal.type} req={pauseModal.req} org={pauseModal.org}
          saving={!!saving[`pause-${pauseModal.org?.organizationId||pauseModal.req?.organizationId}-${pauseModal.req?.moduleKey||'requests'}`]}
          onConfirm={handlePause} onCancel={() => setPauseModal(null)} />
      )}
    </section>
  )
}
