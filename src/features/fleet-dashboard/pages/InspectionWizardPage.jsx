import { useState, useRef, useEffect } from 'react'
import * as Yup from 'yup'
import {
  ArrowLeft, AlertTriangle, CheckCircle, XCircle,
  Upload, X, Pen, Save, Send,
  Gauge, Lightbulb, Droplets, Disc3, Tag,
} from 'lucide-react'

/* ── Yup schema for finalize submit ────────────────────────── */
const submitSchema = Yup.object({
  odometer: Yup.number()
    .typeError('Enter a valid odometer reading')
    .required('Current kilometre reading is required')
    .min(0, 'Cannot be negative')
    .max(9999999, 'Value too large')
    .integer('Must be a whole number')
    .test('greater-than-current', 'Must be greater than or equal to current vehicle odometer', function(value) {
      const currentVehicleOdometer = this.options.context?.currentVehicleOdometer
      if (currentVehicleOdometer && value !== undefined && value !== null) {
        return value >= currentVehicleOdometer
      }
      return true
    }),
})
import { useFleetData } from '../hooks/useFleetData.js'
import { useAuth } from '../../../app/providers/authContext.js'
import '../fleet.css'

/* ─────────────────────────────────────────────────────────────
   Checklist definition — extend here to add more sections/items
───────────────────────────────────────────────────────────── */
const CHECKLIST = [
  {
    id: 'tyres', label: 'Tyres & Wheels', Icon: Gauge,
    items: [
      { id: 'inflation_pressure',    label: 'Inflation Pressure' },
      { id: 'tread_depth_condition', label: 'Tread Depth & Condition' },
    ],
  },
  {
    id: 'lights', label: 'Lights & Indicators', Icon: Lightbulb,
    items: [
      { id: 'headlamps_high_beam', label: 'Headlamps & High Beam' },
      { id: 'brake_tail_lights',   label: 'Brake & Tail Lights' },
    ],
  },
  {
    id: 'fluids', label: 'Fluids & Leaks', Icon: Droplets,
    items: [
      { id: 'engine_oil_level', label: 'Engine Oil Level' },
      { id: 'coolant_leaks',    label: 'Coolant & Leaks' },
    ],
  },
  {
    id: 'brakes', label: 'Brake Systems', Icon: Disc3,
    items: [
      { id: 'service_brake_operation', label: 'Service Brake Operation' },
      { id: 'parking_brake_holding',   label: 'Parking Brake Holding' },
    ],
  },
]

const OUTCOMES = ['PASS', 'FAIL', 'NA']

const OUTCOME_STYLE = {
  PASS: {
    active: { background: '#16c988', color: '#041b12', border: '1px solid #16c988' },
    idle:   { background: 'transparent', color: '#4deba0', border: '1px solid rgba(22,201,136,0.3)' },
  },
  FAIL: {
    active: { background: '#ff535f', color: '#fff', border: '1px solid #ff535f' },
    idle:   { background: 'transparent', color: '#ff8080', border: '1px solid rgba(255,83,95,0.3)' },
  },
  NA: {
    active: { background: 'rgba(148,163,184,0.25)', color: '#fff', border: '1px solid rgba(148,163,184,0.4)' },
    idle:   { background: 'transparent', color: 'rgba(148,163,184,0.5)', border: '1px solid rgba(148,163,184,0.18)' },
  },
}

