import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, RefreshCw, SlidersHorizontal, Search, X, TrendingUp, Truck } from 'lucide-react'
import { useFleetData } from '../hooks/useFleetData.js'
import { VehicleDetails } from '../components/VehicleDetails.jsx'
import { FleetMap } from '../components/FleetMap.jsx'
import { ReadinessDonut } from '../components/ReadinessDonut.jsx'
import { RegisterVehiclePage } from './RegisterVehiclePage.jsx'
import { cap } from '../utils/fleetHelpers.js'
import '../fleet.css'

const PAGE_SIZE = 10

// Service health colour + label based on remaining service km or next service date
function serviceHealth(vehicle) {
  const next = vehicle.nextService
  if (!next) return { label: '—', color: 'rgba(148,163,184,0.5)', pct: 0 }
  const now = Date.now()
  let ts = 0
  if (typeof next.toMillis === 'function') ts = next.toMillis()
  else if (next instanceof Date) ts = next.getTime()
  else ts = new Date(next).getTime()
  const daysLeft = Math.round((ts - now) / 86400000)
  if (daysLeft < 0)  return { label: 'OVERDUE',            color: '#ff535f', pct: 100 }
  if (daysLeft < 14) return { label: `${daysLeft}D LEFT`,  color: '#ff535f', pct: 85  }
  if (daysLeft < 30) return { label: `${daysLeft}D LEFT`,  color: '#fe8e2a', pct: 60  }
  return { label: `${daysLeft}D LEFT`, color: '#3a82ff', pct: 30 }
}

