import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Gauge, Droplets, ShieldCheck, Lock,
  Camera, X, CheckCircle, XCircle, Save, Users,
} from 'lucide-react'
import { useFireExtData } from '../hooks/useFireExtData.js'
import { useAuth } from '../../../app/providers/authContext.js'
import '../fe.css'

/* ─────────────────────────────────────────────────────────────
   Checklist definition — matches Figma exactly
───────────────────────────────────────────────────────────── */
const CHECKLIST = [
  {
    id: 'pressure_gauge',
    icon: Gauge,
    title: 'Pressure Gauge Status',
    desc: 'Verify needle is within the green operative zone.',
  },
  {
    id: 'damage_leak',
    icon: Droplets,
    title: 'Damage/Leak Audit',
    desc: 'Visual inspection for structural integrity and gas leaks.',
  },
  {
    id: 'tamper_seal',
    icon: ShieldCheck,
    title: 'Tamper Seal Integrity',
    desc: 'Ensure standard security seal is unbroken and dated.',
  },
  {
    id: 'pin_security',
    icon: Lock,
    title: 'Pin Security',
    desc: 'Confirm locking pin is fully seated and safety pull is taut.',
  },
]

/* ─────────────────────────────────────────────────────────────
   Live session timer  HH:MM:SS
───────────────────────────────────────────────────────────── */
function SessionTimer() {
  const [secs, setSecs] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setSecs((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [])
  const h = String(Math.floor(secs / 3600)).padStart(2, '0')
  const m = String(Math.floor((secs % 3600) / 60)).padStart(2, '0')
  const s = String(secs % 60).padStart(2, '0')
  return (
    <div style={{ textAlign: 'right' }}>
      <p style={{ margin: '0 0 2px', fontSize: 9, fontWeight: 800, color: 'rgba(148,163,184,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        CURRENT SESSION
      </p>
      <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#3a82ff', letterSpacing: '0.08em', fontFamily: 'monospace' }}>
        {h}:{m}:{s}
      </p>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   Digital Signature canvas
───────────────────────────────────────────────────────────── */
function SignatureCanvas({ onSign, onClear, signed }) {
  const canvasRef = useRef(null)
  const drawing   = useRef(false)
  const lastPos   = useRef(null)

  function getPos(e) {
    const rect = canvasRef.current.getBoundingClientRect()
    const src  = e.touches ? e.touches[0] : e
    return {
      x: (src.clientX - rect.left) * (canvasRef.current.width  / rect.width),
      y: (src.clientY - rect.top)  * (canvasRef.current.height / rect.height),
    }
  }
  function start(e) { e.preventDefault(); drawing.current = true; lastPos.current = getPos(e) }
  function draw(e) {
    e.preventDefault()
    if (!drawing.current) return
    const ctx = canvasRef.current.getContext('2d')
    const pos = getPos(e)
    ctx.strokeStyle = 'rgba(58,130,255,0.9)'
    ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    ctx.beginPath(); ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(pos.x, pos.y); ctx.stroke()
    lastPos.current = pos
    onSign(canvasRef.current.toDataURL())
  }
  function stop(e) { e.preventDefault(); drawing.current = false }
  function clearCanvas() {
    canvasRef.current.getContext('2d').clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
    onClear()
  }

  return (
    <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden',
      border: '1px dashed rgba(58,130,255,0.18)', minHeight: 100 }}>
      <canvas ref={canvasRef} width={500} height={100} style={{ display: 'block', width: '100%', height: 100, cursor: 'crosshair', touchAction: 'none' }}
        onMouseDown={start} onMouseMove={draw} onMouseUp={stop} onMouseLeave={stop}
        onTouchStart={start} onTouchMove={draw} onTouchEnd={stop} />
      {!signed && (
        <p style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: 0, color: 'rgba(58,130,255,0.22)', fontSize: 14, fontStyle: 'italic', pointerEvents: 'none' }}>
          Sign here using touch or stylus...
        </p>
      )}
      {signed && (
        <button type="button"
          style={{ position:'absolute', top:5, right:6, background:'rgba(255,83,95,0.12)',
            border:'1px solid rgba(255,83,95,0.28)', color:'#ff8080', borderRadius:5,
            padding:'2px 8px', fontSize:9.5, fontWeight:800, letterSpacing:'0.06em', cursor:'pointer' }}
          onClick={clearCanvas}>
          CLEAR
        </button>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   Main page
───────────────────────────────────────────────────────────── */
export function FEInspectionPage() {
  const { assetId }  = useParams()
  const navigate     = useNavigate()
  const { assets, addActivityEntry, upsertDraftInspection, finaliseInspection } = useFireExtData()
  const { profile }  = useAuth()

  /* look up the asset from the real-time stream */
  const asset = assets.find((a) => a.id === assetId || a.assetId === assetId) || null

  /* form state */
  const [checklist,  setChecklist]  = useState({})   // { id: 'pass' | 'fail' }
  const [comments,   setComments]   = useState('')
  const [photos,     setPhotos]     = useState([])   // [{ name, dataUrl }]
  const [signature,  setSignature]  = useState(null)
  const [draftId,    setDraftId]    = useState(null)
  const [saving,     setSaving]     = useState(false)
  const [toast,      setToast]      = useState(null)
  const [done,       setDone]       = useState(false)
  const photoRef = useRef(null)

  /* generate a monthly protocol ref */
  const refId = `TR-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}`

  const completedCount = Object.keys(checklist).filter((k) => checklist[k]).length

  function toggleCheck(id, value) {
    setChecklist((prev) => ({ ...prev, [id]: prev[id] === value ? null : value }))
  }

  function addPhoto(file) {
    const reader = new FileReader()
    reader.onloadend = () => setPhotos((prev) => [...prev, { name: file.name, dataUrl: reader.result }])
    reader.readAsDataURL(file)
  }

  function removePhoto(idx) {
    setPhotos((prev) => prev.filter((_, i) => i !== idx))
  }

  function buildPayload() {
    return {
      assetId:        asset?.id    || assetId,
      assetUnitId:    asset?.assetId || assetId,
      extType:        asset?.extinguisherType || '—',
      facilitySite:   asset?.facilitySite     || '—',
      checklist,
      comments:       comments.trim() || null,
      photos:         photos.map((p) => p.dataUrl),
      signature:      signature || null,
      inspector:      profile?.fullName || profile?.name || profile?.email || 'Technician',
      refId,
    }
  }

  /* ── Save draft ── */
  const handleSaveDraft = useCallback(async () => {
    setSaving(true)
    setToast(null)
    try {
      const id = await upsertDraftInspection(draftId, buildPayload())
      setDraftId(id)
      setToast({ type: 'ok', text: 'Draft saved successfully.' })
      setTimeout(() => setToast(null), 3500)
    } catch {
      setToast({ type: 'err', text: 'Failed to save draft.' })
    } finally {
      setSaving(false)
    }
  }, [draftId, checklist, comments, photos, signature]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Finalise & Sync ── */
  const handleFinalise = useCallback(async () => {
    if (completedCount < CHECKLIST.length) {
      setToast({ type: 'err', text: `Complete all ${CHECKLIST.length} checklist items before finalising.` })
      return
    }
    if (!signature) {
      setToast({ type: 'err', text: 'Digital signature is required to finalise the protocol.' })
      return
    }
    setSaving(true)
    setToast(null)
    try {
      const outcome = await finaliseInspection(draftId, buildPayload())
      await addActivityEntry({
        technicianName: profile?.fullName || profile?.name || profile?.email || 'Technician',
        assetId:        asset?.assetId || assetId,
        action:         'Tactical Inspection',
        statusUpdate:   outcome === 'passed' ? 'Passed' : outcome === 'failed' ? 'Failed' : 'Conditional',
      })
      setDone(true)
    } catch {
      setToast({ type: 'err', text: 'Failed to sync. Please retry.' })
    } finally {
      setSaving(false)
    }
  }, [draftId, checklist, comments, photos, signature, completedCount]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Success screen ── */
  if (done) {
    const allPassed = Object.values(checklist).every((v) => v === 'pass')
    const hasFail   = Object.values(checklist).some((v) => v === 'fail')
    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        minHeight:'60vh', padding:'40px 24px', textAlign:'center', gap:16 }}>
        <div style={{ width:80, height:80, borderRadius:'50%',
          background: hasFail ? 'rgba(255,83,95,0.1)' : 'rgba(22,201,136,0.1)',
          border: `1px solid ${hasFail ? 'rgba(255,83,95,0.25)' : 'rgba(22,201,136,0.25)'}`,
          display:'flex', alignItems:'center', justifyContent:'center' }}>
          {hasFail ? <XCircle size={40} style={{ color:'#ff535f' }}/> : <CheckCircle size={40} style={{ color:'#4deba0' }}/>}
        </div>
        <h2 style={{ margin:0, fontSize:'1.4rem', fontWeight:900, color:'rgba(235,242,255,0.97)' }}>
          Protocol {hasFail ? 'Flagged' : allPassed ? 'Passed' : 'Completed'}
        </h2>
        <p style={{ margin:0, fontSize:13.5, color:'rgba(148,163,184,0.7)', maxWidth:400 }}>
          Inspection for <strong style={{ color:'#8ab8ff' }}>{asset?.assetId || assetId}</strong> has been synced to the Fireguard cloud.
          {hasFail && ' Immediate maintenance is required.'}
        </p>
        <button type="button" className="fe-btn fe-btn--primary" style={{ marginTop:8 }}
          onClick={() => navigate('/extinguisher/assets')}>
          Back to Asset Registry
        </button>
      </div>
    )
  }

  /* ── Loading state while asset stream initialises ── */
  if (!asset && assets.length > 0) {
    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'50vh', gap:12 }}>
        <XCircle size={36} style={{ color:'rgba(255,83,95,0.5)' }} />
        <p style={{ margin:0, fontSize:14, color:'rgba(148,163,184,0.7)' }}>Asset not found — {assetId}</p>
        <button type="button" className="fe-btn fe-btn--ghost" onClick={() => navigate('/extinguisher/assets')}>
          Back to Registry
        </button>
      </div>
    )
  }

  return (
    <div className="fe-subpage fe-insp-page">

      {/* ── Header ── */}
      <div className="fe-insp-header">
        <div className="fe-insp-header-left">
          <button type="button" className="fe-reg-back" style={{ margin:0 }} onClick={() => navigate('/extinguisher/assets')}>
            <ArrowLeft size={15}/>
          </button>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5, flexWrap:'wrap' }}>
              <span className="fe-insp-kicker">MONTHLY PROTOCOL</span>
              <span style={{ fontSize:11, color:'rgba(148,163,184,0.5)', fontWeight:600 }}>Ref ID: #{refId}</span>
            </div>
            <h1 className="fe-insp-title">Tactical Inspection Protocol</h1>
            <p style={{ margin:0, fontSize:13, color:'rgba(148,163,184,0.65)' }}>
              On-site technical evaluation and safety audit.
            </p>
          </div>
        </div>
        <SessionTimer />
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div className={toast.type==='ok' ? 'fe-toast-ok' : 'fe-toast-err'} style={{ marginBottom:16 }}>
          {toast.type==='ok' ? <CheckCircle size={14}/> : <XCircle size={14}/>} {toast.text}
        </div>
      )}

      {/* ── Asset info cards ── */}
      <div className="fe-insp-asset-row">
        <div className="fe-card fe-insp-asset-card">
          <p className="fe-insp-asset-label">ASSET ID</p>
          <p className="fe-insp-asset-val">{asset?.assetId || assetId || '—'}</p>
          <p style={{ margin:0, fontSize:11, color:'#3a82ff', fontWeight:700, display:'flex', alignItems:'center', gap:4 }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:'#3a82ff', display:'inline-block' }}/>
            {asset?.status === 'compliant' ? 'Active Registry' : asset?.status || 'Registered'}
          </p>
        </div>
        <div className="fe-card fe-insp-asset-card">
          <p className="fe-insp-asset-label">TYPE</p>
          <p className="fe-insp-asset-val">{asset?.extinguisherType || '—'}</p>
          {asset?.extinguisherType?.includes('CO2') && (
            <p style={{ margin:0, fontSize:11, color:'rgba(148,163,184,0.5)', fontWeight:600 }}>Class B/C High Pressure</p>
          )}
        </div>
        <div className="fe-card fe-insp-asset-card">
          <p className="fe-insp-asset-label">DEPLOYMENT ZONE</p>
          <p className="fe-insp-asset-val" style={{ fontSize:'clamp(1rem,2vw,1.25rem)' }}>
            {asset?.facilitySite || '—'}
          </p>
          {asset?.floorZone && (
            <p style={{ margin:0, fontSize:11, color:'rgba(148,163,184,0.5)', fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
              <span>⊙</span> {asset.floorZone} {asset.roomPillar ? `/ ${asset.roomPillar}` : ''}
            </p>
          )}
        </div>
      </div>

      {/* ── Main two-column ── */}
      <div className="fe-insp-grid">

        {/* LEFT: Checklist + Photos */}
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

          {/* Mandatory Checklist */}
          <div className="fe-card">
            <div className="fe-card-head">
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div className="fe-reg-section-icon"><CheckCircle size={14}/></div>
                <span className="fe-card-title">Mandatory Checklist</span>
              </div>
              <span style={{ fontSize:11, color:'rgba(148,163,184,0.5)', fontWeight:700 }}>
                {completedCount}/{CHECKLIST.length} Completed
              </span>
            </div>

            <div style={{ padding:'8px 0' }}>
              {CHECKLIST.map((item) => {
                const { icon: Icon } = item
                const val = checklist[item.id]
                return (
                  <div key={item.id} className="fe-insp-checklist-row">
                    <div className="fe-insp-check-icon">
                      <Icon size={16} style={{ color: val ? (val === 'pass' ? '#4deba0' : '#ff535f') : '#3a82ff' }} />
                    </div>
                    <div className="fe-insp-check-body">
                      <p className="fe-insp-check-title">{item.title}</p>
                      <p className="fe-insp-check-desc">{item.desc}</p>
                    </div>
                    <div className="fe-insp-check-btns">
                      <button type="button"
                        className={`fe-insp-verdict-btn fe-insp-verdict-btn--pass${val === 'pass' ? ' active' : ''}`}
                        onClick={() => toggleCheck(item.id, 'pass')}>
                        PASS
                      </button>
                      <button type="button"
                        className={`fe-insp-verdict-btn fe-insp-verdict-btn--fail${val === 'fail' ? ' active' : ''}`}
                        onClick={() => toggleCheck(item.id, 'fail')}>
                        FAIL
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Photo Evidence */}
          <div className="fe-card">
            <div className="fe-card-head">
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div className="fe-reg-section-icon"><Camera size={14}/></div>
                <span className="fe-card-title">Photo Evidence</span>
              </div>
              <label className="fe-insp-upload-btn">
                <Camera size={12}/> UPLOAD NEW
                <input type="file" accept="image/*" style={{ display:'none' }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) addPhoto(f); e.target.value='' }}/>
              </label>
            </div>
            <div className="fe-insp-photo-grid">
              {photos.map((p, i) => (
                <div key={i} className="fe-insp-photo-thumb">
                  <img src={p.dataUrl} alt={p.name} style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:8 }}/>
                  <button type="button" className="fe-insp-photo-remove" onClick={() => removePhoto(i)}>
                    <X size={11}/>
                  </button>
                  <span className="fe-insp-photo-name">{p.name.toUpperCase().slice(0, 12)}</span>
                </div>
              ))}
              {/* Capture slot */}
              <label className="fe-insp-photo-capture" ref={photoRef}>
                <Camera size={22} style={{ color:'rgba(148,163,184,0.35)' }}/>
                <span style={{ fontSize:10, color:'rgba(148,163,184,0.35)', marginTop:4, fontWeight:700 }}>CAPTURE</span>
                <input type="file" accept="image/*" capture="environment" style={{ display:'none' }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) addPhoto(f); e.target.value='' }}/>
              </label>
            </div>
          </div>
        </div>

        {/* RIGHT: Comments + Signature + CTA */}
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

          {/* Technician Comments */}
          <div className="fe-card">
            <div className="fe-card-head">
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div className="fe-reg-section-icon"><Users size={14}/></div>
                <span className="fe-card-title">Technician Comments</span>
              </div>
            </div>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Note any environmental factors or minor observations..."
              rows={5}
              style={{
                width:'100%', boxSizing:'border-box', padding:'14px 16px',
                background:'transparent', border:'none', resize:'none',
                color:'rgba(203,214,255,0.82)', fontSize:13, fontFamily:'inherit',
                outline:'none', lineHeight:1.55,
              }}
            />
          </div>

          {/* Digital Signature */}
          <div className="fe-card" style={{ padding:'16px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div className="fe-reg-section-icon"><Save size={14}/></div>
                <span className="fe-card-title">Digital Signature</span>
              </div>
            </div>
            <SignatureCanvas onSign={setSignature} onClear={() => setSignature(null)} signed={!!signature}/>
            <p style={{ margin:'8px 0 0', fontSize:9, color:'rgba(148,163,184,0.35)', textAlign:'center', letterSpacing:'0.07em', textTransform:'uppercase' }}>
              SIGNATURE SERVES AS A LEGALLY BINDING VERIFICATION OF THIS AUDIT.
            </p>
          </div>

          {/* Save Draft */}
          <button type="button" className="fe-btn fe-btn--ghost" style={{ width:'100%', justifyContent:'center' }}
            onClick={handleSaveDraft} disabled={saving}>
            {saving ? <span className="fe-spinner" style={{ width:14, height:14 }}/> : <Save size={14}/>}
            Save Progress
          </button>

          {/* Finalize CTA */}
          <button type="button" className="fe-btn fe-btn--primary fe-reg-cta-btn"
            onClick={handleFinalise} disabled={saving}>
            {saving ? <span className="fe-spinner" style={{ width:15, height:15 }}/> : <Users size={15}/>}
            Finalize &amp; Sync Protocol
          </button>
        </div>
      </div>
    </div>
  )
}
