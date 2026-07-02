import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Download, Plus, TrendingUp, RefreshCw, Search, X, Filter, CheckCircle, RotateCw, Truck } from 'lucide-react'
import { useFleetData } from '../hooks/useFleetData.js'
import { ReadinessDonut } from '../components/ReadinessDonut.jsx'
import { VehicleDetails } from '../components/VehicleDetails.jsx'
import { FleetMap } from '../components/FleetMap.jsx'
import { AssignUnitPage } from './AssignUnitPage.jsx'
import { RegisterVehiclePage } from './RegisterVehiclePage.jsx'
import { healthClass, cap, exportToCSV, formatDate } from '../utils/fleetHelpers.js'
import '../fleet.css'

const STATUS_FILTERS = ['All', 'active', 'maintenance', 'offline']

// Heights of fixed elements (px) — used to compute scroll container maxHeight
const TOPBAR_H      = 56   // .topbar
const SHELL_PAD     = 28   // .content-shell padding top+bottom approx
const DASH_PAD_TOP  = 22   // .fleet-dash padding-top
const HEADER_H      = 58   // page header row + margin
const TOP_ROW_H     = 160  // 3-col stat row height + margin
const MAIN_GAP      = 16   // gap between top-row and main-grid
const BOTTOM_PAD    = 18   // padding-bottom inside main-grid

// Available height for the main grid row
const MAIN_H = `calc(100vh - ${TOPBAR_H}px - ${SHELL_PAD}px - ${DASH_PAD_TOP}px - ${HEADER_H}px - ${TOP_ROW_H}px - ${MAIN_GAP}px - ${BOTTOM_PAD}px)`

// Available scroll height inside fleet list card (card header ~44px + search ~42px + count ~24px + footer ~54px)
const LIST_SCROLL_H = `calc(${MAIN_H} - 44px - 42px - 24px - 54px)`

