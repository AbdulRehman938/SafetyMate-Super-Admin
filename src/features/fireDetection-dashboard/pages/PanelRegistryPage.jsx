import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, ChevronDown, Edit, Filter } from 'lucide-react'
import { useFireDetectionData } from '../hooks/useFireDetectionData.js'
import '../fd.css'

export function PanelRegistryPage() {
  const navigate = useNavigate()
  const { panels, loading, zones, totalPanels, panelsRequiringReplacement, avgSystemSensitivity } = useFireDetectionData()
  
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedZone, setSelectedZone] = useState('all')
  const [sortBy, setSortBy] = useState('replacementDate')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  
  const [zoneDropdownOpen, setZoneDropdownOpen] = useState(false)
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false)
  
  const zoneDropdownRef = useRef(null)
  const sortDropdownRef = useRef(null)

  // Filter and sort panels
  const filteredPanels = panels.filter(panel => {
    const matchesSearch = 
      panel.panelId?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      panel.zone?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesZone = selectedZone === 'all' || panel.zoneId === selectedZone
    return matchesSearch && matchesZone
  })

  const sortedPanels = [...filteredPanels].sort((a, b) => {
    if (sortBy === 'replacementDate') {
      return new Date(a.installDate || 0) - new Date(b.installDate || 0)
    }
    if (sortBy === 'sensitivity') {
      return (b.sensitivity || 0) - (a.sensitivity || 0)
    }
    return 0
  })

  const totalPages = Math.ceil(sortedPanels.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const currentPanels = sortedPanels.slice(startIndex, startIndex + itemsPerPage)

  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  // Click outside handlers for dropdowns
  useEffect(() => {
    function clickOutside(e) {
      if (zoneDropdownRef.current && !zoneDropdownRef.current.contains(e.target)) {
        setZoneDropdownOpen(false)
      }
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(e.target)) {
        setSortDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', clickOutside)
    return () => document.removeEventListener('mousedown', clickOutside)
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '60vh', gap: 16, color: 'rgba(148,163,184,0.8)' }}>
        <span className="fd-spinner fd-spinner--lg" />
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          Loading panel registry...
        </span>
      </div>
    )
  }

  return (
    <div className="fd-subpage">
      {/* Page Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: '0 0 8px', fontSize: 'clamp(1.4rem, 3vw, 1.9rem)', fontWeight: 900, color: 'rgba(235,242,255,0.97)', letterSpacing: '-0.025em' }}>
            Detect Panel Registry & Lifecycle
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: 'rgba(148,163,184,0.72)' }}>
            Manage critical sensing infrastructure, track unit sensitivity degradation, and coordinate end-of-life replacement scheduling across all active zones.
          </p>
        </div>
        <button
          type="button"
          className="fd-btn fd-btn--primary"
          onClick={() => navigate('/detection/panels/new')}
          style={{ padding: '10px 20px' }}
        >
          <Plus size={16} style={{ marginRight: 8 }} />
          Add New Panel
        </button>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div className="fd-card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.55)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            Total Managed Units
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 32, fontWeight: 900, color: 'rgba(235,242,255,0.97)' }}>
              {totalPanels.toLocaleString()}
            </span>
            {totalPanels > 0 && (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#3a82ff' }}>
                +{Math.min(12, totalPanels)} New
              </span>
            )}
          </div>
          <div style={{ marginTop: 12, height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 2 }}>
            <div style={{ width: '100%', height: '100%', background: '#3a82ff', borderRadius: 2 }} />
          </div>
        </div>

        <div className="fd-card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.55)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            Replacements Due
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 32, fontWeight: 900, color: '#ff535f' }}>
              {panelsRequiringReplacement}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#ff535f' }}>
              Critical Priority
            </span>
          </div>
          <div style={{ marginTop: 12, height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 2 }}>
            <div style={{ width: `${Math.min(100, (panelsRequiringReplacement / (totalPanels || 1)) * 100)}%`, height: '100%', background: '#ff535f', borderRadius: 2 }} />
          </div>
        </div>

        <div className="fd-card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.55)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            Avg. System Sensitivity
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 32, fontWeight: 900, color: 'rgba(235,242,255,0.97)' }}>
              {avgSystemSensitivity ? `${avgSystemSensitivity.toFixed(1)}%` : '—'}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#16c988' }}>
              Optimal
            </span>
          </div>
          <div style={{ marginTop: 12, height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 2 }}>
            <div style={{ width: `${avgSystemSensitivity || 0}%`, height: '100%', background: '#16c988', borderRadius: 2 }} />
          </div>
        </div>

        <div className="fd-card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.55)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            Annual Compliance Score
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, color: 'rgba(235,242,255,0.97)' }}>
            100
          </div>
          <div style={{ marginTop: 12, height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 2 }}>
            <div style={{ width: '100%', height: '100%', background: '#3a82ff', borderRadius: 2 }} />
          </div>
        </div>
      </div>

      {/* Controls Row */}
      <div className="fd-card" style={{ padding: '12px 16px', marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', overflow: 'visible', position: 'relative', zIndex: 100 }}>
        <div style={{ flex: 1, minWidth: 200, display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }}>
          <Search size={16} style={{ color: 'rgba(148,163,184,0.55)' }} />
          <input
            type="text"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'rgba(235,242,255,0.9)', fontSize: 13 }}
            placeholder="Search Device ID or Zone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="fd-custom-select" ref={zoneDropdownRef} style={{ minWidth: 160 }}>
          <div
            className={`fd-custom-select-trigger ${zoneDropdownOpen ? 'open' : ''}`}
            onClick={() => setZoneDropdownOpen(!zoneDropdownOpen)}
          >
            <Filter size={14} style={{ marginRight: 8 }} />
            <span>{selectedZone === 'all' ? 'All Zones' : zones.find(z => z.id === selectedZone)?.name || 'Select Zone'}</span>
            <ChevronDown size={14} className={`fd-custom-select-chevron ${zoneDropdownOpen ? 'open' : ''}`} />
          </div>
          {zoneDropdownOpen && (
            <div className="fd-custom-select-dropdown" style={{ maxHeight: 200, overflowY: 'auto' }}>
              <div
                className={`fd-custom-select-option ${selectedZone === 'all' ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedZone('all')
                  setZoneDropdownOpen(false)
                }}
              >
                All Zones
              </div>
              {zones.map(z => (
                <div
                  key={z.id}
                  className={`fd-custom-select-option ${selectedZone === z.id ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedZone(z.id)
                    setZoneDropdownOpen(false)
                  }}
                >
                  {z.name}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          <span style={{ fontSize: 12, color: 'rgba(148,163,184,0.55)', fontWeight: 600 }}>Sort by:</span>
          <div className="fd-custom-select" ref={sortDropdownRef} style={{ minWidth: 160 }}>
            <div
              className={`fd-custom-select-trigger ${sortDropdownOpen ? 'open' : ''}`}
              onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
            >
              <span>{sortBy === 'replacementDate' ? 'Replacement Date' : 'Sensitivity'}</span>
              <ChevronDown size={14} className={`fd-custom-select-chevron ${sortDropdownOpen ? 'open' : ''}`} />
            </div>
            {sortDropdownOpen && (
              <div className="fd-custom-select-dropdown">
                <div
                  className={`fd-custom-select-option ${sortBy === 'replacementDate' ? 'selected' : ''}`}
                  onClick={() => {
                    setSortBy('replacementDate')
                    setSortDropdownOpen(false)
                  }}
                >
                  Replacement Date
                </div>
                <div
                  className={`fd-custom-select-option ${sortBy === 'sensitivity' ? 'selected' : ''}`}
                  onClick={() => {
                    setSortBy('sensitivity')
                    setSortDropdownOpen(false)
                  }}
                >
                  Sensitivity
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Panel List */}
      <div className="fd-card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Table Header */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1.2fr 1.2fr 1fr 1fr 0.8fr', 
          gap: 12, 
          padding: '14px 20px', 
          background: 'rgba(255,255,255,0.03)', 
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          fontSize: 11,
          fontWeight: 800,
          color: 'rgba(148,163,184,0.55)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em'
        }}>
          <span>Device Identification</span>
          <span>Location & Zone</span>
          <span>Install Date</span>
          <span>Sensitivity</span>
          <span>Action</span>
        </div>

        {/* Panel Rows */}
        {currentPanels.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'rgba(148,163,184,0.6)' }}>
            No panels found
          </div>
        ) : (
          currentPanels.map(panel => (
            <div
              key={panel.id}
              onClick={() => navigate(`/detection/panels/${panel.id}`)}
              style={{
                display: 'grid',
                gridTemplateColumns: '1.2fr 1.2fr 1fr 1fr 0.8fr',
                gap: 12,
                padding: '16px 20px',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                alignItems: 'center',
                cursor: 'pointer',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              {/* Device Identification */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: 'rgba(235,242,255,0.97)' }}>
                  {panel.panelId || 'Unknown Panel'}
                </span>
                <span style={{ fontSize: 11, color: 'rgba(148,163,184,0.55)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {panel.type || 'Fire Detection Panel'}
                </span>
              </div>

              {/* Location & Zone */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(235,242,255,0.85)' }}>
                  {panel.location || 'Unknown Location'}
                </span>
                <span style={{ fontSize: 11, color: 'rgba(148,163,184,0.55)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {panel.zone || 'Zone Not Assigned'}
                </span>
              </div>

              {/* Install Date */}
              <div style={{ fontSize: 13, color: 'rgba(148,163,184,0.75)' }}>
                {formatDate(panel.installDate)}
              </div>

              {/* Sensitivity */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: panel.status === 'degraded' ? '#ff535f' : '#16c988', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {panel.sensitivity || 0}%
                  </span>
                </div>
                <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                  <div 
                    style={{ 
                      width: `${panel.sensitivity || 0}%`, 
                      height: '100%', 
                      background: panel.status === 'degraded' ? '#ff535f' : '#16c988', 
                      borderRadius: 3 
                    }} 
                  />
                </div>
                <span style={{ fontSize: 10, color: 'rgba(148,163,184,0.55)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                  {panel.status === 'degraded' ? 'DEGRADED' : 'NOMINAL'}
                </span>
              </div>

              {/* Action */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                {panel.status === 'degraded' ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/detection/panel-inspection?panelId=${panel.id}`)
                    }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      border: '1px solid rgba(255,83,95,0.4)',
                      background: 'rgba(255,83,95,0.12)',
                      color: '#ff535f',
                      cursor: 'pointer'
                    }}
                  >
                    Replace Now
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/detection/panel-inspection?id=${panel.id}`)
                    }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      border: '1px solid rgba(58,130,255,0.3)',
                      background: 'rgba(58,130,255,0.12)',
                      color: '#3a82ff',
                      cursor: 'pointer'
                    }}
                  >
                    Schedule New Inspect.
                  </button>
                )}
              </div>
            </div>
          ))
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            padding: '14px 20px', 
            background: 'rgba(255,255,255,0.03)',
            borderTop: '1px solid rgba(255,255,255,0.06)'
          }}>
            <span style={{ fontSize: 12, color: 'rgba(148,163,184,0.55)', fontWeight: 600 }}>
              Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredPanels.length)} of {filteredPanels.length} devices
            </span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.04)',
                  color: 'rgba(148,163,184,0.6)',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ‹
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 6,
                    border: currentPage === page ? '1px solid rgba(58,130,255,0.4)' : '1px solid rgba(255,255,255,0.1)',
                    background: currentPage === page ? 'rgba(58,130,255,0.2)' : 'rgba(255,255,255,0.04)',
                    color: currentPage === page ? '#3a82ff' : 'rgba(148,163,184,0.6)',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {page}
                </button>
              ))}
              {totalPages > 5 && (
                <>
                  <span style={{ color: 'rgba(148,163,184,0.55)' }}>...</span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(totalPages)}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 6,
                      border: '1px solid rgba(255,255,255,0.1)',
                      background: 'rgba(255,255,255,0.04)',
                      color: 'rgba(148,163,184,0.6)',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {totalPages}
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.04)',
                  color: 'rgba(148,163,184,0.6)',
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ›
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
