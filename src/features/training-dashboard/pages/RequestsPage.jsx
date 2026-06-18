import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { SlidersHorizontal, Search, Check, X, Eye } from 'lucide-react'
import { CourseIcon } from '../components/CourseIcon.jsx'

/* ── Mobile filter bottom sheet rendered via portal ──────────────── */
function FilterSheet({ open, onClose, children }) {
  // Close on backdrop click
  if (!open) return null
  return createPortal(
    <div className="req-filter-sheet-backdrop" onClick={onClose}>
      <div
        className="req-filter-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="req-filter-sheet-handle" />
        <div className="req-filter-sheet-header">
          <span className="req-filter-sheet-title">Filters</span>
          <button type="button" className="req-filter-sheet-close" onClick={onClose} aria-label="Close filters">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  )
}

function initials(name) {
  return (name || '')
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

function getBadgeColorClass(companyName) {
  const colors = ['blue', 'teal', 'purple', 'orange']
  const name = companyName || ''
  if (!name) return 'default'
  const hash = name.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  return colors[hash % colors.length]
}

export function RequestsPage({
  requests,
  onAccept,
  onReject,
  onBulkApprove,
  onBulkReject,
  searchQuery,
  setSearchQuery,
  showSearch,
  setShowSearch,
  filterTab,
  setFilterTab,
  selectedRequests,
  onToggleSelect,
  onToggleSelectAll,
  allFilteredIds,
  minWorkers,
  setMinWorkers,
  selectedCourseFilter,
  setSelectedCourseFilter,
  showFilterPanel,
  setShowFilterPanel,
  availableCourses = [],
  competencies = [],
  organizations = [],
}) {
  const [currentPage, setCurrentPage] = useState(1)
  const [viewingCertRequest, setViewingCertRequest] = useState(null)
  const PAGE_SIZE = 8

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, filterTab, minWorkers, selectedCourseFilter])

  const isAllSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedRequests.includes(id))

  const handleResetFilters = () => {
    setMinWorkers('')
    setSelectedCourseFilter('All')
  }

  const totalPages = Math.max(1, Math.ceil(requests.length / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const paginatedRequests = requests.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  return (
    <section className="prov-subpage">
      {/* Header matching screenshot hierarchy */}
      <div className="prov-subpage-header">
        <p style={{ fontSize: '11px', fontWeight: '800', letterSpacing: '0.1em', color: '#3a82ff', textTransform: 'uppercase', marginBottom: '4px' }}>
          Operation Control
        </p>
        <h1 className="prov-subpage-title" style={{ fontSize: '2rem' }}>Training Requests</h1>
      </div>

      {/* Filter Tabs and Controls row */}
      <div className="prov-controls-row">
        <div className="prov-filter-tabs">
          {['All', 'Pending', 'Approved', 'Completed', 'Rejected'].map((tab) => (
            <button
              key={tab}
              type="button"
              className={`prov-filter-tab ${filterTab === tab ? 'prov-filter-tab--active' : ''}${tab === 'Rejected' ? ' prov-filter-tab--rejected' : ''}`}
              onClick={() => setFilterTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
        
        <div className="prov-section-head-right">
          {showSearch && (
            <input
              type="text"
              placeholder="Search requests..."
              className="prov-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          )}
          <button
            type="button"
            className={`prov-icon-btn ${showSearch ? 'prov-icon-btn--active' : ''}`}
            onClick={() => {
              setShowSearch(!showSearch)
              if (showSearch) setSearchQuery('')
            }}
            aria-label="Search"
          >
            <Search size={14} />
          </button>
          
          {/* Filters Button + portal bottom sheet */}
          <div className="prov-filters-panel-wrapper">
            <button
              type="button"
              className={`prov-btn-filters ${showFilterPanel ? 'prov-icon-btn--active' : ''}`}
              onClick={() => setShowFilterPanel(!showFilterPanel)}
            >
              <SlidersHorizontal size={13} />
              Filters
            </button>

            {/* Desktop: inline dropdown */}
            {showFilterPanel && (
              <div className="prov-filters-panel req-filter-desktop-panel">
                <div className="prov-filter-group">
                  <label className="prov-filter-label">Competency Course</label>
                  <select
                    className="prov-filter-select"
                    value={selectedCourseFilter}
                    onChange={(e) => setSelectedCourseFilter(e.target.value)}
                  >
                    <option value="All">All Courses</option>
                    {availableCourses.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="prov-filter-group">
                  <label className="prov-filter-label">Min Worker Count</label>
                  <input
                    type="number"
                    className="prov-filter-input"
                    placeholder="e.g. 10"
                    value={minWorkers}
                    onChange={(e) => setMinWorkers(e.target.value)}
                  />
                </div>
                {(minWorkers || selectedCourseFilter !== 'All') && (
                  <button type="button" className="prov-filter-reset-btn" onClick={handleResetFilters}>
                    Clear Filters
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Mobile: portal bottom sheet */}
          <FilterSheet open={showFilterPanel} onClose={() => setShowFilterPanel(false)}>
            <div className="req-filter-sheet-body">
              <div className="prov-filter-group">
                <label className="prov-filter-label">Competency Course</label>
                <select
                  className="req-filter-sheet-select"
                  value={selectedCourseFilter}
                  onChange={(e) => setSelectedCourseFilter(e.target.value)}
                >
                  <option value="All">All Courses</option>
                  {availableCourses.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="prov-filter-group">
                <label className="prov-filter-label">Min Worker Count</label>
                <input
                  type="number"
                  className="req-filter-sheet-input"
                  placeholder="e.g. 10"
                  value={minWorkers}
                  onChange={(e) => setMinWorkers(e.target.value)}
                />
              </div>
              <div className="req-filter-sheet-actions">
                {(minWorkers || selectedCourseFilter !== 'All') && (
                  <button
                    type="button"
                    className="req-filter-sheet-clear"
                    onClick={() => { handleResetFilters(); setShowFilterPanel(false) }}
                  >
                    Clear Filters
                  </button>
                )}
                <button
                  type="button"
                  className="req-filter-sheet-apply"
                  onClick={() => setShowFilterPanel(false)}
                >
                  Apply
                </button>
              </div>
            </div>
          </FilterSheet>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedRequests.length > 0 && (
        <div className="prov-bulk-bar">
          <span className="prov-bulk-info">
            {selectedRequests.length} request{selectedRequests.length > 1 ? 's' : ''} selected
          </span>
          <div className="prov-bulk-actions">
            <button type="button" className="prov-btn-bulk-approve" onClick={onBulkApprove}>
              Approve Selected
            </button>
            <button type="button" className="prov-btn-bulk-reject" onClick={onBulkReject}>
              Reject Selected
            </button>
          </div>
        </div>
      )}

      {/* Card Row Grid List */}
      <div style={{ marginTop: '16px' }}>
        {requests.length === 0 ? (
          <div className="prov-section-card">
            <div className="prov-empty-state">
              <div className="prov-empty-icon">📋</div>
              <p className="prov-empty-title">No requests found</p>
              <p className="prov-empty-sub">
                {searchQuery || minWorkers || selectedCourseFilter !== 'All'
                  ? 'No training requests match your search or filters.'
                  : 'All clear! No pending training requests are currently registered.'}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Headers row */}
            <div className="prov-req-headers">
              <div className="prov-checkbox-cell">
                <input
                  type="checkbox"
                  className="prov-checkbox"
                  checked={isAllSelected}
                  onChange={onToggleSelectAll}
                  aria-label="Select All"
                />
              </div>
              <div>Client Company & Details</div>
              <div>Requested Course</div>
              <div>Workers</div>
              <div>Preferred Dates</div>
              <div>Status</div>
              <div style={{ textAlign: 'right' }}>Actions</div>
            </div>

            {/* Data rows */}
            {paginatedRequests.map((req) => {
              const badgeColor = getBadgeColorClass(req.company)
              const isChecked = selectedRequests.includes(req.id)

              return (
                <div key={req.id} className="prov-req-row-card">
                  {/* Checkbox column */}
                  <div className="prov-checkbox-cell">
                    <input
                      type="checkbox"
                      className="prov-checkbox"
                      checked={isChecked}
                      onChange={() => onToggleSelect(req.id)}
                      aria-label={`Select request from ${req.company}`}
                    />
                  </div>

                  {/* Company Badge and Details */}
                  <div className="prov-company-cell">
                    <div className={`prov-company-badge prov-company-badge--${badgeColor}`}>
                      {initials(req.company)}
                    </div>
                    <div className="prov-company-info">
                      <span className="prov-company-name">{req.company}</span>
                      <span className="prov-company-req-id">Req ID: {req.reqId || '#TQ-00000'}</span>
                    </div>
                  </div>

                  {/* Requested Course */}
                  <div className="prov-course-cell">
                    <CourseIcon courseName={req.course} />
                    <span>{req.course}</span>
                  </div>

                  {/* Workers */}
                  <div className="prov-workers-cell">
                    {String(req.workers).padStart(2, '0')}
                  </div>

                  {/* Dates */}
                  <div className="prov-dates-cell">
                    <span className="prov-dates-primary">{req.preferredDate}</span>
                    <span className="prov-dates-sub">{req.timeDetail || 'TBD'}</span>
                  </div>

                  {/* Status — desktop only; on mobile shown in footer row */}
                  <div className="prov-status-cell">
                    <span className={`prov-status-pill prov-status-pill--${req.status}`}>
                      {req.status}
                    </span>
                  </div>

                  {/* Actions footer — also shows status on mobile */}
                  <div className="prov-actions-cell prov-actions-cell--right">
                    {/* Status pill shown only on mobile (desktop uses prov-status-cell) */}
                    <span className={`prov-status-pill prov-status-pill--${req.status} prov-card-status-mobile`}>
                      {req.status}
                    </span>

                    <div className="prov-card-actions-right">
                      {req.status === 'pending' && (
                        <>
                          <button
                            type="button"
                            className="prov-action-btn-circle prov-action-btn-circle--approve"
                            onClick={() => onAccept(req.id)}
                            title="Approve"
                            aria-label="Approve"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            type="button"
                            className="prov-action-btn-circle prov-action-btn-circle--reject"
                            onClick={() => onReject(req.id)}
                            title="Reject"
                            aria-label="Reject"
                          >
                            <X size={14} />
                          </button>
                        </>
                      )}
                      {(req.status === 'approved' || req.status === 'accepted') && (
                        <span className="prov-status-text prov-status-text--approved">✓ Approved</span>
                      )}
                      {req.status === 'completed' && (
                        <button
                          type="button"
                          className="prov-action-btn-circle prov-action-btn-circle--view"
                          onClick={() => setViewingCertRequest(req)}
                          title="View Certificate Details"
                          aria-label="View details"
                        >
                          <Eye size={13} />
                        </button>
                      )}
                      {req.status === 'rejected' && (
                        <span className="prov-status-text prov-status-text--rejected">✕ Rejected</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Bottom pagination */}
            <div className="prov-pagination-row">
              <span className="prov-pagination-info">
                Showing {requests.length > 0 ? (safePage - 1) * PAGE_SIZE + 1 : 0}–{Math.min(safePage * PAGE_SIZE, requests.length)} of {requests.length} global requests
              </span>
              <div className="prov-pagination-controls">
                <button
                  type="button"
                  className="prov-page-btn"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                >
                  &lt;
                </button>
                {Array.from({ length: totalPages }).map((_, idx) => {
                  const pageNum = idx + 1
                  return (
                    <button
                      key={pageNum}
                      type="button"
                      className={`prov-page-btn ${safePage === pageNum ? 'prov-page-btn--active' : ''}`}
                      onClick={() => setCurrentPage(pageNum)}
                    >
                      {pageNum}
                    </button>
                  )
                })}
                <button
                  type="button"
                  className="prov-page-btn"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                >
                  &gt;
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Completed Request Certificates Modal */}
      {viewingCertRequest && (
        <div className="prov-modal-overlay" onClick={() => setViewingCertRequest(null)}>
          <div className="prov-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '12px' }}>
              <h3 className="prov-modal-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Eye size={18} style={{ color: '#3b82f6' }} />
                Issued Certificates
              </h3>
              <button
                type="button"
                onClick={() => setViewingCertRequest(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <p style={{ margin: '0 0 4px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(148, 163, 184, 0.65)', fontWeight: 800 }}>Course</p>
              <h4 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: 800, color: '#fff' }}>{viewingCertRequest.course}</h4>
              
              <p style={{ margin: '0 0 4px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(148, 163, 184, 0.65)', fontWeight: 800 }}>Client Organization</p>
              <h4 style={{ margin: '0', fontSize: '14px', fontWeight: 700, color: '#3b82f6' }}>{viewingCertRequest.company}</h4>
            </div>

            <div className="prov-modal-desc" style={{ marginBottom: '16px', fontSize: '13px', color: 'rgba(255, 255, 255, 0.7)' }}>
              Below is the list of safety competency certificates issued for this completed session.
            </div>

            <div style={{ maxHeight: '250px', overflowY: 'auto', background: 'rgba(0, 0, 0, 0.2)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              {(() => {
                const org = organizations.find(o => 
                  (o.name || o.companyName || o.organizationName || '').toLowerCase().trim() === viewingCertRequest.company.toLowerCase().trim()
                )
                
                const matchedCerts = competencies.filter(cert => {
                  const courseMatches = cert.course.toLowerCase().trim() === viewingCertRequest.course.toLowerCase().trim()
                  const orgMatches = org && cert.organizationId === org.id
                  
                  const cleanRequestOrgId = viewingCertRequest.clientId.replace(/Client ID:\s*#?/i, '').trim()
                  const cleanCertOrgId = cert.organizationId.trim()
                  const orgIdMatches = cleanRequestOrgId && cleanCertOrgId && cleanCertOrgId.toLowerCase().startsWith(cleanRequestOrgId.toLowerCase())
                  
                  return courseMatches && (orgMatches || orgIdMatches)
                })

                if (matchedCerts.length === 0) {
                  return (
                    <div style={{ padding: '24px 16px', textAlign: 'center', color: 'rgba(148, 163, 184, 0.6)' }}>
                      No certificates registered in Firestore for this course/client yet.
                    </div>
                  )
                }

                return matchedCerts.map((cert) => (
                  <div
                    key={cert.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 16px',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, color: '#fff', fontSize: '13px' }}>{cert.name}</div>
                      <div style={{ fontSize: '11px', color: 'rgba(148, 163, 184, 0.6)', marginTop: '2px' }}>
                        Registered: {new Date(cert.registeredAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className="prov-cert-status-pill prov-cert-status-pill--compliant" style={{ padding: '3px 8px', fontSize: '10px' }}>
                        {cert.expiry ? `Expires: ${cert.expiry}` : 'No Expiry'}
                      </span>
                    </div>
                  </div>
                ))
              })()}
            </div>

            <div className="prov-modal-actions" style={{ marginTop: '20px' }}>
              <button
                type="button"
                className="prov-modal-btn-confirm"
                onClick={() => setViewingCertRequest(null)}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
