import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, QrCode, Download, Printer, Activity, MapPin, ShieldAlert, Calendar, AlertTriangle, FileText, CheckCircle, XCircle } from 'lucide-react'
import { useFireExtData } from '../hooks/useFireExtData.js'
import QRCode from 'qrcode'
import { formatDate } from '../utils/feHelpers.js'
import '../fe.css'

export function FEDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { assets, loading } = useFireExtData()
  const qrCanvasRef = useRef(null)

  const [asset, setAsset] = useState(null)

  // Fetch asset by ID
  useEffect(() => {
    if (id && assets.length > 0) {
      const found = assets.find((a) => a.id === id || a.assetId === id)
      setAsset(found)
    }
  }, [id, assets])

  // Generate QR code
  useEffect(() => {
    if (asset && qrCanvasRef.current) {
      const qrPayload = JSON.stringify({
        id: asset.assetId || asset.id,
        type: asset.extinguisherType || 'Pending',
        sn: asset.serialNumber || 'Pending',
        site: asset.facilitySite || 'Pending',
        url: `https://safetymate.app/asset/${asset.assetId || asset.id}`,
      })
      QRCode.toCanvas(
        qrCanvasRef.current,
        qrPayload,
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
    ctx.fillText('FIRE EXTINGUISHER TAG', combinedCanvas.width / 2, canvas.height + padding + lineHeight)
    
    ctx.font = '12px Arial'
    ctx.fillText(`Asset ID: ${asset.assetId}`, combinedCanvas.width / 2, canvas.height + padding + (lineHeight * 2))
    ctx.fillText(`Type: ${asset.extinguisherType}`, combinedCanvas.width / 2, canvas.height + padding + (lineHeight * 3))
    ctx.fillText(`Site: ${asset.facilitySite}`, combinedCanvas.width / 2, canvas.height + padding + (lineHeight * 4))
    ctx.fillText(`Status: ${(asset.status || '—').toUpperCase()}`, combinedCanvas.width / 2, canvas.height + padding + (lineHeight * 5))
    
    const dataUrl = combinedCanvas.toDataURL('image/png')
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = `QR_${asset.assetId}_${asset.facilitySite}.png`
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
        <title>Fire Extinguisher QR Code - ${asset.assetId}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            padding: 20px;
            background: white;
          }
          .qr-container {
            text-align: center;
            padding: 20px;
            border: 2px solid #000;
            border-radius: 8px;
          }
          .qr-image {
            width: 200px;
            height: 200px;
            margin-bottom: 15px;
          }
          .title {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 10px;
          }
          .info {
            font-size: 14px;
            margin: 5px 0;
          }
        </style>
      </head>
      <body>
        <div class="qr-container">
          <div class="title">FIRE EXTINGUISHER TAG</div>
          <img src="${dataUrl}" class="qr-image" alt="QR Code" />
          <div class="info"><strong>Asset ID:</strong> ${asset.assetId}</div>
          <div class="info"><strong>Type:</strong> ${asset.extinguisherType}</div>
          <div class="info"><strong>Site:</strong> ${asset.facilitySite}</div>
          <div class="info"><strong>Status:</strong> ${(asset.status || '—').toUpperCase()}</div>
        </div>
      </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', gap: 16, color: 'rgba(148,163,184,0.8)' }}>
        <div className="fe-spinner fe-spinner--lg" />
        <span style={{ fontSize: 14, fontWeight: 600 }}>Loading asset details...</span>
      </div>
    )
  }

  if (!asset) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'rgba(148,163,184,0.6)', padding: 20, textAlign: 'center' }}>
        <AlertTriangle size={48} style={{ marginBottom: 16 }} />
        <h2 style={{ marginBottom: 8, fontSize: 'clamp(1.2rem, 4vw, 1.5rem)' }}>Asset Not Found</h2>
        <p style={{ marginBottom: 24, fontSize: 14 }}>The requested asset could not be found.</p>
        <button
          onClick={() => navigate('/extinguisher/assets')}
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

  const statusColor = asset.status === 'compliant' ? '#4deba0' : asset.status === 'non_compliant' ? '#ff535f' : 'rgba(148,163,184,0.6)'

  return (
    <div className="fe-subpage">
      {/* Page Header */}
      <div style={{ marginBottom: 24 }}>
        <button
          type="button"
          onClick={() => navigate('/extinguisher/assets')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8,
            color: 'rgba(148,163,184,0.8)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            marginBottom: 16
          }}
        >
          <ArrowLeft size={14} />
          Back to Registry
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ margin: '0 0 4px', fontSize: 'clamp(1.4rem, 3vw, 1.9rem)', fontWeight: 900, color: 'rgba(235,242,255,0.97)', letterSpacing: '-0.025em' }}>
              {asset.assetId || asset.id}
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: 'rgba(148,163,184,0.72)' }}>
              {asset.extinguisherType} · {asset.facilitySite} · {asset.floorZone || 'Zone Unassigned'}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: asset.status === 'compliant' ? 'rgba(77,235,160,0.1)' : 'rgba(255,83,95,0.1)', border: `1px solid ${asset.status === 'compliant' ? 'rgba(77,235,160,0.2)' : 'rgba(255,83,95,0.2)'}`, borderRadius: 8 }}>
            {asset.status === 'compliant' ? <CheckCircle size={14} style={{ color: '#4deba0' }} /> : <XCircle size={14} style={{ color: '#ff535f' }} />}
            <span style={{ fontSize: 12, fontWeight: 700, color: statusColor }}>
              {(asset.status || 'pending').toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginBottom: 20 }}>
        {/* Asset Information Card */}
        <div className="fe-card">
          <div className="fe-card-head">
            <span className="fe-card-title">ASSET INFORMATION</span>
            <Activity size={16} style={{ color: '#3a82ff' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16, padding: '16px 18px' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.55)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                SERIAL NUMBER
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(235,242,255,0.9)', fontFamily: 'monospace' }}>
                {asset.serialNumber || '—'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.55)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                CAPACITY
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(235,242,255,0.9)' }}>
                {asset.capacityKg ? `${asset.capacityKg} kg` : '—'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.55)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                INSTALLATION DATE
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(235,242,255,0.9)' }}>
                {formatDate(asset.installationDate)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.55)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                LAST INSPECTION
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(235,242,255,0.9)' }}>
                {formatDate(asset.lastInspectedAt)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.55)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                NEXT DUE DATE
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: asset.nextInspectionDate && new Date(asset.nextInspectionDate?.toMillis ? asset.nextInspectionDate.toMillis() : asset.nextInspectionDate) < new Date() ? '#ff535f' : 'rgba(235,242,255,0.9)' }}>
                {formatDate(asset.nextInspectionDate)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.55)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                CERT EXPIRY
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: asset.certExpiry && new Date(asset.certExpiry?.toMillis ? asset.certExpiry.toMillis() : asset.certExpiry) < new Date() ? '#ff535f' : 'rgba(235,242,255,0.9)' }}>
                {formatDate(asset.certExpiry)}
              </div>
            </div>
          </div>
        </div>

        {/* Location Card */}
        <div className="fe-card">
          <div className="fe-card-head">
            <span className="fe-card-title">LOCATION</span>
            <MapPin size={16} style={{ color: '#3a82ff' }} />
          </div>
          <div style={{ padding: '16px 18px' }}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.55)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                FACILITY SITE
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(235,242,255,0.9)' }}>
                {asset.facilitySite || '—'}
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.55)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                FLOOR / ZONE
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(235,242,255,0.9)' }}>
                {asset.floorZone || '—'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.55)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                ROOM / PILLAR
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(235,242,255,0.9)' }}>
                {asset.roomPillar || '—'}
              </div>
            </div>
          </div>
        </div>

        {/* QR Code Card */}
        <div className="fe-card">
          <div className="fe-card-head">
            <span className="fe-card-title">DIGITAL TAG (QR)</span>
            <QrCode size={16} style={{ color: '#3a82ff' }} />
          </div>
          <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ background: '#fff', borderRadius: 8, padding: 10, marginBottom: 16 }}>
              <canvas ref={qrCanvasRef} style={{ display: 'block', borderRadius: 6 }} />
            </div>
            <div style={{ display: 'flex', gap: 8, width: '100%' }}>
              <button
                type="button"
                onClick={handleDownloadQR}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '10px 16px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 8,
                  color: 'rgba(235,242,255,0.9)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <Download size={14} />
                Download
              </button>
              <button
                type="button"
                onClick={handlePrintQR}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '10px 16px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 8,
                  color: 'rgba(235,242,255,0.9)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <Printer size={14} />
                Print
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions Card */}
      <div className="fe-card">
        <div className="fe-card-head">
          <span className="fe-card-title">QUICK ACTIONS</span>
          <Activity size={16} style={{ color: '#3a82ff' }} />
        </div>
        <div style={{ padding: '16px 18px', display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <button
            type="button"
            onClick={() => navigate(`/extinguisher/assets/${asset.id}/inspect?new=1`)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 20px',
              background: 'rgba(58,130,255,0.15)',
              border: '1px solid rgba(58,130,255,0.3)',
              borderRadius: 8,
              color: '#8ab8ff',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <FileText size={16} />
            Start New Inspection
          </button>
          <button
            type="button"
            onClick={() => navigate(`/extinguisher/assets/${asset.id}/inspect`)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 20px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8,
              color: 'rgba(235,242,255,0.9)',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <Activity size={16} />
            View Last Inspection
          </button>
        </div>
      </div>
    </div>
  )
}