export function FleetDashboardPage() {
  const navigate = useNavigate()
  const {
    vehicles, openAlerts,
    loading, activeVehicles, totalVehicles,
    crewReady, avgHealth, resolveAlert,
    addVehicle, updateVehicle,
  } = useFleetData()

  const [selectedVehicle, setSelectedVehicle] = useState(null)
  const [showAssign, setShowAssign]           = useState(false)
  const [showAdd, setShowAdd]                 = useState(false)
  const [editVehicle, setEditVehicle]         = useState(null)
  const [saving, setSaving]                   = useState(false)
  const [statusResetVehicleId, setStatusResetVehicleId] = useState(null)
  const [listSearch, setListSearch]           = useState('')
  const [statusFilter, setStatusFilter]       = useState('All')
  const [showFilterMenu, setShowFilterMenu]   = useState(false)
  const [alertSearch, setAlertSearch]         = useState('')

  const totalCrew = vehicles.filter((v) => v.site).length

  // ── Lock the parent .page-content scroll so fleet-dash fills it exactly ──
  useEffect(() => {
    // Walk up to find the scrolling parent (.page-content)
    const pageContent = document.querySelector('.client-page-content')
    if (!pageContent) return
    const prev = pageContent.style.overflow
    pageContent.style.overflow = 'hidden'
    pageContent.style.display  = 'flex'
    pageContent.style.flexDirection = 'column'
    return () => {
      pageContent.style.overflow = prev
      pageContent.style.display  = ''
      pageContent.style.flexDirection = ''
    }
  }, [])

  const filteredVehicles = useMemo(() => {
    let list = vehicles
    if (statusFilter !== 'All') list = list.filter((v) => (v.status || '').toLowerCase() === statusFilter)
    if (listSearch.trim()) {
      const q = listSearch.trim().toLowerCase()
      list = list.filter((v) =>
        (v.unitId      || '').toLowerCase().includes(q) ||
        (v.vehicleType || '').toLowerCase().includes(q) ||
        (v.driverName  || '').toLowerCase().includes(q) ||
        (v.site        || '').toLowerCase().includes(q) ||
        (v.category    || '').toLowerCase().includes(q) ||
        (v.department  || '').toLowerCase().includes(q)
      )
    }
    return list
  }, [vehicles, listSearch, statusFilter])

  const filteredAlerts = useMemo(() => {
    if (!alertSearch.trim()) return openAlerts
    const q = alertSearch.trim().toLowerCase()
    return openAlerts.filter((a) =>
      (a.vehicleUnit || '').toLowerCase().includes(q) ||
      (a.message     || '').toLowerCase().includes(q) ||
      (a.severity    || '').toLowerCase().includes(q)
    )
  }, [openAlerts, alertSearch])

  function handleExport() {
    exportToCSV(vehicles.map((v) => ({
      'Unit ID': v.unitId || v.id, 'Type': v.vehicleType || '—',
      'Category': v.category || '—', 'Status': v.status || '—',
      'Health (%)': v.healthScore ?? '—', 'Driver': v.driverName || '—',
      'Site': v.site || '—', 'Fuel Level (%)': v.fuelLevel ?? '—',
      'Mileage (km)': v.mileageKm ?? '—', 'Last Service': formatDate(v.lastService),
    })), 'fleet-vehicles.csv')
  }

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

  if (showAdd) {
    return (
      <div className="fleet-dash" style={{ overflowY:'auto' }}>
        <RegisterVehiclePage 
          onSave={handleAdd} 
          onCancel={() => { setShowAdd(false); setEditVehicle(null); }} 
          loading={saving} 
          editVehicle={editVehicle}
        />
      </div>
    )
  }

  if (showAssign) return (
    <div className="fleet-dash" style={{ overflowY:'auto' }}>
      <AssignUnitPage
        onBack={() => setShowAssign(false)}
        onConfirmed={() => {
          setShowAssign(false)
          navigate('/fleet/site-map')
        }}
      />
    </div>
  )

  if (selectedVehicle) {
    return (
      <VehicleDetails
        vehicle={selectedVehicle}
        alerts={openAlerts}
        onBack={() => { setSelectedVehicle(null); setStatusResetVehicleId(null); }}
        viewOnly={true}
        backText="Back to Dashboard"
        onEdit={handleEditVehicle}
        statusReset={statusResetVehicleId === selectedVehicle.id}
      />
    )
  }

  if (loading) return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'70vh', gap:'12px', color:'rgba(148,163,184,0.8)' }}>
      <span className="fleet-spinner fleet-spinner--lg" />
      <span style={{ fontSize:'14px', fontWeight:600 }}>Loading Fleet Dashboard…</span>
    </div>
  )

  return (
    <div className="fleet-dash">

      {/* ── Page header ── */}
      <header style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'12px', flexWrap:'wrap', marginBottom:'14px', flexShrink:0 }}>
        <div>
          <h1 className="fleet-dash-title">Fleet Dashboard</h1>
          <p className="fleet-dash-sub">Real-time site fleet monitoring &amp; operations control.</p>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════════════
          TOP ROW — 3 columns:
          [1] Readiness donut
          [2] Active Fleet + Crew Ready stacked in ONE card
          [3] Critical Alerts — full height, scrollable
          ══════════════════════════════════════════════════════════════ */}
      <div className="fleet-dash-top-row">

        {/* ── Col 1: Site Readiness Score ── */}
        <div className="fleet-section-card" style={{
          display:'flex', flexDirection:'column', alignItems:'center',
          justifyContent:'center', padding:'18px 12px', textAlign:'center',
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
        <div className="fleet-section-card fleet-alerts-card" style={{ display:'flex', flexDirection:'column', overflow:'hidden' }}>

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

      <div className="fleet-dash-main-grid">

        {/* GPS Live Tracking */}
        <div className="fleet-section-card fleet-map-section" style={{ display:'flex', flexDirection:'column', minHeight:0 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 18px', borderBottom:'1px solid rgba(255,255,255,0.06)', flexShrink:0 }}>
            <h2 style={{ margin:0, fontSize:'14px', fontWeight:700, color:'rgba(235,242,255,0.95)' }}>GPS Live Tracking</h2>
            <span style={{ fontSize:'11px', color:'rgba(148,163,184,0.5)', fontWeight:600 }}>
              {vehicles.filter((v) => v.lat != null && v.lng != null).length} unit(s) with GPS
            </span>
          </div>
          <div style={{ flex:1, minHeight:'280px' }}>
            <FleetMap vehicles={vehicles} openAlerts={openAlerts} onVehicleClick={setSelectedVehicle} height="100%" />
          </div>
        </div>

        {/* Site Fleet list */}
        <div className="fleet-section-card" style={{ display:'flex', flexDirection:'column', minHeight:0, overflow:'hidden' }}>

          {/* Header */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 14px', borderBottom:'1px solid rgba(255,255,255,0.06)', flexShrink:0 }}>
            <h2 style={{ margin:0, fontSize:'14px', fontWeight:700, color:'rgba(235,242,255,0.95)' }}>Site Fleet</h2>
            <div style={{ display:'flex', gap:'6px' }}>
              <button type="button" className="fleet-icon-btn" onClick={handleExport} title="Export CSV"><Download size={13} /></button>
              <button type="button" className="fleet-icon-btn" onClick={() => setShowAssign(true)} title="Add vehicle"><Plus size={13} /></button>
            </div>
          </div>

          {/* Search + filter */}
          <div style={{ padding:'8px 12px', borderBottom:'1px solid rgba(255,255,255,0.05)', flexShrink:0, display:'flex', gap:'6px', alignItems:'center' }}>
            <div style={{ position:'relative', flex:1 }}>
              <Search size={12} style={{ position:'absolute', left:'9px', top:'50%', transform:'translateY(-50%)', color:'rgba(148,163,184,0.4)', pointerEvents:'none' }} />
              <input
                type="text"
                placeholder="Search vehicles…"
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
                style={{
                  width:'100%', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)',
                  borderRadius:'8px', color:'rgba(235,242,255,0.9)', fontSize:'12px',
                  padding:'6px 22px 6px 26px', outline:'none', boxSizing:'border-box',
                }}
              />
              {listSearch && (
                <button type="button" onClick={() => setListSearch('')}
                  style={{ position:'absolute', right:'7px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'rgba(148,163,184,0.5)', cursor:'pointer', padding:0, display:'flex', alignItems:'center' }}>
                  <X size={11} />
                </button>
              )}
            </div>
            {/* Filter pill */}
            <div style={{ position:'relative' }}>
              <button type="button" onClick={() => setShowFilterMenu((v) => !v)}
                style={{
                  display:'flex', alignItems:'center', gap:'5px', padding:'5px 9px',
                  borderRadius:'8px', fontSize:'11.5px', fontWeight:700, whiteSpace:'nowrap', cursor:'pointer',
                  border: statusFilter !== 'All' ? '1px solid rgba(58,130,255,0.35)' : '1px solid rgba(255,255,255,0.08)',
                  background: statusFilter !== 'All' ? 'rgba(58,130,255,0.14)' : 'rgba(255,255,255,0.04)',
                  color: statusFilter !== 'All' ? '#8ab8ff' : 'rgba(148,163,184,0.8)',
                }}>
                <Filter size={11} />
                {statusFilter === 'All' ? 'All' : cap(statusFilter)}
              </button>
              {showFilterMenu && (
                <div style={{ position:'absolute', top:'calc(100% + 5px)', right:0, zIndex:50, background:'#0b0f1f', border:'1px solid rgba(58,130,255,0.15)', borderRadius:'10px', padding:'5px', minWidth:'130px', boxShadow:'0 12px 32px rgba(0,0,0,0.65)' }}>
                  {STATUS_FILTERS.map((f) => (
                    <button key={f} type="button" onClick={() => { setStatusFilter(f); setShowFilterMenu(false) }}
                      style={{ display:'block', width:'100%', padding:'8px 12px', borderRadius:'7px', border:'none', textAlign:'left', cursor:'pointer', fontSize:'12px', fontWeight: statusFilter === f ? 700 : 500, background: statusFilter === f ? 'rgba(58,130,255,0.18)' : 'transparent', color: statusFilter === f ? '#8ab8ff' : 'rgba(203,214,255,0.85)' }}>
                      {f === 'All' ? 'All Statuses' : cap(f)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Count */}
          <div style={{ padding:'4px 14px 2px', flexShrink:0 }}>
            <span style={{ fontSize:'10.5px', color:'rgba(148,163,184,0.4)', fontWeight:600 }}>
              {filteredVehicles.length} of {vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* ── Vehicle scroll list — explicit overflow:auto with flex:1 + minHeight:0 ── */}
          <div style={{ flex:1, minHeight:0, overflowY:'auto', scrollbarWidth:'thin', scrollbarColor:'rgba(58,130,255,0.2) transparent' }}>
            {vehicles.length === 0 ? (
              <div className="fleet-empty">
                <div className="fleet-empty-icon"><Truck size={32} style={{ color: 'rgba(148,163,184,0.45)', marginBottom: '8px' }} /></div>
                <p className="fleet-empty-title">No vehicles registered</p>
                <p className="fleet-empty-sub">Register your first vehicle to begin tracking.</p>
              </div>
            ) : filteredVehicles.length === 0 ? (
              <div style={{ padding:'24px 14px', textAlign:'center', color:'rgba(148,163,184,0.45)', fontSize:'12.5px' }}>
                No vehicles match your filters.
              </div>
            ) : (
              filteredVehicles.map((v) => {
                const health        = v.healthScore ?? 100
                const hClass        = healthClass(health)
                const activeDefects = openAlerts.filter((a) => a.vehicleId === v.id).length
                return (
                  <div key={v.id}
                    className={`fleet-vehicle-item${selectedVehicle?.id === v.id ? ' fleet-vehicle-item--selected' : ''}`}
                    onClick={() => setSelectedVehicle(v)}>
                    <div className="fleet-vehicle-top-row">
                      <div>
                        <p className="fleet-vehicle-name">{v.unitId || v.id}</p>
                        <p className="fleet-vehicle-type">{v.vehicleType || '—'} | {v.category || '—'}</p>
                      </div>
                      <span className={`fleet-defect-badge fleet-defect-badge--${activeDefects > 0 ? 'active' : 'none'}`}>
                        {activeDefects > 0 ? `${activeDefects} Active Defect` : 'None'}
                      </span>
                    </div>
                    <div className="fleet-vehicle-meta-row">
                      <div>
                        <p className="fleet-vehicle-meta-label">Status</p>
                        <p className={`fleet-vehicle-status fleet-vehicle-status--${(v.status || 'active').toLowerCase()}`}>
                          {cap(v.status || 'Active')}
                        </p>
                      </div>
                      <div>
                        <p className="fleet-vehicle-meta-label">Health</p>
                        <div className="fleet-health-track">
                          <div className={`fleet-health-fill fleet-health-fill--${hClass}`} style={{ width:`${health}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer — pinned */}
          <div className="fleet-list-footer" style={{ flexShrink:0 }}>
            <button type="button" className="fleet-btn-export" onClick={handleExport}>
              <Download size={13} /> Export CSV
            </button>
            <button type="button" className="fleet-btn-assign" onClick={() => setShowAssign(true)}>
              <RefreshCw size={13} /> Assign Unit
            </button>
          </div>
        </div>
      </div>

    </div>
  )
}
