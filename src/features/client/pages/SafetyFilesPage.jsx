import { FolderKanban, FileCheck2, ShieldAlert } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export function SafetyFilesPage() {
  const navigate = useNavigate()

  return (
    <section className="client-page client-dashboard-page">
      <header className="client-dash-header">
        <h1>Safety Files</h1>
        <p className="client-dash-sub">Central storage for compliance documents, safety records, and supporting files.</p>
      </header>

      <div className="client-dash-top3">
        <article className="client-card client-card--health">
          <h2 className="client-card-kicker">Files Stored</h2>
          <div className="client-health-inner">
            <FolderKanban size={28} />
            <p className="client-health-caption">Access active files and supporting documentation.</p>
          </div>
        </article>

        <article className="client-card client-card--risk client-card--risk-critical">
          <div className="client-risk-head">
            <h2>Pending Review</h2>
            <span className="client-badge client-badge--warn">Review</span>
          </div>
          <p className="client-risk-number">7</p>
          <p className="client-risk-foot">Files awaiting approval or update</p>
        </article>

        <article className="client-card client-card--risk client-card--risk-standard">
          <div className="client-risk-head">
            <h2>Audit Ready</h2>
            <span className="client-badge client-badge--danger">Ready</span>
          </div>
          <p className="client-risk-number">128</p>
          <p className="client-risk-foot">Documents prepared for audit access</p>
        </article>
      </div>

      <div className="client-dash-main">
        <div className="client-dash-feed-col">
          <article className="client-card client-card--feed">
            <div className="client-feed-head">
              <h2>File Library</h2>
              <span className="client-feed-meta">Client documents</span>
            </div>
            <p className="client-dash-sub" style={{ marginBottom: 0 }}>
              Safety Files keeps the client’s operational records in one place for quick access and review.
            </p>
          </article>
        </div>

        <aside className="client-dash-aside">
          <article className="client-card client-card--status">
            <h2>Document Status</h2>
            <div className="client-status-row">
              <span className="client-status-pulse" aria-hidden />
              <div>
                <p className="client-status-title">Latest file pack available</p>
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
