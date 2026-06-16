import {
  Activity,
  Building2,
  ShieldAlert,
  UserPlus2,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  collection,
  getCountFromServer,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore'
import { db } from '../../../config/firebase.js'
import { useAuth } from '../../../app/providers/authContext.js'

function formatCount(n) {
  if (typeof n !== 'number') return '—'
  return new Intl.NumberFormat('en-US').format(n)
}

function formatMoney(n) {
  if (typeof n !== 'number') return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function toDate(value) {
  if (!value) return null
  if (typeof value?.toDate === 'function') return value.toDate()
  if (value instanceof Date) return value
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function formatAgo(value) {
  const d = toDate(value)
  if (!d) return '—'
  const diffMs = Date.now() - d.getTime()
  const diffMin = Math.max(1, Math.round(diffMs / 60000))
  if (diffMin < 60) return `${diffMin}m ago`
  const diffH = Math.round(diffMin / 60)
  if (diffH < 24) return `${diffH}h ago`
  return `${Math.round(diffH / 24)}d ago`
}

function monthKey(date) {
  return new Intl.DateTimeFormat('en-US', { month: 'short' }).format(date).toUpperCase()
}

function safePercent(part, total) {
  if (!total || typeof total !== 'number') return 0
  if (typeof part !== 'number') return 0
  return Math.round((part / total) * 100)
}

function normalizePlanName(raw) {
  const s = String(raw || '').trim().toLowerCase()
  if (!s) return null
  if (s.includes('pro')) return 'Professional'
  if (s.includes('ent')) return 'Enterprise'
  if (s.includes('start')) return 'Starter'
  return null
}

export function DashboardPage() {
  const { isSuperAdmin } = useAuth()
  const [revenue, setRevenue] = useState({ total: null })
  const [counts, setCounts] = useState({
    totalCompanies: null,
    trialCompanies: null,
    totalUsers: null,
    activeSosAlerts: null,
  })
  const [loadingCounts, setLoadingCounts] = useState(true)
  const [usage, setUsage] = useState({
    totalUsers: null,
    activeSites: null,
    safetyFiles: null,
    incidents: null,
  })
  const [planPerformance, setPlanPerformance] = useState({
    total: null,
    professional: 0,
    enterprise: 0,
    starter: 0,
    other: 0,
  })
  const [recentAlerts, setRecentAlerts] = useState([])
  const [mrrSeries, setMrrSeries] = useState([])
  const [trendSeries, setTrendSeries] = useState([])
  const [loadingExtras, setLoadingExtras] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function run() {
      setLoadingCounts(true)
      setLoadingExtras(true)
      try {
        // SUPER_ADMIN is global by design: no organization filters here.
        // For non-super-admin views (future), tenant filters would apply.
        if (!isSuperAdmin) return

        async function safeGetDocs(q) {
          try {
            const snap = await getDocs(q)
            return snap?.docs || []
          } catch {
            return []
          }
        }

        const orgsRef = collection(db, 'organizations')
        const usersRef = collection(db, 'user_profiles')
        const sosRef = collection(db, 'sos_alerts')
        const incidentsRef = collection(db, 'incidents')
        const hiraRef = collection(db, 'hira_assessments')
        const inspectionsRef = collection(db, 'inspections')

        const totalCompaniesPromise = getCountFromServer(orgsRef)
        const totalUsersPromise = getCountFromServer(usersRef)
        const activeSosPromise = getCountFromServer(
          query(sosRef, where('status', '==', 'ACTIVE')),
        )

        // If your schema doesn’t have organizations.status yet, we’ll keep it null.
        const trialCompaniesPromise = getCountFromServer(
          query(orgsRef, where('status', '==', 'TRIAL')),
        ).catch(() => null)

        // Platform Usage Statistics (requested):
        // - Total Users: user_profiles
        // - Active Projects: organizations where status == 'active'
        // - Safety Files: hira_assessments
        // - Incidents Reported: incidents (default 0 if missing)
        const activeCompaniesPromise = getCountFromServer(
          query(orgsRef, where('status', '==', 'active')),
        ).catch(() => null)
        const safetyFilesPromise = getCountFromServer(hiraRef).catch(() => null)
        const incidentsCountPromise = getCountFromServer(incidentsRef).catch(() => ({ data: () => ({ count: 0 }) }))

        // Plan Performance + MRR need org docs (one-time fetch, resilient)
        const orgDocsPromise = safeGetDocs(orgsRef)
        const activeOrgsForRevenuePromise = safeGetDocs(query(orgsRef, where('status', '==', 'active')))

        // Compliance trends: last 4 weeks (one-time fetch)
        const now = new Date()
        const start28 = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000)
        const hiraDocsPromise = safeGetDocs(query(hiraRef, where('createdAt', '>=', start28)))
        const inspectionsDocsPromise = safeGetDocs(query(inspectionsRef, where('createdAt', '>=', start28)))
        const incidentsTrendDocsPromise = safeGetDocs(query(incidentsRef, where('createdAt', '>=', start28)))

        const [
          totalCompaniesSnap,
          trialCompaniesSnap,
          totalUsersSnap,
          activeSosSnap,
          orgDocsSnap,
          incidentsSnap,
          activeOrgsSnap,
          activeCompaniesSnap,
          safetyFilesSnap,
          hiraDocs,
          inspectionsDocs,
          incidentsTrendDocs,
        ] = await Promise.all([
          totalCompaniesPromise,
          trialCompaniesPromise,
          totalUsersPromise,
          activeSosPromise,
          orgDocsPromise,
          incidentsCountPromise,
          activeOrgsForRevenuePromise,
          activeCompaniesPromise,
          safetyFilesPromise,
          hiraDocsPromise,
          inspectionsDocsPromise,
          incidentsTrendDocsPromise,
        ])

        if (cancelled) return

        const totalCompanies = totalCompaniesSnap.data().count
        const totalUsers = totalUsersSnap.data().count
        const activeSos = activeSosSnap.data().count

        setCounts({
          totalCompanies: totalCompaniesSnap.data().count,
          trialCompanies:
            trialCompaniesSnap && 'data' in trialCompaniesSnap
              ? trialCompaniesSnap.data().count
              : null,
          totalUsers,
          activeSosAlerts: activeSos,
        })

        const planCounts = { Professional: 0, Enterprise: 0, Starter: 0, Other: 0 }
        const orgDocs = Array.isArray(orgDocsSnap) ? orgDocsSnap : []
        for (const d of orgDocs) {
          const data = d.data?.() || {}
          const raw =
            data.plan ||
            data.planName ||
            data.subscriptionPlan ||
            data?.subscription?.plan ||
            data?.subscription?.name ||
            data?.billing?.plan ||
            null
          const normalized = normalizePlanName(raw)
          if (normalized && normalized in planCounts) planCounts[normalized] += 1
          else planCounts.Other += 1
        }

        setPlanPerformance({
          total: totalCompanies,
          professional: safePercent(planCounts.Professional, totalCompanies),
          enterprise: safePercent(planCounts.Enterprise, totalCompanies),
          starter: safePercent(planCounts.Starter, totalCompanies),
          other: safePercent(planCounts.Other, totalCompanies),
        })

        setUsage({
          totalUsers,
          activeSites:
            activeCompaniesSnap && 'data' in activeCompaniesSnap ? activeCompaniesSnap.data().count : null,
          safetyFiles:
            safetyFilesSnap && 'data' in safetyFilesSnap ? safetyFilesSnap.data().count : null,
          incidents: incidentsSnap && 'data' in incidentsSnap ? incidentsSnap.data().count : 0,
        })

        const activeOrgs = Array.isArray(activeOrgsSnap) ? activeOrgsSnap : []
        const totalMrr = activeOrgs.reduce((sum, d) => sum + Number(d.data()?.monthlyPrice ?? 0), 0)
        setRevenue({ total: totalMrr })

        // MRR chart series: last 6 months of *new MRR added* based on org createdAt.
        // This avoids fake data while still providing a time series signal.
        const months = []
        for (let i = 5; i >= 0; i -= 1) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
          months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, month: monthKey(d), value: 0 })
        }
        for (const docSnap of activeOrgs) {
          const data = docSnap.data?.() || {}
          const created = toDate(data.createdAt)
          if (!created) continue
          const idx = months.findIndex((m) => {
            const [y, mo] = m.key.split('-').map(Number)
            return created.getFullYear() === y && created.getMonth() === mo
          })
          if (idx >= 0) months[idx].value += Number(data.monthlyPrice ?? 0)
        }
        setMrrSeries(months.map(({ month, value }) => ({ month, value })))

        // Compliance trends: bucket last 4 weeks into WEEK 01..04 (oldest -> newest).
        const buckets = Array.from({ length: 4 }, (_, i) => ({
          week: `WEEK 0${i + 1}`,
          riskAssessments: 0,
          inspections: 0,
          incidents: 0,
        }))

        function bucketIndex(createdAt) {
          const d = toDate(createdAt)
          if (!d) return null
          const diffDays = Math.floor((d.getTime() - start28.getTime()) / (24 * 60 * 60 * 1000))
          if (diffDays < 0) return null
          const idx = Math.min(3, Math.max(0, Math.floor(diffDays / 7)))
          return idx
        }

        for (const d of hiraDocs) {
          const idx = bucketIndex(d.data?.()?.createdAt)
          if (idx != null) buckets[idx].riskAssessments += 1
        }
        for (const d of inspectionsDocs) {
          const idx = bucketIndex(d.data?.()?.createdAt)
          if (idx != null) buckets[idx].inspections += 1
        }
        for (const d of incidentsTrendDocs) {
          const idx = bucketIndex(d.data?.()?.createdAt)
          if (idx != null) buckets[idx].incidents += 1
        }
        setTrendSeries(buckets)
      } finally {
        if (!cancelled) {
          setLoadingCounts(false)
          setLoadingExtras(false)
        }
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [isSuperAdmin])

  useEffect(() => {
    if (!isSuperAdmin) return
    const sosRef = collection(db, 'sos_alerts')
    const qActive = query(sosRef, where('status', '==', 'ACTIVE'))
    const unsub = onSnapshot(
      qActive,
      (snap) => {
        setCounts((prev) => ({ ...prev, activeSosAlerts: snap.size }))
      },
      () => {},
    )
    return () => unsub()
  }, [isSuperAdmin])

  useEffect(() => {
    if (!isSuperAdmin) return
    const sosRef = collection(db, 'sos_alerts')
    const qRecentActive = query(sosRef, where('status', '==', 'ACTIVE'), orderBy('triggeredAt', 'desc'), limit(5))
    const unsub = onSnapshot(
      qRecentActive,
      (snap) => {
        const docs = snap.docs.map((d) => {
          const data = d.data() || {}
          const orgName = data.organizationName || data.companyName || data.orgName || 'Unknown'
          const msg = data.message || data.description || ''
          const when = data.triggeredAt || data.createdAt || null
          return {
            id: d.id,
            tone: 'danger',
            title: orgName,
            message: msg || 'SOS alert active',
            ago: when ? formatAgo(when) : '—',
          }
        })
        setRecentAlerts(docs)
      },
      () => setRecentAlerts([]),
    )
    return () => unsub()
  }, [isSuperAdmin])

  const kpis = useMemo(
    () => [
      {
        title: 'Total MRR',
        value: loadingCounts ? 'Loading…' : revenue.total == null ? '—' : formatMoney(revenue.total),
        delta: null,
        tone: 'up',
        icon: Building2,
      },
      {
        title: 'Trial Companies',
        value:
          loadingCounts
            ? 'Loading…'
            : counts.trialCompanies == null
              ? '—'
              : formatCount(counts.trialCompanies),
        delta: null,
        tone: 'up',
        icon: Activity,
      },
      {
        title: 'Total Users',
        value: loadingCounts ? 'Loading…' : formatCount(counts.totalUsers),
        delta: null,
        tone: 'down',
        icon: UserPlus2,
      },
      {
        title: 'Active SOS Alerts',
        value: loadingCounts ? 'Loading…' : formatCount(counts.activeSosAlerts),
        delta: null,
        tone: 'up',
        icon: ShieldAlert,
      },
    ],
    [counts, loadingCounts, revenue],
  )

  const planData = useMemo(() => {
    return [
      { name: 'Professional', value: planPerformance.professional, color: '#227BDF' },
      { name: 'Enterprise', value: planPerformance.enterprise, color: '#16C988' },
      { name: 'Starter', value: planPerformance.starter, color: '#FE8E2A' },
      { name: 'Other', value: planPerformance.other || 0, color: 'rgba(203, 214, 255, 0.34)' },
    ]
  }, [planPerformance])

  return (
    <section className="dashboard-page">
      <header className="dash-title-wrap">
        <h1>Super Admin Dashboard</h1>
        <p>System overview and business performance metrics.</p>
      </header>

      <section className="kpi-grid">
        {kpis.map((card) => {
          const Icon = card.icon
          return (
            <article className="dashboard-card kpi-card" key={card.title}>
              <div className="kpi-top">
                <span className="kpi-icon">
                  <Icon size={16} />
                </span>
                {card.delta ? (
                  <span className={`kpi-delta ${card.tone === 'down' ? 'kpi-down' : 'kpi-up'}`}>
                    {card.delta}
                  </span>
                ) : null}
              </div>
              <p className="kpi-label">{card.title}</p>
              <p className="kpi-value">{card.value}</p>
            </article>
          )
        })}
      </section>

      <section className="chart-row">
        <article className="dashboard-card mrr-card">
          <div className="card-head">
            <h2>Monthly Recurring Revenue (MRR)</h2>
            <p>6 Months &nbsp;&nbsp; 1 Year</p>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={250} debounce={100}>
              <BarChart data={mrrSeries}>
                <CartesianGrid vertical={false} stroke="#102f62" strokeDasharray="0" />
                <XAxis dataKey="month" tick={{ fill: '#6D84B8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  cursor={{ fill: 'rgba(35, 91, 180, 0.12)' }}
                  contentStyle={{ background: '#071538', border: '1px solid #173768' }}
                  labelStyle={{ color: '#9AB1DF' }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {mrrSeries.map((entry) => (
                    <Cell key={entry.month} fill="#1f68c7" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="dashboard-card donut-card">
          <h2>Plan Performance</h2>
          <div className="donut-wrap">
            <ResponsiveContainer width="100%" height={220} debounce={100}>
              <PieChart>
                <Pie
                  data={planData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={82}
                  stroke="none"
                >
                  {planData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-center">
              <span>{loadingExtras ? '…' : formatCount(planPerformance.total)}</span>
              <small>TOTAL</small>
            </div>
          </div>
          <ul className="donut-legend">
            {planData.map((plan) => (
              <li key={plan.name}>
                <span className="dot" style={{ background: plan.color }} />
                {plan.name}
                <b>{plan.value}%</b>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <article className="dashboard-card usage-card">
        <h2>Platform Usage Statistics</h2>
        <div className="usage-grid">
          <div>
            <p>TOTAL USERS</p>
            <b>{loadingExtras ? '…' : formatCount(usage.totalUsers)}</b>
            <span>{loadingExtras ? '—' : 'Live platform count'}</span>
          </div>
          <div>
            <p>ACTIVE PROJECTS</p>
            <b>{loadingExtras ? '…' : formatCount(usage.activeSites)}</b>
            <span>{loadingExtras ? '—' : 'Active organizations'}</span>
          </div>
          <div>
            <p>SAFETY FILES</p>
            <b>{loadingExtras ? '…' : formatCount(usage.safetyFiles)}</b>
            <span>{loadingExtras ? '—' : 'Total stored documents'}</span>
          </div>
          <div>
            <p>INCIDENTS REPORTED</p>
            <b className="danger">{loadingExtras ? '…' : formatCount(usage.incidents)}</b>
            <span>{loadingExtras ? '—' : 'Total incidents logged'}</span>
          </div>
        </div>
      </article>

      <section className="trend-alert-row">
        <article className="dashboard-card trend-card">
          <div className="card-head">
            <div>
              <h2>Compliance Activity Trends</h2>
              <p className="section-subtitle">
                Correlated risk assessments, inspections and reported incidents.
              </p>
            </div>
            <div className="trend-legend">
              <span>
                <i className="dot dot-blue" />
                Risk Assessments
              </span>
              <span>
                <i className="dot dot-green" />
                Inspections
              </span>
              <span>
                <i className="dot dot-red" />
                Incidents
              </span>
            </div>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={240} debounce={100}>
              <LineChart data={trendSeries}>
                <CartesianGrid vertical={false} stroke="#102f62" strokeDasharray="0" />
                <XAxis dataKey="week" tick={{ fill: '#6D84B8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: '#071538', border: '1px solid #173768' }}
                  labelStyle={{ color: '#9AB1DF' }}
                />
                <Line
                  type="monotone"
                  dataKey="riskAssessments"
                  stroke="#277CDF"
                  strokeWidth={3}
                  dot={false}
                  name="Risk Assessments"
                />
                <Line
                  type="monotone"
                  dataKey="inspections"
                  stroke="#17CB88"
                  strokeWidth={3}
                  dot={false}
                  name="Inspections"
                />
                <Line
                  type="monotone"
                  dataKey="incidents"
                  stroke="#FF535F"
                  strokeWidth={3}
                  dot={false}
                  name="Incidents"
                />
              </LineChart>
            </ResponsiveContainer>
      </div>
        </article>

        <article className="dashboard-card alerts-card">
          <h2>Critical Alerts</h2>
          <div className="alerts-list">
            {(loadingExtras ? [] : recentAlerts).map((alert) => (
              <article className={`alert-item tone-${alert.tone}`} key={alert.id}>
                <p>
                  <ShieldAlert size={14} />
                  {alert.title}
                </p>
                <span>
                  {alert.message} <b style={{ marginLeft: 6 }}>{alert.ago}</b>
                </span>
              </article>
            ))}
            {loadingExtras ? (
              <article className="alert-item tone-info" key="loading">
                <p>
                  <Activity size={14} />
                  Loading alerts…
                </p>
                <span>Fetching latest SOS activity.</span>
              </article>
            ) : null}
          </div>
          <button className="link-btn" type="button">
            View All Activity →
          </button>
        </article>
      </section>
    </section>
  )
}
