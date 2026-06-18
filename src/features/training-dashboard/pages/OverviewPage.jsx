import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, Search, Check, X } from 'lucide-react'
import { CourseIcon } from '../components/CourseIcon.jsx'
import { OcrUploadPanel } from '../components/OcrUploadPanel.jsx'
import { ConfirmationModal } from '../components/ConfirmationModal.jsx'
import { countCoursesToday, getUpcomingSessions } from '../utils/trainingDates.js'

function getMonthAbbr(d) {
  return d.toLocaleString('en-US', { month: 'short' }).toUpperCase()
}
function getDayNum(d) {
  return d.getDate()
}
function initials(name) {
  return (name || '')
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

const BADGE_COLORS = ['blue', 'teal', 'purple', 'orange']

function getBadgeColorClass(companyName) {
  const name = companyName || ''
  if (!name) return 'default'
  const hash = name.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  return BADGE_COLORS[hash % BADGE_COLORS.length]
}

export function OverviewPage({
  requests,
  competencies,
  employees,
  organizations,
  onAccept,
  onReject,
  onConfirmRegistration,
}) {
  const navigate = useNavigate()
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // ── Confirmation Modal State ─────────────────────────────
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [pendingRegistration, setPendingRegistration] = useState(null)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [confirmError, setConfirmError] = useState(null)

  const totalEnrollments = requests
    .filter((r) => r.status === 'approved' || r.status === 'accepted')
    .reduce((acc, r) => acc + (r.workers || 0), 0)

  const pendingCount = requests.filter((r) => r.status === 'pending').length

  const upcomingCourses = getUpcomingSessions(requests, 48)
  const coursesToday = countCoursesToday(requests)

  function handleOcrConfirm(extracted) {
    if (!extracted?.file) {
      console.error('OCR confirm rejected: missing file attachment')
      return
    }
    setConfirmError(null)
    setPendingRegistration(extracted)
    setConfirmModalOpen(true)
  }

  async function handleConfirmRegistration() {
    if (!pendingRegistration?.file) {
      setConfirmError('Certificate file is missing. Please upload again.')
      return
    }
    setConfirmLoading(true)
    setConfirmError(null)
    try {
      await onConfirmRegistration(pendingRegistration)
      setConfirmModalOpen(false)
      setPendingRegistration(null)
    } catch (err) {
      console.error('Registration confirmation failed:', err)
      setConfirmError(err.message || 'Registration failed. Please try again.')
    } finally {
      setConfirmLoading(false)
    }
  }

  const displayedRequests = requests
    .filter((r) => {
      if (r.status !== 'pending') return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        return (
          r.company?.toLowerCase().includes(q) ||
          r.clientId?.toLowerCase().includes(q) ||
          r.course?.toLowerCase().includes(q) ||
          r.reqId?.toLowerCase().includes(q)
        )
      }
      return true
    })
    .slice(0, 5)

  return (
    <div className="provider-dash">
      {/* Header */}
      <header className="provider-dash-header">
        <h1 className="provider-dash-title">Provider Command Center</h1>
        <p className="provider-dash-sub">SafetyMate high-security training and certification hub.</p>
      </header>

      {/* Stats Row */}
      <div className="provider-stats-row">
        <div className="prov-stat-card">
          <p className="prov-stat-label">Total Enrollments</p>
          <p className="prov-stat-value">{totalEnrollments.toLocaleString()}</p>
          <p className="prov-stat-meta">Workers enrolled across accepted requests</p>
        </div>

        <div className="prov-stat-card">
          <p className="prov-stat-label">Pending Confirmations</p>
          <p className="prov-stat-value">{pendingCount}</p>
          <p className="prov-stat-meta" style={{ color: pendingCount > 0 ? '#ffb56e' : undefined }}>
            {pendingCount > 0 ? 'Action Required' : 'All clear'}
          </p>
        </div>

        <div className="prov-stat-card">
          <p className="prov-stat-label">Courses Today</p>
          <p className="prov-stat-value">{coursesToday}</p>
          <p className="prov-stat-meta">
            {coursesToday === 0 ? 'No sessions scheduled' : `${coursesToday} In Progress`}
          </p>
        </div>

        <div className="prov-stat-card prov-stat-card--accent">
          <button
            type="button"
            className="prov-stat-action-btn"
            onClick={() => navigate('/training/certificates')}
            title="Go to Certificate Portal"
          >
            ⋮
          </button>
          <p className="prov-stat-label">Certificates Registered</p>
          <p className="prov-stat-value">{competencies.length}</p>
          <p className="prov-stat-meta">Registered and verified</p>
        </div>
      </div>

      {/* Main Split: Active Requests + Upcoming Courses */}
      <div className="provider-main-grid">
        {/* Active Training Requests */}
        <div className="prov-section-card">
          <div className="prov-section-head">
            <h2>Active Training Requests</h2>
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
            </div>
          </div>

          {displayedRequests.length === 0 ? (
            <div className="prov-empty-state">
              <div className="prov-empty-icon">📋</div>
              <p className="prov-empty-title">No pending training requests</p>
              <p className="prov-empty-sub">
                {searchQuery
                  ? 'No pending training requests match your search.'
                  : "When organizations send training requests, they'll appear here for review."}
              </p>
            </div>
          ) : (
            <>
              {/* Simplified overview rows */}
              <div style={{ padding: '16px 20px' }}>
                {displayedRequests.map((req) => {
                  const badgeColor = getBadgeColorClass(req.company)
                  return (
                    <div
                      key={req.id}
                      className="prov-req-row-card"
                      style={{ gridTemplateColumns: '1.5fr 1.5fr 70px 1.5fr 120px' }}
                    >
                      <div className="prov-company-cell">
                        <div className={`prov-company-badge prov-company-badge--${badgeColor}`}>
                          {initials(req.company)}
                        </div>
                        <div className="prov-company-info">
                          <span className="prov-company-name">{req.company}</span>
                          <span className="prov-company-req-id">Req ID: {req.reqId || '#TQ-00000'}</span>
                        </div>
                      </div>

                      <div className="prov-course-cell">
                        <CourseIcon courseName={req.course} />
                        <span>{req.course}</span>
                      </div>

                      <div className="prov-workers-cell">
                        {String(req.workers).padStart(2, '0')}
                      </div>

                      <div className="prov-dates-cell">
                        <span className="prov-dates-primary">{req.preferredDate}</span>
                        <span className="prov-dates-sub">{req.timeDetail || 'TBD'}</span>
                      </div>

                      <div className="prov-actions-cell" style={{ justifyContent: 'flex-end' }}>
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
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="prov-view-all-row">
                <button type="button" className="prov-view-all-btn" onClick={() => navigate('/training/requests')}>
                  View All Pending Requests →
                </button>
              </div>
            </>
          )}
        </div>

        {/* Upcoming Courses */}
        <div className="prov-section-card">
          <div className="prov-upcoming-head">
            <h2>Upcoming Courses</h2>
            <span className="prov-upcoming-badge">NEXT 48 HOURS</span>
          </div>

          {upcomingCourses.length === 0 ? (
            <div className="prov-empty-state">
              <div className="prov-empty-icon">📅</div>
              <p className="prov-empty-title">No upcoming courses</p>
              <p className="prov-empty-sub">Scheduled courses will appear here.</p>
            </div>
          ) : (
            <div className="prov-course-list">
              {upcomingCourses.map((c, i) => {
                const colors = ['blue', 'teal', 'orange']
                const color = colors[i % colors.length]
                return (
                  <div key={c.id} className={`prov-course-item prov-course-item--${color}`}>
                    <div className="prov-course-date-block">
                      <span className="prov-course-month">{getMonthAbbr(c.date)}</span>
                      <span className="prov-course-day">{getDayNum(c.date)}</span>
                    </div>
                    <div className="prov-course-body">
                      <p className="prov-course-name">{c.name}</p>
                      <p className="prov-course-time">
                        <Clock size={10} />
                        {c.time}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="prov-open-cal-row">
            <button type="button" className="prov-open-cal-btn" onClick={() => navigate('/training/calendar')}>
              Open Full Calendar →
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Upload OCR Panel */}
      <OcrUploadPanel onConfirm={handleOcrConfirm} employees={employees} organizations={organizations} />

      {/* Recent Competency Updates */}
      <div className="prov-competency-section">
        <div className="prov-competency-head">
          <h2>Recent Competency Updates</h2>
        </div>
        {competencies.length === 0 ? (
          <div className="prov-empty-state" style={{ paddingTop: 20 }}>
            <p className="prov-empty-sub">
              No recent competency updates. Approve a certificate upload to see them here.
            </p>
          </div>
        ) : (
          <div className="prov-competency-list">
            {competencies.slice(0, 8).map((c) => (
              <div key={c.id} className="prov-competency-item">
                <div className="prov-comp-avatar">{initials(c.name)}</div>
                <div className="prov-comp-info">
                  <p className="prov-comp-name">{c.name}</p>
                  <span className={`prov-comp-status ${c.status === 'Certified' ? 'prov-comp-status--certified' : 'prov-comp-status--pending'}`}>
                    {c.status}
                  </span>
                  <p className="prov-comp-role-text">{c.course}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModalOpen}
        onClose={() => {
          if (confirmLoading) return
          setConfirmModalOpen(false)
          setPendingRegistration(null)
          setConfirmError(null)
        }}
        onConfirm={handleConfirmRegistration}
        details={pendingRegistration}
        loading={confirmLoading}
        error={confirmError}
      />
    </div>
  )
}
