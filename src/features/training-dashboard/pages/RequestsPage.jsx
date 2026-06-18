import React, { useState } from 'react'
import { SlidersHorizontal, Search, Check, X, Eye } from 'lucide-react'
import { CourseIcon } from '../components/CourseIcon.jsx'

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
}) {
  const isAllSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedRequests.includes(id))

  const handleResetFilters = () => {
    setMinWorkers('')
    setSelectedCourseFilter('All')
  }

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
          
          {/* Filters Button & Slide-down Dropdown panel */}
          <div className="prov-filters-panel-wrapper">
            <button
              type="button"
              className={`prov-btn-filters ${showFilterPanel ? 'prov-icon-btn--active' : ''}`}
              onClick={() => setShowFilterPanel(!showFilterPanel)}
            >
              <SlidersHorizontal size={13} />
              Filters
            </button>
            
            {showFilterPanel && (
              <div className="prov-filters-panel">
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
            {requests.map((req) => {
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

                  {/* Status */}
                  <div className="prov-status-cell">
                    <span className={`prov-status-pill prov-status-pill--${req.status}`}>
                      {req.status}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="prov-actions-cell" style={{ justifyContent: 'flex-end' }}>
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
                      <span style={{ fontSize: '11px', color: '#4deba0', fontWeight: '700' }}>✓ APPROVED</span>
                    )}
                    {req.status === 'completed' && (
                      <button
                        type="button"
                        className="prov-action-btn-circle prov-action-btn-circle--view"
                        title="View Certificate Details"
                        aria-label="View details"
                      >
                        <Eye size={13} />
                      </button>
                    )}
                    {req.status === 'rejected' && (
                      <span style={{ fontSize: '11px', color: '#f87171', fontWeight: '700' }}>✕ REJECTED</span>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Bottom pagination */}
            <div className="prov-pagination-row">
              <span className="prov-pagination-info">
                Showing {requests.length} of {requests.length} global requests
              </span>
              <div className="prov-pagination-controls">
                <button type="button" className="prov-page-btn" disabled>&lt;</button>
                <button type="button" className="prov-page-btn prov-page-btn--active">1</button>
                <button type="button" className="prov-page-btn" disabled>2</button>
                <button type="button" className="prov-page-btn" disabled>3</button>
                <button type="button" className="prov-page-btn" disabled>&gt;</button>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
