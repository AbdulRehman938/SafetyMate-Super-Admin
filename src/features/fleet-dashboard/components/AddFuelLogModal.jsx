import React, { useState } from 'react'
import { X, Fuel } from 'lucide-react'

export function AddFuelLogModal({ vehicles = [], onClose, onSave, loading }) {
  const [form, setForm] = useState({
    vehicleId: '', litres: '', costPerLitre: '', station: '', odometer: '',
  })
  const [errors, setErrors] = useState({})
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  const validate = () => {
    const e = {}
    if (!form.vehicleId) e.vehicleId = 'Select a vehicle'
    if (!form.litres || isNaN(Number(form.litres))) e.litres = 'Enter valid litres'
    return e
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const e2 = validate()
    if (Object.keys(e2).length) { setErrors(e2); return }
    await onSave({
      vehicleId: form.vehicleId,
      litres: Number(form.litres),
      costPerLitre: form.costPerLitre ? Number(form.costPerLitre) : null,
      totalCost: form.litres && form.costPerLitre
        ? Number(form.litres) * Number(form.costPerLitre)
        : null,
      station: form.station,
      odometer: form.odometer ? Number(form.odometer) : null,
    })
    onClose()
  }

  return (
    <div className="fleet-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="fleet-modal" role="dialog" aria-modal="true" aria-label="Log fuel">
        <h3 className="fleet-modal-title">
          <Fuel size={18} style={{ color: '#3a82ff' }} />
          Log Fuel Fill
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
              <label className="fleet-form-label">Litres *</label>
              <input type="number" min="0" step="0.1" className="fleet-form-input"
                placeholder="e.g. 80" value={form.litres} onChange={(e) => set('litres', e.target.value)} />
              {errors.litres && <span style={{ fontSize: '11px', color: '#f87171' }}>{errors.litres}</span>}
            </div>
            <div className="fleet-form-group">
              <label className="fleet-form-label">Cost per Litre</label>
              <input type="number" min="0" step="0.01" className="fleet-form-input"
                placeholder="e.g. 22.50" value={form.costPerLitre} onChange={(e) => set('costPerLitre', e.target.value)} />
            </div>
          </div>

          <div className="fleet-form-row">
            <div className="fleet-form-group">
              <label className="fleet-form-label">Fuel Station</label>
              <input className="fleet-form-input" placeholder="Station name"
                value={form.station} onChange={(e) => set('station', e.target.value)} />
            </div>
            <div className="fleet-form-group">
              <label className="fleet-form-label">Odometer (km)</label>
              <input type="number" min="0" className="fleet-form-input"
                placeholder="Current km reading" value={form.odometer} onChange={(e) => set('odometer', e.target.value)} />
            </div>
          </div>

          <div className="fleet-modal-actions">
            <button type="button" className="fleet-btn fleet-btn--muted" onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" className="fleet-btn fleet-btn--primary" disabled={loading}>
              {loading && <span className="fleet-spinner" />}
              Save Fuel Log
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
