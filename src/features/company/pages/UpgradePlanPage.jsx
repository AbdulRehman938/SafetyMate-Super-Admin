import { addDoc, collection, doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { Building2, CheckCircle2, Circle, Rocket, ShieldCheck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { db } from '../../../config/firebase.js'
import { useToast } from '../../../shared/toast/toastContext.js'

const PLAN_OPTIONS = [
  {
    key: 'Starter',
    name: 'Starter',
    monthlyPrice: 99,
    description: 'Essential tools for small safety teams and basic compliance.',
    icon: Rocket,
    features: [
      { label: 'Basic safety reporting', enabled: true },
      { label: 'Up to 10 users', enabled: true },
      { label: 'Mobile incident logging', enabled: true },
      { label: 'Advanced analytics', enabled: false },
      { label: 'Custom API Access', enabled: false },
    ],
  },
  {
    key: 'Professional',
    name: 'Professional',
    monthlyPrice: 299,
    description: 'Advanced tracking and compliance tools for growing enterprises.',
    icon: ShieldCheck,
    features: [
      { label: 'All Starter features', enabled: true },
      { label: 'Advanced analytics dashboard', enabled: true },
      { label: 'Incident tracking (Up to 50 users)', enabled: true },
      { label: 'OSHA Compliance Module', enabled: true, highlight: true },
      { label: '24/7 Dedicated Support', enabled: false },
    ],
  },
  {
    key: 'Enterprise',
    name: 'Enterprise',
    monthlyPrice: 899,
    description: 'Maximum scale and security for large-scale safety operations.',
    icon: Building2,
    features: [
      { label: 'Unlimited users', enabled: true },
      { label: 'Custom API access & webhooks', enabled: true },
      { label: '24/7 Dedicated Account Manager', enabled: true },
      { label: 'White-labeling options', enabled: true },
      { label: 'SSO & SAML integration', enabled: true },
    ],
  },
]

function normalizePlanKey(value) {
  const v = String(value || '').trim().toLowerCase()
  if (v.includes('starter')) return 'Starter'
  if (v.includes('enterprise')) return 'Enterprise'
  if (v.includes('professional') || v.includes('pro')) return 'Professional'
  return 'Professional'
}

export function UpgradePlanPage() {
  const { companyId } = useParams()
  const navigate = useNavigate()
  const { state } = useLocation()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [company, setCompany] = useState(state?.company || null)
  const [selected, setSelected] = useState(normalizePlanKey(state?.company?.plan || 'Professional'))

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
        setCompany(snap.exists() ? { id: snap.id, ...snap.data() } : null)
        if (snap.exists()) setSelected(normalizePlanKey(snap.data().plan || 'Professional'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [company, companyId])

  const selectedPlan = useMemo(
    () => PLAN_OPTIONS.find((p) => p.key === selected) || PLAN_OPTIONS[1],
    [selected],
  )

  const currentPlanKey = useMemo(
    () => normalizePlanKey(company?.plan || state?.company?.plan || selected),
    [company?.plan, selected, state?.company?.plan],
  )

  const currentPlan = useMemo(
    () => PLAN_OPTIONS.find((p) => p.key === currentPlanKey) || PLAN_OPTIONS[1],
    [currentPlanKey],
  )

  const currentPrice = Number(company?.monthlyPrice || currentPlan.monthlyPrice || 0)
  const nextPrice = Number(selectedPlan.monthlyPrice || 0)
  const proratedCredit = Math.max(0, currentPrice * 0.5)
  const totalDueNow = Math.max(0, nextPrice - proratedCredit)

  async function onConfirmUpdate() {
    if (!company) return
    setSubmitting(true)
    try {
      const previousPlan = company.plan || 'Unknown'
      const previousPrice = Number(company.monthlyPrice || 0)
      const nextPrice = Number(selectedPlan.monthlyPrice)

      await updateDoc(doc(db, 'organizations', companyId), {
        plan: selectedPlan.name,
        monthlyPrice: nextPrice,
        status: 'active',
        planUpdatedAt: serverTimestamp(),
      })

      await addDoc(collection(db, 'organization_audit_logs'), {
        organizationId: companyId,
        type: 'PLAN_CHANGED',
        previousPlan,
        nextPlan: selectedPlan.name,
        previousPrice,
        nextPrice,
        createdAt: serverTimestamp(),
      })

      await addDoc(collection(db, 'billing_events'), {
        organizationId: companyId,
        type: 'PLAN_UPGRADE',
        previousPlan,
        nextPlan: selectedPlan.name,
        amount: nextPrice,
        createdAt: serverTimestamp(),
      })

      navigate(`/company/${companyId}/upgrade-success`, {
        state: {
          name: company.name || company.companyName || '—',
          plan: selectedPlan.name,
          monthlyPrice: nextPrice,
          previousPlan,
        },
      })
    } catch (e) {
      toast.push({ type: 'error', title: 'Failed', message: e?.message || 'Could not update plan.' })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <section className="stack-gap">
        <article className="dashboard-card">Loading company plan details…</article>
      </section>
    )
  }

  return (
    <section className="stack-gap upgrade-plan-shell">
      <header className="card-head upgrade-plan-head">
        <div className="upgrade-plan-meta">
          <h2>Upgrade/Downgrade Plan</h2>
          <p>{company?.name || company?.companyName || 'Company'} - ID: {companyId}</p>
        </div>

        <div className="plan-current-pill" aria-label="Current plan">
          <small>CURRENT PLAN</small>
          <b>{currentPlan.name} Tier</b>
        </div>
      </header>

      <section className="plan-grid">
        {PLAN_OPTIONS.map((plan) => {
          const isActive = plan.key === selected
          const isCurrent = plan.key === currentPlanKey
          const Icon = plan.icon
          return (
            <button
              key={plan.key}
              type="button"
              className={`plan-card ${isActive ? 'plan-card-selected' : ''} ${isCurrent ? 'plan-card-current' : ''}`}
              onClick={() => setSelected(plan.key)}
            >
              {isCurrent ? <span className="plan-active-chip">ACTIVE PLAN</span> : null}

              <div className="plan-card-top">
                <span className="plan-icon-box">
                  <Icon size={14} />
                </span>
              </div>

              <p className="plan-title">{plan.name}</p>
              <p className="plan-subtitle">{plan.description}</p>

              <div className="plan-price">
                <b>${plan.monthlyPrice}</b>
                <span>/month</span>
              </div>

              <ul className="plan-feature-list">
                {plan.features.map((f) => (
                  <li
                    key={f.label}
                    className={`plan-feature ${f.enabled ? 'plan-feature-enabled' : 'plan-feature-disabled'} ${f.highlight ? 'plan-feature-highlight' : ''}`}
                  >
                    {f.enabled ? <CheckCircle2 size={13} /> : <Circle size={13} />}
                    <span>{f.label}</span>
                  </li>
                ))}
              </ul>

              <span className={`plan-action-btn ${isCurrent ? 'plan-action-current' : ''}`}>
                {isCurrent ? 'Current Active' : 'Select Plan →'}
              </span>
            </button>
          )
        })}
      </section>

      <article className="dashboard-card upgrade-summary-card">
        <h3 className="section-title">Change Summary</h3>
        <div className="upgrade-summary-grid">
          <div>
            <p>Selected Plan</p>
            <b>{selectedPlan.name} Tier</b>
            <span>
              {selectedPlan.key === currentPlanKey ? 'No plan change' : `Upgrading from ${currentPlan.name}`}
            </span>
          </div>
          <div>
            <p>Effective Date</p>
            <b>Immediately</b>
            <span>Billing cycle restarts today</span>
          </div>
          <div>
            <p>Prorated Credit</p>
            <b className="status-green">-${proratedCredit.toFixed(2)}</b>
            <span>From unused {currentPlan.name} days</span>
          </div>
          <div>
            <p>Total Due Now</p>
            <b>${totalDueNow.toFixed(2)}</b>
            <span>plus applicable taxes</span>
          </div>
        </div>

        <p className="upgrade-summary-note">
          By confirming this change, plan access is updated immediately. A receipt will be sent to
          the billing contact on file.
        </p>
      </article>

      <div className="footer-actions">
        <button type="button" className="secondary-btn" onClick={() => navigate('/company')}>
          Cancel Change
        </button>
        <button type="button" className="primary-btn" disabled={submitting} onClick={onConfirmUpdate}>
          {submitting ? 'Updating Plan…' : 'Confirm & Update Plan'}
        </button>
      </div>
    </section>
  )
}

