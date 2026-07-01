import { Bell, ShieldCheck, UserCircle2 } from 'lucide-react'
import { useAuth } from '../../../app/providers/authContext.js'

export function ClientSettingsPage() {
  const { profile, organizationId } = useAuth()
  const displayName = profile?.fullName || profile?.name || profile?.email || 'Client user'
  const orgLabel = profile?.organizationName || profile?.organizationId || organizationId || 'Organization'

  return (
    <section className="client-page client-dashboard-page">
      <header className="client-dash-header">
        <h1>Settings</h1>
        <p className="client-dash-sub">Manage client account preferences and platform access from the integrated dashboard.</p>
      </header>

      <div className="client-dash-top3">
        <article className="client-card client-card--health">
          <h2 className="client-card-kicker">Profile</h2>
          <div className="client-health-inner">
            <UserCircle2 size={28} />
            <p className="client-health-caption">{displayName}</p>
          </div>
        </article>

        <article className="client-card client-card--risk client-card--risk-critical">
          <div className="client-risk-head">
            <h2>Organization</h2>
            <span className="client-badge client-badge--warn">Linked</span>
          </div>
          <p className="client-risk-number">01</p>
          <p className="client-risk-foot">{orgLabel}</p>
        </article>

        <article className="client-card client-card--risk client-card--risk-standard">
          <div className="client-risk-head">
            <h2>Access</h2>
            <span className="client-badge client-badge--danger">Secure</span>
          </div>
          <p className="client-risk-number">ON</p>
          <p className="client-risk-foot">{profile?.role || 'Client account'}</p>
        </article>
      </div>

      <div className="client-dash-main">
        <div className="client-dash-feed-col">
          <article className="client-card client-card--feed">
            <div className="client-feed-head">
              <h2>Account Controls</h2>
              <span className="client-feed-meta">Client preferences</span>
            </div>
            <div className="client-ppe-list" style={{ marginTop: 12 }}>
              <div className="client-ppe-item">
                <div className="client-ppe-item-main">
                  <span className="client-ppe-title">Notification preferences</span>
                  <span className="client-td-muted">Email and in-app alerts enabled</span>
                </div>
                <Bell size={16} />
              </div>
              <div className="client-ppe-item">
                <div className="client-ppe-item-main">
                  <span className="client-ppe-title">Security status</span>
                  <span className="client-td-muted">Session protected by SafetyMate authentication</span>
                </div>
                <ShieldCheck size={16} />
              </div>
            </div>
          </article>
        </div>

        <aside className="client-dash-aside">
          <article className="client-card client-card--status">
            <h2>Platform Mode</h2>
            <div className="client-status-row">
              <span className="client-status-pulse" aria-hidden />
              <div>
                <p className="client-status-title">Integrated client account</p>
                <p className="client-status-sub">Modules available from one login</p>
              </div>
            </div>
          </article>
        </aside>
      </div>
    </section>
  )
}
