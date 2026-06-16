import { useEffect, useMemo, useState } from 'react'
import { addDoc, collection, endAt, getCountFromServer, getDocs, limit, orderBy, query, serverTimestamp, startAt, where } from 'firebase/firestore'
import {
  AlertTriangle,
  BellRing,
  Building2,
  Check,
  Globe,
  Megaphone,
  MonitorSmartphone,
  Search,
  Send,
  Sparkles,
  Users,
} from 'lucide-react'
import { useToast } from '../../../shared/toast/toastContext.js'
import { useLocation, useNavigate } from 'react-router-dom'
import { db } from '../../../config/firebase.js'

const INDUSTRY_OPTIONS = ['Construction', 'Mining & Gas', 'Heavy Machinery']

const NOTIFICATION_TYPES = [
  { key: 'system_update', label: 'System Update', icon: BellRing },
  { key: 'feature_release', label: 'Feature Release', icon: Sparkles },
  { key: 'marketing', label: 'Marketing/Newsletter', icon: Megaphone },
]

const DELIVERY_CHANNELS = [
  { key: 'push', label: 'Push Notification', meta: 'Mobile and desktop device alerts', icon: BellRing },
]

export function AnnouncementComposerPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()

  const [targetMode, setTargetMode] = useState('platform')
  const [industries, setIndustries] = useState(INDUSTRY_OPTIONS)
  const [companies, setCompanies] = useState([])
  const [companySearch, setCompanySearch] = useState('')
  const [companyResults, setCompanyResults] = useState([])
  const [companyBusy, setCompanyBusy] = useState(false)
  const [type, setType] = useState('system_update')
  const [channels, setChannels] = useState({ push: true })
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [reachCount, setReachCount] = useState(null)
  const [reachLoading, setReachLoading] = useState(false)
  const [successView, setSuccessView] = useState(null)

  const activeChannels = useMemo(
    () => DELIVERY_CHANNELS.filter((c) => channels[c.key]).length,
    [channels],
  )

  const industriesSummary = useMemo(() => {
    if (targetMode === 'platform') return 'All'
    if (targetMode === 'industry') return `${industries.length} Selected`
    if (targetMode === 'company') return `${companies.length} Selected`
    return 'All'
  }, [companies.length, industries.length, targetMode])

  const companyIds = useMemo(() => companies.map((c) => c.id), [companies])

  useEffect(() => {
    const pre = location.state?.preselectCompany
    if (!pre?.id) return
    setTargetMode('company')
    setCompanies([{ id: pre.id, name: pre.name || pre.id }])
    // remove state so it doesn't keep reapplying on re-render
    // (react-router keeps state stable within a navigation)
  }, [location.state])

  useEffect(() => {
    let cancelled = false
    async function run() {
      setReachLoading(true)
      try {
        const profiles = collection(db, 'user_profiles')
        if (targetMode === 'platform') {
          const snap = await getCountFromServer(profiles).catch(() => null)
          if (!cancelled) setReachCount(snap?.data ? snap.data().count : 0)
          return
        }
        if (targetMode === 'company') {
          const orgId = companyIds[0]
          if (!orgId) {
            if (!cancelled) setReachCount(0)
            return
          }
          const snap = await getCountFromServer(query(profiles, where('organizationId', '==', orgId))).catch(() => null)
          if (!cancelled) setReachCount(snap?.data ? snap.data().count : 0)
          return
        }
        // industries: sum counts for selected industries
        if (targetMode === 'industry') {
          const chunks = []
          for (let i = 0; i < industries.length; i += 10) chunks.push(industries.slice(i, i + 10))
          if (chunks.length === 0) {
            if (!cancelled) setReachCount(0)
            return
          }
          const snaps = await Promise.all(
            chunks.map((vals) => getCountFromServer(query(profiles, where('industry', 'in', vals))).catch(() => null)),
          )
          const total = snaps.reduce((sum, s) => sum + (s?.data ? s.data().count : 0), 0)
          if (!cancelled) setReachCount(total)
        }
      } finally {
        if (!cancelled) setReachLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [companyIds, industries, targetMode])

  useEffect(() => {
    let cancelled = false
    if (targetMode !== 'company') return () => {}
    const term = companySearch.trim()
    if (!term) {
      setCompanyResults([])
      setCompanyBusy(false)
      return () => {}
    }
    setCompanyBusy(true)
    const t = window.setTimeout(async () => {
      try {
        const orgsRef = collection(db, 'organizations')
        const orgQuery = query(
          orgsRef,
          orderBy('name'),
          startAt(term),
          endAt(`${term}\uf8ff`),
          limit(8),
        )
        const snap = await getDocs(orgQuery).catch(() => null)
        if (cancelled) return
        setCompanyResults(
          (snap?.docs || []).map((d) => ({ id: d.id, name: d.data()?.name || d.data()?.companyName || d.id })),
        )
      } finally {
        if (!cancelled) setCompanyBusy(false)
      }
    }, 180)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [companySearch, targetMode])

  const estimatedReach = useMemo(() => {
    if (reachLoading) return '…'
    const n = Number(reachCount || 0)
    return `${new Intl.NumberFormat('en-US').format(n)} Users`
  }, [reachCount, reachLoading])

  const estimatedDeliveryMinutes = useMemo(() => {
    const n = Number(reachCount || 0)
    return Math.max(1, Math.floor(n / 100) + 1)
  }, [reachCount])

  const canBroadcast = useMemo(() => {
    return (
      !submitting &&
      subject.trim().length > 0 &&
      body.trim().length >= 10 &&
      activeChannels > 0
    )
  }, [activeChannels, body, subject, submitting])

  async function onBroadcast() {
    if (!subject.trim() || !body.trim()) {
      toast.push({ type: 'error', title: 'Missing content', message: 'Please add subject and announcement body.' })
      return
    }
    if (activeChannels === 0) {
      toast.push({ type: 'error', title: 'No channels selected', message: 'Please enable at least one delivery channel.' })
      return
    }

    setSubmitting(true)
    try {
      const announcementData = {
        status: 'immediate',
        createdAt: serverTimestamp(),
        scheduledAt: null,
        target: {
          type: targetMode === 'industry' ? 'industries' : targetMode === 'company' ? 'companies' : 'platform',
          values: targetMode === 'industry' ? industries : targetMode === 'company' ? companyIds : [],
        },
        notificationType: type,
        deliveryChannels: {
          in_app: Boolean(channels.in_app),
          email: Boolean(channels.email),
          push: Boolean(channels.push),
        },
        content: {
          subject: subject.trim(),
          body: body.trim(),
        },
        stats: { totalReach: 0 },
      }

      await addDoc(collection(db, 'announcements'), announcementData)
      toast.push({ type: 'success', title: 'Broadcast queued', message: 'Announcement has been queued for delivery.' })
      setSuccessView({
        subject: announcementData.content.subject,
        totalReach: reachCount ?? 0,
      })
    } catch (e) {
      toast.push({ type: 'error', title: 'Failed', message: e?.message || 'Could not broadcast announcement.' })
    } finally {
      setSubmitting(false)
    }
  }

  if (successView) {
    return (
      <section className="stack-gap announcement-page">
        <article className="dashboard-card notify-success-card">
          <span className="notify-success-icon">
            <Check size={22} />
          </span>
          <h2>Announcement Queued</h2>
          <p>
            Your announcement <b>{successView.subject}</b> has been queued for delivery.
          </p>
          <div className="notify-success-meta">
            <span>Estimated reach: {new Intl.NumberFormat('en-US').format(successView.totalReach)} users</span>
          </div>
          <div className="notify-success-actions">
            <button
              type="button"
              className="secondary-btn"
              onClick={() => {
                setSuccessView(null)
                setSubject('')
                setBody('')
              }}
            >
              Create Another
            </button>
            <button type="button" className="primary-btn" onClick={() => navigate('/company')}>
              Return to Subscriber Management
            </button>
          </div>
        </article>
      </section>
    )
  }

  return (
    <section className="stack-gap announcement-page">
      <header className="announcement-head">
        <div>
          <p>Admin &gt; Create Announcement</p>
          <h2>Compose &amp; Broadcast</h2>
        </div>
      </header>

      <article className="dashboard-card announcement-card">
        <h3 className="announcement-title">
          <span className="notify-section-ic"><Users size={14} /></span>
          1. Target Audience
        </h3>
        <div className="announcement-target-grid">
          <button
            type="button"
            className={`announcement-target ${targetMode === 'platform' ? 'is-active' : ''}`}
            onClick={() => setTargetMode('platform')}
          >
            <div>
              <b>Platform-wide</b>
              <span>Reach every registered user on SafetyMate.</span>
            </div>
            <span className="announcement-dot">{targetMode === 'platform' ? <Check size={12} /> : null}</span>
          </button>
        
          <button
            type="button"
            className={`announcement-target ${targetMode === 'company' ? 'is-active' : ''}`}
            onClick={() => setTargetMode('company')}
          >
            <div>
              <b>Specific Companies</b>
              <span>Manually select individual organizations.</span>
            </div>
            <span className="announcement-dot">{targetMode === 'company' ? <Check size={12} /> : null}</span>
          </button>
        </div>
        {targetMode === 'industry' ? (
          <>
            <label className="billing-search announcement-search">
              <Search size={14} />
              <input placeholder="Search for industries..." />
            </label>
            <div className="announcement-tags">
              {industries.map((tag) => (
                <button
                  type="button"
                  key={tag}
                  onClick={() => {
                    setIndustries((prev) => prev.filter((p) => p !== tag))
                  }}
                >
                  {tag} ×
                </button>
              ))}
            </div>
          </>
        ) : null}

        {targetMode === 'company' ? (
          <>
            <label className="billing-search announcement-search">
              <Search size={14} />
              <input
                value={companySearch}
                onChange={(e) => setCompanySearch(e.target.value)}
                placeholder="Search companies..."
              />
            </label>
            {companySearch.trim() ? (
              <div className="announcement-search-results">
                {companyBusy ? (
                  <div className="announcement-search-empty">Searching…</div>
                ) : companyResults.length ? (
                  companyResults.map((r) => (
                    <button
                      type="button"
                      key={r.id}
                      className="announcement-search-item"
                      onClick={() => {
                        setCompanies((prev) => (prev.some((p) => p.id === r.id) ? prev : [...prev, r]))
                        setCompanySearch('')
                        setCompanyResults([])
                      }}
                    >
                      <b>{r.name}</b>
                      <span>{r.id}</span>
                    </button>
                  ))
                ) : (
                  <div className="announcement-search-empty">No matching companies.</div>
                )}
              </div>
            ) : null}

            <div className="announcement-tags">
              {companies.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => setCompanies((prev) => prev.filter((p) => p.id !== c.id))}
                >
                  {c.name} ×
                </button>
              ))}
            </div>
          </>
        ) : null}
      </article>

      <section className="announcement-row">
        <article className="dashboard-card announcement-card">
          <h3 className="announcement-title">
            <span className="notify-section-ic"><Globe size={14} /></span>
            2. Notification Type
          </h3>
          <div className="announcement-list">
            {NOTIFICATION_TYPES.map((opt) => (
              <button
                key={opt.key}
                type="button"
                className={`announcement-list-item ${type === opt.key ? 'is-active' : ''}`}
                onClick={() => setType(opt.key)}
              >
                <span className="announcement-ic"><opt.icon size={14} /></span>
                <div>
                  <b>{opt.label}</b>
                </div>
                <span className="announcement-dot">{type === opt.key ? <Check size={12} /> : null}</span>
              </button>
            ))}
          </div>
        </article>

        <article className="dashboard-card announcement-card">
          <h3 className="announcement-title">
            <span className="notify-section-ic"><Building2 size={14} /></span>
            3. Delivery Channels
          </h3>
          <div className="announcement-list">
            {DELIVERY_CHANNELS.map((ch) => (
              <label key={ch.key} className="announcement-list-item checkbox">
                <span className="announcement-ic"><ch.icon size={14} /></span>
                <div className="announcement-channel-copy">
                  <b>{ch.label}</b>
                  <span>{ch.meta}</span>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(channels[ch.key])}
                  onChange={(e) => setChannels((prev) => ({ ...prev, [ch.key]: e.target.checked }))}
                />
              </label>
            ))}
          </div>
        </article>
      </section>

      <article className="dashboard-card announcement-card">
        <h3 className="announcement-title">
          <span className="notify-section-ic"><Megaphone size={14} /></span>
          4. Message Composer
        </h3>
        <label className="notify-field">
          <span>SUBJECT LINE</span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Critical Safety Protocol Update - Q4 2023"
          />
        </label>
        <label className="notify-field">
          <span>ANNOUNCEMENT BODY</span>
          <div className="notify-editor">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message content here..."
            />
          </div>
        </label>
      </article>

      <section className="announcement-row schedule">
        <article className="dashboard-card announcement-card">
          <h3 className="announcement-title">
            <span className="notify-section-ic"><BellRing size={14} /></span>
            5. Scheduling
          </h3>
          <div className="notify-schedule-grid">
            <div className="notify-option-list">
              <div className="notify-option notify-schedule-option-active">
                <span className="announcement-dot"><Check size={12} /></span>
                <div className="notify-schedule-copy">
                  <b>Send Now</b>
                  <span>Immediate broadcast across selected channels.</span>
                </div>
              </div>
            </div>
          </div>
        </article>

        <article className="dashboard-card announcement-summary">
          <h4>SUMMARY</h4>
          <p><span>Total Reach:</span><b>{estimatedReach}</b></p>
          <p><span>Industries:</span><b>{industriesSummary}</b></p>
          <p><span>Channels:</span><b>{activeChannels} Active</b></p>
          <p><span>Est. Delivery Time:</span><b>~{estimatedDeliveryMinutes} Minutes</b></p>
        </article>
      </section>

      <div className="announcement-warning">
        <AlertTriangle size={14} />
        Broadcasting cannot be undone once sent.
      </div>
      <button
        type="button"
        className={`primary-btn announcement-cta ${!canBroadcast ? 'is-disabled' : ''}`}
        onClick={onBroadcast}
        disabled={!canBroadcast}
      >
        <Send size={14} /> {submitting ? 'Broadcasting…' : 'Broadcast Announcement'}
      </button>
    </section>
  )
}
