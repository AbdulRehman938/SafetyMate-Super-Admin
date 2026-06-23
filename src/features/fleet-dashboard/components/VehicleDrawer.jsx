import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Truck, Activity, Calendar, Fuel, User, Wrench } from 'lucide-react'
import {
  formatDate, formatDateTime, healthClass, statusPillClass, cap, timeAgo
} from '../utils/fleetHelpers.js'

const panelSpring = { type: 'spring', stiffness: 380, damping: 38 }
const overlayTween = { duration: 0.22, ease: 'easeInOut' }

export function VehicleDrawer({ vehicle, inspections = [], fuelLogs = [], onClose }) {
  if (!vehicle) return null

  const vehicleInspections = inspections
    .filter((i) => i.vehicleId === vehicle.id)
    .slice(0, 6)

  const vehicleFuel = fuelLogs
    .filter((f) => f.vehicleId === vehicle.id)
    .slice(0, 5)

  const health = vehicle.healthScore ?? 100
  const hClass = healthClass(health)

  return (
    <AnimatePresence>
      <motion.button
        key="fleet-backdrop"
        type="button"
        className="fleet-drawer-backdrop"
        aria-label="Close drawer"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={overlayTween}
      />
      <motion.aside
        key="fleet-panel"
        className="fleet-drawer-panel"
        aria-label={`Vehicle details: ${vehicle.unitId || vehicle.id}`}
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={panelSpring}
      >
        {/* Header */}
        <div className="fleet-drawer-header">
          <div>
            <h2 className="fleet-drawer-title">{vehicle.unitId || vehicle.id}</h2>
            <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'rgba(148,163,184,0.65)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {vehicle.vehicleType || '—'} · {vehicle.category || '—'}
            </p>
          </div>
          <button type="button" className="fleet-icon-btn" onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>

        <div className="fleet-drawer-body">
          {/* Status + Health */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
            <span className={`fleet-status-pill ${statusPillClass(vehicle.status)}`}>
              <span className="fleet-status-dot" />
              {cap(vehicle.status)}
            </span>
            <span style={{ fontSize: '11px', color: 'rgba(148,163,184,0.6)', marginLeft: 'auto' }}>
              Health: <strong style={{ color: hClass === 'high' ? '#4deba0' : hClass === 'mid' ? '#ffb56e' : '#ff8080' }}>{health}%</strong>
            </span>
          </div>

          {/* Health bar */}
          <div className="fleet-health-track" style={{ height: '6px', marginBottom: '20px' }}>
            <div
              className={`fleet-health-fill fleet-health-fill--${hClass}`}
              style={{ width: `${health}%` }}
            />
          </div>

          {/* Details grid */}
          <div style={{ marginBottom: '20px' }}>
            <p style={{ margin: '0 0 10px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(148,163,184,0.5)' }}>
              Vehicle Details
            </p>
            {[
              { label: 'Unit ID',        value: vehicle.unitId || '—',        icon: Truck },
              { label: 'Type',           value: vehicle.vehicleType || '—',   icon: Truck },
              { label: 'Category',       value: vehicle.category || '—',      icon: Activity },
              { label: 'Driver',         value: vehicle.driverName || 'Unassigned', icon: User },
              { label: 'Site',           value: vehicle.site || '—',          icon: null },
              { label: 'Last Service',   value: formatDate(vehicle.lastService), icon: Wrench },
              { label: 'Next Service',   value: formatDate(vehicle.nextService), icon: Calendar },
              { label: 'Mileage (km)',   value: vehicle.mileageKm != null ? vehicle.mileageKm.toLocaleString() : '—', icon: null },
              { label: 'Fuel Level',     value: vehicle.fuelLevel != null ? `${vehicle.fuelLevel}%` : '—', icon: Fuel },
              { label: 'Registered',     value: formatDate(vehicle.createdAt), icon: null },
            ].map(({ label, value }) => (
              <div key={label} className="fleet-drawer-row">
                <span className="fleet-drawer-dt">{label}</span>
                <span className="fleet-drawer-dd">{value}</span>
              </div>
            ))}
          </div>

          {/* Inspection history */}
          {vehicleInspections.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <p style={{ margin: '0 0 12px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(148,163,184,0.5)' }}>
                Recent Inspections
              </p>
              <div className="fleet-timeline">
                {vehicleInspections.map((ins) => {
                  const dotClass = ins.outcome === 'pass'
                    ? 'fleet-timeline-dot--ok'
                    : ins.outcome === 'fail'
                    ? 'fleet-timeline-dot--danger'
                    : 'fleet-timeline-dot--warn'
                  return (
                    <div key={ins.id} className="fleet-timeline-item">
                      <div className="fleet-timeline-line">
                        <span className={`fleet-timeline-dot ${dotClass}`} />
                        <span className="fleet-timeline-connector" />
                      </div>
                      <div className="fleet-timeline-content">
                        <p className="fleet-timeline-title">{ins.inspectionType || 'Inspection'}</p>
                        <p className="fleet-timeline-meta">
                          {cap(ins.outcome || '—')} · {formatDateTime(ins.inspectedAt)} · {ins.inspector || '—'}
                        </p>
                        {ins.notes && (
                          <p style={{ margin: '4px 0 0', fontSize: '11.5px', color: 'rgba(203,214,255,0.7)', lineHeight: 1.45 }}>
                            {ins.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Fuel log */}
          {vehicleFuel.length > 0 && (
            <div>
              <p style={{ margin: '0 0 10px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(148,163,184,0.5)' }}>
                Recent Fuel Logs
              </p>
              {vehicleFuel.map((f) => (
                <div key={f.id} className="fleet-drawer-row">
                  <span className="fleet-drawer-dt">{timeAgo(f.loggedAt)}</span>
                  <span className="fleet-drawer-dd">{f.litres != null ? `${f.litres}L` : '—'} · {f.station || '—'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.aside>
    </AnimatePresence>
  )
}
