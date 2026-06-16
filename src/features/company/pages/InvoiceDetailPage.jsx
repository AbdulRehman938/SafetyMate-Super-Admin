import { useEffect, useMemo, useState } from 'react'
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { useLocation, useParams, useSearchParams } from 'react-router-dom'
import {
  Download,
  Mail,
  ShieldCheck,
} from 'lucide-react'
import { useAuth } from '../../../app/providers/authContext.js'
import { db } from '../../../config/firebase.js'
import { writeSecurityAuditLog } from '../../../shared/security/auditLog.js'
import { useToast } from '../../../shared/toast/toastContext.js'
import { EmailInvoiceModal } from '../components/EmailInvoiceModal.jsx'
import { ConfirmModal } from '../../../shared/modals/ConfirmModal.jsx'

function toDate(value) {
  if (!value) return null
  if (typeof value?.toDate === 'function') return value.toDate()
  if (
    typeof value === 'object' &&
    value !== null &&
    typeof value.seconds === 'number'
  ) {
    const nanos = typeof value.nanoseconds === 'number' ? value.nanoseconds : 0
    return new Date(value.seconds * 1000 + Math.floor(nanos / 1_000_000))
  }
  if (value instanceof Date) return value
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function formatDate(value) {
  const d = toDate(value)
  if (!d) return '—'
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: '2-digit', year: 'numeric' }).format(d)
}

function formatMoney(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value) || 0)
}

function invoiceTone(status) {
  const s = String(status || '').toLowerCase()
  if (s === 'paid') return 'success'
  if (s === 'unpaid' || s === 'pending') return 'warn'
  if (s === 'overdue' || s === 'failed') return 'danger'
  return 'muted'
}

