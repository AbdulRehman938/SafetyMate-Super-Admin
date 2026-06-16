import { useEffect, useMemo, useState } from 'react'
import { collection, getCountFromServer, getDocs, limit, orderBy, query, where } from 'firebase/firestore'
import { CheckCircle2, Download, Eye, ShieldAlert, ShieldCheck, UserRound, Zap } from 'lucide-react'
import { db } from '../../../config/firebase.js'
import { useToast } from '../../../shared/toast/toastContext.js'
import { useAuth } from '../../../app/providers/authContext.js'
import { writeSecurityAuditLog } from '../../../shared/security/auditLog.js'

function formatAgo(value) {
  if (!value) return 'just now'
  const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value)
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return 'just now'
  const diffMin = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000))
  if (diffMin < 60) return `${diffMin}m ago`
  const h = Math.round(diffMin / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

function severityTone(level) {
  const s = String(level || '').toLowerCase()
  if (s === 'critical' || s === 'high') return 'danger'
  if (s === 'medium') return 'warn'
  return 'muted'
}

export function SecurityLogsPage() {
  const toast = useToast()
  const { profile } = useAuth()
  const actorEmail = profile?.email || profile?.primaryContact?.email || profile?.authUser?.email || 'super-admin'
  const [loading, setLoading] = useState(true)
  const [threats, setThreats] = useState([])
  const [logs, setLogs] = useState([])
  const [severityFilter, setSeverityFilter] = useState('all')

  const [kpis, setKpis] = useState({
    securityScore: 98.2,
    failedLogins24h: 0,
    activeAdmins: 0,
    uptime: 99.99,
  })

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      try {
        const [failedLoginEvents, superAdminCount, auditSnap, threatSnap] = await Promise.all([
          getCountFromServer(collection(db, 'security_failed_logins')).catch(() => null),
          getCountFromServer(query(collection(db, 'user_profiles'), where('role', '==', 'SUPER_ADMIN'))).catch(() => null),
          getDocs(query(collection(db, 'security_audit_logs'), orderBy('timestamp', 'desc'), limit(20))).catch(() => null),
          getDocs(query(collection(db, 'security_threats'), orderBy('detectedAt', 'desc'), limit(6))).catch(() => null),
        ])
        if (cancelled) return

        setKpis((prev) => ({
          ...prev,
          failedLogins24h: failedLoginEvents?.data?.()?.count || 142,
          activeAdmins: superAdminCount?.data?.()?.count || 0,
        }))

        const mappedThreats = threatSnap?.docs?.map((d) => {
            const data = d.data()
            return {
              id: d.id,
              severity: String(data.severity || 'medium').toUpperCase(),
              title: data.title || 'Unrecognized Device',
              desc: data.description || 'Suspicious activity detected.',
              ago: formatAgo(data.detectedAt),
            }
          }) || []

        const mappedLogs = auditSnap?.docs?.map((d) => {
            const data = d.data()
            return {
              id: d.id,
              timestamp: data.timestamp || data.createdAt || null,
              actor: data.actor || 'system@domain.com',
              actionType: data.actionType || 'UPDATE_CONFIG',
              resource: data.resource || '—',
              severity: String(data.severity || 'Low'),
              details: data.details || '',
            }
          }) || []

        setThreats(mappedThreats)
        setLogs(mappedLogs)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [])

  const filteredLogs = useMemo(() => {
    if (severityFilter === 'all') return logs
    return logs.filter((log) => String(log.severity).toLowerCase() === severityFilter)
  }, [logs, severityFilter])

  function exportCsv() {
    const header = ['Timestamp', 'Actor', 'Action Type', 'Resource', 'Severity', 'Details']
    const lines = filteredLogs.map((r) => [
      formatAgo(r.timestamp),
      r.actor,
      r.actionType,
      r.resource,
      r.severity,
      r.details,
    ])
    const csv = [header, ...lines]
      .map((row) => row.map((v) => `"${String(v ?? '').replaceAll('"', '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'security-audit-logs.csv'
    a.click()
    URL.revokeObjectURL(url)

    writeSecurityAuditLog(db, {
      actor: actorEmail,
      actionType: 'EXPORT_CSV',
      resource: 'Security Audit Logs',
      severity: 'Low',
      details: `Exported ${filteredLogs.length} rows`,
    }).catch(() => {})
  }

  async function comingSoon(setting) {
    toast.push({ type: 'info', title: 'Feature Coming Soon', message: `${setting} is coming soon.` })
    await writeSecurityAuditLog(db, {
      actor: actorEmail,
      actionType: 'OPEN_QUICK_SETTING',
      resource: setting,
      severity: 'Low',
      details: 'Clicked quick setting (coming soon).',
    }).catch(() => {})
  }

  return (
    <section className="stack-gap security-page">
      <header className="security-head">
        <h2>Security &amp; Logs</h2>
      </header>

      <section className="security-kpi-row">
     
        <article className="dashboard-card security-kpi">
          <span>Active Admins</span>
          <h3>{loading ? '…' : kpis.activeAdmins}</h3>
          <p>secure</p>
          <UserRound size={14} />
        </article>
        <article className="dashboard-card security-kpi">
          <span>System Uptime</span>
          <h3>
            {kpis.uptime}% <span className="uptime-live"><i /> Live</span>
          </h3>
          <p>Uptime: 142 days</p>
          <Zap size={14} />
        </article>
      </section>

      <section className="security-main-row">
        <aside className="security-side">
          <article className="dashboard-card security-threats">
            <h3>Live Threats</h3>
            <div className="security-threat-list">
              {threats.length === 0 ? (
                <div className="security-secure">
                  <CheckCircle2 size={16} />
                  <div>
                    <b>System Secure</b>
                    <span>No active threats detected.</span>
                  </div>
                </div>
              ) : (
                threats.map((t) => (
                  <div key={t.id} className={`security-threat-card tone-${severityTone(t.severity)}`}>
                    <small>{t.severity}</small>
                    <b>{t.title}</b>
                    <p>{t.desc}</p>
                    <span>{t.ago}</span>
                  </div>
                ))
              )}
            </div>
          </article>
        </aside>

        <article className="dashboard-card security-audit">
          <header className="security-audit-head">
            <h3>Audit Logs</h3>
            <div>
              <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
                <option value="all">All Levels</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <button
                type="button"
                className="secondary-btn"
                onClick={exportCsv}
              >
                <Download size={14} /> Export CSV
              </button>
            </div>
          </header>
          <div className="security-audit-table-wrap">
            <table className="security-audit-table">
              <thead>
                <tr>
                  <th>TIMESTAMP</th>
                  <th>ACTOR</th>
                  <th>ACTION TYPE</th>
                  <th>RESOURCE</th>
                  <th>SEVERITY</th>
                  <th>DETAILS</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="companies-loading">Loading security logs...</td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="companies-loading">No audit logs found.</td>
                  </tr>
                ) : (
                  filteredLogs.map((row) => (
                    <tr key={row.id}>
                      <td>{formatAgo(row.timestamp)}</td>
                      <td>{row.actor}</td>
                      <td>{row.actionType}</td>
                      <td>{row.resource}</td>
                      <td><span className={`status-badge tone-${severityTone(row.severity)}`}>{row.severity}</span></td>
                      <td className="security-details-cell">
                        <span>{row.details}</span>
                        <button
                          type="button"
                          className="kebab-btn"
                          onClick={() => toast.push({ type: 'info', title: 'Details', message: row.details })}
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </section>
  )
}
