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
    <div className="schedule-session-page" style={{ padding: '28px', color: '#fff', maxWidth: '1280px', margin: '0 auto' }}>
      {/* Breadcrumb & Title Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(148, 163, 184, 0.5)', fontWeight: 800, marginBottom: '4px' }}>
            Calendar &rsaquo; <span style={{ color: '#fff' }}>Schedule Session</span>
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, color: '#fff', margin: '0 0 6px 0' }}>Schedule New Session</h1>
          <p style={{ margin: 0, fontSize: '13px', color: 'rgba(148, 163, 184, 0.7)' }}>Configure an authorized safety training event from the global catalog.</p>
        </div>

        {/* Top Header Buttons */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            type="button"
            className="schedule-btn-cancel"
            onClick={handleCancel}
            style={{
              padding: '10px 20px',
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              color: '#cbd5e1',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="schedule-btn-submit"
            onClick={handleFormSubmit}
            style={{
              padding: '10px 20px',
              background: '#1d4ed8',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(29, 78, 216, 0.25)',
              transition: 'all 0.15s ease'
            }}
          >
            Schedule Session
          </button>
        </div>
      </div>

      {/* Grid Layout splits forms & live preview */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '28px', alignItems: 'start' }}>
        {/* Left column forms */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Course Selection */}
          <div className="prov-section-card" style={{ padding: '24px', background: 'rgba(10, 14, 28, 0.45)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 800, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '10px', color: '#fff' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
                <Search size={14} />
              </span>
              Course Selection
            </h3>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(148, 163, 184, 0.65)', marginBottom: '6px', fontWeight: 800 }}>Course Title</label>
              <select
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                style={selectStyle}
              >
                {coursesList.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(148, 163, 184, 0.65)', marginBottom: '6px', fontWeight: 800 }}>Client Company</label>
              <select
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                style={selectStyle}
              >
                {organizations && organizations.length > 0 ? (
                  organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name || org.companyName || org.organizationName || org.id}
                    </option>
                  ))
                ) : (
                  <option value="">No organizations available</option>
                )}
              </select>
            </div>
          </div>

          {/* Trainer Assignment & Room/Capacity Cards Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* Trainer Assignment */}
            <div className="prov-section-card" style={{ padding: '24px', background: 'rgba(10, 14, 28, 0.45)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 800, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '10px', color: '#fff' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                  <User size={13} />
                </span>
                Trainer Assignment
              </h3>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(148, 163, 184, 0.65)', marginBottom: '6px', fontWeight: 800 }}>Instructor</label>
                <select
                  value={instructor}
                  onChange={(e) => setInstructor(e.target.value)}
                  style={selectStyle}
                  disabled={employees.length === 0}
                >
                  {instructorsList.map((ins) => (
                    <option key={ins} value={ins}>{ins}</option>
                  ))}
                </select>
              </div>

              {/* Instructor Availability check box */}
              <div style={{ display: 'flex', background: 'rgba(16, 185, 129, 0.06)', borderLeft: '3px solid #10b981', padding: '10px 12px', borderRadius: '4px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '9px', fontWeight: 800, color: '#4deba0', letterSpacing: '0.05em' }}>AVAILABILITY CHECK</span>
                  <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.75)', lineHeight: '1.4' }}>
                    Selected instructor is cleared for high-risk onsite training for the requested dates.
                  </span>
                </div>
              </div>
            </div>

            {/* Room & Capacity */}
            <div className="prov-section-card" style={{ padding: '24px', background: 'rgba(10, 14, 28, 0.45)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 800, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '10px', color: '#fff' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
                  <MapPin size={13} />
                </span>
                Room & Capacity
              </h3>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(148, 163, 184, 0.65)', marginBottom: '6px', fontWeight: 800 }}>Location / Room</label>
                <select
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  style={selectStyle}
                >
                  {locationsList.map((loc) => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(148, 163, 184, 0.65)', marginBottom: '6px', fontWeight: 800 }}>Max Participants</label>
                <input
                  type="number"
                  value={maxParticipants}
                  onChange={(e) => setMaxParticipants(parseInt(e.target.value) || 0)}
                  min="1"
                  style={{ width: '100%', padding: '10px 14px', background: '#070a13', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: '#3b82f6', fontSize: '18px', fontWeight: '800', outline: 'none' }}
                />
              </div>
            </div>
          </div>

          {/* Session Timing */}
          <div className="prov-section-card" style={{ padding: '24px', background: 'rgba(10, 14, 28, 0.45)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 800, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '10px', color: '#fff' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
                <Calendar size={13} />
              </span>
              Session Timing
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(148, 163, 184, 0.65)', marginBottom: '6px', fontWeight: 800 }}>Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', background: '#070a13', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: '#fff', fontSize: '13px', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(148, 163, 184, 0.65)', marginBottom: '6px', fontWeight: 800 }}>End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', background: '#070a13', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: '#fff', fontSize: '13px', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(148, 163, 184, 0.65)', marginBottom: '6px', fontWeight: 800 }}>Time Slot</label>
                <select
                  value={timeSlot}
                  onChange={(e) => setTimeSlot(e.target.value)}
                  style={selectStyle}
                >
                  <option value="08:00 AM - 12:00 PM">08:00 AM -12:00 PM</option>
                  <option value="09:00 AM - 05:00 PM">09:00 AM - 05:00 PM</option>
                  <option value="01:00 PM - 05:00 PM">01:00 PM - 05:00 PM</option>
                </select>
              </div>
            </div>
          </div>

          {/* Priority */}
          <div className="prov-section-card" style={{ padding: '24px', background: 'rgba(10, 14, 28, 0.45)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 800, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '10px', color: '#fff' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
                <ShieldAlert size={13} />
              </span>
              Session Priority
            </h3>
            <div>
              <label style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(148, 163, 184, 0.65)', marginBottom: '6px', fontWeight: 800 }}>Priority Level</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                style={selectStyle}
              >
                <option value="Active">Active</option>
                <option value="Completed">Completed</option>
                <option value="High Priority">High Priority</option>
              </select>
            </div>
          </div>

          {/* Required Resources */}
          <div className="prov-section-card" style={{ padding: '24px', background: 'rgba(10, 14, 28, 0.45)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 800, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '10px', color: '#fff' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                <Check size={14} />
              </span>
              Required Resources
            </h3>
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                <input
                  type="checkbox"
                  checked={resources.projector}
                  onChange={() => handleResourceChange('projector')}
                  style={{ width: '16px', height: '16px', borderRadius: '4px', accentColor: '#3b82f6' }}
                />
                Projector
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                <input
                  type="checkbox"
                  checked={resources.safetyGear}
                  onChange={() => handleResourceChange('safetyGear')}
                  style={{ width: '16px', height: '16px', borderRadius: '4px', accentColor: '#3b82f6' }}
                />
                Safety Gear
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                <input
                  type="checkbox"
                  checked={resources.vrHeadsets}
                  onChange={() => handleResourceChange('vrHeadsets')}
                  style={{ width: '16px', height: '16px', borderRadius: '4px', accentColor: '#3b82f6' }}
                />
                VR Headsets
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                <input
                  type="checkbox"
                  checked={resources.hazmatSuits}
                  onChange={() => handleResourceChange('hazmatSuits')}
                  style={{ width: '16px', height: '16px', borderRadius: '4px', accentColor: '#3b82f6' }}
                />
                Hazmat Suits
              </label>
            </div>
          </div>
        </div>

        {/* Right column: Dynamic Live Preview card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Preview card */}
          <div style={{ background: 'rgba(10, 14, 28, 0.45)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '14px', overflow: 'hidden' }}>
            {/* Styled banner backdrop using premium CSS grids and gradients */}
            <div style={{
              height: '140px',
              position: 'relative',
              background: 'linear-gradient(135deg, #090e1c 0%, #172554 100%)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden'
            }}>
              {/* Virtual Grid Graphic lines in background */}
              <div style={{
                position: 'absolute',
                inset: 0,
                opacity: 0.1,
                backgroundImage: 'radial-gradient(circle, #3b82f6 1px, transparent 1px)',
                backgroundSize: '16px 16px'
              }} />
              <div style={{
                fontSize: '2.5rem',
                fontWeight: 900,
                color: 'rgba(59, 130, 246, 0.15)',
                userSelect: 'none',
                letterSpacing: '0.1em'
              }}>
                SAFETYMATE
              </div>

              {/* Draft config badge */}
              <span style={{
                position: 'absolute',
                top: '12px',
                left: '12px',
                background: '#1d4ed8',
                color: '#fff',
                fontSize: '9px',
                fontWeight: 900,
                padding: '3px 8px',
                borderRadius: '4px',
                letterSpacing: '0.08em'
              }}>
                DRAFT CONFIG
              </span>
            </div>

            {/* Preview Card Metadata */}
            <div style={{ padding: '20px' }}>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '800', color: '#fff' }}>{course}</h3>
              <p style={{ margin: '0 0 16px 0', fontSize: '11px', color: 'rgba(148, 163, 184, 0.6)' }}>{selectedCompanyName} • {priority}</p>

              {/* Icons list details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', fontSize: '12.5px', color: '#cbd5e1' }}>
                  <Calendar size={14} style={{ color: '#3b82f6', marginTop: '2px' }} />
                  <div>
                    <div style={{ fontWeight: 700 }}>{formatPreviewDateRange(startDate, endDate)}</div>
                    <div style={{ fontSize: '10.5px', color: 'rgba(148, 163, 184, 0.6)', marginTop: '1px' }}>{timeSlot}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', fontSize: '12.5px', color: '#cbd5e1' }}>
                  <User size={14} style={{ color: '#3b82f6', marginTop: '2px' }} />
                  <div>
                    <div style={{ fontWeight: 700 }}>{instructor || '—'}</div>
                    <div style={{ fontSize: '10.5px', color: '#10b981', fontWeight: 700, marginTop: '1px' }}>Verified Certified Professional</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', fontSize: '12.5px', color: '#cbd5e1' }}>
                  <MapPin size={14} style={{ color: '#3b82f6', marginTop: '2px' }} />
                  <div>
                    <div style={{ fontWeight: 700 }}>{location}</div>
                    <div style={{ fontSize: '10.5px', color: 'rgba(148, 163, 184, 0.6)', marginTop: '1px' }}>Max Capacity: {maxParticipants}</div>
                  </div>
                </div>
              </div>

              {/* Checked Resource Badges */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px' }}>
                <span style={{ display: 'block', fontSize: '9px', fontWeight: 800, color: 'rgba(148, 163, 184, 0.5)', letterSpacing: '0.08em', marginBottom: '8px' }}>RESOURCE STATUS</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {resources.projector && (
                    <span style={{ fontSize: '10px', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#4deba0', padding: '3px 8px', borderRadius: '20px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                      <span style={{ fontSize: '9px' }}>✓</span> Projector
                    </span>
                  )}
                  {resources.safetyGear && (
                    <span style={{ fontSize: '10px', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#4deba0', padding: '3px 8px', borderRadius: '20px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                      <span style={{ fontSize: '9px' }}>✓</span> Safety Gear
                    </span>
                  )}
                  {resources.vrHeadsets && (
                    <span style={{ fontSize: '10px', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#4deba0', padding: '3px 8px', borderRadius: '20px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                      <span style={{ fontSize: '9px' }}>✓</span> VR Headsets
                    </span>
                  )}
                  {resources.hazmatSuits && (
                    <span style={{ fontSize: '10px', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#4deba0', padding: '3px 8px', borderRadius: '20px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                      <span style={{ fontSize: '9px' }}>✓</span> Hazmat Suits
                    </span>
                  )}
                  {!resources.projector && !resources.safetyGear && !resources.vrHeadsets && !resources.hazmatSuits && (
                    <span style={{ fontSize: '10px', color: 'rgba(148, 163, 184, 0.5)' }}>No resources selected</span>
                  )}
                </div>
              </div>

              {/* Confirm submit CTA button */}
              <button
                type="button"
                className="schedule-btn-confirm-primary"
                onClick={handleFormSubmit}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '12px',
                  background: '#1d4ed8',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textAlign: 'center',
                  boxShadow: '0 4px 12px rgba(29, 78, 216, 0.25)',
                  marginTop: '20px',
                  transition: 'all 0.15s ease'
                }}
              >
                CONFIRM & SCHEDULE
              </button>
            </div>
          </div>

          {/* Safety Compliance Warning banner */}
          <div style={{
            background: 'rgba(239, 68, 68, 0.05)',
            borderLeft: '4px solid #ef4444',
            borderRadius: '8px',
            padding: '16px',
            display: 'flex',
            gap: '12px'
          }}>
            <ShieldAlert size={18} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <h4 style={{ margin: '0 0 4px 0', fontSize: '12.5px', color: '#ef4444', fontWeight: 800 }}>Safety Compliance Check</h4>
              <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255, 255, 255, 0.7)', lineHeight: '1.4' }}>
                This course requires specialized PPE. Ensure inventory is logged 48h before the start date.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
