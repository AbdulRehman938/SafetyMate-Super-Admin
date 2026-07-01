import { Users2, BadgeCheck, ClipboardList } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export function ContractorManagementPage() {
  const navigate = useNavigate()

  return (
    <section className="client-page client-dashboard-page">
      <header className="client-dash-header">
        <h1>Contractor Management</h1>
        <p className="client-dash-sub">Track contractor access, approvals, and readiness in one client module.</p>
      </header>

      <div className="client-dash-top3">
        <article className="client-card client-card--health">
          <h2 className="client-card-kicker">Contractors</h2>
          <div className="client-health-inner">
            <Users2 size={28} />
            <p className="client-health-caption">View contractor records and status.</p>
          </div>
        </article>

        <article className="client-card client-card--risk client-card--risk-critical">
          <div className="client-risk-head">
            <h2>Pending Checks</h2>
            <span className="client-badge client-badge--warn">Review</span>
          </div>
          <p className="client-risk-number">6</p>
          <p className="client-risk-foot">Contractor items awaiting verification</p>
        </article>

        <article className="client-card client-card--risk client-card--risk-standard">
          <div className="client-risk-head">
            <h2>Approved</h2>
            <span className="client-badge client-badge--danger">Ready</span>
          </div>
          <p className="client-risk-number">29</p>
          <p className="client-risk-foot">Approved contractors and active access</p>
        </article>
      </div>

      <div className="client-dash-main">
        <div className="client-dash-feed-col">
          <article className="client-card client-card--feed">
            <div className="client-feed-head">
              <h2>Contractor Oversight</h2>
              <span className="client-feed-meta">Client operations</span>
            </div>
            <p className="client-dash-sub" style={{ marginBottom: 0 }}>
              Manage contractor onboarding, access approval, and compliance checks from the client account.
            </p>
          </article>
        </div>

        <aside className="client-dash-aside">
          <article className="client-card client-card--status">
            <h2>Approval Status</h2>
            <div className="client-status-row">
              <span className="client-status-pulse" aria-hidden />
              <div>
                <p className="client-status-title">Contractor status visible</p>
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