/* ─────────────────────────────────────────────────────────────
   ChecklistSection
───────────────────────────────────────────────────────────── */
function ChecklistSection({ section, answers, onChange }) {
  const { Icon } = section
  return (
    <div className="wiz-section-card">
      <div className="wiz-section-head">
        <div className="wiz-section-icon"><Icon size={14} /></div>
        <span className="wiz-section-title">{section.label}</span>
      </div>
      <div className="wiz-section-items">
        {section.items.map((item, idx) => {
          const val = answers[item.id] || null
          return (
            <div key={item.id} className="wiz-item-row"
              style={{ borderTop: idx === 0 ? '1px solid rgba(255,255,255,0.05)' : undefined }}>
              <span className="wiz-item-label">{item.label}</span>
              <div className="wiz-item-btns">
                {OUTCOMES.map((o) => {
                  const active = val === o
                  const s = active ? OUTCOME_STYLE[o].active : OUTCOME_STYLE[o].idle
                  return (
                    <button key={o} type="button" className="wiz-outcome-btn"
                      style={s} onClick={() => onChange(item.id, active ? null : o)}
                      aria-pressed={active}>
                      {o}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   Digital Signature canvas
───────────────────────────────────────────────────────────── */
function SignatureCanvas({ onSign, onClear, signed, initialDataUrl }) {
  const canvasRef = useRef(null)
  const drawing   = useRef(false)
  const lastPos   = useRef(null)

  /* restore saved signature when editing a draft */
  useEffect(() => {
    if (!initialDataUrl || !canvasRef.current) return
    const img = new Image()
    img.onload = () => {
      const ctx = canvasRef.current.getContext('2d')
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
      ctx.drawImage(img, 0, 0)
    }
    img.src = initialDataUrl
  }, [initialDataUrl])

  function getPos(e) {
    const rect = canvasRef.current.getBoundingClientRect()
    const src  = e.touches ? e.touches[0] : e
    return {
      x: (src.clientX - rect.left) * (canvasRef.current.width  / rect.width),
      y: (src.clientY - rect.top)  * (canvasRef.current.height / rect.height),
    }
  }
  function startDraw(e) { e.preventDefault(); drawing.current = true; lastPos.current = getPos(e) }
  function draw(e) {
    e.preventDefault()
    if (!drawing.current) return
    const ctx = canvasRef.current.getContext('2d')
    const pos = getPos(e)
    ctx.strokeStyle = 'rgba(58,130,255,0.9)'; ctx.lineWidth = 2
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    ctx.beginPath(); ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(pos.x, pos.y); ctx.stroke()
    lastPos.current = pos
    onSign(canvasRef.current.toDataURL())
  }
  function stopDraw(e) { e.preventDefault(); drawing.current = false }
  function clearCanvas() {
    canvasRef.current.getContext('2d').clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
    onClear()
  }

  return (
    <div className="wiz-sig-wrap">
      <canvas ref={canvasRef} width={700} height={160} className="wiz-sig-canvas"
        onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
        onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw} />
      {!signed && <p className="wiz-sig-placeholder">Sign here using touchpad stylus</p>}
      {signed && <button type="button" className="wiz-sig-clear-inner" onClick={clearCanvas}>CLEAR</button>}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   InspectionWizardPage
   Props:
     vehicle         — Firestore vehicle doc
     draftInspection — existing draft doc (or null) to resume from
     onBack          — go back to vehicle selection
───────────────────────────────────────────────────────────── */
export function InspectionWizardPage({ vehicle, draftInspection, onBack }) {
  const { upsertDraftInspection, finaliseInspection, openAlerts } = useFleetData()
  const { profile } = useAuth()

  /* ─── Seed state from existing draft (resume), or blank (new) ─── */
  const [draftId,   setDraftId]   = useState(draftInspection?.id   ?? null)
  const [odometer,  setOdometer]  = useState(String(draftInspection?.currentKm ?? ''))
  const [answers,   setAnswers]   = useState(draftInspection?.checklist ?? {})
  const [notes,     setNotes]     = useState(draftInspection?.notes     ?? '')
  const [photos,    setPhotos]    = useState([])   // local blobs only — not persisted in draft
  const [signature, setSignature] = useState(draftInspection?.signature ?? null)
  const [saving,    setSaving]    = useState(false)
  const [saveMsg,   setSaveMsg]   = useState(null)  // { type: 'ok'|'err', text }
  const [submitDone, setSubmitDone] = useState(false)

  const photoSlots = ['FRONT', 'REAR', 'DEFECT']

  /* critical alerts */
  const critAlerts  = openAlerts.filter(
    (a) => a.vehicleId === vehicle.id && a.severity === 'critical' && a.status !== 'resolved'
  )
  const hasCritical = critAlerts.length > 0

  function setAnswer(itemId, value) {
    setAnswers((prev) => ({ ...prev, [itemId]: value }))
  }

  function deriveOutcome() {
    if (Object.values(answers).includes('FAIL')) return 'fail'
    const allAnswered = CHECKLIST.flatMap((s) => s.items).every((i) => answers[i.id])
    return allAnswered ? 'pass' : 'conditional'
  }

  function handlePhotoAdd(slot, file) {
    const reader = new FileReader()
    reader.onloadend = () => {
      setPhotos((prev) => [...prev.filter((p) => p.label !== slot), { label: slot, dataUrl: reader.result }])
    }
    reader.readAsDataURL(file)
  }

  /* ── SAVE PROGRESS ── upserts draft, stores draft ID for future updates ── */
  async function handleSave() {
    setSaving(true)
    setSaveMsg(null)
    const payload = {
      vehicleId:      vehicle.id,
      vehicleUnit:    vehicle.unitId,
      inspector:      profile?.fullName || profile?.email || 'Inspector',
      inspectionType: 'Daily Inspection',
      outcome:        'conditional',
      currentKm:      odometer ? Number(odometer) : null,
      checklist:      answers,
      notes,
      signature:      signature || null,
    }
    try {
      const newId = await upsertDraftInspection(vehicle.id, draftId, payload)
      setDraftId(newId)  // remember so next save updates same doc
      setSaveMsg({ type: 'ok', text: 'Progress saved — you can safely go back and continue later.' })
      setTimeout(() => setSaveMsg(null), 4000)
    } catch {
      setSaveMsg({ type: 'err', text: 'Failed to save. Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  /* ── FINALIZE & SUBMIT ── */
  async function handleSubmit() {
    /* Validate odometer with Yup */
    try {
      await submitSchema.validate({ odometer }, { context: { currentVehicleOdometer: vehicle.mileageKm } })
    } catch (validationErr) {
      setSaveMsg({ type: 'err', text: validationErr.message })
      return
    }
    setSaving(true)
    setSaveMsg(null)
    const outcome = deriveOutcome()
    const payload = {
      vehicleId:      vehicle.id,
      vehicleUnit:    vehicle.unitId,
      inspector:      profile?.fullName || profile?.email || 'Inspector',
      inspectionType: 'Daily Inspection',
      outcome,
      currentKm:      Number(odometer),
      checklist:      answers,
      notes:          notes.trim(),
      signature:      signature || null,
    }
    try {
      await finaliseInspection(draftId, vehicle.id, payload)
      setSubmitDone(true)
    } catch {
      setSaveMsg({ type: 'err', text: 'Submission failed. Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  /* ── success screen ── */
  if (submitDone) return (
    <div className="wiz-success">
      <div className="wiz-success-icon"><CheckCircle size={52} style={{ color: '#4deba0' }} /></div>
      <h2 className="wiz-success-title">Inspection Submitted</h2>
      <p className="wiz-success-sub">
        The daily inspection for <strong>{vehicle.unitId}</strong> has been recorded
        and synced to the Sentinel cloud.
      </p>
      <button type="button" className="wiz-success-btn" onClick={onBack}>
        Back to Vehicle Selection
      </button>
    </div>
  )

  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })
  const isResuming = !!draftInspection

  return (
    <div className="fleet-subpage wiz-page">

      {/* ── Critical warning ── */}
      {hasCritical && (
        <div className="wiz-critical-banner">
          <AlertTriangle size={15} className="wiz-critical-icon" />
          <div>
            <p className="wiz-critical-title">CRITICAL ROADWORTHINESS WARNING</p>
            <p className="wiz-critical-body">
              Any major defects identified during this inspection must be reported immediately
              to the fleet supervisor. Do NOT operate the vehicle if safety-critical systems
              (Brakes, Steering, Tyres) fail inspection.
            </p>
          </div>
        </div>
      )}

      {/* ── Resume banner ── */}
      {isResuming && (
        <div className="wiz-resume-banner">
          <Save size={13} />
          <span>Resuming saved draft — your previous progress has been restored.</span>
        </div>
      )}

      {/* ── Header ── */}
      <div className="wiz-header">
        <div className="wiz-header-left">
          <button type="button" className="wiz-back-btn" onClick={onBack}>
            <ArrowLeft size={15} />
          </button>
          <div>
            <h1 className="wiz-title">Vehicle Daily Inspection</h1>
            <p className="wiz-meta">
              <Tag size={11} />
              Unit #&nbsp;{vehicle.unitId}&nbsp;·&nbsp;{today}
              {isResuming && <span className="wiz-meta-draft"> · DRAFT</span>}
            </p>
          </div>
        </div>
        <div className="wiz-header-actions">
          <button type="button" className="wiz-btn wiz-btn--ghost" onClick={handleSave} disabled={saving}>
            {saving
              ? <span className="fleet-spinner" style={{ width: 13, height: 13 }} />
              : <Save size={13} />}
            SAVE PROGRESS
          </button>
          <button type="button" className="wiz-btn wiz-btn--primary" onClick={handleSubmit} disabled={saving}>
            {saving
              ? <span className="fleet-spinner" style={{ width: 13, height: 13 }} />
              : <Send size={13} />}
            FINALIZE &amp; SUBMIT
          </button>
        </div>
      </div>

      {/* ── Save message bar ── */}
      {saveMsg && (
        <div className={saveMsg.type === 'ok' ? 'wiz-save-ok-bar' : 'wiz-error-bar'}>
          {saveMsg.type === 'ok' ? <CheckCircle size={14} /> : <XCircle size={14} />}
          {saveMsg.text}
        </div>
      )}

      {/* ── Odometer ── */}
      <div className="wiz-odometer-card">
        <label className="wiz-odometer-label" htmlFor="wiz-odometer">CURRENT KILOMETRES *</label>
        {vehicle.mileageKm && (
          <p style={{ margin: '4px 0 8px', fontSize: 11, color: 'rgba(148, 163, 184, 0.6)', fontWeight: 500 }}>
            Vehicle odometer: {vehicle.mileageKm.toLocaleString()} KM
          </p>
        )}
        <div className="wiz-odometer-row">
          <input
            id="wiz-odometer"
            type="number" min={0} placeholder="000,000"
            value={odometer}
            onChange={(e) => setOdometer(e.target.value)}
            onBlur={async () => {
              if (!odometer) return
              try { await submitSchema.validate({ odometer }, { context: { currentVehicleOdometer: vehicle.mileageKm } }) }
              catch { /* shown on submit */ }
            }}
            className="wiz-odometer-input"
            style={odometer && (isNaN(Number(odometer)) || Number(odometer) < 0 || (vehicle.mileageKm && Number(odometer) < vehicle.mileageKm))
              ? { color: '#ff8080' } : {}}
          />
          <span className="wiz-odometer-unit">KM</span>
        </div>
        {odometer && isNaN(Number(odometer)) && (
          <p style={{ margin: '4px 0 0', fontSize: 11, color: '#ff8080', fontWeight: 600 }}>
            Enter a valid number
          </p>
        )}
        {odometer && !isNaN(Number(odometer)) && vehicle.mileageKm && Number(odometer) < vehicle.mileageKm && (
          <p style={{ margin: '4px 0 0', fontSize: 11, color: '#ff8080', fontWeight: 600 }}>
            Must be greater than or equal to current vehicle odometer ({vehicle.mileageKm.toLocaleString()} KM)
          </p>
        )}
      </div>

      {/* ── Checklist grid ── */}
      <div className="wiz-checklist-grid">
        {CHECKLIST.map((section) => (
          <ChecklistSection key={section.id} section={section} answers={answers} onChange={setAnswer} />
        ))}
      </div>

      {/* ── Evidence + Defects row ── */}
      <div className="wiz-bottom-row">

        {/* Evidence */}
        <div className="wiz-evidence-card">
          <div className="wiz-section-head">
            <div className="wiz-section-icon"><Upload size={13} /></div>
            <span className="wiz-section-title">Evidence</span>
          </div>
          <div className="wiz-photo-grid">
            {photoSlots.map((slot) => {
              const photo = photos.find((p) => p.label === slot)
              return (
                <div key={slot} className="wiz-photo-slot">
                  {photo ? (
                    <div className="wiz-photo-thumb">
                      <img src={photo.dataUrl} alt={slot} className="wiz-photo-img" />
                      <button type="button" className="wiz-photo-remove"
                        onClick={() => setPhotos((prev) => prev.filter((p) => p.label !== slot))}
                        aria-label={`Remove ${slot}`}>
                        <X size={10} />
                      </button>
                    </div>
                  ) : (
                    <label className="wiz-photo-upload" title={`Upload ${slot}`}>
                      <Upload size={16} style={{ opacity: 0.4 }} />
                      <span>{slot}</span>
                      <input type="file" accept="image/*" style={{ display: 'none' }}
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          if (f) handlePhotoAdd(slot, f)
                          e.target.value = ''
                        }} />
                    </label>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Defects notes */}
        <div className="wiz-defects-card">
          <div className="wiz-section-head">
            <div className="wiz-section-icon" style={{ color: '#fe8e2a', borderColor: 'rgba(254,142,42,0.25)', background: 'rgba(254,142,42,0.1)' }}>
              <AlertTriangle size={13} />
            </div>
            <span className="wiz-section-title">Describe any observed defects</span>
          </div>
          <textarea className="wiz-defects-textarea" rows={7}
            placeholder="Include detailed information on hazards or items requiring attention…"
            value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>

      {/* ── Digital Signature ── */}
      <div className="wiz-sig-card">
        <div className="wiz-sig-head">
          <div className="wiz-section-head" style={{ flex: 1 }}>
            <div className="wiz-section-icon"><Pen size={13} /></div>
            <span className="wiz-section-title">Digital Signature</span>
          </div>
          {signature && (
            <button type="button" className="wiz-sig-clear-btn" onClick={() => setSignature(null)}>
              CLEAR
            </button>
          )}
        </div>
        <SignatureCanvas
          onSign={setSignature}
          onClear={() => setSignature(null)}
          signed={!!signature}
          initialDataUrl={isResuming ? signature : null}
        />
        <p className="wiz-sig-disclaimer">
          DIGITALLY SIGNED &amp; LEGALLY BINDING INSPECTION OF THE ABOVE
        </p>
      </div>

    </div>
  )
}
