import { useState, useMemo, useRef } from 'react'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import {
  AlertTriangle, Upload, X, MoreHorizontal,
  TrendingDown, TrendingUp, Minus,
  CheckCircle, Flag, Fuel, Clock,
} from 'lucide-react'
import { useFleetData } from '../hooks/useFleetData.js'
import { AddFuelLogModal } from '../components/AddFuelLogModal.jsx'
import { toDate, formatDate, exportToCSV } from '../utils/fleetHelpers.js'
import { CustomSelect } from '../../training-dashboard/components/CustomSelect.jsx'
import '../fleet.css'

/* ── Yup schema for inline fuel capture ────────────────────── */
const fuelCaptureSchema = Yup.object({
  vehicleId: Yup.string().required('Select a vehicle unit'),
  litres: Yup.number()
    .typeError('Enter a valid number')
    .required('Litres is required')
    .positive('Must be greater than 0')
    .max(10000, 'Value seems too large'),
  odometer: Yup.number()
    .typeError('Enter a valid number')
    .nullable()
    .transform((v, orig) => (orig === '' ? null : v))
    .min(0, 'Cannot be negative')
    .max(9999999, 'Value too large')
    .integer('Must be a whole number'),
  station: Yup.string()
    .nullable()
    .max(100, 'Max 100 characters'),
})

/* ─────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────── */

