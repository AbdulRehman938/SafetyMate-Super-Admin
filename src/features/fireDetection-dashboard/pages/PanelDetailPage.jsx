import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, QrCode, Download, Printer, Activity, MapPin, ShieldAlert, Calendar, AlertTriangle, FileText } from 'lucide-react'
import { useFireDetectionData } from '../hooks/useFireDetectionData.js'
import QRCode from 'qrcode'
import '../fd.css'

export function PanelDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { panels, loading } = useFireDetectionData()
  const qrCanvasRef = useRef(null)

  const [asset, setAsset] = useState(null)

  // Fetch panel by ID
  useEffect(() => {
    if (id && panels.length > 0) {
      const found = panels.find((p) => p.id === id)
      setAsset(found)
    }
  }, [id, panels])

  // Generate QR code
  useEffect(() => {
    if (asset && qrCanvasRef.current) {
      const inspectionUrl = `intent://forms/panel-tactical-inspection#Intent;scheme=safetymate;package=com.upward.safetymate;end`
      QRCode.toCanvas(
        qrCanvasRef.current,
        inspectionUrl,
        {
          width: 200,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        },
        (error) => {
          if (error) console.error('QR code generation error:', error)
        }
      )
    }
  }, [asset])

  // Handle QR code download
  const handleDownloadQR = () => {
    if (!qrCanvasRef.current || !asset) return

    const canvas = qrCanvasRef.current
    const combinedCanvas = document.createElement('canvas')
    const ctx = combinedCanvas.getContext('2d')
    const padding = 20
    const lineHeight = 16

    combinedCanvas.width = canvas.width + (padding * 2)
    combinedCanvas.height = canvas.height + (padding * 3) + (lineHeight * 5)

    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, combinedCanvas.width, combinedCanvas.height)

    ctx.drawImage(canvas, padding, padding)

    ctx.fillStyle = '#000000'
    ctx.font = 'bold 14px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('PANEL DIGITAL TAG', combinedCanvas.width / 2, canvas.height + padding + lineHeight)
    
    ctx.font = '12px Arial'
    ctx.fillText(`Panel ID: ${asset.panelId}`, combinedCanvas.width / 2, canvas.height + padding + (lineHeight * 2))
    ctx.fillText(`Zone: ${asset.zone}`, combinedCanvas.width / 2, canvas.height + padding + (lineHeight * 3))
    ctx.fillText(`Type: ${asset.type}`, combinedCanvas.width / 2, canvas.height + padding + (lineHeight * 4))
    ctx.fillText(`Status: ${(asset.status || '—').toUpperCase()}`, combinedCanvas.width / 2, canvas.height + padding + (lineHeight * 5))
    
    const dataUrl = combinedCanvas.toDataURL('image/png')
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = `QR_${asset.panelId}_${asset.zone}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Handle QR code print
  const handlePrintQR = () => {
    if (!asset || !qrCanvasRef.current) return
    
    const printWindow = window.open('', '_blank')
    const canvas = qrCanvasRef.current
    const dataUrl = canvas.toDataURL('image/png')
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Panel QR Code - ${asset.panelId}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 20px;
            margin: 0;
          }
          .qr-container {
            text-align: center;
            margin-bottom: 20px;
          }
          img {
            max-width: 300px;
            border: 1px solid #ddd;
            padding: 10px;
            background: white;
          }
          .info {
            margin-top: 10px;
            font-size: 14px;
            color: #333;
          }
          .info div {
            margin: 5px 0;
          }
        </style>
      </head>
      <body>
        <div class="qr-container">
          <img src="${dataUrl}" alt="QR Code" />
          <div class="info">
            <div><strong>Panel ID:</strong> ${asset.panelId}</div>
            <div><strong>Zone:</strong> ${asset.zone}</div>
            <div><strong>Type:</strong> ${asset.type}</div>
            <div><strong>Status:</strong> ${(asset.status || '—').toUpperCase()}</div>
          </div>
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
            Loading panel details...
          </span>
        </div>
      </div>
    )
  }

  if (!asset) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'rgba(148,163,184,0.6)', padding: 20, textAlign: 'center' }}>
        <AlertTriangle size={48} style={{ marginBottom: 16 }} />
        <h2 style={{ marginBottom: 8, fontSize: 'clamp(1.2rem, 4vw, 1.5rem)' }}>Panel Not Found</h2>
        <p style={{ marginBottom: 24, fontSize: 14 }}>The requested panel could not be found.</p>
        <button
          onClick={() => navigate('/detection/panels')}
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
          onClick={() => navigate('/detection/panels')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 16px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            color:('rgba(235,242,255,0.8)'),
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600
          }}
        >
          <ArrowLeft size={16} />
          Back to Registry
        </button>
        <h1 style={{ fontSize: 'clamp(1.2rem, 4vw, 1.5rem)', fontWeight: 800, color: '#fff', margin: 0 }}>
          Panel Details
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
                PANEL ID
              </div>
              <div style={{ fontSize: 'clamp(14px, 4vw, 18px)', fontWeight: 700, color: '#fff', wordBreak: 'break-word' }}>
                {asset.panelId}
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
                  Panel ID
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
                  {asset.panelId}
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
                  Zone
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
                  {asset.zone}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                  Status
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: asset.status === 'nominal' ? '#4deba0' : '#ff535f' }}>
                  {asset.status?.toUpperCase() || 'UNKNOWN'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                  Encryption
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
                  AES-256 Bit
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
                Location
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
                {asset.location}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                Zone ID
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
                {asset.zoneId}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                Installation Date
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Calendar size={14} style={{ color: 'rgba(148,163,184,0.6)' }} />
                {asset.installDate}
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
                  Sensitivity
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
                  {asset.sensitivity}%
                </div>
              </div>
              
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                  Status
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: asset.status === 'nominal' ? '#4deba0' : '#ff535f' }}>
                  {asset.status?.toUpperCase() || 'UNKNOWN'}
                </div>
              </div>
            </div>
          </div>

          {/* Schedule Inspection Card */}
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
                onClick={() => navigate(`/detection/panel-inspection?id=${asset.id}`)}
                style={{
                  width: '100%',
                  padding: '14px 20px',
                  background: '#3a82ff',
                  color: '#fff',
                  border: 'none',
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
                <Activity size={16} />
                Schedule New Inspection
              </button>
              <button
                onClick={() => navigate(`/detection/inspection-history/${asset.id}?type=panel`)}
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
    </div>
  )
}
