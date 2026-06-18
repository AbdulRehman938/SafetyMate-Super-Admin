import React, { useState, useEffect } from 'react'
import { Calendar, Clock, MapPin, User, Users, ShieldAlert, Check, Search, X } from 'lucide-react'

function getTodayStr() {
  return new Date().toISOString().split('T')[0]
}

const DEFAULT_RESOURCES = {
  projector: true,
  safetyGear: true,
  vrHeadsets: false,
  hazmatSuits: false,
}

function formatPreviewDateRange(startStr, endStr) {
  if (!startStr) return 'TBD'
  try {
    const s = new Date(startStr + 'T00:00:00')
    const sMonth = s.toLocaleDateString('en-US', { month: 'short' })
    const sDay = s.getDate()
    const sYear = s.getFullYear()

    if (!endStr) return `${sMonth} ${sDay}, ${sYear}`

    const e = new Date(endStr + 'T00:00:00')
    const eMonth = e.toLocaleDateString('en-US', { month: 'short' })
    const eDay = e.getDate()
    const eYear = e.getFullYear()

    if (sYear === eYear) {
      if (sMonth === eMonth) {
        return `${sMonth} ${sDay} - ${eDay}, ${sYear}`
      }
      return `${sMonth} ${sDay} - ${eMonth} ${eDay}, ${sYear}`
    }
    return `${sMonth} ${sDay}, ${sYear} - ${eMonth} ${eDay}, ${eYear}`
  } catch {
    return `${startStr} - ${endStr}`
  }
}

function getEmployeeName(emp) {
  return emp.fullName || emp.displayName || emp.email || 'Unknown'
}

