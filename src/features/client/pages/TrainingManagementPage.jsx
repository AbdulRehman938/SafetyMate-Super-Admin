import { CalendarDays, GraduationCap, ClipboardList } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export function TrainingManagementPage() {
  const navigate = useNavigate()

  return (
    <section className="client-page client-dashboard-page">
      <header className="client-dash-header">
        <h1>Training Management</h1>
        <p className="client-dash-sub">Training Provider remains separate, while client users can still access training services from one account.</p>
      </header>

      <div className="client-dash-top3">
        <article className="client-card client-card--health">
          <h2 className="client-card-kicker">Training Requests</h2>
          <div className="client-health-inner">
            <ClipboardList size={28} />
            <p className="client-health-caption">Manage training approvals and enrollments.</p>
          </div>
        </article>

        <article className="client-card client-card--risk client-card--risk-critical">
          <div className="client-risk-head">
            <h2>Upcoming Sessions</h2>
            <span className="client-badge client-badge--warn">Scheduled</span>
          </div>
          <p className="client-risk-number">8</p>
          <p className="client-risk-foot">Live courses and planned sessions</p>
        </article>

        <article className="client-card client-card--risk client-card--risk-standard">
          <div className="client-risk-head">
            <h2>Certificates</h2>
            <span className="client-badge client-badge--danger">Active</span>
          </div>
          <p className="client-risk-number">76</p>
          <p className="client-risk-foot">Issued training certificates</p>
        </article>
      </div>

      <div className="client-dash-main">
        <div className="client-dash-feed-col">
          <article className="client-card client-card--feed">
            <div className="client-feed-head">
              <h2>Training Access</h2>
              <span className="client-feed-meta">Client portal view</span>
            </div>
            <p className="client-dash-sub" style={{ marginBottom: 0 }}>
              Training Provider operations continue separately, but client users can still manage their training needs here.
            </p>
          </article>
        </div>

        <aside className="client-dash-aside">
          <article className="client-card client-card--status">
            <h2>Calendar</h2>
            <div className="client-status-row">
              <span className="client-status-pulse" aria-hidden />
              <div>
                <p className="client-status-title">Upcoming training schedules visible</p>
                <p className="client-status-sub">Next refresh: live</p>
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
