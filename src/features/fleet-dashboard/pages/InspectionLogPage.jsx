import { useState, useMemo, useEffect, useRef } from 'react'
import {
  ScanLine, X, ChevronLeft, ChevronRight,
  ClipboardList, Lock, Zap, Fuel, Wrench,
  AlertTriangle, Camera, Search, SlidersHorizontal,
  CheckCircle, Clock, Play,
} from 'lucide-react'
import { useFleetData } from '../hooks/useFleetData.js'
import { InspectionWizardPage } from './InspectionWizardPage.jsx'
import { timeAgo } from '../utils/fleetHelpers.js'
import '../fleet.css'

/* ─────────────────────────────────────────────────────────────
   Constants
───────────────────────────────────────────────────────────── */
const PAGE_SIZE = 4

/**
 * Status filter options for the FILTERS panel.
 * Each filter maps to a function that decides if a vehicle card is shown.
 *
 *   all           — every vehicle
 *   pending       — no inspection ever submitted today, not locked
 *   in_progress   — has a draft inspection saved today
 *   cleared       — has a submitted inspection today
 *   locked        — maintenance status or active critical alert
 */
const STATUS_FILTERS = [
  { id: 'all',         label: 'All',           icon: SlidersHorizontal },
  { id: 'pending',     label: 'Pending',        icon: Clock            },
  { id: 'in_progress', label: 'In Progress',    icon: Play             },
  { id: 'cleared',     label: 'Cleared',        icon: CheckCircle      },
  { id: 'locked',      label: 'Locked',         icon: Lock             },
]

