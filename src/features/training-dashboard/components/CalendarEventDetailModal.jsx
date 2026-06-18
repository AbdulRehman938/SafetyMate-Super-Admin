import React, { useState, useEffect } from 'react'
import { X, Calendar, Clock, MapPin, User, Users, ShieldAlert } from 'lucide-react'

export function CalendarEventDetailModal({ isOpen, onClose, event, onUpdate, onComplete, onDelete }) {
  const [classroom, setClassroom] = useState('')
  const [instructor, setInstructor] = useState('')
  const [priority, setPriority] = useState('Active')
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    if (event) {
      setClassroom(event.classroom || '')
      setInstructor(event.instructor || '')
      setPriority(event.priority || 'Active')
      setIsEditing(false)
    }
  }, [event, isOpen])

  if (!isOpen || !event) return null

  const handleSave = () => {
    onUpdate(event.id, { classroom, instructor, priority })
    setIsEditing(false)
  }

  const handleComplete = () => { onComplete(event.id); onClose() }

  const handleDelete = () => {
    if (window.confirm('Cancel this training deployment? It will be removed from the schedule.')) {
      onDelete(event.id); onClose()
    }
  }

  const priorityColor =
    event.priority === 'High Priority' ? '#f87171'
    : event.priority === 'Completed' ? '#4deba0'
    : '#3a82ff'

  return (
    <div className="cal-modal-overlay" onClick={onClose}>
      <div className="cal-modal" onClick={(e) => e.stopPropagation()}>

        {/* Drag handle (mobile) */}
        <div className="cal-modal-handle" />

        {/* Header */}
        <div className="cal-modal-header">
          <div className="cal-modal-header-left">
            <span className="cal-modal-priority-dot" style={{ background: priorityColor }} />
            <span className="cal-modal-header-label">Deployment Details</span>
          </div>
          <button type="button" className="cal-modal-close" onClick={onClose} aria-label="Close">
            <X size={17} />
          </button>
        </div>

        {/* Title */}
        <div className="cal-modal-title-block">
          <h2 className="cal-modal-course">{event.course}</h2>
          <p className="cal-modal-company">{event.company}</p>
        </div>

        {/* Detail / Edit body */}
        {!isEditing ? (
          <div className="cal-modal-details">
            {[
              { Icon: Calendar, value: event.preferredDate },
              { Icon: Clock,    value: event.timeDetail || 'TBD' },
              { Icon: MapPin,   value: event.classroom || 'Not assigned' },
              { Icon: User,     value: event.instructor || 'Not assigned' },
              { Icon: Users,    value: `${event.workers || 0} Workforce Candidates` },
              { Icon: ShieldAlert, value: event.priority || 'Active', colored: true },
            ].map(({ Icon, value, colored }, i) => (
              <div key={i} className="cal-modal-detail-row">
                <Icon size={14} className="cal-modal-detail-icon" />
                <span className="cal-modal-detail-val" style={colored ? { color: priorityColor, fontWeight: 700 } : undefined}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="cal-modal-edit-form">
            <div className="cal-modal-edit-field">
              <label className="cal-modal-edit-label">Classroom / Room</label>
              <input type="text" value={classroom} onChange={(e) => setClassroom(e.target.value)} className="cal-modal-edit-input" />
            </div>
            <div className="cal-modal-edit-field">
              <label className="cal-modal-edit-label">Instructor</label>
              <input type="text" value={instructor} onChange={(e) => setInstructor(e.target.value)} className="cal-modal-edit-input" />
            </div>
            <div className="cal-modal-edit-field">
              <label className="cal-modal-edit-label">Status Category</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className="cal-modal-edit-select">
                <option value="Active">Active Course (Blue)</option>
                <option value="Completed">Completed (Green)</option>
                <option value="High Priority">High Priority (Red)</option>
              </select>
            </div>
          </div>
        )}

        {/* Action footer */}
        <div className="cal-modal-footer">
          <div>
            {!isEditing
              ? <button type="button" className="cal-modal-btn cal-modal-btn--ghost" onClick={() => setIsEditing(true)}>Edit</button>
              : <button type="button" className="cal-modal-btn cal-modal-btn--save" onClick={handleSave}>Save</button>
            }
          </div>
          <div className="cal-modal-footer-right">
            {event.status !== 'completed' && (
              <button type="button" className="cal-modal-btn cal-modal-btn--complete" onClick={handleComplete}>
                Mark Completed
              </button>
            )}
            <button type="button" className="cal-modal-btn cal-modal-btn--danger" onClick={handleDelete}>
              Cancel Course
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
