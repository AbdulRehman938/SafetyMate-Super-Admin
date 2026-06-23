import React, { useState } from 'react'
import { Camera, Info, Check, X, Fingerprint, Settings, MapPin, Calendar } from 'lucide-react'
import { CustomSelect } from '../../training-dashboard/components/CustomSelect.jsx'
import { CustomDatePicker } from '../../training-dashboard/components/CustomDatePicker.jsx'
import '../fleet.css'

export function RegisterVehiclePage({ onSave, onCancel, loading }) {
  const [form, setForm] = useState({
    plateNumber: '',
    modelName: '',
    vin: '',
    year: '',
    engineType: 'Internal Combustion (ICE)',
    fuelCapacity: '',
    initialOdometer: '',
    assignedSite: 'Obsidian Hub Alpha',
    assignedDepartment: 'Rapid Response Fleet',
    lastServiceDate: '',
    nextInspectionDate: '',
    image: null
  })

  const [errors, setErrors] = useState({})

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  const validate = () => {
    const e = {}
    if (!form.plateNumber.trim()) e.plateNumber = 'Plate Number is required'
    if (!form.modelName.trim()) e.modelName = 'Model Name is required'
    if (!form.vin.trim()) e.vin = 'VIN number is required'
    if (form.vin.trim().length !== 17) e.vin = 'VIN must be exactly 17 characters'
    if (!form.initialOdometer) e.initialOdometer = 'Odometer reading is required'
    return e
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const e2 = validate()
    if (Object.keys(e2).length) {
      setErrors(e2)
      return
    }

    const data = {
      unitId: form.plateNumber.toUpperCase(),
      plateNumber: form.plateNumber.toUpperCase(),
      model: form.modelName,
      vin: form.vin.toUpperCase(),
      year: form.year ? Number(form.year) : null,
      vehicleType: form.modelName.toLowerCase().includes('hauler') ? 'Hauler' : 'Utility',
      engineType: form.engineType,
      fuelCapacity: form.fuelCapacity ? Number(form.fuelCapacity) : null,
      mileageKm: Number(form.initialOdometer),
      site: form.assignedSite,
      department: form.assignedDepartment,
      lastService: form.lastServiceDate ? new Date(form.lastServiceDate) : null,
      nextService: form.nextInspectionDate ? new Date(form.nextInspectionDate) : null,
      image: form.image,
      status: 'active',
      healthScore: 100,
      fuelLevel: 100,
      lat: -26.2041 + (Math.random() - 0.5) * 0.03,
      lng: 28.0473 + (Math.random() - 0.5) * 0.03,
    }

    await onSave(data)
  }

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => set('image', reader.result)
      reader.readAsDataURL(file)
    }
  }

  return (
    /* ── Outer shell: flex column, fills parent height, no scroll ── */
    <div
      className="fleet-register-page"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        color: '#ffffff',
      }}
    >
      {/* ── Header bar (non-scrolling) ── */}
      <div style={{ padding: '24px 28px 16px', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ margin: '0 0 6px', fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em', color: '#ffffff' }}>
            Register New Vehicle
          </h1>
          <p style={{ margin: 0, fontSize: '13px', color: 'rgba(148, 163, 184, 0.75)', fontWeight: 600, maxWidth: '600px' }}>
            Initialize a high-fidelity Digital Twin for fleet assets. Compliance per DOCUMENT_55 mission-critical registration requirements.
          </p>
        </div>

        {/* Active Session Pill */}
        <div style={{
          background: 'rgba(58, 130, 255, 0.08)',
          border: '1px solid rgba(58, 130, 255, 0.2)',
          color: '#3a82ff',
          padding: '6px 14px',
          borderRadius: '999px',
          fontSize: '10px',
          fontWeight: 800,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          boxShadow: '0 0 15px rgba(58, 130, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#3a82ff', boxShadow: '0 0 8px #3a82ff' }} />
          ACTIVE SESSION
        </div>
      </div>

      {/* ── Scrollable form body ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 28px 24px', scrollbarWidth: 'thin', scrollbarColor: 'rgba(58,130,255,0.2) transparent' }}>
        <form
          id="register-vehicle-form"
          onSubmit={handleSubmit}
          noValidate
          className="fleet-register-form"
          style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px' }}
        >

          {/* ── Left Column: Specifications ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Card 01: Vehicle Identity */}
            <div className="fleet-section-card" style={{ padding: '24px', position: 'relative' }}>
              <div style={{ position: 'absolute', right: '24px', top: '24px', opacity: 0.05, color: '#ffffff', pointerEvents: 'none' }}>
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <circle cx="9" cy="10" r="2" />
                  <path d="M14 9h4M14 13h4M6 17c0-2 4-3 4-3s4 1 4 3" />
                </svg>
              </div>

              <h3 style={{ margin: '0 0 20px', fontSize: '11px', fontWeight: 800, color: '#3a82ff', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Fingerprint size={14} /> 01. VEHICLE IDENTITY
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '10px', fontWeight: 800, color: 'rgba(148, 163, 184, 0.6)', letterSpacing: '0.08em' }}>PLATE NUMBER</label>
                  <input
                    type="text"
                    value={form.plateNumber}
                    onChange={(e) => set('plateNumber', e.target.value)}
                    placeholder="e.g. OB-2024-MS"
                    style={{ padding: '11px 12px', background: 'rgba(255,255,255,0.03)', border: errors.plateNumber ? '1px solid #ff535f' : '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', color: '#ffffff', fontSize: '13px', outline: 'none' }}
                    required
                  />
                  {errors.plateNumber && <span style={{ fontSize: '11px', color: '#ff535f' }}>{errors.plateNumber}</span>}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '10px', fontWeight: 800, color: 'rgba(148, 163, 184, 0.6)', letterSpacing: '0.08em' }}>MODEL NAME</label>
                  <input
                    type="text"
                    value={form.modelName}
                    onChange={(e) => set('modelName', e.target.value)}
                    placeholder="e.g. Titan-X Heavy Transporter"
                    style={{ padding: '11px 12px', background: 'rgba(255,255,255,0.03)', border: errors.modelName ? '1px solid #ff535f' : '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', color: '#ffffff', fontSize: '13px', outline: 'none' }}
                    required
                  />
                  {errors.modelName && <span style={{ fontSize: '11px', color: '#ff535f' }}>{errors.modelName}</span>}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '10px', fontWeight: 800, color: 'rgba(148, 163, 184, 0.6)', letterSpacing: '0.08em' }}>VIN (IDENTIFICATION NUMBER)</label>
                  <input
                    type="text"
                    value={form.vin}
                    onChange={(e) => set('vin', e.target.value)}
                    maxLength={17}
                    placeholder="17-Digit Alpha-Numeric Code"
                    style={{ padding: '11px 12px', background: 'rgba(255,255,255,0.03)', border: errors.vin ? '1px solid #ff535f' : '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', color: '#ffffff', fontSize: '13px', outline: 'none' }}
                    required
                  />
                  {errors.vin && <span style={{ fontSize: '11px', color: '#ff535f' }}>{errors.vin}</span>}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '10px', fontWeight: 800, color: 'rgba(148, 163, 184, 0.6)', letterSpacing: '0.08em' }}>YEAR OF MANUFACTURE</label>
                  <input
                    type="text"
                    value={form.year}
                    onChange={(e) => set('year', e.target.value)}
                    placeholder="YYYY"
                    style={{ padding: '11px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', color: '#ffffff', fontSize: '13px', outline: 'none' }}
                  />
                </div>
              </div>
            </div>

            {/* Card 02: Technical Specifications */}
            <div className="fleet-section-card" style={{ padding: '24px' }}>
              <h3 style={{ margin: '0 0 20px', fontSize: '11px', fontWeight: 800, color: '#3a82ff', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Settings size={14} /> 02. TECHNICAL SPECIFICATIONS
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '10px', fontWeight: 800, color: 'rgba(148, 163, 184, 0.6)', letterSpacing: '0.08em' }}>ENGINE TYPE</label>
                  <CustomSelect
                    value={form.engineType}
                    onChange={(val) => set('engineType', val)}
                    options={['Internal Combustion (ICE)', 'Electric Vehicle (EV)', 'Hybrid']}
                    placeholder="Select Engine Type"
                    searchable={false}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '10px', fontWeight: 800, color: 'rgba(148, 163, 184, 0.6)', letterSpacing: '0.08em' }}>FUEL CAPACITY (L/KWH)</label>
                  <input
                    type="number"
                    value={form.fuelCapacity}
                    onChange={(e) => set('fuelCapacity', e.target.value)}
                    placeholder="Capacity Value"
                    style={{ padding: '11px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', color: '#ffffff', fontSize: '13px', outline: 'none' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '10px', fontWeight: 800, color: 'rgba(148, 163, 184, 0.6)', letterSpacing: '0.08em' }}>INITIAL ODOMETER</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type="number"
                      value={form.initialOdometer}
                      onChange={(e) => set('initialOdometer', e.target.value)}
                      placeholder="000,000"
                      style={{ width: '100%', padding: '11px 40px 11px 12px', background: 'rgba(255,255,255,0.03)', border: errors.initialOdometer ? '1px solid #ff535f' : '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', color: '#ffffff', fontSize: '13px', outline: 'none' }}
                      required
                    />
                    <span style={{ position: 'absolute', right: '12px', fontSize: '10px', fontWeight: 800, color: 'rgba(148, 163, 184, 0.5)' }}>KM</span>
                  </div>
                  {errors.initialOdometer && <span style={{ fontSize: '11px', color: '#ff535f' }}>{errors.initialOdometer}</span>}
                </div>
              </div>
            </div>

          </div>

          {/* ── Right Column: Image, Operations, Maintenance ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Vehicle Profile Image Card */}
            <div className="fleet-section-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '180px', cursor: 'pointer', position: 'relative', overflow: 'hidden' }}>
              {form.image ? (
                <div style={{ width: '100%', height: '150px', position: 'relative', borderRadius: '8px', overflow: 'hidden' }}>
                  <img src={form.image} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button type="button" onClick={(e) => { e.stopPropagation(); set('image', null) }} style={{ position: 'absolute', right: '8px', top: '8px', background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', cursor: 'pointer' }}>
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', cursor: 'pointer', width: '100%', height: '100%' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(58, 130, 255, 0.08)', border: '1px solid rgba(58, 130, 255, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3a82ff', boxShadow: '0 0 15px rgba(58, 130, 255, 0.08)' }}>
                    <Camera size={18} />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <h4 style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 800, letterSpacing: '0.06em', color: '#ffffff' }}>VEHICLE PROFILE IMAGE</h4>
                    <p style={{ margin: 0, fontSize: '9px', color: 'rgba(148, 163, 184, 0.5)', fontWeight: 600 }}>Recommended: 1200x800 High-Res</p>
                  </div>
                  <input type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
                </label>
              )}
            </div>

            {/* Card 03: Operations */}
            <div className="fleet-section-card" style={{ padding: '20px' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '11px', fontWeight: 800, color: '#3a82ff', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MapPin size={14} /> 03. OPERATIONS
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '10px', fontWeight: 800, color: 'rgba(148, 163, 184, 0.6)', letterSpacing: '0.08em' }}>ASSIGNED SITE</label>
                  <CustomSelect
                    value={form.assignedSite}
                    onChange={(val) => set('assignedSite', val)}
                    options={['Obsidian Hub Alpha', 'Sector 7G - Perimeter', 'East Gate Complex', 'Workshop Bay 3']}
                    placeholder="Select Assigned Site"
                    searchable={true}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '10px', fontWeight: 800, color: 'rgba(148, 163, 184, 0.6)', letterSpacing: '0.08em' }}>ASSIGNED DEPARTMENT</label>
                  <CustomSelect
                    value={form.assignedDepartment}
                    onChange={(val) => set('assignedDepartment', val)}
                    options={['Rapid Response Fleet', 'Operations', 'Logistics', 'Maintenance']}
                    placeholder="Select Assigned Department"
                    searchable={false}
                  />
                </div>
              </div>
            </div>

            {/* Card 04: Maintenance */}
            <div className="fleet-section-card" style={{ padding: '20px' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '11px', fontWeight: 800, color: '#3a82ff', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={14} /> 04. MAINTENANCE
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '10px', fontWeight: 800, color: 'rgba(148, 163, 184, 0.6)', letterSpacing: '0.08em' }}>LAST SERVICE DATE</label>
                  <CustomDatePicker
                    value={form.lastServiceDate}
                    onChange={(val) => set('lastServiceDate', val)}
                    placeholder="Select Date"
                    allowPast={true}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '10px', fontWeight: 800, color: 'rgba(148, 163, 184, 0.6)', letterSpacing: '0.08em' }}>NEXT MOT/INSPECTION DATE</label>
                  <CustomDatePicker
                    value={form.nextInspectionDate}
                    onChange={(val) => set('nextInspectionDate', val)}
                    placeholder="Select Date"
                    allowPast={true}
                  />
                </div>
              </div>
            </div>

          </div>
        </form>
      </div>

      {/* ── Footer bar — flex child, always at bottom ── */}
      <div className="fleet-register-bottom-bar">
        {/* Left validation notice */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'rgba(148, 163, 184, 0.7)', fontSize: '11.5px', fontWeight: 600 }}>
          <Info size={14} style={{ color: '#3a82ff', flexShrink: 0 }} />
          Verify all VIN credentials against DOCUMENT_55 prior to final submission.
        </div>

        {/* Right action buttons */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            style={{ background: 'transparent', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#ffffff', padding: '10px 24px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', transition: 'background 0.2s' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            DISCARD
          </button>
          <button
            type="submit"
            form="register-vehicle-form"
            disabled={loading}
            style={{ background: 'linear-gradient(135deg, #3a82ff, #1c5fb3)', border: '1px solid rgba(255, 255, 255, 0.1)', color: '#ffffff', padding: '10px 24px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', transition: 'filter 0.2s' }}
            onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.1)'}
            onMouseLeave={(e) => e.currentTarget.style.filter = 'none'}
          >
            {loading ? (
              <span className="fleet-spinner" />
            ) : (
              <Check size={14} strokeWidth={3} />
            )}
            REGISTER VEHICLE
          </button>
        </div>
      </div>

    </div>
  )
}
