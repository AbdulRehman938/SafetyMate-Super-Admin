import { useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { collection, getDocs, limit, query, where } from 'firebase/firestore'
import { db } from '../../../config/firebase.js'
import { useAuth } from '../../../app/providers/authContext.js'
import { isWorkforceRole } from '../workforceRoles.js'

const GROUP_LABELS = {
  incidents: 'Incidents',
  hira_assessments: 'Risk Assessments',
  certificates: 'Certificates',
  appointment_letters: 'Appointment Letters',
  safety_inductions: 'Safety Inductions',
  ppe_assets: 'PPE Assets',
  user_profiles: 'Workforce',
}

function routeFor(item) {
  switch (item.source) {
    case 'incidents':
      return `/client/incidents?open=${encodeURIComponent(item.id)}`
    case 'hira_assessments':
      return `/client/risk-assessment?open=${encodeURIComponent(item.id)}`
    case 'certificates':
      return `/client/certificates?tab=certificates`
    case 'appointment_letters':
      return `/client/certificates?tab=appointments`
    case 'safety_inductions':
      return `/client/certificates?tab=inductions&open=${encodeURIComponent(item.id)}`
    case 'ppe_assets':
      return `/client/ppe?open=${encodeURIComponent(item.id)}`
    case 'user_profiles':
      return `/client/workforce`
    default:
      return '/client/dashboard'
  }
}

function normalizeRow(source, docSnap) {
  const data = docSnap.data() || {}
  const id = docSnap.id

  switch (source) {
    case 'incidents':
      return {
        source,
        id,
        title: data.title || data.incidentTitle || data.type || 'Incident',
        subtitle: String(data.description || data.summary || '—').slice(0, 160),
        searchable: [
          data.title,
          data.incidentTitle,
          data.type,
          data.category,
          data.description,
          data.summary,
          data.reportedByName,
          data.reportedBy,
          data.location,
          data.siteName,
          data.severity,
          data.status,
          id,
        ],
      }
    case 'hira_assessments':
      return {
        source,
        id,
        title: data.title || data.assessmentName || 'HIRA Assessment',
        subtitle:
          String(data.summary || data.description || '—').slice(0, 160) +
          (data.siteName ? ` • ${data.siteName}` : ''),
        searchable: [
          data.title,
          data.assessmentName,
          data.siteName,
          data.projectName,
          data.taskDescription,
          data.summary,
          data.description,
          data.status,
          data.riskLevel,
          id,
        ],
      }
    case 'certificates':
      return {
        source,
        id,
        title: data.certificateName || data.name || 'Certificate',
        subtitle: `${data.workerName || '—'}`,
        searchable: [data.certificateName, data.name, data.workerName, data.workerId, id],
      }
    case 'appointment_letters':
      return {
        source,
        id,
        title: data.role ? `${data.role}` : 'Appointment Letter',
        subtitle: `${data.appointeeName || '—'}${data.siteName ? ` • ${data.siteName}` : ''}`,
        searchable: [data.appointeeName, data.role, data.siteName, data.letterId, data.status, id],
      }
    case 'safety_inductions':
      return {
        source,
        id,
        title: data.fullName || 'Induction',
        subtitle: `${data.inductionType || '—'}${data.siteName ? ` • ${data.siteName}` : ''}`,
        searchable: [data.fullName, data.inductionType, data.siteName, data.company, data.idNumber, id],
      }
    case 'ppe_assets':
      return {
        source,
        id,
        title: data.category || 'PPE Asset',
        subtitle: `${data.assigneeName || data.recipientName || '—'} • ${data.size || '—'}`,
        searchable: [
          data.category,
          data.assigneeName,
          data.recipientName,
          data.size,
          data.status,
          data.assetId,
          id,
        ],
      }
    case 'user_profiles':
      if (!isWorkforceRole(data.role)) return null
      return {
        source,
        id,
        title: data.fullName || data.name || 'Worker',
        subtitle: `${data.role || 'Worker'}${data.phone ? ` • ${data.phone}` : ''}`,
        searchable: [data.fullName, data.name, data.role, data.phone, data.email, id],
      }
    default:
      return null
  }
}

async function fetchAllSources(orgId) {
  const sources = [
    'incidents',
    'hira_assessments',
    'certificates',
    'appointment_letters',
    'safety_inductions',
    'ppe_assets',
    'user_profiles',
  ]

  const results = await Promise.all(
    sources.map(async (source) => {
      try {
        const qy = query(collection(db, source), where('organizationId', '==', orgId), limit(200))
        const snap = await getDocs(qy)
        return snap.docs.map((d) => normalizeRow(source, d)).filter(Boolean)
      } catch (err) {
        console.warn(`[GlobalSearch] ${source} query failed`, err)
        return []
      }
    }),
  )

  return results.flat()
}

export function GlobalSearch() {
  const { profile, organizationId } = useAuth()
  const orgId = profile?.organizationId ?? organizationId
  const navigate = useNavigate()

  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [indexReady, setIndexReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState([])
  const containerRef = useRef(null)
  const inputRef = useRef(null)

  async function ensureIndex() {
    if (indexReady || loading || !orgId) return
    setLoading(true)
    try {
      const all = await fetchAllSources(orgId)
      setRows(all)
      setIndexReady(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    function onDocClick(e) {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target)) setOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
        ensureIndex()
      }
    }
    document.addEventListener('mousedown', onDocClick)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      window.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indexReady, loading, orgId])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return []
    const matches = []
    for (const row of rows) {
      const hay = row.searchable
        .filter((v) => v != null && v !== '')
        .map((v) => String(v).toLowerCase())
        .join(' | ')
      if (hay.includes(term)) matches.push(row)
      if (matches.length >= 40) break
    }
    const groups = new Map()
    for (const m of matches) {
      if (!groups.has(m.source)) groups.set(m.source, [])
      const arr = groups.get(m.source)
      if (arr.length < 5) arr.push(m)
    }
    return Array.from(groups.entries()).map(([source, items]) => ({ source, items }))
  }, [q, rows])

  function choose(item) {
    if (!item) return
    setOpen(false)
    setQ('')
    navigate(routeFor(item))
  }

  function onSubmit(e) {
    e.preventDefault()
    const first = filtered[0]?.items?.[0]
    if (first) choose(first)
  }

  return (
    <div className="client-topbar-search client-global-search" ref={containerRef}>
      <form className="search-box" onSubmit={onSubmit} role="search" aria-label="Global search">
        <span>
          <Search size={15} />
        </span>
        <input
          ref={inputRef}
          placeholder="Search incidents, certificates, workers, PPE…"
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            if (!open) setOpen(true)
            ensureIndex()
          }}
          onFocus={() => {
            setOpen(true)
            ensureIndex()
          }}
          aria-label="Search"
        />
        <span className="client-search-kbd" aria-hidden>
          ⌘K
        </span>
      </form>

      {open && q.trim() ? (
        <div className="client-search-dropdown" role="listbox">
          {loading && !indexReady ? (
            <div className="client-search-empty">Indexing your organization’s data…</div>
          ) : null}
          {indexReady && filtered.length === 0 ? (
            <div className="client-search-empty">No results for “{q.trim()}”.</div>
          ) : null}
          {filtered.map((group) => (
            <div key={group.source} className="client-search-group">
              <p className="client-search-group-label">{GROUP_LABELS[group.source] || group.source}</p>
              <ul className="client-search-items">
                {group.items.map((item) => (
                  <li key={`${item.source}:${item.id}`}>
                    <button
                      type="button"
                      className="client-search-item"
                      onClick={() => choose(item)}
                      role="option"
                    >
                      <span className="client-search-item-title">{item.title}</span>
                      <span className="client-search-item-sub">{item.subtitle}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
