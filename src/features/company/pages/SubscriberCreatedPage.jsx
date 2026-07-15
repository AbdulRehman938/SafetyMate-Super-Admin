import { CheckCircle2, LayoutDashboard, List } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'

function formatDate(value) {
  if (!value) return '—'
  const date =
    value?.toDate?.() instanceof Date
      ? value.toDate()
      : value instanceof Date
        ? value
        : null
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(date)
}

export function SubscriberCreatedPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const data = location.state || {}

  return (
    <section className="created-page">
      <div className="created-hero">
        <div className="created-icon">
          <CheckCircle2 size={26} />
        </div>
        <h1>New Subscriber Created Successfully</h1>
        <p>The subscriber account has been provisioned and is ready for use.</p>
      </div>

      <article className="created-card">
        <div className="created-card-head">
          <div>
            <h2>{data.name || '—'}</h2>
            <span>Subscriber Entity #{data.entityCode || data.id || '—'}</span>
          </div>
          <span className="created-status">Pending Activation</span>
        </div>

        <div className="created-grid">
          <div>
            <p>ACCOUNT TYPE</p>
            <b>{data.accountTypeLabel || 'Client / Company Admin'}</b>
          </div>
          <div>

            <p>SUBSCRIPTION PLAN</p>
            <b>
              {data.plan || '—'} ({data.monthlyPrice != null ? `$${data.monthlyPrice}/mo` : '—'})
            </b>
          </div>
          <div>
            <p>PRIMARY CONTACT</p>
            <b>{data.primaryContact?.fullName || '—'}</b>
          </div>
          <div>
            <p>DATE CREATED</p>
            <b>{formatDate(data.createdAt)}</b>
          </div>
          <div>
            <p>ORGANIZATION ID</p>
            <b>{data.id || '—'}</b>
          </div>
        </div>
      </article>

      <div className="created-actions">
        <button type="button" className="primary-btn created-primary" onClick={() => navigate('/dashboard')}>
          <LayoutDashboard size={16} />
          View Company Dashboard
        </button>
        <button type="button" className="secondary-btn created-secondary" onClick={() => navigate('/company')}>
          <List size={16} />
          Subscriber List
        </button>
      </div>
    </section>
  )
}