export function ScheduleSessionPage({ onSubmit, onCancel, organizations, employees = [] }) {
  const todayStr = getTodayStr()

  const [course, setCourse] = useState('Advanced Fire Safety')
  const [instructor, setInstructor] = useState('')
  const [company, setCompany] = useState('')
  const [location, setLocation] = useState('Training Lab A - Tech Park')
  const [maxParticipants, setMaxParticipants] = useState(25)
  const [startDate, setStartDate] = useState(todayStr)
  const [endDate, setEndDate] = useState(todayStr)
  const [timeSlot, setTimeSlot] = useState('08:00 AM - 12:00 PM')
  const [priority, setPriority] = useState('Active')
  const [resources, setResources] = useState({ ...DEFAULT_RESOURCES })

  const instructorsList = employees.length > 0
    ? employees.map((emp) => getEmployeeName(emp))
    : ['No instructors available']

  useEffect(() => {
    if (organizations && organizations.length > 0 && !company) {
      setCompany(organizations[0].id)
    }
  }, [organizations, company])

  useEffect(() => {
    if (employees.length > 0 && !instructor) {
      setInstructor(getEmployeeName(employees[0]))
    }
  }, [employees, instructor])

  const resetForm = () => {
    setCourse('Advanced Fire Safety')
    setInstructor(employees.length > 0 ? getEmployeeName(employees[0]) : '')
    setCompany(organizations && organizations.length > 0 ? organizations[0].id : '')
    setLocation('Training Lab A - Tech Park')
    setMaxParticipants(25)
    setStartDate(getTodayStr())
    setEndDate(getTodayStr())
    setTimeSlot('08:00 AM - 12:00 PM')
    setPriority('Active')
    setResources({ ...DEFAULT_RESOURCES })
  }

  const handleCancel = () => {
    resetForm()
    onCancel()
  }

  const handleResourceChange = (key) => {
    setResources((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  const handleFormSubmit = (e) => {
    if (e) e.preventDefault()

    const selectedOrg = organizations?.find((o) => o.id === company) || organizations?.[0]
    const companyName = selectedOrg?.name || selectedOrg?.companyName || selectedOrg?.organizationName || '—'
    const orgId = selectedOrg?.id || ''

    const preferredDate = formatPreviewDateRange(startDate, endDate)

    onSubmit({
      course,
      company: companyName,
      clientId: orgId ? `Client ID: #${orgId.slice(0, 4)}` : '',
      workers: parseInt(maxParticipants),
      preferredDate,
      startDate,
      endDate,
      timeDetail: timeSlot,
      classroom: location,
      instructor,
      priority,
    })

    resetForm()
  }

  const coursesList = [
    'Advanced Fire Safety',
    'OSHA 30-Hour',
    'Crisis Mgmt',
    'First Aid Cert',
    'Cyber Awareness',
    'Working at Heights',
    'Confined Space Entry',
    'Hazardous Materials LVE',
    'Fire Safety Level 1',
    'Emergency Responder Drill',
    'High-Altitude Safety',
  ]

  const locationsList = [
    'Training Lab A - Tech Park',
    'Room 402',
    'Auditorium B',
    'Digital Hub',
    'Sim Lab 1',
  ]

  const selectedCompanyName = (() => {
    const org = organizations?.find((o) => o.id === company)
    return org?.name || org?.companyName || org?.organizationName || 'Select client'
  })()

  const selectStyle = {
    width: '100%',
    padding: '10px 14px',
    background: '#070a13',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '13px',
    outline: 'none',
  }

  return (
    <div className="schedule-session-page">
      {/* Header */}
      <div className="sched-header">
        <div className="sched-header-text">
          <div className="sched-breadcrumb">Calendar &rsaquo; <span>Schedule Session</span></div>
          <h1 className="sched-title">Schedule New Session</h1>
          <p className="sched-desc">Configure an authorized safety training event from the global catalog.</p>
        </div>
        <div className="sched-header-actions">
          <button type="button" className="schedule-btn-cancel" onClick={handleCancel}>Cancel</button>
          <button type="button" className="schedule-btn-submit" onClick={handleFormSubmit}>Schedule Session</button>
        </div>
      </div>

      {/* Main grid */}
      <div className="sched-grid">
        {/* Left: form cards */}
        <div className="sched-forms">

          {/* Course Selection */}
          <div className="prov-section-card sched-card">
            <h3 className="sched-card-heading">
              <span className="sched-card-icon sched-card-icon--blue"><Search size={14} /></span>
              Course Selection
            </h3>
            <div className="sched-field">
              <label className="sched-label">Course Title</label>
              <select value={course} onChange={(e) => setCourse(e.target.value)} className="sched-select">
                {coursesList.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="sched-field">
              <label className="sched-label">Client Company</label>
              <select value={company} onChange={(e) => setCompany(e.target.value)} className="sched-select">
                {organizations && organizations.length > 0
                  ? organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name || org.companyName || org.organizationName || org.id}
                      </option>
                    ))
                  : <option value="">No organizations available</option>}
              </select>
            </div>
          </div>

          {/* Trainer + Room row */}
          <div className="sched-two-col">
            <div className="prov-section-card sched-card">
              <h3 className="sched-card-heading">
                <span className="sched-card-icon sched-card-icon--green"><User size={13} /></span>
                Trainer Assignment
              </h3>
              <div className="sched-field">
                <label className="sched-label">Instructor</label>
                <select value={instructor} onChange={(e) => setInstructor(e.target.value)} className="sched-select" disabled={employees.length === 0}>
                  {instructorsList.map((ins) => <option key={ins} value={ins}>{ins}</option>)}
                </select>
              </div>
              <div className="sched-availability">
                <span className="sched-availability-badge">Availability Check</span>
                <span className="sched-availability-text">Instructor cleared for high-risk onsite training for requested dates.</span>
              </div>
            </div>

            <div className="prov-section-card sched-card">
              <h3 className="sched-card-heading">
                <span className="sched-card-icon sched-card-icon--blue"><MapPin size={13} /></span>
                Room & Capacity
              </h3>
              <div className="sched-field">
                <label className="sched-label">Location / Room</label>
                <select value={location} onChange={(e) => setLocation(e.target.value)} className="sched-select">
                  {locationsList.map((loc) => <option key={loc} value={loc}>{loc}</option>)}
                </select>
              </div>
              <div className="sched-field">
                <label className="sched-label">Max Participants</label>
                <input type="number" value={maxParticipants} onChange={(e) => setMaxParticipants(parseInt(e.target.value) || 0)} min="1" className="sched-input sched-input--number" />
              </div>
            </div>
          </div>

          {/* Session Timing */}
          <div className="prov-section-card sched-card">
            <h3 className="sched-card-heading">
              <span className="sched-card-icon sched-card-icon--blue"><Calendar size={13} /></span>
              Session Timing
            </h3>
            <div className="sched-three-col">
              <div className="sched-field">
                <label className="sched-label">Start Date</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="sched-input" />
              </div>
              <div className="sched-field">
                <label className="sched-label">End Date</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="sched-input" />
              </div>
              <div className="sched-field">
                <label className="sched-label">Time Slot</label>
                <select value={timeSlot} onChange={(e) => setTimeSlot(e.target.value)} className="sched-select">
                  <option value="08:00 AM - 12:00 PM">08:00 AM – 12:00 PM</option>
                  <option value="09:00 AM - 05:00 PM">09:00 AM – 05:00 PM</option>
                  <option value="01:00 PM - 05:00 PM">01:00 PM – 05:00 PM</option>
                </select>
              </div>
            </div>
          </div>

          {/* Priority */}
          <div className="prov-section-card sched-card">
            <h3 className="sched-card-heading">
              <span className="sched-card-icon sched-card-icon--red"><ShieldAlert size={13} /></span>
              Session Priority
            </h3>
            <div className="sched-field">
              <label className="sched-label">Priority Level</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className="sched-select">
                <option value="Active">Active</option>
                <option value="Completed">Completed</option>
                <option value="High Priority">High Priority</option>
              </select>
            </div>
          </div>

          {/* Required Resources */}
          <div className="prov-section-card sched-card">
            <h3 className="sched-card-heading">
              <span className="sched-card-icon sched-card-icon--green"><Check size={14} /></span>
              Required Resources
            </h3>
            <div className="sched-resources">
              {[
                { key: 'projector',   label: 'Projector' },
                { key: 'safetyGear',  label: 'Safety Gear' },
                { key: 'vrHeadsets',  label: 'VR Headsets' },
                { key: 'hazmatSuits', label: 'Hazmat Suits' },
              ].map(({ key, label }) => (
                <label key={key} className="sched-resource-item">
                  <input type="checkbox" checked={resources[key]} onChange={() => handleResourceChange(key)} className="sched-checkbox" />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Right: preview + compliance */}
        <div className="sched-sidebar">
          <div className="sched-preview-card">
            <div className="sched-preview-banner">
              <div className="sched-preview-dots-bg" />
              <span className="sched-preview-watermark">SAFETYMATE</span>
              <span className="sched-preview-draft-badge">DRAFT CONFIG</span>
            </div>
            <div className="sched-preview-body">
              <h3 className="sched-preview-course">{course}</h3>
              <p className="sched-preview-meta">{selectedCompanyName} · {priority}</p>
              <div className="sched-preview-details">
                <div className="sched-preview-detail-row">
                  <Calendar size={14} className="sched-preview-icon" />
                  <div>
                    <span className="sched-preview-val">{formatPreviewDateRange(startDate, endDate)}</span>
                    <span className="sched-preview-sub">{timeSlot}</span>
                  </div>
                </div>
                <div className="sched-preview-detail-row">
                  <User size={14} className="sched-preview-icon" />
                  <div>
                    <span className="sched-preview-val">{instructor || '—'}</span>
                    <span className="sched-preview-sub sched-preview-sub--green">Verified Certified Professional</span>
                  </div>
                </div>
                <div className="sched-preview-detail-row">
                  <MapPin size={14} className="sched-preview-icon" />
                  <div>
                    <span className="sched-preview-val">{location}</span>
                    <span className="sched-preview-sub">Max Capacity: {maxParticipants}</span>
                  </div>
                </div>
              </div>
              <div className="sched-preview-resources">
                <span className="sched-preview-resources-label">Resource Status</span>
                <div className="sched-preview-badges">
                  {resources.projector  && <span className="sched-resource-badge">✓ Projector</span>}
                  {resources.safetyGear && <span className="sched-resource-badge">✓ Safety Gear</span>}
                  {resources.vrHeadsets && <span className="sched-resource-badge">✓ VR Headsets</span>}
                  {resources.hazmatSuits && <span className="sched-resource-badge">✓ Hazmat Suits</span>}
                  {!resources.projector && !resources.safetyGear && !resources.vrHeadsets && !resources.hazmatSuits && (
                    <span className="sched-no-resources">No resources selected</span>
                  )}
                </div>
              </div>
              <button type="button" className="schedule-btn-confirm-primary" onClick={handleFormSubmit}>
                CONFIRM &amp; SCHEDULE
              </button>
            </div>
          </div>

          <div className="sched-compliance-banner">
            <ShieldAlert size={18} className="sched-compliance-icon" />
            <div>
              <h4 className="sched-compliance-title">Safety Compliance Check</h4>
              <p className="sched-compliance-text">This course requires specialized PPE. Ensure inventory is logged 48h before the start date.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}