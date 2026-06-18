import React, { useState } from 'react'
import { useTrainingData } from '../hooks/useTrainingData.js'
import { OverviewPage } from './OverviewPage.jsx'
import { RequestsPage } from './RequestsPage.jsx'
import { CalendarPage } from './CalendarPage.jsx'
import { CertificatesPage } from './CertificatesPage.jsx'

export function TrainingDashboardPage({ view = 'overview' }) {
  const {
    requests,
    competencies,
    employees,
    organizations,
    loading,
    handleAccept,
    handleReject,
    handleBulkApprove,
    handleBulkReject,
    handleCreateDeployment,
    handleUpdateDeployment,
    handleConfirmRegistration,
    handleManualIssueCertificate,
  } = useTrainingData()

  // ── Requests Subpage Specific Filtering State ──────────────
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterTab, setFilterTab] = useState('All') // All | Pending | Approved | Completed | Rejected
  const [showFilterPanel, setShowFilterPanel] = useState(false)
  const [minWorkers, setMinWorkers] = useState('')
  const [selectedCourseFilter, setSelectedCourseFilter] = useState('All')
  const [selectedRequests, setSelectedRequests] = useState([])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh', color: '#fff' }}>
        <div className="prov-ocr-spinner" style={{ marginRight: '12px' }} />
        <span>Loading Training Dashboard...</span>
      </div>
    )
  }

  // ── Actions ─────────────────────────────────────────────
  const handleToggleSelect = (id) => {
    setSelectedRequests((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const handleToggleSelectAll = (filteredIds) => {
    const isAllSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedRequests.includes(id))
    if (isAllSelected) {
      setSelectedRequests((prev) => prev.filter((id) => !filteredIds.includes(id)))
    } else {
      setSelectedRequests((prev) => {
        const next = [...prev]
        filteredIds.forEach((id) => {
          if (!next.includes(id)) next.push(id)
        })
        return next
      })
    }
  }

  const handleBulkApproveAction = async () => {
    await handleBulkApprove(selectedRequests)
    setSelectedRequests([])
  }

  const handleBulkRejectAction = async () => {
    await handleBulkReject(selectedRequests)
    setSelectedRequests([])
  }

  // ── Requests page filtering logic ──────────────────────────
  const filteredRequests = requests.filter((r) => {
    const q = searchQuery.toLowerCase()
    const matchesSearch =
      r.company?.toLowerCase().includes(q) ||
      r.clientId?.toLowerCase().includes(q) ||
      r.course?.toLowerCase().includes(q) ||
      r.reqId?.toLowerCase().includes(q)

    if (!matchesSearch) return false

    if (filterTab === 'All') {
      if (r.status === 'rejected') return false
    } else if (filterTab === 'Pending') {
      if (r.status !== 'pending') return false
    } else if (filterTab === 'Approved') {
      if (r.status !== 'approved' && r.status !== 'accepted') return false
    } else if (filterTab === 'Completed') {
      if (r.status !== 'completed') return false
    } else if (filterTab === 'Rejected') {
      if (r.status !== 'rejected') return false
    }

    if (minWorkers && parseInt(r.workers || 0) < parseInt(minWorkers)) return false
    if (selectedCourseFilter !== 'All' && r.course !== selectedCourseFilter) return false

    return true
  })

  const allFilteredIds = filteredRequests.map((r) => r.id)
  const availableCourses = Array.from(new Set(requests.map((r) => r.course).filter(Boolean))).sort()

  if (view === 'requests') {
    return (
      <RequestsPage
        requests={filteredRequests}
        onAccept={handleAccept}
        onReject={handleReject}
        onBulkApprove={handleBulkApproveAction}
        onBulkReject={handleBulkRejectAction}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        showSearch={showSearch}
        setShowSearch={setShowSearch}
        filterTab={filterTab}
        setFilterTab={setFilterTab}
        selectedRequests={selectedRequests}
        onToggleSelect={handleToggleSelect}
        onToggleSelectAll={() => handleToggleSelectAll(allFilteredIds)}
        allFilteredIds={allFilteredIds}
        minWorkers={minWorkers}
        setMinWorkers={setMinWorkers}
        selectedCourseFilter={selectedCourseFilter}
        setSelectedCourseFilter={setSelectedCourseFilter}
        showFilterPanel={showFilterPanel}
        setShowFilterPanel={setShowFilterPanel}
        availableCourses={availableCourses}
      />
    )
  }

  if (view === 'calendar') {
    return (
      <CalendarPage
        requests={requests}
        organizations={organizations}
        employees={employees}
        onCreateDeployment={handleCreateDeployment}
        onUpdateDeployment={handleUpdateDeployment}
        onAccept={handleAccept}
        onReject={handleReject}
      />
    )
  }

  if (view === 'certificates') {
    return (
      <CertificatesPage
        competencies={competencies}
        employees={employees}
        organizations={organizations}
        onIssue={handleManualIssueCertificate}
      />
    )
  }

  // Default to overview
  return (
    <OverviewPage
      requests={requests}
      competencies={competencies}
      employees={employees}
      organizations={organizations}
      onAccept={handleAccept}
      onReject={handleReject}
      onConfirmRegistration={handleConfirmRegistration}
    />
  )
}
