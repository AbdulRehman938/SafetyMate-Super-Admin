import { useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Search, ChevronLeft, ChevronRight, CheckCircle,
  AlertTriangle, Filter, MapPin, Activity, Calendar, X,
} from 'lucide-react'
import { useFireDetectionData } from '../hooks/useFireDetectionData.js'
import { CustomSelect } from '../../training-dashboard/components/CustomSelect.jsx'
import '../fd.css'

const PAGE_SIZE = 10

/* ─── Custom Date Picker Component ───────────────────────────────── */
function CustomDatePicker({ label, value, onChange, placeholder }) {
  const [isOpen, setIsOpen] = useState(false)
  const [tempDate, setTempDate] = useState(value || '')

  const handleDateClick = (date) => {
    setTempDate(date)
  }

  const handleApply = () => {
    onChange(tempDate)
    setIsOpen(false)
  }

  const handleClear = () => {
    setTempDate('')
    onChange('')
    setIsOpen(false)
  }

  // Generate days for current month
  const days = Array.from({ length: 31 }, (_, i) => i + 1)

  return (
    <div className="fd-date-picker-wrapper">
      <label className="fd-reg-label">{label}</label>
      <div 
        className="fd-date-picker-input" 
        onClick={() => setIsOpen(!isOpen)}
      >
        <Calendar size={14} />
        <span>{tempDate || placeholder}</span>
        <X size={12} onClick={(e) => { e.stopPropagation(); handleClear() }} />
      </div>
      {isOpen && (
        <div className="fd-date-picker-dropdown">
          <div className="fd-date-picker-header">
            <span>Select Date</span>
            <button type="button" className="fd-date-picker-close" onClick={() => setIsOpen(false)}>
              <X size={14} />
            </button>
          </div>
          <div className="fd-date-picker-grid">
            {days.map((day) => (
              <button
                key={day}
                type="button"
                className={`fd-date-picker-day${tempDate === day ? ' fd-date-picker-day--selected' : ''}`}
                onClick={() => handleDateClick(day)}
              >
                {day}
              </button>
            ))}
          </div>
          <div className="fd-date-picker-footer">
            <button type="button" className="fd-btn fd-btn--ghost" onClick={() => setIsOpen(false)}>
              Cancel
            </button>
            <button type="button" className="fd-btn fd-btn--primary" onClick={handleApply}>
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Main Page ──────────────────────────────────────────────── */
export function FDDashboardPage() {
  const {
    assets, loading,
    totalAssets, criticalAlerts,
    avgFlowRate,
    systemMetrics,
  } = useFireDetectionData()
  const navigate = useNavigate()

  const [searchTerm, setSearchTerm] = useState('')
  const [sectorFilter, setSectorFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)

  /* Filter assets */
  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      const matchesSearch = 
        (asset.assetId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (asset.serialNumber || '').toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesSector = sectorFilter === 'all' || asset.sector === sectorFilter
      const matchesStatus = statusFilter === 'all' || asset.status === statusFilter
      
      return matchesSearch && matchesSector && matchesStatus
    })
  }, [assets, searchTerm, sectorFilter, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredAssets.length / PAGE_SIZE))
  const paginatedAssets = filteredAssets.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function statusTag(status) {
    const map = {
      operational: 'fd-status-tag--passed',
      fault: 'fd-status-tag--failed',
      pending: 'fd-status-tag--pending',
    }
    return map[(status || '').toLowerCase()] || 'fd-status-tag--pending'
  }

  if (loading) return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'60vh', gap:12, color:'rgba(148,163,184,0.8)' }}>
      <span className="fd-spinner fd-spinner--lg" />
      <span style={{ fontSize:14, fontWeight:600 }}>Loading dashboard…</span>
    </div>
  )

  return (
    <div className="fd-subpage">

      {/* ── Page header ── */}
      <div style={{ marginBottom:24 }}>
        <h1 style={{ margin:'0 0 6px', fontSize:'clamp(1.4rem,3vw,1.8rem)', fontWeight:900, color:'rgba(235,242,255,0.97)', letterSpacing:'-0.025em' }}>
          Asset Inventory
        </h1>
        <p style={{ margin:0, fontSize:13, color:'rgba(148,163,184,0.72)', fontWeight:500 }}>
          Comprehensive registry of all fire hydrants across District 7
        </p>
      </div>

      {/* ── KPI Row ── */}
      <div className="fd-kpi-row" style={{ marginBottom:24 }}>
        {/* Total Assets */}
        <div className="fd-kpi-card">
          <p className="fd-kpi-label">TOTAL ASSETS</p>
          <p className="fd-kpi-value fd-kpi-value--blue">
            {totalAssets > 0 ? totalAssets.toLocaleString() : '—'}
          </p>
          {totalAssets > 0 && (
            <p className="fd-kpi-meta fd-kpi-meta--up">
              <CheckCircle size={12} /> Registered hydrants
            </p>
          )}
          {totalAssets === 0 && (
            <p className="fd-kpi-meta">No assets registered</p>
          )}
        </div>

        {/* Critical Faults */}
        <div className="fd-kpi-card">
          <p className="fd-kpi-label">CRITICAL FAULTS</p>
          <p className={`fd-kpi-value${criticalAlerts > 0 ? ' fd-kpi-value--red' : ''}`}>
            {assets.length > 0 ? criticalAlerts : '—'}
          </p>
          {criticalAlerts > 0 && (
            <p className="fd-kpi-meta fd-kpi-meta--danger">
              <AlertTriangle size={12} /> Immediate attention required
            </p>
          )}
          {criticalAlerts === 0 && assets.length > 0 && (
            <p className="fd-kpi-meta fd-kpi-meta--up"><CheckCircle size={12} /> No critical faults</p>
          )}
          {assets.length === 0 && <p className="fd-kpi-meta">No assets yet</p>}
        </div>

        {/* Avg Flow Rate */}
        <div className="fd-kpi-card">
          <p className="fd-kpi-label">AVG FLOW RATE</p>
          <p className="fd-kpi-value fd-kpi-value--green">
            {avgFlowRate ? `${avgFlowRate}k L/m` : '—'}
          </p>
          {avgFlowRate && (
            <p className="fd-kpi-meta fd-kpi-meta--up">
              <CheckCircle size={12} /> Average across all assets
            </p>
          )}
          {!avgFlowRate && <p className="fd-kpi-meta">No flow data available</p>}
        </div>
      </div>

      {/* ── Filter Section ── */}
      <div className="fd-card" style={{ marginBottom:24 }}>
        <div style={{ display:'flex', gap:12, flexWrap:'wrap', alignItems:'center' }}>
          <div className="fd-search-wrap" style={{ flex:1, minWidth:200 }}>
            <Search size={13} className="fd-search-icon" />
            <input
              type="text"
              className="fd-search-input"
              placeholder="Search by Asset ID or Serial..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1) }}
            />
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: '10px', fontWeight: 800, color: 'rgba(148, 163, 184, 0.7)', letterSpacing: '0.08em' }}>SECTOR</label>
            <CustomSelect
              value={sectorFilter}
              onChange={(val) => { setSectorFilter(val); setPage(1) }}
              options={['all', 'A', 'B', 'C']}
              placeholder="All Sectors"
              searchable={false}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: '10px', fontWeight: 800, color: 'rgba(148, 163, 184, 0.7)', letterSpacing: '0.08em' }}>STATUS</label>
            <CustomSelect
              value={statusFilter}
              onChange={(val) => { setStatusFilter(val); setPage(1) }}
              options={['all', 'operational', 'fault', 'pending']}
              placeholder="All Statuses"
              searchable={false}
            />
          </div>

          <button
            type="button"
            className="fd-btn fd-btn--ghost"
            onClick={() => setShowAdvancedFilters(true)}
          >
            <Filter size={14} /> Advanced Filters
          </button>
        </div>
      </div>

      {/* ── Asset Table ── */}
      <div className="fd-card" style={{ marginBottom:24 }}>
        <div className="fd-table-wrap">
          <table className="fd-table">
            <thead>
              <tr>
                <th>ASSET ID / SERIAL</th>
                <th>TYPE</th>
                <th>TELEMETRY / GPS</th>
                <th>LAST SERVICE</th>
                <th>FLOW PERFORMANCE</th>
                <th>STATUS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {paginatedAssets.map((asset) => (
                <tr key={asset.id}>
                  <td>
                    <div>
                      <div className="fd-asset-id">{asset.assetId || '—'}</div>
                      <div style={{ fontSize:11, color:'rgba(148,163,184,0.6)' }}>
                        SN:{asset.serialNumber || '—'}
                      </div>
                    </div>
                  </td>
                  <td style={{ fontWeight:600, color:'rgba(203,214,255,0.9)' }}>
                    {asset.type || '—'}
                  </td>
                  <td>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <MapPin size={12} style={{ color:'rgba(148,163,184,0.5)' }} />
                      <span style={{ fontSize:12, color:'rgba(148,163,184,0.8)' }}>
                        {asset.gps ? `${asset.gps.lat}° N, ${asset.gps.lng}° W` : '—'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize:12, color:'rgba(148,163,184,0.8)' }}>
                      {asset.lastServiceDate || '—'}
                      {asset.inspectorId && (
                        <div style={{ fontSize:10, color:'rgba(148,163,184,0.5)' }}>
                          Inspector #{asset.inspectorId}
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight:600, color:'rgba(22,201,136,0.9)' }}>
                      {asset.flowRate ? `${asset.flowRate.toLocaleString()} L/m` : '—'}
                    </div>
                    <div style={{ fontSize:11, color:'rgba(148,163,184,0.6)' }}>
                      {asset.flowPerformance ? `${asset.flowPerformance}%` : '—'}
                    </div>
                  </td>
                  <td>
                    <span className={`fd-status-tag ${statusTag(asset.status)}`}>
                      {(asset.status || '').toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="fd-btn fd-btn--ghost"
                      style={{ padding:'6px 12px', fontSize:11 }}
                      onClick={() => navigate(`/detection/assets/${asset.id}`)}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {paginatedAssets.length === 0 && (
          <div className="fd-empty">
            <Activity size={32} style={{ color:'rgba(148,163,184,0.2)', margin:'0 auto 12px', display:'block' }} />
            <p className="fd-empty-title">No assets found</p>
            <p className="fd-empty-sub">
              {searchTerm || sectorFilter !== 'all' || statusFilter !== 'all' 
                ? 'Try adjusting your filters.' 
                : 'Register your first asset to begin.'}
            </p>
          </div>
        )}

        {paginatedAssets.length > 0 && (
          <div className="fd-pagination">
            <span className="fd-pagination-info">
              Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filteredAssets.length)} of {filteredAssets.length} assets
            </span>
            <div className="fd-pagination-controls">
              <button type="button" className="fd-page-btn"
                disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft size={13} />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum
                if (totalPages <= 5) pageNum = i + 1
                else if (page <= 3) pageNum = i + 1
                else if (page >= totalPages - 2) pageNum = totalPages - 4 + i
                else pageNum = page - 2 + i
                return (
                  <button key={pageNum} type="button"
                    className={`fd-page-btn${page === pageNum ? ' fd-page-btn--active' : ''}`}
                    onClick={() => setPage(pageNum)}>
                    {pageNum}
                  </button>
                )
              })}
              <button type="button" className="fd-page-btn"
                disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom Info Cards ── */}
      <div className="fd-mid-row">
        {/* System Load */}
        <div className="fd-card">
          <div className="fd-card-head">
            <span className="fd-card-title" style={{ fontWeight:900 }}>SYSTEM LOAD</span>
          </div>
          <div style={{ padding:'16px 18px' }}>
            <p style={{ margin:0, fontSize:13, color:'rgba(148,163,184,0.8)', lineHeight:1.5 }}>
              {systemMetrics?.systemLoad || 'No system load data available'}
            </p>
          </div>
        </div>

        {/* ISO Certification */}
        <div className="fd-card">
          <div className="fd-card-head">
            <span className="fd-card-title" style={{ fontWeight:900 }}>ISO CERTIFICATION</span>
          </div>
          <div style={{ padding:'16px 18px' }}>
            <p style={{ margin:0, fontSize:13, color:'rgba(148,163,184,0.8)', lineHeight:1.5 }}>
              {systemMetrics?.isoCertification || 'No ISO certification data available'}
            </p>
          </div>
        </div>

        {/* Audit Logs */}
        <div className="fd-card">
          <div className="fd-card-head">
            <span className="fd-card-title" style={{ fontWeight:900 }}>AUDIT LOGS</span>
          </div>
          <div style={{ padding:'16px 18px' }}>
            <p style={{ margin:0, fontSize:13, color:'rgba(148,163,184,0.8)', lineHeight:1.5 }}>
              {systemMetrics?.auditLogs || 'No audit log data available'}
            </p>
          </div>
        </div>
      </div>

      {/* ── Advanced Filters Modal ── */}
      {showAdvancedFilters && (
        <div className="fd-modal-overlay" onClick={() => setShowAdvancedFilters(false)}>
          <div className="fd-modal" onClick={(e) => e.stopPropagation()}>
            <div className="fd-modal-title">
              <Filter size={18} />
              Advanced Filters
              <button
                type="button"
                className="fd-modal-close"
                onClick={() => setShowAdvancedFilters(false)}
              >
                ✕
              </button>
            </div>
            <div className="fd-reg-body">
              <div className="fd-reg-row2">
                <CustomDatePicker label="Start Date" placeholder="Select start date" />
                <CustomDatePicker label="End Date" placeholder="Select end date" />
              </div>
              <div className="fd-reg-field" style={{ marginTop:16 }}>
                <label className="fd-reg-label">Flow Rate Range (L/m)</label>
                <div className="fd-reg-row2">
                  <input type="number" placeholder="Min" className="fd-form-input" />
                  <input type="number" placeholder="Max" className="fd-form-input" />
                </div>
              </div>
              <div className="fd-reg-field">
                <label className="fd-reg-label">Zone</label>
                <CustomSelect
                  value=""
                  onChange={() => {}}
                  options={['', 'A', 'B', 'C']}
                  placeholder="All Zones"
                  searchable={false}
                />
              </div>
            </div>
            <div className="fd-modal-actions">
              <button
                type="button"
                className="fd-btn fd-btn--ghost"
                onClick={() => setShowAdvancedFilters(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="fd-btn fd-btn--primary"
                onClick={() => setShowAdvancedFilters(false)}
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
