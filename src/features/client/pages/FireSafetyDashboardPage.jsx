import { Flame, ShieldAlert, BellRing } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export function FireSafetyDashboardPage() {
  const navigate = useNavigate()

  return (
    <section className="client-page client-dashboard-page">
      <header className="client-dash-header">
        <h1>Fire Safety System</h1>
        <p className="client-dash-sub">Fire extinguisher and fire detection services are combined here for client access.</p>
      </header>

      <div className="client-dash-top3">
        <article className="client-card client-card--risk client-card--risk-critical">
          <div className="client-risk-head">
            <h2>Fire Extinguishers</h2>
            <span className="client-badge client-badge--warn">Ready</span>
          </div>
          <p className="client-risk-number">112</p>
          <p className="client-risk-foot">Registered units and inspection readiness</p>
          <button type="button" className="client-btn client-btn--ghost" onClick={() => navigate('/client/fire-safety/extinguisher/dashboard')}>
            Open Extinguisher Module
          </button>
        </article>

        <article className="client-card client-card--risk client-card--risk-standard">
          <div className="client-risk-head">
            <h2>Detection & Alarms</h2>
            <span className="client-badge client-badge--danger">Monitored</span>
          </div>
          <p className="client-risk-number">340</p>
          <p className="client-risk-foot">Active sensors and system alerts</p>
          <button type="button" className="client-btn client-btn--ghost" onClick={() => navigate('/client/fire-safety/detection/dashboard')}>
            Open Detection Module
          </button>
        </article>

        <article className="client-card client-card--health">
          <h2 className="client-card-kicker">Module Status</h2>
          <div className="client-health-inner">
            <Flame size={28} />
            <p className="client-health-caption">Fire safety services are available within the client account.</p>
          </div>
        </article>
      </div>

      <div className="client-dash-main">
        <div className="client-dash-feed-col">
          <article className="client-card client-card--feed">
            <div className="client-feed-head">
              <h2>Fire Safety Access</h2>
              <span className="client-feed-meta">One account, multiple services</span>
            </div>
            <p className="client-dash-sub" style={{ marginBottom: 0 }}>
              Use this module to access extinguisher compliance and detector status without switching to another login.
            </p>
          </article>
        </div>

        <aside className="client-dash-aside">
          <article className="client-card client-card--status">
            <h2>Active Coverage</h2>
            <div className="client-status-row">
              <span className="client-status-pulse" aria-hidden />
              <div>
                <p className="client-status-title">All fire safety nodes visible</p>
                <p className="client-status-sub">Last sync: moments ago</p>
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
