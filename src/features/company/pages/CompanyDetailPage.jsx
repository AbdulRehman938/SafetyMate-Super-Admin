import { doc, getDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Building2, History, Send } from 'lucide-react'
import { db } from '../../../config/firebase.js'

export function CompanyDetailPage() {
  const { companyId } = useParams()
  const navigate = useNavigate()
  const { state } = useLocation()

  const [loading, setLoading] = useState(true)
  const [company, setCompany] = useState(state?.company || null)

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (company) {
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const snap = await getDoc(doc(db, 'organizations', companyId)).catch(() => null)
        if (cancelled) return
        setCompany(snap?.exists?.() ? { id: snap.id, ...snap.data() } : null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [company, companyId])

  if (loading) {
    return (
      <section className="stack-gap">
        <article className="dashboard-card">Loading company…</article>
      </section>
    )
  }

  if (!company) {
    return (
      <section className="stack-gap">
        <article className="dashboard-card">Company not found.</article>
      </section>
    )
  }

  const name = company.name || company.companyName || '—'

  return (
    <section className="stack-gap">
      <header className="card-head">
        <div>
          <h2>{name}</h2>
          <p>ID: {companyId}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="secondary-btn" onClick={() => navigate(`/company/${companyId}/billing-history`, { state: { company } })}>
            <History size={14} /> Billing History
          </button>
          <button
            type="button"
            className="primary-btn"
            onClick={() =>
              navigate('/announcements', {
                state: { preselectCompany: { id: companyId, name } },
              })
            }
          >
            <Send size={14} /> Send Notification
          </button>
        </div>
      </header>

      <article className="dashboard-card">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span className="notify-section-ic">
            <Building2 size={14} />
          </span>
          <div>
            <p style={{ margin: 0, color: 'var(--muted2)', fontSize: 12 }}>Plan</p>
            <b style={{ fontSize: 16 }}>{company.plan || company.planName || '—'}</b>
          </div>
        </div>
      </article>
    </section>
  )
}

