import { useState, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, ChevronDown, Check, X, AlertTriangle,
  Camera, FileText, MapPin, Clock, CheckCircle2,
  Volume2, Upload, Flame, AlertCircle, Bell, XCircle
} from 'lucide-react'
import { useFireDetectionData } from '../hooks/useFireDetectionData.js'
import { storage } from '../../../config/firebase.js'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { useModulePath } from '../../../shared/navigation/modulePaths.js'
import '../fd.css'

export function PanelInspectionPage() {
  const navigate = useNavigate()
  const fdPath = useModulePath('/detection', '/client/fire-safety/detection')
  const [searchParams] = useSearchParams()
  const panelIdFromUrl = searchParams.get('id')
  
  const { panels, loading, zones, addActivityEntry, updatePanel } = useFireDetectionData()

  // State for panel selection and inspection mode
  const [selectedPanelId, setSelectedPanelId] = useState(panelIdFromUrl || null)
  const [panelDropdownOpen, setPanelDropdownOpen] = useState(false)
  const [inspectionLaunched, setInspectionLaunched] = useState(!!panelIdFromUrl)
  const [panelSearchTerm, setPanelSearchTerm] = useState('')
  const panelDropdownRef = useRef(null)

  // Inspection form state
  const [checklist, setChecklist] = useState({
    smokeDetector: null,
    manualCallPoint: null,
    sirenTest: null,
    sirenAudible: null
  })
  const [faultDescription, setFaultDescription] = useState('')
  const [faultSeverity, setFaultSeverity] = useState(null)
  const [photoEvidence, setPhotoEvidence] = useState(null)
  const [photoFile, setPhotoFile] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [digitalSignature, setDigitalSignature] = useState(false)
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [isTimerRunning, setIsTimerRunning] = useState(false)
  const [alarmTriggered, setAlarmTriggered] = useState(false)
  const [modal, setModal] = useState({ show: false, title: '', message: '', type: 'info' })
  const [formErrors, setFormErrors] = useState({})
  const signatureCanvasRef = useRef(null)
  const signatureRef = useRef(null)

  const selectedPanel = panels.find((p) => p.id === selectedPanelId)

  // Click outside dropdown handler
  useEffect(() => {
    function clickOutside(e) {
      if (panelDropdownRef.current && !panelDropdownRef.current.contains(e.target)) {
        setPanelDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', clickOutside)
    return () => document.removeEventListener('mousedown', clickOutside)
  }, [])

  // When URL param changes
  useEffect(() => {
    if (panelIdFromUrl) {
      setSelectedPanelId(panelIdFromUrl)
      setInspectionLaunched(true)
      setIsTimerRunning(true)
    }
  }, [panelIdFromUrl])

  // Timer effect
  useEffect(() => {
    let interval
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimerSeconds(prev => prev + 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isTimerRunning])

  // Format timer as HH:MM:SS
  const formatTimer = (seconds) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  // Initialize signature canvas
  useEffect(() => {
    if (signatureCanvasRef.current) {
      const canvas = signatureCanvasRef.current
      const ctx = canvas.getContext('2d')
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width
      canvas.height = rect.height
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
    }
  }, [])

  const handleLaunchInspection = () => {
    if (!selectedPanelId) return
    setInspectionLaunched(true)
    navigate(fdPath(`/panel-inspection?id=${selectedPanelId}`), { replace: true })
  }

  const handleChecklistToggle = (item, value) => {
    setChecklist((prev) => ({ ...prev, [item]: value }))
  }

  const handlePhotoUpload = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      const reader = new FileReader()
      reader.onloadend = () => {
        setPhotoEvidence(reader.result)
        setPhotoFile(file)
      }
      reader.readAsDataURL(file)
    }
  }

  const uploadPhotoToStorage = async (file, panelId) => {
    if (!file) return null
    const fileName = `panel_inspections/${panelId}_${Date.now()}_${file.name}`
    const storageRef = ref(storage, fileName)
    await uploadBytes(storageRef, file)
    const downloadURL = await getDownloadURL(storageRef)
    return downloadURL
  }

  const handleTriggerAlarm = () => {
    setAlarmTriggered(true)
    // Simulate alarm trigger - in production this would call an API
    setTimeout(() => {
      setAlarmTriggered(false)
    }, 5000)
  }

  const handleClearSignature = () => {
    if (signatureCanvasRef.current) {
      const canvas = signatureCanvasRef.current
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      setDigitalSignature(false)
    }
  }

  const handleSignatureStart = (e) => {
    if (!signatureCanvasRef.current) return
    const canvas = signatureCanvasRef.current
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = ((e.clientX || e.touches[0].clientX) - rect.left) * scaleX
    const y = ((e.clientY || e.touches[0].clientY) - rect.top) * scaleY
    
    // Ensure white stroke before drawing
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    
    ctx.beginPath()
    ctx.moveTo(x, y)
    signatureRef.current = { x, y }
  }

  const handleSignatureMove = (e) => {
    if (!signatureCanvasRef.current || !signatureRef.current) return
    e.preventDefault()
    const canvas = signatureCanvasRef.current
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = ((e.clientX || e.touches[0].clientX) - rect.left) * scaleX
    const y = ((e.clientY || e.touches[0].clientY) - rect.top) * scaleY
    
    // Ensure white stroke before drawing
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    
    ctx.lineTo(x, y)
    ctx.stroke()
    signatureRef.current = { x, y }
    setDigitalSignature(true)
  }

  const handleSignatureEnd = () => {
    signatureRef.current = null
  }

  const handleSubmitInspection = async () => {
    if (!selectedPanelId || !selectedPanel) return

    // Validation
    const errors = {}

    // Check all Tactical Checklist items
    if (checklist.smokeDetector === null) {
      errors.smokeDetector = 'Smoke/Heat Detector Response must be marked as Pass or Fail'
    }
    if (checklist.manualCallPoint === null) {
      errors.manualCallPoint = 'Manual Call Point Integrity must be marked as Pass or Fail'
    }
    if (checklist.sirenTest === null) {
      errors.sirenTest = 'Siren Audibility & Strobe Test must be marked as Pass or Fail'
    }

    // Check Siren Audibility Test
    if (checklist.sirenAudible === null) {
      errors.sirenAudible = 'Siren Audibility must be marked as Audible or Silent/Faint'
    }

    // Check Fault Logging & Evidence
    if (faultDescription && faultDescription.trim() !== '') {
      if (!photoEvidence && !photoFile) {
        errors.photoEvidence = 'Photo documentation is required when fault description is provided'
      }
      if (!faultSeverity) {
        errors.faultSeverity = 'Fault severity is required when fault description is provided'
      }
    }

    // Check Digital Signature
    if (!digitalSignature) {
      errors.signature = 'Digital signature is required'
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    setFormErrors({})
    setSubmitting(true)

    try {
      // Upload photo to storage if exists
      let photoUrl = null
      if (photoFile) {
        photoUrl = await uploadPhotoToStorage(photoFile, selectedPanelId)
      }

      // Get signature data URL if canvas exists
      const signatureData = signatureCanvasRef.current ? signatureCanvasRef.current.toDataURL() : null

      await updatePanel(selectedPanelId, {
        lastInspectionDate: new Date().toISOString().split('T')[0],
        inspectionStatus: 'completed',
        status: 'nominal',
        inspectionChecklist: checklist,
        faultDescription,
        faultSeverity,
        photoEvidence: photoUrl,
        signature: signatureData,
        inspectionDuration: timerSeconds
      })

      await addActivityEntry({
        type: 'panel_inspection',
        message: `Panel inspection completed for ${selectedPanel.panelId || selectedPanel.id}`,
        status: 'success',
        panelId: selectedPanelId
      })

      setModal({
        show: true,
        title: 'Success',
        message: 'Panel inspection submitted successfully!',
        type: 'success',
        onConfirm: () => {
          setIsTimerRunning(false)
          navigate(fdPath('/panels'))
        }
      })
    } catch (err) {
      console.error('Failed to submit inspection:', err)
      setModal({
        show: true,
        title: 'Error',
        message: 'Failed to submit inspection report.',
        type: 'error'
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '60vh', gap: 16, color: 'rgba(148,163,184,0.8)' }}>
        <span className="fd-spinner fd-spinner--lg" />
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          Loading panel inspection page...
        </span>
      </div>
    )
  }

  // Initial view: select panel
  if (!inspectionLaunched) {
    return (
      <div className="fd-subpage" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '70vh' }}>
        <div className="fd-card" style={{ maxWidth: 600, width: '100%', padding: '32px 28px', textAlign: 'center' }}>
          <div style={{ marginBottom: 24 }}>
            <FileText size={40} style={{ color: '#3a82ff', margin: '0 auto 16px' }} />
            <h2 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 900, color: 'rgba(235,242,255,0.97)' }}>
              Panel Tactical Inspection
            </h2>
            <p style={{ margin: 0, fontSize: 13, color: 'rgba(148,163,184,0.72)' }}>
              Select a registered panel to begin the inspection checklist.
            </p>
          </div>

          <div className="fd-custom-select" ref={panelDropdownRef} style={{ marginBottom: 20, textAlign: 'left' }}>
            <div
              className={`fd-custom-select-trigger ${panelDropdownOpen ? 'open' : ''}`}
              onClick={() => setPanelDropdownOpen(!panelDropdownOpen)}
            >
              <span>{selectedPanel?.panelId || selectedPanel?.id || 'Select Panel'}</span>
              <ChevronDown size={14} className={`fd-custom-select-chevron ${panelDropdownOpen ? 'open' : ''}`} />
            </div>
            {panelDropdownOpen && (
              <div className="fd-custom-select-dropdown" style={{ maxHeight: 300, overflowY: 'auto' }}>
                <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <input
                    type="text"
                    placeholder="Search panel ID, zone, or type..."
                    value={panelSearchTerm}
                    onChange={(e) => setPanelSearchTerm(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 6,
                      color: 'rgba(235,242,255,0.9)',
                      fontSize: 13,
                      outline: 'none'
                    }}
                  />
                </div>
                {panels.length === 0 ? (
                  <div className="fd-custom-select-option" style={{ padding: '12px', color: 'rgba(148,163,184,0.5)', cursor: 'default' }}>
                    No panels registered
                  </div>
                ) : (
                  panels
                    .filter((p) => {
                      const searchLower = panelSearchTerm.toLowerCase()
                      return (
                        (p.panelId || p.id || '').toLowerCase().includes(searchLower) ||
                        (p.zone || '').toLowerCase().includes(searchLower) ||
                        (p.type || '').toLowerCase().includes(searchLower)
                      )
                    })
                    .map((p) => (
                      <div
                        key={p.id}
                        className={`fd-custom-select-option ${selectedPanelId === p.id ? 'selected' : ''}`}
                        onClick={() => {
                          setSelectedPanelId(p.id)
                          setPanelDropdownOpen(false)
                          setPanelSearchTerm('')
                        }}
                      >
                        {p.panelId || p.id} {p.zone ? `(${p.zone})` : ''}
                      </div>
                    ))
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            className="fd-btn fd-btn--primary"
            style={{ width: '100%', padding: '14px', fontWeight: 800 }}
            onClick={handleLaunchInspection}
            disabled={!selectedPanelId}
          >
            Launch Inspection
          </button>
        </div>
      </div>
    )
  }

  // Main inspection UI
  return (
    <div className="fd-subpage">
      {/* Page Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.55)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>REGISTRY</span>
          <span>›</span>
          <span>PANEL ID: {selectedPanel?.panelId || selectedPanel?.id || 'UNKNOWN'}</span>
          <span>›</span>
          <span style={{ color: '#3a82ff' }}>TACTICAL INSPECTION</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ margin: '0 0 4px', fontSize: 'clamp(1.4rem, 3vw, 1.9rem)', fontWeight: 900, color: 'rgba(235,242,255,0.97)', letterSpacing: '-0.025em' }}>
              Field Tactical Inspection
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: 'rgba(148,163,184,0.72)' }}>
              {selectedPanel?.location || 'Unknown Location'} · {selectedPanel?.zone || 'Zone Unassigned'} · High-Density Environment
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: 'rgba(58,130,255,0.1)', border: '1px solid rgba(58,130,255,0.2)', borderRadius: 8 }}>
            <Clock size={14} style={{ color: '#3a82ff' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#3a82ff' }}>INSPECTION TIMER</span>
            <span style={{ fontSize: 14, fontWeight: 900, color: '#fff', background: 'rgba(58,130,255,0.2)', padding: '2px 8px', borderRadius: 4 }}>{formatTimer(timerSeconds)}</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 0.9fr)', gap: 20, marginBottom: 20 }}>
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Tactical Checklist */}
          <div className="fd-card" style={{ padding: '20px 22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={18} style={{ color: '#3a82ff' }} />
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'rgba(235,242,255,0.97)' }}>
                  Tactical Checklist
                </h3>
              </div>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#3a82ff', textTransform: 'uppercase', letterSpacing: '0.06em', background: 'rgba(58,130,255,0.1)', border: '1px solid rgba(58,130,255,0.2)', padding: '4px 10px', borderRadius: 6 }}>
                MANDATORY VERIFICATION
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { key: 'smokeDetector', label: 'Smoke/Heat Detector Response', desc: 'Trigger test smoke and verify 5s response time.', icon: <Flame size={20} style={{ color: '#ff535f' }} /> },
                { key: 'manualCallPoint', label: 'Manual Call Point (MCP) Integrity', desc: 'Check glass/plastic seals and button tension.', icon: <AlertCircle size={20} style={{ color: '#ff535f' }} /> },
                { key: 'sirenTest', label: 'Siren Audibility & Strobe Test', desc: 'Verify >75dB at 3m and clear strobe visibility.', icon: <Bell size={20} style={{ color: '#3a82ff' }} /> }
              ].map((item) => (
                <div key={item.key}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '16px 18px',
                      background: formErrors[item.key] ? 'rgba(255,83,95,0.08)' : 'rgba(255,255,255,0.03)',
                      borderRadius: 10,
                      border: formErrors[item.key] ? '1px solid rgba(255,83,95,0.3)' : '1px solid rgba(255,255,255,0.05)',
                      gap: 16
                    }}
                  >
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ width: 40, height: 40, background: 'rgba(255,255,255,0.05)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {item.icon}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(235,242,255,0.9)' }}>
                          {item.label}
                        </div>
                        <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.6)', marginTop: 2 }}>
                          {item.desc}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        handleChecklistToggle(item.key, checklist[item.key] === null ? true : !checklist[item.key])
                        if (formErrors[item.key]) {
                          setFormErrors(prev => ({ ...prev, [item.key]: null }))
                        }
                      }}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        border: `2px solid ${checklist[item.key] === true ? '#16c988' : checklist[item.key] === false ? '#ff535f' : 'rgba(255,255,255,0.1)'}`,
                        background: checklist[item.key] === true ? 'rgba(22,201,136,0.2)' : checklist[item.key] === false ? 'rgba(255,83,95,0.2)' : 'rgba(255,255,255,0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer'
                      }}
                    >
                      {checklist[item.key] === true ? <Check size={14} style={{ color: '#16c988' }} /> : checklist[item.key] === false ? <X size={14} style={{ color: '#ff535f' }} /> : null}
                    </button>
                  </div>
                  {formErrors[item.key] && (
                    <div style={{ marginTop: 4, fontSize: 11, color: '#ff535f', fontWeight: 600, paddingLeft: 4 }}>
                      {formErrors[item.key]}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Fault Logging & Evidence */}
          <div className="fd-card" style={{ padding: '20px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <AlertTriangle size={18} style={{ color: '#ff535f' }} />
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'rgba(235,242,255,0.97)' }}>
                Fault Logging & Evidence
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.55)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  ISSUE DESCRIPTION
                </label>
                <textarea
                  style={{
                    width: '100%',
                    minHeight: 100,
                    padding: '12px 14px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: 8,
                    color: 'rgba(235,242,255,0.9)',
                    fontSize: 13,
                    resize: 'vertical'
                  }}
                  placeholder="Describe detected fault or structural anomaly..."
                  value={faultDescription}
                  onChange={(e) => setFaultDescription(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.55)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  PHOTO DOCUMENTATION
                </label>
                <div style={{ 
                  flex: 1, 
                  minHeight: 100, 
                  background: 'rgba(255,255,255,0.03)', 
                  border: formErrors.photoEvidence ? '1px solid #ff535f' : '1px dashed rgba(255,255,255,0.1)', 
                  borderRadius: 8, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  overflow: 'hidden', 
                  position: 'relative' 
                }}>
                  {photoEvidence ? (
                    <>
                      <img src={photoEvidence} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Evidence" />
                      <button
                        type="button"
                        onClick={() => setPhotoEvidence(null)}
                        style={{ position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: '50%', background: 'rgba(0,0,0,0.7)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <X size={12} />
                      </button>
                    </>
                  ) : (
                    <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: 'rgba(148,163,184,0.6)', cursor: 'pointer' }}>
                      <Camera size={28} />
                      <span style={{ fontSize: 11, fontWeight: 700 }}>CAPTURE</span>
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => {
                        handlePhotoUpload(e)
                        if (formErrors.photoEvidence) {
                          setFormErrors(prev => ({ ...prev, photoEvidence: null }))
                        }
                      }} />
                    </label>
                  )}
                </div>
                {formErrors.photoEvidence && (
                  <div style={{ marginTop: 4, fontSize: 11, color: '#ff535f', fontWeight: 600 }}>
                    {formErrors.photoEvidence}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.55)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, display: 'block' }}>
                FAULT SEVERITY
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { label: 'CRITICAL', color: '#ff535f' },
                  { label: 'MODERATE', color: '#fe8e2a' },
                  { label: 'MINIMAL', color: '#4deba0' }
                ].map((severity) => (
                  <button
                    key={severity.label}
                    type="button"
                    onClick={() => {
                      setFaultSeverity(severity.label)
                      if (formErrors.faultSeverity) {
                        setFormErrors(prev => ({ ...prev, faultSeverity: null }))
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: '8px 16px',
                      borderRadius: 6,
                      fontSize: 10,
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      border: faultSeverity === severity.label ? `1px solid ${severity.color}` : '1px solid rgba(255,255,255,0.05)',
                      background: faultSeverity === severity.label ? `${severity.color}20` : 'rgba(255,255,255,0.03)',
                      color: faultSeverity === severity.label ? severity.color : 'rgba(148,163,184,0.6)',
                      cursor: 'pointer'
                    }}
                  >
                    {severity.label}
                  </button>
                ))}
              </div>
              {formErrors.faultSeverity && (
                <div style={{ marginTop: 8, fontSize: 11, color: '#ff535f', fontWeight: 600 }}>
                  {formErrors.faultSeverity}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Siren Audibility Test */}
          <div className="fd-card" style={{ padding: '20px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Volume2 size={18} style={{ color: '#ff535f' }} />
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'rgba(235,242,255,0.97)' }}>
                Siren Audibility Test
              </h3>
            </div>

            <p style={{ margin: '0 0 16px', fontSize: 13, color: 'rgba(148,163,184,0.75)', lineHeight: '1.5' }}>
              Triggers Zone 04 alarm sounders for local verification. Wear ear protection.
            </p>

            <button
              type="button"
              onClick={handleTriggerAlarm}
              disabled={alarmTriggered}
              style={{
                width: '100%',
                padding: '14px 16px',
                background: alarmTriggered ? 'rgba(22,201,136,0.2)' : 'linear-gradient(135deg, #ff535f, #d6303a)',
                border: alarmTriggered ? '1px solid rgba(22,201,136,0.4)' : '1px solid rgba(255,83,95,0.4)',
                borderRadius: 10,
                color: alarmTriggered ? '#16c988' : '#fff',
                fontSize: 14,
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                cursor: alarmTriggered ? 'default' : 'pointer',
                boxShadow: alarmTriggered ? 'none' : '0 4px 20px rgba(255,83,95,0.3)'
              }}
            >
              {alarmTriggered ? <Check size={18} /> : <Volume2 size={18} fill="currentColor" />}
              {alarmTriggered ? 'ALARM TRIGGERED' : 'TRIGGER ALARM'}
            </button>

            <div style={{ display: 'flex', gap: 12, marginTop: 16, justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  handleChecklistToggle('sirenAudible', true)
                  if (formErrors.sirenAudible) {
                    setFormErrors(prev => ({ ...prev, sirenAudible: null }))
                  }
                }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  padding: '12px 20px',
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.03)',
                  border: formErrors.sirenAudible ? '1px solid #ff535f' : checklist.sirenAudible === true ? '1px solid rgba(22,201,136,0.3)' : '1px solid rgba(255,255,255,0.05)',
                  cursor: 'pointer'
                }}
              >
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: checklist.sirenAudible === true ? 'rgba(22,201,136,0.2)' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {checklist.sirenAudible === true ? <Check size={14} style={{ color: '#16c988' }} /> : null}
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: checklist.sirenAudible === true ? '#16c988' : 'rgba(148,163,184,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  AUDIBLE
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  handleChecklistToggle('sirenAudible', false)
                  if (formErrors.sirenAudible) {
                    setFormErrors(prev => ({ ...prev, sirenAudible: null }))
                  }
                }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  padding: '12px 20px',
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.03)',
                  border: formErrors.sirenAudible ? '1px solid #ff535f' : checklist.sirenAudible === false ? '1px solid rgba(255,83,95,0.3)' : '1px solid rgba(255,255,255,0.05)',
                  cursor: 'pointer'
                }}
              >
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: checklist.sirenAudible === false ? 'rgba(255,83,95,0.2)' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {checklist.sirenAudible === false ? <X size={14} style={{ color: '#ff535f' }} /> : null}
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: checklist.sirenAudible === false ? '#ff535f' : 'rgba(148,163,184,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  SILENT/FAINT
                </span>
              </button>
            </div>
            {formErrors.sirenAudible && (
              <div style={{ marginTop: 12, fontSize: 11, color: '#ff535f', fontWeight: 600, textAlign: 'center' }}>
                {formErrors.sirenAudible}
              </div>
            )}
          </div>

          {/* Mission Sign-off */}
          <div className="fd-card" style={{ padding: '20px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <FileText size={18} style={{ color: 'rgba(148,163,184,0.75)' }} />
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'rgba(235,242,255,0.97)' }}>
                Mission Sign-off
              </h3>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.55)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                DIGITAL SIGNATURE
              </div>
              <div style={{ position: 'relative', width: '100%', aspectRatio: '2/1', border: formErrors.signature ? '1px solid #ff535f' : '1px dashed rgba(255,255,255,0.15)', borderRadius: 8, background: 'rgba(255,255,255,0.02)', overflow: 'hidden' }}>
                <canvas
                  ref={signatureCanvasRef}
                  onMouseDown={handleSignatureStart}
                  onMouseMove={handleSignatureMove}
                  onMouseUp={handleSignatureEnd}
                  onMouseLeave={handleSignatureEnd}
                  onTouchStart={handleSignatureStart}
                  onTouchMove={handleSignatureMove}
                  onTouchEnd={handleSignatureEnd}
                  style={{
                    width: '100%',
                    height: '100%',
                    cursor: 'crosshair'
                  }}
                />
                {!digitalSignature && (
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, pointerEvents: 'none' }}>
                    <div style={{ width: 32, height: 32, background: 'rgba(255,255,255,0.05)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Upload size={18} style={{ color: 'rgba(148,163,184,0.5)' }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(148,163,184,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      SIGN IN WORKSPACE
                    </span>
                  </div>
                )}
                {digitalSignature && (
                  <button
                    type="button"
                    onClick={handleClearSignature}
                    style={{ position: 'absolute', top: 8, right: 8, padding: '6px 10px', background: 'rgba(255,83,95,0.2)', border: '1px solid rgba(255,83,95,0.3)', borderRadius: 6, color: '#ff535f', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer' }}
                  >
                    Clear
                  </button>
                )}
              </div>
              {formErrors.signature && (
                <div style={{ marginTop: 8, fontSize: 11, color: '#ff535f', fontWeight: 600 }}>
                  {formErrors.signature}
                </div>
              )}
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={digitalSignature}
                  onChange={(e) => setDigitalSignature(e.target.checked)}
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 4,
                    border: '1px solid rgba(255,255,255,0.15)',
                    background: digitalSignature ? '#3a82ff' : 'rgba(255,255,255,0.03)',
                    appearance: 'none',
                    position: 'relative',
                    cursor: 'pointer'
                  }}
                />
                <span style={{ fontSize: 12, color: 'rgba(148,163,184,0.75)', lineHeight: '1.5' }}>
                  I certify that all tactical checks were performed according to NFPA 72 standards.
                </span>
              </label>
            </div>

            <button
              type="button"
              className="fd-btn fd-btn--primary"
              onClick={handleSubmitInspection}
              disabled={submitting || !digitalSignature}
              style={{
                width: '100%',
                padding: '14px',
                fontWeight: 900,
                fontSize: 13,
                background: digitalSignature ? '#fff' : 'rgba(255,255,255,0.1)',
                color: digitalSignature ? '#0a0f1a' : 'rgba(148,163,184,0.5)',
                border: 'none'
              }}
            >
              {submitting ? <span className="fd-spinner" style={{ width: 14, height: 14 }} /> : 'SUBMIT INSPECTION REPORT'}
            </button>
          </div>

          {/* Verified Geolocation */}
          <div className="fd-card" style={{ padding: '12px 16px', background: 'rgba(58,130,255,0.08)', border: '1px solid rgba(58,130,255,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, background: 'rgba(58,130,255,0.15)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MapPin size={16} style={{ color: '#3a82ff' }} />
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(148,163,184,0.55)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  VERIFIED GEOLOCATION
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(235,242,255,0.9)' }}>
                  40.7128° N, 74.0060° W
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Custom Modal */}
      {modal.show && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
          <div style={{ background: '#0b0f1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '32px 36px', maxWidth: 440, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              {modal.type === 'success' && <CheckCircle2 size={28} style={{ color: '#16c988' }} />}
              {modal.type === 'error' && <XCircle size={28} style={{ color: '#ff535f' }} />}
              {modal.type === 'info' && <AlertCircle size={28} style={{ color: '#3a82ff' }} />}
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: 'rgba(235,242,255,0.97)' }}>
                {modal.title}
              </h2>
            </div>
            <p style={{ margin: '0 0 24px', fontSize: 14, color: 'rgba(148,163,184,0.85)', lineHeight: '1.6' }}>
              {modal.message}
            </p>
            <button
              type="button"
              onClick={() => {
                setModal({ show: false, title: '', message: '', type: 'info' })
                if (modal.onConfirm) modal.onConfirm()
              }}
              style={{
                width: '100%',
                padding: '14px',
                background: modal.type === 'success' ? '#16c988' : modal.type === 'error' ? '#ff535f' : '#3a82ff',
                border: 'none',
                borderRadius: 10,
                color: '#fff',
                fontSize: 14,
                fontWeight: 900,
                cursor: 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '0.06em'
              }}
            >
              {modal.type === 'success' ? 'Continue' : 'Close'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
