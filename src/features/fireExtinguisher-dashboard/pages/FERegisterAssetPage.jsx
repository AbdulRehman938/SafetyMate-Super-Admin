import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import QRCode from 'qrcode'
import {
  ArrowLeft, ClipboardList, Calendar, Camera, X,
  CheckCircle, XCircle, Save, Printer, RefreshCw,
} from 'lucide-react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../../../config/firebase.js'
import { useFireExtData } from '../hooks/useFireExtData.js'
import { useAuth } from '../../../app/providers/authContext.js'
import '../fe.css'

/* ─────────────────────────────────────────────────────────────
   Unit ID generation — FG-AST-XXXX (crypto-random, unique per session)
───────────────────────────────────────────────────────────── */
function genUnitId() {
  const arr = new Uint16Array(1)
  crypto.getRandomValues(arr)
  const n = 1000 + (arr[0] % 9000)
  return `FG-AST-${n}`
}

/* ─────────────────────────────────────────────────────────────
   Build the QR payload — a structured JSON string.
   Scanning with a phone will show readable, meaningful data.
   Fields are:
     id   — the assigned unit ID
     type — extinguisher type (or "Pending" if not yet set)
     sn   — serial number (or "Pending")
     site — facility site (or "Pending")
     url  — deep-link for future mobile app
───────────────────────────────────────────────────────────── */
function buildQrPayload(unitId, values) {
  return JSON.stringify({
    id:   unitId,
    type: values?.extinguisherType || 'Pending',
    sn:   values?.serialNumber     || 'Pending',
    site: values?.facilitySite     || 'Pending',
    url:  `https://safetymate.app/asset/${unitId}`,
  })
}

