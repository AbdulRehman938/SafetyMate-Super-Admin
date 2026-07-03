import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Search, ClipboardList, CheckCircle, AlertTriangle,
  ChevronLeft, ChevronRight, Download, PenLine,
} from 'lucide-react'
import { useFireExtData } from '../hooks/useFireExtData.js'
import { formatDate, exportToCSV } from '../utils/feHelpers.js'
import '../fe.css'

const PAGE_SIZE = 10

export function FEAssetRegistryPage() {
  const navigate = useNavigate()
  const { assets, loading } = useFireExtData()

  const [search,    setSearch]    = useState('')
  const [statusF,   setStatusF]   = useState('all')
  const [page,      setPage]      = useState(1)

  const filtered = useMemo(() => {
    let list = [...assets]
    if (statusF !== 'all') list = list.filter((a) => a.status === statusF)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((a) =>
        (a.assetId          || '').toLowerCase().includes(q) ||
        (a.serialNumber     || '').toLowerCase().includes(q) ||
        (a.extinguisherType || '').toLowerCase().includes(q) ||
        (a.facilitySite     || '').toLowerCase().includes(q)
      )
    }
    return list
  }, [assets, search, statusF])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage   = Math.min(page, totalPages)
  const paginated  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  function statusTag(status) {
    if (status === 'compliant')     return 'fe-status-tag--passed'
    if (status === 'non_compliant') return 'fe-status-tag--failed'
    if (status === 'draft')         return 'fe-status-tag--pending'
    return 'fe-status-tag--pending'
  }
  function statusLabel(status) {
    if (status === 'compliant')     return 'COMPLIANT'
    if (status === 'non_compliant') return 'NON-COMPLIANT'
    if (status === 'draft')         return 'DRAFT'
    return 'PENDING'
  }

  function handleExport() {
    exportToCSV(assets.map((a) => ({
      'Asset ID':   a.assetId || a.id,
      'Type':       a.extinguisherType || '—',
      'Serial No':  a.serialNumber || '—',
      'Site':       a.facilitySite || '—',
      'Zone':       a.floorZone || '—',
      'Status':     a.status || '—',
      'Installed':  formatDate(a.installationDate),
      'Next Due':   formatDate(a.nextInspectionDate),
      'Expiry':     formatDate(a.certExpiry),
    })), 'fe-assets.csv')
  }

  if (loading) return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'55vh', gap:12, color:'rgba(148,163,184,0.8)' }}>
      <span className="fe-spinner fe-spinner--lg"/>
      <span style={{ fontSize:14, fontWeight:600 }}>Loading assets…</span>
    </div>
  )

  return (
    <div className="fe-subpage">

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16, marginBottom:22, flexWrap:'wrap' }}>
        <div>
          <h1 style={{ margin:'0 0 5px', fontSize:'clamp(1.2rem,2.5vw,1.6rem)', fontWeight:900, color:'rgba(235,242,255,0.97)', letterSpacing:'-0.025em' }}>
            Asset Registry
          </h1>
          <p style={{ margin:0, fontSize:13, color:'rgba(148,163,184,0.7)', fontWeight:500 }}>
            {assets.length > 0
              ? `${assets.length} asset${assets.length !== 1 ? 's' : ''} registered across all sites.`
              : 'No assets registered yet.'}
          </p>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button type="button" className="fe-btn fe-btn--ghost" onClick={handleExport}>
            <Download size={13}/> Export CSV
          </button>
          <button type="button" className="fe-btn fe-btn--primary"
            onClick={() => navigate('new')}>
            <Plus size={15}/> Register New Asset
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:10, marginBottom:18, flexWrap:'wrap', alignItems:'center' }}>
        {/* Status pills */}
        {['all','compliant','non_compliant','draft'].map((s) => (
          <button key={s} type="button"
            style={{ padding:'6px 14px', borderRadius:8, fontSize:11.5, fontWeight:700, cursor:'pointer',
              border: statusF === s ? '1px solid rgba(58,130,255,0.4)' : '1px solid rgba(255,255,255,0.08)',
              background: statusF === s ? 'rgba(58,130,255,0.15)' : 'rgba(255,255,255,0.03)',
              color: statusF === s ? '#8ab8ff' : 'rgba(148,163,184,0.75)' }}
            onClick={() => { setStatusF(s); setPage(1) }}>
            {s === 'all' ? 'All Assets' : s === 'non_compliant' ? 'Non-Compliant' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
        <div className="fe-search-wrap" style={{ marginLeft:'auto' }}>
          <Search size={13} className="fe-search-icon"/>
          <input type="text" className="fe-search-input" placeholder="Search assets…"
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }}/>
        </div>
      </div>

      {/* Table */}
      <div className="fe-card">
        {paginated.length === 0 ? (
          <div className="fe-empty" style={{ padding:'60px 20px' }}>
            <ClipboardList size={38} style={{ color:'rgba(148,163,184,0.18)', margin:'0 auto 14px', display:'block' }}/>
            <p className="fe-empty-title">{search || statusF !== 'all' ? 'No assets match filters' : 'No assets registered yet'}</p>
            <p className="fe-empty-sub">
              {search || statusF !== 'all'
                ? 'Try clearing your search or filters.'
                : 'Register your first asset to begin tracking compliance.'}
            </p>
            {!search && statusF === 'all' && (
              <button type="button" className="fe-btn fe-btn--primary" style={{ marginTop:16 }}
                onClick={() => navigate('new')}>
                <Plus size={14}/> Register First Asset
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="fe-table-wrap">
              <table className="fe-table">
                <thead>
                  <tr>
                    <th>ASSET ID</th>
                    <th>TYPE</th>
                    <th>SERIAL NO.</th>
                    <th>FACILITY SITE</th>
                    <th>ZONE</th>
                    <th>NEXT INSPECTION</th>
                    <th>STATUS</th>
                    <th style={{ textAlign:'right' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((a) => (
                    <tr key={a.id}
                      onClick={() => navigate(a.id)}
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(58,130,255,0.08)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                      <td>
                        <span style={{ fontFamily:'monospace', fontSize:12.5, fontWeight:700, color:'#5ba8ff' }}>
                          {a.assetId || a.id}
                        </span>
                      </td>
                      <td style={{ color:'rgba(203,214,255,0.85)', fontWeight:500 }}>{a.extinguisherType || '—'}</td>
                      <td style={{ fontFamily:'monospace', fontSize:12 }}>{a.serialNumber || '—'}</td>
                      <td style={{ color:'rgba(148,163,184,0.75)', fontSize:12 }}>{a.facilitySite || '—'}</td>
                      <td style={{ color:'rgba(148,163,184,0.6)', fontSize:12 }}>{a.floorZone || '—'}</td>
                      <td style={{ fontSize:12, color: (() => {
                        if (!a.nextInspectionDate) return 'rgba(148,163,184,0.5)'
                        const ts = a.nextInspectionDate?.toMillis ? a.nextInspectionDate.toMillis() : new Date(a.nextInspectionDate).getTime()
                        return ts < Date.now() ? '#ff8080' : ts < Date.now() + 14*86400000 ? '#ffb56e' : 'rgba(148,163,184,0.7)'
                      })() }}>
                        {formatDate(a.nextInspectionDate)}
                      </td>
                      <td>
                        <span className={`fe-status-tag ${statusTag(a.status)}`}>
                          {a.status === 'compliant' ? <><CheckCircle size={9}/> </> : a.status === 'non_compliant' ? <><AlertTriangle size={9}/> </> : null}
                          {statusLabel(a.status)}
                        </span>
                      </td>
                      <td style={{ textAlign:'right' }}>
                        {a.status === 'draft' ? (
                          <button type="button"
                            style={{
                              padding: '5px 12px', fontSize: 11.5,
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                              background: 'rgba(254,142,42,0.1)',
                              border: '1px solid rgba(254,142,42,0.3)',
                              borderRadius: 7,
                              color: '#fe8e2a',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                            onClick={(e) => { e.stopPropagation(); navigate(`new?draft=${a.id}`) }}>
                            <PenLine size={12}/> Continue
                          </button>
                        ) : (
                          <button type="button" className="fe-btn fe-btn--ghost"
                            style={{ padding:'5px 12px', fontSize:11.5 }}
                            onClick={(e) => { e.stopPropagation(); navigate(`${a.id}/inspect?new=1`) }}>
                            <ClipboardList size={12}/> Inspect
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="fe-pagination">
              <span className="fe-pagination-info">
                Showing {paginated.length} of {filtered.length} asset{filtered.length !== 1 ? 's' : ''}
              </span>
              <div className="fe-pagination-controls">
                <button type="button" className="fe-page-btn" disabled={safePage <= 1}
                  onClick={() => setPage((p) => p - 1)}><ChevronLeft size={13}/></button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                  <button key={n} type="button"
                    className={`fe-page-btn${safePage === n ? ' fe-page-btn--active' : ''}`}
                    onClick={() => setPage(n)}>{n}</button>
                ))}
                <button type="button" className="fe-page-btn" disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => p + 1)}><ChevronRight size={13}/></button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
