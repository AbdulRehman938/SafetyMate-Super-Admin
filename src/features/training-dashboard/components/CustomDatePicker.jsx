import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function parseISO(str) {
  if (!str) return null
  const [y, m, d] = str.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function toISO(date) {
  if (!date) return ''
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatDisplay(str) {
  if (!str) return ''
  const d = parseISO(str)
  if (!d) return str
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfWeek(year, month) {
  return new Date(year, month, 1).getDay()
}

function startOfDay(date) {
  if (!date) return null
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * CustomDatePicker — fully custom calendar replacing <input type="date">.
 * Props:
 *   value         — ISO string "YYYY-MM-DD"
 *   onChange      — function(isoString)
 *   minDate       — ISO string, disable dates before this (also disables past dates always)
 *   highlightDate — ISO string, shows a secondary highlight (used for issue date in expiry picker)
 *   lockAll       — bool, lock entire calendar (e.g. expiry before issue date is chosen)
 *   lockMessage   — string, message shown when lockAll is true
 *   error         — bool
 *   disabled      — bool
 *   placeholder   — string
 *   id            — optional
 */
export function CustomDatePicker({
  value,
  onChange,
  minDate,
  highlightDate,
  lockAll = false,
  lockMessage = 'Select a start date first',
  error,
  disabled,
  placeholder = 'Select date',
  id,
}) {
  const [open, setOpen] = useState(false)
  const [panelStyle, setPanelStyle] = useState({})

  const today = startOfDay(new Date())
  const selectedDate = parseISO(value)
  const highlightD = parseISO(highlightDate)

  // Effective min: the later of minDate and today (always block past)
  const minD = (() => {
    const todayD = today
    const propMin = parseISO(minDate)
    if (!propMin) return todayD
    return propMin > todayD ? propMin : todayD
  })()

  const [viewYear, setViewYear] = useState(
    selectedDate?.getFullYear() ?? today.getFullYear()
  )
  const [viewMonth, setViewMonth] = useState(
    selectedDate?.getMonth() ?? today.getMonth()
  )

  const containerRef = useRef(null)
  const panelRef = useRef(null)

  // Sync view to selected date when value changes externally
  useEffect(() => {
    if (selectedDate) {
      setViewYear(selectedDate.getFullYear())
      setViewMonth(selectedDate.getMonth())
    }
  }, [value])

  // Position panel to avoid viewport clipping
  const reposition = useCallback(() => {
    if (!containerRef.current || !panelRef.current) return
    const trigger = containerRef.current.getBoundingClientRect()
    const panel = panelRef.current
    const panelW = panel.offsetWidth || 288
    const panelH = panel.offsetHeight || 320
    const vw = window.innerWidth
    const vh = window.innerHeight

    let top = trigger.bottom + 6
    let left = trigger.left

    // Flip up if not enough space below
    if (top + panelH > vh - 12) {
      top = trigger.top - panelH - 6
    }

    // Keep within right edge
    if (left + panelW > vw - 12) {
      left = vw - panelW - 12
    }

    // Keep within left edge
    if (left < 12) left = 12

    setPanelStyle({
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      zIndex: 9999,
    })
  }, [])

  useEffect(() => {
    if (open) {
      // Wait a tick for panel to render, then position
      requestAnimationFrame(() => reposition())
    }
  }, [open, reposition])

  // Reposition on scroll/resize while open
  useEffect(() => {
    if (!open) return
    const handle = () => reposition()
    window.addEventListener('scroll', handle, true)
    window.addEventListener('resize', handle)
    return () => {
      window.removeEventListener('scroll', handle, true)
      window.removeEventListener('resize', handle)
    }
  }, [open, reposition])

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (
        containerRef.current && !containerRef.current.contains(e.target) &&
        panelRef.current && !panelRef.current.contains(e.target)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1) }
    else setViewMonth((m) => m - 1)
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1) }
    else setViewMonth((m) => m + 1)
  }

  function selectDay(day) {
    const d = new Date(viewYear, viewMonth, day)
    onChange(toISO(d))
    setOpen(false)
  }

  function isDayDisabled(day) {
    if (lockAll) return true
    const d = startOfDay(new Date(viewYear, viewMonth, day))
    if (minD && d < minD) return true
    return false
  }

  function isSelected(day) {
    if (!selectedDate) return false
    return (
      selectedDate.getFullYear() === viewYear &&
      selectedDate.getMonth() === viewMonth &&
      selectedDate.getDate() === day
    )
  }

  function isHighlighted(day) {
    if (!highlightD) return false
    return (
      highlightD.getFullYear() === viewYear &&
      highlightD.getMonth() === viewMonth &&
      highlightD.getDate() === day
    )
  }

  function isTodayDay(day) {
    return (
      today.getFullYear() === viewYear &&
      today.getMonth() === viewMonth &&
      today.getDate() === day
    )
  }

  function isPast(day) {
    const d = startOfDay(new Date(viewYear, viewMonth, day))
    return d < today
  }

  const totalDays = getDaysInMonth(viewYear, viewMonth)
  const startDay = getFirstDayOfWeek(viewYear, viewMonth)
  const cells = []
  for (let i = 0; i < startDay; i++) cells.push(null)
  for (let d = 1; d <= totalDays; d++) cells.push(d)

  return (
    <div
      className={[
        'prov-datepicker',
        open ? 'prov-datepicker--open' : '',
        error ? 'prov-datepicker--error' : '',
        disabled || lockAll ? 'prov-datepicker--disabled' : '',
      ].filter(Boolean).join(' ')}
      ref={containerRef}
    >
      <button
        id={id}
        type="button"
        className="prov-datepicker-trigger"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        title={lockAll ? lockMessage : undefined}
      >
        <Calendar size={15} className="prov-datepicker-icon" />
        <span className={`prov-datepicker-value${!value ? ' prov-datepicker-placeholder' : ''}`}>
          {value ? formatDisplay(value) : placeholder}
        </span>
        {lockAll && (
          <span className="prov-datepicker-lock" aria-label={lockMessage}>🔒</span>
        )}
      </button>

      {open && (
        <div
          className="prov-datepicker-panel"
          style={panelStyle}
          ref={panelRef}
        >
          {/* Month navigation header */}
          <div className="prov-datepicker-header">
            <button
              type="button"
              className="prov-datepicker-nav"
              onClick={prevMonth}
              aria-label="Previous month"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="prov-datepicker-month-label">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              className="prov-datepicker-nav"
              onClick={nextMonth}
              aria-label="Next month"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          {/* lockAll overlay */}
          {lockAll ? (
            <div className="prov-datepicker-lockscreen">
              <span className="prov-datepicker-lockscreen-icon">🔒</span>
              <p className="prov-datepicker-lockscreen-msg">{lockMessage}</p>
              {/* Still render grid but fully disabled so user can see all dates strikethrough */}
              <div className="prov-datepicker-dow-row prov-datepicker-dow-row--muted">
                {DAY_LABELS.map((l) => (
                  <span key={l} className="prov-datepicker-dow">{l}</span>
                ))}
              </div>
              <div className="prov-datepicker-grid prov-datepicker-grid--locked">
                {cells.map((day, idx) =>
                  day === null ? (
                    <span key={`e-${idx}`} className="prov-datepicker-empty" />
                  ) : (
                    <span key={day} className="prov-datepicker-day prov-datepicker-day--disabled prov-datepicker-day--past">
                      {day}
                    </span>
                  )
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Day-of-week labels */}
              <div className="prov-datepicker-dow-row">
                {DAY_LABELS.map((l) => (
                  <span key={l} className="prov-datepicker-dow">{l}</span>
                ))}
              </div>

              {/* Day grid */}
              <div className="prov-datepicker-grid">
                {cells.map((day, idx) =>
                  day === null ? (
                    <span key={`e-${idx}`} className="prov-datepicker-empty" />
                  ) : (
                    <button
                      key={day}
                      type="button"
                      disabled={isDayDisabled(day)}
                      onClick={() => !isDayDisabled(day) && selectDay(day)}
                      className={[
                        'prov-datepicker-day',
                        isSelected(day) ? 'prov-datepicker-day--selected' : '',
                        isHighlighted(day) && !isSelected(day) ? 'prov-datepicker-day--highlighted' : '',
                        isTodayDay(day) && !isSelected(day) && !isHighlighted(day) ? 'prov-datepicker-day--today' : '',
                        isPast(day) ? 'prov-datepicker-day--past' : '',
                        isDayDisabled(day) ? 'prov-datepicker-day--disabled' : '',
                      ].filter(Boolean).join(' ')}
                    >
                      {day}
                    </button>
                  )
                )}
              </div>

              {/* Legend for highlighted date */}
              {highlightD && (
                <div className="prov-datepicker-legend">
                  <span className="prov-datepicker-legend-dot prov-datepicker-legend-dot--highlight" />
                  <span>Issue date</span>
                  <span className="prov-datepicker-legend-dot prov-datepicker-legend-dot--selected" />
                  <span>Expiry date</span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
