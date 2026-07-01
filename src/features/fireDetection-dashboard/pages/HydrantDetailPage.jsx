import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, QrCode, MapPin, Calendar, ShieldAlert, Activity, CheckCircle, AlertTriangle, Download, Printer, FileText, Camera, Lock, RefreshCw, Check, X } from 'lucide-react'
import { useFireDetectionData } from '../hooks/useFireDetectionData.js'
import QRCode from 'qrcode'
import { useModulePath } from '../../../shared/navigation/modulePaths.js'
import '../fd.css'

export function HydrantDetailPage() {
  const navigate = useNavigate()
  const fdPath = useModulePath('/detection', '/client/fire-safety/detection')
  const { id } = useParams()
  const { assets } = useFireDetectionData()
  
  const [asset, setAsset] = useState(null)
  const [loading, setLoading] = useState(true)
  const qrCanvasRef = useRef(null)

  useEffect(() => {
    if (id && assets.length > 0) {
      const foundAsset = assets.find(a => a.id === id)
      setAsset(foundAsset || null)
      setLoading(false)
    }
  }, [id, assets])

  // Generate QR code when asset is loaded
  useEffect(() => {
    if (asset && qrCanvasRef.current) {
      const inspectionUrl = `intent://forms/fire-extinguisher-inspection#Intent;scheme=safetymate;package=com.upward.safetymate;end`
      QRCode.toCanvas(
        qrCanvasRef.current,
        inspectionUrl,
        {
          width: 200,
          height: 200,
          margin: 1,
          color: {
            dark: '#080d1a',
            light: '#ffffff'
          }
        }
      )
    }
  }, [asset])

  const handleDownloadQR = () => {
    if (!qrCanvasRef.current || !asset) return
    
    const canvas = qrCanvasRef.current
    const link = document.createElement('a')
    link.href = canvas.toDataURL('image/png')
    link.download = `QR_${asset.assetId}_${asset.assignedUnitId}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handlePrintQR = () => {
    if (!qrCanvasRef.current || !asset) return
    
    const printWindow = window.open('', '_blank')
    printWindow.document.write(`
      <html>
        <head>
          <title>QR Code - ${asset.assetId}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              padding: 40px;
              background: #fff;
            }
            .qr-container {
              border: 2px solid #000;
              padding: 20px;
              margin-bottom: 20px;
            }
            .info {
              text-align: center;
              font-size: 14px;
            }
            .info h2 {
              margin: 0 0 10px;
              font-size: 18px;
            }
            .info p {
              margin: 5px 0;
              color: #666;
            }
          </style>
        </head>
        <body>
          <div class="qr-container">
            <img src="${qrCanvasRef.current.toDataURL('image/png')}" width="200" height="200" />
          </div>
          <div class="info">
            <h2>${asset.assetId}</h2>
            <p><strong>Unit ID:</strong> ${asset.assignedUnitId}</p>
            <p><strong>Type:</strong> ${asset.type}</p>
            <p><strong>Sector:</strong> ${asset.sector}</p>
          </div>
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'rgba(148,163,184,0.6)', padding: 20, textAlign: 'center' }}>
        <div>
          <div className="fd-spinner fd-spinner--lg" style={{ marginBottom: 16 }} />
          <span style={{ fontSize: 14, fontWeight: 600 }}>
            Loading hydrant details...
          </span>
        </div>
      </div>
    )
  }

  if (!asset) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'rgba(148,163,184,0.6)', padding: 20, textAlign: 'center' }}>
        <AlertTriangle size={48} style={{ marginBottom: 16 }} />
        <h2 style={{ marginBottom: 8, fontSize: 'clamp(1.2rem, 4vw, 1.5rem)' }}>Hydrant Not Found</h2>
        <p style={{ marginBottom: 24, fontSize: 14 }}>The requested hydrant could not be found.</p>
        <button
          onClick={() => navigate(fdPath('/assets'))}
          style={{
            padding: '12px 24px',
            background: '#3a82ff',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 600
          }}
        >
          Back to Registry
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: '16px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <button
          onClick={() => navigate(fdPath('/assets'))}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 16px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            color: 'rgba(235,242,255,0.8)',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600
          }}
        >
          <ArrowLeft size={16} />
          Back to Registry
        </button>
        <h1 style={{ fontSize: 'clamp(1.2rem, 4vw, 1.5rem)', fontWeight: 800, color: '#fff', margin: 0 }}>
          Hydrant Details
        </h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 24 }}>
        {/* Left Column - QR Code and Basic Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* QR Code Card */}
          <div style={{
            background: '#0b0f1a',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16,
            padding: 'clamp(16px, 4vw, 32px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
              <QrCode size={20} style={{ color: '#4deba0' }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: '#4deba0', letterSpacing: '0.06em' }}>
                DIGITAL TAG
              </span>
            </div>
            
            <div style={{
              background: '#fff',
              padding: 'clamp(12px, 3vw, 20px)',
              borderRadius: 12,
              marginBottom: 24
            }}>
              <canvas ref={qrCanvasRef} style={{ width: 'clamp(150px, 40vw, 200px)', height: 'clamp(150px, 40vw, 200px)' }} />
            </div>

            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                ASSIGNED UNIT ID
              </div>
              <div style={{ fontSize: 'clamp(14px, 4vw, 18px)', fontWeight: 700, color: '#fff', wordBreak: 'break-word' }}>
                {asset.assignedUnitId}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, width: '100%', flexWrap: 'wrap' }}>
              <button
                onClick={handleDownloadQR}
                style={{
                  flex: 1,
                  minWidth: '120px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '12px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  color: 'rgba(235,242,255,0.8)',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600
                }}
              >
                <Download size={16} />
                Download
              </button>
              <button
                onClick={handlePrintQR}
                style={{
                  flex: 1,
                  minWidth: '120px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '12px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  color: 'rgba(235,242,255,0.8)',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600
                }}
              >
                <Printer size={16} />
                Print
              </button>
            </div>
          </div>

          {/* Basic Info Card */}
          <div style={{
            background: '#0b0f1a',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16,
            padding: 'clamp(16px, 4vw, 24px)'
          }}>
            <h3 style={{ fontSize: 'clamp(14px, 3vw, 16px)', fontWeight: 800, color: '#fff', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Activity size={18} style={{ color: '#3a82ff' }} />
              BASIC INFORMATION
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                  Asset ID
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
                  {asset.assetId}
                </div>
              </div>
              
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                  Serial Number
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
                  {asset.serialNumber}
                </div>
              </div>
              
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                  Type
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
                  {asset.type}
                </div>
              </div>
              
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                  Sector
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
                  {asset.sector}
                </div>
              </div>
              
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                  Status
                </div>
                <div style={{ 
                  fontSize: 14, 
                  fontWeight: 600, 
                  color: asset.status === 'active' ? '#4deba0' : 'rgba(235,242,255,0.8)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}>
                  <span style={{ 
                    width: 8, 
                    height: 8, 
                    borderRadius: '50%', 
                    background: asset.status === 'active' ? '#4deba0' : 'rgba(148,163,184,0.4)' 
                  }} />
                  {asset.status?.toUpperCase()}
                </div>
              </div>
              
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                  Encryption
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
                  {asset.encryption}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Location and Technical Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Location Card */}
          <div style={{
            background: '#0b0f1a',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16,
            padding: 'clamp(16px, 4vw, 24px)'
          }}>
            <h3 style={{ fontSize: 'clamp(14px, 3vw, 16px)', fontWeight: 800, color: '#fff', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <MapPin size={18} style={{ color: '#3a82ff' }} />
              LOCATION INFORMATION
            </h3>
            
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                GPS Coordinates
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
                {typeof asset.gps === 'object' ? 
                  `${asset.gps.lat?.toFixed(4)}° ${asset.gps.lat >= 0 ? 'N' : 'S'}, ${Math.abs(asset.gps.lng)?.toFixed(4)}° ${asset.gps.lng >= 0 ? 'E' : 'W'}` 
                  : asset.gps}
              </div>
            </div>
            
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                Installation Date
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Calendar size={14} style={{ color: 'rgba(148,163,184,0.6)' }} />
                {asset.installationDate}
              </div>
            </div>
          </div>

          {/* Technical Specifications Card */}
          <div style={{
            background: '#0b0f1a',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16,
            padding: 'clamp(16px, 4vw, 24px)'
          }}>
            <h3 style={{ fontSize: 'clamp(14px, 3vw, 16px)', fontWeight: 800, color: '#fff', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldAlert size={18} style={{ color: '#3a82ff' }} />
              TECHNICAL SPECIFICATIONS
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                  Flow Rate
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
                  {asset.flowRate} GPM
                </div>
              </div>
              
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                  Flow Performance
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
                  {asset.flowPerformance}%
                </div>
              </div>
              
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                  Pressure
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
                  {asset.pressure} BAR
                </div>
              </div>
              
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                  Leak Status
                </div>
                <div style={{ 
                  fontSize: 14, 
                  fontWeight: 600, 
                  color: asset.leakStatus === 'NEG_SECURE' ? '#4deba0' : '#fe8e2a',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}>
                  {asset.leakStatus === 'NEG_SECURE' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                  {asset.leakStatus}
                </div>
              </div>
            </div>
          </div>

          {/* Last Service Card */}
          <div style={{
            background: '#0b0f1a',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16,
            padding: 'clamp(16px, 4vw, 24px)'
          }}>
            <h3 style={{ fontSize: 'clamp(14px, 3vw, 16px)', fontWeight: 800, color: '#fff', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Activity size={18} style={{ color: '#3a82ff' }} />
              SERVICE INFORMATION
            </h3>
            
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                Last Service Date
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Calendar size={14} style={{ color: 'rgba(148,163,184,0.6)' }} />
                {asset.lastServiceDate || 'Not serviced yet'}
              </div>
            </div>
          </div>

          {/* Quick Actions Card */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(58,130,255,0.1), rgba(22,201,136,0.05))',
            border: '1px solid rgba(58,130,255,0.2)',
            borderRadius: 16,
            padding: 'clamp(16px, 4vw, 24px)'
          }}>
            <h3 style={{ fontSize: 'clamp(14px, 3vw, 16px)', fontWeight: 800, color: '#fff', marginBottom: 16 }}>
              QUICK ACTIONS
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button
                onClick={() => navigate(fdPath(`/inspection?id=${asset.id}`))}
                style={{
                  width: '100%',
                  padding: '14px 20px',
                  background: 'linear-gradient(135deg, #3a82ff, #16c988)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: '0 4px 16px rgba(58,130,255,0.3)'
                }}
              >
                <RefreshCw size={16} />
                Start New Inspection
              </button>
              <button
                onClick={() => navigate(fdPath(`/inspection-history/${asset.id}?type=hydrant`))}
                style={{
                  width: '100%',
                  padding: '14px 20px',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'rgba(235,242,255,0.8)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8
                }}
              >
                <FileText size={16} />
                View Past Inspections
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Last Inspection Report ── */}
      <div style={{ marginTop: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ width: 4, height: 20, background: asset.inspectionStatus === 'completed' ? '#4deba0' : 'rgba(148,163,184,0.3)', borderRadius: 2 }} />
          <h2 style={{ margin: 0, fontSize: 'clamp(14px, 3vw, 16px)', fontWeight: 800, color: '#fff' }}>
            LAST INSPECTION REPORT
          </h2>
          {asset.inspectionStatus === 'completed' && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', background: 'rgba(77,235,160,0.1)', border: '1px solid rgba(77,235,160,0.25)', borderRadius: 20, fontSize: 10, fontWeight: 700, color: '#4deba0', letterSpacing: '0.06em' }}>
              <CheckCircle size={10} /> COMPLETED
            </span>
          )}
        </div>

        {asset.inspectionStatus !== 'completed' ? (
          <div style={{ background: '#0b0f1a', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 16, padding: '40px 24px', textAlign: 'center', color: 'rgba(148,163,184,0.45)' }}>
            <Activity size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
            <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 700 }}>No inspection recorded yet</p>
            <p style={{ margin: 0, fontSize: 12 }}>Click "Start New Inspection" above to begin the first inspection for this asset.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>

            {/* ── Read-only banner ── */}
            <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', background: 'linear-gradient(90deg, rgba(58,130,255,0.1), rgba(22,201,136,0.04))', border: '1px solid rgba(58,130,255,0.2)', borderRadius: 10 }}>
              <Lock size={14} style={{ color: '#3a82ff', flexShrink: 0 }} />
              <div style={{ fontSize: 12, fontWeight: 700, color: '#3a82ff' }}>READ-ONLY</div>
              <div style={{ fontSize: 12, color: 'rgba(148,163,184,0.7)', marginLeft: 4 }}>
                Submitted on {asset.lastInspectionDate || 'N/A'} · All fields locked
              </div>
              <div style={{ marginLeft: 'auto' }}>
                <button
                  onClick={() => navigate(fdPath(`/inspection?id=${asset.id}`))}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'linear-gradient(135deg, #3a82ff, #16c988)', border: 'none', borderRadius: 6, color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer', boxShadow: '0 2px 10px rgba(58,130,255,0.3)' }}
                >
                  <RefreshCw size={12} /> Start New Inspection
                </button>
              </div>
            </div>

            {/* ── Pressure & Flow ── */}
            <div style={{ background: '#0b0f1a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 'clamp(16px, 4vw, 24px)' }}>
              <h3 style={{ margin: '0 0 18px', fontSize: 14, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShieldAlert size={16} style={{ color: '#3a82ff' }} /> PRESSURE & FLOW READINGS
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ padding: '14px', background: 'rgba(58,130,255,0.05)', borderRadius: 10, border: '1px solid rgba(58,130,255,0.12)' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(148,163,184,0.55)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Static Pressure</div>
                  <div style={{ fontSize: 32, fontWeight: 900, color: 'rgba(235,242,255,0.97)', lineHeight: 1 }}>
                    {asset.lastInspectionPressure ?? '—'}
                  </div>
                  <div style={{ fontSize: 11, color: '#3a82ff', marginTop: 4, fontWeight: 700 }}>BAR</div>
                </div>
                <div style={{ padding: '14px', background: 'rgba(22,201,136,0.05)', borderRadius: 10, border: '1px solid rgba(22,201,136,0.12)' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(148,163,184,0.55)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Flow Rate</div>
                  <div style={{ fontSize: 32, fontWeight: 900, color: 'rgba(235,242,255,0.97)', lineHeight: 1 }}>
                    {asset.lastInspectionFlowRate ?? '—'}
                  </div>
                  <div style={{ fontSize: 11, color: '#4deba0', marginTop: 4, fontWeight: 700 }}>GPM</div>
                </div>
              </div>
            </div>

            {/* ── Integrity Checklist ── */}
            <div style={{ background: '#0b0f1a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 'clamp(16px, 4vw, 24px)' }}>
              <h3 style={{ margin: '0 0 18px', fontSize: 14, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle size={16} style={{ color: '#4deba0' }} /> INTEGRITY CHECKLIST
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { key: 'valveCondition', label: 'Valve Condition' },
                  { key: 'hoseCoupling', label: 'Hose & Coupling' },
                  { key: 'leakDetection', label: 'Leak Detection' },
                  { key: 'paintCoating', label: 'Paint & Coating' }
                ].map((item) => {
                  const val = asset.inspectionChecklist?.[item.key]
                  return (
                    <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(235,242,255,0.85)' }}>{item.label}</span>
                      {val === true && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', background: 'rgba(22,201,136,0.1)', border: '1px solid rgba(22,201,136,0.3)', borderRadius: 6, fontSize: 11, fontWeight: 800, color: '#4deba0' }}>
                          <Check size={10} /> PASS
                        </span>
                      )}
                      {val === false && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', background: 'rgba(255,83,95,0.1)', border: '1px solid rgba(255,83,95,0.3)', borderRadius: 6, fontSize: 11, fontWeight: 800, color: '#ff535f' }}>
                          <X size={10} /> FAIL
                        </span>
                      )}
                      {val === null || val === undefined ? (
                        <span style={{ fontSize: 11, color: 'rgba(148,163,184,0.35)', fontWeight: 600 }}>—</span>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ── Defect Report ── */}
            <div style={{ background: '#0b0f1a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 'clamp(16px, 4vw, 24px)' }}>
              <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={16} style={{ color: '#fe8e2a' }} /> DEFECT REPORT
              </h3>
              <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)', minHeight: 80, fontSize: 13, color: asset.lastDefectDescription ? 'rgba(235,242,255,0.85)' : 'rgba(148,163,184,0.35)', lineHeight: 1.6 }}>
                {asset.lastDefectDescription || 'No defects or engineering comments recorded.'}
              </div>
            </div>

            {/* ── Photo Evidence ── */}
            <div style={{ background: '#0b0f1a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 'clamp(16px, 4vw, 24px)' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Camera size={16} style={{ color: '#3a82ff' }} /> PHOTO EVIDENCE
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {['before', 'after'].map((type) => (
                  <div key={type}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(148,163,184,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{type} Protocol</div>
                    <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', aspectRatio: '1', background: 'rgba(255,255,255,0.02)', position: 'relative' }}>
                      {asset.inspectionPhotos?.[type] ? (
                        <>
                          <img src={asset.inspectionPhotos[type]} alt={`${type} protocol`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '4px 8px', background: 'rgba(0,0,0,0.55)', fontSize: 9, fontWeight: 800, color: '#4deba0', letterSpacing: '0.06em', textAlign: 'center' }}>
                            {type.toUpperCase()}
                          </div>
                        </>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(148,163,184,0.25)', gap: 4 }}>
                          <Camera size={24} style={{ opacity: 0.5 }} />
                          <span style={{ fontSize: 10, fontWeight: 700 }}>No Photo</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Signature ── */}
            <div style={{ background: '#0b0f1a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 'clamp(16px, 4vw, 24px)', gridColumn: '1 / -1' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle size={16} style={{ color: '#4deba0' }} /> DIGITAL SIGNATURE
              </h3>
              {asset.inspectionSignature ? (
                <div style={{ maxWidth: 460, position: 'relative' }}>
                  <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(77,235,160,0.2)', background: 'rgba(255,255,255,0.85)' }}>
                    <img src={asset.inspectionSignature} alt="Digital Signature" style={{ width: '100%', display: 'block', objectFit: 'contain', maxHeight: 120 }} />
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: '#4deba0' }}>
                    <CheckCircle size={12} /> Digitally signed & verified · {asset.lastInspectionDate || 'N/A'}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 13, color: 'rgba(148,163,184,0.35)', fontWeight: 600 }}>No signature recorded.</div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