export function InvoiceDetailPage() {
  const { companyId, invoiceDocId } = useParams()
  const { state } = useLocation()
  const toast = useToast()
  const { authUser, profile } = useAuth()
  const actorEmail = profile?.email || authUser?.email || 'unknown'
  const [searchParams] = useSearchParams()

  const [loading, setLoading] = useState(true)
  const [company, setCompany] = useState(state?.company || null)
  const [invoice, setInvoice] = useState(state?.invoice || null)
  const [emailOpen, setEmailOpen] = useState(false)
  const [markingPaid, setMarkingPaid] = useState(false)
  const [activationPrompt, setActivationPrompt] = useState({ open: false, orgId: null })
  const [activating, setActivating] = useState(false)
  const [logoFailed, setLogoFailed] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function run() {
      setLoading(true)
      try {
        const invoiceSnap = await getDoc(doc(db, 'invoices', invoiceDocId)).catch(() => null)
        const invoiceData = invoiceSnap?.exists?.() ? invoiceSnap.data() : null
        const resolvedOrgId = companyId || invoiceData?.organizationId || null
        const companySnap = resolvedOrgId
          ? await getDoc(doc(db, 'organizations', resolvedOrgId)).catch(() => null)
          : null

        if (cancelled) return

        if (companySnap?.exists?.()) setCompany({ id: companySnap.id, ...companySnap.data() })
        if (invoiceSnap?.exists?.()) setInvoice({ id: invoiceSnap.id, ...invoiceSnap.data() })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [companyId, invoiceDocId])

  useEffect(() => {
    // Auto-print when opened from "Download" action.
    if (loading) return
    if (!invoice) return
    const flag = searchParams.get('print')
    if (!(flag === '1' || flag === 'true')) return
    const t = window.setTimeout(() => window.print(), 250)
    return () => window.clearTimeout(t)
  }, [invoice, loading, searchParams])

  const itemRows = useMemo(() => (Array.isArray(invoice?.items) ? invoice.items : []), [invoice])
  const subtotal = Number(invoice?.subtotal || 0)
  const taxAmount = Number(invoice?.taxAmount || 0)
  const total = Number(invoice?.totalDue ?? invoice?.totalAmount ?? subtotal + taxAmount)
  const invoiceId = invoice?.invoiceId || `INV-${invoiceDocId.slice(0, 6).toUpperCase()}`
  const invoiceStatus = String(invoice?.status || 'unpaid').toLowerCase()
  const issueDateValue = invoice?.issueDate || invoice?.createdAt || null
  const dueDateValue = invoice?.dueDate || (toDate(issueDateValue) ? new Date(toDate(issueDateValue).getTime() + 30 * 24 * 60 * 60 * 1000) : null)

  function onDownloadPdf() {
    window.print()
  }

  async function onMarkAsPaid() {
    if (!invoiceDocId) return
    if (invoiceStatus === 'paid') return
    setMarkingPaid(true)
    try {
      await updateDoc(doc(db, 'invoices', invoiceDocId), {
        status: 'paid',
        paidAt: serverTimestamp(),
      })
      setInvoice((prev) => ({ ...(prev || {}), status: 'paid', paidAt: new Date() }))

      await writeSecurityAuditLog(db, {
        actor: actorEmail,
        actionType: 'MARK_INVOICE_PAID',
        resource: `invoices/${invoiceDocId}`,
        severity: 'Medium',
        details: `invoiceId=${invoiceId}`,
      }).catch(() => {})

      const orgId = company?.id || invoice?.organizationId || companyId || null
      const companyStatus = String(company?.status || '').toLowerCase().replace(/\s+/g, '_')
      if (companyStatus === 'pending_payment') {
        setActivationPrompt({ open: true, orgId })
        return
      }

      toast.push({
        type: 'success',
        title: 'Payment updated',
        message: 'Invoice status updated to paid.',
      })
    } catch (e) {
      toast.push({
        type: 'error',
        title: 'Failed',
        message: e?.message || 'Could not update invoice status.',
      })
    } finally {
      setMarkingPaid(false)
    }
  }

  async function onActivateNow() {
    const orgId = activationPrompt.orgId
    if (!orgId) {
      setActivationPrompt({ open: false, orgId: null })
      toast.push({ type: 'error', title: 'Missing data', message: 'Missing organizationId for activation.' })
      return
    }

    setActivating(true)
    try {
      await updateDoc(doc(db, 'organizations', orgId), { status: 'active' })
      setCompany((prev) => ({ ...(prev || {}), status: 'active' }))
      await writeSecurityAuditLog(db, {
        actor: actorEmail,
        actionType: 'ORGANIZATION_ACTIVATED',
        resource: `organizations/${orgId}`,
        severity: 'Medium',
        details: `organizationId=${orgId}`,
      }).catch(() => {})

      toast.push({
        type: 'success',
        title: 'Activated',
        message: 'Invoice marked paid and organization is now active.',
      })
    } catch (e) {
      toast.push({
        type: 'error',
        title: 'Activation failed',
        message: e?.message || 'Could not activate organization.',
      })
    } finally {
      setActivating(false)
      setActivationPrompt({ open: false, orgId: null })
    }
  }

  function onActivationLater() {
    setActivationPrompt({ open: false, orgId: null })
    toast.push({
      type: 'success',
      title: 'Payment updated',
      message: 'Invoice status updated to paid.',
    })
  }

  if (loading) {
    return (
      <section className="invoice-detail-page">
        <article className="dashboard-card">Loading invoice detail...</article>
      </section>
    )
  }

  return (
    <section className="invoice-detail-page">
      <ConfirmModal
        isOpen={activationPrompt.open}
        tone="warn"
        title="Activate account now?"
        message="Invoice marked as paid. Would you like to activate the organization account now?"
        confirmText="Activate Account"
        cancelText="Not now"
        busy={activating}
        onConfirm={onActivateNow}
        onCancel={onActivationLater}
      />
      <div className="invoice-detail-layout">
        <aside className="invoice-side">
          <p className="billing-breadcrumb">Financials &gt; Invoice Detail</p>
          <h2>#{invoiceId}</h2>
          <span className={`status-badge tone-${invoiceTone(invoiceStatus)}`}>
            Status: {String(invoiceStatus || 'unpaid').replace(/_/g, ' ')}
          </span>
          <small>Issue Date: {formatDate(issueDateValue)}</small>
          <small>Due Date: {formatDate(dueDateValue)}</small>

          <div className="invoice-side-actions">
            <h3>Quick Actions</h3>
            <button type="button" className="primary-btn invoice-screen-only" onClick={() => setEmailOpen(true)}>
              <Mail size={14} /> Email to Client
            </button>
            <div className="invoice-side-row">
              <button type="button" className="secondary-btn" onClick={onDownloadPdf}>
                <Download size={14} /> Download PDF
              </button>
            </div>
            <button
              type="button"
              className="secondary-btn invoice-screen-only"
              onClick={onMarkAsPaid}
              disabled={markingPaid || invoiceStatus === 'paid'}
            >
              {markingPaid ? 'Updating…' : invoiceStatus === 'paid' ? 'Already Paid' : 'Mark as Paid'}
            </button>
          </div>

          {/* Audit Trail removed per MVP UI */}
        </aside>

        <article className="invoice-paper-wrap">
          <section className="invoice-paper">
            <header className="invoice-paper-head">
              <div className="invoice-paper-brand">
                <span className="invoice-paper-mark">
                  {company?.logoUrl && !logoFailed ? (
                    <img
                      src={company.logoUrl}
                      alt={`${company?.name || 'Company'} logo`}
                      onError={() => setLogoFailed(true)}
                    />
                  ) : (
                    <ShieldCheck size={18} />
                  )}
                </span>
                <div>
                  <h3>{company?.name || 'SafetyMate Subscriber'}</h3>
                  <p>{company?.address?.street || '123 Industrial Way, Suite 400'}</p>
                  <p>
                    {company?.address?.city || 'San Francisco'}, {company?.address?.postalCode || '94103'}{' '}
                    {company?.address?.country || 'USA'}
                  </p>
                </div>
              </div>
              <div className="invoice-paper-meta">
                <h1>INVOICE</h1>
                <b>#{invoiceId}</b>
                <span>Issue Date: {formatDate(issueDateValue)}</span>
                <span>Due Date: {formatDate(dueDateValue)}</span>
              </div>
            </header>

            <div className="invoice-paper-parties">
              <article>
                <small>BILL TO:</small>
                <b>{company?.name || 'SafeWork Solutions Inc.'}</b>
                <p>{company?.primaryContact?.fullName || 'Attn: Client Billing Team'}</p>
                <p>{company?.address?.street || '852 Tech Plaza, Level 2'}</p>
                <p>
                  {company?.address?.city || 'Austin'}, {company?.address?.postalCode || '78701'}{' '}
                  {company?.address?.country || 'USA'}
                </p>
              </article>
              <article>
                <small>FROM:</small>
                <b>SafetyMate Platform</b>
                <p>Finance & Billing Operations</p>
                <p>billing@safetymate.app</p>
                <p>support@safetymate.app</p>
              </article>
            </div>

            <table className="invoice-paper-table">
              <thead>
                <tr>
                  <th>DESCRIPTION</th>
                  <th>QTY</th>
                  <th>RATE</th>
                  <th>AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                {itemRows.length ? (
                  itemRows.map((item, idx) => {
                    const qty = Number(item.qty || 0)
                    const rate = Number(item.rate ?? item.price ?? 0)
                    const amount = Number(item.amount ?? qty * rate)
                    return (
                      <tr key={`${item.description || 'item'}-${idx}`}>
                        <td>{item.description || 'SafetyMate Subscription'}</td>
                        <td>{qty || 1}</td>
                        <td>{formatMoney(rate)}</td>
                        <td>{formatMoney(amount)}</td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td>SafetyMate Subscription</td>
                    <td>1</td>
                    <td>{formatMoney(Number(invoice?.amount ?? total))}</td>
                    <td>{formatMoney(Number(invoice?.amount ?? total))}</td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="invoice-paper-total">
              <p>
                <span>Subtotal:</span>
                <b>{formatMoney(subtotal)}</b>
              </p>
              <p>
                <span>Sales Tax:</span>
                <b>{formatMoney(taxAmount)}</b>
              </p>
              <p className="grand">
                <span>AMOUNT DUE:</span>
                <b>{formatMoney(total)}</b>
              </p>
            </div>

            <section className="invoice-bank">
              <h4>Bank Transfer Instructions</h4>
              <p>
                <span>Bank Name:</span> National Commercial Bank
              </p>
              <p>
                <span>Account Name:</span> SafetyMate Technologies
              </p>
              <p>
                <span>IBAN / Account #:</span> PK00-SMTE-2026-001234
              </p>
              <p>
                <span>Reference:</span> {invoiceId}
              </p>
            </section>

            <footer className="invoice-paper-foot">
              <p>Thank you for your business!</p>
              <small>Payment terms: Net 30. Please include invoice reference in transfer details.</small>
            </footer>
          </section>
        </article>
      </div>

      <EmailInvoiceModal
        isOpen={emailOpen}
        onClose={() => setEmailOpen(false)}
        invoice={{
          ...(invoice || {}),
          id: invoice?.id || invoiceDocId,
          invoiceId,
          organizationId: company?.id || invoice?.organizationId || companyId || null,
          organizationName: company?.name || invoice?.organizationName || null,
        }}
      />
    </section>
  )
}