/* ─────────────────────────────────────────────────────────────
   Real-time QR Code canvas component.
   Updates whenever unitId or values change (live preview).
───────────────────────────────────────────────────────────── */
function QRCanvas({ unitId, values, canvasRef: canvasRefCallback }) {
  const canvasRef = useRef(null)
  const [error,   setError]   = useState(null)
  const [loading, setLoading] = useState(true)

  /* expose the canvas element to the parent for printing */
  const setRef = useCallback((el) => {
    canvasRef.current = el
    if (canvasRefCallback) canvasRefCallback(el)
  }, [canvasRefCallback])

  useEffect(() => {
    if (!canvasRef.current) return
    setLoading(true)
    setError(null)

    const payload = buildQrPayload(unitId, values)

    QRCode.toCanvas(canvasRef.current, payload, {
      width:            140,
      margin:           2,
      color:            { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'H',
    })
      .then(() => setLoading(false))
      .catch((err) => {
        console.warn('QR generation failed:', err)
        setError('QR generation failed')
        setLoading(false)
      })
  }, [unitId, values?.extinguisherType, values?.serialNumber, values?.facilitySite]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{
      width: 150, height: 150,
      background: '#fff',
      borderRadius: 10,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 5,
      boxSizing: 'border-box',
      margin: '4px auto',
      position: 'relative',
    }}>
      <canvas
        ref={setRef}
        style={{
          display: loading || error ? 'none' : 'block',
          borderRadius: 6,
        }}
      />
      {loading && (
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <span className="fe-spinner" style={{ borderTopColor:'#000', borderColor:'rgba(0,0,0,0.15)' }} />
        </div>
      )}
      {error && !loading && (
        <p style={{ margin:0, fontSize:10, color:'#666', textAlign:'center', padding:4 }}>
          QR unavailable
        </p>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   Yup validation schema
───────────────────────────────────────────────────────────── */
const schema = Yup.object({
  extinguisherType: Yup.string().required('Select extinguisher type'),
  serialNumber: Yup.string().trim().required('Serial number is required')
    .max(40, 'Max 40 characters')
    .matches(/^[A-Za-z0-9-]+$/, 'Only letters, numbers and hyphens'),
  capacityKg: Yup.number()
    .typeError('Enter a valid number')
    .required('Capacity is required')
    .positive('Must be greater than 0')
    .max(200, 'Seems too large'),
  facilitySite: Yup.string().required('Select a facility site'),
  floorZone:    Yup.string().trim().max(50, 'Max 50 chars').nullable(),
  roomPillar:   Yup.string().trim().max(50, 'Max 50 chars').nullable(),
  installationDate: Yup.string().nullable(),
  lastInspection:   Yup.string().nullable(),
  nextDueDate: Yup.string().nullable()
    .test('after-last', 'Must be after last inspection', function (val) {
      const { lastInspection } = this.parent
      if (!val || !lastInspection) return true
      return new Date(val) > new Date(lastInspection)
    }),
  shelfExpiry: Yup.string().nullable(),
})

/* ─────────────────────────────────────────────────────────────
   Custom dark dropdown
───────────────────────────────────────────────────────────── */
function FeSelect({ id, value, onChange, onBlur, options, placeholder, error, touched }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const selected = options.find((o) => (typeof o === 'string' ? o : o.value) === value)
  const displayLabel = selected ? (typeof selected === 'string' ? selected : selected.label) : placeholder

  const handleBlur = (e) => {
    if (open) return
    if (onBlur) onBlur(e)
  }

  return (
    <div ref={ref} style={{ position:'relative' }}>
      <button id={id} type="button" onBlur={handleBlur} onClick={() => setOpen((v) => !v)}
        style={{
          width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'10px 12px',
          background:'rgba(255,255,255,0.04)',
          border:`1px solid ${error && touched ? 'rgba(255,83,95,0.5)' : 'rgba(255,255,255,0.1)'}`,
          borderRadius:9,
          color: value ? 'rgba(235,242,255,0.9)' : 'rgba(148,163,184,0.45)',
          fontSize:13.5, fontWeight: value ? 600 : 400,
          cursor:'pointer', textAlign:'left',
        }}>
        <span>{displayLabel}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(148,163,184,0.5)" strokeWidth="2">
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </button>

      {open && (
        <div style={{
          position:'absolute', top:'calc(100% + 5px)', left:0, right:0, zIndex:200,
          background:'#0d1220', border:'1px solid rgba(58,130,255,0.2)', borderRadius:10,
          boxShadow:'0 16px 40px rgba(0,0,0,0.75)', overflow:'hidden',
          animation:'fe-dropdown 0.15s ease both',
          maxHeight:220, overflowY:'auto',
        }}>
          {options.map((opt) => {
            const val = typeof opt === 'string' ? opt : opt.value
            const lbl = typeof opt === 'string' ? opt : opt.label
            const isSel = val === value
            return (
              <button key={val} type="button"
                onClick={() => { onChange(val); setOpen(false) }}
                style={{
                  display:'block', width:'100%', padding:'10px 14px', border:'none',
                  background: isSel ? 'rgba(58,130,255,0.14)' : 'transparent',
                  color: isSel ? '#8ab8ff' : 'rgba(203,214,255,0.85)',
                  fontSize:13, fontWeight: isSel ? 700 : 500, textAlign:'left', cursor:'pointer',
                }}
                onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.background = 'transparent' }}>
                {lbl}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── Field wrapper ── */
function Field({ label, error, touched, children, required }) {
  return (
    <div className="fe-reg-field">
      <label className="fe-reg-label">
        {label}{required && <span style={{ color:'#ff535f', marginLeft:2 }}>*</span>}
      </label>
      {children}
      {error && touched && <p style={{ margin:'3px 0 0', fontSize:11, color:'#ff8080', fontWeight:600 }}>{error}</p>}
    </div>
  )
}

/* ── Custom animated date picker ── */
function DateInput({ id, value, onChange, onBlur, error, touched, minDate, maxDate, name }) {
  const [open, setOpen] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const displayDate = value ? new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : ''

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate()
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay()
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  const handleDateSelect = (day) => {
    const selectedDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
    const year = selectedDate.getFullYear()
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0')
    const dayStr = String(day).padStart(2, '0')
    const isoDate = `${year}-${month}-${dayStr}`
    onChange({ target: { value: isoDate, name: name || id } })
    setOpen(false)
    if (onBlur) onBlur({ target: { value: isoDate, name: name || id } })
  }

  const isDateDisabled = (day) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
    date.setHours(0, 0, 0, 0)
    
    if (minDate) {
      const min = new Date(minDate)
      min.setHours(0, 0, 0, 0)
      if (date < min) return true
    }
    
    if (maxDate) {
      const max = new Date(maxDate)
      max.setHours(0, 0, 0, 0)
      if (date > max) return true
    }
    
    return false
  }

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
  }

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))
  }

  const toggleOpen = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setOpen((v) => !v)
  }

  return (
    <div ref={ref} style={{ position:'relative' }}>
      <button id={id} type="button" onBlur={onBlur} onClick={toggleOpen}
        style={{
          width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'10px 12px',
          background:'rgba(255,255,255,0.04)',
          border:`1px solid ${error && touched ? 'rgba(255,83,95,0.5)' : 'rgba(255,255,255,0.1)'}`,
          borderRadius:9,
          color: value ? 'rgba(235,242,255,0.9)' : 'rgba(148,163,184,0.45)',
          fontSize:13.5, fontWeight: value ? 600 : 400,
          cursor:'pointer', textAlign:'left',
        }}>
        <span>{displayDate || 'Select date'}</span>
        <Calendar size={14} style={{ color:'rgba(148,163,184,0.5)' }}/>
      </button>

      {open && (
        <div style={{
          position:'absolute', top:'calc(100% + 5px)', left:0, right:0, zIndex:200,
          background:'#0d1220', border:'1px solid rgba(58,130,255,0.2)', borderRadius:10,
          boxShadow:'0 16px 40px rgba(0,0,0,0.75)', overflow:'hidden',
          animation:'fe-dropdown 0.15s ease both', padding:'12px',
        }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <button type="button" onClick={prevMonth} style={{
              background:'transparent', border:'none', color:'rgba(148,163,184,0.7)', cursor:'pointer', padding:4
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6"/>
              </svg>
            </button>
            <span style={{ color:'rgba(235,242,255,0.9)', fontWeight:700, fontSize:13 }}>
              {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </span>
            <button type="button" onClick={nextMonth} style={{
              background:'transparent', border:'none', color:'rgba(148,163,184,0.7)', cursor:'pointer', padding:4
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4, textAlign:'center' }}>
            {['Su','Mo','Tu','We','Th','Fr','Sa'].map((day) => (
              <div key={day} style={{ color:'rgba(148,163,184,0.5)', fontSize:10, fontWeight:700, padding:4 }}>{day}</div>
            ))}
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const isSelected = value && new Date(value).getDate() === day && 
                new Date(value).getMonth() === currentMonth.getMonth() &&
                new Date(value).getFullYear() === currentMonth.getFullYear()
              const disabled = isDateDisabled(day)
              return (
                <button key={day} type="button" onClick={() => !disabled && handleDateSelect(day)} disabled={disabled}
                  style={{
                    padding:'6px', border:'none', borderRadius:6,
                    background: isSelected ? 'rgba(58,130,255,0.3)' : 'transparent',
                    color: disabled ? 'rgba(148,163,184,0.2)' : isSelected ? '#8ab8ff' : 'rgba(203,214,255,0.85)',
                    fontSize:12, fontWeight: isSelected ? 700 : 500, cursor: disabled ? 'not-allowed' : 'pointer',
                    opacity: disabled ? 0.4 : 1,
                  }}
                  onMouseEnter={(e) => { if (!disabled && !isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                  onMouseLeave={(e) => { if (!disabled && !isSelected) e.currentTarget.style.background = 'transparent' }}>
                  {day}
                </button>
              )
            })}
          </div>
        </div>
      )}
      {error && touched && <p style={{ margin:'3px 0 0', fontSize:11, color:'#ff8080', fontWeight:600 }}>{error}</p>}
    </div>
  )
}

/* ── Dark text/number input ── */
function TextInput({ id, type = 'text', value, onChange, onBlur, error, touched, placeholder, step }) {
  return (
    <input id={id} type={type} value={value || ''} onChange={onChange}
      placeholder={placeholder} step={step}
      style={{
        width:'100%', boxSizing:'border-box', padding:'10px 12px',
        background:'rgba(255,255,255,0.04)',
        border:`1px solid ${error && touched ? 'rgba(255,83,95,0.5)' : 'rgba(255,255,255,0.1)'}`,
        borderRadius:9, color:'rgba(235,242,255,0.9)', fontSize:13.5, outline:'none',
      }}
      onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(58,130,255,0.5)' }}
      onBlur={(e) => { e.currentTarget.style.borderColor = error && touched ? 'rgba(255,83,95,0.5)' : 'rgba(255,255,255,0.1)'; if (onBlur) onBlur(e) }}
    />
  )
}

/* ─────────────────────────────────────────────────────────────
   Print helper — opens the QR canvas as a printable page
───────────────────────────────────────────────────────────── */
function printTag(unitId, canvasEl) {
  if (!canvasEl) return
  const dataUrl = canvasEl.toDataURL('image/png')
  const win = window.open('', '_blank', 'width=400,height=500')
  if (!win) return
  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Fire Asset Tag — ${unitId}</title>
      <style>
        body { font-family: sans-serif; background:#fff; display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:100vh; margin:0; padding:20px; box-sizing:border-box; }
        img  { width:180px; height:180px; border:2px solid #000; border-radius:8px; }
        h2   { margin:12px 0 4px; font-size:18px; letter-spacing:0.04em; }
        p    { margin:0; font-size:12px; color:#555; }
        .tag { border:2px dashed #ccc; padding:20px; border-radius:12px; text-align:center; }
      </style>
    </head>
    <body>
      <div class="tag">
        <p style="font-size:10px;letter-spacing:0.1em;color:#888;text-transform:uppercase;margin-bottom:8px">SafetyMate — Fire Asset Tag</p>
        <img src="${dataUrl}" alt="QR Code" />
        <h2>${unitId}</h2>
        <p>Scan to view asset details &amp; compliance status</p>
        <p style="margin-top:8px;font-size:10px;color:#999">Encrypted · AES-256 Bit</p>
      </div>
      <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 1000) }</script>
    </body>
    </html>
  `)
  win.document.close()
}

/* ─────────────────────────────────────────────────────────────
   Main page
───────────────────────────────────────────────────────────── */
export function FERegisterAssetPage() {
  const navigate = useNavigate()
  const { addAsset, addActivityEntry } = useFireExtData()
  const { profile } = useAuth()

  const [photo,   setPhoto]   = useState(null)
  const [saving,  setSaving]  = useState(false)
  const [toast,   setToast]   = useState(null)
  const [unitId]              = useState(() => genUnitId())
  const [qrGenerated, setQrGenerated] = useState(false)
  const photoRef              = useRef(null)
  const qrCanvasRef           = useRef(null)  // ref to the canvas inside QRCanvas

  /* pass canvas ref down through a callback */
  const captureQrCanvas = useCallback((el) => { qrCanvasRef.current = el }, [])

  const formik = useFormik({
    initialValues: {
      extinguisherType:'', serialNumber:'', capacityKg:'', facilitySite:'',
      floorZone:'', roomPillar:'', installationDate:'', lastInspection:'', nextDueDate:'', shelfExpiry:'',
    },
    validationSchema: schema,
    validateOnBlur:   true,
    validateOnChange: true,
    onSubmit: async (values) => { 
      if (!qrGenerated) {
        setToast({ type:'err', text:'Please generate QR code before registering the asset.' })
        return
      }
      await doSave(values, 'active') 
    },
  })

  const { values: fv, errors: fe, touched: ft } = formik

  function toDateObj(str) { return str ? new Date(str) : null }

  async function doSave(values, status) {
    setSaving(true)
    setToast(null)
    try {
      // Check if serial number already exists
      const serialCheck = query(
        collection(db, 'fe_assets'),
        where('serialNumber', '==', values.serialNumber.trim().toUpperCase())
      )
      const existingSnapshot = await getDocs(serialCheck)
      if (!existingSnapshot.empty) {
        setToast({ type: 'err', text: 'An asset with this serial number already exists. Please use a unique serial number.' })
        setSaving(false)
        return
      }

      await addAsset({
        assetId:            unitId,
        extinguisherType:   values.extinguisherType,
        serialNumber:       values.serialNumber.trim().toUpperCase(),
        capacityKg:         Number(values.capacityKg),
        facilitySite:       values.facilitySite,
        floorZone:          values.floorZone?.trim() || null,
        roomPillar:         values.roomPillar?.trim() || null,
        installationDate:   toDateObj(values.installationDate),
        lastInspection:     toDateObj(values.lastInspection),
        nextInspectionDate: toDateObj(values.nextDueDate),
        certExpiry:         toDateObj(values.shelfExpiry),
        photo:              photo?.dataUrl || null,
        status,
        zone:               values.floorZone?.trim() || values.facilitySite || null,
        qrPayload:          buildQrPayload(unitId, values),
      })
      await addActivityEntry({
        technicianName: profile?.fullName || profile?.name || profile?.email || 'Technician',
        assetId:        unitId,
        action:         status === 'draft' ? 'Draft Saved' : 'Asset Registered',
        statusUpdate:   status === 'draft' ? 'Pending'     : 'Passed',
      })

      if (status === 'active') {
        /* auto-print tag after successful registration */
        printTag(unitId, qrCanvasRef.current)
        navigate('/extinguisher/assets')
      } else {
        setToast({ type:'ok', text:`Draft saved — Unit ID: ${unitId}` })
        setTimeout(() => navigate('/extinguisher/assets'), 1800)
      }
    } catch (err) {
      console.error('Save failed:', err)
      setToast({ type:'err', text:`Failed to save: ${err.message || 'Please try again.'}` })
    } finally {
      setSaving(false)
    }
  }

  function handleSaveDraft() {
    formik.validateForm().then((errors) => {
      const blocking = ['extinguisherType','serialNumber']
      if (blocking.some((k) => errors[k])) {
        formik.setTouched({ extinguisherType:true, serialNumber:true, capacityKg:true, facilitySite:true })
        setToast({ type:'err', text:'Fix the required fields before saving a draft.' })
        return
      }
      doSave(formik.values, 'draft')
    })
  }

  function handleGenerateQR() {
    const requiredFields = ['extinguisherType', 'serialNumber', 'capacityKg', 'facilitySite']
    const values = formik.values
    
    console.log('QR Generation attempt - current values:', values)
    
    // Check if all required fields have values
    const missingFields = requiredFields.filter(field => {
      const value = values[field]
      const isEmpty = value === undefined || value === null || value === '' || (typeof value === 'string' && value.trim() === '')
      console.log(`Field ${field}: value="${value}", isEmpty=${isEmpty}`)
      return isEmpty
    })
    
    if (missingFields.length > 0) {
      console.log('Missing fields:', missingFields)
      // Mark all required fields as touched to show validation errors
      formik.setTouched({
        extinguisherType: true,
        serialNumber: true,
        capacityKg: true,
        facilitySite: true
      })
      setToast({ type:'err', text:'Please fill all required fields before generating QR code.' })
      return
    }
    
    console.log('All fields filled, generating QR')
    setQrGenerated(true)
    setToast({ type:'ok', text:'QR code generated successfully!' })
  }

  function handlePhotoUpload(file) {
    // Compress image before storing
    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const maxSize = 100 // Max dimension in pixels (extremely aggressive compression)
        let width = img.width
        let height = img.height

        if (width > height) {
          if (width > maxSize) {
            height *= maxSize / width
            width = maxSize
          }
        } else {
          if (height > maxSize) {
            width *= maxSize / height
            height = maxSize
          }
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)

        // Compress to JPEG with 0.1 quality (extremely aggressive compression)
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.1)
        
        // Check if still too large (approximate check by base64 length)
        if (compressedDataUrl.length > 500000) {
          setToast({ type: 'err', text: 'Photo is too large even after compression. Please try a smaller image.' })
          setPhoto(null)
        } else {
          setPhoto({ name: file.name, dataUrl: compressedDataUrl })
        }
      }
      img.src = event.target.result
    }
    reader.readAsDataURL(file)
  }

  const EXT_TYPES = [
    'CO2 - Carbon Dioxide','Dry Powder','Foam','Water',
    'Wet Chemical','Halon','Clean Agent',
  ]
  const FACILITY_SITES = [
    'Main HQ - Industrial Park','Warehouse A','Warehouse B',
    'Data Centre','Office Block North','Office Block South',
    'Loading Dock','Server Room','Workshop',
  ]

  return (
    <div className="fe-subpage fe-reg-page">

      {/* Back */}
      <button type="button" className="fe-reg-back" onClick={() => navigate(-1)}>
        <ArrowLeft size={15}/> Back
      </button>

      <div style={{ marginBottom:24 }}>
        <h1 className="fe-reg-title">Register New Asset</h1>
        <p className="fe-reg-subtitle">
          Onboard mission-critical fire safety equipment. Precision entry ensures
          compliance and rapid emergency response.
        </p>
      </div>

      {toast && (
        <div className={toast.type==='ok' ? 'fe-toast-ok' : 'fe-toast-err'}>
          {toast.type==='ok' ? <CheckCircle size={14}/> : <XCircle size={14}/>} {toast.text}
        </div>
      )}

      <div className="fe-reg-grid">

        {/* ════ LEFT ════ */}
        <div className="fe-reg-left">

          {/* Equipment Specifications */}
          <div className="fe-card fe-reg-section">
            <div className="fe-reg-section-head">
              <div className="fe-reg-section-icon"><ClipboardList size={14}/></div>
              <span className="fe-reg-section-title">Equipment Specifications</span>
            </div>
            <div className="fe-reg-body">
              <div className="fe-reg-row2">
                <Field label="EXTINGUISHER TYPE" required error={fe.extinguisherType} touched={ft.extinguisherType}>
                  <FeSelect id="extinguisherType" value={fv.extinguisherType}
                    onChange={(val) => formik.setFieldValue('extinguisherType',val)}
                    onBlur={() => formik.setFieldTouched('extinguisherType',true)}
                    options={EXT_TYPES} placeholder="CO2 - Carbon Dioxide"
                    error={fe.extinguisherType} touched={ft.extinguisherType}/>
                </Field>
                <Field label="SERIAL NUMBER" required error={fe.serialNumber} touched={ft.serialNumber}>
                  <TextInput id="serialNumber" value={fv.serialNumber}
                    onChange={formik.handleChange} onBlur={formik.handleBlur}
                    placeholder="e.g. SN-9920-FGS" error={fe.serialNumber} touched={ft.serialNumber}/>
                </Field>
              </div>
              <div className="fe-reg-row2">
                <Field label="CAPACITY (KG/L)" required error={fe.capacityKg} touched={ft.capacityKg}>
                  <TextInput id="capacityKg" type="number" step="0.5" value={fv.capacityKg}
                    onChange={formik.handleChange} onBlur={formik.handleBlur}
                    placeholder="e.g. 5.0 kg" error={fe.capacityKg} touched={ft.capacityKg}/>
                </Field>
                <Field label="FACILITY SITE" required error={fe.facilitySite} touched={ft.facilitySite}>
                  <FeSelect id="facilitySite" value={fv.facilitySite}
                    onChange={(val) => formik.setFieldValue('facilitySite',val)}
                    onBlur={() => formik.setFieldTouched('facilitySite',true)}
                    options={FACILITY_SITES} placeholder="Main HQ - Industrial Park"
                    error={fe.facilitySite} touched={ft.facilitySite}/>
                </Field>
              </div>
              <div className="fe-reg-row3">
                <Field label="FLOOR/ZONE">
                  <TextInput id="floorZone" value={fv.floorZone} onChange={formik.handleChange} onBlur={formik.handleBlur} placeholder="Floor 04"/>
                </Field>
                <Field label="ROOM/PILLAR">
                  <TextInput id="roomPillar" value={fv.roomPillar} onChange={formik.handleChange} onBlur={formik.handleBlur} placeholder="Pillar B-12"/>
                </Field>
                <Field label="INSTALLATION DATE">
                  <DateInput id="installationDate" name="installationDate" value={fv.installationDate} onChange={formik.handleChange} onBlur={formik.handleBlur} minDate={new Date().toISOString().split('T')[0]}/>
                </Field>
              </div>
            </div>
          </div>

          {/* Lifecycle & Compliance */}
          <div className="fe-card fe-reg-section">
            <div className="fe-reg-section-head">
              <div className="fe-reg-section-icon" style={{ color:'#4deba0', borderColor:'rgba(22,201,136,0.25)', background:'rgba(22,201,136,0.1)' }}>
                <Calendar size={14}/>
              </div>
              <span className="fe-reg-section-title">Lifecycle &amp; Compliance</span>
            </div>
            <div className="fe-reg-body">
              <div className="fe-reg-row3">
                <Field label="LAST INSPECTION">
                  <DateInput id="lastInspection" name="lastInspection" value={fv.lastInspection} onChange={formik.handleChange} onBlur={formik.handleBlur} minDate={fv.installationDate}/>
                </Field>
                <Field label="NEXT DUE DATE" error={fe.nextDueDate} touched={ft.nextDueDate}>
                  <DateInput id="nextDueDate" name="nextDueDate" value={fv.nextDueDate} onChange={formik.handleChange} onBlur={formik.handleBlur} error={fe.nextDueDate} touched={ft.nextDueDate} minDate={fv.lastInspection}/>
                </Field>
                <Field label="SHELF EXPIRY">
                  <DateInput id="shelfExpiry" name="shelfExpiry" value={fv.shelfExpiry} onChange={formik.handleChange} onBlur={formik.handleBlur} minDate={new Date().toISOString().split('T')[0]}/>
                </Field>
              </div>
            </div>
          </div>
        </div>

        {/* ════ RIGHT ════ */}
        <div className="fe-reg-right">

          {/* Digital Tagging Preview — REAL QR */}
          <div className="fe-card fe-reg-tag-card">
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%' }}>
              <p className="fe-reg-tag-label" style={{ margin:0 }}>DIGITAL TAGGING PREVIEW</p>
              <span style={{ fontSize:9, color:qrGenerated ? 'rgba(22,201,136,0.7)' : 'rgba(148,163,184,0.5)', fontWeight:800, letterSpacing:'0.07em' }}>
                {qrGenerated ? '● LIVE' : '○ PENDING'}
              </span>
            </div>
            
            {!qrGenerated ? (
              <button type="button"
                style={{ 
                  width:'100%', marginTop:12, display:'flex', alignItems:'center', justifyContent:'center',
                  gap:8, padding:'14px', background:'linear-gradient(135deg, #2a7bd6, #1a55a8)', 
                  border:'1px solid rgba(58,130,255,0.35)', borderRadius:10, 
                  color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer',
                  boxShadow:'0 4px 14px rgba(42,123,214,0.28)', transition:'filter 0.15s'
                }}
                onClick={handleGenerateQR}
                onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.1)'}
                onMouseLeave={(e) => e.currentTarget.style.filter = 'brightness(1)'}
              >
                <RefreshCw size={15}/> Generate QR Code
              </button>
            ) : (
              <>
                {/* Real-time QR canvas — updates as user fills the form */}
                <QRCanvas unitId={unitId} values={fv} canvasRef={captureQrCanvas}/>
                <p className="fe-reg-unit-label">ASSIGNED UNIT ID</p>
                <p className="fe-reg-unit-id">{unitId}</p>
                <div className="fe-reg-tag-meta">
                  <div className="fe-reg-tag-row">
                    <span className="fe-reg-tag-key">Status</span>
                    <span className="fe-reg-tag-val" style={{ color:'#4deba0', fontWeight:800 }}>READY TO REGISTER</span>
                  </div>
                  <div className="fe-reg-tag-row">
                    <span className="fe-reg-tag-key">Encryption</span>
                    <span className="fe-reg-tag-val">AES-256 Bit</span>
                  </div>
                </div>
                <button type="button"
                  style={{ width:'100%', marginTop:8, display:'flex', alignItems:'center', justifyContent:'center',
                    gap:6, padding:'7px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)',
                    borderRadius:8, color:'rgba(148,163,184,0.7)', fontSize:11, fontWeight:700, cursor:'pointer' }}
                  onClick={() => printTag(unitId, qrCanvasRef.current)}
                  title="Preview print tag">
                  <RefreshCw size={11}/> Preview Tag Print
                </button>
              </>
            )}
          </div>

          {/* Initial State Capture */}
          <div className="fe-card fe-reg-photo-card">
            <p className="fe-reg-tag-label" style={{ padding:'14px 16px 0' }}>INITIAL STATE CAPTURE</p>
            <div className="fe-reg-photo-area">
              {photo ? (
                <div style={{ position:'relative', width:'100%', height:'100%' }}>
                  <img src={photo.dataUrl} alt="Asset"
                    style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:8 }}/>
                  <button type="button" onClick={() => setPhoto(null)}
                    style={{ position:'absolute', top:6, right:6, width:24, height:24, borderRadius:'50%',
                      background:'rgba(0,0,0,0.7)', border:'none', color:'#fff', cursor:'pointer',
                      display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <X size={12}/>
                  </button>
                </div>
              ) : (
                <label className="fe-reg-photo-label">
                  <Camera size={28} style={{ color:'rgba(148,163,184,0.5)', marginBottom:6 }}/>
                  <span style={{ fontWeight:700, color:'rgba(235,242,255,0.75)', fontSize:13 }}>Upload Photo</span>
                  <span style={{ fontSize:11, color:'rgba(148,163,184,0.45)' }}>Capture pressure gauge and seal</span>
                  <input ref={photoRef} type="file" accept="image/*" style={{ display:'none' }}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f); e.target.value='' }}/>
                </label>
              )}
            </div>
          </div>

          {/* CTA */}
          <button type="button" className="fe-btn fe-btn--primary fe-reg-cta-btn"
            onClick={() => formik.handleSubmit()} disabled={saving}>
            {saving ? <span className="fe-spinner" style={{ width:15, height:15 }}/> : <Printer size={15}/>}
            Register &amp; Print Tag
          </button>
          <button type="button" className="fe-reg-draft-btn" onClick={handleSaveDraft} disabled={saving}>
            <Save size={13}/> Save Draft &amp; Exit
          </button>
        </div>
      </div>
    </div>
  )
}