/* ─────────────────────────────────────────────────────────────
   SVG Circle Gauge  (READY UNITS widget)
───────────────────────────────────────────────────────────── */
function CircleGauge({ pct = 0, size = 46, strokeW = 4 }) {
  const r      = (size - strokeW) / 2
  const circ   = 2 * Math.PI * r
  const filled = (pct / 100) * circ
  const color  = pct >= 80 ? '#4deba0' : pct >= 50 ? '#fe8e2a' : '#ff535f'
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
      style={{ flexShrink: 0, transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke="rgba(255,255,255,0.07)" strokeWidth={strokeW} />
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth={strokeW}
        strokeDasharray={`${filled} ${circ - filled}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray .5s ease' }} />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
        style={{ transform: 'rotate(90deg)', transformOrigin: 'center',
          fill: color, fontSize: size * 0.23 + 'px', fontWeight: 800, fontFamily: 'inherit' }}>
        {pct}%
      </text>
    </svg>
  )
}

/* ─────────────────────────────────────────────────────────────
   QR / VIN Scanner Modal
───────────────────────────────────────────────────────────── */
function ScanModal({ vehicles, onClose, onSelect }) {
  const videoRef  = useRef(null)
  const streamRef = useRef(null)
  const [camErr,   setCamErr]   = useState(null)
  const [query,    setQuery]    = useState('')
  const [laserY,   setLaserY]   = useState(30)
  const [scanning, setScanning] = useState(false)

  useEffect(() => {
    let dead = false
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment' } })
      .then((stream) => {
        if (dead) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}) }
      })
      .catch((e) => { if (!dead) setCamErr(e.message || 'Camera unavailable') })
    return () => { dead = true; streamRef.current?.getTracks().forEach((t) => t.stop()) }
  }, [])

  useEffect(() => {
    if (camErr) return
    let dir = 1
    const id = setInterval(() => {
      setLaserY((y) => { if (y >= 88) dir = -1; if (y <= 12) dir = 1; return y + dir * 1.6 })
    }, 22)
    return () => clearInterval(id)
  }, [camErr])

  const results = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return vehicles.filter((v) =>
      (v.unitId || '').toLowerCase().includes(q) ||
      (v.vin    || '').toLowerCase().includes(q) ||
      (v.model  || '').toLowerCase().includes(q)
    ).slice(0, 6)
  }, [vehicles, query])

  function handleSearch() {
    if (!query.trim() || results.length === 0) return
    setScanning(true)
    setTimeout(() => { setScanning(false); onSelect(results[0]); onClose() }, 900)
  }

  return (
    <div className="fleet-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="insp-scan-modal">
        <div className="insp-scan-head">
          <div className="insp-scan-icon-wrap"><ScanLine size={17} /></div>
          <div>
            <p className="insp-scan-title">QR / VIN Scanner</p>
            <p className="insp-scan-sub">Point camera at QR code or search manually</p>
          </div>
          <button type="button" className="insp-scan-close" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="insp-viewfinder">
          {camErr ? (
            <div className="insp-viewfinder-err">
              <Camera size={36} style={{ opacity: 0.3 }} />
              <p>{camErr}</p>
              <span>Use the search below instead</span>
            </div>
          ) : (
            <video ref={videoRef} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          )}
          <div className="insp-vf-overlay" />
          <div className="insp-vf-finder">
            <span className="insp-vf-corner insp-vf-corner--tl" />
            <span className="insp-vf-corner insp-vf-corner--tr" />
            <span className="insp-vf-corner insp-vf-corner--bl" />
            <span className="insp-vf-corner insp-vf-corner--br" />
            <div className="insp-vf-laser" style={{ top: `${laserY}%` }} />
          </div>
        </div>
        <div className="insp-scan-search-row">
          <div className="insp-scan-search-wrap">
            <Search size={13} className="insp-scan-search-icon" />
            <input type="text" className="insp-scan-search-input"
              placeholder="Type VIN, Unit ID or model…" value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
          </div>
          <button type="button" className="insp-scan-btn" onClick={handleSearch} disabled={scanning || !query.trim()}>
            {scanning ? <span className="fleet-spinner" style={{ width: 13, height: 13 }} /> : <ScanLine size={13} />}
            SCAN
          </button>
        </div>
        {results.length > 0 && (
          <div className="insp-scan-results">
            {results.map((v) => (
              <button key={v.id} type="button" className="insp-scan-result-item"
                onClick={() => { onSelect(v); onClose() }}>
                <img src={v.image || '/vehicle car placeholder.png'} alt={v.unitId}
                  onError={(e) => { e.target.src = '/vehicle car placeholder.png' }}
                  style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                <span className="insp-scan-result-id">{v.unitId || v.id}</span>
                <span className="insp-scan-result-model">{v.model || '—'} · {v.vehicleType || '—'}</span>
                <span className="insp-scan-result-badge" style={{
                  background: v.status === 'maintenance' ? 'rgba(255,83,95,0.12)' : 'rgba(22,201,136,0.12)',
                  color: v.status === 'maintenance' ? '#ff8080' : '#4deba0',
                  border: `1px solid ${v.status === 'maintenance' ? 'rgba(255,83,95,0.25)' : 'rgba(22,201,136,0.25)'}`,
                }}>
                  {v.status === 'maintenance' ? 'MAINTENANCE' : 'READY'}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   Vehicle Card
───────────────────────────────────────────────────────────── */
function VehicleCard({ vehicle, openAlerts, inspectionMap, onStart }) {
  const critAlerts = openAlerts.filter(
    (a) => a.vehicleId === vehicle.id && a.severity === 'critical' && a.status !== 'resolved'
  )
  const isLocked    = vehicle.status === 'maintenance' || critAlerts.length > 0
  const isCritical  = critAlerts.length > 0
  const health      = vehicle.healthScore ?? 100
  const fuel        = vehicle.fuelLevel   ?? null
  const healthColor = health >= 80 ? '#4deba0' : health >= 50 ? '#fe8e2a' : '#ff535f'
  const lastServiceLabel = timeAgo(vehicle.lastService) || '—'

  /* inspection status for this vehicle today */
  const todayInsp = inspectionMap[vehicle.id]   // { status, outcome } or undefined
  const isCleared    = todayInsp?.status === 'submitted'
  const isInProgress = todayInsp?.status === 'draft'

  /* badge label */
  let statusLabel = 'READY'
  let statusBg    = 'rgba(22,201,136,0.88)'
  let statusBdr   = '1px solid rgba(22,201,136,0.5)'
  if (isLocked)      { statusLabel = 'CRITICAL'; statusBg = 'rgba(255,60,60,0.88)'; statusBdr = '1px solid rgba(255,83,95,0.5)' }
  else if (isCleared)    { statusLabel = 'CLEARED';  statusBg = 'rgba(58,130,255,0.88)'; statusBdr = '1px solid rgba(58,130,255,0.5)' }
  else if (isInProgress) { statusLabel = 'DRAFT';    statusBg = 'rgba(254,142,42,0.88)'; statusBdr = '1px solid rgba(254,142,42,0.5)' }

  /* CTA label */
  let ctaLabel = 'Start Inspection'
  let ctaIcon  = <ClipboardList size={14} />
  if (isCleared)    { ctaLabel = 'View Submitted'; ctaIcon = <CheckCircle size={14} /> }
  if (isInProgress) { ctaLabel = 'Continue Inspection'; ctaIcon = <Play size={14} /> }

  return (
    <div className={`insp-card${isLocked ? ' insp-card--locked' : ''}${isCleared ? ' insp-card--cleared' : ''}`}>
      <div className="insp-card-img-wrap">
        <img
          src={vehicle.image || '/vehicle car placeholder.png'}
          alt={vehicle.model || vehicle.unitId}
          className="insp-card-img"
          style={{ filter: isLocked ? 'brightness(0.65) saturate(0.4)' : isCleared ? 'brightness(0.75) saturate(0.6)' : 'brightness(0.9)' }}
          onError={(e) => { e.target.src = '/vehicle car placeholder.png' }}
        />
        <div className="insp-card-img-fade" />
        <span className="insp-card-badge insp-card-badge--id">{vehicle.unitId || vehicle.id}</span>
        <span className="insp-card-badge insp-card-badge--status"
          style={{ background: statusBg, color: '#fff', border: statusBdr }}>
          {statusLabel}
        </span>
      </div>

      <div className="insp-card-body">
        <div className="insp-card-name-row">
          <div className="insp-card-name-col">
            <h3 className="insp-card-name">{vehicle.model || vehicle.unitId}</h3>
            <p className="insp-card-vin">VIN: {(vehicle.vin || vehicle.id || '').toUpperCase().slice(0, 17)}</p>
          </div>
          <div className="insp-card-health-col">
            <span className="insp-card-health-label">HEALTH SCORE</span>
            <span className="insp-card-health-value" style={{ color: healthColor }}>{health}%</span>
          </div>
        </div>

        <div className="insp-card-meta-row">
          <div className="insp-card-meta-cell">
            <span className="insp-card-meta-label">
              {isCritical
                ? <><AlertTriangle size={9} style={{ color: '#ff8080', marginRight: 3 }} />ALERT</>
                : <><Wrench size={9} style={{ marginRight: 3 }} />LAST SERVICE</>}
            </span>
            {isCritical
              ? <span className="insp-card-meta-value" style={{ color: '#ff8080' }}>{critAlerts[0]?.message?.slice(0, 24) || 'Critical alert'}</span>
              : <span className="insp-card-meta-value">{lastServiceLabel}</span>
            }
          </div>
          <div className="insp-card-meta-cell">
            <span className="insp-card-meta-label"><Fuel size={9} style={{ marginRight: 3 }} />FUEL/CHARGE</span>
            <span className="insp-card-meta-value">{fuel !== null ? `${fuel}%` : '—'}</span>
          </div>
        </div>

        {isLocked ? (
          <div className="insp-card-locked-btn"><Lock size={13} /> LOCKED FOR REPAIR</div>
        ) : (
          <button type="button"
            className={`insp-card-start-btn${isCleared ? ' insp-card-start-btn--submitted' : isInProgress ? ' insp-card-start-btn--draft' : ''}`}
            onClick={() => onStart(vehicle)}>
            {ctaIcon} {ctaLabel}
          </button>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   InspectionLogPage — main export
───────────────────────────────────────────────────────────── */
export function InspectionLogPage() {
  const { vehicles, inspections, loading, openAlerts } = useFleetData()

  const [showScanner,   setShowScanner]  = useState(false)
  const [activeVehicle, setActive]       = useState(null)
  const [siteFilter,    setSiteFilter]   = useState('all')
  const [typeFilter,    setTypeFilter]   = useState('all')
  const [statusFilter,  setStatusFilter] = useState('all')
  const [showFilters,   setShowFilters]  = useState(false)
  const [page,          setPage]         = useState(1)

  /* ── derive today's start timestamp for "today" comparisons ── */
  const todayStart = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d
  }, [])

  /**
   * inspectionMap — keyed by vehicleId, value = most relevant inspection for today.
   * Priority: submitted today > draft today
   */
  const inspectionMap = useMemo(() => {
    const map = {}
    // sort newest first — already ordered by Firestore desc
    inspections.forEach((ins) => {
      const vid = ins.vehicleId
      if (!vid) return
      const ts = ins.inspectedAt?.toMillis
        ? ins.inspectedAt.toMillis()
        : ins.inspectedAt?.seconds
          ? ins.inspectedAt.seconds * 1000
          : new Date(ins.inspectedAt || 0).getTime()
      const isToday = ts >= todayStart.getTime()

      // only track today's inspections for status badges
      if (!isToday) return

      // if we already have a submitted one for today, don't overwrite with a draft
      if (map[vid]?.status === 'submitted') return
      map[vid] = { status: ins.status, outcome: ins.outcome, id: ins.id, ...ins }
    })
    return map
  }, [inspections, todayStart])

  /* ── filter options from real data ── */
  const sites = useMemo(
    () => [...new Set(vehicles.map((v) => v.site).filter(Boolean))].sort(),
    [vehicles]
  )
  const types = useMemo(
    () => [...new Set(vehicles.map((v) => v.vehicleType).filter(Boolean))].sort(),
    [vehicles]
  )

  /* ── apply all filters ── */
  const filtered = useMemo(() => {
    let list = [...vehicles]

    // site filter
    if (siteFilter !== 'all') list = list.filter((v) => v.site === siteFilter)
    // type filter
    if (typeFilter !== 'all') list = list.filter((v) => v.vehicleType === typeFilter)

    // status filter
    if (statusFilter !== 'all') {
      list = list.filter((v) => {
        const crit   = openAlerts.some((a) => a.vehicleId === v.id && a.severity === 'critical' && a.status !== 'resolved')
        const locked = v.status === 'maintenance' || crit
        const todayInsp = inspectionMap[v.id]

        switch (statusFilter) {
          case 'locked':
            return locked
          case 'cleared':
            return !locked && todayInsp?.status === 'submitted'
          case 'in_progress':
            return !locked && todayInsp?.status === 'draft'
          case 'pending':
            return !locked && !todayInsp
          default:
            return true
        }
      })
    }

    return list
  }, [vehicles, siteFilter, typeFilter, statusFilter, openAlerts, inspectionMap])

  /* ── ready units (not locked, not yet cleared) ── */
  const readyCount = useMemo(
    () => filtered.filter((v) => {
      const crit = openAlerts.some((a) => a.vehicleId === v.id && a.severity === 'critical' && a.status !== 'resolved')
      return v.status !== 'maintenance' && !crit
    }).length,
    [filtered, openAlerts]
  )
  const readyPct = filtered.length ? Math.round((readyCount / filtered.length) * 100) : 0

  /* ── pagination ── */
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage   = Math.min(page, totalPages)
  const paginated  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  /* ── reset page on filter change ── */
  useEffect(() => {
    const t = setTimeout(() => setPage(1), 0)
    return () => clearTimeout(t)
  }, [siteFilter, typeFilter, statusFilter])

  /* ── counts for filter pill badges ── */
  const statusCounts = useMemo(() => {
    const counts = { all: vehicles.length, pending: 0, in_progress: 0, cleared: 0, locked: 0 }
    vehicles.forEach((v) => {
      const crit   = openAlerts.some((a) => a.vehicleId === v.id && a.severity === 'critical' && a.status !== 'resolved')
      const locked = v.status === 'maintenance' || crit
      const todayInsp = inspectionMap[v.id]
      if (locked)                              counts.locked++
      else if (todayInsp?.status === 'submitted') counts.cleared++
      else if (todayInsp?.status === 'draft')     counts.in_progress++
      else                                        counts.pending++
    })
    return counts
  }, [vehicles, openAlerts, inspectionMap])

  /* ── loading ── */
  if (loading) return (
    <div className="insp-loading">
      <span className="fleet-spinner fleet-spinner--lg" />
      <span>Loading vehicles…</span>
    </div>
  )

  /* ── wizard sub-page ── */
  if (activeVehicle) return (
    <InspectionWizardPage
      vehicle={activeVehicle}
      draftInspection={inspectionMap[activeVehicle.id]?.status === 'draft' ? inspectionMap[activeVehicle.id] : null}
      onBack={() => setActive(null)}
    />
  )

  return (
    <div className="fleet-subpage insp-page">

      {/* ════ HEADER ════ */}
      <div className="insp-header">
        <div className="insp-header-text">
          <p className="insp-kicker"><Zap size={11} /> SAFETYMATE MODULE</p>
          <h1 className="insp-title">Select Vehicle for Inspection</h1>
          <p className="insp-subtitle">
            Scan or select a tactical unit to begin the mandatory daily safety checklist.
            All data is encrypted and synced to the Sentinel cloud.
          </p>
        </div>
        <button type="button" className="insp-scan-trigger" onClick={() => setShowScanner(true)}>
          <ScanLine size={16} /> Scan QR / VIN
        </button>
      </div>

      {/* ════ FILTER BAR ════ */}
      <div className="insp-filter-bar">
        {/* site */}
        <div className="insp-select-wrap">
          <label className="insp-select-label">QUICK FILTER</label>
          <div className="insp-select-box">
            <select value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)} className="insp-select">
              <option value="all">All Site Assets</option>
              {sites.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* type */}
        <div className="insp-select-wrap">
          <label className="insp-select-label">VEHICLE TYPE</label>
          <div className="insp-select-box">
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="insp-select">
              <option value="all">All Types</option>
              {types.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        {/* CLEAR */}
        <button type="button" className="insp-filter-btn insp-filter-btn--clear"
          onClick={() => { setSiteFilter('all'); setTypeFilter('all'); setStatusFilter('all') }}>
          CLEAR
        </button>

        {/* FILTERS toggle */}
        <button type="button"
          className={`insp-filter-btn insp-filter-btn--filters${showFilters ? ' insp-filter-btn--filters-active' : ''}`}
          onClick={() => setShowFilters((v) => !v)}>
          <SlidersHorizontal size={12} /> FILTERS
          {statusFilter !== 'all' && <span className="insp-filter-dot" />}
        </button>

        <div style={{ flex: 1 }} />

        {/* READY UNITS gauge */}
        <div className="insp-ready-widget">
          <div className="insp-ready-text">
            <span className="insp-ready-label">READY UNITS</span>
            <span className="insp-ready-count">
              {readyCount}<span className="insp-ready-total"> / {filtered.length}</span>
            </span>
          </div>
          <CircleGauge pct={readyPct} size={46} strokeW={4} />
        </div>
      </div>

      {/* ════ STATUS FILTER PILLS ════ */}
      {showFilters && (
        <div className="insp-status-filters">
          {STATUS_FILTERS.map(({ id, label }) => (
            <button key={id} type="button"
              className={`insp-status-pill${statusFilter === id ? ' insp-status-pill--active' : ''}`}
              onClick={() => setStatusFilter(id)}>
              {label}
              <span className="insp-status-pill-count">{statusCounts[id] ?? 0}</span>
            </button>
          ))}
        </div>
      )}

      {/* ════ CARD GRID ════ */}
      {filtered.length === 0 ? (
        <div className="fleet-empty">
          <div className="fleet-empty-icon">
            <ClipboardList size={38} style={{ color: 'rgba(148,163,184,0.22)' }} />
          </div>
          <p className="fleet-empty-title">No vehicles found</p>
          <p className="fleet-empty-sub">
            {vehicles.length === 0
              ? 'Register your first vehicle to begin tracking.'
              : 'No vehicles match the current filters.'}
          </p>
        </div>
      ) : (
        <div className="insp-grid">
          {paginated.map((v) => (
            <VehicleCard
              key={v.id}
              vehicle={v}
              openAlerts={openAlerts}
              inspectionMap={inspectionMap}
              onStart={setActive}
            />
          ))}
        </div>
      )}

      {/* ════ PAGINATION FOOTER ════ */}
      {filtered.length > 0 && (
        <div className="insp-pagination">
          <span className="insp-pagination-info">
            Showing {paginated.length} of {filtered.length} registered units
          </span>
          <div className="insp-pagination-controls">
            <button type="button" className="insp-page-btn"
              disabled={safePage <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page">
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <button key={n} type="button"
                className={`insp-page-btn${safePage === n ? ' insp-page-btn--active' : ''}`}
                onClick={() => setPage(n)}>
                {n}
              </button>
            ))}
            <button type="button" className="insp-page-btn"
              disabled={safePage >= totalPages} onClick={() => setPage((p) => p + 1)} aria-label="Next page">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ════ SCANNER MODAL ════ */}
      {showScanner && (
        <ScanModal
          vehicles={vehicles}
          onClose={() => setShowScanner(false)}
          onSelect={(v) => { setShowScanner(false); setActive(v) }}
        />
      )}
    </div>
  )
}
