import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Upload, MapPin, RefreshCw, CheckCircle, ChevronDown } from 'lucide-react'
import QRCode from 'qrcode'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { doc, getDoc, setDoc, arrayUnion } from 'firebase/firestore'
import { db } from '../../../config/firebase.js'
import { useFireDetectionData } from '../hooks/useFireDetectionData.js'
import { useAuth } from '../../../app/providers/authContext.js'
import { CustomDatePicker } from '../components/CustomDatePicker.jsx'
import '../fd.css'

// Fix for default marker icon in Leaflet
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// Generate panel unit ID
function genUnitId() {
  const arr = new Uint16Array(1)
  crypto.getRandomValues(arr)
  const n = 1000 + (arr[0] % 9000)
  return `FG-${n}`
}

// Build QR payload
function buildQrPayload(unitId, values) {
  return JSON.stringify({
    id: unitId,
    type: values?.panelType || 'Pending',
    sn: values?.serialNumber || 'Pending',
    zone: values?.zone || 'Pending',
    url: `${window.location.origin}/detection/panels?id=${unitId}`
  })
}

// QR Canvas component
function QRCanvas({ unitId, values, canvasRef: canvasRefCallback }) {
  const canvasRef = useRef(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

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
      width: 126,
      margin: 1,
      color: {
        dark: '#080d1a',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'H'
    })
      .then(() => setLoading(false))
      .catch((err) => {
        console.warn('QR generation failed:', err)
        setError('QR generation failed')
        setLoading(false)
      })
  }, [unitId, values?.panelType, values?.serialNumber, values?.zone])

  return (
    <div className="fd-dt-qr-container">
      <canvas ref={setRef} style={{ display: loading || error ? 'none' : 'block' }} />
      {loading && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="fd-spinner fd-spinner--lg" />
        </div>
      )}
      {error && !loading && (
        <p style={{ margin: 0, fontSize: 11, color: 'rgba(148,163,184,0.6)', textAlign: 'center', padding: 4 }}>
          QR unavailable
        </p>
      )}
    </div>
  )
}

