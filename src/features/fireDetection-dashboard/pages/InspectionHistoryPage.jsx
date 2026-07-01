import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Calendar, CheckCircle, XCircle, AlertTriangle, FileText, Activity } from 'lucide-react'
import { useFireDetectionData } from '../hooks/useFireDetectionData.js'
import { useModulePath } from '../../../shared/navigation/modulePaths.js'
import '../fd.css'

export function InspectionHistoryPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const fdPath = useModulePath('/detection', '/client/fire-safety/detection')
  const { assets, panels, activityLog } = useFireDetectionData()
  
  const type = searchParams.get('type') || 'hydrant'
  const [asset, setAsset] = useState(null)
  const [inspections, setInspections] = useState([])
  const [loading, setLoading] = useState(true)

  // Fetch asset by ID and type
  useEffect(() => {
    if (id) {
      if (type === 'hydrant') {
        const found = assets.find((a) => a.id === id)
        setAsset(found)
      } else if (type === 'panel') {
        const found = panels.find((p) => p.id === id)
        setAsset(found)
      }
      setLoading(false)
    }
  }, [id, type, assets, panels])

  // Filter activity log for inspections related to this asset
  useEffect(() => {
    if (id && activityLog.length > 0) {
      const assetInspections = activityLog
        .filter((entry) => {
          // For hydrants: type === 'inspection' and assetId === id
          // For panels: type === 'panel_inspection' and panelId === id
          if (type === 'hydrant') {
            return entry.type === 'inspection' && entry.assetId === id
          } else if (type === 'panel') {
            return entry.type === 'panel_inspection' && entry.panelId === id
          }
          return false
        })
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      setInspections(assetInspections)
    }
  }, [id, activityLog, type])

  const formatDate = (timestamp) => {
    if (!timestamp) return '—'
    
    let date
    // Handle Firestore Timestamp object
    if (timestamp && typeof timestamp.toDate === 'function') {
      date = timestamp.toDate()
    } else if (timestamp && timestamp.seconds) {
      // Handle Firestore timestamp with seconds
      date = new Date(timestamp.seconds * 1000)
    } else {
      // Handle ISO string or regular date
      date = new Date(timestamp)
    }
    
    if (isNaN(date.getTime())) return 'Invalid Date'
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'rgba(148,163,184,0.6)', padding: 20, textAlign: 'center' }}>
        <div>
          <div className="fd-spinner fd-spinner--lg" style={{ marginBottom: 16 }} />
          <span style={{ fontSize: 14, fontWeight: 600 }}>
            Loading inspection history...
          </span>
        </div>
      </div>
    )
  }

  if (!asset) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'rgba(148,163,184,0.6)', padding: 20, textAlign: 'center' }}>
        <AlertTriangle size={48} style={{ marginBottom: 16 }} />
        <h2 style={{ marginBottom: 8, fontSize: 'clamp(1.2rem, 4vw, 1.5rem)' }}>Asset Not Found</h2>
        <p style={{ marginBottom: 24, fontSize: 14 }}>The requested asset could not be found.</p>
        <button
          onClick={() => navigate(type === 'hydrant' ? fdPath('/assets') : fdPath('/panels'))}
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
    <div style={{ padding: '16px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <button
          onClick={() => navigate(type === 'hydrant' ? fdPath(`/assets/${id}`) : fdPath(`/panels/${id}`))}
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
          Back to Details
        </button>
        <h1 style={{ fontSize: 'clamp(1.2rem, 4vw, 1.5rem)', fontWeight: 800, color: '#fff', margin: 0 }}>
          Inspection History
        </h1>
      </div>

      {/* Asset Info Card */}
      <div className="fd-card" style={{ padding: '20px', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
              {type === 'hydrant' ? 'Hydrant ID' : 'Panel ID'}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>
              {type === 'hydrant' ? asset.assetId : asset.panelId}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
              Location
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(235,242,255,0.85)' }}>
              {type === 'hydrant' ? asset.sector : asset.location}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
              Status
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: asset.status === 'operational' || asset.status === 'nominal' ? '#4deba0' : '#ff535f' }}>
              {asset.status?.toUpperCase() || 'UNKNOWN'}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
              Total Inspections
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#3a82ff' }}>
              {inspections.length}
            </div>
          </div>
        </div>
      </div>

      {/* Inspections List */}
      {inspections.length === 0 ? (
        <div className="fd-card" style={{ padding: '60px 20px', textAlign: 'center' }}>
          <FileText size={48} style={{ marginBottom: 16, color: 'rgba(148,163,184,0.4)' }} />
          <h3 style={{ fontSize: 18, fontWeight: 700, color: 'rgba(235,242,255,0.85)', marginBottom: 8 }}>
            No Inspections Found
          </h3>
          <p style={{ fontSize: 14, color: 'rgba(148,163,184,0.6)', marginBottom: 24 }}>
            This {type === 'hydrant' ? 'hydrant' : 'panel'} has no inspection history yet.
          </p>
          <button
            onClick={() => navigate(type === 'hydrant' ? fdPath(`/inspection?id=${id}`) : fdPath(`/panel-inspection?id=${id}`))}
            style={{
              padding: '12px 24px',
              background: '#3a82ff',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <Activity size={16} />
            Schedule First Inspection
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {inspections.map((inspection, index) => (
            <div
              key={inspection.id}
              className="fd-card"
              style={{ padding: '20px', borderLeft: `4px solid ${inspection.status === 'success' ? '#4deba0' : '#ff535f'}` }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    {inspection.status === 'success' ? (
                      <CheckCircle size={20} style={{ color: '#4deba0' }} />
                    ) : (
                      <XCircle size={20} style={{ color: '#ff535f' }} />
                    )}
                    <span style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>
                      Inspection #{inspections.length - index}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: 'rgba(148,163,184,0.7)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Calendar size={14} />
                    {formatDate(inspection.timestamp)}
                  </div>
                </div>
                <div style={{ flex: 2, minWidth: 300 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(235,242,255,0.85)', marginBottom: 4 }}>
                    {inspection.message}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(148,163,184,0.6)' }}>
                    {inspection.status === 'success' ? 'Completed successfully' : 'Completed with issues'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    padding: '4px 12px',
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    background: inspection.status === 'success' ? 'rgba(77,235,160,0.12)' : 'rgba(255,83,95,0.12)',
                    color: inspection.status === 'success' ? '#4deba0' : '#ff535f',
                    display: 'inline-block'
                  }}>
                    {inspection.status === 'success' ? 'Passed' : 'Failed'}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
