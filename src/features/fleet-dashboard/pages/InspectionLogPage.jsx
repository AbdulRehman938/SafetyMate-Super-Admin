import React, { useState, useMemo, useEffect, useRef } from 'react'
import {
  ScanLine, X, ChevronLeft, ChevronRight, ClipboardList, Lock,
  Zap, Fuel, Wrench, AlertTriangle, Camera, Search,
} from 'lucide-react'
import { useFleetData } from '../hooks/useFleetData.js'
import { VehicleDetails } from '../components/VehicleDetails.jsx'
import '../fleet.css'

const PAGE_SIZE = 4

/* ── Unsplash images keyed by vehicle type / model keywords ── */
const VEHICLE_IMAGES = [
  { keys: ['interceptor', 'pickup', 'ranger', 'hilux', 'raptor', 'tacoma'],
    url: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=640&q=80' },
  { keys: ['transport', 'semi', 'truck', 'hauler', 'freighter', 'atlas'],
    url: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=640&q=80' },
  { keys: ['ev', 'electric', 'pulse', 'tesla', 'vanguard'],
    url: 'https://images.unsplash.com/photo-1619767886558-efdc259cde1a?w=640&q=80' },
  { keys: ['utility', 'van', 'transit', 'titan', 'rig'],
    url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=640&q=80' },
  { keys: ['suv', 'patrol', 'cruiser', 'land'],
    url: 'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=640&q=80' },
]
const FALLBACK_IMG = 'https://images.unsplash.com/photo-1485291571150-772bcfc10da5?w=640&q=80'

function getVehicleImage(vehicle) {
  if (vehicle.image) return vehicle.image
  const name = `${vehicle.model || ''} ${vehicle.vehicleType || ''}`.toLowerCase()
  for (const { keys, url } of VEHICLE_IMAGES) {
    if (keys.some((k) => name.includes(k))) return url
  }
  return FALLBACK_IMG
}

function timeAgo(ts) {
  if (!ts) return null
  const ms = typeof ts.toMillis === 'function' ? ts.toMillis() : new Date(ts).getTime()
  const diff = Date.now() - ms
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days} day${days !== 1 ? 's' : ''} ago`
  const months = Math.floor(days / 30)
  return `${months} month${months !== 1 ? 's' : ''} ago`
}

/* ── SVG Circle Gauge ── */
function CircleGauge({ pct = 0, size = 44, stroke = 4 }) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  const color = pct >= 80 ? '#4deba0' : pct >= 50 ? '#fe8e2a' : '#ff535f'
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.5s ease' }} />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
        style={{ transform: 'rotate(90deg)', transformOrigin: 'center', fill: color,
          fontSize: size * 0.22 + 'px', fontWeight: 800, fontFamily: 'inherit' }}>
        {pct}%
      </text>
    </svg>
  )
}

/* ══════════════════════════════════════════════════════════════
   QR / VIN Scanner Modal
   ══════════════════════════════════════════════════════════════ */
function ScanModal({ vehicles, onClose, onSelect }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [camError, setCamError] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [query, setQuery] = useState('')
  const [laserY, setLaserY] = useState(30)

  /* Start camera */
  useEffect(() => {
    let cancelled = false
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment' } })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play() }
      })
      .catch((err) => {
        if (!cancelled) setCamError(err.message || 'Camera unavailable')
      })
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  /* Laser animation */
  useEffect(() => {
    if (camError) return
    let dir = 1
    const id = setInterval(() => {
      setLaserY((y) => {
        if (y >= 90) dir = -1
        if (y <= 10) dir = 1
        return y + dir * 1.4
      })
    }, 25)
    return () => clearInterval(id)
  }, [camError])

  /* Simulate scan */
  function simulateScan() {
    if (!query.trim()) return
    setScanning(true)
    setTimeout(() => {
      const q = query.toLowerCase()
      const found = vehicles.find((v) =>
        (v.unitId || '').toLowerCase().includes(q) ||
        (v.vin || '').toLowerCase().includes(q) ||
        (v.model || '').toLowerCase().includes(q)
      )
      setScanning(false)
      if (found) { onSelect(found); onClose() }
    }, 1200)
  }

  const filtered = query.trim()
    ? vehicles.filter((v) =>
        (v.unitId || '').toLowerCase().includes(query.toLowerCase()) ||
        (v.vin || '').toLowerCase().includes(query.toLowerCase()) ||
        (v.model || '').toLowerCase().includes(query.toLowerCase()))
    : []

  return (
    <div className="fleet-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ width: '100%', maxWidth: '520px', background: '#080d1c',
        border: '1px solid rgba(58,130,255,0.2)', borderRadius: '20px',
        padding: '24px', boxShadow: '0 32px 80px rgba(0,0,0,0.8)', position: 'relative' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px',
            background: 'rgba(58,130,255,0.12)', border: '1px solid rgba(58,130,255,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5ba8ff' }}>
            <ScanLine size={18} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#fff' }}>QR / VIN Scanner</p>
            <p style={{ margin: 0, fontSize: '11px', color: 'rgba(148,163,184,0.6)', fontWeight: 600 }}>
              Point camera at QR code or enter VIN manually
            </p>
          </div>
          <button type="button" onClick={onClose} style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', width: '32px', height: '32px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(148,163,184,0.7)', cursor: 'pointer' }}>
            <X size={14} />
          </button>
        </div>

        {/* Viewfinder */}
        <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3', background: '#000',
          borderRadius: '14px', overflow: 'hidden', marginBottom: '16px' }}>
          {camError ? (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: '12px', color: 'rgba(148,163,184,0.6)' }}>
              <Camera size={40} style={{ opacity: 0.3 }} />
              <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, textAlign: 'center', padding: '0 20px' }}>
                {camError}
              </p>
              <p style={{ margin: 0, fontSize: '11px', color: 'rgba(148,163,184,0.4)' }}>
                Use the manual search below
              </p>
            </div>
          ) : (
            <video ref={videoRef} muted playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          )}
          {/* Overlay + finder */}
          <div style={{ position: 'absolute', inset: 0,
            background: 'linear-gradient(rgba(0,0,0,0.45) 0%, transparent 25%, transparent 75%, rgba(0,0,0,0.45) 100%)' }} />
          <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
            width: '55%', height: '55%', border: '2px solid rgba(58,220,130,0.85)',
            borderRadius: '12px', boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)' }}>
            {/* corner accents */}
            {[['0','0','auto','auto'],['0','auto','auto','0'],['auto','0','0','auto'],['auto','auto','0','0']].map(([t,r,b,l], i) => (
              <span key={i} style={{ position: 'absolute', width: '18px', height: '18px',
                top: t !== 'auto' ? '-2px' : 'auto', right: r !== 'auto' ? '-2px' : 'auto',
                bottom: b !== 'auto' ? '-2px' : 'auto', left: l !== 'auto' ? '-2px' : 'auto',
                borderTop: (i < 2) ? '3px solid #4deba0' : 'none',
                borderBottom: (i >= 2) ? '3px solid #4deba0' : 'none',
                borderLeft: (i === 0 || i === 2) ? '3px solid #4deba0' : 'none',
                borderRight: (i === 1 || i === 3) ? '3px solid #4deba0' : 'none',
              }} />
            ))}
            {/* Laser */}
            <div style={{ position: 'absolute', left: '5%', right: '5%', height: '2px',
              top: `${laserY}%`, background: 'linear-gradient(90deg,transparent,#ff4444,#ff4444,transparent)',
              boxShadow: '0 0 8px rgba(255,68,68,0.8)', transition: 'top 25ms linear' }} />
          </div>
        </div>

        {/* Manual search */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: filtered.length ? '12px' : 0 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={13} style={{ position: 'absolute', left: '12px', top: '50%',
              transform: 'translateY(-50%)', color: 'rgba(148,163,184,0.4)', pointerEvents: 'none' }} />
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Type VIN, unit ID, or model…"
              onKeyDown={(e) => e.key === 'Enter' && simulateScan()}
              style={{ width: '100%', padding: '10px 12px 10px 34px', background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.09)', borderRadius: '9px', color: '#fff',
                fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <button type="button" onClick={simulateScan} disabled={scanning || !query.trim()}
            style={{ padding: '10px 18px', background: 'linear-gradient(135deg,#2a7bd6,#1e5fb0)',
              border: 'none', borderRadius: '9px', color: '#fff', fontSize: '12.5px', fontWeight: 700,
              cursor: scanning || !query.trim() ? 'not-allowed' : 'pointer', opacity: scanning || !query.trim() ? 0.6 : 1,
              display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
            {scanning ? <span className="fleet-spinner" style={{ width: 14, height: 14 }} /> : <ScanLine size={13} />}
            SCAN
          </button>
        </div>

        {/* Dropdown results */}
        {filtered.length > 0 && (
          <div style={{ maxHeight: '180px', overflowY: 'auto', background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', scrollbarWidth: 'thin' }}>
            {filtered.map((v) => (
              <button key={v.id} type="button" onClick={() => { onSelect(v); onClose() }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '10px 14px', background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)',
                  cursor: 'pointer', textAlign: 'left', color: '#fff', transition: 'background 0.15s' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(58,130,255,0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0, overflow: 'hidden' }}>
                  <img src={getVehicleImage(v)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 700 }}>{v.unitId || v.id}</p>
                  <p style={{ margin: 0, fontSize: '10.5px', color: 'rgba(148,163,184,0.55)' }}>
                    {v.model || '—'} · {v.vehicleType || '—'}
                  </p>
                </div>
                <span style={{ marginLeft: 'auto', fontSize: '10px', fontWeight: 800, padding: '2px 8px',
                  borderRadius: '999px', background: v.status === 'maintenance' ? 'rgba(255,83,95,0.12)' : 'rgba(22,201,136,0.12)',
                  color: v.status === 'maintenance' ? '#ff8080' : '#4deba0',
                  border: `1px solid ${v.status === 'maintenance' ? 'rgba(255,83,95,0.25)' : 'rgba(22,201,136,0.25)'}` }}>
                  {(v.status || 'READY').toUpperCase()}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   Vehicle Card
   ══════════════════════════════════════════════════════════════ */
function VehicleCard({ vehicle, alerts, onStart }) {
  const isLocked = vehicle.status === 'maintenance' ||
    alerts.some((a) => a.vehicleId === vehicle.id && a.severity === 'critical' && a.status !== 'resolved')
  const isCritical = alerts.some((a) =>
    a.vehicleId === vehicle.id && a.severity === 'critical' && a.status !== 'resolved')
  const critAlert = alerts.find((a) =>
    a.vehicleId === vehicle.id && a.severity === 'critical' && a.status !== 'resolved')
  const health = vehicle.healthScore ?? 100
  const healthColor = health >= 80 ? '#4deba0' : health >= 50 ? '#fe8e2a' : '#ff535f'
  const fuel = vehicle.fuelLevel ?? 100
  const statusLabel = isLocked ? 'CRITICAL' : 'READY'
  const img = getVehicleImage(vehicle)

  return (
    <div style={{ background: 'rgba(8,12,28,0.9)', border: `1px solid ${isLocked ? 'rgba(255,83,95,0.3)' : 'rgba(255,255,255,0.08)'}`,
      borderRadius: '14px', overflow: 'hidden', display: 'flex', flexDirection: 'column',
      transition: 'box-shadow 0.2s, border-color 0.2s',
      boxShadow: isLocked ? '0 4px 24px rgba(255,83,95,0.08)' : '0 4px 20px rgba(0,0,0,0.3)' }}>

      {/* Image */}
      <div style={{ position: 'relative', height: '180px', overflow: 'hidden', flexShrink: 0 }}>
        <img src={img} alt={vehicle.model || vehicle.unitId}
          style={{ width: '100%', height: '100%', objectFit: 'cover',
            filter: isLocked ? 'brightness(0.7) saturate(0.5)' : 'brightness(0.85)' }}
          onError={(e) => { e.target.src = FALLBACK_IMG }}
        />
        {/* Gradient */}
        <div style={{ position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom,rgba(0,0,0,0.15) 0%,rgba(0,0,0,0.5) 100%)' }} />

        {/* Unit ID badge — top left */}
        <span style={{ position: 'absolute', top: '10px', left: '10px', background: 'rgba(0,0,0,0.72)',
          backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px',
          padding: '3px 9px', fontSize: '10px', fontWeight: 800, color: '#fff', letterSpacing: '0.05em' }}>
          {vehicle.unitId || vehicle.id}
        </span>

        {/* Status badge — top right */}
        <span style={{ position: 'absolute', top: '10px', right: '10px',
          background: isLocked ? 'rgba(255,83,95,0.85)' : 'rgba(22,201,136,0.85)',
          backdropFilter: 'blur(8px)', border: `1px solid ${isLocked ? 'rgba(255,83,95,0.5)' : 'rgba(22,201,136,0.5)'}`,
          borderRadius: '6px', padding: '3px 9px', fontSize: '9.5px', fontWeight: 800,
          color: '#fff', letterSpacing: '0.08em' }}>
          {statusLabel}
        </span>
      </div>

      {/* Body */}
      <div style={{ padding: '16px 18px 18px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
        {/* Name + Health */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: '0 0 3px', fontSize: '16px', fontWeight: 800, color: '#fff',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {vehicle.model || vehicle.unitId}
            </h3>
            <p style={{ margin: 0, fontSize: '10.5px', color: 'rgba(148,163,184,0.5)', fontWeight: 600,
              fontFamily: 'monospace', letterSpacing: '0.04em' }}>
              VIN: {(vehicle.vin || vehicle.id || '').toUpperCase().slice(0, 17)}
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
            <p style={{ margin: '0 0 2px', fontSize: '8.5px', fontWeight: 800, color: 'rgba(148,163,184,0.5)',
              letterSpacing: '0.09em', textTransform: 'uppercase' }}>HEALTH SCORE</p>
            <span style={{ fontSize: '22px', fontWeight: 900, color: healthColor, lineHeight: 1 }}>{health}%</span>
          </div>
        </div>

        {/* Meta row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <p style={{ margin: '0 0 3px', fontSize: '8.5px', fontWeight: 800, color: 'rgba(148,163,184,0.45)',
              letterSpacing: '0.09em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
              {isCritical ? <AlertTriangle size={9} style={{ color: '#ff8080' }} /> : <Wrench size={9} />}
              {isCritical ? 'ALERT' : 'LAST SERVICE'}
            </p>
            {isCritical ? (
              <p style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: '#ff8080' }}>
                {critAlert?.message?.slice(0, 22) || 'Critical alert'}
              </p>
            ) : (
              <p style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: 'rgba(235,242,255,0.85)' }}>
                {timeAgo(vehicle.lastService) || '—'}
              </p>
            )}
          </div>
          <div>
            <p style={{ margin: '0 0 3px', fontSize: '8.5px', fontWeight: 800, color: 'rgba(148,163,184,0.45)',
              letterSpacing: '0.09em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Fuel size={9} /> FUEL/CHARGE
            </p>
            <p style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: 'rgba(235,242,255,0.85)' }}>
              {fuel}%
            </p>
          </div>
        </div>

        {/* CTA button */}
        {isLocked ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            padding: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '10px', color: 'rgba(148,163,184,0.5)', fontSize: '12px', fontWeight: 800,
            letterSpacing: '0.06em', userSelect: 'none', marginTop: 'auto' }}>
            <Lock size={13} /> LOCKED FOR REPAIR
          </div>
        ) : (
          <button type="button" onClick={() => onStart(vehicle)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              padding: '12px', background: 'linear-gradient(135deg,#2a7bd6,#1a55a8)',
              border: '1px solid rgba(58,130,255,0.3)', borderRadius: '10px',
              color: '#fff', fontSize: '12.5px', fontWeight: 800, letterSpacing: '0.04em',
              cursor: 'pointer', transition: 'filter 0.2s', marginTop: 'auto' }}
            onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.12)'}
            onMouseLeave={(e) => e.currentTarget.style.filter = 'none'}>
            <ClipboardList size={14} /> Start Inspection
          </button>
        )}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   InspectionLogPage — main export
   ══════════════════════════════════════════════════════════════ */
export function InspectionLogPage() {
  const { vehicles, loading, openAlerts } = useFleetData()

  const [showScanner, setShowScanner] = useState(false)
  const [drawerVehicle, setDrawer] = useState(null)
  const [siteFilter, setSiteFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [page, setPage] = useState(1)

  /* Derive site list */
  const sites = useMemo(() => {
    const s = [...new Set(vehicles.map((v) => v.site).filter(Boolean))]
    return s
  }, [vehicles])

  /* Derive type list */
  const types = useMemo(() => {
    const t = [...new Set(vehicles.map((v) => v.vehicleType).filter(Boolean))]
    return t
  }, [vehicles])

  /* Filtered vehicles */
  const filtered = useMemo(() => {
    let list = [...vehicles]
    if (siteFilter !== 'all') list = list.filter((v) => v.site === siteFilter)
    if (typeFilter !== 'all') list = list.filter((v) => v.vehicleType === typeFilter)
    return list
  }, [vehicles, siteFilter, typeFilter])

  /* Ready units count */
  const readyCount = useMemo(() =>
    filtered.filter((v) => {
      const locked = v.status === 'maintenance' ||
        openAlerts.some((a) => a.vehicleId === v.id && a.severity === 'critical')
      return !locked
    }).length,
  [filtered, openAlerts])

  const readyPct = filtered.length ? Math.round((readyCount / filtered.length) * 100) : 0

  /* Pagination */
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  /* Reset page on filter change */
  useEffect(() => { setPage(1) }, [siteFilter, typeFilter])

  function handleStart(vehicle) { setDrawer(vehicle) }
  function handleSelectFromScan(vehicle) { setDrawer(vehicle) }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh',
      gap: '12px', color: 'rgba(148,163,184,0.8)' }}>
      <span className="fleet-spinner fleet-spinner--lg" />
      <span style={{ fontSize: '14px', fontWeight: 600 }}>Loading vehicles…</span>
    </div>
  )

  if (drawerVehicle) return (
    <VehicleDetails
      vehicle={drawerVehicle}
      alerts={openAlerts}
      onBack={() => setDrawer(null)}
      viewOnly={false}
      backText="Back to Inspection Log"
    />
  )

  return (
    <div className="fleet-subpage" style={{ paddingBottom: '80px' }}>

      {/* ════ PAGE HEADER ════ */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div>
          <p style={{ margin: '0 0 6px', fontSize: '10.5px', fontWeight: 800, color: '#3a82ff',
            letterSpacing: '0.12em', textTransform: 'uppercase',
            display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Zap size={11} /> SAFETYMATE MODULE
          </p>
          <h1 style={{ margin: '0 0 8px', fontSize: '2rem', fontWeight: 900, letterSpacing: '-0.03em',
            color: 'rgba(235,242,255,0.97)', lineHeight: 1 }}>
            Select Vehicle for Inspection
          </h1>
          <p style={{ margin: 0, fontSize: '13px', color: 'rgba(148,163,184,0.7)', fontWeight: 500,
            maxWidth: '520px', lineHeight: 1.5 }}>
            Scan or select a tactical unit to begin the mandatory daily safety checklist.
            All data is encrypted and synced to the Sentinel cloud.
          </p>
        </div>

        {/* Scan button */}
        <button type="button" onClick={() => setShowScanner(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '13px 22px',
            background: 'linear-gradient(135deg,#2a7bd6,#1a55a8)',
            border: '1px solid rgba(58,130,255,0.35)', borderRadius: '12px',
            color: '#fff', fontSize: '13.5px', fontWeight: 800, letterSpacing: '0.04em',
            cursor: 'pointer', boxShadow: '0 4px 20px rgba(42,123,214,0.35)',
            transition: 'filter 0.2s, transform 0.15s', flexShrink: 0 }}
          onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.12)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
          onMouseLeave={(e) => { e.currentTarget.style.filter = 'none'; e.currentTarget.style.transform = 'none' }}>
          <ScanLine size={17} /> Scan QR / VIN
        </button>
      </div>

      {/* ════ FILTER ROW ════ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '22px', flexWrap: 'wrap' }}>

        {/* Quick filter — site */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '8.5px', fontWeight: 800, color: 'rgba(148,163,184,0.45)',
            letterSpacing: '0.1em', textTransform: 'uppercase' }}>QUICK FILTER</label>
          <select value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)}
            style={{ background: 'rgba(10,14,28,0.85)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '9px', color: 'rgba(235,242,255,0.9)', fontSize: '12.5px', fontWeight: 600,
              padding: '9px 32px 9px 12px', outline: 'none', cursor: 'pointer',
              appearance: 'none', minWidth: '180px',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}>
            <option value="all">All Site Assets</option>
            {sites.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Vehicle type */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '8.5px', fontWeight: 800, color: 'rgba(148,163,184,0.45)',
            letterSpacing: '0.1em', textTransform: 'uppercase' }}>VEHICLE TYPE</label>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
            style={{ background: 'rgba(10,14,28,0.85)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '9px', color: 'rgba(235,242,255,0.9)', fontSize: '12.5px', fontWeight: 600,
              padding: '9px 32px 9px 12px', outline: 'none', cursor: 'pointer',
              appearance: 'none', minWidth: '140px',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}>
            <option value="all">All Types</option>
            {types.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* Clear */}
        <button type="button"
          onClick={() => { setSiteFilter('all'); setTypeFilter('all') }}
          style={{ marginTop: '18px', padding: '9px 16px', background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.09)', borderRadius: '9px',
            color: 'rgba(148,163,184,0.8)', fontSize: '12px', fontWeight: 700,
            cursor: 'pointer', letterSpacing: '0.06em', transition: 'background 0.15s' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}>
          CLEAR
        </button>

        {/* Filters button */}
        <button type="button"
          style={{ marginTop: '18px', display: 'flex', alignItems: 'center', gap: '6px',
            padding: '9px 16px', background: 'rgba(58,130,255,0.1)',
            border: '1px solid rgba(58,130,255,0.25)', borderRadius: '9px',
            color: '#8ab8ff', fontSize: '12px', fontWeight: 700,
            cursor: 'pointer', letterSpacing: '0.06em' }}>
          ⚙ FILTERS
        </button>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Ready units gauge */}
        <div style={{ marginTop: '18px', display: 'flex', alignItems: 'center', gap: '12px',
          background: 'rgba(10,14,28,0.7)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '12px', padding: '8px 14px 8px 10px' }}>
          <div>
            <p style={{ margin: '0 0 1px', fontSize: '8px', fontWeight: 800, color: 'rgba(148,163,184,0.45)',
              letterSpacing: '0.1em', textTransform: 'uppercase' }}>READY UNITS</p>
            <p style={{ margin: 0, fontSize: '18px', fontWeight: 900, color: '#fff', lineHeight: 1 }}>
              {readyCount}
              <span style={{ fontSize: '12px', color: 'rgba(148,163,184,0.5)', fontWeight: 600 }}>
                {' '}/ {filtered.length}
              </span>
            </p>
          </div>
          <CircleGauge pct={readyPct} size={48} stroke={4} />
        </div>
      </div>

      {/* ════ VEHICLE GRID ════ */}
      {filtered.length === 0 ? (
        <div className="fleet-empty">
          <div className="fleet-empty-icon" style={{ marginBottom: '12px', display: 'flex', justifyContent: 'center' }}>
            <ClipboardList size={40} style={{ color: 'rgba(148,163,184,0.25)' }} />
          </div>
          <p className="fleet-empty-title">No vehicles found</p>
          <p className="fleet-empty-sub">Try adjusting the filters above, or register a new vehicle.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))',
          gap: '18px', marginBottom: '28px' }}>
          {paginated.map((v) => (
            <VehicleCard key={v.id} vehicle={v} alerts={openAlerts} onStart={handleStart} />
          ))}
        </div>
      )}

      {/* ════ PAGINATION FOOTER ════ */}
      {filtered.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 0', borderTop: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap', gap: '10px' }}>
          <span style={{ fontSize: '12.5px', color: 'rgba(148,163,184,0.5)', fontWeight: 600 }}>
            Showing {paginated.length} of {filtered.length} registered units
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '8px', color: 'rgba(148,163,184,0.6)', cursor: safePage <= 1 ? 'not-allowed' : 'pointer',
                opacity: safePage <= 1 ? 0.4 : 1 }}>
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <button key={n} type="button" onClick={() => setPage(n)}
                style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: safePage === n ? 'rgba(58,130,255,0.25)' : 'rgba(255,255,255,0.03)',
                  border: safePage === n ? '1px solid rgba(58,130,255,0.45)' : '1px solid rgba(255,255,255,0.07)',
                  borderRadius: '8px', color: safePage === n ? '#8ab8ff' : 'rgba(148,163,184,0.7)',
                  fontWeight: safePage === n ? 800 : 600, fontSize: '12px', cursor: 'pointer' }}>
                {n}
              </button>
            ))}
            <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '8px', color: 'rgba(148,163,184,0.6)', cursor: safePage >= totalPages ? 'not-allowed' : 'pointer',
                opacity: safePage >= totalPages ? 0.4 : 1 }}>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Scanner Modal */}
      {showScanner && (
        <ScanModal
          vehicles={vehicles}
          onClose={() => setShowScanner(false)}
          onSelect={handleSelectFromScan}
        />
      )}
    </div>
  )
}
