import React, { useState, useEffect } from 'react'
import { Calendar, Clock, MapPin, User, ShieldAlert, Check, X, Search } from 'lucide-react'
import { CustomSelect } from '../components/CustomSelect.jsx'
import { CustomDatePicker } from '../components/CustomDatePicker.jsx'
import { TimeRangePicker } from '../components/TimeRangePicker.jsx'
import { collection, doc, getDoc, setDoc, arrayUnion } from 'firebase/firestore'
import { db } from '../../../config/firebase.js'

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
  const [course, setCourse] = useState('')
  const [instructor, setInstructor] = useState('')
  const [company, setCompany] = useState('')
  const [location, setLocation] = useState('')
  const [maxParticipants, setMaxParticipants] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [timeSlot, setTimeSlot] = useState('')
  const [priority, setPriority] = useState('')
  const [resources, setResources] = useState({
    projector: false,
    safetyGear: false,
    vrHeadsets: false,
    hazmatSuits: false,
  })

  // Dynamic options from Firestore
  const [coursesList, setCoursesList] = useState([])
  const [locationsList, setLocationsList] = useState([])

  // Load persisted options from Firestore on mount
  useEffect(() => {
    async function loadOptions() {
      try {
        const courseSnap = await getDoc(doc(db, 'training_options', 'courses'))
        const locationSnap = await getDoc(doc(db, 'training_options', 'locations'))

        if (courseSnap.exists() && Array.isArray(courseSnap.data().values)) {
          setCoursesList(courseSnap.data().values)
        }
        if (locationSnap.exists() && Array.isArray(locationSnap.data().values)) {
          setLocationsList(locationSnap.data().values)
        }
      } catch (err) {
        console.warn('Could not load training options from Firestore:', err.message)
      }
    }
    loadOptions()
  }, [])

  // Save a newly created option to Firestore and update local state
  async function handleAddOption(fieldName, newValue) {
    try {
      const docId = fieldName === 'course' ? 'courses' : 'locations'
      await setDoc(
        doc(db, 'training_options', docId),
        { values: arrayUnion(newValue) },
        { merge: true }
      )
      if (fieldName === 'course') {
        setCoursesList((prev) => Array.from(new Set([...prev, newValue])))
      } else {
        setLocationsList((prev) => Array.from(new Set([...prev, newValue])))
      }
    } catch (err) {
      console.warn('Could not save new option:', err.message)
    }
  }

  const instructorsList = employees.length > 0
    ? employees.map((emp) => getEmployeeName(emp))
    : ['No instructors available']

  const resetForm = () => {
    setCourse('')
    setInstructor('')
    setCompany('')
    setLocation('')
    setMaxParticipants('')
    setStartDate('')
    setEndDate('')
    setTimeSlot('')
    setPriority('')
    setResources({
      projector: false,
      safetyGear: false,
      vrHeadsets: false,
      hazmatSuits: false,
    })
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

  const selectedCompanyName = (() => {
    const org = organizations?.find((o) => o.id === company)
    return org?.name || org?.companyName || org?.organizationName || 'Select client'
  })()

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
              <CustomSelect
                value={course}
                onChange={setCourse}
                options={coursesList}
                searchable
                searchPlaceholder="Search course..."
                allowCustom
                onAddOption={(val) => handleAddOption('course', val)}
              />
            </div>
            <div className="sched-field">
              <label className="sched-label">Client Company</label>
              <CustomSelect
                value={company}
                onChange={setCompany}
                options={organizations && organizations.length > 0
                  ? organizations.map((org) => ({
                      value: org.id,
                      label: org.name || org.companyName || org.organizationName || org.id,
                    }))
                  : [{ value: '', label: 'No organizations available' }]
                }
                searchable
                searchPlaceholder="Search company..."
                allowCustom
              />
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
                <CustomSelect
                  value={instructor}
                  onChange={setInstructor}
                  options={instructorsList.map((ins) => ({ value: ins, label: ins }))}
                  disabled={employees.length === 0}
                  searchable
                  searchPlaceholder="Search instructor..."
                  allowCustom
                />
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
                <CustomSelect
                  value={location}
                  onChange={setLocation}
                  options={locationsList.map((loc) => ({ value: loc, label: loc }))}
                  searchable
                  searchPlaceholder="Search location..."
                  allowCustom
                  onAddOption={(val) => handleAddOption('location', val)}
                />
              </div>
              <div className="sched-field">
                <label className="sched-label">Max Participants</label>
                <input 
                  type="number" 
                  value={maxParticipants} 
                  onChange={(e) => {
                    const value = e.target.value
                    if (value === '') {
                      setMaxParticipants('')
                    } else {
                      const num = parseInt(value)
                      if (num > 0) {
                        setMaxParticipants(num)
                      }
                    }
                  }} 
                  min="1" 
                  className="sched-input sched-input--number sched-input--no-spinners" 
                  placeholder="Enter number"
                />
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
                <CustomDatePicker
                  value={startDate}
                  onChange={setStartDate}
                  placeholder="Start date"
                />
              </div>
              <div className="sched-field">
                <label className="sched-label">End Date</label>
                <CustomDatePicker
                  value={endDate}
                  onChange={setEndDate}
                  minDate={startDate || undefined}
                  placeholder="End date"
                />
              </div>
              <div className="sched-field">
                <TimeRangePicker
                  value={timeSlot}
                  onChange={setTimeSlot}
                  label="Time Slot"
                />
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
              <CustomSelect
                value={priority}
                onChange={setPriority}
                options={[
                  { value: 'Low', label: 'Low' },
                  { value: 'Medium', label: 'Medium' },
                  { value: 'High', label: 'High' },
                  { value: 'Critical', label: 'Critical' },
                ]}
                searchable={false}
              />
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