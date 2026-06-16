import { ArrowLeft, CheckCircle2, Download, LayoutDashboard } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'

export function UpgradeSuccessPage() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const data = state || {}

  return (
    <section className="created-page">
      <div className="created-hero">
        <div className="created-icon">
          <CheckCircle2 size={26} />
        </div>
        <h1>Plan Upgraded Successfully</h1>
        <p>The subscriber account has been updated to the new tier.</p>
      </div>

      <article className="created-card">
        <div className="created-card-head">
          <div>
            <h2>Subscription Summary</h2>
            <span>Updated subscription details</span>
          </div>
          <span className="created-status">ACTIVE</span>
        </div>
        <div className="created-grid">
          <div>
            <p>New Plan Tier</p>
            <b>{data.plan || '—'}</b>
          </div>
          <div>
            <p>Billing Cycle</p>
            <b>Monthly Billing</b>
          </div>
          <div>
            <p>Total Billed</p>
            <b>${Number(data.monthlyPrice || 0).toFixed(2)}</b>
          </div>
        </div>
      </article>

      <div className="created-actions">
        <button type="button" className="primary-btn created-primary" onClick={() => navigate('/company')}>
          <ArrowLeft size={16} />
          Return to Subscriber Management
        </button>
        <button type="button" className="secondary-btn created-secondary" onClick={() => navigate('/dashboard')}>
          <LayoutDashboard size={16} />
          View Updated Dashboard
        </button>
        <button type="button" className="secondary-btn created-secondary">
          <Download size={16} />
          Download Invoice
        </button>
      </div>
    </section>
  )
}

