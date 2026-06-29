import { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { serverTimestamp } from 'firebase/firestore'
import {
  Search, Activity, AlertTriangle, CheckCircle,
  Info, ArrowLeft, ChevronDown, Check, X,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion' // eslint-disable-line no-unused-vars
import { useFleetData } from '../hooks/useFleetData.js'
import { healthClass, formatDate, cap } from '../utils/fleetHelpers.js'
import '../fleet.css'

const DURATION_OPTIONS = ['Temporary', 'Permanent']

const PRESET_DEPARTMENTS = [
  'Rapid Response', 'Logistics', 'Maintenance',
  'Operations', 'Security', 'Engineering', 'Transport',
]

/* ─────────────────────────────────────────────────────────────────
   Animated Custom Dropdown
───────────────────────────────────────────────────────────────── */
function FleetDropdown({ label, value, onChange, options = [], placeholder = 'Select…', allowCustom = false }) {
  const [open, setOpen] = useState(false)
  const [customMode, setCustomMode] = useState(false)
  const [customVal, setCustomVal]   = useState('')
  const ref = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (customMode && inputRef.current) inputRef.current.focus()
  }, [customMode])

  const selected = options.find((o) => (typeof o === 'string' ? o : o.value) === value)
  const displayLabel = selected
    ? (typeof selected === 'string' ? selected : selected.label)
    : (value || '')

  function handleSelect(opt) {
    const v = typeof opt === 'string' ? opt : opt.value
    if (v === '__custom__') {
      setCustomMode(true)
      setOpen(false)
      return
    }
    onChange(v)
    setOpen(false)
    setCustomMode(false)
  }

  function commitCustom() {
    if (customVal.trim()) {
      onChange(customVal.trim())
      setCustomMode(false)
      setCustomVal('')
    }
  }

  if (customMode) {
    return (
      <div>
        {label && <p className="fleet-config-label">{label}</p>}
        <div style={{ display:'flex', gap:'6px' }}>
          <input
            ref={inputRef}
            type="text"
            className="fleet-config-select"
            style={{ paddingRight:'14px', flex:1 }}
            placeholder="Type custom value…"
            value={customVal}
            onChange={(e) => setCustomVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') commitCustom(); if (e.key === 'Escape') { setCustomMode(false); setCustomVal('') } }}
          />
          <button type="button" onClick={commitCustom}
            style={{ padding:'0 12px', background:'rgba(58,130,255,0.18)', border:'1px solid rgba(58,130,255,0.35)', borderRadius:'9px', color:'#8ab8ff', cursor:'pointer', fontSize:'12px', fontWeight:700, whiteSpace:'nowrap' }}>
            Set
          </button>
          <button type="button" onClick={() => { setCustomMode(false); setCustomVal('') }}
            style={{ padding:'0 10px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'9px', color:'rgba(148,163,184,0.7)', cursor:'pointer' }}>
            <X size={13} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div ref={ref} style={{ position:'relative' }}>
      {label && <p className="fleet-config-label">{label}</p>}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'11px 14px', background:'rgba(12,18,36,0.7)',
          border:`1px solid ${open ? 'rgba(58,130,255,0.5)' : 'rgba(255,255,255,0.1)'}`,
          borderRadius:'10px', color: value ? 'rgba(235,242,255,0.92)' : 'rgba(148,163,184,0.45)',
          fontSize:'13.5px', fontWeight:600, cursor:'pointer',
          boxShadow: open ? '0 0 0 3px rgba(58,130,255,0.12)' : 'none',
          transition:'border-color 150ms, box-shadow 150ms',
        }}
      >
        <span>{displayLabel || placeholder}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={15} style={{ color: open ? '#8ab8ff' : 'rgba(148,163,184,0.5)' }} />
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity:0, y:-6, scale:0.97 }}
            animate={{ opacity:1, y:0, scale:1 }}
            exit={{ opacity:0, y:-4, scale:0.97 }}
            transition={{ duration:0.15, ease:'easeOut' }}
            style={{
              position:'absolute', top:'calc(100% + 6px)', left:0, right:0, zIndex:200,
              background:'#0b0f1f', border:'1px solid rgba(58,130,255,0.18)',
              borderRadius:'12px', padding:'5px',
              boxShadow:'0 16px 40px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.04)',
              backdropFilter:'blur(12px)',
              maxHeight:'260px', overflowY:'auto',
              scrollbarWidth:'thin', scrollbarColor:'rgba(58,130,255,0.15) transparent',
            }}
          >
            {options.map((opt) => {
              const v = typeof opt === 'string' ? opt : opt.value
              const l = typeof opt === 'string' ? opt : opt.label
              const isSelected = v === value
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => handleSelect(opt)}
                  style={{
                    display:'flex', alignItems:'center', justifyContent:'space-between',
                    width:'100%', padding:'9px 12px', borderRadius:'8px', border:'none',
                    background: isSelected ? 'rgba(58,130,255,0.18)' : 'transparent',
                    color: isSelected ? '#8ab8ff' : 'rgba(203,214,255,0.9)',
                    fontSize:'13px', fontWeight: isSelected ? 700 : 500,
                    cursor:'pointer', textAlign:'left',
                    transition:'background 120ms',
                  }}
                  onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'rgba(58,130,255,0.08)' }}
                  onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                >
                  <span>{l}</span>
                  {isSelected && <Check size={13} style={{ color:'#3a82ff', flexShrink:0 }} />}
                </button>
              )
            })}
            {allowCustom && (
              <button
                type="button"
                onClick={() => handleSelect({ value:'__custom__', label:'' })}
                style={{
                  display:'block', width:'100%', padding:'9px 12px', borderRadius:'8px', border:'none',
                  background:'transparent', color:'rgba(148,163,184,0.65)',
                  fontSize:'12.5px', fontWeight:600, cursor:'pointer', textAlign:'left',
                  borderTop:'1px solid rgba(255,255,255,0.05)', marginTop:'3px', paddingTop:'10px',
                  transition:'background 120ms',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                + Enter custom value…
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────
   Main AssignUnitPage
───────────────────────────────────────────────────────────────── */
export function AssignUnitPage({ onBack, onConfirmed }) {
  const navigate = useNavigate()
  const { vehicles, inspections, openAlerts, loading, updateVehicle } = useFleetData()

  const [search, setSearch]       = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [targetSite, setTargetSite] = useState('')
  const [department, setDepartment] = useState('')
  const [duration, setDuration]     = useState('Temporary')
  const [saving, setSaving]         = useState(false)
  const [saved, setSaved]           = useState(false)
  const [page, setPage]             = useState(1)
  const pageSize = 8

  // Unique sites derived from Firestore vehicles
  const siteOptions = useMemo(() =>
    Array.from(new Set(vehicles.map((v) => v.site).filter(Boolean))).sort(),
  [vehicles])

  // Unique departments derived from Firestore vehicles + presets (deduped)
  const deptOptions = useMemo(() => {
    const fromDB = vehicles.map((v) => v.department).filter(Boolean)
    return Array.from(new Set([...fromDB, ...PRESET_DEPARTMENTS])).sort()
  }, [vehicles])

  // Filter vehicles: only show inactive, approved, and ready for assignment
  const eligibleVehicles = useMemo(() => {
    const filtered = vehicles.filter((v) => {
      const status = v.status?.toLowerCase()
      const compliance = v.complianceStatus?.toLowerCase()
      // Check readyForAssign - if undefined or false (old vehicles), check if they have an inspection
      const isReady = v.readyForAssign === true || 
                      (v.readyForAssign === undefined && v.lastInspection) ||
                      (v.readyForAssign === false && v.lastInspection) // Temporary backward compatibility
      const isEligible = status === 'inactive' && compliance === 'approved' && isReady
      
      return isEligible
    })
    console.log('Total vehicles:', vehicles.length, 'Eligible vehicles:', filtered.length)
    return filtered
  }, [vehicles])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return eligibleVehicles
    return eligibleVehicles.filter((v) =>
      (v.unitId      || '').toLowerCase().includes(q) ||
      (v.vehicleType || '').toLowerCase().includes(q) ||
      (v.driverName  || '').toLowerCase().includes(q) ||
      (v.site        || '').toLowerCase().includes(q) ||
      (v.category    || '').toLowerCase().includes(q),
    )
  }, [eligibleVehicles, search])

  // Pagination
  const totalPages = Math.ceil(filtered.length / pageSize)
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)
  
  // Reset page when search changes
  useEffect(() => {
    setPage(1)
  }, [search])

  // Auto-select single result — wrapped in timeout to avoid setState-in-effect rule
  useEffect(() => {
    if (filtered.length === 1 && filtered[0].id !== selectedId) {
      const t = setTimeout(() => setSelectedId(filtered[0].id), 0)
      return () => clearTimeout(t)
    }
  }, [filtered, selectedId])

  const selected = eligibleVehicles.find((v) => v.id === selectedId) ?? null

  const secondaryCards = search.trim()
    ? paginated.filter((v) => v.id !== selectedId).slice(0, 4)
    : paginated.filter((v) => v.id !== selectedId).slice(0, 4)

  const telemetry = selected ? {
    fuelEfficiency: selected.fuelEfficiency ?? '—',
    engineLoad:     selected.engineLoad != null ? `${selected.engineLoad}%` : '—',
    tirePressure:   selected.tirePressure ?? 'Nominal',
    uptime:         selected.uptime != null ? `${selected.uptime}%` : '—',
  } : null

  const lastInspection = useMemo(() => {
    if (!selected) return null
    return inspections
      .filter((i) => i.vehicleId === selected.id)
      .sort((a, b) => (b.inspectedAt?.toMillis?.() ?? 0) - (a.inspectedAt?.toMillis?.() ?? 0))[0] ?? null
  }, [inspections, selected])

  const activeAlerts = openAlerts.filter((a) => a.vehicleId === selectedId)

  // Check if vehicle has at least one inspection
  const hasInspection = useMemo(() => {
    if (!selected) return false
    return inspections.some((i) => i.vehicleId === selected.id)
  }, [inspections, selected])

  // Check if vehicle needs inspection before assignment
  // Rules:
  // 1. If vehicle has no inspection records → needs inspection
  // 2. If vehicle is assigned to a site (deployed) AND last inspection was before lastAssignedAt → needs reinspection
  // 3. If vehicle is deployed but has no lastAssignedAt field (old data) → check if inspection is recent (within last 24 hours)
  // 4. Otherwise (not deployed, or deployed with recent inspection) → no inspection needed
  const needsInspection = useMemo(() => {
    if (!selected) return false
    
    // Rule 1: No inspection records at all
    if (!hasInspection) return true
    
    // Rule 2 & 3: Vehicle is deployed (has site)
    if (selected.site) {
      const vehicleInspections = inspections
        .filter((i) => i.vehicleId === selected.id)
        .sort((a, b) => (b.inspectedAt?.toMillis?.() ?? 0) - (a.inspectedAt?.toMillis?.() ?? 0))
      
      if (vehicleInspections.length === 0) return true
      
      const lastInspection = vehicleInspections[0]
      const lastInspectionTime = lastInspection.inspectedAt?.toMillis?.() ?? 0
      
      // Check if lastAssignedAt exists
      const lastAssignedTime = selected.lastAssignedAt?.toMillis?.()
      
      if (lastAssignedTime) {
        // Rule 2: Compare inspection time with assignment time
        return lastInspectionTime < lastAssignedTime
      } else {
        // Rule 3: No lastAssignedAt field (old data) - check if inspection is recent (within 24 hours)
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000)
        return lastInspectionTime < oneDayAgo
      }
    }
    
    // Rule 4: Not deployed and has inspection - no inspection needed
    return false
  }, [selected, hasInspection, inspections])

  function handleStartInspection() {
    if (!selected) return
    navigate('/fleet/inspections', { state: { vehicleId: selected.id } })
  }

  async function handleConfirm() {
    if (!selected || !targetSite) return
    
    // Require department
    if (!department) {
      alert('Department is required for vehicle assignment.')
      return
    }
    
    // Prevent assignment if vehicle is in maintenance
    if (selected.status === 'maintenance') {
      alert('Vehicle is currently under maintenance and cannot be assigned to a site. Please complete maintenance first.')
      return
    }
    
    // Require inspection if needed
    if (needsInspection) {
      alert('Vehicle must complete an inspection before being assigned to a site.')
      return
    }
    
    setSaving(true)
    try {
      await updateVehicle(selected.id, {
        site: targetSite, 
        department: department,
        deploymentType: duration, 
        status: 'active', // Set to active when assigned to site
        lastAssignedAt: serverTimestamp(), // Track when vehicle was assigned
        crewAssigned: true, // Mark vehicle as having crew assigned
      })
      setSaved(true)
      // Navigate to Site Map after short confirmation flash
      setTimeout(() => {
        if (onConfirmed) onConfirmed()
        else onBack()
      }, 1200)
    } catch (err) {
      console.error('Assignment failed:', err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'60vh', gap:'12px', color:'rgba(148,163,184,0.8)' }}>
      <span className="fleet-spinner fleet-spinner--lg" />
      <span style={{ fontSize:'14px', fontWeight:600 }}>Loading fleet data…</span>
    </div>
  )

  return (
    <motion.div
      className="fleet-assign-page"
      initial={{ opacity:0, y:10 }}
      animate={{ opacity:1, y:0 }}
      transition={{ duration:0.22, ease:'easeOut' }}
    >
      {/* ── Header ── */}
      <div className="fleet-assign-header">
        <div className="fleet-assign-header-left">
          <button type="button" className="fleet-assign-back-btn" onClick={onBack} aria-label="Back">
            <ArrowLeft size={15} />
          </button>
          <div>
            <h1 className="fleet-assign-title">Assign Unit to Site</h1>
            <p className="fleet-assign-sub">Deployment Protocol: Phase 2 — Unit Allocation</p>
          </div>
        </div>
        <div className="fleet-assign-search-wrap">
          <Search size={14} className="fleet-assign-search-icon" />
          <input
            type="text"
            className="fleet-assign-search"
            placeholder="Search registry by Vehicle ID, driver, site…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button type="button" onClick={() => setSearch('')}
              style={{ position:'absolute', right:'12px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'rgba(148,163,184,0.5)', cursor:'pointer', padding:0, display:'flex', alignItems:'center' }}>
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="fleet-assign-body">

        {/* LEFT — vehicle selection + telemetry */}
        <div className="fleet-assign-left">
          {filtered.length === 0 ? (
            <div className="fleet-section-card fleet-empty" style={{ padding:'40px 20px' }}>
              <div className="fleet-empty-icon">🔍</div>
              <p className="fleet-empty-title">No vehicles match &ldquo;{search}&rdquo;</p>
              <p className="fleet-empty-sub">Try unit ID, type, driver name or site.</p>
            </div>
          ) : (
            <>
              {/* Active selection */}
              <AnimatePresence mode="wait">
                {selected ? (
                  <motion.div key={selected.id}
                    initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
                    exit={{ opacity:0, y:-6 }} transition={{ duration:0.18 }}>
                    <ActiveSelectionCard vehicle={selected} lastInspection={lastInspection} activeAlerts={activeAlerts} />
                  </motion.div>
                ) : (
                  <motion.div key="prompt"
                    initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                    className="fleet-section-card"
                    style={{ padding:'28px 20px', textAlign:'center', color:'rgba(148,163,184,0.55)', fontSize:'13.5px' }}>
                    <p style={{ margin:0, fontWeight:600 }}>Select a vehicle below to begin assignment</p>
                    <p style={{ margin:'6px 0 0', fontSize:'12px', color:'rgba(148,163,184,0.4)' }}>
                      {eligibleVehicles.length} eligible vehicle{eligibleVehicles.length !== 1 ? 's' : ''} available
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Secondary cards */}
              {secondaryCards.length > 0 && (
                <div className="fleet-assign-secondary-row">
                  {secondaryCards.map((v) => (
                    <SecondaryVehicleCard
                      key={v.id}
                      vehicle={v}
                      isSelected={v.id === selectedId}
                      onSelect={() => setSelectedId(v.id === selectedId ? null : v.id)}
                      alerts={openAlerts.filter((a) => a.vehicleId === v.id)}
                    />
                  ))}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="fleet-assign-pagination">
                  <button
                    type="button"
                    className="fleet-assign-page-btn"
                    disabled={page === 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                  >
                    Previous
                  </button>
                  <span className="fleet-assign-page-info">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    type="button"
                    className="fleet-assign-page-btn"
                    disabled={page === totalPages}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </button>
                </div>
              )}

              {/* Telemetry */}
              <AnimatePresence>
                {selected && telemetry && (
                  <motion.div
                    initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }}
                    exit={{ opacity:0, height:0 }} transition={{ duration:0.2 }}
                    className="fleet-section-card fleet-telemetry-card">
                    <div className="fleet-telemetry-head">
                      <Activity size={13} style={{ color:'#3a82ff' }} />
                      <span className="fleet-telemetry-title">Fleet Telemetry Overview</span>
                    </div>
                    <div className="fleet-telemetry-grid">
                      <TelemetryCell label="Fuel Efficiency" value={telemetry.fuelEfficiency} />
                      <TelemetryCell label="Engine Load"     value={telemetry.engineLoad} />
                      <TelemetryCell label="Tire Pressure"   value={telemetry.tirePressure}
                        highlight={['nominal','Nominal'].includes(telemetry.tirePressure)} />
                      <TelemetryCell label="Uptime"          value={telemetry.uptime} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>

        {/* RIGHT — config panel */}
        <div className="fleet-assign-right">
          <div className="fleet-section-card fleet-config-card">

            {/* Header */}
            <div className="fleet-config-head">
              <div className="fleet-config-icon">
                <CheckCircle size={18} style={{ color:'#3a82ff' }} />
              </div>
              <div>
                <p className="fleet-config-title">Configuration</p>
                <p className="fleet-config-sub">Finalize deployment parameters</p>
              </div>
            </div>

            {/* Target Site — animated dropdown with custom entry */}
            <div className="fleet-config-field">
              <FleetDropdown
                label="Target Site"
                value={targetSite}
                onChange={setTargetSite}
                placeholder="Select site…"
                allowCustom
                options={siteOptions.map((s) => ({ value:s, label:s }))}
              />
            </div>

            {/* Department — animated dropdown with custom entry */}
            <div className="fleet-config-field">
              <FleetDropdown
                label="Department"
                value={department}
                onChange={setDepartment}
                placeholder="Select department…"
                allowCustom
                options={deptOptions.map((d) => ({ value:d, label:d }))}
              />
            </div>

            {/* Deployment Duration */}
            <div className="fleet-config-field">
              <p className="fleet-config-label">Deployment Duration</p>
              <div className="fleet-duration-toggle">
                {DURATION_OPTIONS.map((opt) => (
                  <button key={opt} type="button"
                    className={`fleet-duration-btn${duration === opt ? ' fleet-duration-btn--active' : ''}`}
                    onClick={() => setDuration(opt)}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div style={{ height:'1px', background:'rgba(255,255,255,0.06)', margin:'4px 0 16px' }} />

            {/* Selected vehicle summary */}
            {selected && (
              <motion.div
                initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }}
                style={{ padding:'12px 14px', background:'rgba(58,130,255,0.06)', border:'1px solid rgba(58,130,255,0.15)', borderRadius:'10px', marginBottom:'16px' }}>
                <p style={{ margin:'0 0 3px', fontSize:'10px', fontWeight:800, textTransform:'uppercase', letterSpacing:'0.08em', color:'rgba(148,163,184,0.55)' }}>
                  Assigning
                </p>
                <p style={{ margin:0, fontSize:'14px', fontWeight:800, color:'#fff' }}>
                  {selected.unitId || selected.id}
                  <span style={{ fontSize:'12px', fontWeight:600, color:'rgba(148,163,184,0.65)', marginLeft:'8px' }}>
                    {selected.vehicleType} · {selected.category}
                  </span>
                </p>
              </motion.div>
            )}

            {/* Maintenance warning */}
            {selected && selected.status === 'maintenance' && (
              <div style={{ 
                padding:'12px 14px', 
                background:'rgba(255,83,95,0.08)', 
                border:'1px solid rgba(255,83,95,0.25)', 
                borderRadius:'8px', 
                marginBottom:'16px',
                display:'flex',
                gap:'8px',
                alignItems:'flex-start'
              }}>
                <AlertTriangle size={14} style={{ color:'#ff8080', flexShrink:0, marginTop:'1px' }} />
                <div>
                  <p style={{ margin:0, fontSize:'12px', fontWeight:700, color:'#ff8080' }}>
                    Vehicle Under Maintenance
                  </p>
                  <p style={{ margin:'4px 0 0', fontSize:'11px', color:'rgba(255,128,128,0.85)', lineHeight:1.4 }}>
                    This vehicle is currently under maintenance and cannot be assigned to a site. Please complete maintenance first.
                  </p>
                </div>
              </div>
            )}

            {/* Inspection requirement warning */}
            {selected && needsInspection && (
              <div style={{ 
                padding:'12px 14px', 
                background:'rgba(255,83,95,0.08)', 
                border:'1px solid rgba(255,83,95,0.25)', 
                borderRadius:'8px', 
                marginBottom:'16px',
                display:'flex',
                flexDirection:'column',
                gap:'10px'
              }}>
                <div style={{ display:'flex', gap:'8px', alignItems:'flex-start' }}>
                  <AlertTriangle size={14} style={{ color:'#ff8080', flexShrink:0, marginTop:'1px' }} />
                  <div>
                    <p style={{ margin:0, fontSize:'12px', fontWeight:700, color:'#ff8080' }}>
                      {!hasInspection ? 'Inspection Required' : 'Reinspection Required'}
                    </p>
                    <p style={{ margin:'4px 0 0', fontSize:'11px', color:'rgba(255,128,128,0.85)', lineHeight:1.4 }}>
                      {!hasInspection 
                        ? 'This vehicle must complete at least one inspection before it can be assigned to a site.'
                        : 'This vehicle is returning from deployment and must complete a reinspection before being reassigned.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleStartInspection}
                  style={{
                    alignSelf: 'flex-start',
                    background: 'rgba(22, 201, 136, 0.15)',
                    border: '1px solid rgba(22, 201, 136, 0.35)',
                    color: '#4deba0',
                    padding: '8px 14px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(22, 201, 136, 0.25)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(22, 201, 136, 0.15)'}
                >
                  <CheckCircle size={12} /> Start Inspection
                </button>
              </div>
            )}

            {/* Confirm */}
            <button type="button" className="fleet-confirm-assign-btn"
              disabled={!selected || !targetSite || saving || saved || needsInspection || selected?.status === 'maintenance'}
              onClick={handleConfirm}>
              {saved
                ? '✓  Assignment Confirmed'
                : saving
                ? <><span className="fleet-spinner" style={{ borderTopColor:'#fff' }} /> Saving…</>
                : 'Confirm Assignment'}
            </button>

            <button type="button" className="fleet-cancel-assign-btn" onClick={onBack} disabled={saving}>
              Cancel &amp; Return
            </button>

            <div className="fleet-assign-note">
              <Info size={12} style={{ flexShrink:0, color:'rgba(148,163,184,0.4)', marginTop:'1px' }} />
              <p>Deployment will be logged under your account. Registry updates across all sectors within 60 seconds.</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

/* ── Active Selection Card ── */
function ActiveSelectionCard({ vehicle, lastInspection, activeAlerts }) {
  const health = vehicle.healthScore ?? 100
  const hClass = healthClass(health)
  const isAvail = (vehicle.status || '').toLowerCase() === 'active'
  const healthColor = hClass === 'high' ? '#4deba0' : hClass === 'mid' ? '#ffb56e' : '#ff8080'

  return (
    <div className="fleet-active-sel-card">
      <div className="fleet-active-sel-badge">Active Selection</div>
      <div className="fleet-active-sel-top">
        <div>
          <h2 className="fleet-active-sel-id">{vehicle.unitId || vehicle.id}</h2>
          <p className="fleet-active-sel-type">{vehicle.vehicleType || '—'} — {vehicle.category || '—'}</p>
        </div>
        <div className="fleet-active-sel-health">
          <span className="fleet-active-sel-health-label">Health Score</span>
          <span className="fleet-active-sel-health-value" style={{ color: healthColor }}>{health}%</span>
          <TruckIcon size={36} style={{ opacity:0.16, marginTop:'4px', color: healthColor }} />
        </div>
      </div>
      <div className="fleet-active-sel-meta">
        <div>
          <p className="fleet-active-sel-meta-label">Odometer</p>
          <p className="fleet-active-sel-meta-value">{vehicle.mileageKm != null ? `${vehicle.mileageKm.toLocaleString()} KM` : '—'}</p>
        </div>
        <div>
          <p className="fleet-active-sel-meta-label">Last Inspection</p>
          <p className="fleet-active-sel-meta-value">{lastInspection ? formatDate(lastInspection.inspectedAt) : '—'}</p>
        </div>
        <div>
          <p className="fleet-active-sel-meta-label">Status</p>
          <p className="fleet-active-sel-status" style={{ color: isAvail ? '#4deba0' : '#ffb56e' }}>
            {isAvail ? '● Available' : `● ${cap(vehicle.status)}`}
          </p>
        </div>
      </div>
      {activeAlerts.length > 0 && (
        <div className="fleet-active-sel-alerts">
          {activeAlerts.slice(0, 2).map((a) => (
            <div key={a.id} className="fleet-active-alert-chip">
              <AlertTriangle size={11} />{a.message || 'Alert'}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Secondary Vehicle Card ── */
function SecondaryVehicleCard({ vehicle, isSelected, onSelect, alerts }) {
  const health  = vehicle.healthScore ?? 100
  const hClass  = healthClass(health)
  const inMaint = (vehicle.status || '').toLowerCase() === 'maintenance'
  const hasAlert = alerts.length > 0 || inMaint

  return (
    <motion.button type="button" whileHover={{ scale:1.02 }} whileTap={{ scale:0.97 }}
      className={`fleet-secondary-card${isSelected ? ' fleet-secondary-card--selected' : ''}${hasAlert ? ' fleet-secondary-card--alert' : ''}`}
      onClick={onSelect}>
      <div className="fleet-secondary-icon">
        <TruckIcon size={22} style={{ opacity:0.35, color: hasAlert ? '#ff8080' : '#8ab8ff' }} />
      </div>
      <div className="fleet-secondary-info">
        <p className="fleet-secondary-id">{vehicle.unitId || vehicle.id}</p>
        <p className="fleet-secondary-type">{vehicle.vehicleType || '—'}</p>
        {hasAlert
          ? <p className="fleet-secondary-status fleet-secondary-status--alert"><AlertTriangle size={10} /> {inMaint ? 'In Maintenance' : `${alerts.length} Alert`}</p>
          : <div style={{ marginTop:'6px' }}><div className="fleet-health-track" style={{ height:'3px' }}><div className={`fleet-health-fill fleet-health-fill--${hClass}`} style={{ width:`${health}%` }} /></div></div>
        }
      </div>
      <span style={{ color: hClass === 'high' ? '#4deba0' : hClass === 'mid' ? '#ffb56e' : '#ff8080', fontSize:'11.5px', fontWeight:800, flexShrink:0 }}>
        {health}%
      </span>
    </motion.button>
  )
}

/* ── Telemetry cell ── */
function TelemetryCell({ label, value, highlight }) {
  return (
    <div className="fleet-telemetry-cell">
      <p className="fleet-telemetry-label">{label}</p>
      <p className="fleet-telemetry-value" style={{ color: highlight ? '#4deba0' : 'rgba(235,242,255,0.97)' }}>
        {value ?? '—'}
      </p>
    </div>
  )
}

/* ── Inline SVG truck icon ── */
function TruckIcon({ size, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <rect x="1" y="3" width="15" height="13" rx="1" />
      <path d="M16 8h4l3 5v3h-7V8z" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  )
}
