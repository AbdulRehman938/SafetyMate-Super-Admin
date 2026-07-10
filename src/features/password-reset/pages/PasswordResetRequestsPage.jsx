import { useEffect, useState } from 'react'
import { collection, onSnapshot, orderBy, updateDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { Search, Mail, Clock, CheckCircle2, XCircle, Loader2, AlertCircle, X } from 'lucide-react'
import { db, app } from '../../../config/firebase.js'
import { useToast } from '../../../shared/toast/toastContext.js'

function timeAgo(val) {
  if (!val) return '—'
  const date = typeof val?.toDate === 'function' ? val.toDate() : new Date(val)
  if (isNaN(date)) return '—'
  const diff = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

const STATUS_META = {
  pending: { label: 'Pending', bg: 'rgba(58,130,255,0.1)', border: 'rgba(58,130,255,0.25)', color: '#7ab5ff' },
  sent: { label: 'Sent', bg: 'rgba(22,201,136,0.1)', border: 'rgba(22,201,136,0.25)', color: '#4deba0' },
  dismissed: { label: 'Dismissed', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.2)', color: 'rgba(148,163,184,0.7)' },
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

export function PasswordResetRequestsPage() {
  const toast = useToast()

  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState({})
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')

  useEffect(() => {
    setLoading(true)
    const q = query(collection(db, 'password_reset_requests'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q,
      (snap) => { setRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoading(false) },
      () => setLoading(false),
    )
    return () => unsub()
  }, [])

  const filtered = requests.filter((req) => {
    if (filterStatus !== 'all' && req.status !== filterStatus) return false
    if (search.trim()) {
      const s = search.toLowerCase()
      return (
        req.email?.toLowerCase().includes(s) ||
        req.fullName?.toLowerCase().includes(s) ||
        req.organizationId?.toLowerCase().includes(s)
      )
    }
    return true
  })

  const counts = {
    all: requests.length,
    pending: requests.filter((r) => r.status === 'pending').length,
    sent: requests.filter((r) => r.status === 'sent').length,
    dismissed: requests.filter((r) => r.status === 'dismissed').length,
  }

  async function handleSendReset(req) {
    setSaving((p) => ({ ...p, [req.id]: true }))
    try {
      await httpsCallable(getFunctions(app), 'sendPasswordResetEmail')({ requestId: req.id })
      toast.push({ type: 'success', title: 'Reset Email Sent', message: `Password reset link sent to ${req.email}.` })
    } catch (err) {
      toast.push({ type: 'error', title: 'Failed', message: err?.message || 'Could not send reset email.' })
    } finally {
      setSaving((p) => ({ ...p, [req.id]: false }))
    }
  }

  async function handleDismiss(req) {
    setSaving((p) => ({ ...p, [req.id]: true }))
    try {
      await updateDoc(doc(db, 'password_reset_requests', req.id), { 
        status: 'dismissed', 
        dismissedAt: serverTimestamp() 
      })
      toast.push({ type: 'success', title: 'Dismissed', message: 'Request dismissed.' })
    } catch (err) {
      toast.push({ type: 'error', title: 'Failed', message: err?.message || 'Could not dismiss.' })
    } finally {
      setSaving((p) => ({ ...p, [req.id]: false }))
    }
  }

  async function handleDelete(req) {
    if (!confirm('Are you sure you want to delete this request?')) return
    setSaving((p) => ({ ...p, [req.id]: true }))
    try {
      await deleteDoc(doc(db, 'password_reset_requests', req.id))
      toast.push({ type: 'success', title: 'Deleted', message: 'Request deleted.' })
    } catch (err) {
      toast.push({ type: 'error', title: 'Failed', message: err?.message || 'Could not delete.' })
    } finally {
      setSaving((p) => ({ ...p, [req.id]: false }))
    }
  }

  return (
    <section className="stack-gap">
      <div className="dash-title-wrap">
        <p className="subtle" style={{ margin:'0 0 4px', fontSize:11, letterSpacing:'0.1em', color:'var(--muted2)', textTransform:'uppercase' }}>SUPER ADMIN / PASSWORD RESETS</p>
        <h1 style={{ margin:0, fontSize:'1.55rem', fontWeight:800, letterSpacing:'-0.02em', color:'rgba(235,242,255,0.97)' }}>Password Reset Requests</h1>
        <p style={{ margin:'6px 0 0', fontSize:13, color:'var(--muted2)' }}>Manage password reset requests from company users.</p>
      </div>

      {/* KPI cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:12 }}>
        {[{ key:'all', label:'Total Requests', color:'#7ab5ff' },{ key:'pending', label:'Pending', color:'#f59e0b' },{ key:'sent', label:'Sent', color:'#4deba0' },{ key:'dismissed', label:'Dismissed', color:'rgba(148,163,184,0.7)' }].map(({ key, label, color }) => (
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
            <input type="text" placeholder="Search email, name, organization…" value={search} onChange={(e) => setSearch(e.target.value)}
              style={{ width:'100%', height:38, paddingLeft:36, paddingRight:12, border:'1px solid var(--border)', borderRadius:10, background:'var(--inputBg)', color:'var(--text)', font:'inherit', fontSize:13, outline:'none', boxSizing:'border-box' }} />
          </div>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
            style={{ height:38, padding:'0 12px', border:'1px solid var(--border)', borderRadius:10, background:'var(--inputBg)', color:'var(--text)', font:'inherit', fontSize:13, outline:'none', cursor:'pointer' }}>
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="sent">Sent</option>
            <option value="dismissed">Dismissed</option>
          </select>
          <span style={{ fontSize:12, color:'var(--muted2)', marginLeft:'auto', whiteSpace:'nowrap' }}>{filtered.length} request{filtered.length!==1?'s':''}</span>
        </div>
      </div>

      {/* Request list */}
      {loading ? (
        <div style={{ display:'flex', justifyContent:'center', padding:40, color:'var(--muted2)' }}><Loader2 size={24} className="spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="dashboard-card" style={{ padding:40, textAlign:'center', color:'var(--muted2)' }}>
          <Mail size={32} style={{ marginBottom:12, opacity:0.5 }} />
          <p>No password reset requests found.</p>
        </div>
      ) : (
        <div className="dashboard-card" style={{ padding:0 }}>
          <div style={{ display:'flex', flexDirection:'column' }}>
            {filtered.map((req) => {
              const isSaving = saving[req.id]
              return (
                <div key={req.id} style={{ 
                  display:'flex', alignItems:'center', gap:12, padding:'16px', 
                  borderBottom: filtered.length > 1 ? '1px solid var(--border)' : 'none',
                  ':last-child': { borderBottom: 'none' }
                }}>
                  <div style={{ flex:'0 0 auto', width:40, height:40, borderRadius:10, background:'rgba(58,130,255,0.1)', border:'1px solid rgba(58,130,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <Mail size={18} style={{ color:'#7ab5ff' }} />
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4, flexWrap:'wrap' }}>
                      <span style={{ fontSize:14, fontWeight:600, color:'rgba(235,242,255,0.95)' }}>{req.fullName || 'Unknown'}</span>
                      <StatusPill status={req.status} />
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:12, fontSize:12, color:'var(--muted2)' }}>
                      <span>{req.email}</span>
                      <span>•</span>
                      <span>{req.organizationId}</span>
                      <span>•</span>
                      <span style={{ display:'flex', alignItems:'center', gap:4 }}>
                        <Clock size={12} /> {timeAgo(req.createdAt)}
                      </span>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                    {req.status === 'pending' && (
                      <>
                        <button type="button" disabled={isSaving} onClick={() => handleSendReset(req)}
                          style={{ display:'flex', alignItems:'center', gap:5, padding:'8px 14px', borderRadius:7, border:'1px solid rgba(22,201,136,0.3)', background:'rgba(22,201,136,0.15)', color:'#4deba0', fontSize:12, fontWeight:600, cursor:isSaving?'not-allowed':'pointer', opacity:isSaving?0.6:1 }}>
                          {isSaving ? <Loader2 size={12} className="spin" /> : <CheckCircle2 size={12} />} Send Reset Link
                        </button>
                        <button type="button" disabled={isSaving} onClick={() => handleDismiss(req)}
                          style={{ display:'flex', alignItems:'center', gap:5, padding:'8px 14px', borderRadius:7, border:'1px solid rgba(239,68,68,0.3)', background:'rgba(239,68,68,0.1)', color:'#f87171', fontSize:12, fontWeight:600, cursor:isSaving?'not-allowed':'pointer', opacity:isSaving?0.6:1 }}>
                          {isSaving ? <Loader2 size={12} className="spin" /> : <XCircle size={12} />} Dismiss
                        </button>
                      </>
                    )}
                    {req.status === 'sent' && (
                      <button type="button" disabled={isSaving} onClick={() => handleSendReset(req)}
                        style={{ display:'flex', alignItems:'center', gap:5, padding:'8px 14px', borderRadius:7, border:'1px solid rgba(58,130,255,0.3)', background:'rgba(58,130,255,0.1)', color:'#7ab5ff', fontSize:12, fontWeight:600, cursor:isSaving?'not-allowed':'pointer', opacity:isSaving?0.6:1 }}>
                        {isSaving ? <Loader2 size={12} className="spin" /> : <Mail size={12} />} Resend
                      </button>
                    )}
                    <button type="button" disabled={isSaving} onClick={() => handleDelete(req)}
                      style={{ display:'flex', alignItems:'center', gap:5, padding:'8px 10px', borderRadius:7, border:'1px solid rgba(148,163,184,0.2)', background:'rgba(148,163,184,0.05)', color:'var(--muted)', fontSize:12, cursor:isSaving?'not-allowed':'pointer', opacity:isSaving?0.6:1 }}>
                      {isSaving ? <Loader2 size={12} className="spin" /> : <X size={12} />}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
