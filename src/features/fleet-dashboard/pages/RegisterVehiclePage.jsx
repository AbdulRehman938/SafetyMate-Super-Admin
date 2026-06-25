import { useRef } from 'react'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import { Camera, Info, Check, X, Fingerprint, Settings, MapPin, Calendar } from 'lucide-react'
import { CustomSelect } from '../../training-dashboard/components/CustomSelect.jsx'
import { CustomDatePicker } from '../../training-dashboard/components/CustomDatePicker.jsx'
import { useFleetData } from '../hooks/useFleetData.js'
import '../fleet.css'

/* ── Yup schema ─────────────────────────────────────────────── */
const CURRENT_YEAR = new Date().getFullYear()

const schema = Yup.object({
  plateNumber: Yup.string()
    .trim()
    .required('Plate number is required')
    .matches(/^[A-Za-z0-9\-\s]{2,15}$/, 'Use letters, numbers, hyphens only (2–15 chars)')
    .test('unique-plate', 'A vehicle with this plate number already exists', function (value) {
      if (!value) return true
      // This will be validated in the component with access to vehicles
      return true
    }),

  modelName: Yup.string()
    .trim()
    .required('Model name is required')
    .min(2, 'At least 2 characters')
    .max(80, 'Max 80 characters'),

  vin: Yup.string()
    .trim()
    .required('VIN is required')
    .length(17, 'VIN must be exactly 17 characters')
    .matches(/^[A-HJ-NPR-Za-hj-npr-z0-9]{17}$/, 'VIN contains invalid characters (I, O, Q not allowed)')
    .test('unique-vin', 'A vehicle with this VIN already exists', function (value) {
      if (!value) return true
      // This will be validated in the component with access to vehicles
      return true
    }),

  year: Yup.number()
    .transform((v, orig) => (orig === '' ? undefined : v))
    .nullable()
    .integer('Year must be a whole number')
    .min(1970, 'Year must be 1970 or later')
    .max(CURRENT_YEAR, `Year cannot be after ${CURRENT_YEAR}`),

  fuelCapacity: Yup.number()
    .transform((v, orig) => (orig === '' ? undefined : v))
    .nullable()
    .required('Fuel capacity is required')
    .min(1, 'Must be at least 1 L/kWh')
    .max(1000, 'Seems too large — check value'),

  initialOdometer: Yup.number()
    .transform((v, orig) => (orig === '' ? undefined : v))
    .required('Initial odometer reading is required')
    .min(0, 'Cannot be negative')
    .max(1000000, 'Value too large')
    .integer('Odometer must be a whole number'),

  engineType: Yup.string().required('Select an engine type'),
  assignedSite: Yup.string().required('Assign a site'),
  assignedDepartment: Yup.string().required('Assign a department'),

  lastServiceDate: Yup.string().nullable(),
  nextInspectionDate: Yup.string()
    .nullable()
    .test('after-last-service', 'Next inspection must be after last service date', function (val) {
      const { lastServiceDate } = this.parent
      if (!val || !lastServiceDate) return true
      return new Date(val) > new Date(lastServiceDate)
    }),
})

/* ── Field helper: renders label + input + error msg ────────── */
function Field({ label, error, touched, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label style={{ fontSize: '10px', fontWeight: 800, color: 'rgba(148,163,184,0.6)', letterSpacing: '0.08em' }}>
        {label}
      </label>
      {children}
      {touched && error && (
        <span style={{ fontSize: '11px', color: '#ff535f', fontWeight: 600 }}>{error}</span>
      )}
    </div>
  )
}

const INPUT_BASE = {
  padding: '11px 12px',
  background: 'rgba(255,255,255,0.03)',
  borderRadius: '8px',
  color: '#ffffff',
  fontSize: '13px',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
}
const inputStyle = (err, touched) => ({
  ...INPUT_BASE,
  border: err && touched ? '1px solid #ff535f' : '1px solid rgba(255,255,255,0.06)',
})