export function SiteMapPage() {
  const navigate = useNavigate()
  const { vehicles, inspections, openAlerts, loading, resolveAlert, avgHealth, activeVehicles, totalVehicles, crewReady, addVehicle, updateVehicle } = useFleetData()

  const [selectedVehicle, setSelectedVehicle] = useState(null)
  const [page, setPage]                       = useState(1)
  const [statusFilter, setStatusFilter]       = useState('All')
  const [showFilters, setShowFilters]         = useState(false)
  const [mapExpanded, setMapExpanded]         = useState(false)
  const [alertSearch, setAlertSearch]         = useState('')
  const [showAdd, setShowAdd]                 = useState(false)
  const [editVehicle, setEditVehicle]         = useState(null)
  const [saving, setSaving]                   = useState(false)
  const [statusResetVehicleId, setStatusResetVehicleId] = useState(null)
  const [isMobile, setIsMobile]               = useState(() => window.matchMedia('(max-width: 960px)').matches)

  // ── Responsive mobile detection ────────────────────────────────────
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 960px)')
    const apply = () => setIsMobile(mq.matches)
    apply()
    mq.addEventListener?.('change', apply)
    return () => mq.removeEventListener?.('change', apply)
  }, [])

  const filteredAlerts = useMemo(() => {
    if (!alertSearch.trim()) return openAlerts
    const q = alertSearch.trim().toLowerCase()
    return openAlerts.filter((a) =>
      (a.vehicleUnit || '').toLowerCase().includes(q) ||
      (a.message     || '').toLowerCase().includes(q) ||
      (a.severity    || '').toLowerCase().includes(q)
    )
  }, [openAlerts, alertSearch])

  async function handleAdd(data) {
    setSaving(true)
    try {
      if (editVehicle) {
        const wasApproved = editVehicle.complianceStatus === 'Approved'
        await updateVehicle(editVehicle.id, data)
        if (wasApproved) {
          setStatusResetVehicleId(editVehicle.id)
        }
      } else {
        await addVehicle(data)
      }
    } finally {
      setSaving(false)
      setShowAdd(false)
      setEditVehicle(null)
    }
  }

  function handleEditVehicle(vehicle) {
    setEditVehicle(vehicle)
    setShowAdd(true)
  }

  const totalCrew = vehicles.filter((v) => v.site).length

  // Vehicles allocated to site — filtered
  const allocated = useMemo(() => {
    let list = vehicles.filter((v) => v.site)
    if (statusFilter !== 'All') list = list.filter((v) => (v.status || '').toLowerCase() === statusFilter)
    return list
  }, [vehicles, statusFilter])

  const totalPages = Math.max(1, Math.ceil(allocated.length / PAGE_SIZE))
  const safePage   = Math.min(page, totalPages)
  const paginated  = allocated.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  if (showAdd) {
    return (
      <div className="fleet-subpage" style={{ padding: '32px 28px 80px', color: '#ffffff' }}>
        <RegisterVehiclePage 
          onSave={handleAdd} 
          onCancel={() => { setShowAdd(false); setEditVehicle(null); }} 
          loading={saving} 
          editVehicle={editVehicle}
        />
      </div>
    )
  }

  if (selectedVehicle) {
    return (
      <VehicleDetails
        vehicle={selectedVehicle}
        alerts={openAlerts}
        inspections={inspections}
        onBack={() => { setSelectedVehicle(null); setStatusResetVehicleId(null); }}
        viewOnly={true}
        backText="Back to Site Map"
        onEdit={handleEditVehicle}
        statusReset={statusResetVehicleId === selectedVehicle.id}
      />
    )
  }

  if (loading) return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'60vh', gap:'12px', color:'rgba(148,163,184,0.8)' }}>
      <span className="fleet-spinner fleet-spinner--lg" />
      <span style={{ fontSize:'14px', fontWeight:600 }}>Loading site map…</span>
    </div>
  )

  return (
    <div className="fleet-subpage" style={{ paddingBottom:'40px' }}>

      {/* ══════════════════════════════════════════════════════════════
          TOP ROW — 3 columns:
          [1] Readiness donut
          [2] Active Fleet + Crew Ready stacked in ONE card
          [3] Critical Alerts — full height, scrollable
          ══════════════════════════════════════════════════════════════ */}
      <div className="fleet-sitemap-top-row" style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? '16px' : '12px',
      }}>

        {/* ── Col 1: Site Readiness Score ── */}
        <div className="fleet-section-card" style={{
          display:'flex', flexDirection:'column', alignItems:'center',
          justifyContent:'center', padding:'18px 12px', textAlign:'center',
          width: isMobile ? '100%' : 'auto',
          flex: isMobile ? 'none' : 1,
        }}>
          <p style={{ margin:'0 0 10px', fontSize:'10.5px', fontWeight:700, letterSpacing:'0.09em', textTransform:'uppercase', color:'rgba(148,163,184,0.7)' }}>
            Site Readiness Score
          </p>
          <ReadinessDonut score={avgHealth} size={110} />
          <div style={{ display:'flex', alignItems:'center', gap:'5px', fontSize:'11.5px', fontWeight:700, color:'#4deba0', marginTop:'8px' }}>
            <TrendingUp size={11} />
            {avgHealth >= 85 ? 'Above Target' : avgHealth >= 60 ? 'On Track' : 'Below Target'}
          </div>
        </div>

        {/* ── Col 2: Active Fleet + Crew Ready merged ── */}
        <div className="fleet-section-card" style={{ display:'flex', flexDirection:'column', padding:0, overflow:'hidden' }}>
          {/* Active Fleet — top half */}
          <div style={{ flex:1, padding:'16px 18px 12px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
            <p style={{ margin:'0 0 6px', fontSize:'10px', fontWeight:700, letterSpacing:'0.09em', textTransform:'uppercase', color:'rgba(148,163,184,0.7)' }}>
              Active Fleet
            </p>
            <p style={{ margin:0, lineHeight:1 }}>
              <span style={{ fontSize:'2rem', fontWeight:800, letterSpacing:'-0.04em', color:'#5ba8ff' }}>{activeVehicles}</span>
              <span style={{ fontSize:'0.95rem', fontWeight:600, color:'rgba(148,163,184,0.65)', marginLeft:'6px' }}>/ {totalVehicles} units</span>
            </p>
            <div className="fleet-kpi-bar" style={{ marginTop:'8px' }}>
              <div className="fleet-kpi-bar-fill fleet-kpi-bar-fill--blue"
                style={{ width: totalVehicles ? `${(activeVehicles/totalVehicles)*100}%` : '0%' }} />
            </div>
            <p style={{ margin:'5px 0 0', fontSize:'11.5px', color:'rgba(148,163,184,0.6)', fontWeight:600 }}>
              {totalVehicles - activeVehicles} inactive
            </p>
          </div>
          {/* Crew Ready — bottom half */}
          <div style={{ flex:1, padding:'12px 18px 16px' }}>
            <p style={{ margin:'0 0 6px', fontSize:'10px', fontWeight:700, letterSpacing:'0.09em', textTransform:'uppercase', color:'rgba(148,163,184,0.7)' }}>
              Crew Ready
            </p>
            <p style={{ margin:0, lineHeight:1 }}>
              <span style={{ fontSize:'2rem', fontWeight:800, letterSpacing:'-0.04em', color:'#4deba0' }}>{crewReady}</span>
              <span style={{ fontSize:'0.95rem', fontWeight:600, color:'rgba(148,163,184,0.65)', marginLeft:'6px' }}>/ {totalCrew} ready</span>
            </p>
            <div className="fleet-kpi-bar" style={{ marginTop:'8px' }}>
              <div className="fleet-kpi-bar-fill fleet-kpi-bar-fill--green"
                style={{ width: totalCrew ? `${(crewReady/totalCrew)*100}%` : '0%' }} />
            </div>
            <p style={{ margin:'5px 0 0', fontSize:'11.5px', color:'rgba(148,163,184,0.6)', fontWeight:600 }}>
              {totalCrew - crewReady} awaiting assignment
            </p>
          </div>
        </div>

        {/* ── Col 3: Critical Alerts — fills remaining width, scrollable ── */}
        <div className="fleet-section-card fleet-alerts-card" style={{ 
          display:'flex', 
          flexDirection:'column', 
          overflow:'hidden',
          width: isMobile ? '100%' : 'auto',
          flex: isMobile ? 'none' : 2,
        }}>

          {/* Header */}
          <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'12px 14px 10px', borderBottom:'1px solid rgba(255,83,95,0.14)', flexShrink:0 }}>
            <AlertTriangle size={13} style={{ color:'#ff6b6b', flexShrink:0 }} />
            <span style={{ fontSize:'11px', fontWeight:800, letterSpacing:'0.08em', textTransform:'uppercase', color:'#ff6b6b' }}>
              Critical Alerts
            </span>
            {openAlerts.length > 0 && (
              <span style={{ marginLeft:'auto', fontSize:'10px', fontWeight:800, background:'rgba(255,83,95,0.15)', color:'#ff8080', border:'1px solid rgba(255,83,95,0.28)', borderRadius:'999px', padding:'2px 8px' }}>
                {openAlerts.length}
              </span>
            )}
          </div>

          {/* Search */}
          <div style={{ padding:'7px 12px', borderBottom:'1px solid rgba(255,83,95,0.08)', flexShrink:0, position:'relative' }}>
            <Search size={11} style={{ position:'absolute', left:'22px', top:'50%', transform:'translateY(-50%)', color:'rgba(255,100,100,0.35)', pointerEvents:'none' }} />
            <input
              type="text"
              placeholder="Search alerts…"
              value={alertSearch}
              onChange={(e) => setAlertSearch(e.target.value)}
              style={{
                width:'100%', background:'rgba(255,83,95,0.05)', border:'1px solid rgba(255,83,95,0.12)',
                borderRadius:'7px', color:'rgba(235,242,255,0.88)', fontSize:'11.5px',
                padding:'5px 24px 5px 26px', outline:'none', boxSizing:'border-box',
              }}
            />
            {alertSearch && (
              <button type="button" onClick={() => setAlertSearch('')}
                style={{ position:'absolute', right:'18px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'rgba(255,100,100,0.45)', cursor:'pointer', padding:0, display:'flex', alignItems:'center' }}>
                <X size={11} />
              </button>
            )}
          </div>

          {/* Scrollable alert list — maxHeight fills the card */}
          <div style={{ flex:1, overflowY:'auto', minHeight:0, scrollbarWidth:'thin', scrollbarColor:'rgba(255,83,95,0.2) transparent' }}>
            {filteredAlerts.length === 0 ? (
              <div style={{ padding:'18px 14px', textAlign:'center', color:'rgba(148,163,184,0.4)', fontSize:'12px', fontWeight:600 }}>
                {alertSearch ? `No alerts for "${alertSearch}"` : 'No active alerts'}
              </div>
            ) : (
              filteredAlerts.map((alert) => (
                <div key={alert.id} className="fleet-alert-item"
                  onClick={() => resolveAlert(alert.id)} title="Click to resolve">
                  <p className="fleet-alert-unit">{alert.vehicleUnit || 'UNIT'}</p>
                  <p className="fleet-alert-msg">{alert.message || 'Alert'}</p>
                  <span className={`fleet-alert-badge fleet-alert-badge--${alert.severity === 'critical' ? 'critical' : 'warn'}`}>
                    {alert.severity || 'warning'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ══ GPS LIVE TRACKING MAP ══ */}
      <div className="fleet-section-card" style={{ marginBottom:'16px', overflow:'hidden' }}>
        {/* Map header */}
        <div style={{ 
          display:'flex', 
          alignItems: isMobile ? 'flex-start' : 'flex-start', 
          justifyContent:'space-between', 
          padding:'14px 20px 12px', 
          borderBottom:'1px solid rgba(255,255,255,0.06)',
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? '12px' : '0'
        }}>
          <div style={{ width: isMobile ? '100%' : 'auto' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'3px' }}>
              <span style={{ width:'8px', height:'8px', borderRadius:'50%', background:'#3a82ff', flexShrink:0 }} />
              <span style={{ fontSize:'13.5px', fontWeight:700, color:'rgba(235,242,255,0.95)' }}>GPS Live Tracking</span>
            </div>
            <p style={{ margin:0, fontSize:'11.5px', color:'rgba(148,163,184,0.6)' }}>
              Real-time coordinates for all active units across{' '}
              {vehicles.filter((v) => v.site).length > 0
                ? [...new Set(vehicles.map((v) => v.site).filter(Boolean))].slice(0, 2).join(', ')
                : 'all sites'}
            </p>
          </div>
          <div style={{ 
            display:'flex', 
            gap:'10px', 
            alignItems: isMobile ? 'flex-start' : 'center',
            flexWrap: isMobile ? 'wrap' : 'nowrap',
            width: isMobile ? '100%' : 'auto'
          }}>
            <button
              type="button"
              onClick={() => setMapExpanded((v) => !v)}
              style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'11.5px', fontWeight:700, color:'#5ba8ff', background:'none', border:'none', cursor:'pointer', letterSpacing:'0.04em' }}
            >
              {mapExpanded ? 'COLLAPSE MAP' : 'EXPAND MAP'}
            </button>
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              style={{
                display:'flex', alignItems:'center', gap:'5px', fontSize:'11.5px', fontWeight:700,
                padding:'5px 12px', borderRadius:'7px', cursor:'pointer', letterSpacing:'0.04em',
                border: showFilters ? '1px solid rgba(58,130,255,0.35)' : '1px solid rgba(255,255,255,0.1)',
                background: showFilters ? 'rgba(58,130,255,0.14)' : 'rgba(255,255,255,0.04)',
                color: showFilters ? '#8ab8ff' : 'rgba(148,163,184,0.8)',
              }}
            >
              <SlidersHorizontal size={12} /> FILTERS
            </button>
          </div>
        </div>

        {/* Filter bar */}
        {showFilters && (
          <div style={{ display:'flex', gap:'8px', padding:'10px 20px', borderBottom:'1px solid rgba(255,255,255,0.05)', flexWrap:'wrap' }}>
            {['All', 'active', 'maintenance', 'offline'].map((f) => (
              <button key={f} type="button"
                onClick={() => { setStatusFilter(f); setPage(1) }}
                style={{
                  padding:'5px 14px', borderRadius:'7px', fontSize:'12px', fontWeight:700, cursor:'pointer',
                  border: statusFilter === f ? '1px solid rgba(58,130,255,0.35)' : '1px solid rgba(255,255,255,0.08)',
                  background: statusFilter === f ? 'rgba(58,130,255,0.18)' : 'rgba(255,255,255,0.03)',
                  color: statusFilter === f ? '#8ab8ff' : 'rgba(148,163,184,0.75)',
                }}>
                {f === 'All' ? 'All Units' : cap(f)}
              </button>
            ))}
          </div>
        )}

        {/* Map label overlay */}
        <div style={{ position:'relative' }}>
          {vehicles.filter((v) => v.site).length > 0 && (
            <div style={{
              position:'absolute', top:'14px', left:'16px', zIndex:10,
              background:'rgba(10,14,28,0.82)', border:'1px solid rgba(255,255,255,0.08)',
              borderRadius:'8px', padding:'6px 12px', backdropFilter:'blur(8px)',
            }}>
              <p style={{ margin:'0 0 1px', fontSize:'9px', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'rgba(148,163,184,0.55)' }}>MAP VIEW</p>
              <p style={{ margin:0, fontSize:'12.5px', fontWeight:800, color:'rgba(235,242,255,0.92)' }}>
                {[...new Set(vehicles.map((v) => v.site).filter(Boolean))][0] || 'Site Overview'}
              </p>
            </div>
          )}
          <FleetMap
            vehicles={statusFilter === 'All' ? vehicles : vehicles.filter((v) => (v.status || '').toLowerCase() === statusFilter)}
            openAlerts={openAlerts}
            onVehicleClick={setSelectedVehicle}
            height={mapExpanded ? '560px' : '360px'}
            style={{ transition:'height 350ms ease' }}
          />
        </div>
      </div>

      {/* ══ VEHICLES ALLOCATED TO SITE TABLE ══ */}
      <div className="fleet-section-card">
        {/* Table header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 20px 12px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
          <h2 style={{ margin:0, fontSize:'11px', fontWeight:800, letterSpacing:'0.1em', textTransform:'uppercase', color:'rgba(148,163,184,0.7)' }}>
            Vehicles Allocated to Site
          </h2>
          <button
            type="button"
            className="fleet-btn fleet-btn--primary "
            onClick={() => navigate('/fleet/dashboard')}
            style={{ fontSize:'12px', padding:'7px 16px', whiteSpace: isMobile ? 'nowrap' : 'normal' }}
          >
            <RefreshCw size={12} /> ASSIGN UNIT
          </button>
        </div>

        {/* Column headers + rows — all inside scroll wrapper */}
        {allocated.length === 0 ? (
          <div className="fleet-empty">
            <div className="fleet-empty-icon"><Truck size={32} style={{ color: 'rgba(148,163,184,0.45)', marginBottom: '8px' }} /></div>
            <p className="fleet-empty-title">No vehicles allocated to a site</p>
            <p className="fleet-empty-sub">Assign vehicles to sites using the Assign Unit button.</p>
          </div>
        ) : (
          <div className="fleet-site-alloc-wrap">
            {/* Column headers */}
            <div className="fleet-site-alloc-row" style={{
              padding:'10px 20px 8px', gap:'12px',
              borderBottom:'1px solid rgba(255,255,255,0.05)',
            }}>
              {['Asset Identifier', 'Type', 'Inspection Status', 'Defects', 'Service Health'].map((h) => (
                <span key={h} style={{ fontSize:'9.5px', fontWeight:800, letterSpacing:'0.09em', textTransform:'uppercase', color:'rgba(148,163,184,0.5)' }}>
                  {h}
                </span>
              ))}
            </div>

            {/* Data rows */}
            {paginated.map((v) => {
              const activeDefects = openAlerts.filter((a) => a.vehicleId === v.id)
              const lastIns = inspections
                .filter((i) => i.vehicleId === v.id)
                .sort((a, b) => (b.inspectedAt?.toMillis?.() ?? 0) - (a.inspectedAt?.toMillis?.() ?? 0))[0]
              const insStatus = lastIns?.outcome ?? null
              const svc = serviceHealth(v)

              return (
                <div
                  key={v.id}
                  onClick={() => setSelectedVehicle(v)}
                  className="fleet-site-alloc-row"
                  style={{
                    padding:'14px 20px', gap:'12px', alignItems:'center',
                    borderBottom:'1px solid rgba(255,255,255,0.04)', cursor:'pointer',
                    transition:'background 130ms',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  {/* Asset Identifier */}
                  <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                    <div style={{
                      width:'34px', height:'34px', borderRadius:'9px', flexShrink:0,
                      background:'rgba(58,130,255,0.1)', border:'1px solid rgba(58,130,255,0.2)',
                      display:'flex', alignItems:'center', justifyContent:'center', color:'#5ba8ff',
                    }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 5v3h-7V8z"/>
                        <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
                      </svg>
                    </div>
                    <div>
                      <p style={{ margin:'0 0 2px', fontSize:'13.5px', fontWeight:800, color:'rgba(235,242,255,0.97)' }}>
                        Unit {v.unitId || v.id}
                      </p>
                      <p style={{ margin:0, fontSize:'10.5px', color:'rgba(148,163,184,0.5)' }}>
                        VIN: {v.id?.slice(0, 8).toUpperCase() ?? '—'}
                      </p>
                    </div>
                  </div>

                  {/* Type */}
                  <span style={{ fontSize:'13px', color:'rgba(203,214,255,0.85)', fontWeight:500 }}>
                    {v.vehicleType || '—'}
                  </span>

                  {/* Inspection Status */}
                  <div>
                    {insStatus ? (
                      <span style={{
                        fontSize:'10px', fontWeight:800, padding:'3px 10px', borderRadius:'5px', letterSpacing:'0.06em',
                        background: insStatus === 'pass' ? 'rgba(22,201,136,0.12)' : insStatus === 'fail' ? 'rgba(255,83,95,0.12)' : 'rgba(254,142,42,0.12)',
                        color:       insStatus === 'pass' ? '#4deba0'              : insStatus === 'fail' ? '#ff8080'              : '#ffb56e',
                        border:      insStatus === 'pass' ? '1px solid rgba(22,201,136,0.28)' : insStatus === 'fail' ? '1px solid rgba(255,83,95,0.28)' : '1px solid rgba(254,142,42,0.28)',
                      }}>
                        ● {insStatus === 'pass' ? 'COMPLETED' : insStatus === 'fail' ? 'FAILED' : 'PENDING'}
                      </span>
                    ) : (
                      <span style={{ fontSize:'11px', color:'rgba(148,163,184,0.4)', fontStyle:'italic' }}>No record</span>
                    )}
                  </div>

                  {/* Defects */}
                  <div>
                    {activeDefects.length > 0 ? (
                      <span style={{ fontSize:'11px', fontWeight:800, color:'#ff8080', background:'rgba(255,83,95,0.1)', border:'1px solid rgba(255,83,95,0.25)', borderRadius:'5px', padding:'2px 8px' }}>
                        ACTIVE ({activeDefects.length})
                      </span>
                    ) : (
                      <span style={{ fontSize:'11.5px', color:'rgba(148,163,184,0.5)', fontWeight:600 }}>NONE</span>
                    )}
                  </div>

                  {/* Service Health */}
                  <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                    <span style={{ fontSize:'9.5px', fontWeight:800, letterSpacing:'0.07em', color: svc.color }}>{svc.label}</span>
                    <div style={{ height:'4px', borderRadius:'999px', background:'rgba(255,255,255,0.06)', overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${svc.pct}%`, borderRadius:'999px', background: svc.color, transition:'width 500ms ease' }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Pagination */}
        {allocated.length > 0 && (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 20px', borderTop:'1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ fontSize:'11.5px', color:'rgba(148,163,184,0.5)' }}>
              Showing {paginated.length} of {allocated.length} active units
            </span>
            <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                style={{ background:'none', border:'none', fontSize:'12.5px', fontWeight:700, color: safePage <= 1 ? 'rgba(148,163,184,0.25)' : 'rgba(148,163,184,0.7)', cursor: safePage <= 1 ? 'not-allowed' : 'pointer', padding:'4px 8px' }}
              >
                Previous
              </button>
              <span style={{ fontSize:'11px', color:'rgba(148,163,184,0.4)' }}>{safePage} / {totalPages}</span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                style={{ background:'none', border:'none', fontSize:'12.5px', fontWeight:700, color: safePage >= totalPages ? 'rgba(148,163,184,0.25)' : 'rgba(148,163,184,0.7)', cursor: safePage >= totalPages ? 'not-allowed' : 'pointer', padding:'4px 8px' }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
