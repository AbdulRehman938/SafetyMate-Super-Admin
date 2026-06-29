import { useRef, useState } from 'react'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import { Camera, Info, Check, X, Fingerprint, Settings, MapPin, Download, Printer } from 'lucide-react'
import { CustomSelect } from '../../training-dashboard/components/CustomSelect.jsx'
import { CustomDatePicker } from '../../training-dashboard/components/CustomDatePicker.jsx'
import { useFleetData } from '../hooks/useFleetData.js'
import QRCode from 'qrcode'
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
  const [qrGenerated, setQrGenerated] = useState(false)
  const [qrCodeData, setQrCodeData] = useState(null)
  const [vehicleId, setVehicleId] = useState('')

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

  // Generate vehicle ID and QR code
  async function generateQRCode() {
    const newVehicleId = `VEH-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
    setVehicleId(newVehicleId)
    
    try {
      // Create deep link URL for mobile app
      const deepLinkUrl = `intent://forms/vehicle-inspection#Intent;scheme=safetymate;package=com.upward.safetymate;end`
      
      const qrDataUrl = await QRCode.toDataURL(deepLinkUrl, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      })
      setQrCodeData(qrDataUrl)
      setQrGenerated(true)
    } catch (error) {
      console.error('Error generating QR code:', error)
    }
  }

  // Download QR code
  function downloadQRCode() {
    if (!qrCodeData) return
    const link = document.createElement('a')
    link.href = qrCodeData
    link.download = `vehicle-qr-${vehicleId}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Print QR code
  function printQRCode() {
    if (!qrCodeData) return
    const printWindow = window.open('', '_blank')
    printWindow.document.write(`
      <html>
        <head>
          <title>Vehicle QR Code - ${vehicleId}</title>
          <style>
            body { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; font-family: Arial, sans-serif; }
            .container { text-align: center; padding: 20px; }
            .qr-code { margin: 20px 0; }
            .vehicle-id { font-size: 24px; font-weight: bold; margin-top: 10px; }
            .label { font-size: 14px; color: #666; margin-bottom: 5px; }
          </style>
        </head>
        <body>
          <div class="container">
            <p class="label">Vehicle Identification QR Code</p>
            <div class="qr-code">
              <img src="${qrCodeData}" alt="Vehicle QR Code" style="width: 200px; height: 200px;" />
            </div>
            <p class="vehicle-id">${vehicleId}</p>
          </div>
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

  // Handle form submission based on current state
  async function handleSubmit(values) {
    if (!qrGenerated) {
      // First step: Generate QR code
      await formik.validateForm()
      if (Object.keys(formik.errors).length > 0) {
        return
      }
      await generateQRCode()
    } else {
      // Second step: Submit and register vehicle
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
        site:         null, // New vehicles should not have a site assigned
        image:        values.image,
        status:       'inactive', // New vehicles start as inactive
        healthScore:  100,
        fuelLevel:    100,
        vehicleId:    vehicleId,
        qrCode:       qrCodeData,
      }
      await onSave(data)
    }
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
      image: editVehicle?.image || null,
    },
    validationSchema: schema,
    validateOnBlur: true,
    validateOnChange: true,
    validate: validateDuplicates,
    onSubmit: handleSubmit,
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
          style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Vehicle Image Section */}
          <div className="fleet-section-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', minHeight: '220px', cursor: 'pointer', overflow: 'hidden' }}>
            {f.image ? (
              <div style={{ width: '100%', maxWidth: '500px', height: '220px', position: 'relative', borderRadius: '8px', overflow: 'hidden' }}>
                <img src={imagePreviewUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button type="button"
                  onClick={() => { formik.setFieldValue('image', null); if (imageRef.current) imageRef.current.value = '' }}
                  style={{ position: 'absolute', right: '8px', top: '8px', background: 'rgba(0,0,0,0.6)',
                    border: 'none', borderRadius: '50%', width: '28px', height: '28px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer' }}>
                  <X size={16} />
                </button>
              </div>
            ) : (
              <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', cursor: 'pointer', width: '100%' }}>
                <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'rgba(58,130,255,0.08)',
                  border: '1px solid rgba(58,130,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3a82ff' }}>
                  <Camera size={28} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <h4 style={{ margin: '0 0 6px', fontSize: '13px', fontWeight: 800, letterSpacing: '0.06em', color: '#fff' }}>VEHICLE PROFILE IMAGE</h4>
                  <p style={{ margin: 0, fontSize: '11px', color: 'rgba(148,163,184,0.5)', fontWeight: 600 }}>Recommended: 1200×800 High-Res</p>
                </div>
                <input ref={imageRef} type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
              </label>
            )}
          </div>

          {/* 01: Vehicle Identity */}
          <div className="fleet-section-card" style={{ padding: '24px' }}>
            <h3 style={{ margin: '0 0 24px', fontSize: '12px', fontWeight: 800, color: '#3a82ff',
              letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Fingerprint size={16} /> 01. VEHICLE IDENTITY
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
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
            <h3 style={{ margin: '0 0 24px', fontSize: '12px', fontWeight: 800, color: '#3a82ff',
              letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Settings size={16} /> 02. TECHNICAL SPECIFICATIONS
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '20px' }}>
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
        </form>

        {/* ── QR Code Display Container ── */}
        {qrGenerated && (
          <div style={{ padding: '0 28px 24px' }}>
            <div className="fleet-section-card" style={{ padding: '24px', background: 'rgba(58,130,255,0.05)', border: '1px solid rgba(58,130,255,0.2)' }}>
              <h3 style={{ margin: '0 0 20px', fontSize: '11px', fontWeight: 800, color: '#3a82ff',
                letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Fingerprint size={14} /> VEHICLE IDENTIFICATION
              </h3>
              <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
                {/* QR Code Display */}
                <div style={{ flexShrink: 0, background: '#fff', padding: '16px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
                  <img src={qrCodeData} alt="Vehicle QR Code" style={{ width: '180px', height: '180px', display: 'block' }} />
                </div>
                
                {/* Vehicle ID and Actions */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <p style={{ margin: '0 0 8px', fontSize: '10px', fontWeight: 800, color: 'rgba(148,163,184,0.6)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      VEHICLE ID
                    </p>
                    <p style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#3a82ff', fontFamily: 'monospace', letterSpacing: '0.05em' }}>
                      {vehicleId}
                    </p>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={downloadQRCode}
                      style={{ background: 'linear-gradient(135deg,#10b981,#059669)', border: '1px solid rgba(255,255,255,0.1)',
                        color: '#fff', padding: '10px 20px', borderRadius: '8px', fontSize: '12px', fontWeight: 700,
                        display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                      onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.1)'}
                      onMouseLeave={(e) => e.currentTarget.style.filter = 'none'}>
                      <Download size={14} />
                      DOWNLOAD QR
                    </button>
                    <button
                      type="button"
                      onClick={printQRCode}
                      style={{ background: 'linear-gradient(135deg,#3a82ff,#1c5fb3)', border: '1px solid rgba(255,255,255,0.1)',
                        color: '#fff', padding: '10px 20px', borderRadius: '8px', fontSize: '12px', fontWeight: 700,
                        display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                      onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.1)'}
                      onMouseLeave={(e) => e.currentTarget.style.filter = 'none'}>
                      <Printer size={14} />
                      PRINT QR
                    </button>
                  </div>
                  
                  <div style={{ marginTop: '8px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <p style={{ margin: 0, fontSize: '11px', color: 'rgba(148,163,184,0.7)', fontWeight: 600, lineHeight: '1.5' }}>
                      <Info size={12} style={{ color: '#3a82ff', marginRight: '6px', display: 'inline', verticalAlign: 'middle' }} />
                      QR code contains unique vehicle ID. Download or print for physical labeling before registration.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
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
              : qrGenerated
              ? <Check size={14} strokeWidth={3} />
              : <Check size={14} strokeWidth={3} />}
            {editVehicle 
              ? 'SAVE AND CONTINUE' 
              : qrGenerated 
                ? 'SUBMIT AND REGISTER VEHICLE' 
                : 'SAVE AND GENERATE QR'}
          </button>
        </div>
      </div>
    </div>
  )
}