/* ─────────────────────────────────────────────────────────────
   RegisterVehiclePage
───────────────────────────────────────────────────────────── */
export function RegisterVehiclePage({ onSave, onCancel, loading, editVehicle }) {
  const imageRef = useRef(null)
  const { vehicles } = useFleetData()

  // Custom validation function to check duplicates (skip current vehicle when editing)
  function validateDuplicates(values) {
    const errors = {}
    
    const plateUpper = values.plateNumber?.trim().toUpperCase()
    if (plateUpper) {
      const existingPlate = vehicles.find(v => 
        v.plateNumber?.toUpperCase() === plateUpper && v.id !== editVehicle?.id
      )
      if (existingPlate) {
        errors.plateNumber = 'A vehicle with this plate number already exists'
      }
    }
    
    const vinUpper = values.vin?.trim().toUpperCase()
    if (vinUpper) {
      const existingVin = vehicles.find(v => 
        v.vin?.toUpperCase() === vinUpper && v.id !== editVehicle?.id
      )
      if (existingVin) {
        errors.vin = 'A vehicle with this VIN already exists'
      }
    }
    
    return errors
  }

  const formik = useFormik({
    initialValues: {
      plateNumber: editVehicle?.plateNumber || '',
      modelName: editVehicle?.model || '',
      vin: editVehicle?.vin || '',
      year: editVehicle?.year || '',
      engineType: editVehicle?.engineType || 'Internal Combustion (ICE)',
      fuelCapacity: editVehicle?.fuelCapacity || '',
      initialOdometer: editVehicle?.mileageKm || '',
      assignedSite: editVehicle?.site || '',
      assignedDepartment: editVehicle?.department || '',
      lastServiceDate: (() => {
        if (!editVehicle?.lastService) return ''
        try {
          let date
          if (editVehicle.lastService.toDate) {
            date = editVehicle.lastService.toDate()
          } else {
            date = new Date(editVehicle.lastService)
          }
          return isNaN(date.getTime()) ? '' : date.toISOString().split('T')[0]
        } catch {
          return ''
        }
      })(),
      nextInspectionDate: (() => {
        if (!editVehicle?.nextService) return ''
        try {
          let date
          if (editVehicle.nextService.toDate) {
            date = editVehicle.nextService.toDate()
          } else {
            date = new Date(editVehicle.nextService)
          }
          return isNaN(date.getTime()) ? '' : date.toISOString().split('T')[0]
        } catch {
          return ''
        }
      })(),
      image: editVehicle?.image || null,
    },
    validationSchema: schema,
    validateOnBlur: true,
    validateOnChange: true,
    validate: validateDuplicates,
    onSubmit: async (values) => {
      const data = {
        unitId:       values.plateNumber.trim().toUpperCase(),
        plateNumber:  values.plateNumber.trim().toUpperCase(),
        model:        values.modelName.trim(),
        vin:          values.vin.trim().toUpperCase(),
        year:         values.year ? Number(values.year) : null,
        vehicleType:  deriveType(values.modelName),
        engineType:   values.engineType,
        fuelCapacity: values.fuelCapacity ? Number(values.fuelCapacity) : null,
        mileageKm:    Number(values.initialOdometer),
        site:         values.assignedSite,
        department:   values.assignedDepartment,
        lastService:  values.lastServiceDate   ? new Date(values.lastServiceDate)   : null,
        nextService:  values.nextInspectionDate ? new Date(values.nextInspectionDate) : null,
        image:        values.image,
        status:       'active',
        healthScore:  100,
        fuelLevel:    100,
      }
      await onSave(data)
    },
  })

  function deriveType(name) {
    const n = (name || '').toLowerCase()
    if (n.includes('hauler') || n.includes('truck') || n.includes('semi')) return 'Hauler'
    if (n.includes('van') || n.includes('transit'))  return 'Van'
    if (n.includes('suv') || n.includes('patrol'))   return 'SUV'
    if (n.includes('ev') || n.includes('electric'))  return 'Electric'
    return 'Utility'
  }

  function handleImageChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    formik.setFieldValue('image', file)
  }

  const f = formik.values
  const e = formik.errors
  const t = formik.touched

  // Get preview URL for image (handles both File objects and URLs)
  const imagePreviewUrl = f.image instanceof File 
    ? URL.createObjectURL(f.image) 
    : f.image

  return (
    <div className="fleet-register-page"
      style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', color: '#fff' }}>

      {/* ── Header ── */}
      <div style={{ padding: '24px 28px 16px', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ margin: '0 0 6px', fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em' }}>
            {editVehicle ? 'Edit Vehicle' : 'Register New Vehicle'}
          </h1>
          <p style={{ margin: 0, fontSize: '13px', color: 'rgba(148,163,184,0.75)', fontWeight: 600, maxWidth: 600 }}>
            {editVehicle ? 'Update vehicle information and specifications.' : 'Initialize a high-fidelity Digital Twin for fleet assets.'}
          </p>
        </div>
        <div style={{ background: 'rgba(58,130,255,0.08)', border: '1px solid rgba(58,130,255,0.2)', color: '#3a82ff',
          padding: '6px 14px', borderRadius: '999px', fontSize: '10px', fontWeight: 800, letterSpacing: '0.08em',
          textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#3a82ff', boxShadow: '0 0 8px #3a82ff' }} />
          ACTIVE SESSION
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 28px 24px',
        scrollbarWidth: 'thin', scrollbarColor: 'rgba(58,130,255,0.2) transparent' }}>
        <form id="register-vehicle-form" onSubmit={formik.handleSubmit} noValidate
          className="fleet-register-form"
          style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px' }}>

          {/* ══ LEFT COLUMN ══ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* 01: Vehicle Identity */}
            <div className="fleet-section-card" style={{ padding: '24px' }}>
              <h3 style={{ margin: '0 0 20px', fontSize: '11px', fontWeight: 800, color: '#3a82ff',
                letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Fingerprint size={14} /> 01. VEHICLE IDENTITY
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <Field label="PLATE NUMBER *" error={e.plateNumber} touched={t.plateNumber}>
                  <input type="text" placeholder="e.g. OB-2024-MS"
                    style={inputStyle(e.plateNumber, t.plateNumber)}
                    {...formik.getFieldProps('plateNumber')} />
                </Field>
                <Field label="MODEL NAME *" error={e.modelName} touched={t.modelName}>
                  <input type="text" placeholder="e.g. Titan-X Heavy Transporter"
                    style={inputStyle(e.modelName, t.modelName)}
                    {...formik.getFieldProps('modelName')} />
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <Field label="VIN (17 CHARACTERS) *" error={e.vin} touched={t.vin}>
                  <input type="text" placeholder="17-char alpha-numeric" maxLength={17}
                    style={inputStyle(e.vin, t.vin)}
                    {...formik.getFieldProps('vin')}
                    onChange={(ev) => formik.setFieldValue('vin', ev.target.value.toUpperCase())} />
                </Field>
                <Field label="YEAR OF MANUFACTURE" error={e.year} touched={t.year}>
                  <input type="number" placeholder="YYYY" min={1970} max={CURRENT_YEAR}
                    style={inputStyle(e.year, t.year)}
                    {...formik.getFieldProps('year')} />
                </Field>
              </div>
            </div>

            {/* 02: Technical Specifications */}
            <div className="fleet-section-card" style={{ padding: '24px' }}>
              <h3 style={{ margin: '0 0 20px', fontSize: '11px', fontWeight: 800, color: '#3a82ff',
                letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Settings size={14} /> 02. TECHNICAL SPECIFICATIONS
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '16px' }}>
                <Field label="ENGINE TYPE *" error={e.engineType} touched={t.engineType}>
                  <CustomSelect value={f.engineType}
                    onChange={(val) => { formik.setFieldValue('engineType', val); formik.setFieldTouched('engineType', true) }}
                    options={['Internal Combustion (ICE)', 'Electric Vehicle (EV)', 'Hybrid']}
                    placeholder="Select Engine Type" searchable={false} />
                </Field>
                <Field label="FUEL CAPACITY (L/KWH)" error={e.fuelCapacity} touched={t.fuelCapacity}>
                  <input type="number" min={0} placeholder="e.g. 80"
                    style={inputStyle(e.fuelCapacity, t.fuelCapacity)}
                    {...formik.getFieldProps('fuelCapacity')} />
                </Field>
                <Field label="INITIAL ODOMETER (KM) *" error={e.initialOdometer} touched={t.initialOdometer}>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input type="number" min={0} placeholder="000000"
                      style={{ ...inputStyle(e.initialOdometer, t.initialOdometer), paddingRight: '40px' }}
                      {...formik.getFieldProps('initialOdometer')} />
                    <span style={{ position: 'absolute', right: '12px', fontSize: '10px', fontWeight: 800, color: 'rgba(148,163,184,0.5)' }}>KM</span>
                  </div>
                </Field>
              </div>
            </div>
          </div>

          {/* ══ RIGHT COLUMN ══ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Vehicle image */}
            <div className="fleet-section-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', minHeight: '180px', cursor: 'pointer', overflow: 'hidden' }}>
              {f.image ? (
                <div style={{ width: '100%', height: '150px', position: 'relative', borderRadius: '8px', overflow: 'hidden' }}>
                  <img src={imagePreviewUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button type="button"
                    onClick={() => { formik.setFieldValue('image', null); if (imageRef.current) imageRef.current.value = '' }}
                    style={{ position: 'absolute', right: '8px', top: '8px', background: 'rgba(0,0,0,0.6)',
                      border: 'none', borderRadius: '50%', width: '24px', height: '24px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer' }}>
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', cursor: 'pointer', width: '100%' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(58,130,255,0.08)',
                    border: '1px solid rgba(58,130,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3a82ff' }}>
                    <Camera size={18} />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <h4 style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 800, letterSpacing: '0.06em', color: '#fff' }}>VEHICLE PROFILE IMAGE</h4>
                    <p style={{ margin: 0, fontSize: '9px', color: 'rgba(148,163,184,0.5)', fontWeight: 600 }}>Recommended: 1200×800 High-Res</p>
                  </div>
                  <input ref={imageRef} type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
                </label>
              )}
            </div>

            {/* 03: Operations */}
            <div className="fleet-section-card" style={{ padding: '20px' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '11px', fontWeight: 800, color: '#3a82ff',
                letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MapPin size={14} /> 03. OPERATIONS
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <Field label="ASSIGNED SITE *" error={e.assignedSite} touched={t.assignedSite}>
                  <CustomSelect value={f.assignedSite}
                    onChange={(val) => formik.setFieldValue('assignedSite', val)}
                    onBlur={() => formik.setFieldTouched('assignedSite', true)}
                    options={['Obsidian Hub Alpha', 'Sector 7G - Perimeter', 'East Gate Complex', 'Workshop Bay 3']}
                    placeholder="Select Assigned Site" searchable />
                </Field>
                <Field label="ASSIGNED DEPARTMENT *" error={e.assignedDepartment} touched={t.assignedDepartment}>
                  <CustomSelect value={f.assignedDepartment}
                    onChange={(val) => formik.setFieldValue('assignedDepartment', val)}
                    onBlur={() => formik.setFieldTouched('assignedDepartment', true)}
                    options={['Rapid Response Fleet', 'Operations', 'Logistics', 'Maintenance']}
                    placeholder="Select Assigned Department" searchable={false} />
                </Field>
              </div>
            </div>

            {/* 04: Maintenance */}
            <div className="fleet-section-card" style={{ padding: '20px' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '11px', fontWeight: 800, color: '#3a82ff',
                letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={14} /> 04. MAINTENANCE
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <Field label="LAST SERVICE DATE" error={e.lastServiceDate} touched={t.lastServiceDate}>
                  <CustomDatePicker value={f.lastServiceDate}
                    onChange={(val) => { formik.setFieldValue('lastServiceDate', val); formik.setFieldTouched('lastServiceDate', true) }}
                    placeholder="Select Date" />
                </Field>
                <Field label="NEXT MOT / INSPECTION DATE" error={e.nextInspectionDate} touched={t.nextInspectionDate}>
                  <CustomDatePicker value={f.nextInspectionDate}
                    onChange={(val) => { formik.setFieldValue('nextInspectionDate', val); formik.setFieldTouched('nextInspectionDate', true) }}
                    minDate={f.lastServiceDate}
                    placeholder="Select Date" />
                </Field>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* ── Footer ── */}
      <div className="fleet-register-bottom-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'rgba(148,163,184,0.7)', fontSize: '11.5px', fontWeight: 600 }}>
          <Info size={14} style={{ color: '#3a82ff', flexShrink: 0 }} />
          {editVehicle ? 'Editing this vehicle will reset its approval status to Pending.' : 'All required fields (*) must be completed before registration.'}
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button type="button" onClick={onCancel} disabled={loading}
            style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: '#fff',
              padding: '10px 24px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
            DISCARD
          </button>
          <button type="submit" form="register-vehicle-form" disabled={loading || formik.isSubmitting}
            style={{ background: 'linear-gradient(135deg,#3a82ff,#1c5fb3)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff', padding: '10px 24px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
            onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.1)'}
            onMouseLeave={(e) => e.currentTarget.style.filter = 'none'}>
            {loading || formik.isSubmitting
              ? <span className="fleet-spinner" />
              : <Check size={14} strokeWidth={3} />}
            {editVehicle ? 'SAVE AND CONTINUE' : 'REGISTER VEHICLE'}
          </button>
        </div>
      </div>
    </div>
  )
}
