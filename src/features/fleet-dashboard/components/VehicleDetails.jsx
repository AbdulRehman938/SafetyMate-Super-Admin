import React, { useState, useMemo, useEffect } from 'react'
import {
  ArrowLeft,
  Calendar,
  CheckCircle,
  Download,
  AlertTriangle,
  Clock,
  Shield,
  ShieldCheck,
  ChevronRight,
  RefreshCw,
  X,
  Printer,
  Fingerprint,
  Info
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../../config/firebase.js'

function loadJsPDF() {
  return new Promise((resolve, reject) => {
    if (window.jspdf?.jsPDF) {
      resolve(window.jspdf.jsPDF)
      return
    }
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
    script.onload = () => {
      if (window.jspdf?.jsPDF) resolve(window.jspdf.jsPDF)
      else reject(new Error('jsPDF failed to load'))
    }
    script.onerror = () => reject(new Error('Could not load jsPDF'))
    document.body.appendChild(script)
  })
}

export function VehicleDetails({ vehicle, alerts = [], inspections = [], onBack, viewOnly = false, backText = "Back to Registry", onEdit, statusReset }) {
  const [submitting, setSubmitting] = useState(false)
  const [approved, setApproved] = useState(vehicle.complianceStatus === 'Approved')
  const [showHistory, setShowHistory] = useState(false)
  const [message, setMessage] = useState('')
  const [showEditModal, setShowEditModal] = useState(false)
  const [defectPage, setDefectPage] = useState(1)
  const DEFECT_PAGE_SIZE = 5

  // Filter inspections with defects (notes) for this vehicle
  const vehicleDefects = useMemo(() => {
    return inspections
      .filter((i) => i.vehicleId === vehicle.id && i.notes && i.notes.trim())
      .sort((a, b) => {
        const aDate = a.inspectedAt?.toDate ? a.inspectedAt.toDate() : new Date(a.inspectedAt || 0)
        const bDate = b.inspectedAt?.toDate ? b.inspectedAt.toDate() : new Date(b.inspectedAt || 0)
        return bDate - aDate
      })
      .map((inspection, index) => ({
        id: inspection.id || `defect-${index}`,
        description: inspection.notes,
        reportedDate: inspection.inspectedAt?.toDate ? inspection.inspectedAt.toDate() : new Date(inspection.inspectedAt || 0),
        severity: inspection.outcome === 'fail' ? 'HIGH' : 'MEDIUM',
        status: inspection.outcome === 'fail' ? 'OPEN' : 'RESOLVED',
        reference: inspection.id?.slice(-8).toUpperCase() || `INS-${index + 1}`
      }))
  }, [inspections, vehicle.id])

  // Display actual vehicle defects only
  const displayedDefects = useMemo(() => {
    if (!showHistory) {
      return vehicleDefects.filter((d) => d.status === 'OPEN')
    }
    return vehicleDefects
  }, [vehicleDefects, showHistory])

  // Pagination for defects
  const defectTotalPages = Math.max(1, Math.ceil(displayedDefects.length / DEFECT_PAGE_SIZE))
  const defectSafePage = Math.min(defectPage, defectTotalPages)
  const paginatedDefects = useMemo(() => {
    const start = (defectSafePage - 1) * DEFECT_PAGE_SIZE
    return displayedDefects.slice(start, start + DEFECT_PAGE_SIZE)
  }, [displayedDefects, defectSafePage])

  // Reset defect page when toggling history
  useEffect(() => {
    setDefectPage(1)
  }, [showHistory])

  // Calculate daily average based on mileage or standard progression
  const totalDistance = vehicle.mileageKm ? vehicle.mileageKm.toLocaleString() + ' KM' : '—'
  const dailyAverage = vehicle.mileageKm 
    ? (Math.floor((vehicle.mileageKm / 30) * 10) / 10).toLocaleString(undefined, { minimumFractionDigits: 1 }) + ' KM' 
    : '—'

  // Calculate service interval data
  const serviceData = useMemo(() => {
    const nextService = vehicle.nextService
    const lastService = vehicle.lastService
    const mileageKm = vehicle.mileageKm || 0
    
    // Calculate days until next service
    let daysUntilService = null
    let serviceProgress = 0
    let serviceStatus = 'No data'
    
    if (nextService) {
      const now = Date.now()
      const nextDate = nextService.toDate ? nextService.toDate() : new Date(nextService)
      daysUntilService = Math.ceil((nextDate - now) / (1000 * 60 * 60 * 24))
      
      // Calculate progress (assuming 30-day service interval as baseline)
      if (lastService) {
        const lastDate = lastService.toDate ? lastService.toDate() : new Date(lastService)
        const totalDays = 30 // Standard service interval
        const daysSinceLast = Math.ceil((now - lastDate) / (1000 * 60 * 60 * 24))
        serviceProgress = Math.min(100, (daysSinceLast / totalDays) * 100)
      }
      
      if (daysUntilService < 0) {
        serviceStatus = 'OVERDUE'
      } else if (daysUntilService < 7) {
        serviceStatus = 'DUE SOON'
      } else {
        serviceStatus = `${daysUntilService} DAYS`
      }
    }
    
    return {
      daysUntilService,
      serviceProgress,
      serviceStatus,
      mileageKm
    }
  }, [vehicle.nextService, vehicle.lastService, vehicle.mileageKm])
  const chartData = useMemo(() => {
    const vehicleInspections = inspections
      .filter((i) => i.vehicleId === vehicle.id && i.currentKm)
      .sort((a, b) => {
        const aDate = a.inspectedAt?.toDate ? a.inspectedAt.toDate() : new Date(a.inspectedAt || 0)
        const bDate = b.inspectedAt?.toDate ? b.inspectedAt.toDate() : new Date(b.inspectedAt || 0)
        return aDate - bDate
      })
    
    if (vehicleInspections.length === 0) return []
    
    // Take last 12 inspections for the chart
    const recentInspections = vehicleInspections.slice(-12)
    
    // Calculate distance between consecutive inspections
    let previousKm = 0
    return recentInspections.map((inspection, index) => {
      const currentKm = inspection.currentKm || 0
      const distance = index === 0 ? currentKm : currentKm - previousKm
      previousKm = currentKm
      
      const date = inspection.inspectedAt?.toDate ? inspection.inspectedAt.toDate() : new Date(inspection.inspectedAt || 0)
      const monthName = date.toLocaleString('default', { month: 'short' })
      const day = date.getDate()
      
      return {
        name: `${monthName} ${day}`,
        distance: Math.max(0, distance)
      }
    })
  }, [inspections, vehicle.id])

  // Submit Approval: updates vehicle compliance status in Firestore
  async function handleSubmitApproval() {
    setSubmitting(true)
    try {
      const vehicleRef = doc(db, 'fleet_vehicles', vehicle.id)
      await updateDoc(vehicleRef, {
        complianceStatus: 'Approved',
        status: 'inactive', // Set to inactive after approval, not active
        lastAuditAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })
      setApproved(true)
      setMessage('Compliance audit successfully submitted and approved.')
      setTimeout(() => setMessage(''), 4000)
    } catch (error) {
      console.error('Error submitting approval:', error)
      setMessage('Failed to submit compliance approval.')
    } finally {
      setSubmitting(false)
    }
  }

  // Download QR code
  function downloadVehicleQR() {
    if (!vehicle.qrCode) return
    const link = document.createElement('a')
    link.href = vehicle.qrCode
    link.download = `vehicle-qr-${vehicle.vehicleId || vehicle.unitId}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Print QR code
  function printVehicleQR() {
    if (!vehicle.qrCode) return
    const printWindow = window.open('', '_blank')
    printWindow.document.write(`
      <html>
        <head>
          <title>Vehicle QR Code - ${vehicle.vehicleId || vehicle.unitId}</title>
          <style>
            body { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; font-family: Arial, sans-serif; }
            .container { text-align: center; padding: 20px; }
            .qr-code { margin: 20px 0; }
            .vehicle-id { font-size: 24px; font-weight: bold; margin-top: 10px; }
            .vehicle-info { font-size: 14px; color: #666; margin-top: 5px; }
            .label { font-size: 14px; color: #666; margin-bottom: 5px; }
          </style>
        </head>
        <body>
          <div class="container">
            <p class="label">Vehicle Identification QR Code</p>
            <div class="qr-code">
              <img src="${vehicle.qrCode}" alt="Vehicle QR Code" style="width: 200px; height: 200px;" />
            </div>
            <p class="vehicle-id">${vehicle.vehicleId || vehicle.unitId}</p>
            <p class="vehicle-info">${vehicle.model || '—'} • ${vehicle.plateNumber || '—'}</p>
          </div>
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

  // Handle PDF Download
  async function handleDownloadPDF() {
    try {
      const jsPDFClass = await loadJsPDF()
      const doc = new jsPDFClass()

      // Set header banner styling
      doc.setFillColor(11, 15, 29)
      doc.rect(0, 0, 210, 40, 'F')

      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(20)
      doc.text('SafetyMate Fleet Condition Report', 15, 25)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 145, 25)

      // Vehicle Specs
      doc.setTextColor(33, 33, 33)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('Vehicle Specifications', 15, 55)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(11)
      let y = 65
      const specs = [
        ['Unit ID:', vehicle.unitId || '—'],
        ['Model/Type:', `${vehicle.model || '—'} (${vehicle.vehicleType || '—'})`],
        ['VIN:', vehicle.vin || '—'],
        ['Year:', String(vehicle.year || '—')],
        ['Engine Type:', vehicle.engineType || '—'],
        ['Odometer:', `${(vehicle.mileageKm || 0).toLocaleString()} KM`],
        ['Condition Rating:', `${health}%`],
        ['Compliance Status:', approved ? 'Approved' : 'Pending Audit Approval'],
        ['Assigned Site:', vehicle.site || '—'],
        ['Department:', vehicle.department || '—']
      ]

      specs.forEach(([label, value]) => {
        doc.setFont('helvetica', 'bold')
        doc.text(label, 15, y)
        doc.setFont('helvetica', 'normal')
        doc.text(value, 60, y)
        y += 8
      })

      // Defect Records
      y += 10
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('Defect Records & Diagnostic Summary', 15, y)

      y += 10
      doc.setFontSize(10)
      doc.setFillColor(240, 243, 248)
      doc.rect(15, y - 5, 180, 8, 'F')
      doc.setTextColor(60, 60, 60)
      doc.text('Defect Description', 18, y)
      doc.text('Reported Date', 85, y)
      doc.text('Severity', 125, y)
      doc.text('Status', 160, y)

      y += 8
      doc.setTextColor(33, 33, 33)

      displayedAlerts.forEach((alert) => {
        let dateStr = ''
        if (alert.createdAt) {
          const d = alert.createdAt.toDate ? alert.createdAt.toDate() : new Date(alert.createdAt)
          if (!isNaN(d.getTime())) {
            dateStr = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
          }
        }

        doc.setFont('helvetica', 'bold')
        doc.text(alert.message || '—', 18, y)
        doc.setFont('helvetica', 'normal')
        doc.text(dateStr, 85, y)
        doc.text(alert.severity || '—', 125, y)
        doc.text(alert.status || '—', 160, y)

        y += 8
      })

      // Footer
      doc.setFontSize(8)
      doc.setTextColor(120, 120, 120)
      doc.text('This document serves as an official SafetyMate digital twin asset status record.', 15, 280)
      doc.text('(c) 2026 BGB Group (Pty) Ltd. All Rights Reserved. SafetyMate - A BGB Group Safety Solution.', 15, 285)

      doc.save(`${vehicle.unitId}-condition-report.pdf`)
    } catch (err) {
      console.error('Failed to generate PDF:', err)
      alert('Failed to generate PDF report')
    }
  }

  // Determine condition grade based on health score
  const health = vehicle.healthScore ?? 100
  let grade = 'A-Grade'
  let gradeDesc = 'Optimal Status'
  let gradeColor = '#4deba0'

  if (health < 60) {
    grade = 'C-Grade'
    gradeDesc = 'Critical Issues'
    gradeColor = '#ff535f'
  } else if (health < 85) {
    grade = 'B-Grade'
    gradeDesc = 'Needs Attention'
    gradeColor = '#fe8e2a'
  }

  return (
    <div className="fleet-details-container" style={{ padding: '32px 28px 80px', color: '#ffffff' }}>
      {/* Back button header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(148,163,184,0.7)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              fontWeight: 700,
              padding: '4px 8px 4px 0',
              transition: 'color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#ffffff'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(148,163,184,0.7)'}
          >
            <ArrowLeft size={16} /> {backText}
          </button>
          <span style={{ color: 'rgba(255,255,255,0.1)' }}>/</span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(148,163,184,0.5)' }}>
            Vehicle Twin: {vehicle.unitId}
          </span>
        </div>

        {viewOnly && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={handleDownloadPDF}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(58, 130, 255, 0.08)',
                border: '1px solid rgba(58, 130, 255, 0.2)',
                color: '#3a82ff',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(58, 130, 255, 0.15)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(58, 130, 255, 0.08)'}
            >
              <Download size={13} /> Download Report PDF
            </button>
            {onEdit && (
              <button
                type="button"
                onClick={() => {
                  if (vehicle.complianceStatus === 'Approved') {
                    setShowEditModal(true)
                  } else {
                    onEdit(vehicle)
                  }
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(58, 130, 255, 0.08)',
                  border: '1px solid rgba(58, 130, 255, 0.2)',
                  color: '#3a82ff',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(58, 130, 255, 0.15)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(58, 130, 255, 0.08)'}
              >
                <RefreshCw size={13} /> Edit Vehicle
              </button>
            )}
          </div>
        )}
      </div>

      {/* Top Hero condition report card */}
      <div
        className="fleet-section-card"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '24px',
          background: 'rgba(12, 18, 36, 0.55)',
          border: statusReset ? '1px solid rgba(255, 83, 95, 0.3)' : '1px solid rgba(255, 255, 255, 0.06)',
          marginBottom: '20px',
          borderRadius: '12px',
          flexWrap: 'wrap',
          gap: '24px',
          position: 'relative'
        }}
      >
        {statusReset && (
          <div style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            background: 'rgba(255, 83, 95, 0.15)',
            border: '1px solid rgba(255, 83, 95, 0.3)',
            color: '#ff535f',
            padding: '4px 10px',
            borderRadius: '6px',
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <AlertTriangle size={11} />
            Approval Reset
          </div>
        )}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div>
            <p style={{ margin: '0 0 6px', fontSize: '10px', fontWeight: 800, letterSpacing: '0.08em', color: '#3a82ff', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ShieldCheck size={12} style={{ color: '#3a82ff' }} />
              MONTHLY CONDITION REPORT
            </p>
            <h1 style={{ margin: '0 0 6px', fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em', color: '#ffffff' }}>
              {vehicle.model || vehicle.unitId} {vehicle.vehicleType ? `(${vehicle.vehicleType})` : ''}
            </h1>
            <p style={{ margin: 0, fontSize: '12.5px', color: 'rgba(148, 163, 184, 0.7)', fontWeight: 600 }}>
              Reporting Period: {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })} • VIN: <span style={{ color: '#ffffff' }}>{vehicle.vin || '—'}</span>
            </p>
          </div>
        </div>

        {/* Unified Rating Box */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          background: 'rgba(7, 12, 28, 0.45)', 
          border: '1px solid rgba(255, 255, 255, 0.04)',
          borderRadius: '12px',
          padding: '14px 28px'
        }}>
          {/* Left section: Condition Rating */}
          <div style={{ textAlign: 'center', paddingRight: '28px', borderRight: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <p style={{ margin: '0 0 4px', fontSize: '28px', fontWeight: 800, color: gradeColor, lineHeight: 1 }}>{health}%</p>
            <p style={{ margin: 0, fontSize: '9px', fontWeight: 800, color: 'rgba(148, 163, 184, 0.5)', letterSpacing: '0.06em' }}>CONDITION RATING</p>
          </div>
          {/* Right section: Grade */}
          <div style={{ textAlign: 'center', paddingLeft: '28px' }}>
            <p style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: 800, color: '#ffffff', lineHeight: 1.2 }}>{grade}</p>
            <p style={{ margin: 0, fontSize: '9px', fontWeight: 800, color: gradeColor, letterSpacing: '0.06em' }}>{gradeDesc}</p>
          </div>
        </div>
      </div>

      {/* Vehicle Identification QR Code Card */}
      {vehicle.qrCode && (
        <div className="fleet-section-card" style={{ padding: '24px', marginBottom: '20px', background: 'rgba(58,130,255,0.05)', border: '1px solid rgba(58,130,255,0.2)' }}>
          <h3 style={{ margin: '0 0 20px', fontSize: '11px', fontWeight: 800, color: '#3a82ff',
            letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Fingerprint size={14} /> VEHICLE IDENTIFICATION
          </h3>
          <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
            {/* QR Code Display */}
            <div style={{ flexShrink: 0, background: '#fff', padding: '16px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
              <img src={vehicle.qrCode} alt="Vehicle QR Code" style={{ width: '180px', height: '180px', display: 'block' }} />
            </div>
            
            {/* Vehicle ID and Actions */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <p style={{ margin: '0 0 8px', fontSize: '10px', fontWeight: 800, color: 'rgba(148,163,184,0.6)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  VEHICLE ID
                </p>
                <p style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#3a82ff', fontFamily: 'monospace', letterSpacing: '0.05em' }}>
                  {vehicle.vehicleId || vehicle.unitId}
                </p>
              </div>
              
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={downloadVehicleQR}
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
                  onClick={printVehicleQR}
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
                  Unique vehicle identification QR code. Scan to access vehicle digital twin and maintenance records.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Middle row of two cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1.2fr)', gap: '20px', marginBottom: '20px' }}>
        
        {/* Left: Kilometre Intelligence */}
        <div className="fleet-section-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '14px' }}>
            <div>
              <h2 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 700 }}>Kilometre Intelligence</h2>
              <p style={{ margin: 0, fontSize: '12px', color: 'rgba(148, 163, 184, 0.7)' }}>Usage patterns and distance analysis</p>
            </div>
            <div style={{ display: 'flex', gap: '20px' }}>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#ffffff' }}>{totalDistance}</p>
                <p style={{ margin: 0, fontSize: '9px', fontWeight: 800, color: 'rgba(148,163,184,0.5)', letterSpacing: '0.06em' }}>TOTAL DISTANCE</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#ffffff' }}>{dailyAverage}</p>
                <p style={{ margin: 0, fontSize: '9px', fontWeight: 800, color: 'rgba(148,163,184,0.5)', letterSpacing: '0.06em' }}>DAILY AVG</p>
              </div>
            </div>
          </div>

          <div style={{ flex: 1, minHeight: '180px', width: '100%' }}>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <XAxis 
                    dataKey="name" 
                    tickLine={false} 
                    axisLine={false} 
                    tick={{ fill: 'rgba(148,163,184,0.5)', fontSize: 9, fontWeight: 700 }}
                    padding={{ left: 10, right: 10 }}
                  />
                  <Tooltip 
                    cursor={{ fill: 'rgba(58, 130, 255, 0.05)' }} 
                    contentStyle={{ background: '#0b0f19', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px' }}
                    labelStyle={{ color: 'rgba(148,163,184,0.7)', fontSize: '11px', fontWeight: 700 }}
                    itemStyle={{ color: '#3a82ff', fontSize: '13px', fontWeight: 800 }}
                  />
                  <Bar 
                    dataKey="distance" 
                    fill="#102f62" 
                    radius={[4, 4, 0, 0]}
                    maxBarSize={30}
                  >
                    {chartData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={index === 5 || index === 11 ? '#1c5fb3' : '#142e5c'} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                height: '100%', 
                color: 'rgba(148,163,184,0.4)', 
                fontSize: '12px', 
                fontWeight: 600 
              }}>
                No progression data available
              </div>
            )}
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'rgba(148,163,184,0.5)', fontWeight: 800, letterSpacing: '0.05em', marginTop: '12px' }}>
            <span>No data</span>
            <span>PROGRESSION CYCLE</span>
            <span>No data</span>
          </div>
        </div>

        {/* Right: Service Intervals */}
        <div className="fleet-section-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '14px' }}>
            Service Intervals
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
            {/* Engine Lubrication */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '10px', fontWeight: 800, letterSpacing: '0.06em' }}>
                <span style={{ color: 'rgba(148,163,184,0.8)' }}>ENGINE LUBRICATION</span>
                <span style={{ color: serviceData.serviceStatus === 'OVERDUE' ? '#ff535f' : serviceData.serviceStatus === 'DUE SOON' ? '#fe8e2a' : 'rgba(148,163,184,0.5)' }}>
                  {serviceData.serviceStatus}
                </span>
              </div>
              <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '999px', overflow: 'hidden' }}>
                <div 
                  style={{ 
                    height: '100%', 
                    width: `${serviceData.serviceProgress}%`, 
                    background: serviceData.serviceStatus === 'OVERDUE' ? '#ff535f' : serviceData.serviceStatus === 'DUE SOON' ? '#fe8e2a' : 'rgba(148,163,184,0.3)', 
                    borderRadius: '999px',
                    transition: 'width 0.3s ease'
                  }} 
                />
              </div>
            </div>

            {/* Braking System */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '10px', fontWeight: 800, letterSpacing: '0.06em' }}>
                <span style={{ color: 'rgba(148,163,184,0.8)' }}>BRAKING SYSTEM</span>
                <span style={{ color: 'rgba(148,163,184,0.5)' }}>
                  {serviceData.mileageKm > 0 ? `${serviceData.mileageKm.toLocaleString()} KM` : 'No data'}
                </span>
              </div>
              <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '999px', overflow: 'hidden' }}>
                <div 
                  style={{ 
                    height: '100%', 
                    width: serviceData.mileageKm > 0 ? '75%' : '0%', 
                    background: serviceData.mileageKm > 0 ? 'rgba(148,163,184,0.3)' : 'rgba(148,163,184,0.3)', 
                    borderRadius: '999px' 
                  }} 
                />
              </div>
            </div>

            {/* Tyre Tread Depth */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '10px', fontWeight: 800, letterSpacing: '0.06em' }}>
                <span style={{ color: 'rgba(148,163,184,0.8)' }}>TYRE TREAD DEPTH</span>
                <span style={{ color: 'rgba(148,163,184,0.5)' }}>No data</span>
              </div>
              <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: '0%', background: 'rgba(148,163,184,0.3)', borderRadius: '999px' }} />
              </div>
            </div>

            {/* Estimated Service Box */}
            <div style={{
              marginTop: 'auto',
              padding: '12px 14px',
              borderRadius: '8px',
              background: serviceData.serviceStatus === 'OVERDUE' ? 'rgba(255,83,95,0.08)' : 'rgba(148,163,184,0.05)',
              border: serviceData.serviceStatus === 'OVERDUE' ? '1px solid rgba(255,83,95,0.25)' : '1px solid rgba(255,255,255,0.06)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div style={{ color: serviceData.serviceStatus === 'OVERDUE' ? '#ff535f' : 'rgba(148,163,184,0.5)' }}>
                <Calendar size={18} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '12.5px', fontWeight: 700, color: serviceData.serviceStatus === 'OVERDUE' ? '#ff8080' : 'rgba(148,163,184,0.5)' }}>Estimated Service</p>
                <p style={{ margin: '2px 0 0', fontSize: '11px', color: serviceData.serviceStatus === 'OVERDUE' ? 'rgba(255,128,128,0.85)' : 'rgba(148, 163, 184, 0.4)', fontWeight: 600 }}>
                  {serviceData.serviceStatus === 'No data' ? 'No data available' : serviceData.serviceStatus}
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Defect Summary & Resolution Card */}
      <div className="fleet-section-card" style={{ padding: '24px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '14px' }}>
          <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Defect Summary & Resolution</h2>
          <button
            type="button"
            onClick={() => setShowHistory((prev) => !prev)}
            style={{
              background: 'none',
              border: 'none',
              color: '#3a82ff',
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '0.06em',
              cursor: 'pointer'
            }}
          >
            {showHistory ? 'HIDE HISTORY' : 'VIEW HISTORY'}
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="fleet-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <th style={{ textAlign: 'left', padding: '10px 0', fontSize: '10px', color: 'rgba(148,163,184,0.6)', fontWeight: 800, letterSpacing: '0.05em' }}>DEFECT DESCRIPTION</th>
                <th style={{ textAlign: 'left', padding: '10px 0', fontSize: '10px', color: 'rgba(148,163,184,0.6)', fontWeight: 800, letterSpacing: '0.05em' }}>REPORTED DATE</th>
                <th style={{ textAlign: 'left', padding: '10px 0', fontSize: '10px', color: 'rgba(148,163,184,0.6)', fontWeight: 800, letterSpacing: '0.05em' }}>SEVERITY</th>
                <th style={{ textAlign: 'left', padding: '10px 0', fontSize: '10px', color: 'rgba(148,163,184,0.6)', fontWeight: 800, letterSpacing: '0.05em' }}>RESOLUTION STATUS</th>
                <th style={{ textAlign: 'left', padding: '10px 0', fontSize: '10px', color: 'rgba(148,163,184,0.6)', fontWeight: 800, letterSpacing: '0.05em' }}>REFERENCE</th>
              </tr>
            </thead>
            <tbody>
              {paginatedDefects.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '24px 0', color: 'rgba(148,163,184,0.5)', fontSize: '13px' }}>
                    No defect records found for this vehicle.
                  </td>
                </tr>
              ) : (
                paginatedDefects.map((defect) => {
                  let sevColor = 'rgba(148,163,184,0.1)'
                  let sevText = '#94a3b8'
                  let border = '1px solid rgba(148,163,184,0.2)'
                  if (defect.severity === 'HIGH') {
                    sevColor = 'rgba(255,83,95,0.08)'
                    sevText = '#ff8080'
                    border = '1px solid rgba(255,83,95,0.2)'
                  } else if (defect.severity === 'MEDIUM') {
                    sevColor = 'rgba(254,142,42,0.08)'
                    sevText = '#fe8e2a'
                    border = '1px solid rgba(254,142,42,0.2)'
                  }

                  let statusNode = null
                  if (defect.status === 'RESOLVED') {
                    statusNode = (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#16c988', fontWeight: 600 }}>
                        <CheckCircle size={13} style={{ color: '#16c988' }} /> Resolved
                      </span>
                    )
                  } else if (defect.status === 'OPEN') {
                    statusNode = (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#fe8e2a', fontWeight: 600 }}>
                        <AlertTriangle size={13} style={{ color: '#fe8e2a' }} /> Open
                      </span>
                    )
                  }

                  let dateStr = ''
                  if (defect.reportedDate) {
                    const d = defect.reportedDate
                    if (!isNaN(d.getTime())) {
                      dateStr = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
                    }
                  }

                  return (
                    <tr key={defect.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '14px 0', fontSize: '13.5px', fontWeight: 700, color: '#ffffff' }}>
                        {defect.description}
                      </td>
                      <td style={{ padding: '14px 0', fontSize: '12.5px', color: 'rgba(148, 163, 184, 0.7)', fontWeight: 600 }}>
                        {dateStr}
                      </td>
                      <td style={{ padding: '14px 0' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '9.5px',
                          fontWeight: 800,
                          backgroundColor: sevColor,
                          color: sevText,
                          border: border,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em'
                        }}>
                          {defect.severity}
                        </span>
                      </td>
                      <td style={{ padding: '14px 0', fontSize: '12.5px' }}>
                        {statusNode}
                      </td>
                      <td style={{ padding: '14px 0', fontSize: '12.5px', color: 'rgba(148, 163, 184, 0.5)', fontFamily: 'monospace', fontWeight: 700 }}>
                        {defect.reference}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination for defects */}
        {defectTotalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ fontSize: '11.5px', color: 'rgba(148,163,184,0.5)' }}>
              Showing {paginatedAlerts.length} of {displayedAlerts.length} defect{displayedAlerts.length !== 1 ? 's' : ''}
            </span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setDefectPage((p) => Math.max(1, p - 1))}
                disabled={defectSafePage <= 1}
                style={{ background: 'none', border: 'none', fontSize: '12.5px', fontWeight: 700, color: defectSafePage <= 1 ? 'rgba(148,163,184,0.25)' : 'rgba(148,163,184,0.7)', cursor: defectSafePage <= 1 ? 'not-allowed' : 'pointer', padding: '4px 8px' }}
              >
                Previous
              </button>
              <span style={{ fontSize: '11px', color: 'rgba(148,163,184,0.4)' }}>{defectSafePage} / {defectTotalPages}</span>
              <button
                type="button"
                onClick={() => setDefectPage((p) => Math.min(defectTotalPages, p + 1))}
                disabled={defectSafePage >= defectTotalPages}
                style={{ background: 'none', border: 'none', fontSize: '12.5px', fontWeight: 700, color: defectSafePage >= defectTotalPages ? 'rgba(148,163,184,0.25)' : 'rgba(148,163,184,0.7)', cursor: defectSafePage >= defectTotalPages ? 'not-allowed' : 'pointer', padding: '4px 8px' }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Compliance Audit Statement Card */}
      {!viewOnly && (
        <div
          className="fleet-section-card"
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr auto',
            gap: '24px',
            padding: '24px',
            background: 'rgba(12, 18, 36, 0.4)',
            borderLeft: '4px solid #3a82ff',
            alignItems: 'center',
            flexWrap: 'wrap'
          }}
        >
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            background: 'rgba(58, 130, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#3a82ff',
            border: '1px solid rgba(58, 130, 255, 0.15)'
          }}>
            <Shield size={20} />
          </div>

          <div>
            <h3 style={{ margin: '0 0 6px', fontSize: '14.5px', fontWeight: 700, color: '#ffffff' }}>
              Compliance Audit Statement
            </h3>
            <p style={{ margin: 0, fontSize: '12px', color: 'rgba(148, 163, 184, 0.7)', lineHeight: 1.5 }}>
              This vehicle has undergone a comprehensive internal audit for the month of{' '}
              {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}. Based on the resolution
              of critical defects and sensor diagnostics, the vehicle is cleared for operational duty for the next
              reporting period, pending the scheduled tyre replacement.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={handleDownloadPDF}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(235,242,255,0.85)',
                borderRadius: '8px',
                padding: '10px 18px',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
            >
              <Download size={14} /> Download PDF
            </button>

            <button
              type="button"
              onClick={handleSubmitApproval}
              disabled={submitting || approved}
              style={{
                background: approved ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #3a82ff, #1c5fb3)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#ffffff',
                borderRadius: '8px',
                padding: '10px 18px',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: submitting || approved ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.7 : 1,
                transition: 'filter 0.2s'
              }}
              onMouseEnter={(e) => { if (!approved && !submitting) e.currentTarget.style.filter = 'brightness(1.1)' }}
              onMouseLeave={(e) => { if (!approved && !submitting) e.currentTarget.style.filter = 'none' }}
            >
              {submitting ? 'Submitting...' : approved ? 'Approved ✓' : 'Submit Approval'}
            </button>
          </div>
        </div>
      )}

      {message && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          padding: '12px 20px',
          borderRadius: '8px',
          background: approved ? '#064e3b' : '#7f1d1d',
          border: `1px solid ${approved ? '#059669' : '#dc2626'}`,
          color: '#ffffff',
          fontSize: '13px',
          fontWeight: 600,
          zIndex: 9999,
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
        }}>
          {message}
        </div>
      )}

      {/* Edit Confirmation Modal */}
      {showEditModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <div style={{
            background: '#0b0f1d',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '400px',
            width: '90%',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>
                Edit Approved Vehicle
              </h3>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                style={{ background: 'none', border: 'none', color: 'rgba(148, 163, 184, 0.7)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>
            <p style={{ margin: '0 0 20px', fontSize: '13px', color: 'rgba(148, 163, 184, 0.8)', lineHeight: 1.5 }}>
              This vehicle is currently <span style={{ color: '#4deba0', fontWeight: 600 }}>Approved</span>. Editing it will reset its compliance status to <span style={{ color: '#ff535f', fontWeight: 600 }}>Pending</span> and require re-approval. Do you want to continue?
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#ffffff',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowEditModal(false)
                  onEdit(vehicle)
                }}
                style={{
                  background: 'linear-gradient(135deg, #3a82ff, #1c5fb3)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#ffffff',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Continue to Edit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
