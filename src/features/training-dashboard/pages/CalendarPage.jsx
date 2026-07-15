import React, { useState, useEffect, useRef } from 'react'
import { SlidersHorizontal, ChevronLeft, ChevronRight, Clock, RotateCw, ChevronDown, Check, X } from 'lucide-react'
import { ScheduleSessionPage } from './ScheduleSessionPage.jsx'
import { CalendarEventDetailModal } from '../components/CalendarEventDetailModal.jsx'

// ── Custom animated dropdown (shared) ───────────────────────────────────────
function CustomSelect({ label, value, onChange, options }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selected = options.find((o) => o.value === value)

  return (
    <div className="prov-custom-select" ref={ref} style={{ flex: 1 }}>
      <button
        type="button"
        className={`prov-custom-select-trigger ${open ? 'prov-custom-select-trigger--open' : ''}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="prov-custom-select-label">{label}</span>
        <span className="prov-custom-select-value">{selected?.label ?? value}</span>
        <ChevronDown size={12} className={`prov-custom-select-chevron ${open ? 'prov-custom-select-chevron--open' : ''}`} />
      </button>
      {open && (
        <div className="prov-custom-select-menu">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`prov-custom-select-option ${opt.value === value ? 'prov-custom-select-option--active' : ''}`}
              onClick={() => { onChange(opt.value); setOpen(false) }}
            >
              {opt.label}
              {opt.value === value && <Check size={12} className="prov-custom-select-check" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function getMonthAbbr(d) {
  return d.toLocaleString('en-US', { month: 'short' }).toUpperCase()
}

export function CalendarPage({
  requests,
  sessions,
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

  // ── Quick status filter (mobile legend tabs) ─────────────
  const [statusFilter, setStatusFilter] = useState('All') // All | Active | Completed | High Priority

  // ── Scheduling Subpage View State ────────────────────────
  const [isScheduling, setIsScheduling] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [eventDetailOpen, setEventDetailOpen] = useState(false)

  // ── Session Feedback State ───────────────────────────────
  const [newSessionFeedback, setNewSessionFeedback] = useState(null)
  const [highlightedSessionId, setHighlightedSessionId] = useState(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // ── Day Courses Modal State ─────────────────────────────
  const [dayCoursesModalOpen, setDayCoursesModalOpen] = useState(false)
  const [selectedDayCourses, setSelectedDayCourses] = useState([])
  const [selectedDate, setSelectedDate] = useState(null)
  const [dayCoursesSearch, setDayCoursesSearch] = useState('')

  // ── Swipe state for touch navigation ────────────────────
  const touchStartX = useRef(null)
  const touchStartY = useRef(null)

  useEffect(() => {
    if (!highlightedSessionId) return
    const timer = setTimeout(() => setHighlightedSessionId(null), 5000)
    return () => clearTimeout(timer)
  }, [highlightedSessionId])

  // Disable body scroll when any modal is open
  useEffect(() => {
    const isAnyModalOpen = eventDetailOpen || dayCoursesModalOpen
    if (isAnyModalOpen) {
      document.body.style.overflow = 'hidden'
      document.body.style.paddingRight = '0px'
    } else {
      document.body.style.overflow = ''
      document.body.style.paddingRight = ''
    }
    return () => {
      document.body.style.overflow = ''
      document.body.style.paddingRight = ''
    }
  }, [eventDetailOpen, dayCoursesModalOpen])

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
  const toDateInputString = (value) => {
    if (!value) return ''
    if (typeof value === 'string') return value
    if (value instanceof Date) return value.toISOString()
    if (typeof value?.toDate === 'function') {
      const date = value.toDate()
      return date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString() : ''
    }
    if (typeof value === 'object') {
      if (typeof value.seconds === 'number') {
        const ms = value.seconds * 1000 + Math.floor((Number(value.nanoseconds) || 0) / 1e6)
        const date = new Date(ms)
        return Number.isNaN(date.getTime()) ? '' : date.toISOString()
      }
      if (typeof value.toString === 'function' && value.toString !== Object.prototype.toString) {
        return value.toString()
      }
    }
    return String(value)
  }

  const getDatesForRequest = (req) => {
    const dateStr = toDateInputString(req.preferredDate || req.startDate || req.date || '')
    const dates = []

    try {
      const parsed = new Date(dateStr)
      if (!isNaN(parsed.getTime())) {
        if (parsed.getFullYear() === activeYear && parsed.getMonth() === activeMonth) {
          dates.push(parsed.getDate())
        }
        return dates
      }
    } catch { }

    const rangeMatch = String(dateStr).match(/([a-zA-Z]+)\s+(\d+)\s*-\s*([a-zA-Z]+)?\s*(\d+),\s*(\d{4})/)
    if (rangeMatch) {
      const startMonthName = rangeMatch[1]
      const startDay = parseInt(rangeMatch[2])
      const endMonthName = rangeMatch[3] || startMonthName
      const endDay = parseInt(rangeMatch[4])
      const year = parseInt(rangeMatch[5])

      if (year === activeYear) {
        const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
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

  // ── Process Requests and Sessions into Calendar Events ─────────────────
  const calendarEvents = [
    // Include approved client requests
    ...requests
      .filter((r) => r.status === 'approved' || r.status === 'completed')
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
      }),
    // Include provider-scheduled sessions
    ...sessions
      .filter((s) => s.status === 'approved' || s.status === 'completed')
      .map((s) => {
        let classroom = s.classroom || 'TBD'
        let instructor = s.instructor || 'TBD'
        let priority = s.priority || 'Active'

        if (s.status === 'completed') {
          priority = 'Completed'
        }

        return {
          ...s,
          classroom,
          instructor,
          priority,
          dates: getDatesForRequest(s),
        }
      })
  ]

  // ── Apply Calendar Filters ──────────────────────────────
  const filteredEvents = calendarEvents.filter((e) => {
    if (courseFilter !== 'All' && e.course !== courseFilter) return false
    if (locationFilter !== 'All' && e.classroom !== locationFilter) return false
    if (instructorFilter !== 'All' && e.instructor !== instructorFilter) return false
    if (statusFilter !== 'All' && e.priority !== statusFilter) return false
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

  // ── Swipe handlers ────────────────────────────────────────
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current)
    // Only swipe if horizontal motion is dominant and > 50px
    if (Math.abs(dx) > 50 && dy < 80) {
      if (dx < 0) handleNext()   // swipe left → next
      else handlePrev()           // swipe right → prev
    }
    touchStartX.current = null
    touchStartY.current = null
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

  const handleDayCoursesClick = (day, events) => {
    setSelectedDate(new Date(activeYear, activeMonth, day))
    setSelectedDayCourses(events)
    setDayCoursesSearch('')
    setDayCoursesModalOpen(true)
  }

  const handleEventUpdate = async (id, updates) => {
    await onUpdateDeployment(id, updates)
  }

  const handleEventComplete = async (id) => {
    await onUpdateDeployment(id, { status: 'completed', priority: 'Completed', completedAt: new Date().toISOString() })
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

    // Build list of days-with-events for the mobile agenda view
    const daysWithEvents = []
    for (let d = 1; d <= daysInMonth; d++) {
      const evs = filteredEvents.filter((e) => e.dates.includes(d))
      if (evs.length > 0) daysWithEvents.push({ day: d, events: evs })
    }
    const weekdayOf = (d) => new Date(activeYear, activeMonth, d)
      .toLocaleDateString('en-US', { weekday: 'short' })

    return (
      <>
        {/* ── Desktop / tablet: 7-col grid ── */}
        <div className="prov-cal-month-grid-wrap">
          <div className="prov-calendar-grid">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="prov-cal-day-header">{d}</div>
            ))}
            {cells.map((day, i) => {
              if (day === null) {
                return <div key={`empty-${i}`} className="prov-cal-day-empty" />
              }

              const dayEvents = filteredEvents.filter((e) => e.dates.includes(day))
              const isToday =
                day === new Date().getDate() &&
                activeMonth === new Date().getMonth() &&
                activeYear === new Date().getFullYear()

              return (
                <div
                  key={day}
                  className={`prov-cal-day${isToday ? ' prov-cal-day--today' : ''}`}
                >
                  <div className="prov-cal-day-num">{String(day).padStart(2, '0')}</div>
                  <div className="prov-cal-day-events">
                    {dayEvents.length === 0 ? (
                      <span className="prov-cal-day-empty">—</span>
                    ) : (
                      <>
                        <div
                          className={`prov-cal-event${dayEvents[0].id === highlightedSessionId ? ' prov-cal-event--highlighted' : ''}`}
                          onClick={() => { setSelectedEvent(dayEvents[0]); setEventDetailOpen(true) }}
                          style={{
                            background: getEventStyles(dayEvents[0].priority).eventBg,
                            border: `1px solid ${getEventStyles(dayEvents[0].priority).eventBorder}`,
                            color: getEventStyles(dayEvents[0].priority).eventText
                          }}
                          title={`${dayEvents[0].course} - ${dayEvents[0].classroom}`}
                        >
                          <span className="prov-cal-event-name">{dayEvents[0].course}</span>
                          <span className="prov-cal-event-meta">{dayEvents[0].classroom} · {dayEvents[0].instructor}</span>
                        </div>
                        {dayEvents.length > 1 && (
                          <button
                            type="button"
                            className="prov-cal-event-more"
                            onClick={() => handleDayCoursesClick(day, dayEvents)}
                          >
                            +{dayEvents.length - 1} more
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Mobile: compact dot-grid + agenda list ── */}
        <div className="prov-cal-mobile-month">
          {/* Dot grid — 7-col, very compact, just day number + dots */}
          <div className="prov-cal-dot-grid">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <div key={i} className="prov-cal-dot-header">{d}</div>
            ))}
            {cells.map((day, i) => {
              if (day === null) return <div key={`e-${i}`} />
              const dayEvents = filteredEvents.filter((e) => e.dates.includes(day))
              const isToday =
                day === new Date().getDate() &&
                activeMonth === new Date().getMonth() &&
                activeYear === new Date().getFullYear()
              return (
                <button
                  key={day}
                  type="button"
                  className={`prov-cal-dot-day${isToday ? ' prov-cal-dot-day--today' : ''}${dayEvents.length > 0 ? ' prov-cal-dot-day--has-events' : ''}`}
                  onClick={() => {
                    if (dayEvents.length === 1) {
                      setSelectedEvent(dayEvents[0])
                      setEventDetailOpen(true)
                    } else if (dayEvents.length > 1) {
                      setSelectedEvent(dayEvents[0])
                      setEventDetailOpen(true)
                    }
                  }}
                >
                  <span className="prov-cal-dot-num">{day}</span>
                  {dayEvents.length > 0 && (
                    <span className="prov-cal-dot-indicators">
                      {dayEvents.slice(0, 3).map((ev) => {
                        const { eventBorder } = getEventStyles(ev.priority)
                        return (
                          <span
                            key={ev.id}
                            className="prov-cal-dot-pip"
                            style={{ background: eventBorder }}
                          />
                        )
                      })}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Agenda list — days with events */}
          {daysWithEvents.length === 0 ? (
            <div className="prov-cal-agenda-empty">No sessions scheduled this month.</div>
          ) : (
            <div className="prov-cal-agenda-list">
              <p className="prov-cal-agenda-title">Sessions This Month</p>
              {daysWithEvents.map(({ day, events }) => (
                <div key={day} className="prov-cal-agenda-day">
                  <div className="prov-cal-agenda-date">
                    <span className="prov-cal-agenda-daynum">{String(day).padStart(2, '0')}</span>
                    <span className="prov-cal-agenda-weekday">{weekdayOf(day)}</span>
                  </div>
                  <div className="prov-cal-agenda-events">
                    {events.map((event) => {
                      const { eventBg, eventBorder, eventText } = getEventStyles(event.priority)
                      return (
                        <button
                          key={event.id}
                          type="button"
                          className={`prov-cal-agenda-event${event.id === highlightedSessionId ? ' prov-cal-event--highlighted' : ''}`}
                          style={{ background: eventBg, borderLeft: `3px solid ${eventBorder}`, color: eventText }}
                          onClick={() => { setSelectedEvent(event); setEventDetailOpen(true) }}
                        >
                          <span className="prov-cal-agenda-course">{event.course}</span>
                          <span className="prov-cal-agenda-info">
                            {event.classroom} · {event.instructor}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </>
    )
  }

  const renderWeekView = () => {
    const dayOfWeek = currentDate.getDay()
    const sunDate = new Date(currentDate)
    sunDate.setDate(currentDate.getDate() - dayOfWeek)

    const weekDays = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(sunDate)
      d.setDate(sunDate.getDate() + i)
      weekDays.push(d)
    }

    const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

    return (
      <div className="prov-cal-week-grid">
        {weekDays.map((dayDate, i) => {
          const day = dayDate.getDate()
          const dayEvents = filteredEvents.filter((e) => e.dates.includes(day) && dayDate.getMonth() === activeMonth)
          const isToday =
            dayDate.getDate() === new Date().getDate() &&
            dayDate.getMonth() === new Date().getMonth() &&
            dayDate.getFullYear() === new Date().getFullYear()

          return (
            <div key={i} className={`prov-cal-week-col${isToday ? ' prov-cal-week-col--today' : ''}`}>
              <div className="prov-cal-week-col-header">
                <span className="prov-cal-week-col-name">{weekdayNames[i]}</span>
                <span className={`prov-cal-week-col-num${isToday ? ' prov-cal-week-col-num--today' : ''}`}>{day}</span>
              </div>
              <div className="prov-cal-week-col-events">
                {dayEvents.length === 0 ? (
                  <span className="prov-cal-week-col-empty">—</span>
                ) : (
                  dayEvents.map((event) => {
                    const { eventBg, eventBorder, eventText } = getEventStyles(event.priority)
                    return (
                      <div
                        key={event.id}
                        className={`prov-cal-week-event${event.id === highlightedSessionId ? ' prov-cal-event--highlighted' : ''}`}
                        onClick={() => { setSelectedEvent(event); setEventDetailOpen(true) }}
                        style={{ background: eventBg, borderColor: eventBorder, color: eventText }}
                      >
                        <span className="prov-cal-week-event-name">{event.course}</span>
                        <span className="prov-cal-week-event-meta">{event.classroom}</span>
                        <span className="prov-cal-week-event-meta">{event.instructor}</span>
                      </div>
                    )
                  })
                )}
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
    const dateLabel = currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

    return (
      <div className="prov-cal-day-view">
        <div className="prov-cal-day-view-header">
          <h3 className="prov-cal-day-view-title">Schedule for {dateLabel}</h3>
        </div>
        {dayEvents.length === 0 ? (
          <div className="prov-cal-day-view-empty">No courses scheduled for this date.</div>
        ) : (
          <div className="prov-cal-day-view-list">
            {dayEvents.map((event) => {
              const { eventBg, eventBorder, eventText } = getEventStyles(event.priority)
              return (
                <div
                  key={event.id}
                  className={`prov-cal-day-event${event.id === highlightedSessionId ? ' prov-cal-event--highlighted' : ''}`}
                  onClick={() => { setSelectedEvent(event); setEventDetailOpen(true) }}
                  style={{ background: eventBg, borderLeft: `4px solid ${eventBorder}`, color: eventText }}
                >
                  <div className="prov-cal-day-event-main">
                    <h4 className="prov-cal-day-event-title">{event.course}</h4>
                    <p className="prov-cal-day-event-meta">
                      🏢 {event.company} · 📍 {event.classroom} · 👤 {event.instructor}
                    </p>
                  </div>
                  {event.timeDetail && (
                    <div className="prov-cal-day-event-time">
                      <Clock size={13} />
                      <span>{event.timeDetail}</span>
                    </div>
                  )}
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
  let prevDate = new Date(currentDate)
  if (viewType === 'Month') {
    prevDate = new Date(activeYear, activeMonth - 1, 1)
  } else if (viewType === 'Week') {
    prevDate.setDate(currentDate.getDate() - 7)
  } else {
    prevDate.setDate(currentDate.getDate() - 1)
  }

  const monthEvents = filteredEvents.filter((e) => e.dates && e.dates.length > 0)
  const alphaCount = monthEvents.filter((e) => e.classroom?.includes('Lab A') || e.classroom?.includes('402')).length
  const vrCount = monthEvents.filter((e) => e.classroom?.includes('Sim')).length
  const theaterCount = monthEvents.filter((e) => e.classroom?.includes('Auditorium') || e.classroom?.includes('Digital')).length

  // Real utilization: 0% when no events in that facility this month
  const totalEvents = monthEvents.length || 1
  const alphaUtil = alphaCount === 0 ? 0 : Math.min(100, Math.round((alphaCount / totalEvents) * 100))
  const vrUtil = vrCount === 0 ? 0 : Math.min(100, Math.round((vrCount / totalEvents) * 100))
  const theaterUtil = theaterCount === 0 ? 0 : Math.min(100, Math.round((theaterCount / totalEvents) * 100))

  const isPrevDisabled = isDateBeforeLimit(prevDate)

  return (
    <section className="prov-subpage prov-cal-page" style={{ paddingBottom: '60px' }}>
      {/* Calendar Header */}
      <div className="prov-cal-header-row">
        <div className="prov-cal-header-text">
          <h1 className="prov-subpage-title prov-cal-title">Course Calendar</h1>
          <p className="prov-subpage-sub prov-cal-subtitle">Manage certification schedules and instructor deployments.</p>
        </div>

        {/* Month/Week/Day tabs + Filters Button */}
        <div className="prov-cal-controls">
          <div className="prov-cal-view-tabs">
            {['Month', 'Week', 'Day'].map((type) => (
              <button
                key={type}
                type="button"
                className={`prov-cal-view-tab${viewType === type ? ' prov-cal-view-tab--active' : ''}`}
                onClick={() => setViewType(type)}
              >
                {type}
              </button>
            ))}
          </div>

          <button
            type="button"
            className={`prov-btn-filters${showFilters ? ' prov-icon-btn--active' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <SlidersHorizontal size={13} />
            Filters
          </button>
        </div>
      </div>

      {/* Filter panel slide down */}
      {showFilters && (
        <div className="prov-cal-filter-panel">
          <CustomSelect
            label="Course"
            value={courseFilter}
            onChange={setCourseFilter}
            options={[
              { value: 'All', label: 'All Courses' },
              ...uniqueCourses.map((c) => ({ value: c, label: c })),
            ]}
          />
          <CustomSelect
            label="Location"
            value={locationFilter}
            onChange={setLocationFilter}
            options={[
              { value: 'All', label: 'All Locations' },
              ...uniqueLocations.map((l) => ({ value: l, label: l })),
            ]}
          />
          <CustomSelect
            label="Instructor"
            value={instructorFilter}
            onChange={setInstructorFilter}
            options={[
              { value: 'All', label: 'All Instructors' },
              ...uniqueInstructors.map((ins) => ({ value: ins, label: ins })),
            ]}
          />
          {(courseFilter !== 'All' || locationFilter !== 'All' || instructorFilter !== 'All') && (
            <button
              type="button"
              className="prov-cal-filter-clear"
              onClick={() => {
                setCourseFilter('All')
                setLocationFilter('All')
                setInstructorFilter('All')
              }}
            >
              <X size={13} />
              Clear
            </button>
          )}
        </div>
      )}

      {/* Control row: Current Month + nav + Legend */}
      <div className="prov-cal-nav-row">
        <div className="prov-cal-nav-left">
          <h2 className="prov-cal-month-label">
            {viewType === 'Month'
              ? currentDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })
              : viewType === 'Week'
                ? `Week of ${currentDate.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                : currentDate.toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </h2>
          <div className="prov-cal-nav-btns">
            <button
              type="button"
              className="prov-cal-nav-arrow"
              onClick={handlePrev}
              disabled={isPrevDisabled}
              aria-label="Previous"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              className="prov-cal-nav-arrow"
              onClick={handleNext}
              aria-label="Next"
            >
              <ChevronRight size={16} />
            </button>
            <button
              type="button"
              className={`prov-cal-nav-arrow prov-cal-refresh-btn${isRefreshing ? ' prov-cal-refresh-btn--spinning' : ''}`}
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              aria-label="Refresh calendar"
            >
              <RotateCw size={14} className="prov-cal-refresh-icon" />
            </button>
          </div>
        </div>

        {/* Status Legend — clickable quick filters */}
        <div className="prov-cal-legend">
          {[
            { key: 'All', label: 'All', dotClass: '' },
            { key: 'Active', label: 'Active', dotClass: 'prov-cal-legend-dot--blue' },
            { key: 'Completed', label: 'Completed', dotClass: 'prov-cal-legend-dot--green' },
            { key: 'High Priority', label: 'Priority', dotClass: 'prov-cal-legend-dot--red' },
          ].map(({ key, label, dotClass }) => (
            <button
              key={key}
              type="button"
              className={`prov-cal-legend-item prov-cal-legend-btn${statusFilter === key ? ' prov-cal-legend-btn--active' : ''}`}
              onClick={() => setStatusFilter(key)}
            >
              {key !== 'All' && <span className={`prov-cal-legend-dot ${dotClass}`} />}
              <span className="prov-cal-legend-label">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Split: Left Calendar + Right widgets */}
      <div className="prov-cal-main-split">
        {/* Left column: active view renderer */}
        <div
          className="prov-section-card prov-cal-card"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {newSessionFeedback && (
            <div className="prov-cal-session-banner">
              <span>
                📅 Session successfully scheduled for {newSessionFeedback.date}.
              </span>
              <button
                type="button"
                className="prov-cal-banner-jump"
                onClick={() => {
                  setCurrentDate(newSessionFeedback.targetDate)
                  setNewSessionFeedback(null)
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
        <div className="prov-cal-sidebar">
          {/* New Deployment Card */}
          <div className="prov-section-card prov-cal-deploy-card">
            <h3 className="prov-cal-deploy-title">New Deployment?</h3>
            <p className="prov-cal-deploy-desc">
              Add a new training module to the schedule across all verified centers.
            </p>
            <button
              type="button"
              className="prov-cal-deploy-btn"
              onClick={() => setIsScheduling(true)}
            >
              Schedule New Course
            </button>
          </div>

          {/* Facility Utilization Card */}
          <div className="prov-section-card prov-cal-util-card">
            <h3 className="prov-cal-util-title">Facility Utilization</h3>
            <div className="prov-cal-util-list">
              <div className="prov-cal-util-row">
                <div className="prov-cal-util-meta">
                  <span className="prov-cal-util-name">Training Hall Alpha</span>
                  <span className="prov-cal-util-pct">{alphaUtil}%</span>
                </div>
                <div className="prov-cal-util-track">
                  <div className="prov-cal-util-fill prov-cal-util-fill--blue" style={{ width: `${alphaUtil}%` }} />
                </div>
              </div>
              <div className="prov-cal-util-row">
                <div className="prov-cal-util-meta">
                  <span className="prov-cal-util-name">VR Simulation Suite</span>
                  <span className="prov-cal-util-pct">{vrUtil}%</span>
                </div>
                <div className="prov-cal-util-track">
                  <div className="prov-cal-util-fill prov-cal-util-fill--yellow" style={{ width: `${vrUtil}%` }} />
                </div>
              </div>
              <div className="prov-cal-util-row">
                <div className="prov-cal-util-meta">
                  <span className="prov-cal-util-name">Lecture Theater 2</span>
                  <span className="prov-cal-util-pct">{theaterUtil}%</span>
                </div>
                <div className="prov-cal-util-track">
                  <div className="prov-cal-util-fill prov-cal-util-fill--red" style={{ width: `${theaterUtil}%` }} />
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

      {/* Day Courses Modal */}
      {dayCoursesModalOpen && (
        <div className="prov-modal-overlay" onClick={() => setDayCoursesModalOpen(false)}>
          <div className="prov-modal-content prov-modal-content--large" onClick={(e) => e.stopPropagation()}>
            <div className="prov-modal-header">
              <h3 className="prov-modal-title">
                Courses for {selectedDate?.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </h3>
              <button
                type="button"
                className="prov-modal-close"
                onClick={() => setDayCoursesModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="prov-modal-body">
              <div className="prov-day-courses-search">
                <input
                  type="text"
                  placeholder="Search courses..."
                  className="prov-search-input"
                  value={dayCoursesSearch}
                  onChange={(e) => setDayCoursesSearch(e.target.value)}
                />
              </div>
              <div className="prov-day-courses-list">
                {selectedDayCourses
                  .filter((event) => {
                    if (!dayCoursesSearch) return true
                    const q = dayCoursesSearch.toLowerCase()
                    return (
                      event.course?.toLowerCase().includes(q) ||
                      event.classroom?.toLowerCase().includes(q) ||
                      event.instructor?.toLowerCase().includes(q) ||
                      event.company?.toLowerCase().includes(q)
                    )
                  })
                  .map((event) => {
                    const { eventBg, eventBorder, eventText } = getEventStyles(event.priority)
                    return (
                      <div
                        key={event.id}
                        className={`prov-day-course-card${event.id === highlightedSessionId ? ' prov-cal-event--highlighted' : ''}`}
                        style={{ background: eventBg, border: `1px solid ${eventBorder}`, color: eventText }}
                        onClick={() => {
                          setSelectedEvent(event)
                          setEventDetailOpen(true)
                          setDayCoursesModalOpen(false)
                        }}
                      >
                        <div className="prov-day-course-main">
                          <h4 className="prov-day-course-name">{event.course}</h4>
                          <div className="prov-day-course-meta">
                            <span>🏢 {event.company}</span>
                            <span>📍 {event.classroom}</span>
                            <span>👤 {event.instructor}</span>
                          </div>
                        </div>
                        {event.timeDetail && (
                          <div className="prov-day-course-time">
                            <Clock size={12} />
                            <span>{event.timeDetail}</span>
                          </div>
                        )}
                        <div className="prov-day-course-priority">
                          {event.priority}
                        </div>
                      </div>
                    )
                  })}
                {selectedDayCourses.filter((event) => {
                  if (!dayCoursesSearch) return true
                  const q = dayCoursesSearch.toLowerCase()
                  return (
                    event.course?.toLowerCase().includes(q) ||
                    event.classroom?.toLowerCase().includes(q) ||
                    event.instructor?.toLowerCase().includes(q) ||
                    event.company?.toLowerCase().includes(q)
                  )
                }).length === 0 && (
                    <div className="prov-empty-state">
                      <p className="prov-empty-sub">No courses match your search.</p>
                    </div>
                  )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
