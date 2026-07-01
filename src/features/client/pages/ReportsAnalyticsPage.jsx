import { BarChart3, FileText, PieChart } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export function ReportsAnalyticsPage() {
  const navigate = useNavigate()

  return (
    <section className="client-page client-dashboard-page">
      <header className="client-dash-header">
        <h1>Reports & Analytics</h1>
        <p className="client-dash-sub">Performance summaries and compliance reporting for the client account.</p>
      </header>

      <div className="client-dash-top3">
        <article className="client-card client-card--health">
          <h2 className="client-card-kicker">Executive Reports</h2>
          <div className="client-health-inner">
            <BarChart3 size={28} />
            <p className="client-health-caption">High-level operational reporting in one place.</p>
          </div>
        </article>

        <article className="client-card client-card--risk client-card--risk-critical">
          <div className="client-risk-head">
            <h2>Trend Analysis</h2>
            <span className="client-badge client-badge--warn">Monthly</span>
          </div>
          <p className="client-risk-number">4</p>
          <p className="client-risk-foot">Tracked compliance and safety trends</p>
        </article>

        <article className="client-card client-card--risk client-card--risk-standard">
          <div className="client-risk-head">
            <h2>Exports</h2>
            <span className="client-badge client-badge--danger">Ready</span>
          </div>
          <p className="client-risk-number">18</p>
          <p className="client-risk-foot">Available downloadable reports</p>
        </article>
      </div>

      <div className="client-dash-main">
        <div className="client-dash-feed-col">
          <article className="client-card client-card--feed">
            <div className="client-feed-head">
              <h2>Reporting Hub</h2>
              <span className="client-feed-meta">Analytics overview</span>
            </div>
            <p className="client-dash-sub" style={{ marginBottom: 0 }}>
              Use the reporting hub to review summaries, identify trends, and export client-facing analytics.
            </p>
          </article>
        </div>

        <aside className="client-dash-aside">
          <article className="client-card client-card--status">
            <h2>Insights</h2>
            <div className="client-status-row">
              <span className="client-status-pulse" aria-hidden />
              <div>
                <p className="client-status-title">Report snapshots refreshed</p>
                <p className="client-status-sub">Last sync: live</p>
              </div>
            </div>
          </article>

          <article className="client-card client-card--status">
            <h2>Quick Actions</h2>
            <button type="button" className="client-btn client-btn--ghost" onClick={() => navigate('/client/dashboard')}>
              Back to Client Dashboard
            </button>
          </article>
        </aside>
      </div>
    </section>
  )
}
