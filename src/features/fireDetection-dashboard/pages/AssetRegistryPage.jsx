import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShieldAlert, Activity, MapPin, Calendar, QrCode,
  Crosshair, AlertTriangle, TrendingUp, Check, Play,
  Wifi, HelpCircle, FileText, CheckCircle, ExternalLink, RefreshCw,
  ChevronDown, X, AlertCircle
} from 'lucide-react'
import { useFireDetectionData } from '../hooks/useFireDetectionData.js'
import QRCode from 'qrcode'
import { CustomDatePicker } from '../components/CustomDatePicker.jsx'
import { useModulePath } from '../../../shared/navigation/modulePaths.js'
import '../fd.css'

export function AssetRegistryPage() {
  const navigate = useNavigate()
  const fdPath = useModulePath('/detection', '/client/fire-safety/detection')
  
  const {
    assets, alerts, loading,
    totalAssets,
    addAsset, addActivityEntry
  } = useFireDetectionData()

  // Leaflet loading state
  const [leafletLoaded, setLeafletLoaded] = useState(false)
  const [leafletLib, setLeafletLib] = useState(null)

  // UI Selection states
  const [selectedAssetId, setSelectedAssetId] = useState(null)
  const [assetDropdownOpen, setAssetDropdownOpen] = useState(false)
  const [qrGenerated, setQrGenerated] = useState(false)
  const [formQrGenerated, setFormQrGenerated] = useState(false)
  const [formQrData, setFormQrData] = useState(null)

  // Form states
  const [formHydrantId, setFormHydrantId] = useState('')
  const [formHydrantType, setFormHydrantType] = useState('')
  const [formCoords, setFormCoords] = useState('')
  const [formInstallDate, setFormInstallDate] = useState('')

  // Error message state
  const [formError, setFormError] = useState('')

  // Map Modals
  const [showMapModal, setShowMapModal] = useState(false)
  const [tempGps, setTempGps] = useState(null)

  // Custom Dropdown for Hydrant Type in form
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false)
  const typeDropdownRef = useRef(null)
  const assetDropdownRef = useRef(null)

  // Drone simulation state
  const [droneModalOpen, setDroneModalOpen] = useState(false)
  const [droneStep, setDroneStep] = useState(0)
  const [droneLog, setDroneLog] = useState([])

  // QR Code canvas reference
  const qrCanvasRef = useRef(null)

  // Leaflet Map elements references
  const previewMapRef = useRef(null)
  const previewLeafletRef = useRef(null)
  const previewMarkerRef = useRef(null)

  const modalMapRef = useRef(null)
  const modalLeafletRef = useRef(null)

  // ── Helper: Format and Parse Coordinates ──
  const formatGPS = useCallback((lat, lng) => {
    if (lat == null || lng == null) return ''
    const latDir = lat >= 0 ? 'N' : 'S'
    const lngDir = lng >= 0 ? 'E' : 'W'
    return `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lng).toFixed(4)}° ${lngDir}`
  }, [])

  const parseGPS = useCallback((str) => {
    if (!str) return null
    const matches = str.match(/-?\d+\.?\d*/g)
    if (matches && matches.length >= 2) {
      let lat = parseFloat(matches[0])
      let lng = parseFloat(matches[1])
      if (str.toUpperCase().includes('S') && lat > 0) lat = -lat
      if (str.toUpperCase().includes('W') && lng > 0) lng = -lng
      return { lat, lng }
    }
    return null
  }, [])

  // ── Lazy load Leaflet ──
  useEffect(() => {
    let cancelled = false
    async function loadLeaflet() {
      try {
        const mod = await import('leaflet')
        const leaflet = mod.default ?? mod
        
        if (!document.getElementById('leaflet-css')) {
          const link = document.createElement('link')
          link.id = 'leaflet-css'
          link.rel = 'stylesheet'
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
          document.head.appendChild(link)
        }
        
        if (!cancelled) {
          setLeafletLib(leaflet)
          setLeafletLoaded(true)
        }
      } catch (error) {
        console.error('Failed to load Leaflet:', error)
      }
    }
    loadLeaflet()
    return () => { cancelled = true }
  }, [])

  // Select asset logic
  const selectedAsset = assets.find((a) => a.id === selectedAssetId) || assets[0]

  // Handle QR code generation
  const handleGenerateQR = () => {
    setQrGenerated(true)
  }

  // Handle QR code download
  const handleDownloadQR = () => {
    if (!qrCanvasRef.current || !formQrData) return
    
    // Create a new canvas to combine QR code and asset info
    const qrCanvas = qrCanvasRef.current
    const combinedCanvas = document.createElement('canvas')
    const ctx = combinedCanvas.getContext('2d')
    
    // Set canvas size (QR code + space for text)
    const qrSize = 126
    const textHeight = 120
    const padding = 20
    combinedCanvas.width = qrSize + (padding * 2)
    combinedCanvas.height = qrSize + textHeight + (padding * 2)
    
    // Fill white background
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, combinedCanvas.width, combinedCanvas.height)
    
    // Draw border
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 2
    ctx.strokeRect(1, 1, combinedCanvas.width - 2, combinedCanvas.height - 2)
    
    // Draw QR code
    ctx.drawImage(qrCanvas, padding, padding)
    
    // Draw asset info text
    ctx.fillStyle = '#000000'
    ctx.font = 'bold 14px Arial'
    ctx.textAlign = 'center'
    
    const startY = qrSize + padding + 20
    const lineHeight = 18
    
    ctx.fillText('ASSET DIGITAL TAG', combinedCanvas.width / 2, startY)
    
    ctx.font = '12px Arial'
    ctx.fillText(`Asset ID: ${selectedAsset.assetId}`, combinedCanvas.width / 2, startY + lineHeight)
    ctx.fillText(`Unit ID: ${selectedAsset.assignedUnitId}`, combinedCanvas.width / 2, startY + (lineHeight * 2))
    ctx.fillText(`Type: ${selectedAsset.type}`, combinedCanvas.width / 2, startY + (lineHeight * 3))
    ctx.fillText(`Status: ${(selectedAsset.status || '—').toUpperCase()}`, combinedCanvas.width / 2, startY + (lineHeight * 4))
    
    // Download the combined canvas
    const dataUrl = combinedCanvas.toDataURL('image/png')
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = `QR_${selectedAsset.assetId}_${selectedAsset.assignedUnitId}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Handle QR code print
  const handlePrintQR = () => {
    if (!selectedAsset) return
    
    // Create print content with QR code and asset info
    const printWindow = window.open('', '_blank')
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>QR Code - ${formQrData.assetId}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 40px;
            margin: 0;
          }
          .print-container {
            border: 2px solid #000;
            border-radius: 12px;
            padding: 30px;
            text-align: center;
            background: #fff;
          }
          .qr-code {
            margin-bottom: 20px;
          }
          .asset-info {
            margin-top: 20px;
            text-align: left;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            margin: 10px 0;
            border-bottom: 1px solid #ddd;
            padding-bottom: 5px;
          }
          .label {
            font-weight: bold;
            color: #555;
          }
          .value {
            color: #000;
          }
          h2 {
            margin: 0 0 20px 0;
            color: #000;
          }
        </style>
      </head>
      <body>
        <div class="print-container">
          <h2>ASSET DIGITAL TAG</h2>
          <div class="qr-code">
            <img src="${qrCanvasRef.current.toDataURL()}" width="150" height="150" />
          </div>
          <div class="asset-info">
            <div class="info-row">
              <span class="label">Asset ID:</span>
              <span class="value">${formQrData.assetId}</span>
            </div>
            <div class="info-row">
              <span class="label">Unit ID:</span>
              <span class="value">${formQrData.assignedUnitId}</span>
            </div>
            <div class="info-row">
              <span class="label">Type:</span>
              <span class="value">${formQrData.type}</span>
            </div>
            <div class="info-row">
              <span class="label">Status:</span>
              <span class="value">READY TO SUBMIT</span>
            </div>
            <div class="info-row">
              <span class="label">Sector:</span>
              <span class="value">${formQrData.sector}</span>
            </div>
            <div class="info-row">
              <span class="label">Installation Date:</span>
              <span class="value">${formQrData.installationDate}</span>
            </div>
          </div>
        </div>
      </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

  // ── Render QR Code canvas for selected asset (existing asset) ──
  useEffect(() => {
    if (selectedAsset && qrGenerated && qrCanvasRef.current) {
      console.log('Generating QR code for asset:', selectedAsset.id)
      // Use Android intent URL for mobile app scanning
      const inspectionUrl = `intent://forms/fire-extinguisher-inspection#Intent;scheme=safetymate;package=com.upward.safetymate;end`
      console.log('QR URL:', inspectionUrl)
      QRCode.toCanvas(
        qrCanvasRef.current,
        inspectionUrl,
        {
          width: 126,
          height: 126,
          margin: 1,
          color: {
            dark: '#080d1a',
            light: '#ffffff'
          }
        },
        (err) => {
          if (err) {
            console.error('QR code generation error:', err)
          } else {
            console.log('QR code generated successfully')
          }
        }
      )
    }
  }, [selectedAsset, qrGenerated])

  // ── Render QR Code canvas for form preview (new asset) ──
  useEffect(() => {
    if (formQrGenerated && formQrData && qrCanvasRef.current) {
      console.log('Generating QR code for new asset:', formQrData.assetId)
      // Use Android intent URL for mobile app scanning with assetId parameter
      const inspectionUrl = `intent://forms/fire-extinguisher-inspection#Intent;scheme=safetymate;package=com.upward.safetymate;end`
      console.log('QR URL:', inspectionUrl)
      QRCode.toCanvas(
        qrCanvasRef.current,
        inspectionUrl,
        {
          width: 126,
          height: 126,
          margin: 1,
          color: {
            dark: '#080d1a',
            light: '#ffffff'
          }
        },
        (err) => {
          if (err) {
            console.error('QR code generation error:', err)
          } else {
            console.log('QR code generated successfully')
          }
        }
      )
    }
  }, [formQrGenerated, formQrData])

  // ── Render/Sync Inline map preview ──
  useEffect(() => {
    if (!leafletLoaded || !leafletLib || !previewMapRef.current) return

    const parsed = parseGPS(formCoords)

    // Remove map if no valid coordinates
    if (!parsed) {
      if (previewLeafletRef.current) {
        previewLeafletRef.current.remove()
        previewLeafletRef.current = null
        previewMarkerRef.current = null
      }
      return
    }

    const center = [parsed.lat, parsed.lng]

    if (!previewLeafletRef.current) {
      delete leafletLib.Icon.Default.prototype._getIconUrl
      leafletLib.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
      })

      const map = leafletLib.map(previewMapRef.current, {
        center: center,
        zoom: 15,
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        scrollWheelZoom: false,
        touchZoom: false,
        doubleClickZoom: false,
        boxZoom: false
      })

      leafletLib.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19
      }).addTo(map)

      const marker = leafletLib.marker(center).addTo(map)

      previewLeafletRef.current = map
      previewMarkerRef.current = marker
    } else {
      const map = previewLeafletRef.current
      const marker = previewMarkerRef.current
      map.setView(center, 15)
      marker.setLatLng(center)
    }
  }, [leafletLoaded, leafletLib, formCoords, parseGPS])

  // Clean up inline map preview on unmount
  useEffect(() => {
    return () => {
      if (previewLeafletRef.current) {
        previewLeafletRef.current.remove()
        previewLeafletRef.current = null
        previewMarkerRef.current = null
      }
    }
  }, [])

  // ── Render GPS selection map in modal ──
  useEffect(() => {
    if (!showMapModal || !leafletLoaded || !modalMapRef.current || !leafletLib) {
      return
    }

    const parsed = parseGPS(formCoords) || { lat: 40.7128, lng: -74.0060 }
    const center = [parsed.lat, parsed.lng]
    setTempGps(parsed)

    const timer = setTimeout(() => {
      const container = modalMapRef.current
      if (!container) {
        console.error('Map container not found')
        return
      }

      if (container.offsetWidth === 0 || container.offsetHeight === 0) {
        console.error('Map container has zero dimensions')
        return
      }

      if (modalLeafletRef.current) {
        modalLeafletRef.current.remove()
        modalLeafletRef.current = null
      }

      try {
        const map = leafletLib.map(container, {
          center: center,
          zoom: 13,
          zoomControl: true,
          attributionControl: false
        })

        leafletLib.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          maxZoom: 19
        }).addTo(map)

        const marker = leafletLib.marker(center).addTo(map)

        map.on('click', (e) => {
          const { lat, lng } = e.latlng
          setTempGps({ lat, lng })
          marker.setLatLng(e.latlng)
        })

        setTimeout(() => {
          map.invalidateSize()
        }, 100)

        modalLeafletRef.current = map
      } catch (error) {
        console.error('Failed to initialize map:', error)
      }
    }, 300)

    return () => {
      clearTimeout(timer)
      if (modalLeafletRef.current) {
        modalLeafletRef.current.remove()
        modalLeafletRef.current = null
      }
    }
  }, [showMapModal, leafletLoaded, leafletLib, parseGPS, formCoords])

  // Click outside click-to-close dropdown handlers
  useEffect(() => {
    function clickOutside(e) {
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(e.target)) {
        setTypeDropdownOpen(false)
      }
      if (assetDropdownRef.current && !assetDropdownRef.current.contains(e.target)) {
        setAssetDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', clickOutside)
    return () => document.removeEventListener('mousedown', clickOutside)
  }, [])

  // GPS Map Selection confirmer
  const handleConfirmGps = () => {
    if (tempGps) {
      setFormCoords(formatGPS(tempGps.lat, tempGps.lng))
    }
    setShowMapModal(false)
  }

  // Handle Hydrant Registration Form submission
  const handleRegister = async (e) => {
    e.preventDefault()
    setFormError('')
    
    // Validate all fields
    if (!formHydrantId || !formHydrantId.trim()) {
      setFormError('Please enter a Hydrant ID.')
      return
    }
    
    // Check for duplicate hydrant ID
    const duplicateAsset = assets.find(a => 
      a.assetId?.toLowerCase() === formHydrantId.trim().toLowerCase()
    )
    if (duplicateAsset) {
      setFormError(`A hydrant with ID "${formHydrantId}" already exists. Please use a unique ID.`)
      return
    }
    
    if (!formHydrantType) {
      setFormError('Please select a Hydrant Type.')
      return
    }
    if (!formCoords || !formCoords.trim()) {
      setFormError('Please enter or select GPS coordinates.')
      return
    }
    if (!formInstallDate) {
      setFormError('Please select an installation date.')
      return
    }

    const parsed = parseGPS(formCoords) || { lat: 40.7128, lng: -74.0060 }
    const randomUnitId = `HYD-${formHydrantId.trim().toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`
    const sectorName = `Sector ${Math.floor(Math.random() * 9) + 1}${String.fromCharCode(65 + Math.floor(Math.random() * 8))}`

    // Create QR data
    const qrData = {
      assetId: formHydrantId,
      serialNumber: `SN-${Math.floor(10000 + Math.random() * 90000)}-A`,
      type: formHydrantType,
      gps: parsed,
      installationDate: formInstallDate,
      assignedUnitId: randomUnitId,
      sector: sectorName
    }
    
    setFormQrData(qrData)
    setFormQrGenerated(true)

    // Immediately register to database
    const newAsset = {
      assetId: qrData.assetId,
      serialNumber: qrData.serialNumber,
      type: qrData.type,
      gps: qrData.gps,
      installationDate: qrData.installationDate,
      status: 'pending',
      flowRate: 4500,
      flowPerformance: 95,
      pressure: 12.4,
      leakStatus: 'NEG_SECURE',
      encryption: 'AES-256 Bit',
      assignedUnitId: qrData.assignedUnitId,
      sector: qrData.sector,
      lastServiceDate: qrData.installationDate
    }

    try {
      const docRef = await addAsset(newAsset)
      await addActivityEntry({
        type: 'registration',
        message: `Registered hydrant ${qrData.assetId} with unit ID ${qrData.assignedUnitId} in ${qrData.sector}.`,
        status: 'success',
        assetId: docRef.id
      })

      setSelectedAssetId(docRef.id)

      // Reset form
      setFormHydrantId('')
      setFormHydrantType('')
      setFormCoords('')
      setFormInstallDate('')
      setFormQrGenerated(false)
      setFormQrData(null)

      // Show success message
      setFormError(`Hydrant "${qrData.assetId}" registered successfully!`)
      setTimeout(() => setFormError(''), 3000)
    } catch (err) {
      console.error('Registration failed:', err)
      setFormError(`Failed to register hydrant: ${err.message || 'Unknown error'}`)
      // Reset QR state on error
      setFormQrGenerated(false)
      setFormQrData(null)
    }
  }

  // Visual Verification Drone Scan simulator / Navigate to Inspection Page
  const handleLaunchInspection = () => {
    if (!selectedAsset) return
    // Navigate to Inspection Page with selected asset id
    navigate(fdPath(`/inspection?id=${selectedAsset.id}`))
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '60vh', gap: 16, color: 'rgba(148,163,184,0.8)' }}>
        <span className="fd-spinner fd-spinner--lg" />
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          Connecting to technical telemetry backend...
        </span>
      </div>
    )
  }

  const alertCountStr = String(alerts.length).padStart(2, '0')

  return (
    <div className="fd-subpage">
      {/* ── Page Header ── */}
      <div className="fd-ar-header-layout">
        <div className="fd-ar-header-text">
          <h1 style={{ margin: '0 0 6px', fontSize: 'clamp(1.4rem, 3vw, 1.8rem)', fontWeight: 900, color: 'rgba(235,242,255,0.97)', letterSpacing: '-0.025em' }}>
            Hydrant Registration & Monitoring
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: 'rgba(148,163,184,0.72)', fontWeight: 500 }}>
            Register mission-critical fire suppression assets with sub-meter precision and high-density technical telemetry.
          </p>
        </div>

        <div className="fd-ar-kpis">
          <div className="fd-ar-kpi">
            <div className="fd-ar-kpi-label">TOTAL ASSETS</div>
            <div className="fd-ar-kpi-value blue">{totalAssets.toLocaleString()}</div>
          </div>
          <div className="fd-ar-kpi">
            <div className="fd-ar-kpi-label">ACTIVE ALERTS</div>
            <div className="fd-ar-kpi-value red">{alertCountStr}</div>
          </div>
        </div>
      </div>

      {/* ── Maintenance Telemetry Panel ── */}
      <div className="fd-mt-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <div className="fd-mt-header" style={{ margin: 0 }}>
            <Activity size={14} className="fd-mt-header-icon" />
            MAINTENANCE TELEMETRY
          </div>
        </div>

        <div className="fd-mt-flow-rate-label">
          <span>WATER FLOW RATE</span>
          <span style={{ color: '#3a82ff', fontWeight: 800 }}>
            {selectedAsset?.flowRate != null ? `${selectedAsset.flowRate.toLocaleString()} L/min` : '—'}
          </span>
        </div>
        <div className="fd-mt-progress-track">
          <div
            className="fd-mt-progress-bar"
            style={{ width: `${selectedAsset?.flowPerformance || 0}%` }}
          />
        </div>

        <div className="fd-mt-grid">
          <div className="fd-mt-subcard">
            <div className="fd-mt-subcard-label">LAST PRESSURE</div>
            <div className="fd-mt-subcard-value">
              {selectedAsset?.pressure != null ? `${selectedAsset.pressure.toFixed(1)} BAR` : '—'}
            </div>
          </div>

          <div className="fd-mt-subcard">
            <div className="fd-mt-subcard-label">LEAK STATUS</div>
            <div className={`fd-mt-subcard-value ${selectedAsset?.leakStatus === 'POS_LEAK' ? 'red' : 'green'}`}>
              {selectedAsset?.leakStatus || '—'}
            </div>
          </div>
        </div>
      </div>

      {/* ── Digital Tagging Preview Panel ── */}
      <div className="fd-dt-card">
        <div className="fd-dt-header">DIGITAL TAGGING PREVIEW</div>
        <div className="fd-dt-body">
          {!formQrGenerated ? (
            <div style={{ textAlign: 'center', color: 'rgba(148,163,184,0.5)', padding: '40px 0' }}>
              Fill the registration form and click "Save and Generate QR" to generate QR code
            </div>
          ) : (
            <>
              <div className="fd-dt-qr-container">
                <canvas ref={qrCanvasRef} />
              </div>
              <div className="fd-dt-unit-label">ASSIGNED UNIT ID</div>
              <div className="fd-dt-unit-id">{formQrData?.assignedUnitId || '—'}</div>

              <div className="fd-dt-row">
                <span className="fd-dt-row-label">Status</span>
                <span className="fd-dt-row-value" style={{ color: '#4deba0' }}>
                  READY TO SUBMIT
                </span>
              </div>

              <div className="fd-dt-row">
                <span className="fd-dt-row-label">Encryption</span>
                <span className="fd-dt-row-value">AES-256 Bit</span>
              </div>

              <div className="fd-dt-row">
                <span className="fd-dt-row-label">Asset ID</span>
                <span className="fd-dt-row-value">{formQrData?.assetId || '—'}</span>
              </div>

              <div className="fd-dt-row">
                <span className="fd-dt-row-label">Type</span>
                <span className="fd-dt-row-value">{formQrData?.type || '—'}</span>
              </div>

              <div className="fd-dt-row">
                <span className="fd-dt-row-label">Sector</span>
                <span className="fd-dt-row-value">{formQrData?.sector || '—'}</span>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'center' }}>
                <button
                  type="button"
                  className="fd-btn fd-btn--ghost"
                  onClick={handleDownloadQR}
                  style={{ padding: '8px 16px', fontSize: 12 }}
                >
                  Download
                </button>
                <button
                  type="button"
                  className="fd-btn fd-btn--primary"
                  onClick={handlePrintQR}
                  style={{ padding: '8px 16px', fontSize: 12 }}
                >
                  Print
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Asset Inventory Section ── */}
      <div style={{ marginTop: 32, marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={18} style={{ color: '#3a82ff' }} />
            ASSET INVENTORY
          </h2>
          <div style={{ fontSize: 12, color: 'rgba(148,163,184,0.6)' }}>
            {assets.length} registered hydrant{assets.length !== 1 ? 's' : ''}
          </div>
        </div>

        {assets.length === 0 ? (
          <div style={{
            background: '#0b0f1a',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12,
            padding: 40,
            textAlign: 'center',
            color: 'rgba(148,163,184,0.5)'
          }}>
            <Activity size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
            <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>No hydrants registered yet</p>
            <p style={{ fontSize: 12 }}>Use the registration form to add your first hydrant</p>
          </div>
        ) : (
          <div style={{
            background: '#0b0f1a',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12,
            overflow: 'hidden'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <th style={{ padding: '16px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Asset ID
                  </th>
                  <th style={{ padding: '16px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Type
                  </th>
                  <th style={{ padding: '16px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Sector
                  </th>
                  <th style={{ padding: '16px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Status
                  </th>
                  <th style={{ padding: '16px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Installation Date
                  </th>
                  <th style={{ padding: '16px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Unit ID
                  </th>
                </tr>
              </thead>
              <tbody>
                {assets.map((asset) => (
                  <tr
                    key={asset.id}
                    onClick={() => navigate(fdPath(`/assets/${asset.id}`))}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      cursor: 'pointer',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(58,130,255,0.08)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '16px', fontSize: 13, fontWeight: 600, color: '#fff' }}>
                      {asset.assetId}
                    </td>
                    <td style={{ padding: '16px', fontSize: 13, color: 'rgba(235,242,255,0.8)' }}>
                      {asset.type}
                    </td>
                    <td style={{ padding: '16px', fontSize: 13, color: 'rgba(235,242,255,0.8)' }}>
                      {asset.sector}
                    </td>
                    <td style={{ padding: '16px' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 10px',
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 700,
                        background: asset.status === 'active' ? 'rgba(77,235,160,0.1)' : 'rgba(148,163,184,0.1)',
                        color: asset.status === 'active' ? '#4deba0' : 'rgba(235,242,255,0.8)'
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: asset.status === 'active' ? '#4deba0' : 'rgba(148,163,184,0.4)' }} />
                        {asset.status?.toUpperCase() || 'UNKNOWN'}
                      </span>
                    </td>
                    <td style={{ padding: '16px', fontSize: 13, color: 'rgba(235,242,255,0.8)' }}>
                      {asset.installationDate}
                    </td>
                    <td style={{ padding: '16px', fontSize: 13, color: 'rgba(235,242,255,0.8)' }}>
                      {asset.assignedUnitId}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Asset Registration & Verification Grid ── */}
      <div className="fd-ar-grid">
        {/* Left: Asset Registration Form */}
        <div className="fd-reg-card">
          <div className="fd-reg-header-row">
            <div className="fd-reg-title">
              <Activity size={14} style={{ color: '#3a82ff' }} />
              ASSET REGISTRATION
            </div>
          </div>

          {/* Inline Error Message */}
          {formError && (
            <div className={formError.includes('successfully') ? 'fd-toast-ok' : 'fd-toast-err'} style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 6, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
              {formError.includes('successfully') ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
              {formError}
            </div>
          )}

          <form className="fd-reg-form" onSubmit={handleRegister}>
            {/* Hydrant ID */}
            <div className="fd-reg-field">
              <label className="fd-reg-label">HYDRANT ID</label>
              <input
                type="text"
                className="fd-reg-input"
                value={formHydrantId}
                onChange={(e) => setFormHydrantId(e.target.value)}
                placeholder="e.g. HYD-2024-883"
                required
              />
            </div>

            {/* Hydrant Type Custom Dropdown */}
            <div className="fd-reg-field">
              <label className="fd-reg-label">HYDRANT TYPE</label>
              <div className="fd-custom-select" ref={typeDropdownRef}>
                <div
                  className={`fd-custom-select-trigger ${typeDropdownOpen ? 'open' : ''}`}
                  onClick={() => setTypeDropdownOpen(!typeDropdownOpen)}
                >
                  <span>{formHydrantType || 'Select type'}</span>
                  <ChevronDown size={14} className={`fd-custom-select-chevron ${typeDropdownOpen ? 'open' : ''}`} />
                </div>
                {typeDropdownOpen && (
                  <div className="fd-custom-select-dropdown">
                    {['Dry Barrel', 'Wet Barrel', 'Standpipe', 'Monitor Hydrant'].map((type) => (
                      <div
                        key={type}
                        className={`fd-custom-select-option ${formHydrantType === type ? 'selected' : ''}`}
                        onClick={() => {
                          setFormHydrantType(type)
                          setTypeDropdownOpen(false)
                        }}
                      >
                        {type}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Precise Location (GPS) */}
            <div className="fd-reg-field">
              <label className="fd-reg-label">PRECISE LOCATION (GPS)</label>
              <div className="fd-reg-input-group">
                <input
                  type="text"
                  className="fd-reg-input"
                  value={formCoords}
                  onChange={(e) => setFormCoords(e.target.value)}
                  placeholder="e.g. 40.7128° N, 74.0060° W"
                  required
                />
                <button
                  type="button"
                  className="fd-reg-btn-gps"
                  onClick={() => setShowMapModal(true)}
                  title="Select location on real-time map"
                >
                  <Crosshair size={16} />
                </button>
              </div>
            </div>

            {/* Map Preview */}
            <div className="fd-map-preview-wrapper" ref={previewMapRef}>
              {formCoords && parseGPS(formCoords) ? (
                <div className="fd-map-preview-overlay-pill">
                  <span className="fd-map-preview-dot" />
                  {selectedAsset?.sector?.toUpperCase() || 'LOCATION LOCKED'}
                </div>
              ) : (
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  height: '100%', 
                  color: 'rgba(148,163,184,0.4)', 
                  fontSize: 12, 
                  fontWeight: 600 
                }}>
                  No location selected
                </div>
              )}
            </div>

            {/* Installation Date */}
            <CustomDatePicker
              label="INSTALLATION DATE"
              value={formInstallDate}
              onChange={setFormInstallDate}
              placeholder="Select installation date"
              required
              minDate={new Date().toISOString().split('T')[0]}
            />

            {/* Register Action Button */}
            <button
              type="submit"
              className="fd-btn fd-btn--primary"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px', marginTop: 10 }}
            >
              <FileText size={15} /> Register & Generate QR
            </button>

            {/* QR Preview after generation */}
            {formQrGenerated && formQrData && (
              <div style={{ marginTop: 20, padding: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <QrCode size={16} style={{ color: '#4deba0' }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#4deba0', letterSpacing: '0.06em' }}>QR CODE GENERATED</span>
                </div>
                <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.7)', lineHeight: 1.5 }}>
                  <div><strong>Asset ID:</strong> {formQrData.assetId}</div>
                  <div><strong>Unit ID:</strong> {formQrData.assignedUnitId}</div>
                  <div><strong>Sector:</strong> {formQrData.sector}</div>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Right: Visual Asset Verification Module */}
        <div
          className="fd-vav-card"
          style={{ backgroundImage: 'url(/fire_hydrant_verification.png)' }}
        >
          <div className="fd-vav-overlay" />
          <div className="fd-vav-content">
            <h3 className="fd-vav-title">Visual Asset Verification Module</h3>
            <p className="fd-vav-text">
              Remote drone visual confirmation pending for {selectedAsset?.sector || 'Sector 7G'} hydrant integrity check.
            </p>
            <button
              type="button"
              className="fd-btn fd-btn--primary"
              style={{
                padding: '12px 24px',
                fontSize: 13,
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10
              }}
              onClick={handleLaunchInspection}
              disabled={!selectedAsset}
            >
              <Play size={14} fill="currentColor" /> LAUNCH INSPECTION
            </button>
          </div>
        </div>
      </div>

      {/* ── Leaflet Selection Map Modal ── */}
      {showMapModal && (
        <div className="fd-modal-overlay" onClick={() => setShowMapModal(false)}>
          <div className="fd-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="fd-modal-title">
              <MapPin size={18} style={{ color: '#3a82ff' }} />
              Precise Location Coordinates
              <button
                type="button"
                className="fd-modal-close"
                onClick={() => setShowMapModal(false)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="fd-reg-body">
              <p style={{ margin: '0 0 12px', fontSize: 12, color: 'rgba(148, 163, 184, 0.7)' }}>
                Click anywhere on the interactive map below to auto-capture sub-meter coordinate parameters.
              </p>

              {/* Map Canvas Container */}
              <div 
                className="fd-modal-map-container" 
                ref={modalMapRef} 
                style={{ minHeight: '350px', width: '100%' }}
              />

              <div style={{ background: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: 'rgba(148, 163, 184, 0.6)' }}>CAPTURED TELEMETRY</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#4deba0' }}>
                  {tempGps ? `${tempGps.lat.toFixed(6)}° N, ${tempGps.lng.toFixed(6)}° W` : '—'}
                </span>
              </div>
            </div>
            <div className="fd-modal-actions" style={{ marginTop: 20 }}>
              <button
                type="button"
                className="fd-btn fd-btn--ghost"
                onClick={() => setShowMapModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="fd-btn fd-btn--primary"
                onClick={handleConfirmGps}
                disabled={!tempGps}
              >
                Confirm Location
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Drone Verification Simulation Modal ── */}
      {droneModalOpen && (
        <div className="fd-modal-overlay">
          <div className="fd-modal" style={{ maxWidth: 500, background: '#070a13', border: '1px solid rgba(58,130,255,0.25)' }}>
            <div className="fd-modal-title" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#3a82ff', fontWeight: 900 }}>
                <Wifi size={16} className="fd-spinner" style={{ animationDuration: '3s' }} />
                DRONE SCOUT DISPATCHED
              </span>
            </div>

            <div className="fd-reg-body" style={{ padding: '20px 0' }}>
              {/* Drone Progress Steps */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
                {[
                  'Deploying Sentinel drone',
                  'Calibrating telemetry',
                  'Capturing visual feed',
                  'Validating structural integrity'
                ].map((text, i) => {
                  const stepNum = i + 1
                  const isDone = droneStep > stepNum
                  const isActive = droneStep === stepNum
                  return (
                    <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: isDone || isActive ? 1 : 0.3, transition: 'opacity 0.3s' }}>
                      <div
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 10,
                          fontWeight: 800,
                          background: isDone ? '#16c988' : isActive ? '#3a82ff' : 'rgba(255,255,255,0.08)',
                          color: isDone || isActive ? '#fff' : 'rgba(148,163,184,0.6)'
                        }}
                      >
                        {isDone ? <Check size={10} /> : stepNum}
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: isActive ? '#fff' : 'rgba(235,242,255,0.8)' }}>
                        {text}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Console log output */}
              <div
                style={{
                  background: '#020408',
                  padding: 12,
                  borderRadius: 6,
                  fontFamily: 'monospace',
                  fontSize: 11,
                  height: 120,
                  overflowY: 'auto',
                  border: '1px solid rgba(255,255,255,0.05)',
                  color: '#4deba0'
                }}
              >
                {droneLog.map((logLine, idx) => (
                  <div key={idx} style={{ marginBottom: 4 }}>{logLine}</div>
                ))}
              </div>
            </div>

            <div className="fd-modal-actions" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 16 }}>
              <button
                type="button"
                className="fd-btn fd-btn--primary"
                onClick={() => setDroneModalOpen(false)}
                disabled={droneStep < 6}
                style={{ minWidth: 100 }}
              >
                {droneStep < 6 ? 'Inspection Active...' : 'Close & Sync'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
