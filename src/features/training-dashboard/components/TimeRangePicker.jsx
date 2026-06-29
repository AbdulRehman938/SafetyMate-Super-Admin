import React, { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Clock } from 'lucide-react'

/**
 * TimeRangePicker - Custom component for selecting start and end times
 * Displays a clock-like interface for selecting hours and minutes
 */
export function TimeRangePicker({ value, onChange, label }) {
  const [isOpen, setIsOpen] = useState(false)
  const [dropdownStyle, setDropdownStyle] = useState({})
  const triggerRef = useRef(null)
  const dropdownRef = useRef(null)
  const [validationError, setValidationError] = useState('')
  
  // Parse value like "09:00 AM - 05:00 PM" into start and end times
  const parseTimeRange = (timeStr) => {
    if (!timeStr) return { startHour: 9, startMin: 0, startPeriod: 'AM', endHour: 5, endMin: 0, endPeriod: 'PM' }
    
    const parts = timeStr.split(' - ')
    if (parts.length !== 2) return { startHour: 9, startMin: 0, startPeriod: 'AM', endHour: 5, endMin: 0, endPeriod: 'PM' }
    
    const parseTime = (t) => {
      const match = t.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i)
      if (!match) return { hour: 9, min: 0, period: 'AM' }
      return { hour: parseInt(match[1]), min: parseInt(match[2]), period: match[3].toUpperCase() }
    }
    
    const start = parseTime(parts[0])
    const end = parseTime(parts[1])
    
    return { startHour: start.hour, startMin: start.min, startPeriod: start.period, endHour: end.hour, endMin: end.min, endPeriod: end.period }
  }
  
  const { startHour, startMin, startPeriod, endHour, endMin, endPeriod } = parseTimeRange(value)
  
  const [tempStartHour, setTempStartHour] = useState(startHour)
  const [tempStartMin, setTempStartMin] = useState(startMin)
  const [tempStartPeriod, setTempStartPeriod] = useState(startPeriod)
  const [tempEndHour, setTempEndHour] = useState(endHour)
  const [tempEndMin, setTempEndMin] = useState(endMin)
  const [tempEndPeriod, setTempEndPeriod] = useState(endPeriod)
  
  // Position dropdown using portal
  const repositionDropdown = useCallback(() => {
    if (!triggerRef.current) return
    const trigger = triggerRef.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    
    let top = trigger.bottom + 8
    let left = trigger.left
    const width = Math.max(trigger.width, 320)
    
    if (left + width > vw - 12) left = vw - width - 12
    if (left < 12) left = 12
    
    setDropdownStyle({
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      width: `${width}px`,
      zIndex: 9999
    })
  }, [])
  
  useEffect(() => {
    if (isOpen) {
      repositionDropdown()
      window.addEventListener('scroll', repositionDropdown, true)
      window.addEventListener('resize', repositionDropdown)
    }
    return () => {
      window.removeEventListener('scroll', repositionDropdown, true)
      window.removeEventListener('resize', repositionDropdown)
    }
  }, [isOpen, repositionDropdown])
  
  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target)) {
        // Check if click is inside the dropdown itself (rendered via portal)
        if (dropdownRef.current && dropdownRef.current.contains(e.target)) return
        
        // Check if click is inside another dropdown/interactive element
        const closestDropdown = e.target.closest('.prov-custom-select-dropdown, [role="dialog"], [role="listbox"]')
        if (closestDropdown) return
        
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handler)
    }
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen])
  
  const formatTime = (hour, min, period) => {
    const h = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')} ${period}`
  }
  
  // Convert time to minutes since midnight for comparison
  const timeToMinutes = (hour, min, period) => {
    let h = hour
    if (period === 'PM' && hour !== 12) h += 12
    if (period === 'AM' && hour === 12) h = 0
    return h * 60 + min
  }
  
  const validateTimes = () => {
    // Check if any field is empty
    if (tempStartHour === '' || tempStartMin === '' || tempEndHour === '' || tempEndMin === '') {
      setValidationError('Please fill in all time fields')
      return false
    }
    
    const startMins = timeToMinutes(tempStartHour, tempStartMin, tempStartPeriod)
    const endMins = timeToMinutes(tempEndHour, tempEndMin, tempEndPeriod)
    
    if (endMins <= startMins) {
      setValidationError('End time must be after start time')
      return false
    }
    
    setValidationError('')
    return true
  }
  
  const handleApply = () => {
    if (!validateTimes()) return
    
    const startStr = formatTime(tempStartHour, tempStartMin, tempStartPeriod)
    const endStr = formatTime(tempEndHour, tempEndMin, tempEndPeriod)
    onChange(`${startStr} - ${endStr}`)
    setIsOpen(false)
    setValidationError('')
  }
  
  const handleCancel = () => {
    setTempStartHour(startHour)
    setTempStartMin(startMin)
    setTempStartPeriod(startPeriod)
    setTempEndHour(endHour)
    setTempEndMin(endMin)
    setTempEndPeriod(endPeriod)
    setIsOpen(false)
  }
  
  const TimeSelector = ({ hour, min, period, onHourChange, onMinChange, onPeriodChange, label }) => (
    <div className="time-selector">
      <div className="time-selector-label">{label}</div>
      <div className="time-selector-controls">
        <div className="time-input-group">
          <input
            type="number"
            min="1"
            max="12"
            value={hour}
            onChange={(e) => {
              const value = e.target.value
              if (value === '') {
                onHourChange('')
              } else {
                const num = parseInt(value)
                if (num >= 1 && num <= 12) {
                  onHourChange(num)
                }
              }
            }}
            className="time-input"
            placeholder="HH"
          />
          <span className="time-separator">:</span>
          <input
            type="number"
            min="0"
            max="59"
            value={min}
            onChange={(e) => {
              const value = e.target.value
              if (value === '') {
                onMinChange('')
              } else {
                const num = parseInt(value)
                if (num >= 0 && num <= 59) {
                  onMinChange(num)
                }
              }
            }}
            className="time-input"
            placeholder="MM"
          />
        </div>
        <div className="period-toggle">
          <button
            type="button"
            className={`period-btn ${period === 'AM' ? 'period-btn--active' : ''}`}
            onClick={() => onPeriodChange('AM')}
          >
            AM
          </button>
          <button
            type="button"
            className={`period-btn ${period === 'PM' ? 'period-btn--active' : ''}`}
            onClick={() => onPeriodChange('PM')}
          >
            PM
          </button>
        </div>
      </div>
    </div>
  )
  
  return (
    <div className="time-range-picker" ref={triggerRef}>
      {label && <label className="sched-label">{label}</label>}
      <button
        type="button"
        className="time-range-trigger"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Clock size={16} className="time-range-icon" />
        <span className="time-range-value">{value || 'Select time range'}</span>
      </button>
      
      {isOpen && createPortal(
        <div className="time-range-dropdown" style={dropdownStyle} ref={dropdownRef}>
          <div className="time-range-content">
            <TimeSelector
              label="Start Time"
              hour={tempStartHour}
              min={tempStartMin}
              period={tempStartPeriod}
              onHourChange={setTempStartHour}
              onMinChange={setTempStartMin}
              onPeriodChange={setTempStartPeriod}
            />
            <div className="time-range-divider">to</div>
            <TimeSelector
              label="End Time"
              hour={tempEndHour}
              min={tempEndMin}
              period={tempEndPeriod}
              onHourChange={setTempEndHour}
              onMinChange={setTempEndMin}
              onPeriodChange={setTempEndPeriod}
            />
          </div>
          {validationError && (
            <div className="time-range-error">
              {validationError}
            </div>
          )}
          <div className="time-range-actions">
            <button type="button" className="time-range-btn time-range-btn--cancel" onClick={handleCancel}>
              Cancel
            </button>
            <button type="button" className="time-range-btn time-range-btn--apply" onClick={handleApply}>
              Apply
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
