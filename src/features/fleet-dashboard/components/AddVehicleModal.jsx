import React, { useState } from 'react'
import { X, Truck } from 'lucide-react'

const EMPTY = {
  unitId: '', vehicleType: '', category: '', driverName: '',
  site: '', fuelLevel: '', mileageKm: '', crewAssigned: false,
  lat: '', lng: '',
}

export function AddVehicleModal({ onClose, onSave, loading }) {
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  const validate = () => {
    const e = {}
    if (!form.unitId.trim())      e.unitId      = 'Unit ID is required'
    if (!form.vehicleType.trim()) e.vehicleType = 'Type is required'
    return e
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const e2 = validate()
    if (Object.keys(e2).length) { setErrors(e2); return }
    const data = {
      ...form,
      fuelLevel:  form.fuelLevel  ? Number(form.fuelLevel)  : null,
      mileageKm:  form.mileageKm  ? Number(form.mileageKm)  : null,
      lat: form.lat ? Number(form.lat) : null,
      lng: form.lng ? Number(form.lng) : null,
      status: 'active',
      healthScore: 100,
    }
    await onSave(data)
    onClose()
  }

  return (
    <div className="fleet-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="fleet-modal" role="dialog" aria-modal="true" aria-label="Add vehicle">
        <h3 className="fleet-modal-title">
          <Truck size={18} style={{ color: '#3a82ff' }} />
          Register New Vehicle
          <button type="button" className="fleet-modal-close" onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </h3>

        <form onSubmit={handleSubmit} noValidate>
          <div className="fleet-form-row">
            <div className="fleet-form-group">
              <label className="fleet-form-label" htmlFor="fv-unitId">Unit ID *</label>
              <input id="fv-unitId" className="fleet-form-input" placeholder="e.g. VX-702"
                value={form.unitId} onChange={(e) => set('unitId', e.target.value)} />
              {errors.unitId && <span style={{ fontSize: '11px', color: '#f87171' }}>{errors.unitId}</span>}
            </div>
            <div className="fleet-form-group">
              <label className="fleet-form-label" htmlFor="fv-type">Vehicle Type *</label>
              <select id="fv-type" className="fleet-form-select"
                value={form.vehicleType} onChange={(e) => set('vehicleType', e.target.value)}>
                <option value="">Select type</option>
                <option>Hauler</option>
                <option>Utility</option>
                <option>Support</option>
                <option>Tanker</option>
                <option>Crane</option>
                <option>Bus</option>
                <option>Light Vehicle</option>
              </select>
              {errors.vehicleType && <span style={{ fontSize: '11px', color: '#f87171' }}>{errors.vehicleType}</span>}
            </div>
          </div>

          <div className="fleet-form-row">
            <div className="fleet-form-group">
              <label className="fleet-form-label" htmlFor="fv-cat">Category</label>
              <select id="fv-cat" className="fleet-form-select"
                value={form.category} onChange={(e) => set('category', e.target.value)}>
                <option value="">Select category</option>
                <option>Heavy Duty</option>
                <option>Standard</option>
                <option>Support</option>
                <option>Emergency</option>
              </select>
            </div>
            <div className="fleet-form-group">
              <label className="fleet-form-label" htmlFor="fv-driver">Assigned Driver</label>
              <input id="fv-driver" className="fleet-form-input" placeholder="Driver name"
                value={form.driverName} onChange={(e) => set('driverName', e.target.value)} />
            </div>
          </div>

          <div className="fleet-form-row">
            <div className="fleet-form-group">
              <label className="fleet-form-label" htmlFor="fv-site">Site / Location</label>
              <input id="fv-site" className="fleet-form-input" placeholder="Site name"
                value={form.site} onChange={(e) => set('site', e.target.value)} />
            </div>
            <div className="fleet-form-group">
              <label className="fleet-form-label" htmlFor="fv-fuel">Fuel Level (%)</label>
              <input id="fv-fuel" type="number" min="0" max="100" className="fleet-form-input"
                placeholder="0–100" value={form.fuelLevel} onChange={(e) => set('fuelLevel', e.target.value)} />
            </div>
          </div>

          <div className="fleet-form-row">
            <div className="fleet-form-group">
              <label className="fleet-form-label" htmlFor="fv-km">Mileage (km)</label>
              <input id="fv-km" type="number" min="0" className="fleet-form-input"
                placeholder="0" value={form.mileageKm} onChange={(e) => set('mileageKm', e.target.value)} />
            </div>
            <div className="fleet-form-group">
              <label className="fleet-form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.crewAssigned}
                  onChange={(e) => set('crewAssigned', e.target.checked)} />
                Crew Assigned
              </label>
            </div>
          </div>

          <div className="fleet-form-row">
            <div className="fleet-form-group">
              <label className="fleet-form-label" htmlFor="fv-lat">GPS Latitude</label>
              <input id="fv-lat" type="number" step="any" className="fleet-form-input"
                placeholder="e.g. -26.2041" value={form.lat} onChange={(e) => set('lat', e.target.value)} />
            </div>
            <div className="fleet-form-group">
              <label className="fleet-form-label" htmlFor="fv-lng">GPS Longitude</label>
              <input id="fv-lng" type="number" step="any" className="fleet-form-input"
                placeholder="e.g. 28.0473" value={form.lng} onChange={(e) => set('lng', e.target.value)} />
            </div>
          </div>

          <div className="fleet-modal-actions">
            <button type="button" className="fleet-btn fleet-btn--muted" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="fleet-btn fleet-btn--primary" disabled={loading}>
              {loading ? <span className="fleet-spinner" /> : null}
              Register Vehicle
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
