import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, TrendingUp, AlertTriangle, Clock, Calendar,
  Search, ChevronLeft, ChevronRight, CheckCircle, XCircle,
  Activity, Download,
} from 'lucide-react'
import { useFireExtData } from '../hooks/useFireExtData.js'
import { timeAgoShort, formatLogTime, initials, avatarColor, exportToCSV } from '../utils/feHelpers.js'
import { useModulePath } from '../../../shared/navigation/modulePaths.js'
import '../fe.css'

const PAGE_SIZE = 10

/* ─── Compliance Heatmap ─────────────────────────────────────── */
function ComplianceHeatmap({ assets }) {
  /* Build a flat list of cells from real asset data.
     Each cell represents one asset; colour by status.
     Group into up to 3 zones by asset.zone field. */
  const cells = useMemo(() => {
    if (assets.length === 0) return []
    return assets.map((a) => ({
      id: a.id,
      status: a.status || 'compliant',
      zone:   a.zone   || 'Zone A',
      label:  a.assetId || a.id,
    }))
  }, [assets])

  const zones = useMemo(() => {
    const map = {}
    cells.forEach((c) => {
      if (!map[c.zone]) map[c.zone] = { compliant: 0, total: 0 }
      map[c.zone].total++
      if (c.status === 'compliant') map[c.zone].compliant++
    })
    return Object.entries(map).map(([name, d]) => ({
      name,
      pct: d.total > 0 ? Math.round((d.compliant / d.total) * 100) : 0,
      color: d.total > 0 && d.compliant / d.total >= 0.85
        ? '#16c988'
        : d.compliant / d.total >= 0.6 ? '#fe8e2a' : '#ff535f',
    }))
  }, [cells])

  function cellClass(status) {
    if (status === 'compliant')     return 'fe-heatmap-cell fe-heatmap-cell--compliant'
    if (status === 'non_compliant') return 'fe-heatmap-cell fe-heatmap-cell--failed'
    if (status === 'warning')       return 'fe-heatmap-cell fe-heatmap-cell--warning'
    return 'fe-heatmap-cell fe-heatmap-cell--empty'
  }

  return (
    <div className="fe-card" style={{ flex: 1 }}>
      <div className="fe-card-head">
        <span className="fe-card-title" style={{ fontWeight: 900, fontSize: 15, letterSpacing: '-0.01em' }}>
          COMPLIANCE HEATMAP
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ display:'flex', alignItems:'center', gap:5, fontSize:10.5, fontWeight:700, color:'rgba(148,163,184,0.7)' }}>
            <span className="fe-legend-dot" style={{ background:'#16c988' }} /> Compliant
          </span>
          <span style={{ display:'flex', alignItems:'center', gap:5, fontSize:10.5, fontWeight:700, color:'rgba(148,163,184,0.7)' }}>
            <span className="fe-legend-dot" style={{ background:'#ff535f' }} /> Failed
          </span>
        </div>
      </div>

      {cells.length === 0 ? (
        <div className="fe-empty">
          <Activity size={32} style={{ color:'rgba(148,163,184,0.2)', margin:'0 auto 12px', display:'block' }} />
          <p className="fe-empty-title">No assets registered</p>
          <p className="fe-empty-sub">Register your first asset to populate the compliance heatmap.</p>
        </div>
      ) : (
        <>
          <div className="fe-heatmap-grid">
            {cells.map((c) => (
              <div key={c.id} className={cellClass(c.status)} title={`${c.label} — ${c.status}`} />
            ))}
          </div>

          {zones.length > 0 && (
            <div className="fe-heatmap-zones">
              {zones.map((z) => (
                <div key={z.name} className="fe-zone">
                  <span className="fe-zone-name">{z.name.toUpperCase()}</span>
                  <div className="fe-zone-bar">
                    <div className="fe-zone-fill" style={{ width:`${z.pct}%`, background: z.color }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ─── Action Required panel ──────────────────────────────────── */
function ActionRequired({ alerts, onResolve }) {
  const sorted = useMemo(() => {
    const order = { critical_failure: 0, tamper_alert: 1, upcoming_expiry: 2 }
    return [...alerts].sort((a, b) => (order[a.type] ?? 3) - (order[b.type] ?? 3)).slice(0, 5)
  }, [alerts])

  function typeStyle(type) {
    if (type === 'critical_failure') return { cls: 'fe-action-item--critical', labelCls: 'fe-action-type--critical', label: 'CRITICAL FAILURE' }
    if (type === 'tamper_alert')     return { cls: 'fe-action-item--warning',  labelCls: 'fe-action-type--warning',  label: 'TAMPER ALERT'     }
    return                                  { cls: 'fe-action-item--info',     labelCls: 'fe-action-type--info',     label: 'UPCOMING EXPIRY'  }
  }

  return (
    <div className="fe-card" style={{ display:'flex', flexDirection:'column' }}>
      <div className="fe-card-head">
        <span className="fe-card-title">ACTION REQUIRED</span>
        {alerts.length > 0 && (
          <span style={{ fontSize:10, fontWeight:800, background:'rgba(255,83,95,0.15)', color:'#ff8080', border:'1px solid rgba(255,83,95,0.28)', borderRadius:'999px', padding:'2px 10px' }}>
            {alerts.length}
          </span>
        )}
      </div>

      {sorted.length === 0 ? (
        <div className="fe-empty">
          <CheckCircle size={28} style={{ color:'rgba(22,201,136,0.3)', margin:'0 auto 10px', display:'block' }} />
          <p className="fe-empty-title">All Clear</p>
          <p className="fe-empty-sub">No active alerts at this time.</p>
        </div>
      ) : (
        <div className="fe-action-list">
          {sorted.map((a) => {
            const { cls, labelCls, label } = typeStyle(a.type)
            return (
              <div key={a.id} className={`fe-action-item ${cls}`} onClick={() => onResolve(a.id)}>
                <div className="fe-action-type">
                  <span className={labelCls}>{label}</span>
                  <span className="fe-action-ago">{timeAgoShort(a.createdAt)}</span>
                </div>
                <p className="fe-action-title">{a.title || a.message || '—'}</p>
                {a.location && <p className="fe-action-loc">Location: {a.location}</p>}
              </div>
            )
          })}
        </div>
      )}

      {alerts.length > 0 && (
        <div style={{ padding:'12px 18px', borderTop:'1px solid rgba(255,255,255,0.05)' }}>
          <button type="button" className="fe-btn fe-btn--ghost" style={{ width:'100%', justifyContent:'center', fontSize:12 }}>
            VIEW ALL ALERTS
          </button>
        </div>
      )}
    </div>
  )
}

/* ─── Main Page ──────────────────────────────────────────────── */
export function FEDashboardPage() {
  const {
    assets, alerts, activityLog, loading,
    totalAssets, complianceRate, overdueInspections, upcomingExpiries,
    resolveAlert,
  } = useFireExtData()
  const navigate = useNavigate()
  const fePath = useModulePath('/extinguisher', '/client/fire-safety/extinguisher')

  const [logSearch, setLogSearch] = useState('')
  const [logPage,   setLogPage]   = useState(1)

  /* filter activity log */
  const filteredLog = useMemo(() => {
    if (!logSearch.trim()) return activityLog
    const q = logSearch.toLowerCase()
    return activityLog.filter((e) =>
      (e.technicianName || '').toLowerCase().includes(q) ||
      (e.assetId        || '').toLowerCase().includes(q) ||
      (e.action         || '').toLowerCase().includes(q)
    )
  }, [activityLog, logSearch])

  const totalPages = Math.max(1, Math.ceil(filteredLog.length / PAGE_SIZE))
  const safePage   = Math.min(logPage, totalPages)
  const paginated  = filteredLog.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  function statusTag(status) {
    const map = {
      passed:    'fe-status-tag--passed',
      failed:    'fe-status-tag--failed',
      optimized: 'fe-status-tag--optimized',
      pending:   'fe-status-tag--pending',
    }
    return map[(status || '').toLowerCase()] || 'fe-status-tag--pending'
  }

  function handleExport() {
    exportToCSV(filteredLog.map((e) => ({
      Technician:   e.technicianName || '—',
      'Asset ID':   e.assetId        || '—',
      Action:       e.action          || '—',
      Status:       e.statusUpdate    || '—',
      Timestamp:    formatLogTime(e.timestamp),
    })), 'fe-activity-log.csv')
  }

  if (loading) return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'60vh', gap:12, color:'rgba(148,163,184,0.8)' }}>
      <span className="fe-spinner fe-spinner--lg" />
      <span style={{ fontSize:14, fontWeight:600 }}>Loading dashboard…</span>
    </div>
  )

  return (
    <div className="fe-subpage">

      {/* ── Page header ── */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16, marginBottom:22, flexWrap:'wrap' }}>
        <div>
          <h1 style={{ margin:'0 0 5px', fontSize:'clamp(1.2rem,2.5vw,1.6rem)', fontWeight:900, color:'rgba(235,242,255,0.97)', letterSpacing:'-0.025em' }}>
            Safety Dashboard
          </h1>
          <p style={{ margin:0, fontSize:13, color:'rgba(148,163,184,0.72)', fontWeight:500 }}>
            Real-time facility compliance and asset health monitoring.
          </p>
        </div>
        <button
          type="button"
          className="fe-btn fe-btn--primary"
          onClick={() => navigate(fePath('/assets/new'))}
        >
          <Plus size={15} strokeWidth={2.5} /> New Asset Registration
        </button>
      </div>

      {/* ── KPI Row ── */}
      <div className="fe-kpi-row">
        {/* Total Assets */}
        <div className="fe-kpi-card">
          <p className="fe-kpi-label">Total Assets</p>
          <p className="fe-kpi-value fe-kpi-value--blue">
            {totalAssets > 0 ? totalAssets.toLocaleString() : '—'}
          </p>
          {totalAssets > 0 && (
            <p className="fe-kpi-meta fe-kpi-meta--up">
              <TrendingUp size={12} /> Live count from registry
            </p>
          )}
          {totalAssets === 0 && (
            <p className="fe-kpi-meta">Register assets to begin</p>
          )}
        </div>

        {/* Compliance Rate */}
        <div className="fe-kpi-card">
          <p className="fe-kpi-label">Compliance Rate</p>
          <p className={`fe-kpi-value${complianceRate !== null && complianceRate >= 90 ? ' fe-kpi-value--green' : complianceRate !== null && complianceRate < 70 ? ' fe-kpi-value--red' : ''}`}>
            {complianceRate !== null ? `${complianceRate}%` : '—'}
          </p>
          {complianceRate !== null && (
            <p className={`fe-kpi-meta${complianceRate >= 90 ? ' fe-kpi-meta--up' : complianceRate >= 70 ? ' fe-kpi-meta--warn' : ' fe-kpi-meta--danger'}`}>
              <CheckCircle size={12} />
              {complianceRate >= 90 ? 'Above target (90%)' : complianceRate >= 70 ? 'Below target (90%)' : 'Critical — immediate action required'}
            </p>
          )}
          {complianceRate === null && <p className="fe-kpi-meta">No assets registered yet</p>}
        </div>

        {/* Overdue Inspections */}
        <div className="fe-kpi-card">
          <p className="fe-kpi-label">Overdue Inspections</p>
          <p className={`fe-kpi-value${overdueInspections > 0 ? ' fe-kpi-value--red' : ''}`}>
            {assets.length > 0 ? overdueInspections : '—'}
          </p>
          {overdueInspections > 0 && (
            <p className="fe-kpi-meta fe-kpi-meta--danger">
              <AlertTriangle size={12} /> Urgent action required
            </p>
          )}
          {overdueInspections === 0 && assets.length > 0 && (
            <p className="fe-kpi-meta fe-kpi-meta--up"><CheckCircle size={12} /> All inspections current</p>
          )}
          {assets.length === 0 && <p className="fe-kpi-meta">No assets yet</p>}
        </div>

        {/* Upcoming Expiries */}
        <div className="fe-kpi-card">
          <p className="fe-kpi-label">Upcoming Expiries</p>
          <p className="fe-kpi-value">{assets.length > 0 ? upcomingExpiries : '—'}</p>
          {assets.length > 0 && (
            <p className="fe-kpi-meta">
              <Calendar size={12} /> Next 30 days
            </p>
          )}
          {assets.length === 0 && <p className="fe-kpi-meta">No assets yet</p>}
        </div>
      </div>

      {/* ── Mid row: heatmap + action required ── */}
      <div className="fe-mid-row">
        <ComplianceHeatmap assets={assets} />
        <ActionRequired alerts={alerts} onResolve={resolveAlert} />
      </div>

      {/* ── Activity Log ── */}
      <div className="fe-card">
        <div className="fe-card-head" style={{ flexWrap:'wrap', gap:10 }}>
          <span className="fe-card-title" style={{ fontWeight:900, letterSpacing:'-0.01em' }}>
            RECENT ACTIVITY LOG
          </span>
          <div style={{ display:'flex', gap:8, alignItems:'center', marginLeft:'auto', flexWrap:'wrap' }}>
            <div className="fe-search-wrap">
              <Search size={13} className="fe-search-icon" />
              <input
                type="text"
                className="fe-search-input"
                placeholder="Search logs…"
                value={logSearch}
                onChange={(e) => { setLogSearch(e.target.value); setLogPage(1) }}
              />
            </div>
            <button type="button" className="fe-icon-btn" onClick={handleExport} title="Export CSV">
              <Download size={14} />
            </button>
          </div>
        </div>

        {paginated.length === 0 ? (
          <div className="fe-empty">
            <Clock size={28} style={{ color:'rgba(148,163,184,0.2)', margin:'0 auto 10px', display:'block' }} />
            <p className="fe-empty-title">No activity recorded</p>
            <p className="fe-empty-sub">
              {logSearch ? 'No entries match your search.' : 'Technician actions will appear here in real time.'}
            </p>
          </div>
        ) : (
          <>
            <div className="fe-table-wrap">
              <table className="fe-table">
                <thead>
                  <tr>
                    <th>TECHNICIAN</th>
                    <th>ASSET ID</th>
                    <th>ACTION TAKEN</th>
                    <th>STATUS UPDATE</th>
                    <th>TIMESTAMP</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((entry) => {
                    const name   = entry.technicianName || '—'
                    const avi    = initials(name)
                    const aviBg  = avatarColor(name)
                    const status = (entry.statusUpdate || '').toLowerCase()
                    return (
                      <tr key={entry.id}>
                        <td>
                          <div className="fe-tech-cell">
                            <div className="fe-tech-avatar" style={{ background: aviBg }}>{avi}</div>
                            <span className="fe-tech-name">{name}</span>
                          </div>
                        </td>
                        <td>
                          <span className="fe-asset-id">{entry.assetId || '—'}</span>
                        </td>
                        <td style={{ color:'rgba(203,214,255,0.8)', fontWeight:500 }}>
                          {entry.action || '—'}
                        </td>
                        <td>
                          {entry.statusUpdate ? (
                            <span className={`fe-status-tag ${statusTag(status)}`}>
                              {entry.statusUpdate.toUpperCase()}
                            </span>
                          ) : (
                            <span style={{ color:'rgba(148,163,184,0.4)' }}>—</span>
                          )}
                        </td>
                        <td style={{ color:'rgba(148,163,184,0.7)', fontSize:12.5 }}>
                          {formatLogTime(entry.timestamp)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="fe-pagination">
              <span className="fe-pagination-info">
                Showing {paginated.length} of {filteredLog.length} entries
              </span>
              <div className="fe-pagination-controls">
                <button type="button" className="fe-page-btn"
                  disabled={safePage <= 1} onClick={() => setLogPage((p) => p - 1)}>
                  <ChevronLeft size={13} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                  <button key={n} type="button"
                    className={`fe-page-btn${safePage === n ? ' fe-page-btn--active' : ''}`}
                    onClick={() => setLogPage(n)}>
                    {n}
                  </button>
                ))}
                <button type="button" className="fe-page-btn"
                  disabled={safePage >= totalPages} onClick={() => setLogPage((p) => p + 1)}>
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

    </div>
  )
}