/** Format HH:MM:SS from a timestamp */
function formatTime(ts) {
  const d = toDate(ts)
  if (!d) return '—'
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

/** SVG donut gauge */
function DonutGauge({ pct = 0, size = 110, strokeW = 10, color = '#3a82ff', label, sublabel }) {
  const r     = (size - strokeW) / 2
  const circ  = 2 * Math.PI * r
  const filled = (pct / 100) * circ
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
        style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke="rgba(255,255,255,0.07)" strokeWidth={strokeW} />
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke={color} strokeWidth={strokeW}
          strokeDasharray={`${filled} ${circ - filled}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray .6s ease' }} />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
          style={{ transform: 'rotate(90deg)', transformOrigin: 'center',
            fill: '#fff', fontSize: size * 0.16 + 'px', fontWeight: 800, fontFamily: 'inherit' }}>
          {pct}%
        </text>
      </svg>
      {label    && <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#fff', textAlign: 'center' }}>{label}</p>}
      {sublabel && <p style={{ margin: 0, fontSize: 10.5, color: 'rgba(148,163,184,0.6)', fontWeight: 600 }}>{sublabel}</p>}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   Weekly bar chart (Mon–Sun) built from real fuelLogs
───────────────────────────────────────────────────────────── */
const WEEK_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']

function WeeklyChart({ fuelLogs }) {
  const weekData = useMemo(() => {
    const now    = new Date()
    const day    = now.getDay()
    const diff   = (day === 0 ? -6 : 1 - day)
    const monday = new Date(now)
    monday.setDate(now.getDate() + diff)
    monday.setHours(0, 0, 0, 0)

    const buckets = WEEK_DAYS.map((_, i) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      return { day: WEEK_DAYS[i], litres: 0, date: d }
    })

    fuelLogs.forEach((log) => {
      const d = toDate(log.loggedAt)
      if (!d) return
      const idx = Math.round((d - monday) / 86400000)
      if (idx >= 0 && idx < 7) buckets[idx].litres += Number(log.litres || 0)
    })

    const max = Math.max(...buckets.map((b) => b.litres), 1)
    return buckets.map((b) => ({ ...b, pct: (b.litres / max) * 100 }))
  }, [fuelLogs])

  const todayIdx = useMemo(() => {
    const d = new Date().getDay()
    return d === 0 ? 6 : d - 1
  }, [])

  return (
    <div className="fuel-weekly-chart">
      {weekData.map((b, i) => (
        <div key={b.day} className="fuel-weekly-col">
          <div className="fuel-weekly-bar-wrap">
            <div
              className={`fuel-weekly-bar${i === todayIdx ? ' fuel-weekly-bar--today' : ''}`}
              style={{ height: `${Math.max(b.pct, b.litres > 0 ? 5 : 0)}%` }}
              title={`${b.litres.toFixed(0)}L`}
            />
          </div>
          <span className="fuel-weekly-label">{b.day}</span>
        </div>
      ))}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   Hotspot matrix — 8 cols (hours) × 6 rows (days) coloured by
   real fuel log activity. Empty when no data.
───────────────────────────────────────────────────────────── */
function HotspotMatrix({ fuelLogs, vehicles }) {
  /* top 2 sites by total litres */
  const sites = useMemo(() => {
    const vehicleSite = {}
    vehicles.forEach((v) => { if (v.site) vehicleSite[v.id] = v.site })

    const siteMap = {}
    fuelLogs.forEach((log) => {
      const site = vehicleSite[log.vehicleId] || null
      if (!site) return
      siteMap[site] = (siteMap[site] || 0) + (Number(log.litres) || 0)
    })

    return Object.entries(siteMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([name, litres]) => ({ name, litres }))
  }, [fuelLogs, vehicles])

  /* 8-col × 6-row grid: cols = 3h time-bands (0-3h, 3-6h … 21-24h)
     rows = Mon–Sat. Cell intensity = number of fill events in that band. */
  const grid = useMemo(() => {
    if (fuelLogs.length === 0) return Array(48).fill(0)

    const counts = Array(48).fill(0)
    fuelLogs.forEach((log) => {
      const d = toDate(log.loggedAt)
      if (!d) return
      const dow  = d.getDay()                   // 0=Sun … 6=Sat
      const row  = dow === 0 ? 5 : dow - 1      // Sun→row5, Mon→row0 … Sat→row5
      const col  = Math.floor(d.getHours() / 3) // 8 bands of 3h each
      counts[row * 8 + col] += 1
    })

    const max = Math.max(...counts, 1)
    return counts.map((c) => Math.round((c / max) * 4))  // 0–4 intensity
  }, [fuelLogs])

  const INTENSITIES = [
    'rgba(255,255,255,0.03)',   // 0 — empty
    'rgba(255,83,95,0.15)',
    'rgba(255,83,95,0.35)',
    'rgba(255,83,95,0.60)',
    'rgba(255,83,95,0.88)',
  ]

  const hasActivity = fuelLogs.length > 0

  return (
    <div className="fuel-hotspot-card fuel-section-card">
      <div className="fuel-card-head">
        <span className="fuel-card-title" style={{ fontSize: 11 }}>HOTSPOT MATRIX</span>
      </div>

      {!hasActivity ? (
        <div style={{ padding: '28px 14px', textAlign: 'center',
          color: 'rgba(148,163,184,0.35)', fontSize: 11, fontWeight: 600 }}>
          No activity data yet
        </div>
      ) : (
        <>
          <div className="fuel-hotspot-grid">
            {grid.map((level, i) => (
              <div key={i} className="fuel-hotspot-cell"
                style={{ background: INTENSITIES[level] }} />
            ))}
          </div>
          <div className="fuel-hotspot-legend">
            {sites.length > 0 ? sites.map((s, i) => (
              <div key={s.name} className="fuel-hotspot-legend-item">
                <span className="fuel-hotspot-dot"
                  style={{ background: i === 0 ? '#ff535f' : '#3a82ff' }} />
                <span>{s.name}</span>
                {i === 0 && <span className="fuel-hotspot-tag">Most Active</span>}
              </div>
            )) : (
              <div className="fuel-hotspot-legend-item">
                <span style={{ color: 'rgba(148,163,184,0.4)', fontSize: 11 }}>No site data</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   FuelIntelligencePage — main export
───────────────────────────────────────────────────────────── */
export function FuelIntelligencePage() {
  const { vehicles, fuelLogs, openAlerts, loading, addFuelLog } = useFleetData()

  const [showAdd,  setShowAdd]  = useState(false)
  const [view,     setView]     = useState('realtime')  // 'realtime' | 'historical'
  const [receipt,  setReceipt]  = useState(null)        // { name, dataUrl }
  const receiptRef = useRef(null)

  /* ── lookup map ── */
  const vehicleById = useMemo(() => {
    const m = {}
    vehicles.forEach((v) => { m[v.id] = v })
    return m
  }, [vehicles])

  /* ── KPIs ── */
  const totalLitres = fuelLogs.reduce((s, f) => s + (Number(f.litres) || 0), 0)
  const totalCost   = fuelLogs.reduce((s, f) => s + (Number(f.totalCost) || 0), 0)

  /* Efficiency rating: avg km-per-litre from logs that have both odometer + litres */
  const efficiencyRating = useMemo(() => {
    const valid = fuelLogs.filter((f) => f.odometer && f.litres && f.litres > 0)
    if (valid.length < 2) return null
    const sorted = [...valid].sort((a, b) => (a.odometer ?? 0) - (b.odometer ?? 0))
    let totalKm = 0, totalL = 0
    for (let i = 1; i < sorted.length; i++) {
      totalKm += (sorted[i].odometer - sorted[i - 1].odometer)
      totalL  += sorted[i].litres
    }
    return totalL > 0 ? totalKm / totalL : null
  }, [fuelLogs])

  /* Consumption % of fleet capacity — 0 when no real data */
  const fleetCapacity  = vehicles.reduce((s, v) => s + (Number(v.fuelCapacity) || 0), 0)
  const consumptionPct = fleetCapacity > 0 && totalLitres > 0
    ? Math.min(100, Math.round((totalLitres / fleetCapacity) * 100))
    : 0

  /* Efficiency % — 0 when not enough fill data to calculate */
  const efficiencyPct = efficiencyRating !== null
    ? Math.min(100, Math.round(efficiencyRating * 20))
    : 0

  /* Expenditure % — require at least one log with a cost; no fake fallback */
  const monthlyBudget = vehicles.length > 0
    ? vehicles.reduce((s, v) => s + (Number(v.fuelCapacity) || 0), 0) * 25  // R25/L estimate when no budget set
    : 0
  const expenditurePct = monthlyBudget > 0 && totalCost > 0
    ? Math.min(100, Math.round((totalCost / monthlyBudget) * 100))
    : 0

  /* ── Anomalies from open alerts ── */
  const anomalies = useMemo(() => {
    return openAlerts
      .filter((a) => a.status !== 'resolved')
      .sort((a, b) => {
        const order = { critical: 0, warning: 1, info: 2 }
        return (order[a.severity] ?? 3) - (order[b.severity] ?? 3)
      })
      .slice(0, 5)
  }, [openAlerts])

  const criticalCount = anomalies.filter((a) => a.severity === 'critical').length

  /* ── Top performers: vehicles with best km/L ── */
  const topPerformers = useMemo(() => {
    const byVehicle = {}
    fuelLogs.forEach((f) => {
      if (!f.vehicleId || !f.litres || f.litres <= 0) return
      if (!byVehicle[f.vehicleId]) byVehicle[f.vehicleId] = { litres: 0, fills: 0, odometer: [] }
      byVehicle[f.vehicleId].litres += Number(f.litres)
      byVehicle[f.vehicleId].fills  += 1
      if (f.odometer) byVehicle[f.vehicleId].odometer.push(Number(f.odometer))
    })

    return Object.entries(byVehicle)
      .map(([vid, d]) => {
        const v   = vehicleById[vid]
        const odo = d.odometer.sort((a, b) => a - b)
        const kmL = odo.length >= 2
          ? (odo[odo.length - 1] - odo[0]) / d.litres
          : null
        return { vehicle: v, litres: d.litres, fills: d.fills, kmL }
      })
      .filter((p) => p.vehicle)
      .sort((a, b) => (b.kmL ?? 0) - (a.kmL ?? 0))
      .slice(0, 3)
  }, [fuelLogs, vehicleById])

  /* ── Temporal chart sector labels — real department names from vehicles ── */
  const sectorLabels = useMemo(() => {
    const depts = [...new Set(vehicles.map((v) => v.department).filter(Boolean))].slice(0, 2)
    if (depts.length >= 2) return depts
    const sites = [...new Set(vehicles.map((v) => v.site).filter(Boolean))].slice(0, 2)
    if (sites.length >= 2) return sites
    if (depts.length === 1) return [depts[0], null]
    if (sites.length === 1) return [sites[0], null]
    return [null, null]
  }, [vehicles])
  const recentTransactions = useMemo(
    () => [...fuelLogs].slice(0, 10),
    [fuelLogs]
  )

  /* ── Inline fuel capture form (Formik + Yup) ── */
  const fuelFormik = useFormik({
    initialValues: { vehicleId: '', odometer: '', litres: '', station: '' },
    validationSchema: fuelCaptureSchema,
    validateOnBlur: true,
    validateOnChange: false,
    onSubmit: async (values, { resetForm }) => {
      await addFuelLog({
        vehicleId: values.vehicleId,
        litres:    Number(values.litres),
        odometer:  values.odometer !== '' ? Number(values.odometer) : null,
        station:   values.station?.trim() || null,
        receipt:   receipt?.dataUrl || null,
      })
      resetForm()
      setReceipt(null)
    },
  })
  const FF = fuelFormik.values
  const FE = fuelFormik.errors
  const FT = fuelFormik.touched
  const fuelErrStyle = { fontSize: 10.5, color: '#ff8080', fontWeight: 600, marginTop: 2 }

  function handleReceiptUpload(file) {
    const reader = new FileReader()
    reader.onloadend = () => setReceipt({ name: file.name, dataUrl: reader.result })
    reader.readAsDataURL(file)
  }

  /* ── transaction status helper ── */
  function txStatus(log) {
    const v = vehicleById[log.vehicleId]
    if (!v) return 'flagged'
    const hasAlert = openAlerts.some(
      (a) => a.vehicleId === log.vehicleId && a.severity === 'critical' && a.status !== 'resolved'
    )
    return hasAlert ? 'flagged' : 'verified'
  }

  /* ── Anomaly icon + colour ── */
  function anomalyStyle(severity) {
    if (severity === 'critical') return { color: '#ff535f', bg: 'rgba(255,83,95,0.12)', border: 'rgba(255,83,95,0.3)' }
    if (severity === 'warning')  return { color: '#fe8e2a', bg: 'rgba(254,142,42,0.1)', border: 'rgba(254,142,42,0.28)' }
    return { color: '#3a82ff', bg: 'rgba(58,130,255,0.1)', border: 'rgba(58,130,255,0.22)' }
  }

  /* ── Performer trend icon ── */
  function trendIcon(kmL) {
    if (kmL === null) return <Minus size={12} style={{ color: 'rgba(148,163,184,0.5)' }} />
    if (kmL >= 8)     return <TrendingUp size={12} style={{ color: '#4deba0' }} />
    if (kmL >= 5)     return <Minus size={12} style={{ color: '#fe8e2a' }} />
    return <TrendingDown size={12} style={{ color: '#ff535f' }} />
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', gap: 12, color: 'rgba(148,163,184,0.8)' }}>
      <span className="fleet-spinner fleet-spinner--lg" />
      <span style={{ fontSize: 14, fontWeight: 600 }}>Loading fuel data…</span>
    </div>
  )

  return (
    <div className="fleet-subpage fuel-page">

      {/* ════════════════════════════════════════
          PAGE HEADER
      ════════════════════════════════════════ */}
      <div className="fuel-page-header">
        <div>
          <p className="fuel-kicker">OPERATIONAL SOVEREIGNTY</p>
          <h1 className="fuel-title">Unified Command Center</h1>
        </div>
        <div className="fuel-view-toggle">
          <button type="button"
            className={`fuel-toggle-btn${view === 'realtime' ? ' fuel-toggle-btn--active' : ''}`}
            onClick={() => setView('realtime')}>
            REAL-TIME
          </button>
          <button type="button"
            className={`fuel-toggle-btn${view === 'historical' ? ' fuel-toggle-btn--active' : ''}`}
            onClick={() => setView('historical')}>
            HISTORICAL
          </button>
        </div>
      </div>

      {/* ════════════════════════════════════════
          ROW 1: Capture | KPI donuts | Anomalies
      ════════════════════════════════════════ */}
      <div className="fuel-row1">

        {/* ── FUEL CAPTURING FORM ── */}
        <div className="fuel-capture-card fuel-section-card">
          <div className="fuel-card-head">
            <div className="fuel-card-icon"><Fuel size={14} /></div>
            <span className="fuel-card-title">FUEL CAPTURING</span>
          </div>

          <div className="fuel-form-fields">
            {/* Unit ID select */}
            <div className="fuel-field-group">
              <label className="fuel-field-label">UNIT ID</label>
              <CustomSelect
                value={FF.vehicleId}
                onChange={(val) => fuelFormik.setFieldValue('vehicleId', val)}
                onBlur={() => fuelFormik.setFieldTouched('vehicleId', true)}
                options={vehicles.map((v) => ({ value: v.id, label: v.unitId || v.id }))}
                placeholder="Select unit…"
                searchable={true}
                error={FE.vehicleId && FT.vehicleId}
              />
              {FE.vehicleId && FT.vehicleId && <span style={fuelErrStyle}>{FE.vehicleId}</span>}
            </div>

            {/* Odometer + Litres */}
            <div className="fuel-field-row">
              <div className="fuel-field-group">
                <label className="fuel-field-label">ODOMETER</label>
                <input type="number" id="odometer" name="odometer" min={0} placeholder="0"
                  className={`fuel-field-input${FE.odometer && FT.odometer ? ' fuel-field-input--err' : ''}`}
                  value={FF.odometer}
                  onChange={fuelFormik.handleChange}
                  onBlur={fuelFormik.handleBlur} />
                {FE.odometer && FT.odometer && <span style={fuelErrStyle}>{FE.odometer}</span>}
              </div>
              <div className="fuel-field-group">
                <label className="fuel-field-label">LITERS *</label>
                <input type="number" id="litres" name="litres" min={0.1} step={0.1} placeholder="0.00"
                  className={`fuel-field-input${FE.litres && FT.litres ? ' fuel-field-input--err' : ''}`}
                  value={FF.litres}
                  onChange={fuelFormik.handleChange}
                  onBlur={fuelFormik.handleBlur} />
                {FE.litres && FT.litres && <span style={fuelErrStyle}>{FE.litres}</span>}
              </div>
            </div>

            {/* Station name */}
            <div className="fuel-field-group">
              <label className="fuel-field-label">STATION NAME</label>
              <input type="text" id="station" name="station" placeholder="e.g. Shell Terminal A-12"
                className={`fuel-field-input${FE.station && FT.station ? ' fuel-field-input--err' : ''}`}
                value={FF.station}
                onChange={fuelFormik.handleChange}
                onBlur={fuelFormik.handleBlur} />
              {FE.station && FT.station && <span style={fuelErrStyle}>{FE.station}</span>}
            </div>

            <button type="button" className="fuel-submit-btn"
              onClick={fuelFormik.handleSubmit}
              disabled={fuelFormik.isSubmitting}>
              {fuelFormik.isSubmitting
                ? <span className="fleet-spinner" style={{ width: 14, height: 14 }} />
                : null}
              SUBMIT ENTRY
            </button>
          </div>
        </div>

        {/* ── KPI DONUTS ── */}
        <div className="fuel-kpi-donuts">
          <div className="fuel-kpi-donut-card fuel-section-card">
            <p className="fuel-kpi-donut-label">TOTAL<br />CONSUMPTION</p>
            <DonutGauge pct={consumptionPct} size={100} strokeW={9} color="#3a82ff" />
            <p className="fuel-kpi-donut-sub">
              {totalLitres > 0 ? `${(totalLitres / 1000).toFixed(1)}k` : '0'} LITRES
            </p>
          </div>
          <div className="fuel-kpi-donut-card fuel-section-card">
            <p className="fuel-kpi-donut-label">EFFICIENCY<br />RATING</p>
            <DonutGauge pct={efficiencyPct} size={100} strokeW={9} color="#4deba0" />
            <p className="fuel-kpi-donut-sub">
              {efficiencyRating !== null ? `${efficiencyRating.toFixed(1)} KM/L` : '—'}
            </p>
          </div>
          <div className="fuel-kpi-donut-card fuel-section-card">
            <p className="fuel-kpi-donut-label">MONTHLY<br />EXPENDITURE</p>
            <DonutGauge pct={expenditurePct} size={100} strokeW={9} color="rgba(148,163,184,0.6)" />
            <p className="fuel-kpi-donut-sub">
              {totalCost > 0 ? `$${(totalCost / 1000).toFixed(1)}k USD` : '—'}
            </p>
          </div>
        </div>

        {/* ── ANOMALIES ── */}
        <div className="fuel-anomalies-card fuel-section-card">
          <div className="fuel-card-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <AlertTriangle size={14} style={{ color: '#ff535f' }} />
              <span className="fuel-card-title" style={{ color: '#ff535f' }}>ANOMALIES</span>
            </div>
            {criticalCount > 0 && (
              <span className="fuel-anomaly-badge">
                {criticalCount < 10 ? `0${criticalCount}` : criticalCount} CRITICAL
              </span>
            )}
          </div>

          {anomalies.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'rgba(148,163,184,0.4)', fontSize: 12 }}>
              No active anomalies detected.
            </div>
          ) : (
            <div className="fuel-anomaly-list">
              {anomalies.map((a) => {
                const s = anomalyStyle(a.severity)
                const ago = (() => {
                  const d = toDate(a.createdAt)
                  if (!d) return ''
                  const diff = Date.now() - d.getTime()
                  const mins = Math.floor(diff / 60000)
                  if (mins < 60) return `${mins}m`
                  return `${Math.floor(mins / 60)}h`
                })()
                const v = vehicleById[a.vehicleId]
                return (
                  <div key={a.id} className="fuel-anomaly-item"
                    style={{ borderLeft: `3px solid ${s.color}` }}>
                    <div className="fuel-anomaly-top">
                      <span className="fuel-anomaly-type" style={{ color: s.color }}>
                        {a.message?.slice(0, 22)?.toUpperCase() || a.severity?.toUpperCase()}
                      </span>
                      {ago && <span className="fuel-anomaly-ago">{ago}</span>}
                    </div>
                    <p className="fuel-anomaly-desc">
                      {v ? `Unit ${v.unitId} · ` : ''}
                      {a.message || 'Alert detected.'}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════
          ROW 2: Temporal chart + Digital Receipt + Hotspot
      ════════════════════════════════════════ */}
      <div className="fuel-row2">

        {/* Temporal consumption chart */}
        <div className="fuel-temporal-card fuel-section-card">
          <div className="fuel-temporal-head">
            <div>
              <p className="fuel-temporal-title">TEMPORAL CONSUMPTION ANALYSIS</p>
              <p className="fuel-temporal-sub">Daily fuel delta across active fleet sectors</p>
            </div>
            <div className="fuel-temporal-legend">
              {sectorLabels[0] && (
                <><span className="fuel-legend-dot fuel-legend-dot--blue" /> {sectorLabels[0]}</>
              )}
              {sectorLabels[1] && (
                <><span className="fuel-legend-dot fuel-legend-dot--grey" style={{ marginLeft: 12 }} /> {sectorLabels[1]}</>
              )}
            </div>
          </div>

          {fuelLogs.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'rgba(148,163,184,0.35)', fontSize: 13, padding: '32px 0' }}>
              No fuel data yet — log your first fill to see trends.
            </div>
          ) : (
            <WeeklyChart fuelLogs={fuelLogs} />
          )}
        </div>

        {/* Digital Receipt */}
        <div className="fuel-receipt-card fuel-section-card">
          <div className="fuel-card-head">
            <div className="fuel-card-icon"><Upload size={13} /></div>
            <span className="fuel-card-title">DIGITAL RECEIPT</span>
          </div>

          {receipt ? (
            <div className="fuel-receipt-preview">
              {receipt.dataUrl.startsWith('data:image') ? (
                <img src={receipt.dataUrl} alt="receipt"
                  style={{ width: '100%', maxHeight: 120, objectFit: 'cover', borderRadius: 8 }} />
              ) : (
                <div className="fuel-receipt-file">
                  <Upload size={22} style={{ opacity: 0.4 }} />
                  <span>{receipt.name}</span>
                </div>
              )}
              <button type="button" className="fuel-receipt-remove"
                onClick={() => setReceipt(null)}>
                <X size={12} /> Remove
              </button>
            </div>
          ) : (
            <label className="fuel-receipt-drop">
              <Upload size={26} style={{ opacity: 0.3 }} />
              <span className="fuel-receipt-drop-label">Upload Receipt</span>
              <span className="fuel-receipt-drop-hint">PDF, JPG up to 10MB</span>
              <input ref={receiptRef} type="file" accept="image/*,.pdf"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleReceiptUpload(f)
                  e.target.value = ''
                }} />
            </label>
          )}
        </div>

        {/* Hotspot Matrix */}
        <HotspotMatrix fuelLogs={fuelLogs} vehicles={vehicles} />
      </div>

      {/* ════════════════════════════════════════
          ROW 3: Top performers + Recent transactions
      ════════════════════════════════════════ */}
      <div className="fuel-row3">

        {/* Top Fleet Performers */}
        <div className="fuel-performers-card fuel-section-card">
          <div className="fuel-card-head-plain">
            <span className="fuel-card-title-plain">TOP FLEET PERFORMERS</span>
          </div>

          {topPerformers.length === 0 ? (
            <div style={{ padding: '20px 16px', color: 'rgba(148,163,184,0.4)', fontSize: 12, textAlign: 'center' }}>
              Log fuel entries to see top performers.
            </div>
          ) : (
            <div className="fuel-performers-list">
              {topPerformers.map((p, i) => (
                <div key={p.vehicle.id} className="fuel-performer-row">
                  <span className="fuel-performer-rank">0{i + 1}</span>
                  <div className="fuel-performer-avatar">
                    <img
                      src={p.vehicle.image || '/vehicle car placeholder.png'}
                      alt={p.vehicle.unitId}
                      onError={(e) => { e.target.src = '/vehicle car placeholder.png' }}
                    />
                  </div>
                  <div className="fuel-performer-info">
                    <span className="fuel-performer-name">{p.vehicle.model || p.vehicle.unitId}</span>
                    <span className="fuel-performer-stat">
                      {p.kmL !== null ? `${p.kmL.toFixed(1)} KM/L efficiency` : `${p.litres.toFixed(0)}L consumed`}
                    </span>
                  </div>
                  <div className="fuel-performer-trend">
                    {trendIcon(p.kmL)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Fuel Transactions */}
        <div className="fuel-transactions-card fuel-section-card">
          <div className="fuel-card-head">
            <span className="fuel-card-title-plain">RECENT FUEL TRANSACTIONS</span>
            <button type="button" className="fuel-icon-btn" aria-label="More options"
              onClick={() => exportToCSV(fuelLogs.map((f) => {
                const v = vehicleById[f.vehicleId]
                return {
                  'Vehicle': v?.unitId || f.vehicleId || '—',
                  'Driver':  f.driverName || v?.driverName || '—',
                  'Station': f.station || '—',
                  'Litres':  f.litres ?? '—',
                  'Date':    formatDate(f.loggedAt),
                }
              }), 'fuel-transactions.csv')}>
              <MoreHorizontal size={14} />
            </button>
          </div>

          {recentTransactions.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'rgba(148,163,184,0.4)', fontSize: 12 }}>
              No transactions yet.
            </div>
          ) : (
            <div className="fuel-tx-table-wrap">
              <table className="fuel-tx-table">
                <thead>
                  <tr>
                    <th>TIMESTAMP</th>
                    <th>DRIVER / UNIT</th>
                    <th>STATION</th>
                    <th>VOLUME</th>
                    <th>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTransactions.map((log) => {
                    const v      = vehicleById[log.vehicleId]
                    const status = txStatus(log)
                    return (
                      <tr key={log.id}>
                        <td className="fuel-tx-time">{formatTime(log.loggedAt)}</td>
                        <td>
                          <span className="fuel-tx-driver">{v?.driverName || log.driverName || '—'}</span>
                          <span className="fuel-tx-unit">{v?.unitId || log.vehicleId || '—'}</span>
                        </td>
                        <td className="fuel-tx-station">{log.station || '—'}</td>
                        <td className="fuel-tx-volume">
                          {log.litres != null ? `${Number(log.litres).toFixed(1)} L` : '—'}
                        </td>
                        <td>
                          <span className={`fuel-tx-status fuel-tx-status--${status}`}>
                            {status === 'verified'
                              ? <><CheckCircle size={9} /> VERIFIED</>
                              : status === 'flagged'
                                ? <><Flag size={9} /> FLAGGED</>
                                : <><Clock size={9} /> PENDING</>
                            }
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Add Fuel Log modal (fallback) ── */}
      {showAdd && (
        <AddFuelLogModal
          vehicles={vehicles}
          onClose={() => setShowAdd(false)}
          onSave={async (data) => { await addFuelLog(data); setShowAdd(false) }}
          loading={false}
        />
      )}

    </div>
  )
}
