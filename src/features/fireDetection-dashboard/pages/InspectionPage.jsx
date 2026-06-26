import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ChevronDown, Check, X, Camera, Shield,
  Gauge, Droplets, AlertTriangle, Upload, RotateCcw,
  FileText, MapPin, Activity
} from 'lucide-react'
import { useFireDetectionData } from '../hooks/useFireDetectionData.js'
import '../fd.css'

export function InspectionPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const assetIdFromUrl = searchParams.get('id')

  const { assets, loading, addActivityEntry, updateAsset, saveInspectionDraft, loadInspectionDraft, logIncident, uploadInspectionImage } = useFireDetectionData()

  // State for asset selection and inspection mode
  const [selectedAssetId, setSelectedAssetId] = useState(assetIdFromUrl || null)
  const [assetDropdownOpen, setAssetDropdownOpen] = useState(false)
  const [inspectionLaunched, setInspectionLaunched] = useState(!!assetIdFromUrl)
  const assetDropdownRef = useRef(null)

  // Inspection form state
  const [staticPressure, setStaticPressure] = useState('')
  const [flowRate, setFlowRate] = useState('')
  const [checklist, setChecklist] = useState({
    valveCondition: null,
    hoseCoupling: null,
    leakDetection: null,
    paintCoating: null
  })
  const [defectReported, setDefectReported] = useState(false)
  const [defectDescription, setDefectDescription] = useState('')
  const [photos, setPhotos] = useState({
    before: null,
    after: null
  })
  const [submitting, setSubmitting] = useState(false)
  const [signatureData, setSignatureData] = useState(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const signatureCanvasRef = useRef(null)
  const signatureCtxRef = useRef(null)

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [modalConfig, setModalConfig] = useState({
    title: '',
    message: '',
    type: 'success', // success, error, warning
    onConfirm: null
  })

  const selectedAsset = assets.find((a) => a.id === selectedAssetId)

  // Click outside dropdown handler
  useEffect(() => {
    function clickOutside(e) {
      if (assetDropdownRef.current && !assetDropdownRef.current.contains(e.target)) {
        setAssetDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', clickOutside)
    return () => document.removeEventListener('mousedown', clickOutside)
  }, [])

  // When URL param changes, sync state and load draft if exists
  useEffect(() => {
    if (assetIdFromUrl) {
      loadInspectionDraft(assetIdFromUrl).then((draft) => {
        if (draft) {
          setStaticPressure(draft.staticPressure || '')
          setFlowRate(draft.flowRate || '')
          setChecklist(draft.checklist || {
            valveCondition: null,
            hoseCoupling: null,
            leakDetection: null,
            paintCoating: null
          })
          setDefectReported(draft.defectReported || false)
          setDefectDescription(draft.defectDescription || '')
          setPhotos(draft.photos || { before: null, after: null })
        }
        // Set these after draft is loaded
        setSelectedAssetId(assetIdFromUrl)
        setInspectionLaunched(true)
      })
    }
  }, [assetIdFromUrl, loadInspectionDraft])

  const handleLaunchInspection = () => {
    if (!selectedAssetId) return
    setInspectionLaunched(true)
    navigate(`/detection/inspection?id=${selectedAssetId}`, { replace: true })
  }

  const handleChecklistToggle = (item, value) => {
    setChecklist((prev) => ({ ...prev, [item]: value }))
  }

  const handlePhotoUpload = (type, e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setPhotos((prev) => ({ ...prev, [type]: { file, preview: URL.createObjectURL(file) } }))
    }
  }

  // Signature pad handlers
  const startDrawing = (e) => {
    e.preventDefault()
    setIsDrawing(true)
    const canvas = signatureCanvasRef.current
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const clientX = e.clientX || (e.touches && e.touches[0].clientX)
    const clientY = e.clientY || (e.touches && e.touches[0].clientY)
    const x = (clientX - rect.left) * scaleX
    const y = (clientY - rect.top) * scaleY
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const draw = (e) => {
    if (!isDrawing) return
    e.preventDefault()
    const canvas = signatureCanvasRef.current
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const clientX = e.clientX || (e.touches && e.touches[0].clientX)
    const clientY = e.clientY || (e.touches && e.touches[0].clientY)
    const x = (clientX - rect.left) * scaleX
    const y = (clientY - rect.top) * scaleY
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const stopDrawing = (e) => {
    if (e) e.preventDefault()
    setIsDrawing(false)
    const canvas = signatureCanvasRef.current
    setSignatureData(canvas.toDataURL())
  }

  const clearSignature = () => {
    const canvas = signatureCanvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    // Reset stroke style after clearing
    ctx.strokeStyle = '#3a82ff'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    setSignatureData(null)
  }

  const showModal = (title, message, type = 'success', onConfirm = null) => {
    setModalConfig({ title, message, type, onConfirm })
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    if (modalConfig.onConfirm) {
      modalConfig.onConfirm()
      setModalConfig({ title: '', message: '', type: 'success', onConfirm: null })
    }
  }

  // Initialize signature canvas with proper dimensions
  useEffect(() => {
    const canvas = signatureCanvasRef.current
    if (canvas) {
      // Set canvas actual size to match display size
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width
      canvas.height = rect.height
      
      const ctx = canvas.getContext('2d')
      ctx.strokeStyle = '#3a82ff'
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      signatureCtxRef.current = ctx
    }
  }, [])

  // Re-initialize canvas when signature is cleared
  useEffect(() => {
    if (!signatureData && signatureCanvasRef.current) {
      const canvas = signatureCanvasRef.current
      const ctx = canvas.getContext('2d')
      ctx.strokeStyle = '#3a82ff'
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      signatureCtxRef.current = ctx
    }
  }, [signatureData])

  const handleSubmitInspection = async () => {
    if (!selectedAssetId || !selectedAsset) return
    setSubmitting(true)

    try {
      // Upload photos if they exist
      let beforePhotoUrl = null
      let afterPhotoUrl = null

      if (photos.before?.file) {
        beforePhotoUrl = await uploadInspectionImage(photos.before.file, selectedAssetId, 'before')
      }
      if (photos.after?.file) {
        afterPhotoUrl = await uploadInspectionImage(photos.after.file, selectedAssetId, 'after')
      }

      await updateAsset(selectedAssetId, {
        lastInspectionDate: new Date().toISOString().split('T')[0],
        lastInspectionPressure: parseFloat(staticPressure) || selectedAsset.pressure,
        lastInspectionFlowRate: parseFloat(flowRate) || selectedAsset.flowRate,
        inspectionStatus: 'completed',
        inspectionChecklist: checklist,
        inspectionPhotos: {
          before: beforePhotoUrl,
          after: afterPhotoUrl
        },
        inspectionSignature: signatureData
      })

      await addActivityEntry({
        type: 'inspection',
        message: `Tactical inspection completed for ${selectedAsset.assetId} in ${selectedAsset.sector || 'unknown sector'}.`,
        status: 'success',
        assetId: selectedAssetId
      })

      // Clear draft after successful submission
      await saveInspectionDraft(selectedAssetId, {
        staticPressure: '',
        flowRate: '',
        checklist: {
          valveCondition: null,
          hoseCoupling: null,
          leakDetection: null,
          paintCoating: null
        },
        defectReported: false,
        defectDescription: '',
        photos: { before: null, after: null }
      })

      showModal('Success', 'Inspection report submitted successfully!', 'success')
      // Reset form
      setStaticPressure('')
      setFlowRate('')
      setChecklist({
        valveCondition: null,
        hoseCoupling: null,
        leakDetection: null,
        paintCoating: null
      })
      setDefectReported(false)
      setDefectDescription('')
      setPhotos({ before: null, after: null })
      setSignatureData(null)
      clearSignature()
    } catch (err) {
      console.error('Failed to submit inspection:', err)
      showModal('Error', 'Failed to submit inspection report.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '60vh', gap: 16, color: 'rgba(148,163,184,0.8)' }}>
        <span className="fd-spinner fd-spinner--lg" />
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          Loading inspection dashboard...
        </span>
      </div>
    )
  }

  // Initial state: select asset
  if (!inspectionLaunched) {
    return (
      <div className="fd-subpage" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '70vh' }}>
        <div className="fd-card" style={{ maxWidth: 600, width: '100%', padding: '32px 28px', textAlign: 'center' }}>
          <div style={{ marginBottom: 24 }}>
            <Activity size={40} style={{ color: '#3a82ff', margin: '0 auto 16px' }} />
            <h2 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 900, color: 'rgba(235,242,255,0.97)' }}>
              Tactical Inspection Protocol
            </h2>
            <p style={{ margin: 0, fontSize: 14, color: 'rgba(148,163,184,0.72)' }}>
              Select an asset from the dropdown to begin the field inspection checklist.
            </p>
          </div>

          <div className="fd-custom-select" ref={assetDropdownRef} style={{ marginBottom: 20, textAlign: 'left' }}>
            <div
              className={`fd-custom-select-trigger ${assetDropdownOpen ? 'open' : ''}`}
              onClick={() => setAssetDropdownOpen(!assetDropdownOpen)}
            >
              <span>{selectedAsset?.assetId || 'Select Asset'}</span>
              <ChevronDown size={14} className={`fd-custom-select-chevron ${assetDropdownOpen ? 'open' : ''}`} />
            </div>
            {assetDropdownOpen && (
              <div className="fd-custom-select-dropdown" style={{ maxHeight: 200, overflowY: 'auto' }}>
                {assets.length === 0 ? (
                  <div className="fd-custom-select-option" style={{ padding: '12px', color: 'rgba(148,163,184,0.5)', cursor: 'default' }}>
                    No assets registered
                  </div>
                ) : (
                  assets.map((a) => (
                    <div
                      key={a.id}
                      className={`fd-custom-select-option ${selectedAssetId === a.id ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedAssetId(a.id)
                        setAssetDropdownOpen(false)
                      }}
                    >
                      {a.assetId} ({a.type})
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
            disabled={!selectedAssetId}
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 28 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: '#3a82ff', fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            <span style={{ width: 6, height: 6, background: '#3a82ff', borderRadius: '50%' }} />
            Active Deployment
          </div>
          <h1 style={{ margin: '0 0 4px', fontSize: 'clamp(1.4rem, 3vw, 1.9rem)', fontWeight: 900, color: 'rgba(235,242,255,0.97)', letterSpacing: '-0.025em' }}>
            Hydrant Tactical Inspection
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: 'rgba(148,163,184,0.72)' }}>
            Protocol #772-HYD — Mission Authorized
          </p>
        </div>

        {selectedAsset && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'rgba(22,201,136,0.06)', border: '1px solid rgba(22,201,136,0.2)', borderRadius: 8 }}>
            <div style={{ width: 10, height: 10, background: '#16c988', borderRadius: '50%' }} />
            <div style={{ fontSize: 11, fontWeight: 800, color: '#4deba0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {selectedAsset.gps ? `${selectedAsset.gps.lat.toFixed(4)}° N, ${Math.abs(selectedAsset.gps.lng).toFixed(4)}° W` : 'GPS Coordinates'}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)', gap: 20, marginBottom: 20 }}>
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Real-Time Pressure Analytics */}
          <div className="fd-card" style={{ padding: '20px 22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'rgba(235,242,255,0.92)' }}>
                Real-Time Pressure Analytics
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'rgba(22,201,136,0.06)', border: '1px solid rgba(22,201,136,0.25)', borderRadius: 6, fontSize: 10, fontWeight: 800, color: '#4deba0', textTransform: 'uppercase' }}>
                <Shield size={12} />
                CALIBRATED
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.55)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  Static Pressure
                  <span style={{ color: '#3a82ff' }}>BAR</span>
                </div>
                <div style={{ fontSize: 40, fontWeight: 900, color: 'rgba(235,242,255,0.97)', lineHeight: 1, marginBottom: 12 }}>
                  {staticPressure || selectedAsset?.pressure?.toFixed(1) || '—'}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.55)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {selectedAsset?.lastInspectionPressure ? (
                    <>
                      <span style={{ color: staticPressure > selectedAsset.lastInspectionPressure ? '#4deba0' : '#ff535f' }}>
                        {staticPressure && selectedAsset.lastInspectionPressure
                          ? ((staticPressure - selectedAsset.lastInspectionPressure) / selectedAsset.lastInspectionPressure * 100).toFixed(1) + '%'
                          : '—'}
                      </span>
                      from last reading
                    </>
                  ) : (
                    'No previous reading'
                  )}
                </div>
                <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                  <input
                    type="number"
                    step="0.1"
                    style={{ flex: 1, padding: '8px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, color: 'rgba(235,242,255,0.9)', fontSize: 13 }}
                    placeholder="Enter pressure"
                    value={staticPressure}
                    onChange={(e) => setStaticPressure(e.target.value)}
                  />
                </div>
                <div style={{ marginTop: 12, height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: '85%', height: '100%', background: 'linear-gradient(90deg, #16c988, #3a82ff)', borderRadius: 3 }} />
                </div>
                <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(148,163,184,0.5)' }}>
                  <span>0</span>
                  <span style={{ color: '#4deba0' }}>OPTIMAL</span>
                  <span>20+</span>
                </div>
              </div>

              <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.55)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  Flow Rate Test
                  <span style={{ color: '#3a82ff' }}>GPM</span>
                </div>
                <div style={{ fontSize: 40, fontWeight: 900, color: 'rgba(235,242,255,0.97)', lineHeight: 1, marginBottom: 12 }}>
                  {flowRate || selectedAsset?.flowRate?.toLocaleString() || '—'}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.55)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {selectedAsset?.lastInspectionFlowRate ? (
                    <>
                      <span style={{ color: flowRate >= 1000 ? '#4deba0' : '#fe8e2a' }}>
                        Target 1,000
                      </span>
                    </>
                  ) : (
                    <span style={{ color: '#fe8e2a' }}>Target 1,000</span>
                  )}
                </div>
                <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                  <input
                    type="number"
                    style={{ flex: 1, padding: '8px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, color: 'rgba(235,242,255,0.9)', fontSize: 13 }}
                    placeholder="Enter flow rate"
                    value={flowRate}
                    onChange={(e) => setFlowRate(e.target.value)}
                  />
                </div>
                <div style={{ marginTop: 12, height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: '92%', height: '100%', background: 'linear-gradient(90deg, #fe8e2a, #ff535f)', borderRadius: 3 }} />
                </div>
                <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(148,163,184,0.5)' }}>
                  <span style={{ color: '#4deba0' }}>RESIDUAL</span>
                  <span>MAX FLOW 1800</span>
                </div>
              </div>
            </div>
          </div>

          {/* Defect Reporting */}
          <div className="fd-card" style={{ padding: '20px 22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'rgba(235,242,255,0.92)' }}>
                Defect Reporting
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setDefectReported(!defectReported)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    border: `1px solid ${defectReported ? 'rgba(255,83,95,0.35)' : 'rgba(255,255,255,0.1)'}`,
                    background: defectReported ? 'rgba(255,83,95,0.12)' : 'rgba(255,255,255,0.04)',
                    color: defectReported ? '#ff535f' : 'rgba(148,163,184,0.6)',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {defectReported ? 'Critical Defect' : 'No Defects'}
                </button>
              </div>
            </div>

            <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.55)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              Engineering Comments
            </div>
            <textarea
              style={{
                width: '100%',
                minHeight: 100,
                padding: '12px 14px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8,
                color: 'rgba(235,242,255,0.9)',
                fontSize: 13,
                resize: 'vertical'
              }}
              placeholder="Describe defects, maintenance requirements, or operational hazards..."
              value={defectDescription}
              onChange={(e) => setDefectDescription(e.target.value)}
            />

            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button
                type="button"
                className="fd-btn fd-btn--ghost"
                style={{ flex: 1 }}
                onClick={async () => {
                  if (!selectedAssetId) return
                  try {
                    await saveInspectionDraft(selectedAssetId, {
                      staticPressure,
                      flowRate,
                      checklist,
                      defectReported,
                      defectDescription,
                      // Only save preview URLs, not File objects
                      photos: {
                        before: photos.before?.preview || null,
                        after: photos.after?.preview || null
                      }
                    })
                    showModal('Success', 'Draft saved successfully!', 'success')
                  } catch (err) {
                    console.error('Failed to save draft:', err)
                    showModal('Error', 'Failed to save draft.', 'error')
                  }
                }}
              >
                Save Draft
              </button>
              <button
                type="button"
                className="fd-btn fd-btn--primary"
                style={{ flex: 1 }}
                onClick={async () => {
                  if (!selectedAssetId || !selectedAsset) return
                  if (!defectDescription.trim()) {
                    showModal('Warning', 'Please describe the defect before logging an incident.', 'warning')
                    return
                  }
                  try {
                    await logIncident({
                      assetId: selectedAssetId,
                      assetName: selectedAsset.assetId,
                      description: defectDescription,
                      severity: defectReported ? 'critical' : 'warning',
                      sector: selectedAsset.sector,
                      gps: selectedAsset.gps
                    })
                    await addActivityEntry({
                      type: 'incident',
                      message: `Incident logged for ${selectedAsset.assetId}: ${defectDescription.substring(0, 50)}...`,
                      status: 'warning',
                      assetId: selectedAssetId
                    })
                    showModal('Success', 'Incident logged successfully!', 'success', () => {
                      setDefectDescription('')
                      setDefectReported(false)
                    })
                  } catch (err) {
                    console.error('Failed to log incident:', err)
                    showModal('Error', 'Failed to log incident.', 'error')
                  }
                }}
              >
                Log Incident
              </button>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Integrity Checklist */}
          <div className="fd-card" style={{ padding: '20px 22px' }}>
            <h3 style={{ margin: '0 0 18px', fontSize: 15, fontWeight: 800, color: 'rgba(235,242,255,0.92)' }}>
              Integrity Checklist
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { key: 'valveCondition', label: 'Valve Condition' },
                { key: 'hoseCoupling', label: 'Hose & Coupling' },
                { key: 'leakDetection', label: 'Leak Detection' },
                { key: 'paintCoating', label: 'Paint & Coating' }
              ].map((item) => (
                <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(235,242,255,0.85)' }}>
                    {item.label}
                  </span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => handleChecklistToggle(item.key, true)}
                      style={{
                        padding: '4px 12px',
                        borderRadius: 5,
                        fontSize: 11,
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        border: checklist[item.key] === true ? '1px solid rgba(22,201,136,0.4)' : '1px solid rgba(255,255,255,0.1)',
                        background: checklist[item.key] === true ? 'rgba(22,201,136,0.12)' : 'rgba(255,255,255,0.04)',
                        color: checklist[item.key] === true ? '#4deba0' : 'rgba(148,163,184,0.6)',
                        cursor: 'pointer'
                      }}
                    >
                      PASS
                    </button>
                    <button
                      type="button"
                      onClick={() => handleChecklistToggle(item.key, false)}
                      style={{
                        padding: '4px 12px',
                        borderRadius: 5,
                        fontSize: 11,
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        border: checklist[item.key] === false ? '1px solid rgba(255,83,95,0.4)' : '1px solid rgba(255,255,255,0.1)',
                        background: checklist[item.key] === false ? 'rgba(255,83,95,0.12)' : 'rgba(255,255,255,0.04)',
                        color: checklist[item.key] === false ? '#ff535f' : 'rgba(148,163,184,0.6)',
                        cursor: 'pointer'
                      }}
                    >
                      FAIL
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Photo Evidence */}
          <div className="fd-card" style={{ padding: '20px 22px' }}>
            <h3 style={{ margin: '0 0 18px', fontSize: 15, fontWeight: 800, color: 'rgba(235,242,255,0.92)' }}>
              Photo Evidence
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '1px dashed rgba(255,255,255,0.15)', aspectRatio: '1', background: 'rgba(255,255,255,0.02)' }}>
                {photos.before?.preview ? (
                  <img src={photos.before.preview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Before" />
                ) : (
                  <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', cursor: 'pointer', color: 'rgba(148,163,184,0.5)', gap: 6 }}>
                    <Camera size={32} style={{ opacity: 0.6 }} />
                    <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Before Protocol</span>
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handlePhotoUpload('before', e)} />
                  </label>
                )}
              </div>

              <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '1px dashed rgba(255,255,255,0.15)', aspectRatio: '1', background: 'rgba(255,255,255,0.02)' }}>
                {photos.after?.preview ? (
                  <img src={photos.after.preview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="After" />
                ) : (
                  <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', cursor: 'pointer', color: 'rgba(148,163,184,0.5)', gap: 6 }}>
                    <Camera size={32} style={{ opacity: 0.6 }} />
                    <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>After Protocol</span>
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handlePhotoUpload('after', e)} />
                  </label>
                )}
              </div>
            </div>

            <p style={{ marginTop: 14, fontSize: 11, color: 'rgba(148,163,184,0.55)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 10, height: 10, background: '#3a82ff', borderRadius: '50%' }} />
              Visual documentation is required for all Grade-A tactical deployments. GPS metadata is embedded on your device.
            </p>
          </div>
        </div>
      </div>

      {/* Technician Finalization */}
      <div className="fd-card" style={{ padding: '20px 22px', background: 'linear-gradient(135deg, rgba(58,130,255,0.08), rgba(22,201,136,0.03))', border: '1px solid rgba(58,130,255,0.2)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1.6fr)', gap: 24 }}>
          <div>
            <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 800, color: 'rgba(235,242,255,0.92)' }}>
              Technician Finalization
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: 'rgba(148,163,184,0.75)', lineHeight: 1.5 }}>
              I hereby certify that this tactical inspection was conducted in accordance with IGNIS-772 protocols and the readings recorded are accurate.
            </p>
            <div style={{ display: 'flex', gap: 16 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(148,163,184,0.55)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                  Operator ID
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(235,242,255,0.85)' }}>
                  {selectedAsset?.assignedUnitId || 'Sentinel-X922'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(148,163,184,0.55)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                  Date & Time
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(235,242,255,0.85)' }}>
                  {new Date().toISOString().replace('T', ' ').substring(0, 19)} UTC
                </div>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end', justifyContent: 'center' }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: 400 }}>
              <canvas
                ref={signatureCanvasRef}
                style={{ 
                  width: '100%', 
                  height: '80%', 
                  border: '1px dashed rgba(255,255,255,0.2)', 
                  borderRadius: 8, 
                  background: 'rgba(255, 255, 255, 0.8)',
                  cursor: 'crosshair',
                  touchAction: 'none',
                  display: 'block'
                }}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
              {!signatureData && (
                <div style={{ 
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  color: 'rgba(6, 24, 124, 0.5)', 
                  fontSize: 11, 
                  fontWeight: 700,
                  pointerEvents: 'none'
                }}>
                  DIGITAL SIGNATURE REQUIRED
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 400 }}>
              <button
                type="button"
                className="fd-btn fd-btn--ghost"
                style={{ flex: 1 }}
                onClick={clearSignature}
              >
                Clear
              </button>
              <button
                type="button"
                className="fd-btn fd-btn--primary"
                style={{ flex: 2, fontWeight: 800 }}
                onClick={(e) => {
                  e.preventDefault()
                  handleSubmitInspection()
                }}
                disabled={submitting || !signatureData}
              >
                <Shield size={16} style={{ marginRight: 8 }} />
                Submit Final Protocol Report
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Custom Modal */}
      {modalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            background: '#0b0f1a',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12,
            padding: '24px 28px',
            maxWidth: 400,
            width: '90%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            animation: 'slideUp 0.3s ease-out'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 16
            }}>
              {modalConfig.type === 'success' && (
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'rgba(22,201,136,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#4deba0'
                }}>
                  <Check size={18} />
                </div>
              )}
              {modalConfig.type === 'error' && (
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'rgba(255,83,95,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ff535f'
                }}>
                  <X size={18} />
                </div>
              )}
              {modalConfig.type === 'warning' && (
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'rgba(254,142,42,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fe8e2a'
                }}>
                  <AlertTriangle size={18} />
                </div>
              )}
              <h3 style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 800,
                color: 'rgba(235,242,255,0.97)'
              }}>
                {modalConfig.title}
              </h3>
            </div>
            <p style={{
              margin: '0 0 24px',
              fontSize: 14,
              color: 'rgba(148,163,184,0.8)',
              lineHeight: 1.5
            }}>
              {modalConfig.message}
            </p>
            <button
              type="button"
              className="fd-btn fd-btn--primary"
              onClick={closeModal}
              style={{
                width: '100%',
                padding: '12px',
                fontWeight: 800
              }}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
