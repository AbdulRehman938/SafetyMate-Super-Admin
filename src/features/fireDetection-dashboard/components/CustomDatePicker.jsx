import { useState, useRef, useEffect } from 'react'
import { Calendar, X } from 'lucide-react'

export function CustomDatePicker({ label, value, onChange, placeholder, required, minDate, maxDate }) {
  const [isOpen, setIsOpen] = useState(false)
  // tempDate tracks the in-picker selection; initialised from the external value prop
  const [tempDate, setTempDate] = useState(value || '')
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 })
  const triggerRef = useRef(null)
  const dropdownRef = useRef(null)

  // Compute position and toggle open
  const handleOpen = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setDropdownPos({ top: rect.bottom - 2, left: rect.left - 10, width: rect.width })
    }
    setIsOpen((v) => !v)
  }

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return
    function onMouseDown(e) {
      if (triggerRef.current && triggerRef.current.contains(e.target)) return
      if (dropdownRef.current && dropdownRef.current.contains(e.target)) return
      setIsOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [isOpen])

  const handleDateClick = (day) => {
    const selectedDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
    if (maxDate) {
      const max = new Date(maxDate)
      max.setHours(23, 59, 59, 999)
      if (selectedDate > max) return
    }
    if (minDate) {
      const min = new Date(minDate)
      min.setHours(0, 0, 0, 0)
      if (selectedDate < min) return
    }
    setTempDate(selectedDate.toISOString().split('T')[0])
  }

  const handleApply = () => {
    if (!tempDate) return
    onChange(tempDate)
    setIsOpen(false)
  }

  const handleClear = () => {
    setTempDate('')
    onChange('')
    setIsOpen(false)
  }

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate()
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay()
  const days = []
  for (let i = 0; i < firstDayOfMonth; i++) days.push(null)
  for (let i = 1; i <= daysInMonth; i++) days.push(i)

  const monthNames = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ]

  const isDayDisabled = (day) => {
    if (!day) return false
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (date < today) return true
    if (maxDate) {
      const max = new Date(maxDate); max.setHours(23,59,59,999)
      if (date > max) return true
    }
    if (minDate) {
      const min = new Date(minDate); min.setHours(0,0,0,0)
      if (date < min) return true
    }
    return false
  }

  const buildDayStr = (day) => {
    if (!day) return ''
    return `${currentMonth.getFullYear()}-${String(currentMonth.getMonth()+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
  }

  // Dropdown size constants
  const DROPDOWN_H = 340
  const DROPDOWN_W = 296
  const GAP = 6

  const pinnedTop = dropdownPos.top
  const pinnedLeft = dropdownPos.left

  return (
    <div className="fd-date-picker-wrapper" style={{ position: 'relative' }}>
      {label && (
        <label className="fd-reg-label">
          {label}
          {required && <span style={{ color: '#ff535f', marginLeft: 4 }}>*</span>}
        </label>
      )}

      {/* ── Trigger ── */}
      <div
        ref={triggerRef}
        className="fd-date-picker-input"
        onClick={handleOpen}
      >
        <Calendar size={14} style={{ flexShrink: 0, color: 'rgba(148,163,184,0.6)' }} />
        <span>
          {tempDate || placeholder}
        </span>
        {tempDate && (
          <X
            size={12}
            onClick={(e) => { e.stopPropagation(); handleClear() }}
          />
        )}
      </div>

      {/* ── Calendar dropdown — absolute, right below trigger ── */}
      {isOpen && (
        <div
          ref={dropdownRef}
          style={{
            position: 'absolute',
            top: '100%',
            left: -20,
            marginTop: 6,
            width: 'calc(100% + 40px)',
            background: '#0b0f1a',
            border: '1px solid rgba(255,255,255,0.13)',
            borderRadius: 12,
            padding: 16,
            boxShadow: '0 8px 40px rgba(0,0,0,0.75), 0 4px 16px rgba(0,0,0,0.5)',
            zIndex: 999999,
            animation: 'fd-dropdown-down 0.18s cubic-bezier(0.16,1,0.3,1) forwards',
          }}
        >
          {/* Month navigation */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <button type="button" className="fd-date-picker-nav" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth()-1))}>‹</button>
            <span style={{ fontSize:13, fontWeight:700, color:'rgba(235,242,255,0.9)' }}>
              {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </span>
            <button type="button" className="fd-date-picker-nav" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth()+1))}>›</button>
            <button type="button" className="fd-date-picker-close" onClick={() => setIsOpen(false)}><X size={14} /></button>
          </div>

          {/* Day grid */}
          <div className="fd-date-picker-grid">
            {['Su','Mo','Tu','We','Th','Fr','Sa'].map((d) => (
              <div key={d} className="fd-date-picker-day-name">{d}</div>
            ))}
            {days.map((day, idx) => (
              <button
                key={idx}
                type="button"
                className={[
                  'fd-date-picker-day',
                  tempDate === buildDayStr(day) ? 'fd-date-picker-day--selected' : '',
                  isDayDisabled(day) ? 'fd-date-picker-day--disabled' : ''
                ].filter(Boolean).join(' ')}
                onClick={() => handleDateClick(day)}
                disabled={!day || isDayDisabled(day)}
              >
                {day}
              </button>
            ))}
          </div>

          {/* Footer */}
          <div className="fd-date-picker-footer">
            <button type="button" className="fd-btn fd-btn--ghost" onClick={() => setIsOpen(false)}>Cancel</button>
            <button type="button" className="fd-btn fd-btn--primary" onClick={handleApply} disabled={!tempDate}>Apply</button>
          </div>
        </div>
      )}
    </div>
  )
}
