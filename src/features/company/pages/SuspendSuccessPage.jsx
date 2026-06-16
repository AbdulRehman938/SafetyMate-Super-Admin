import { CheckCircle2, Building2, ArrowLeft } from 'lucide-react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

function formatDate(value) {
  if (!value) return '—'
  const date = value?.toDate?.() instanceof Date ? value.toDate() : value
  if (!(date instanceof Date)) return '—'
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(date)
}

export function SuspendSuccessPage() {
  const { companyId } = useParams()
  const navigate = useNavigate()
  const { state } = useLocation()
  const data = state || {}

  return (
    <section className="created-page">
      <div className="created-hero">
        <div className="created-icon">
          <CheckCircle2 size={26} />
        </div>
        <h1>Company Suspended Successfully</h1>
        <p>The subscription for this entity has been deactivated. User access is now restricted.</p>
      </div>

      <article className="created-card">
        <div className="created-card-head">
          <div className="created-company">
            <span className="created-company-ic">
              <Building2 size={16} />
            </span>
            <div>
              <h2>{data.name || 'Company'}</h2>
              <span>Subscriber Entity #{data.entityCode || companyId}</span>
            </div>
          </div>
        </div>

        <div className="created-grid">
          <div>
            <p>Status</p>
            <b className="status-red">SUSPENDED</b>
          </div>
          <div>
            <p>Effective Date</p>
            <b>{formatDate(data.effectiveDate || new Date())}</b>
          </div>
          <div className="created-note-card">
            <p>Suspension Reason</p>
            <b>{data.reason || 'Not provided.'}</b>
          </div>
        </div>
      </article>

      <div className="created-actions">
        <button type="button" className="primary-btn created-primary" onClick={() => navigate('/company')}>
          <ArrowLeft size={16} />
          Return to Subscriber Management
        </button>
      </div>
    </section>
  )
}

