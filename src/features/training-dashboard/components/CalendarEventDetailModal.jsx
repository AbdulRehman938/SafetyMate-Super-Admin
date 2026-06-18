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
    onUpdate(event.id, {
      classroom,
      instructor,
      priority,
    })
    setIsEditing(false)
  }

  const handleComplete = () => {
    onComplete(event.id)
    onClose()
  }

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to cancel this training deployment? This will remove it from the schedule.')) {
      onDelete(event.id)
      onClose()
    }
  }

  const priorityColor =
    event.priority === 'High Priority' ? '#f87171' : event.priority === 'Completed' ? '#4deba0' : '#3a82ff'

  return (
    <div className="prov-modal-overlay">
      <div className="prov-modal" style={{ maxWidth: '460px' }}>
        <div className="prov-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 className="prov-modal-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: priorityColor }} />
            Deployment Details
          </h3>
          <button type="button" onClick={onClose} className="prov-modal-close-btn" style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '800', margin: '0 0 6px 0', color: '#fff' }}>{event.course}</h2>
          <p style={{ fontSize: '13px', color: '#3b82f6', fontWeight: 600, margin: '0 0 16px 0' }}>{event.company}</p>

          {!isEditing ? (
            <div style={{ display: 'grid', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#cbd5e1' }}>
                <Calendar size={15} style={{ color: '#94a3b8' }} />
                <span>{event.preferredDate}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#cbd5e1' }}>
                <Clock size={15} style={{ color: '#94a3b8' }} />
                <span>{event.timeDetail || 'TBD'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#cbd5e1' }}>
                <MapPin size={15} style={{ color: '#94a3b8' }} />
                <span>{event.classroom || 'Not assigned'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#cbd5e1' }}>
                <User size={15} style={{ color: '#94a3b8' }} />
                <span>{event.instructor || 'Not assigned'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#cbd5e1' }}>
                <Users size={15} style={{ color: '#94a3b8' }} />
                <span>{event.workers || 0} Workforce Candidates</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#cbd5e1' }}>
                <ShieldAlert size={15} style={{ color: '#94a3b8' }} />
                <span style={{ color: priorityColor, fontWeight: 700 }}>{event.priority || 'Active'}</span>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>Classroom / Room</label>
                <input
                  type="text"
                  value={classroom}
                  onChange={(e) => setClassroom(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', background: '#0a0e1c', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', color: '#fff', fontSize: '13px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>Instructor</label>
                <input
                  type="text"
                  value={instructor}
                  onChange={(e) => setInstructor(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', background: '#0a0e1c', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', color: '#fff', fontSize: '13px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>Status Category</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', background: '#0a0e1c', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', color: '#fff', fontSize: '13px' }}
                >
                  <option value="Active">Active Course (Blue)</option>
                  <option value="Completed">Completed (Green)</option>
                  <option value="High Priority">High Priority (Red)</option>
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="prov-modal-actions" style={{ display: 'flex', gap: '10px', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px', marginTop: '16px' }}>
          <div>
            {!isEditing ? (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                style={{ padding: '8px 14px', background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '6px', color: '#cbd5e1', cursor: 'pointer', fontSize: '12px' }}
              >
                Edit
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSave}
                style={{ padding: '8px 14px', background: '#10b981', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
              >
                Save
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {event.status !== 'completed' && (
              <button
                type="button"
                onClick={handleComplete}
                style={{ padding: '8px 14px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '6px', color: '#4deba0', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
              >
                Mark Completed
              </button>
            )}
            <button
              type="button"
              onClick={handleDelete}
              style={{ padding: '8px 14px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', color: '#f87171', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
            >
              Cancel Course
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
