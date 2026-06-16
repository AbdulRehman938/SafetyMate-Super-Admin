import { addDoc, collection, doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { CheckCircle2, Clock3, Database, Info, RefreshCw, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { db } from '../../../config/firebase.js'
import { useToast } from '../../../shared/toast/toastContext.js'

const DURATION_OPTIONS = [
  { months: 1, label: '+1m', subLabel: 'Monthly' },
  { months: 3, label: '+3m', subLabel: 'Quarterly' },
  { months: 6, label: '+6m', subLabel: 'Bi-Annual' },
  { months: 12, label: '+12m', subLabel: 'Yearly', bestValue: true },
]

function toDate(value) {
  if (!value) return null
  if (value?.toDate?.() instanceof Date) return value.toDate()
  if (value instanceof Date) return value
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function addMonths(baseDate, months) {
  const d = new Date(baseDate)
  d.setMonth(d.getMonth() + months)
  return d
}

function formatDate(date) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).format(date)
}

export function ExtendSubscriptionPage() {
  const { companyId } = useParams()
  const { state } = useLocation()
  const navigate = useNavigate()
  const toast = useToast()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [company, setCompany] = useState(state?.company || null)
  const [months, setMonths] = useState(12)

  useEffect(() => {
    let cancelled = false

    async function run() {
      if (company) {
        setLoading(false)
        return
      }

      try {
        const snap = await getDoc(doc(db, 'organizations', companyId))
        if (cancelled) return
        if (snap.exists()) {
          const data = snap.data()
          setCompany({
            id: snap.id,
            ...data,
            name: data.name || data.companyName || data.organizationName || 'Company',
            plan: data.plan || data.planName || 'Professional Tier',
            users: data.totalUsers || data.users || '—',
            monthlyPrice: Number(data.monthlyPrice || 99),
            expiryRaw: data.subscriptionExpiry || data.expiry || data.expiryDate || null,
          })
        } else {
          setCompany(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [company, companyId])

  const currentExpiry = useMemo(() => {
    const source = toDate(company?.expiryRaw)
    return source || new Date()
  }, [company?.expiryRaw])

  const nextExpiry = useMemo(() => addMonths(currentExpiry, months), [currentExpiry, months])

  const baseAmount = useMemo(() => Number(company?.monthlyPrice || 99) * months, [company?.monthlyPrice, months])
  const discountRate = months >= 12 ? 0.05 : months >= 6 ? 0.02 : 0
  const discount = baseAmount * discountRate
  const taxable = baseAmount - discount
  const taxes = taxable * 0.1
  const total = taxable + taxes

  async function onConfirmExtension() {
    if (!company) return
    setSubmitting(true)
    try {
      await updateDoc(doc(db, 'organizations', companyId), {
        subscriptionExpiry: nextExpiry,
        extensionMonths: months,
        extensionAmount: total,
        extendedAt: serverTimestamp(),
      })

      await addDoc(collection(db, 'organization_audit_logs'), {
        organizationId: companyId,
        type: 'SUBSCRIPTION_EXTENDED',
        extensionMonths: months,
        previousExpiry: currentExpiry,
        newExpiry: nextExpiry,
        createdAt: serverTimestamp(),
      })

      toast.push({
        type: 'success',
        title: 'Subscription extended',
        message: `New expiry date is ${formatDate(nextExpiry)}.`,
      })

      navigate('/company')
    } catch (e) {
      toast.push({ type: 'error', title: 'Failed', message: e?.message || 'Could not extend subscription.' })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <section className="stack-gap">
        <article className="dashboard-card">Loading extension details…</article>
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

  return (
    <section className="stack-gap extend-page-shell">
      <div className="extend-breadcrumb">Home › Billing › <span>Extend Subscription</span></div>

      <header className="extend-page-head">
        <div>
          <h2>Extend Subscription</h2>
          <p>Configure and renew the service term for {company.name}</p>
        </div>
        <span className="extend-status-pill">● CURRENT STATUS: ACTIVE</span>
      </header>

      <section className="extend-layout">
        <div className="extend-main-col">
          <article className="dashboard-card extend-card">
            <h3 className="extend-card-title">
              <Info size={16} /> Current Subscription Details
            </h3>
            <div className="extend-current-grid">
              <div>
                <p>COMPANY NAME</p>
                <b>{company.name}</b>
              </div>
              <div>
                <p>CURRENT PLAN</p>
                <b>{company.plan || 'Professional Tier'}</b>
              </div>
              <div>
                <p>EXPIRY DATE</p>
                <b>{formatDate(currentExpiry)}</b>
              </div>
            </div>
          </article>

          <article className="dashboard-card extend-card">
            <h3 className="extend-card-title">
              <RefreshCw size={16} /> Select Extension Duration
            </h3>

            <div className="extend-duration-grid">
              {DURATION_OPTIONS.map((o) => (
                <button
                  key={o.months}
                  type="button"
                  className={`extend-duration-btn ${months === o.months ? 'extend-duration-active' : ''}`}
                  onClick={() => setMonths(o.months)}
                >
                  {o.bestValue ? <span className="extend-best-value">BEST VALUE</span> : null}
                  <b>{o.label}</b>
                  <span>{o.subLabel}</span>
                </button>
              ))}
            </div>

            <div className="extend-next-expiry">
              <div className="extend-next-icon">
                <Clock3 size={16} />
              </div>
              <div>
                <p>New Subscription Expiry Date</p>
                <b>{formatDate(nextExpiry)}</b>
              </div>
              <div className="extend-days-chip">
                <p>EXTENDED BY</p>
                <b>{months * 30} Days</b>
              </div>
            </div>
          </article>

          <div className="extend-meta-row">
            <div>
              <Clock3 size={16} />
              <div>
                <p>LAST RENEWAL</p>
                <b>{formatDate(currentExpiry)}</b>
              </div>
            </div>
            <div>
              <Users size={16} />
              <div>
                <p>ACTIVE SEATS</p>
                <b>{company.users || '—'}</b>
              </div>
            </div>
            <div>
              <Database size={16} />
              <div>
                <p>STORAGE LIMIT</p>
                <b>85% of 1TB used</b>
              </div>
            </div>
          </div>
        </div>

        <aside className="dashboard-card extend-billing-card">
          <h3>Billing Summary</h3>
          <p>Review the costs for the {months}-month extension</p>

          <div className="extend-billing-lines">
            <div>
              <span>{company.plan || 'Professional Plan'} ({months}m)</span>
              <b>${baseAmount.toFixed(2)}</b>
            </div>
            <div>
              <span>Early Renewal Discount ({Math.round(discountRate * 100)}%)</span>
              <b className="status-green">-${discount.toFixed(2)}</b>
            </div>
            <div>
              <span>Estimated Taxes (VAT 10%)</span>
              <b>${taxes.toFixed(2)}</b>
            </div>
          </div>

          <div className="extend-grand-total">
            <span>Grand Total</span>
            <b>${total.toFixed(2)}</b>
          </div>

          <button type="button" className="primary-btn extend-confirm-btn" disabled={submitting} onClick={onConfirmExtension}>
            <CheckCircle2 size={15} /> {submitting ? 'Processing…' : 'Confirm Extension'}
          </button>
          <button type="button" className="secondary-btn extend-cancel-btn" onClick={() => navigate('/company')}>
            Cancel
          </button>

          <p className="extend-billing-note">
            An invoice will be automatically generated and sent to the billing contact. Subscription
            status updates immediately upon payment verification.
          </p>
        </aside>
      </section>
    </section>
  )
}