// Print helper
function printTag(unitId, canvasEl) {
  if (!canvasEl) return
  const dataUrl = canvasEl.toDataURL('image/png')
  const win = window.open('', '_blank', 'width=400,height=500')
  if (!win) return
  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Panel Digital Tag - ${unitId}</title>
      <style>
        body {
          font-family: sans-serif;
          background: #fff;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          margin: 0;
          padding: 40px;
          box-sizing: border-box;
        }
        img { width: 180px; height: 180px; border: 2px solid #000; border-radius: 8px; }
        h2 { margin: 12px 0 4px; font-size: 18px; letter-spacing: 0.04em; }
        p { margin: 0; font-size: 12px; color: #555; }
        .tag { border: 2px dashed #ccc; padding: 30px; border-radius: 12px; text-align: center; }
      </style>
    </head>
    <body>
      <div class="tag">
        <p style="font-size:10px;letter-spacing:0.1em;color:#888;text-transform:uppercase;margin-bottom:8px">
          SAFETYMATE - PANEL DIGITAL TAG
        </p>
        <img src="${dataUrl}" alt="QR Code" />
        <h2>${unitId}</h2>
        <p>Scan to view panel details & compliance status</p>
        <p style="margin-top:8px;font-size:10px;color:#999">Encryption: AES-256 Bit</p>
      </div>
      <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 1000) }</script>
    </body>
    </html>
  `)
  win.document.close()
}

// Custom select component for dark theme (plain — no search, for fixed option lists)
function CustomSelect({ id, value, onChange, options, placeholder }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="fd-custom-select" ref={ref} id={id}>
      <div className={`fd-custom-select-trigger ${open ? 'open' : ''}`} onClick={() => setOpen(!open)}>
        <span>{value || placeholder}</span>
        <ChevronDown size={14} className={`fd-custom-select-chevron ${open ? 'open' : ''}`} />
      </div>
      {open && (
        <div className="fd-custom-select-dropdown">
          {options.map(opt => (
            <div
              key={typeof opt === 'string' ? opt : opt.value}
              className={`fd-custom-select-option ${value === (typeof opt === 'string' ? opt : opt.value) ? 'selected' : ''}`}
              onClick={() => { onChange(typeof opt === 'string' ? opt : opt.value); setOpen(false) }}
            >
              {typeof opt === 'string' ? opt : opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Creatable searchable select — search existing options or add new ones saved to Firestore
function CreatableSelect({ id, value, onChange, options, placeholder, onAddOption }) {
  const [open,   setOpen]   = useState(false)
  const [search, setSearch] = useState('')
  const ref       = useRef(null)
  const searchRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setSearch('') }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    if (open && searchRef.current) setTimeout(() => searchRef.current?.focus(), 30)
  }, [open])

  const filtered = search.trim()
    ? options.filter(o => o.toLowerCase().includes(search.trim().toLowerCase()))
    : options

  const hasExactMatch = options.some(o => o.toLowerCase() === search.trim().toLowerCase())
  const showAdd = search.trim().length > 0 && !hasExactMatch

  const handleSelect = (val) => { onChange(val); setSearch(''); setOpen(false) }

  const handleAdd = async () => {
    const newVal = search.trim()
    if (!newVal) return
    if (onAddOption) await onAddOption(newVal)
    onChange(newVal)
    setSearch('')
    setOpen(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered.length === 1) handleSelect(filtered[0])
      else if (showAdd) handleAdd()
    }
    if (e.key === 'Escape') { setOpen(false); setSearch('') }
  }

  return (
    <div ref={ref} style={{ position: 'relative' }} id={id}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 12px',
          background: 'rgba(255,255,255,0.04)',
          border: `1px solid ${open ? 'rgba(58,130,255,0.5)' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: 8,
          color: value ? 'rgba(235,242,255,0.9)' : 'rgba(148,163,184,0.45)',
          fontSize: 13, fontWeight: value ? 600 : 400,
          cursor: 'pointer', textAlign: 'left',
          transition: 'border-color 0.15s',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value || placeholder}
        </span>
        <ChevronDown size={13} style={{ flexShrink: 0, marginLeft: 6, transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'none', color: 'rgba(148,163,184,0.5)' }} />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 300,
          background: '#0d1220', border: '1px solid rgba(58,130,255,0.25)', borderRadius: 10,
          boxShadow: '0 20px 48px rgba(0,0,0,0.8)', overflow: 'hidden',
        }}>
          {/* Search bar — always visible */}
          <div style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(148,163,184,0.45)" strokeWidth="2"
                style={{ position: 'absolute', left: 9, pointerEvents: 'none' }}>
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search or type to add new…"
                autoComplete="off"
                spellCheck={false}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '7px 28px 7px 30px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 7,
                  color: 'rgba(235,242,255,0.9)', fontSize: 12.5, outline: 'none',
                }}
              />
              {search && (
                <button type="button" onMouseDown={(e) => { e.preventDefault(); setSearch('') }}
                  style={{ position: 'absolute', right: 7, background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: 'rgba(148,163,184,0.5)', display: 'flex' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M18 6 6 18M6 6l12 12"/>
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Options list */}
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {filtered.map(opt => (
              <button
                key={opt}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); handleSelect(opt) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%', padding: '9px 14px', border: 'none',
                  background: opt === value ? 'rgba(58,130,255,0.14)' : 'transparent',
                  color: opt === value ? '#8ab8ff' : 'rgba(203,214,255,0.85)',
                  fontSize: 13, fontWeight: opt === value ? 700 : 500,
                  textAlign: 'left', cursor: 'pointer',
                }}
                onMouseEnter={(e) => { if (opt !== value) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                onMouseLeave={(e) => { if (opt !== value) e.currentTarget.style.background = 'transparent' }}
              >
                {opt === value && (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                    <path d="M20 6 9 17l-5-5"/>
                  </svg>
                )}
                {opt}
              </button>
            ))}

            {filtered.length === 0 && !showAdd && (
              <p style={{ margin: 0, padding: '14px', fontSize: 12, color: 'rgba(148,163,184,0.4)', textAlign: 'center' }}>
                No options yet
              </p>
            )}

            {/* Add new row */}
            {showAdd && (
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); handleAdd() }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%', padding: '9px 14px', border: 'none',
                  borderTop: filtered.length > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                  background: 'rgba(22,201,136,0.08)', color: '#4deba0',
                  fontSize: 13, fontWeight: 700, textAlign: 'left', cursor: 'pointer',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(22,201,136,0.15)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(22,201,136,0.08)'}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                  <path d="M12 5v14M5 12h14"/>
                </svg>
                Add &ldquo;{search.trim()}&rdquo;
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Map click handler component
function MapClickHandler({ onMapClick }) {
  const map = useMapEvents({
    click(e) {
      onMapClick(e.latlng)
    }
  })
  return null
}

export function RegisterPanelPage() {
  const navigate = useNavigate()
  const { addPanel, addActivityEntry } = useFireDetectionData()

  const [saving, setSaving] = useState(false)
  const [qrGenerated, setQrGenerated] = useState(false)
  const [unitId] = useState(() => genUnitId())
  const qrCanvasRef = useRef(null)
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)

  // Panel model options — loaded from Firestore, no hardcoded defaults
  const [panelModelOptions, setPanelModelOptions] = useState([])

  useEffect(() => {
    async function loadPanelModels() {
      try {
        const snap = await getDoc(doc(db, 'fd_options', 'panelModels'))
        if (snap.exists() && Array.isArray(snap.data().values)) {
          setPanelModelOptions(snap.data().values)
        }
      } catch (err) {
        console.warn('Could not load panel model options:', err.message)
      }
    }
    loadPanelModels()
  }, [])

  async function handleAddPanelModel(newValue) {
    try {
      await setDoc(
        doc(db, 'fd_options', 'panelModels'),
        { values: arrayUnion(newValue) },
        { merge: true }
      )
      setPanelModelOptions(prev => Array.from(new Set([...prev, newValue])))
    } catch (err) {
      console.warn('Could not save panel model option:', err.message)
      // Still works locally
    }
  }

  // Map state
  const [selectedMapPosition, setSelectedMapPosition] = useState(null)

  // Initialize map
  useEffect(() => {
    if (mapRef.current && !mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current, {
        center: [51.505, -0.09],
        zoom: 13,
        scrollWheelZoom: false
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(mapInstanceRef.current)

      // Apply dark theme filter to tiles
      const tilePane = mapInstanceRef.current.getPanes().tilePane
      tilePane.style.filter = 'grayscale(80%) invert(100%) contrast(120%)'

      // Handle map clicks
      mapInstanceRef.current.on('click', (e) => {
        const { lat, lng } = e.latlng
        setSelectedMapPosition([lat, lng])
        setLocation(`${lat.toFixed(6)}, ${lng.toFixed(6)}`)
      })
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [])

  // Update marker when position changes
  useEffect(() => {
    if (mapInstanceRef.current && selectedMapPosition) {
      // Remove existing markers
      mapInstanceRef.current.eachLayer((layer) => {
        if (layer instanceof L.Marker) {
          mapInstanceRef.current.removeLayer(layer)
        }
      })

      // Add new marker
      L.marker(selectedMapPosition)
        .addTo(mapInstanceRef.current)
        .bindPopup('Selected Location')
        .openPopup()
    }
  }, [selectedMapPosition])

  // Form values
  const [panelModel, setPanelModel] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [location, setLocation] = useState('')
  const [zoneName, setZoneName] = useState('')
  const [priority, setPriority] = useState('Level 1')
  const [installDate, setInstallDate] = useState('')

  const formValues = {
    panelType: panelModel,
    serialNumber,
    zone: zoneName
  }

  // Generate QR code handler
  const handleGenerateQR = () => {
    if (!panelModel || !serialNumber || !location || !zoneName || !installDate) {
      alert('Please fill all required fields before generating QR code.')
      return
    }
    setQrGenerated(true)
  }

  // Confirm registration
  const handleConfirmRegistration = async () => {
    if (!qrGenerated) return

    setSaving(true)
    try {
      const newPanel = {
        panelId: unitId,
        model: panelModel,
        serialNumber,
        location,
        zone: zoneName,
        zoneId: zoneName,
        installDate,
        status: 'nominal',
        sensitivity: 100,
        encryption: 'AES-256 Bit',
        assignedUnitId: unitId
      }

      const docRef = await addPanel(newPanel)

      await addActivityEntry({
        type: 'panel_registration',
        message: `Registered panel ${unitId} (${panelModel}) at ${location} in ${zoneName}`,
        status: 'success',
        panelId: docRef.id
      })

      // Print tag
      printTag(unitId, qrCanvasRef.current)
      navigate('/detection/panels')
    } catch (err) {
      console.error('Panel registration failed:', err)
    } finally {
      setSaving(false)
    }
  }

  // Panel model field uses CreatableSelect above

  return (
    <div className="fd-subpage">
      {/* Back button */}
      <button
        type="button"
        className="fd-btn fd-btn--ghost"
        onClick={() => navigate(-1)}
        style={{ marginBottom: 16, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px' }}
      >
        <ArrowLeft size={16} /> Back
      </button>

      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: '0 0 6px', fontSize: 'clamp(1.4rem, 3vw, 1.8rem)', fontWeight: 900, color: 'rgba(235,242,255,0.97)', letterSpacing: '-0.025em' }}>
          Panel Registry & Zone Allocation
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: 'rgba(148,163,184,0.72)' }}>
          Configure hardware nodes and define spatial alert boundaries.
        </p>
      </div>

      {/* Digital Tagging Preview - Full Width */}
      <div className="fd-dt-card" style={{ marginBottom: 24 }}>
        <div className="fd-dt-header">DIGITAL TAGGING PREVIEW</div>
        <div className="fd-dt-body">
          {!qrGenerated ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'rgba(148,163,184,0.6)', fontSize: 13, fontWeight: 600 }}>
              Generate QR code to preview digital tag
            </div>
          ) : (
            <>
              <QRCanvas unitId={unitId} values={formValues} canvasRef={(el) => { qrCanvasRef.current = el }} />
              <div className="fd-dt-unit-label">ASSIGNED UNIT ID</div>
              <div className="fd-dt-unit-id">{unitId}</div>

              <div className="fd-dt-row">
                <span className="fd-dt-row-label">Status</span>
                <span className="fd-dt-row-value green">PENDING ACTIVATION</span>
              </div>

              <div className="fd-dt-row">
                <span className="fd-dt-row-label">Encryption</span>
                <span className="fd-dt-row-value">AES-256 Bit</span>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'center' }}>
                <button
                  type="button"
                  className="fd-btn fd-btn--ghost"
                  onClick={() => printTag(unitId, qrCanvasRef.current)}
                  style={{ padding: '8px 16px', fontSize: 12 }}
                >
                  Preview Tag
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 24 }}>
        {/* Left column: Register Fire Panel */}
        <div className="fd-card" style={{ padding: '24px 26px', height: 'fit-content' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
            <Upload size={16} style={{ color: '#3a82ff' }} />
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'rgba(235,242,255,0.92)' }}>
              Register Fire Panel
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Panel Model & Firmware */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.55)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Panel Model
                </label>
                <CreatableSelect
                  id="panelModel"
                  value={panelModel}
                  onChange={setPanelModel}
                  options={panelModelOptions}
                  placeholder="Search or add model…"
                  onAddOption={handleAddPanelModel}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.55)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Firmware
                </label>
                <input
                  type="text"
                  placeholder="v4.2.0-stable"
                  value="v4.2.0-stable"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    color: 'rgba(235,242,255,0.8)',
                    fontSize: 13,
                    boxSizing: 'border-box'
                  }}
                  readOnly
                />
              </div>
            </div>

            {/* Serial Number */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.55)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Serial Number
              </label>
              <input
                type="text"
                placeholder="FG-XXXX-XXXX-XXXX"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  color: 'rgba(235,242,255,0.9)',
                  fontSize: 13,
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Installation Location */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.55)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Installation Location
              </label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}>
                <MapPin size={14} style={{ color: 'rgba(148,163,184,0.55)' }} />
                <input
                  type="text"
                  placeholder="Building A, Level 4, Main Lobby"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: 'rgba(235,242,255,0.9)',
                    fontSize: 13
                  }}
                />
              </div>
            </div>

            {/* Note */}
            <div style={{ padding: '12px 14px', background: 'rgba(58,130,255,0.08)', border: '1px solid rgba(58,130,255,0.2)', borderRadius: 8 }}>
              <p style={{ margin: 0, fontSize: 12, color: 'rgba(148,163,184,0.8)', lineHeight: '1.5' }}>
                Note: Registering a new panel will initiate an automatic handshake sequence. Ensure the device is connected to the primary VLAN.
              </p>
            </div>

            {/* Confirm button */}
            <button
              type="button"
              className="fd-btn fd-btn--primary"
              onClick={qrGenerated ? handleConfirmRegistration : handleGenerateQR}
              disabled={saving}
              style={{ width: '100%', padding: '14px', fontWeight: 800 }}
            >
              {qrGenerated ? (
                <>
                  {saving ? <span className="fd-spinner" style={{ width: 14, height: 14 }} /> : <CheckCircle size={16} style={{ marginRight: 8 }} />}
                  Confirm Registration & Print Tag
                </>
              ) : (
                <>
                  <RefreshCw size={16} style={{ marginRight: 8 }} />
                  Generate QR Code
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right column: Zone Allocation Map + QR Preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Zone Allocation Map */}
          <div className="fd-card" style={{ padding: '24px 26px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'rgba(235,242,255,0.92)' }}>
                Zone Allocation Map
              </h3>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, color: '#16c988', background: 'rgba(22,201,136,0.08)', border: '1px solid rgba(22,201,136,0.25)', padding: '4px 10px', borderRadius: 6 }}>
                <div style={{ width: 6, height: 6, background: '#16c988', borderRadius: '50%' }} />
                LIVE SYNC ACTIVE
              </span>
            </div>

            <div style={{ position: 'relative', height: 240, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div
                ref={mapRef}
                style={{ height: '100%', width: '100%', background: 'rgba(10,20,40,0.9)' }}
              />
              <div style={{ position: 'absolute', bottom: 8, left: 8, padding: '6px 10px', background: 'rgba(0,0,0,0.75)', borderRadius: 6, color: 'rgba(235,242,255,0.85)', fontSize: 11, fontWeight: 600, zIndex: 1000 }}>
                Click to place new node
              </div>
            </div>

            {/* Zone selection */}
            <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 140px 1fr', gap: 14, alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.55)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Zone Name
                </label>
                <input
                  type="text"
                  placeholder="Enter zone name"
                  value={zoneName}
                  onChange={(e) => setZoneName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    color: 'rgba(235,242,255,0.9)',
                    fontSize: 13,
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.55)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Priority
                </label>
                <CustomSelect
                  id="prioritySelect"
                  value={priority}
                  onChange={setPriority}
                  options={['Level 1', 'Level 2', 'Level 3']}
                  placeholder="Priority"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.55)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Install Date
                </label>
                <CustomDatePicker
                  value={installDate}
                  onChange={setInstallDate}
                  placeholder="Select date"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
