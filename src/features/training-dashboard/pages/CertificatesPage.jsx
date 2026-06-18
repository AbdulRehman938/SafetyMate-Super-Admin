import React, { useMemo, useState, useRef, useEffect } from 'react'
import {
  Plus,
  TrendingUp,
  AlertTriangle,
  SlidersHorizontal,
  ArrowUpDown,
  MoreVertical,
  Calendar,
} from 'lucide-react'
import { IssueCertificatePage } from './IssueCertificatePage.jsx'

const PAGE_SIZE = 5

const ISSUING_BODY_MAP = [
  { match: /fire/i, body: 'National Fire Inst.' },
  { match: /first aid/i, body: 'Red Cross Corp.' },
  { match: /confined space/i, body: 'OSHA Alliance' },
  { match: /height/i, body: 'Global Safety Org' },
  { match: /chemical|hazmat/i, body: 'Industrial Board' },
  { match: /osha/i, body: 'OSHA Alliance' },
]

function initials(name) {
  return (name || '')
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

function getAvatarColor(name) {
  const colors = ['blue', 'teal', 'purple', 'orange', 'default']
  let hash = 0
  for (let i = 0; i < (name || '').length; i++) {
    hash = (name || '').charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

function parseExpiryDate(expiryStr) {
  if (!expiryStr || expiryStr === '—') return null
  const isoMatch = expiryStr.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) return new Date(`${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}T00:00:00`)
  const parsed = new Date(expiryStr)
  return isNaN(parsed.getTime()) ? null : parsed
}

function formatExpiryDate(date) {
  if (!date) return '—'
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getIssuingBody(course) {
  const match = ISSUING_BODY_MAP.find((entry) => entry.match.test(course || ''))
  return match?.body || 'SafetyMate Certified'
}

function getCertStatus(expiryDate) {
  if (!expiryDate) return 'COMPLIANT'
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const threshold = new Date(now)
  threshold.setDate(threshold.getDate() + 30)
  const exp = new Date(expiryDate)
  exp.setHours(0, 0, 0, 0)
  if (exp < now) return 'EXPIRED'
  if (exp <= threshold) return 'EXPIRING SOON'
  return 'COMPLIANT'
}

function enrichCertificate(cert) {
  const expiryDate = parseExpiryDate(cert.expiry)
  const status = getCertStatus(expiryDate)
  return {
    ...cert,
    expiryDate,
    expiryFormatted: formatExpiryDate(expiryDate),
    status,
    issuingBody: cert.issuingBody || getIssuingBody(cert.course),
  }
}

function getStatusPillClass(status) {
  if (status === 'EXPIRED') return 'prov-cert-status-pill--expired'
  if (status === 'EXPIRING SOON') return 'prov-cert-status-pill--expiring'
  return 'prov-cert-status-pill--compliant'
}

function getExpiryClass(status) {
  if (status === 'EXPIRED') return 'prov-cert-expiry--expired'
  if (status === 'EXPIRING SOON') return 'prov-cert-expiry--expiring'
  return ''
}

export function CertificatesPage({ competencies = [], employees = [], organizations = [], onIssue }) {
  const [isIssuingNew, setIsIssuingNew] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [statusFilter, setStatusFilter] = useState('All')
  const [courseFilter, setCourseFilter] = useState('All')
  const [sortBy, setSortBy] = useState('expiry-asc')
  const [currentPage, setCurrentPage] = useState(1)
  const [openActionId, setOpenActionId] = useState(null)
  const [selectedCert, setSelectedCert] = useState(null)

  const sortRef = useRef(null)
  const actionRef = useRef(null)

  const enriched = useMemo(
    () => competencies.map(enrichCertificate),
    [competencies]
  )

  const availableCourses = useMemo(
    () => Array.from(new Set(enriched.map((c) => c.course).filter(Boolean))).sort(),
    [enriched]
  )

  const filtered = useMemo(() => {
    let list = [...enriched]
    if (statusFilter !== 'All') {
      list = list.filter((c) => c.status === statusFilter)
    }
    if (courseFilter !== 'All') {
      list = list.filter((c) => c.course === courseFilter)
    }
    list.sort((a, b) => {
      switch (sortBy) {
        case 'name-asc':
          return (a.name || '').localeCompare(b.name || '')
        case 'name-desc':
          return (b.name || '').localeCompare(a.name || '')
        case 'course-asc':
          return (a.course || '').localeCompare(b.course || '')
        case 'expiry-desc':
          return (b.expiryDate?.getTime() || 0) - (a.expiryDate?.getTime() || 0)
        case 'expiry-asc':
        default:
          return (a.expiryDate?.getTime() || Infinity) - (b.expiryDate?.getTime() || Infinity)
      }
    })
    return list
  }, [enriched, statusFilter, courseFilter, sortBy])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const compliantCount = enriched.filter((c) => c.status === 'COMPLIANT').length
  const complianceRate = enriched.length > 0
    ? ((compliantCount / enriched.length) * 100).toFixed(1)
    : '0.0'
  const pendingExpiryCount = enriched.filter((c) => c.status === 'EXPIRING SOON').length

  const forecastData = useMemo(() => {
    const now = new Date()
    const months = []
    for (let i = 0; i < 5; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
      months.push({
        label: d.toLocaleString('en-US', { month: 'short' }),
        count: 0,
        isCurrent: i === 0,
      })
    }
    enriched.forEach((cert) => {
      if (!cert.expiryDate) return
      const diffMonths =
        (cert.expiryDate.getFullYear() - now.getFullYear()) * 12 +
        (cert.expiryDate.getMonth() - now.getMonth())
      if (diffMonths >= 0 && diffMonths < 5) {
        months[diffMonths].count += 1
      }
    })
    const maxCount = Math.max(...months.map((m) => m.count), 1)
    return months.map((m) => ({ ...m, heightPct: (m.count / maxCount) * 100 }))
  }, [enriched])

  useEffect(() => {
    setCurrentPage(1)
  }, [statusFilter, courseFilter, sortBy])

  useEffect(() => {
    function handleClickOutside(e) {
      if (sortRef.current && !sortRef.current.contains(e.target)) {
        setShowSortMenu(false)
      }
      if (actionRef.current && !actionRef.current.contains(e.target)) {
        setOpenActionId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const sortLabels = {
    'expiry-asc': 'Expiry Date (Earliest)',
    'expiry-desc': 'Expiry Date (Latest)',
    'name-asc': 'Employee Name (A–Z)',
    'name-desc': 'Employee Name (Z–A)',
    'course-asc': 'Certificate Name (A–Z)',
  }

  if (isIssuingNew) {
    return (
      <IssueCertificatePage
        onCancel={() => setIsIssuingNew(false)}
        employees={employees}
        organizations={organizations}
        onIssue={onIssue}
      />
    )
  }

  return (
    <section className="prov-subpage prov-cert-page">
      {/* Header + KPI row */}
      <div className="prov-cert-header-row">
        <div className="prov-cert-header-left">
          <h1 className="prov-subpage-title" style={{ fontSize: '2rem', marginBottom: '6px' }}>
            Certificate Management
          </h1>
          <p className="prov-subpage-sub" style={{ maxWidth: '520px', lineHeight: 1.5 }}>
            Real-time tracking of workforce credentials and compliance readiness across all operational sectors.
          </p>
          <button
            type="button"
            className="prov-cert-issue-btn"
            onClick={() => setIsIssuingNew(true)}
          >
            <Plus size={15} />
            Issue New
          </button>
        </div>

        <div className="prov-cert-kpi-row">
          <div className="prov-cert-kpi-card">
            <div className="prov-cert-kpi-top">
              <span className="prov-cert-kpi-label">Compliance Rate</span>
              <span className="prov-cert-kpi-icon prov-cert-kpi-icon--green">
                <TrendingUp size={14} />
              </span>
            </div>
            <p className="prov-cert-kpi-value">{complianceRate}%</p>
            <div className="prov-cert-kpi-bar">
              <div
                className="prov-cert-kpi-bar-fill prov-cert-kpi-bar-fill--green"
                style={{ width: `${Math.min(parseFloat(complianceRate), 100)}%` }}
              />
            </div>
          </div>

          <div className="prov-cert-kpi-card">
            <div className="prov-cert-kpi-top">
              <span className="prov-cert-kpi-label">Pending Expiry</span>
              <span className="prov-cert-kpi-icon prov-cert-kpi-icon--orange">
                <AlertTriangle size={14} />
              </span>
            </div>
            <p className="prov-cert-kpi-value">{pendingExpiryCount}</p>
            <p className="prov-cert-kpi-meta">Required action in 30 days</p>
          </div>
        </div>
      </div>

      {/* Active Workforce Credentials table */}
      <div className="prov-section-card prov-cert-table-card">
        <div className="prov-section-head">
          <h2>Active Workforce Credentials</h2>
          <div className="prov-section-head-right">
            <div className="prov-filters-panel-wrapper">
              <button
                type="button"
                className={`prov-btn-filters ${showFilters ? 'prov-icon-btn--active' : ''}`}
                onClick={() => setShowFilters(!showFilters)}
              >
                <SlidersHorizontal size={13} />
                Filter
              </button>
              {showFilters && (
                <div className="prov-filters-panel prov-cert-filters-panel">
                  <div className="prov-filter-group">
                    <label className="prov-filter-label">Status</label>
                    <select
                      className="prov-filter-select"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      <option value="All">All Statuses</option>
                      <option value="COMPLIANT">Compliant</option>
                      <option value="EXPIRING SOON">Expiring Soon</option>
                      <option value="EXPIRED">Expired</option>
                    </select>
                  </div>
                  <div className="prov-filter-group">
                    <label className="prov-filter-label">Certificate</label>
                    <select
                      className="prov-filter-select"
                      value={courseFilter}
                      onChange={(e) => setCourseFilter(e.target.value)}
                    >
                      <option value="All">All Certificates</option>
                      {availableCourses.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  {(statusFilter !== 'All' || courseFilter !== 'All') && (
                    <button
                      type="button"
                      className="prov-filter-reset-btn"
                      onClick={() => {
                        setStatusFilter('All')
                        setCourseFilter('All')
                      }}
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="prov-cert-sort-wrapper" ref={sortRef}>
              <button
                type="button"
                className={`prov-btn-filters ${showSortMenu ? 'prov-icon-btn--active' : ''}`}
                onClick={() => setShowSortMenu(!showSortMenu)}
              >
                <ArrowUpDown size={13} />
                Sort By
              </button>
              {showSortMenu && (
                <div className="prov-cert-sort-menu">
                  {Object.entries(sortLabels).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      className={`prov-cert-sort-option ${sortBy === key ? 'prov-cert-sort-option--active' : ''}`}
                      onClick={() => {
                        setSortBy(key)
                        setShowSortMenu(false)
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="prov-empty-state" style={{ padding: '48px 20px' }}>
            <div className="prov-empty-icon">📄</div>
            <p className="prov-empty-title">No certificates found</p>
            <p className="prov-empty-sub">
              {statusFilter !== 'All' || courseFilter !== 'All'
                ? 'No certificates match your current filters.'
                : 'Issue a new certificate or upload from Overview to populate this list.'}
            </p>
          </div>
        ) : (
          <>
            <div className="prov-cert-table-headers">
              <div>Employee Name</div>
              <div>Certificate Name</div>
              <div>Issuing Body</div>
              <div>Expiry Date</div>
              <div>Status</div>
              <div style={{ textAlign: 'right' }}>Action</div>
            </div>

            {paginated.map((cert) => (
              <div key={cert.id} className="prov-cert-table-row">
                <div className="prov-company-cell">
                  <div className={`prov-company-badge prov-company-badge--${getAvatarColor(cert.name)}`}>
                    {initials(cert.name)}
                  </div>
                  <div className="prov-company-info">
                    <span className="prov-company-name">{cert.name}</span>
                  </div>
                </div>
                <div className="prov-cert-cell">{cert.course}</div>
                <div className="prov-cert-cell prov-cert-cell--muted">{cert.issuingBody}</div>
                <div className={`prov-cert-cell prov-cert-expiry ${getExpiryClass(cert.status)}`}>
                  {cert.expiryFormatted}
                </div>
                <div>
                  <span className={`prov-cert-status-pill ${getStatusPillClass(cert.status)}`}>
                    <span className="prov-cert-status-dot" />
                    {cert.status}
                  </span>
                </div>
                <div className="prov-cert-action-cell" ref={openActionId === cert.id ? actionRef : null}>
                  <button
                    type="button"
                    className="prov-cert-action-btn"
                    aria-label={`Actions for ${cert.name}`}
                    onClick={() => setOpenActionId(openActionId === cert.id ? null : cert.id)}
                  >
                    <MoreVertical size={16} />
                  </button>
                  {openActionId === cert.id && (
                    <div className="prov-cert-action-menu">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCert(cert)
                          setOpenActionId(null)
                        }}
                      >
                        View Details
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setOpenActionId(null)
                        }}
                      >
                        Download PDF
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            <div className="prov-cert-table-footer">
              <span className="prov-cert-footer-count">
                Showing {paginated.length} of {filtered.length} certificate{filtered.length !== 1 ? 's' : ''}
              </span>
              <div className="prov-cert-pagination">
                <button
                  type="button"
                  className="prov-cert-page-link"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="prov-cert-page-next"
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Expiry Forecast */}
      <div className="prov-section-card prov-cert-forecast-card">
        <div className="prov-cert-forecast-head">
          <span className="prov-cert-forecast-icon">
            <Calendar size={14} />
          </span>
          <h3>Expiry Forecast</h3>
        </div>
        <div className="prov-cert-forecast-chart">
          {forecastData.map((bar) => (
            <div key={bar.label} className="prov-cert-forecast-bar-col">
              <div
                className={`prov-cert-forecast-bar ${bar.isCurrent ? 'prov-cert-forecast-bar--active' : ''}`}
                style={{ height: `${Math.max(bar.heightPct, 8)}%` }}
                title={`${bar.count} renewal${bar.count !== 1 ? 's' : ''}`}
              />
              <span className="prov-cert-forecast-label">{bar.label}</span>
            </div>
          ))}
        </div>
        <p className="prov-cert-forecast-sub">Predicted renewals for next 5 months</p>
      </div>

      {/* View Details modal */}
      {selectedCert && (
        <div className="prov-cert-detail-overlay" onClick={() => setSelectedCert(null)}>
          <div className="prov-cert-detail-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{selectedCert.course}</h3>
            <p className="prov-cert-detail-sub">{selectedCert.name}</p>
            <dl className="prov-cert-detail-list">
              <div>
                <dt>Issuing Body</dt>
                <dd>{selectedCert.issuingBody}</dd>
              </div>
              <div>
                <dt>Expiry Date</dt>
                <dd className={getExpiryClass(selectedCert.status)}>{selectedCert.expiryFormatted}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  <span className={`prov-cert-status-pill ${getStatusPillClass(selectedCert.status)}`}>
                    <span className="prov-cert-status-dot" />
                    {selectedCert.status}
                  </span>
                </dd>
              </div>
            </dl>
            <button type="button" className="prov-cert-detail-close" onClick={() => setSelectedCert(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
