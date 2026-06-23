import React, { useState, useMemo } from 'react'
import { Plus, Search, Fuel, TrendingDown, Download } from 'lucide-react'
import { useFleetData } from '../hooks/useFleetData.js'
import { AddFuelLogModal } from '../components/AddFuelLogModal.jsx'
import { VehicleDetails } from '../components/VehicleDetails.jsx'
import { formatDateTime, fuelByMonth, exportToCSV } from '../utils/fleetHelpers.js'
import '../fleet.css'

const PAGE_SIZE = 10

export function FuelIntelligencePage() {
  const { vehicles, fuelLogs, inspections, alerts, loading, addFuelLog } = useFleetData()

  const [showAdd, setShowAdd]     = useState(false)
  const [saving, setSaving]       = useState(false)
  const [search, setSearch]       = useState('')
  const [page, setPage]           = useState(1)
  const [drawerVehicle, setDrawer] = useState(null)

  const vehicleById = useMemo(() => {
    const m = {}
    vehicles.forEach((v) => { m[v.id] = v })
    return m
  }, [vehicles])

  const filtered = useMemo(() => {
    if (!search.trim()) return fuelLogs
    const q = search.toLowerCase()
    return fuelLogs.filter((f) => {
      const v = vehicleById[f.vehicleId]
      return (
        (v?.unitId || '').toLowerCase().includes(q) ||
        (f.station || '').toLowerCase().includes(q)
      )
    })
  }, [fuelLogs, search, vehicleById])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage   = Math.min(page, totalPages)
  const paginated  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  /* Aggregated KPIs */
  const totalLitres   = fuelLogs.reduce((s, f) => s + (Number(f.litres) || 0), 0)
  const totalCost     = fuelLogs.reduce((s, f) => s + (Number(f.totalCost) || 0), 0)
  const avgPerFill    = fuelLogs.length ? (totalLitres / fuelLogs.length).toFixed(1) : '0'

  /* Per-vehicle fuel usage */
  const perVehicle = useMemo(() => {
    const map = {}
    fuelLogs.forEach((f) => {
      if (!map[f.vehicleId]) map[f.vehicleId] = { litres: 0, fills: 0 }
      map[f.vehicleId].litres += Number(f.litres) || 0
      map[f.vehicleId].fills  += 1
    })
    return Object.entries(map)
      .map(([vid, d]) => ({ vehicle: vehicleById[vid], ...d }))
      .sort((a, b) => b.litres - a.litres)
      .slice(0, 6)
  }, [fuelLogs, vehicleById])

  /* Monthly chart data */
  const chartData = useMemo(() => fuelByMonth(fuelLogs, 6), [fuelLogs])
  const maxLitres = Math.max(...chartData.map((c) => c.litres), 1)

  async function handleAdd(data) {
    setSaving(true)
    try { await addFuelLog(data) }
    finally { setSaving(false) }
  }

  function handleExport() {
    const rows = fuelLogs.map((f) => {
      const v = vehicleById[f.vehicleId]
      return {
        'Vehicle':       v?.unitId || f.vehicleId || '—',
        'Litres':        f.litres ?? '—',
        'Cost/L':        f.costPerLitre ?? '—',
        'Total Cost':    f.totalCost ?? '—',
        'Station':       f.station || '—',
        'Odometer (km)': f.odometer ?? '—',
        'Logged At':     formatDateTime(f.loggedAt),
      }
    })
    exportToCSV(rows, 'fleet-fuel-logs.csv')
  }

  if (loading) {
    return (
      <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'60vh', gap:'12px', color:'rgba(148,163,184,0.8)' }}>
        <span className="fleet-spinner fleet-spinner--lg" />
        <span style={{ fontSize:'14px', fontWeight:600 }}>Loading fuel data…</span>
      </div>
    )
  }

  if (drawerVehicle) {
    return (
      <VehicleDetails
        vehicle={drawerVehicle}
        alerts={alerts}
        onBack={() => setDrawer(null)}
        viewOnly={true}
        backText="Back to Fuel Intelligence"
      />
    )
  }

  return (
    <div className="fleet-subpage">
      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'12px', flexWrap:'wrap', marginBottom:'22px' }}>
        <div>
          <h1 className="fleet-subpage-title" style={{ marginBottom:0 }}>Fuel Intelligence</h1>
          <p className="fleet-subpage-sub" style={{ marginBottom:0 }}>Track fuel consumption, costs, and efficiency across all fleet units.</p>
        </div>
        <div style={{ display:'flex', gap:'8px', flexShrink:0 }}>
          <button type="button" className="fleet-btn fleet-btn--muted" onClick={handleExport}>
            <Download size={13} /> Export CSV
          </button>
          <button type="button" className="fleet-btn fleet-btn--primary" onClick={() => setShowAdd(true)}>
            <Plus size={14} /> Log Fuel
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="fleet-fuel-kpis">
        <div className="fleet-section-card fleet-fuel-kpi">
          <p className="fleet-fuel-kpi-label">Total Consumption</p>
          <p className="fleet-fuel-kpi-value">{totalLitres.toLocaleString(undefined, { maximumFractionDigits: 0 })}L</p>
          <p className="fleet-fuel-kpi-meta">Across {fuelLogs.length} fill{fuelLogs.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="fleet-section-card fleet-fuel-kpi">
          <p className="fleet-fuel-kpi-label">Total Fuel Cost</p>
          <p className="fleet-fuel-kpi-value">
            {totalCost > 0
              ? `R ${totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
              : '—'}
          </p>
          <p className="fleet-fuel-kpi-meta">All time spend</p>
        </div>
        <div className="fleet-section-card fleet-fuel-kpi">
          <p className="fleet-fuel-kpi-label">Avg per Fill</p>
          <p className="fleet-fuel-kpi-value">{avgPerFill}L</p>
          <p className="fleet-fuel-kpi-meta">Average litres per fill event</p>
        </div>
      </div>

      {/* Main two-column: chart + per-vehicle breakdown */}
      <div style={{ display:'grid', gridTemplateColumns:'minmax(0,1fr) 320px', gap:'18px', marginBottom:'20px', alignItems:'start' }}>
        {/* Monthly bar chart */}
        <div className="fleet-section-card">
          <div className="fleet-section-head">
            <h2>Monthly Fuel Consumption</h2>
          </div>
          {chartData.every((c) => c.litres === 0) ? (
            <div className="fleet-empty" style={{ padding:'32px 20px' }}>
              <div className="fleet-empty-icon"><Fuel size={28} style={{ opacity:0.25 }} /></div>
              <p className="fleet-empty-title">No fuel data yet</p>
              <p className="fleet-empty-sub">Log your first fuel fill to see consumption trends.</p>
            </div>
          ) : (
            <>
              <div className="fleet-fuel-bars">
                {chartData.map((bar) => (
                  <div key={bar.label} className="fleet-fuel-bar-col">
                    <div
                      className={`fleet-fuel-bar${bar.isCurrent ? ' fleet-fuel-bar--active' : ''}`}
                      style={{ height:`${Math.max((bar.litres / maxLitres) * 100, bar.litres > 0 ? 6 : 0)}%` }}
                      title={`${bar.litres.toFixed(0)}L`}
                    />
                    <span className="fleet-fuel-bar-label">{bar.label}</span>
                  </div>
                ))}
              </div>
              <p className="fleet-fuel-chart-sub">Litres consumed per month (last 6 months)</p>
            </>
          )}
        </div>

        {/* Top consumers */}
        <div className="fleet-section-card">
          <div className="fleet-section-head">
            <h2>Top Consumers</h2>
          </div>
          {perVehicle.length === 0 ? (
            <div className="fleet-empty" style={{ padding:'24px' }}>
              <p className="fleet-empty-sub">No data yet.</p>
            </div>
          ) : (
            <div style={{ padding:'10px 16px 14px' }}>
              {perVehicle.map(({ vehicle, litres, fills }, i) => {
                const pct = (litres / totalLitres) * 100
                return (
                  <div key={vehicle?.id || i} style={{ marginBottom:'14px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'5px' }}>
                      <span
                        style={{ fontSize:'12.5px', fontWeight:700, cursor: vehicle ? 'pointer' : 'default', textDecoration: vehicle ? 'underline' : 'none', color: vehicle ? '#8ab8ff' : 'rgba(235,242,255,0.92)' }}
                        onClick={() => vehicle && setDrawer(vehicle)}
                      >
                        {vehicle?.unitId || 'Unknown'}
                      </span>
                      <span style={{ fontSize:'12px', fontWeight:700, color:'rgba(235,242,255,0.85)' }}>
                        {litres.toFixed(0)}L
                      </span>
                    </div>
                    <div style={{ height:'5px', borderRadius:'999px', background:'rgba(255,255,255,0.06)', overflow:'hidden' }}>
                      <div style={{ height:'100%', borderRadius:'999px', width:`${pct}%`, background:'linear-gradient(90deg,#3a82ff,#1d4ed8)', transition:'width 500ms ease' }} />
                    </div>
                    <span style={{ fontSize:'10px', color:'rgba(148,163,184,0.5)', marginTop:'3px', display:'block' }}>
                      {fills} fill{fills !== 1 ? 's' : ''} · {pct.toFixed(1)}% of total
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Fuel log table */}
      <div className="fleet-section-card">
        <div style={{ padding:'14px 20px 12px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'10px' }}>
          <h2 style={{ margin:0, fontSize:'14px', fontWeight:700, color:'rgba(235,242,255,0.95)' }}>
            Fuel Log — {filtered.length} record{filtered.length !== 1 ? 's' : ''}
          </h2>
          <div style={{ position:'relative' }}>
            <Search size={13} style={{ position:'absolute', left:'10px', top:'50%', transform:'translateY(-50%)', color:'rgba(148,163,184,0.5)', pointerEvents:'none' }} />
            <input
              type="text"
              className="fleet-search-input"
              placeholder="Search vehicle or station…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              style={{ paddingLeft:'30px' }}
            />
          </div>
        </div>

        {paginated.length === 0 ? (
          <div className="fleet-empty">
            <div className="fleet-empty-icon"><Fuel size={28} style={{ opacity:0.25 }} /></div>
            <p className="fleet-empty-title">No fuel records</p>
            <p className="fleet-empty-sub">
              {search ? 'No records match your search.' : 'Log your first fuel fill to start tracking.'}
            </p>
          </div>
        ) : (
          <>
            <div style={{ overflowX:'auto' }}>
              <table className="fleet-table">
                <thead>
                  <tr>
                    <th>Vehicle</th>
                    <th>Litres</th>
                    <th>Cost / L</th>
                    <th>Total Cost</th>
                    <th>Station</th>
                    <th>Odometer (km)</th>
                    <th>Date / Time</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((f) => {
                    const v = vehicleById[f.vehicleId]
                    return (
                      <tr key={f.id}>
                        <td>
                          <button
                            type="button"
                            style={{ background:'none', border:'none', color:'#8ab8ff', cursor:'pointer', fontSize:'13px', fontWeight:700, padding:0, textDecoration:'underline' }}
                            onClick={() => v && setDrawer(v)}
                          >
                            {v?.unitId || f.vehicleId || '—'}
                          </button>
                        </td>
                        <td className="fleet-td-strong">{f.litres != null ? `${f.litres}L` : '—'}</td>
                        <td className="fleet-td-muted">{f.costPerLitre != null ? `R ${Number(f.costPerLitre).toFixed(2)}` : '—'}</td>
                        <td>{f.totalCost != null ? <span style={{ fontWeight:700, color:'#4deba0' }}>R {Number(f.totalCost).toFixed(2)}</span> : '—'}</td>
                        <td className="fleet-td-muted">{f.station || '—'}</td>
                        <td className="fleet-td-muted">{f.odometer != null ? f.odometer.toLocaleString() : '—'}</td>
                        <td className="fleet-td-muted">{formatDateTime(f.loggedAt)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="fleet-pagination-row">
              <span className="fleet-pagination-info">
                Showing {paginated.length} of {filtered.length} record{filtered.length !== 1 ? 's' : ''}
              </span>
              <div className="fleet-pagination-controls">
                <button className="fleet-page-btn" disabled={safePage <= 1} onClick={() => setPage((p) => p - 1)}>‹ Prev</button>
                <span style={{ fontSize:'12px', color:'rgba(148,163,184,0.6)', padding:'0 8px' }}>{safePage} / {totalPages}</span>
                <button className="fleet-page-btn" disabled={safePage >= totalPages} onClick={() => setPage((p) => p + 1)}>Next ›</button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      {showAdd && (
        <AddFuelLogModal
          vehicles={vehicles}
          onClose={() => setShowAdd(false)}
          onSave={handleAdd}
          loading={saving}
        />
      )}

    </div>
  )
}
