import React, { useState, useEffect } from 'react'
import { SlidersHorizontal, ChevronLeft, ChevronRight, Clock, RotateCw } from 'lucide-react'
import { ScheduleSessionPage } from './ScheduleSessionPage.jsx'
import { CalendarEventDetailModal } from '../components/CalendarEventDetailModal.jsx'

function getMonthAbbr(d) {
  return d.toLocaleString('en-US', { month: 'short' }).toUpperCase()
}

export function CalendarPage({
  requests,
  organizations,
  employees = [],
  onCreateDeployment,
  onUpdateDeployment,
  onAccept, // to accept/approve a request
  onReject, // to delete/reject/cancel
}) {
  // ── Calendar View States ─────────────────────────────────
  const [viewType, setViewType] = useState('Month') // Month | Week | Day
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [showFilters, setShowFilters] = useState(false)

  // ── Filters State ────────────────────────────────────────
  const [courseFilter, setCourseFilter] = useState('All')
  const [locationFilter, setLocationFilter] = useState('All')
  const [instructorFilter, setInstructorFilter] = useState('All')

  // ── Scheduling Subpage View State ────────────────────────
  const [isScheduling, setIsScheduling] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [eventDetailOpen, setEventDetailOpen] = useState(false)

  // ── Session Feedback State ───────────────────────────────
  const [newSessionFeedback, setNewSessionFeedback] = useState(null)
  const [highlightedSessionId, setHighlightedSessionId] = useState(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    if (!highlightedSessionId) return
    const timer = setTimeout(() => setHighlightedSessionId(null), 5000)
    return () => clearTimeout(timer)
  }, [highlightedSessionId])

  // ── Navigation Boundaries (Past 2 Months Limit) ──────────
  const today = new Date()
  const minAllowedDate = new Date(today.getFullYear(), today.getMonth() - 2, 1)

  const isDateBeforeLimit = (date) => {
    const targetMonthStart = new Date(date.getFullYear(), date.getMonth(), 1)
    return targetMonthStart < minAllowedDate
  }

  const activeMonth = currentDate.getMonth()
  const activeYear = currentDate.getFullYear()

  // ── Date parsing helper ──────────────────────────────────
  const getDatesForRequest = (req) => {
    const dateStr = req.preferredDate || ''
    const dates = []

    try {
      const parsed = new Date(dateStr)
      if (!isNaN(parsed.getTime())) {
        if (parsed.getFullYear() === activeYear && parsed.getMonth() === activeMonth) {
          dates.push(parsed.getDate())
        }
        return dates
      }
    } catch {}

    const rangeMatch = dateStr.match(/([a-zA-Z]+)\s+(\d+)\s*-\s*([a-zA-Z]+)?\s*(\d+),\s*(\d{4})/)
    if (rangeMatch) {
      const startMonthName = rangeMatch[1]
      const startDay = parseInt(rangeMatch[2])
      const endMonthName = rangeMatch[3] || startMonthName
      const endDay = parseInt(rangeMatch[4])
      const year = parseInt(rangeMatch[5])

      if (year === activeYear) {
        const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
        const startMonth = months.findIndex(m => startMonthName.toLowerCase().startsWith(m))
        const endMonth = months.findIndex(m => endMonthName.toLowerCase().startsWith(m))

        if (startMonth === activeMonth || endMonth === activeMonth) {
          const limit = endMonth === activeMonth ? endDay : 31
          const start = startMonth === activeMonth ? startDay : 1
          for (let d = start; d <= limit; d++) {
            dates.push(d)
          }
        }
      }
    }
    return dates
  }

  // ── Process Requests into Calendar Events ─────────────────
  const calendarEvents = requests
    .filter((r) => r.status === 'approved' || r.status === 'accepted' || r.status === 'completed')
    .map((r) => {
      let classroom = r.classroom || 'TBD'
      let instructor = r.instructor || 'TBD'
      let priority = r.priority || 'Active'

      if (r.status === 'completed') {
        priority = 'Completed'
      }

      return {
        ...r,
        classroom,
        instructor,
        priority,
        dates: getDatesForRequest(r),
      }
    })

  // ── Apply Calendar Filters ──────────────────────────────
  const filteredEvents = calendarEvents.filter((e) => {
    if (courseFilter !== 'All' && e.course !== courseFilter) return false
    if (locationFilter !== 'All' && e.classroom !== locationFilter) return false
    if (instructorFilter !== 'All' && e.instructor !== instructorFilter) return false
    return true
  })

  // ── Get Unique Filter Options ────────────────────────────
  const uniqueCourses = Array.from(new Set(calendarEvents.map((e) => e.course).filter(Boolean))).sort()
  const uniqueLocations = Array.from(new Set(calendarEvents.map((e) => e.classroom).filter(Boolean))).sort()
  const uniqueInstructors = Array.from(new Set(calendarEvents.map((e) => e.instructor).filter(Boolean))).sort()

  // ── Next / Prev Navigation Handlers ──────────────────────
  const handlePrev = () => {
    let targetDate
    if (viewType === 'Month') {
      targetDate = new Date(activeYear, activeMonth - 1, 1)
    } else if (viewType === 'Week') {
      targetDate = new Date(currentDate)
      targetDate.setDate(targetDate.getDate() - 7)
    } else {
      targetDate = new Date(currentDate)
      targetDate.setDate(targetDate.getDate() - 1)
    }

    if (!isDateBeforeLimit(targetDate)) {
      setCurrentDate(targetDate)
    }
  }

  const handleNext = () => {
    if (viewType === 'Month') {
      setCurrentDate(new Date(activeYear, activeMonth + 1, 1))
    } else if (viewType === 'Week') {
      setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() + 7)))
    } else {
      setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() + 1)))
    }
  }

  // ── Create and Edit Event Handlers ───────────────────────
  const handleScheduleSubmit = async (deployment) => {
    const newId = await onCreateDeployment(deployment)
    setIsScheduling(false)

    if (newId) {
      setHighlightedSessionId(newId)
    }

    if (deployment.startDate) {
      const sessionDate = new Date(deployment.startDate + 'T00:00:00')
      if (!isNaN(sessionDate.getTime())) {
        const sessionMonth = sessionDate.getMonth()
        const sessionYear = sessionDate.getFullYear()
        if (sessionMonth !== activeMonth || sessionYear !== activeYear) {
          const formattedDate = sessionDate.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })
          const monthLabel = sessionDate.toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric',
          })
          setNewSessionFeedback({
            date: formattedDate,
            monthLabel,
            targetDate: new Date(sessionYear, sessionMonth, 1),
          })
        }
      }
    }
  }

  const handleManualRefresh = () => {
    setIsRefreshing(true)
    setTimeout(() => setIsRefreshing(false), 900)
  }

  const getEventStyles = (priority) => {
    let eventBg = 'rgba(58, 130, 255, 0.18)'
    let eventBorder = 'rgba(58, 130, 255, 0.4)'
    let eventText = '#8ab8ff'

    if (priority === 'High Priority') {
      eventBg = 'rgba(239, 68, 68, 0.16)'
      eventBorder = 'rgba(239, 68, 68, 0.35)'
      eventText = '#f87171'
    } else if (priority === 'Completed') {
      eventBg = 'rgba(16, 185, 129, 0.16)'
      eventBorder = 'rgba(16, 185, 129, 0.35)'
      eventText = '#4deba0'
    }

    return { eventBg, eventBorder, eventText }
  }

  const handleEventUpdate = async (id, updates) => {
    await onUpdateDeployment(id, updates)
  }

  const handleEventComplete = async (id) => {
    await onUpdateDeployment(id, { status: 'completed', priority: 'Completed' })
  }

  const handleEventDelete = async (id) => {
    await onReject(id)
  }

  // ── Render Views Grid Builders ───────────────────────────
  const renderMonthView = () => {
    const firstDay = new Date(activeYear, activeMonth, 1).getDay()
    const daysInMonth = new Date(activeYear, activeMonth + 1, 0).getDate()

    const cells = []
    for (let i = 0; i < firstDay; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)

    return (
      <div className="prov-calendar-container" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="prov-calendar-grid" style={{ margin: 0 }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="prov-cal-day-header" style={{ paddingBottom: '12px' }}>{d}</div>
          ))}
          {cells.map((day, i) => {
            if (day === null) {
              return (
                <div
                  key={`empty-${i}`}
                  style={{
                    minHeight: '110px',
                    border: '1px solid rgba(255, 255, 255, 0.02)',
                    background: 'transparent'
                  }}
                />
              )
            }

            const dayEvents = filteredEvents.filter((e) => e.dates.includes(day))
            const isToday =
              day === currentDate.getDate() &&
              activeMonth === currentDate.getMonth() &&
              activeYear === currentDate.getFullYear()

            return (
              <div
                key={day}
                className={`prov-cal-day ${isToday ? 'prov-cal-day--today' : ''}`}
                style={{
                  minHeight: '110px',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  background: isToday ? 'rgba(58, 130, 255, 0.06)' : 'rgba(10, 14, 28, 0.45)',
                  borderColor: isToday ? 'rgba(58, 130, 255, 0.35)' : 'rgba(255, 255, 255, 0.05)',
                  padding: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <div
                  className="prov-cal-day-num"
                  style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    color: isToday ? '#3b82f6' : 'rgba(148, 163, 184, 0.65)',
                    marginBottom: '4px'
                  }}
                >
                  {String(day).padStart(2, '0')}
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', overflowY: 'auto', flex: 1 }}>
                  {dayEvents.map((event) => {
                    const { eventBg, eventBorder, eventText } = getEventStyles(event.priority)
                    const isHighlighted = event.id === highlightedSessionId

                    return (
                      <div
                        key={event.id}
                        className={`prov-cal-event ${isHighlighted ? 'prov-cal-event--highlighted' : ''}`}
                        onClick={() => {
                          setSelectedEvent(event)
                          setEventDetailOpen(true)
                        }}
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '5px 8px',
                          borderRadius: '6px',
                          background: eventBg,
                          border: `1px solid ${eventBorder}`,
                          color: eventText,
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '1px',
                          lineHeight: '1.2',
                          transition: 'all 0.15s ease'
                        }}
                        title={`${event.course} - ${event.classroom}`}
                      >
                        <span style={{ fontWeight: 800, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {event.course}
                        </span>
                        <span style={{ fontSize: '8.5px', opacity: 0.75, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {event.classroom} • {event.instructor}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const renderWeekView = () => {
    // Generate dates for the current week (Sun - Sat)
    const dayOfWeek = currentDate.getDay()
    const sunDate = new Date(currentDate)
    sunDate.setDate(currentDate.getDate() - dayOfWeek)

    const weekDays = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(sunDate)
      d.setDate(sunDate.getDate() + i)
      weekDays.push(d)
    }

    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', minHeight: '380px' }}>
        {weekDays.map((dayDate, i) => {
          const day = dayDate.getDate()
          const dayEvents = filteredEvents.filter((e) => e.dates.includes(day) && dayDate.getMonth() === activeMonth)
          const isToday =
            dayDate.getDate() === new Date().getDate() &&
            dayDate.getMonth() === new Date().getMonth() &&
            dayDate.getFullYear() === new Date().getFullYear()

          const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

          return (
            <div
              key={i}
              style={{
                background: 'rgba(10, 14, 28, 0.45)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: '8px',
                padding: '12px 10px',
                borderColor: isToday ? '#3b82f6' : 'rgba(255,255,255,0.05)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <div style={{ textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'rgba(148,163,184,0.5)', fontWeight: 700 }}>
                  {weekdayNames[i]}
                </div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: isToday ? '#3b82f6' : '#fff', marginTop: '2px' }}>
                  {day}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, overflowY: 'auto' }}>
                {dayEvents.map((event) => {
                  const { eventBg, eventBorder, eventText } = getEventStyles(event.priority)
                  const isHighlighted = event.id === highlightedSessionId

                  return (
                    <div
                      key={event.id}
                      className={`prov-cal-event ${isHighlighted ? 'prov-cal-event--highlighted' : ''}`}
                      onClick={() => {
                        setSelectedEvent(event)
                        setEventDetailOpen(true)
                      }}
                      style={{
                        padding: '8px',
                        background: eventBg,
                        border: `1px solid ${eventBorder}`,
                        borderRadius: '6px',
                        color: eventText,
                        fontSize: '11px',
                        cursor: 'pointer',
                        lineHeight: '1.3'
                      }}
                    >
                      <div style={{ fontWeight: 800 }}>{event.course}</div>
                      <div style={{ fontSize: '9px', opacity: 0.8, marginTop: '2px' }}>{event.classroom}</div>
                      <div style={{ fontSize: '9px', opacity: 0.8 }}>{event.instructor}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const renderDayView = () => {
    const day = currentDate.getDate()
    const dayEvents = filteredEvents.filter((e) => e.dates.includes(day))

    return (
      <div style={{ background: 'rgba(10, 14, 28, 0.45)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '20px' }}>
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, color: '#fff', fontSize: '15px' }}>
            Schedule for {currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </h3>
        </div>

        {dayEvents.length === 0 ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'rgba(148,163,184,0.5)' }}>
            No courses scheduled for this date.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {dayEvents.map((event) => {
              const { eventBg, eventBorder, eventText } = getEventStyles(event.priority)
              const isHighlighted = event.id === highlightedSessionId

              return (
                <div
                  key={event.id}
                  className={`prov-cal-event ${isHighlighted ? 'prov-cal-event--highlighted' : ''}`}
                  onClick={() => {
                    setSelectedEvent(event)
                    setEventDetailOpen(true)
                  }}
                  style={{
                    padding: '16px',
                    background: eventBg,
                    border: `1px solid ${eventBorder}`,
                    borderRadius: '8px',
                    color: eventText,
                    cursor: 'pointer',
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    alignItems: 'center',
                    gap: '20px'
                  }}
                >
                  <div>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 800 }}>{event.course}</h4>
                    <p style={{ margin: '4px 0 0 0', fontSize: '12px', opacity: 0.8 }}>
                      🏢 Client: {event.company} • 🗺 Location: {event.classroom} • 👤 Instructor: {event.instructor}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                    <Clock size={14} />
                    <span>{event.timeDetail}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // Intercept and render ScheduleSessionPage if scheduling is active
  if (isScheduling) {
    return (
      <ScheduleSessionPage
        organizations={organizations}
        employees={employees}
        onSubmit={handleScheduleSubmit}
        onCancel={() => setIsScheduling(false)}
      />
    )
  }

  // Pre-calculate boundary check for previous page button disabled state
  let prevDate
  if (viewType === 'Month') {
    prevDate = new Date(activeYear, activeMonth - 1, 1)
  } else if (viewType === 'Week') {
    prevDate = new Date(currentDate)
    prevDate.setDate(prevDate.getDate() - 7)
  } else {
    prevDate = new Date(currentDate)
    prevDate.setDate(prevDate.getDate() - 1)
  }
  const isPrevDisabled = isDateBeforeLimit(prevDate)

  return (
    <section className="prov-subpage" style={{ paddingBottom: '60px' }}>
      {/* Calendar Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 className="prov-subpage-title" style={{ fontSize: '2.2rem', fontWeight: 900, marginBottom: '6px' }}>Course Calendar</h1>
          <p className="prov-subpage-sub" style={{ fontSize: '13px' }}>Manage certification schedules and instructor deployments.</p>
        </div>

        {/* Month/Week/Day tabs + Filters Button */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ display: 'flex', background: 'rgba(10, 14, 28, 0.6)', borderRadius: '8px', padding: '3px', border: '1px solid rgba(255,255,255,0.05)' }}>
            {['Month', 'Week', 'Day'].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setViewType(type)}
                style={{
                  padding: '6px 16px',
                  background: viewType === type ? '#3a82ff' : 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  color: viewType === type ? '#fff' : 'rgba(148, 163, 184, 0.65)',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {type}
              </button>
            ))}
          </div>

          <button
            type="button"
            className={`prov-btn-filters ${showFilters ? 'prov-icon-btn--active' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              background: showFilters ? 'rgba(58, 130, 255, 0.12)' : 'rgba(10, 14, 28, 0.6)',
              border: '1px solid rgba(255,255,255,0.05)',
              color: showFilters ? '#3b82f6' : '#cbd5e1',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '12.5px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}
          >
            <SlidersHorizontal size={13} />
            Filters
          </button>
        </div>
      </div>

      {/* Filter panel slide down */}
      {showFilters && (
        <div
          style={{
            background: 'rgba(10, 14, 28, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '20px',
            display: 'flex',
            gap: '16px',
            alignItems: 'center'
          }}
        >
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px', fontWeight: 600 }}>Course</label>
            <select
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', background: '#0a0e1c', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', color: '#fff', fontSize: '12px' }}
            >
              <option value="All">All Courses</option>
              {uniqueCourses.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px', fontWeight: 600 }}>Location</label>
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', background: '#0a0e1c', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', color: '#fff', fontSize: '12px' }}
            >
              <option value="All">All Locations</option>
              {uniqueLocations.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px', fontWeight: 600 }}>Instructor</label>
            <select
              value={instructorFilter}
              onChange={(e) => setInstructorFilter(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', background: '#0a0e1c', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', color: '#fff', fontSize: '12px' }}
            >
              <option value="All">All Instructors</option>
              {uniqueInstructors.map((ins) => (
                <option key={ins} value={ins}>{ins}</option>
              ))}
            </select>
          </div>
          {(courseFilter !== 'All' || locationFilter !== 'All' || instructorFilter !== 'All') && (
            <button
              type="button"
              onClick={() => {
                setCourseFilter('All')
                setLocationFilter('All')
                setInstructorFilter('All')
              }}
              style={{
                alignSelf: 'flex-end',
                padding: '7px 12px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '6px',
                color: '#f87171',
                fontSize: '12px',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              Clear Filters
            </button>
          )}
        </div>
      )}

      {/* Control row: Current Month + Legend */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', background: 'rgba(10, 14, 28, 0.3)', padding: '12px 20px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <h2 style={{ fontSize: '17px', fontWeight: '800', color: '#fff', margin: 0 }}>
            {viewType === 'Month'
              ? currentDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })
              : viewType === 'Week'
              ? `Week of ${currentDate.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
              : currentDate.toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </h2>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              type="button"
              onClick={handlePrev}
              disabled={isPrevDisabled}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '24px',
                height: '24px',
                borderRadius: '4px',
                background: 'rgba(255,255,255,0.05)',
                border: 'none',
                color: isPrevDisabled ? 'rgba(255,255,255,0.15)' : '#fff',
                cursor: isPrevDisabled ? 'not-allowed' : 'pointer'
              }}
              aria-label="Previous"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={handleNext}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', cursor: 'pointer' }}
              aria-label="Next"
            >
              <ChevronRight size={16} />
            </button>
            <button
              type="button"
              className={`prov-cal-refresh-btn ${isRefreshing ? 'prov-cal-refresh-btn--spinning' : ''}`}
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '24px',
                height: '24px',
                borderRadius: '4px',
                background: 'rgba(255,255,255,0.05)',
                border: 'none',
                color: isRefreshing ? 'rgba(255,255,255,0.35)' : '#fff',
                cursor: isRefreshing ? 'not-allowed' : 'pointer',
              }}
              aria-label="Refresh calendar"
            >
              <RotateCw size={14} className="prov-cal-refresh-icon" />
            </button>
          </div>
        </div>

        {/* Status Legends */}
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '9px', fontWeight: 800, letterSpacing: '0.08em', color: '#cbd5e1' }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6' }} />
            ACTIVE COURSES
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '9px', fontWeight: 800, letterSpacing: '0.08em', color: '#cbd5e1' }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
            COMPLETED
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '9px', fontWeight: 800, letterSpacing: '0.08em', color: '#cbd5e1' }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }} />
            HIGH PRIORITY
          </div>
        </div>
      </div>

      {/* Main Content Split: Left Calendar + Right widgets */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px', alignItems: 'start' }}>
        {/* Left column: active view renderer */}
        <div className="prov-section-card" style={{ padding: '20px' }}>
          {newSessionFeedback && (
            <div
              className="prov-cal-session-banner"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                padding: '12px 16px',
                marginBottom: '16px',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '8px',
                fontSize: '13px',
                color: '#4deba0',
              }}
            >
              <span>
                📅 Session successfully scheduled for {newSessionFeedback.date}.
              </span>
              <button
                type="button"
                onClick={() => {
                  setCurrentDate(newSessionFeedback.targetDate)
                  setNewSessionFeedback(null)
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#3b82f6',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  whiteSpace: 'nowrap',
                }}
              >
                Jump to {newSessionFeedback.monthLabel}
              </button>
            </div>
          )}
          {viewType === 'Month' && renderMonthView()}
          {viewType === 'Week' && renderWeekView()}
          {viewType === 'Day' && renderDayView()}
        </div>

        {/* Right column: New Deployment + Facility Utilization */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* New Deployment Card */}
          <div className="prov-section-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'rgba(10, 14, 28, 0.35)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div>
              <h3 style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: '800', color: '#fff' }}>New Deployment?</h3>
              <p style={{ margin: 0, fontSize: '11px', color: 'rgba(148, 163, 184, 0.75)', lineHeight: '1.5' }}>
                Add a new training module to the schedule across all verified centers.
              </p>
            </div>
            
            <button
              type="button"
              onClick={() => setIsScheduling(true)}
              style={{
                display: 'block',
                width: '100%',
                padding: '12px',
                background: '#1d4ed8',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                textAlign: 'center',
                boxShadow: '0 4px 12px rgba(29, 78, 216, 0.25)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => e.target.style.background = '#2563eb'}
              onMouseLeave={(e) => e.target.style.background = '#1d4ed8'}
            >
              Schedule New<br />Course
            </button>
          </div>

          {/* Facility Utilization Card */}
          <div className="prov-section-card" style={{ padding: '20px', background: 'rgba(10, 14, 28, 0.35)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '13px', fontWeight: '800', color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px' }}>
              Facility Utilization
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Hall Alpha */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', fontWeight: 800, color: 'rgba(148, 163, 184, 0.75)', marginBottom: '6px' }}>
                  <span>TRAINING HALL ALPHA</span>
                  <span style={{ color: '#fff' }}>85%</span>
                </div>
                <div style={{ width: '100%', height: '5px', background: 'rgba(255,255,255,0.04)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: '85%', height: '100%', background: '#3b82f6', borderRadius: '3px' }} />
                </div>
              </div>

              {/* VR Suite */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', fontWeight: 800, color: 'rgba(148, 163, 184, 0.75)', marginBottom: '6px' }}>
                  <span>VR SIMULATION SUITE</span>
                  <span style={{ color: '#fff' }}>42%</span>
                </div>
                <div style={{ width: '100%', height: '5px', background: 'rgba(255,255,255,0.04)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: '42%', height: '100%', background: '#eab308', borderRadius: '3px' }} />
                </div>
              </div>

              {/* Theater 2 */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', fontWeight: 800, color: 'rgba(148, 163, 184, 0.75)', marginBottom: '6px' }}>
                  <span>LECTURE THEATER 2</span>
                  <span style={{ color: '#fff' }}>92%</span>
                </div>
                <div style={{ width: '100%', height: '5px', background: 'rgba(255,255,255,0.04)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: '92%', height: '100%', background: '#ef4444', borderRadius: '3px' }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Event Details Modal */}
      <CalendarEventDetailModal
        isOpen={eventDetailOpen}
        onClose={() => {
          setEventDetailOpen(false)
          setSelectedEvent(null)
        }}
        event={selectedEvent}
        onUpdate={handleEventUpdate}
        onComplete={handleEventComplete}
        onDelete={handleEventDelete}
      />
    </section>
  )
}
