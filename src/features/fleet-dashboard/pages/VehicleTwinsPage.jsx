import React, { useState, useMemo } from 'react'
import { 
  Plus, 
  Search, 
  ChevronDown, 
  SlidersHorizontal,
  BarChart2,
  CheckCircle,
  AlertTriangle,
  Truck,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { useFleetData } from '../hooks/useFleetData.js'
import { RegisterVehiclePage } from './RegisterVehiclePage.jsx'
import { VehicleDetails } from '../components/VehicleDetails.jsx'
import { CustomSelect } from '../../training-dashboard/components/CustomSelect.jsx'
import '../fleet.css'

const PAGE_SIZE = 10

export function VehicleTwinsPage() {
  const {
    vehicles,
    alerts,
    loading,
    addVehicle,
  } = useFleetData()

  // Selection & UI controls state
  const [selectedVehicle, setSelectedVehicle] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  
  // Filtering state
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [siteFilter, setSiteFilter] = useState('')
  const [complianceFilter, setComplianceFilter] = useState('')
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [engineFilter, setEngineFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  
  // Pagination state
  const [page, setPage] = useState(1)

  // 1. Calculate dynamic statistics
  const totalFleet = vehicles.length
  const operationalUnits = vehicles.filter(v => v.status === 'active').length
  const availabilityRate = totalFleet ? Math.round((operationalUnits / totalFleet) * 100) : 0
  
  // Critical defects: open (non-resolved) critical alerts
  const criticalDefects = alerts.filter(
    (a) => a.severity === 'critical' && a.status !== 'resolved'
  ).length

  // 2. Fetch list of unique types and sites for dropdowns dynamically
  const vehicleTypes = useMemo(() => {
    const set = new Set(vehicles.map(v => v.vehicleType).filter(Boolean))
    return Array.from(set)
  }, [vehicles])

  const vehicleSites = useMemo(() => {
    const set = new Set(vehicles.map(v => v.site).filter(Boolean))
    return Array.from(set)
  }, [vehicles])

  // 3. Filter vehicles list
  const filteredVehicles = useMemo(() => {
    let list = [...vehicles]

    // Text search
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (v) =>
          (v.unitId || '').toLowerCase().includes(q) ||
          (v.plateNumber || '').toLowerCase().includes(q) ||
          (v.model || '').toLowerCase().includes(q)
      )
    }

    // Type filter
    if (typeFilter) {
      list = list.filter(v => v.vehicleType === typeFilter)
    }

    // Site filter
    if (siteFilter) {
      list = list.filter(v => v.site === siteFilter)
    }

    // Compliance filter
    // Compliant: healthScore >= 80, Non-Compliant: healthScore < 80
    if (complianceFilter) {
      if (complianceFilter === 'Compliant') {
        list = list.filter(v => (v.healthScore ?? 100) >= 80)
      } else if (complianceFilter === 'Non-Compliant') {
        list = list.filter(v => (v.healthScore ?? 100) < 80)
      }
    }

    // Advanced: Engine Type filter
    if (engineFilter) {
      list = list.filter(v => (v.engineType || '').toLowerCase().includes(engineFilter.toLowerCase()))
    }

    // Advanced: Status filter
    if (statusFilter) {
      list = list.filter(v => v.status === statusFilter)
    }

    return list
  }, [vehicles, search, typeFilter, siteFilter, complianceFilter, engineFilter, statusFilter])

  // 4. Client-side Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredVehicles.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paginatedVehicles = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return filteredVehicles.slice(start, start + PAGE_SIZE)
  }, [filteredVehicles, safePage])

  // Register vehicle save handler
  async function handleAdd(data) {
    setSaving(true)
    try {
      await addVehicle(data)
    } finally {
      setSaving(false)
      setShowAdd(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', gap: '12px', color: 'rgba(148,163,184,0.8)' }}>
        <span className="fleet-spinner fleet-spinner--lg" />
        <span style={{ fontSize: '14px', fontWeight: 600 }}>Loading vehicles…</span>
      </div>
    )
  }

  // Toggled details view inside the same subpage context
  if (selectedVehicle) {
    return (
      <VehicleDetails 
        vehicle={selectedVehicle} 
        alerts={alerts} 
        onBack={() => setSelectedVehicle(null)} 
      />
    )
  }

  // Toggled register view inside the same subpage context
  if (showAdd) {
    return (
      <RegisterVehiclePage 
        onSave={handleAdd} 
        onCancel={() => setShowAdd(false)} 
        loading={saving} 
      />
    )
  }

  // Generate pagination indices
  const pageNumbers = []
  if (totalPages <= 5) {
    for (let i = 1; i <= totalPages; i++) pageNumbers.push(i)
  } else {
    if (safePage <= 3) {
      pageNumbers.push(1, 2, 3, '...', totalPages)
    } else if (safePage >= totalPages - 2) {
      pageNumbers.push(1, '...', totalPages - 2, totalPages - 1, totalPages)
    } else {
      pageNumbers.push(1, '...', safePage, '...', totalPages)
    }
  }

  return (
    <div className="fleet-subpage" style={{ padding: '32px 28px 80px', color: '#ffffff' }}>
      
      {/* Redesigned Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '22px' }}>
        <div>
          <h1 className="fleet-subpage-title" style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.025em' }}>
            Vehicle Registry
          </h1>
          <p className="fleet-subpage-sub" style={{ margin: 0, fontSize: '13px', color: 'rgba(148, 163, 184, 0.7)', fontWeight: 600 }}>
            Real-time oversight of the organizational fleet and compliance metrics.
          </p>
        </div>
        <button
          type="button"
          className="fleet-btn"
          onClick={() => setShowAdd(true)}
          style={{
            background: 'linear-gradient(135deg, #3a82ff, #1c5fb3)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: '#ffffff',
            padding: '9px 18px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            transition: 'filter 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.1)'}
          onMouseLeave={(e) => e.currentTarget.style.filter = 'none'}
        >
          <span style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.15)', borderRadius: '50%', padding: '2px' }}>
            <Plus size={13} strokeWidth={3} />
          </span>
          Register New Vehicle
        </button>
      </div>

      {/* Grid of 3 KPI Cards */}
      <div className="fleet-vt-kpi-row">
        
        {/* Card 1: Total Fleet Units */}
        <div className="fleet-section-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
            <div>
              <p style={{ margin: '0 0 6px', fontSize: '10px', fontWeight: 800, color: 'rgba(148, 163, 184, 0.5)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                TOTAL FLEET UNITS
              </p>
              <h2 style={{ margin: 0, fontSize: '28px', fontWeight: 800, letterSpacing: '-0.03em', color: '#ffffff' }}>
                {totalFleet.toLocaleString()}
              </h2>
            </div>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              background: 'rgba(58, 130, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#3a82ff',
              border: '1px solid rgba(58, 130, 255, 0.15)'
            }}>
              <BarChart2 size={16} />
            </div>
          </div>
          <p style={{ margin: 'auto 0 0', fontSize: '11px', fontWeight: 700, color: '#16c988', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '12px' }}>↗</span> +2.4% from last month
          </p>
        </div>

        {/* Card 2: Operational Units */}
        <div className="fleet-section-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
            <div>
              <p style={{ margin: '0 0 6px', fontSize: '10px', fontWeight: 800, color: 'rgba(148, 163, 184, 0.5)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                OPERATIONAL UNITS
              </p>
              <h2 style={{ margin: 0, fontSize: '28px', fontWeight: 800, letterSpacing: '-0.03em', color: '#ffffff' }}>
                {operationalUnits.toLocaleString()}
              </h2>
            </div>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              background: 'rgba(22, 201, 136, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#16c988',
              border: '1px solid rgba(22, 201, 136, 0.15)'
            }}>
              <CheckCircle size={15} />
            </div>
          </div>
          
          {/* Availability progress tracker */}
          <div style={{ width: '100%', marginTop: 'auto' }}>
            <div style={{ height: '5px', background: 'rgba(255,255,255,0.05)', borderRadius: '999px', overflow: 'hidden', marginBottom: '6px' }}>
              <div style={{ height: '100%', width: `${availabilityRate}%`, background: '#16c988', borderRadius: '999px' }} />
            </div>
            <p style={{ margin: 0, fontSize: '9px', fontWeight: 800, color: 'rgba(148, 163, 184, 0.5)', letterSpacing: '0.05em' }}>
              {availabilityRate}% AVAILABILITY RATE
            </p>
          </div>
        </div>

        {/* Card 3: Critical Defects */}
        <div className="fleet-section-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
            <div>
              <p style={{ margin: '0 0 6px', fontSize: '10px', fontWeight: 800, color: 'rgba(148, 163, 184, 0.5)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                CRITICAL DEFECTS
              </p>
              <h2 style={{ margin: 0, fontSize: '28px', fontWeight: 800, letterSpacing: '-0.03em', color: '#ff535f' }}>
                {criticalDefects}
              </h2>
            </div>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              background: 'rgba(255, 83, 95, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ff535f',
              border: '1px solid rgba(255, 83, 95, 0.15)'
            }}>
              <AlertTriangle size={15} />
            </div>
          </div>
          <p style={{ margin: 'auto 0 0', fontSize: '11px', fontWeight: 700, color: '#ff535f', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '14px' }}>✳</span> Immediate intervention required
          </p>
        </div>

      </div>

      {/* Filter and controls panel card */}
      <div
        className="fleet-section-card fleet-vt-filter-row"
        style={{
          padding: '12px 16px',
          background: 'rgba(12, 18, 36, 0.55)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          marginBottom: '20px',
          borderRadius: '10px'
        }}
      >
        {/* Search input field wrapper */}
        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(148, 163, 184, 0.5)', pointerEvents: 'none' }} />
          <input
            type="text"
            className="fleet-search-input"
            placeholder="Search by Vehicle ID, Plate Number, or Model..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            style={{
              width: '100%',
              padding: '9px 12px 9px 36px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '8px',
              color: '#ffffff',
              fontSize: '13px',
              outline: 'none'
            }}
          />
        </div>

        {/* Dropdown 1: Vehicle Type */}
        <div style={{ minWidth: '150px' }}>
          <CustomSelect
            value={typeFilter}
            onChange={(val) => { setTypeFilter(val); setPage(1); }}
            options={vehicleTypes}
            placeholder="Vehicle Type"
            searchable={false}
          />
        </div>

        {/* Dropdown 2: Assigned Site */}
        <div style={{ minWidth: '180px' }}>
          <CustomSelect
            value={siteFilter}
            onChange={(val) => { setSiteFilter(val); setPage(1); }}
            options={vehicleSites}
            placeholder="Assigned Site"
            searchable={true}
          />
        </div>

        {/* Dropdown 3: Compliance */}
        <div style={{ minWidth: '150px' }}>
          <CustomSelect
            value={complianceFilter}
            onChange={(val) => { setComplianceFilter(val); setPage(1); }}
            options={['Compliant', 'Non-Compliant']}
            placeholder="Compliance"
            searchable={false}
          />
        </div>

        <button
          type="button"
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          className={`fleet-advanced-btn${showAdvancedFilters ? ' active' : ''}`}
        >
          <SlidersHorizontal size={13} /> Advanced
        </button>
      </div>

      {/* Advanced filters drawer/row */}
      {showAdvancedFilters && (
        <div
          style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
            padding: '12px 16px',
            background: 'rgba(7, 12, 28, 0.65)',
            border: '1px solid rgba(58, 130, 255, 0.1)',
            borderRadius: '10px',
            marginBottom: '20px',
            animation: 'fleet-filters-in 0.22s cubic-bezier(0.16, 1, 0.3, 1) both'
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 800, color: 'rgba(148, 163, 184, 0.6)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Advanced Filters:
          </div>
          
          {/* Engine Type Filter */}
          <div style={{ minWidth: '180px' }}>
            <CustomSelect
              value={engineFilter}
              onChange={(val) => { setEngineFilter(val); setPage(1); }}
              options={['Internal Combustion (ICE)', 'Electric Vehicle (EV)', 'Hybrid']}
              placeholder="Engine Type"
              searchable={false}
            />
          </div>

          {/* Status Filter */}
          <div style={{ minWidth: '160px' }}>
            <CustomSelect
              value={statusFilter}
              onChange={(val) => { setStatusFilter(val); setPage(1); }}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'maintenance', label: 'In Maintenance' },
                { value: 'suspended', label: 'Suspended' }
              ]}
              placeholder="Vehicle Status"
              searchable={false}
            />
          </div>

          {/* Reset Button */}
          <button
            type="button"
            onClick={() => {
              setEngineFilter('');
              setStatusFilter('');
              setTypeFilter('');
              setSiteFilter('');
              setComplianceFilter('');
              setSearch('');
              setPage(1);
            }}
            style={{
              marginLeft: 'auto',
              background: 'rgba(255,83,95,0.08)',
              border: '1px solid rgba(255,83,95,0.15)',
              color: '#ff8080',
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,83,95,0.15)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,83,95,0.08)'}
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* Main Table view of vehicles */}
      <div className="fleet-section-card" style={{ marginBottom: '18px' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="fleet-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(7, 12, 28, 0.25)' }}>
                <th style={{ textAlign: 'left', padding: '14px 20px', fontSize: '10.5px', color: 'rgba(148,163,184,0.6)', fontWeight: 800, letterSpacing: '0.06em' }}>VEHICLE IDENTIFIER</th>
                <th style={{ textAlign: 'left', padding: '14px 20px', fontSize: '10.5px', color: 'rgba(148,163,184,0.6)', fontWeight: 800, letterSpacing: '0.06em' }}>TYPE & MODEL</th>
                <th style={{ textAlign: 'left', padding: '14px 20px', fontSize: '10.5px', color: 'rgba(148,163,184,0.6)', fontWeight: 800, letterSpacing: '0.06em' }}>ASSIGNED SITE</th>
                <th style={{ textAlign: 'left', padding: '14px 20px', fontSize: '10.5px', color: 'rgba(148,163,184,0.6)', fontWeight: 800, letterSpacing: '0.06em' }}>ODOMETER</th>
                <th style={{ textAlign: 'left', padding: '14px 20px', fontSize: '10.5px', color: 'rgba(148,163,184,0.6)', fontWeight: 800, letterSpacing: '0.06em' }}>HEALTH SCORE</th>
                <th style={{ textAlign: 'left', padding: '14px 20px', fontSize: '10.5px', color: 'rgba(148,163,184,0.6)', fontWeight: 800, letterSpacing: '0.06em' }}>STATUS</th>
                <th style={{ textAlign: 'right', padding: '14px 20px', fontSize: '10.5px', color: 'rgba(148,163,184,0.6)', fontWeight: 800, letterSpacing: '0.06em' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {paginatedVehicles.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '36px 0', color: 'rgba(148,163,184,0.5)', fontSize: '13.5px' }}>
                    No vehicle twins found matching the filters.
                  </td>
                </tr>
              ) : (
                paginatedVehicles.map((v) => {
                  const health = v.healthScore ?? 100
                  
                  // Health bar color selector
                  let healthColor = '#16c988' // high
                  if (health < 60) healthColor = '#ff535f' // low
                  else if (health < 85) healthColor = '#fe8e2a' // mid

                  // Status pill style variables
                  let statusBg = 'rgba(22, 201, 136, 0.08)'
                  let statusText = '#4deba0'
                  let statusDot = '#16c988'
                  let statusBorder = '1px solid rgba(22, 201, 136, 0.2)'
                  let statusLabel = 'ACTIVE'

                  if (v.status === 'maintenance') {
                    statusBg = 'rgba(254, 142, 42, 0.08)'
                    statusText = '#ffb56e'
                    statusDot = '#fe8e2a'
                    statusBorder = '1px solid rgba(254, 142, 42, 0.2)'
                    statusLabel = 'IN MAINTENANCE'
                  } else if (v.status === 'suspended' || v.status === 'offline') {
                    statusBg = 'rgba(255, 83, 95, 0.08)'
                    statusText = '#ff8080'
                    statusDot = '#ff535f'
                    statusBorder = '1px solid rgba(255, 83, 95, 0.2)'
                    statusLabel = 'SUSPENDED'
                  }

                  const formattedMileage = v.mileageKm != null ? v.mileageKm.toLocaleString() + ' KM' : '—'

                  return (
                    <tr
                      key={v.id}
                      onClick={() => setSelectedVehicle(v)}
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.015)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      {/* VEHICLE IDENTIFIER */}
                      <td style={{ padding: '14px 20px', verticalAlign: 'middle' }}>
                        <p style={{ margin: '0 0 2px', fontSize: '14px', fontWeight: 800, color: '#ffffff' }}>
                          {v.unitId || '—'}
                        </p>
                        <p style={{ margin: 0, fontSize: '11px', color: 'rgba(148, 163, 184, 0.5)', fontWeight: 700 }}>
                          {v.plateNumber || '—'}
                        </p>
                      </td>

                      {/* TYPE & MODEL */}
                      <td style={{ padding: '14px 20px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '6px',
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.05)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'rgba(148, 163, 184, 0.7)'
                          }}>
                            <Truck size={14} />
                          </div>
                          <div>
                            <p style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>
                              {v.model || v.unitId}
                            </p>
                            <p style={{ margin: 0, fontSize: '11px', color: 'rgba(148, 163, 184, 0.5)', fontWeight: 600 }}>
                              ({v.vehicleType || '—'})
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* ASSIGNED SITE */}
                      <td style={{ padding: '14px 20px', fontSize: '13px', color: 'rgba(235, 242, 255, 0.95)', fontWeight: 600, verticalAlign: 'middle' }}>
                        {v.site || '—'}
                      </td>

                      {/* ODOMETER */}
                      <td style={{ padding: '14px 20px', fontSize: '13px', color: 'rgba(235, 242, 255, 0.95)', fontWeight: 600, verticalAlign: 'middle' }}>
                        {formattedMileage}
                      </td>

                      {/* HEALTH SCORE */}
                      <td style={{ padding: '14px 20px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '110px' }}>
                          <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '999px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${health}%`, background: healthColor, borderRadius: '999px' }} />
                          </div>
                          <span style={{ fontSize: '12.5px', fontWeight: 700, color: healthColor }}>
                            {health}%
                          </span>
                        </div>
                      </td>

                      {/* STATUS */}
                      <td style={{ padding: '14px 20px', verticalAlign: 'middle' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '3px 10px',
                          borderRadius: '6px',
                          backgroundColor: statusBg,
                          color: statusText,
                          border: statusBorder,
                          fontSize: '9.5px',
                          fontWeight: 800,
                          letterSpacing: '0.05em'
                        }}>
                          <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: statusDot }} />
                          {statusLabel}
                        </span>
                      </td>

                      {/* ACTIONS */}
                      <td style={{ padding: '14px 20px', textAlign: 'right', verticalAlign: 'middle' }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedVehicle(v)
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'rgba(148, 163, 184, 0.4)',
                            cursor: 'pointer',
                            padding: '4px',
                            transition: 'color 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.color = '#ffffff'}
                          onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(148, 163, 184, 0.4)'}
                        >
                          <ChevronRight size={16} />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination row */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <p style={{ margin: 0, fontSize: '12.5px', color: 'rgba(148, 163, 184, 0.5)', fontWeight: 600 }}>
            Showing <span style={{ color: '#ffffff', fontWeight: 700 }}>{(safePage - 1) * PAGE_SIZE + 1}-{Math.min(safePage * PAGE_SIZE, filteredVehicles.length)}</span> of <span style={{ color: '#ffffff', fontWeight: 700 }}>{filteredVehicles.length}</span> entries
          </p>
          
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {/* Prev button */}
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={safePage === 1}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)',
                color: safePage === 1 ? 'rgba(148,163,184,0.3)' : '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: safePage === 1 ? 'not-allowed' : 'pointer'
              }}
            >
              <ChevronLeft size={16} />
            </button>

            {/* Page number buttons */}
            {pageNumbers.map((n, i) => {
              if (n === '...') {
                return (
                  <span key={`dots-${i}`} style={{ color: 'rgba(148,163,184,0.5)', padding: '0 4px', fontSize: '13px' }}>
                    ...
                  </span>
                )
              }
              const isActive = safePage === n
              return (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '6px',
                    background: isActive ? '#3a82ff' : 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    color: isActive ? '#ffffff' : 'rgba(148,163,184,0.7)',
                    fontWeight: 700,
                    fontSize: '12.5px',
                    cursor: 'pointer'
                  }}
                >
                  {n}
                </button>
              )
            })}

            {/* Next button */}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)',
                color: safePage === totalPages ? 'rgba(148,163,184,0.3)' : '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: safePage === totalPages ? 'not-allowed' : 'pointer'
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
