import React, { useState } from 'react'
import { X, ClipboardList } from 'lucide-react'

export function AddInspectionModal({ vehicles = [], onClose, onSave, loading, defaultVehicleId = '' }) {
  const [form, setForm] = useState({
    vehicleId: defaultVehicleId, inspectionType: 'Pre-trip', outcome: 'pass',
    inspector: '', notes: '',
  })
  const [errors, setErrors] = useState({})
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  const validate = () => {
    const e = {}
    if (!form.vehicleId)       e.vehicleId      = 'Select a vehicle'
    if (!form.inspector.trim()) e.inspector      = 'Inspector name required'
    return e
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const e2 = validate()
    if (Object.keys(e2).length) { setErrors(e2); return }
    await onSave(form)
    onClose()
  }

  return (
    <div className="fleet-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="fleet-modal" role="dialog" aria-modal="true" aria-label="Log inspection">
        <h3 className="fleet-modal-title">
          <ClipboardList size={18} style={{ color: '#3a82ff' }} />
          Log Inspection
          <button type="button" className="fleet-modal-close" onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </h3>
        <form onSubmit={handleSubmit} noValidate>
          <div className="fleet-form-group">
            <label className="fleet-form-label">Vehicle *</label>
            <select className="fleet-form-select" value={form.vehicleId} onChange={(e) => set('vehicleId', e.target.value)}>
              <option value="">Select vehicle</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>{v.unitId || v.id}</option>
              ))}
            </select>
            {errors.vehicleId && <span style={{ fontSize: '11px', color: '#f87171' }}>{errors.vehicleId}</span>}
          </div>

          <div className="fleet-form-row">
            <div className="fleet-form-group">
              <label className="fleet-form-label">Type</label>
              <select className="fleet-form-select" value={form.inspectionType} onChange={(e) => set('inspectionType', e.target.value)}>
                <option>Pre-trip</option>
                <option>Post-trip</option>
                <option>Scheduled Service</option>
                <option>Roadworthy</option>
                <option>Emergency</option>
              </select>
            </div>
            <div className="fleet-form-group">
              <label className="fleet-form-label">Outcome</label>
              <select className="fleet-form-select" value={form.outcome} onChange={(e) => set('outcome', e.target.value)}>
                <option value="pass">Pass</option>
                <option value="fail">Fail</option>
                <option value="conditional">Conditional</option>
              </select>
            </div>
          </div>

          <div className="fleet-form-group">
            <label className="fleet-form-label">Inspector *</label>
            <input className="fleet-form-input" placeholder="Inspector full name"
              value={form.inspector} onChange={(e) => set('inspector', e.target.value)} />
            {errors.inspector && <span style={{ fontSize: '11px', color: '#f87171' }}>{errors.inspector}</span>}
          </div>

          <div className="fleet-form-group">
            <label className="fleet-form-label">Notes</label>
            <textarea className="fleet-form-textarea" placeholder="Inspection findings or remarks…"
              value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>

          <div className="fleet-modal-actions">
            <button type="button" className="fleet-btn fleet-btn--muted" onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" className="fleet-btn fleet-btn--primary" disabled={loading}>
              {loading && <span className="fleet-spinner" />}
              Save Inspection
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
