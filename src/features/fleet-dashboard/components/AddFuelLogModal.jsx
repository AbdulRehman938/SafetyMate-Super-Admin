import { useFormik } from 'formik'
import * as Yup from 'yup'
import { X, Fuel } from 'lucide-react'

/* ── Yup schema ────────────────────────────────────────────── */
const schema = Yup.object({
  vehicleId: Yup.string().required('Select a vehicle'),

  litres: Yup.number()
    .typeError('Enter a valid number')
    .required('Litres is required')
    .positive('Must be greater than 0')
    .max(10000, 'Seems too large — check the value'),

  costPerLitre: Yup.number()
    .typeError('Enter a valid number')
    .nullable()
    .transform((v, orig) => (orig === '' ? null : v))
    .min(0, 'Cannot be negative')
    .max(10000, 'Seems too large'),

  station: Yup.string()
    .nullable()
    .max(100, 'Max 100 characters'),

  odometer: Yup.number()
    .typeError('Enter a valid number')
    .nullable()
    .transform((v, orig) => (orig === '' ? null : v))
    .min(0, 'Cannot be negative')
    .max(9999999, 'Value too large')
    .integer('Must be a whole number'),
})

/* ─────────────────────────────────────────────────────────────
   AddFuelLogModal
───────────────────────────────────────────────────────────── */
export function AddFuelLogModal({ vehicles = [], onClose, onSave, loading }) {
  const formik = useFormik({
    initialValues: {
      vehicleId:    '',
      litres:       '',
      costPerLitre: '',
      station:      '',
      odometer:     '',
    },
    validationSchema: schema,
    validateOnBlur: true,
    validateOnChange: false,
    onSubmit: async (values) => {
      const litres       = Number(values.litres)
      const costPerLitre = values.costPerLitre !== '' && values.costPerLitre !== null
        ? Number(values.costPerLitre) : null
      await onSave({
        vehicleId:    values.vehicleId,
        litres,
        costPerLitre,
        totalCost:    costPerLitre !== null ? litres * costPerLitre : null,
        station:      values.station.trim() || null,
        odometer:     values.odometer !== '' ? Number(values.odometer) : null,
      })
      onClose()
    },
  })

  const E = formik.errors
  const T = formik.touched

  function field(name) {
    return {
      id:       name,
      name,
      value:    formik.values[name],
      onChange: formik.handleChange,
      onBlur:   formik.handleBlur,
    }
  }

  const errStyle = { fontSize: '11px', color: '#f87171', fontWeight: 600, marginTop: '2px' }

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

        <form onSubmit={formik.handleSubmit} noValidate>

          {/* Vehicle */}
          <div className="fleet-form-group">
            <label className="fleet-form-label" htmlFor="vehicleId">Vehicle *</label>
            <select className={`fleet-form-select${E.vehicleId && T.vehicleId ? ' fuel-input-err' : ''}`}
              {...field('vehicleId')}>
              <option value="">Select vehicle</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>{v.unitId || v.id}</option>
              ))}
            </select>
            {E.vehicleId && T.vehicleId && <span style={errStyle}>{E.vehicleId}</span>}
          </div>

          {/* Litres + Cost/L */}
          <div className="fleet-form-row">
            <div className="fleet-form-group">
              <label className="fleet-form-label" htmlFor="litres">Litres *</label>
              <input type="number" min="0.1" step="0.1" className="fleet-form-input" placeholder="e.g. 80"
                {...field('litres')}
                style={E.litres && T.litres ? { borderColor: '#ff535f' } : {}} />
              {E.litres && T.litres && <span style={errStyle}>{E.litres}</span>}
            </div>
            <div className="fleet-form-group">
              <label className="fleet-form-label" htmlFor="costPerLitre">Cost per Litre</label>
              <input type="number" min="0" step="0.01" className="fleet-form-input" placeholder="e.g. 22.50"
                {...field('costPerLitre')}
                style={E.costPerLitre && T.costPerLitre ? { borderColor: '#ff535f' } : {}} />
              {E.costPerLitre && T.costPerLitre && <span style={errStyle}>{E.costPerLitre}</span>}
            </div>
          </div>

          {/* Total cost preview */}
          {formik.values.litres && formik.values.costPerLitre && (
            <div style={{ marginBottom: '12px', padding: '8px 12px', background: 'rgba(22,201,136,0.07)',
              border: '1px solid rgba(22,201,136,0.2)', borderRadius: '8px',
              fontSize: '12px', fontWeight: 700, color: '#4deba0' }}>
              Total: R {(Number(formik.values.litres) * Number(formik.values.costPerLitre)).toFixed(2)}
            </div>
          )}

          {/* Station + Odometer */}
          <div className="fleet-form-row">
            <div className="fleet-form-group">
              <label className="fleet-form-label" htmlFor="station">Fuel Station</label>
              <input className="fleet-form-input" placeholder="Station name"
                {...field('station')}
                style={E.station && T.station ? { borderColor: '#ff535f' } : {}} />
              {E.station && T.station && <span style={errStyle}>{E.station}</span>}
            </div>
            <div className="fleet-form-group">
              <label className="fleet-form-label" htmlFor="odometer">Odometer (km)</label>
              <input type="number" min="0" className="fleet-form-input" placeholder="Current km"
                {...field('odometer')}
                style={E.odometer && T.odometer ? { borderColor: '#ff535f' } : {}} />
              {E.odometer && T.odometer && <span style={errStyle}>{E.odometer}</span>}
            </div>
          </div>

          <div className="fleet-modal-actions">
            <button type="button" className="fleet-btn fleet-btn--muted" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="fleet-btn fleet-btn--primary"
              disabled={loading || formik.isSubmitting}>
              {(loading || formik.isSubmitting) && <span className="fleet-spinner" />}
              Save Fuel Log
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
