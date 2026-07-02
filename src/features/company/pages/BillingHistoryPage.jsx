import { useEffect, useMemo, useState } from 'react'
import { addDoc, collection, getDoc, getDocs, orderBy, query, serverTimestamp, where, doc } from 'firebase/firestore'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  CalendarDays,
  CheckCircle2,
  Loader2,
  Clock3,
  CircleDot,
  Download,
  Eye,
  FileText,
  Link2,
  Mail,
  Plus,
  Search,
  Trash2,
  X,
  CheckCircle,
} from 'lucide-react'
import { db } from '../../../config/firebase.js'
import { useToast } from '../../../shared/toast/toastContext.js'
import { EmailInvoiceModal } from '../components/EmailInvoiceModal.jsx'

function toDate(value) {
  if (!value) return null
  if (typeof value?.toDate === 'function') return value.toDate()
  if (value instanceof Date) return value
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function formatDate(value) {
  const d = toDate(value)
  if (!d) return '—'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).format(d)
}

function formatMoney(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value) || 0)
}

function formatInputDate(value) {
  const d = toDate(value)
  if (!d) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${m}/${day}/${y}`
}

function csvEscape(value) {
  const v = String(value ?? '')
  return `"${v.replaceAll('"', '""')}"`
}

function statusTone(status) {
  const s = String(status || '').toLowerCase()
  if (s === 'paid') return 'success'
  if (s === 'pending' || s === 'unpaid') return 'warn'
  if (s === 'overdue') return 'danger'
  return 'muted'
}

function makeInvoiceId(companyId, count) {
  const prefix = (companyId || 'SM').slice(0, 2).toUpperCase()
  const year = new Date().getFullYear()
  return `${prefix}-${year}-${String(count + 1).padStart(3, '0')}`
}

export function BillingHistoryPage() {
  const { companyId } = useParams()
  const { state } = useLocation()
  const navigate = useNavigate()
  const toast = useToast()

  const [loading, setLoading] = useState(true)
  const [company, setCompany] = useState(state?.company || null)
  const [rows, setRows] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [successInvoice, setSuccessInvoice] = useState(null)
  const [emailModal, setEmailModal] = useState({ open: false })
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailInvoiceOpen, setEmailInvoiceOpen] = useState(false)
  const [emailInvoice, setEmailInvoice] = useState(null)
  const [form, setForm] = useState({
    invoiceDate: '',
    dueDate: '',
    notes: '',
    lineItems: [{ description: '', qty: 1, price: 0, tax: 0 }],
  })

  useEffect(() => {
    let cancelled = false

    async function run() {
      setLoading(true)
      try {
        const companyPromise = getDoc(doc(db, 'organizations', companyId)).catch(() => null)

        // Invoices: be resilient to missing composite indexes / missing createdAt.
        const invoicesRef = collection(db, 'invoices')
        const baseQ = query(invoicesRef, where('organizationId', '==', companyId))
        let invoicesSnap = null
        try {
          invoicesSnap = await getDocs(query(invoicesRef, where('organizationId', '==', companyId), orderBy('issueDate', 'desc')))
        } catch {
          try {
            invoicesSnap = await getDocs(query(invoicesRef, where('organizationId', '==', companyId), orderBy('createdAt', 'desc')))
          } catch {
            invoicesSnap = await getDocs(baseQ).catch(() => null)
          }
        }

        const companySnap = await companyPromise
        if (cancelled) return

        if (companySnap?.exists?.()) {
          setCompany({ id: companySnap.id, ...companySnap.data() })
        }

        const mappedRows =
          invoicesSnap?.docs?.map((d) => {
            const data = d.data()
            const rawAmount = data.amount ?? data.totalDue ?? data.totalAmount ?? 0
            return {
              id: d.id,
              invoiceId: data.invoiceId || `INV-${d.id.slice(0, 6).toUpperCase()}`,
              amount: Number(rawAmount || 0),
              status: String(data.status || 'unpaid').toLowerCase(),
              sentAt: data.issueDate || data.sentAt || data.createdAt || data.invoiceDate || null,
              dueDate: data.dueDate || null,
              subtotal: Number(data.subtotal || 0),
              taxAmount: Number(data.taxAmount || 0),
              totalAmount: Number(data.totalDue ?? data.totalAmount ?? rawAmount ?? 0),
              lineItems: data.lineItems || [],
              notes: data.notes || '',
            }
          }) || []

        setRows(mappedRows)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [companyId])

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const matchSearch = !search.trim() || String(row.invoiceId).toLowerCase().includes(search.toLowerCase())
      const matchStatus = statusFilter === 'all' || String(row.status).toLowerCase() === statusFilter
      return matchSearch && matchStatus
    })
  }, [rows, search, statusFilter])

  const totalRevenue = useMemo(
    () =>
      rows
        .filter((r) => String(r.status || '').toLowerCase() === 'paid')
        .reduce((sum, r) => sum + Number(r.amount || 0), 0),
    [rows],
  )

  const currentPlan = company?.plan || company?.planName || 'Enterprise Tier'
  const allocatedUsersLabel =
    company?.allocatedUsers != null && Number(company.allocatedUsers) > 0
      ? `Up to ${Number(company.allocatedUsers)} Active Users`
      : 'Unlimited Active Users'
  const renewalDate = formatDate(company?.subscriptionExpiry)

  const summary = useMemo(() => {
    const items = form.lineItems
      .filter((item) => String(item.description || '').trim())
      .map((item) => ({
        ...item,
        qty: Number(item.qty || 0),
        price: Number(item.price || 0),
        tax: Number(item.tax || 0),
      }))
    const subtotal = items.reduce((sum, item) => sum + item.qty * item.price, 0)
    const taxAmount = items.reduce((sum, item) => sum + item.qty * item.price * (item.tax / 100), 0)
    return { subtotal, taxAmount, total: subtotal + taxAmount }
  }, [form.lineItems])

  function updateLineItem(idx, key, value) {
    setForm((prev) => ({
      ...prev,
      lineItems: prev.lineItems.map((item, i) => (i === idx ? { ...item, [key]: value } : item)),
    }))
  }

  function addLineItem() {
    setForm((prev) => ({
      ...prev,
      lineItems: [...prev.lineItems, { description: '', qty: 1, price: 0, tax: 0 }],
    }))
  }

  function deleteLineItem(idx) {
    setForm((prev) => ({
      ...prev,
      lineItems: prev.lineItems.filter((_, i) => i !== idx),
    }))
  }

  function openEmailModal(invoiceLike) {
    const invoiceLabel = invoiceLike?.invoiceId || `INV-${String(invoiceLike?.id || '').slice(0, 6).toUpperCase()}`
    const toEmail =
      company?.primaryContact?.email || company?.contact?.email || company?.email || 'alex.rivers@client-corp.com'

    setEmailModal({
      open: true,
      invoiceDocId: invoiceLike?.id || null,
      invoiceId: invoiceLabel,
      to: toEmail,
      subject: `Invoice #${invoiceLabel} from SafetyMate`,
      message: `Dear ${company?.primaryContact?.name || 'Client'},\n\nPlease find your invoice #${invoiceLabel} attached.\n\nIf you have any questions regarding the line items or payment terms, please don't hesitate to reach out to our billing department.`,
      attachmentName: `Invoice_${invoiceLabel}.pdf`,
    })
  }

  async function onSendEmail() {
    if (!emailModal.to || !emailModal.subject || !emailModal.message) return
    setSendingEmail(true)
    try {
      await addDoc(collection(db, 'billing_email_queue'), {
        organizationId: companyId,
        invoiceDocId: emailModal.invoiceDocId,
        invoiceId: emailModal.invoiceId,
        to: [emailModal.to],
        subject: emailModal.subject,
        body: emailModal.message,
        attachments: [emailModal.attachmentName],
        status: 'queued',
        createdAt: serverTimestamp(),
      })
      toast.push({ type: 'success', title: 'Email queued', message: 'Invoice email has been queued for sending.' })
      setEmailModal({ open: false })
    } finally {
      setSendingEmail(false)
    }
  }

  async function onCreateInvoice() {
    const validLineItems = form.lineItems.filter((item) => String(item.description || '').trim())
    
    if (!form.invoiceDate || !form.dueDate) {
      toast.push({
        type: 'error',
        title: 'Missing dates',
        message: 'Please provide both invoice date and due date.',
      })
      return
    }

    if (validLineItems.length === 0) {
      toast.push({
        type: 'error',
        title: 'No line items',
        message: 'Please add at least one line item with a description.',
      })
      return
    }

    setCreating(true)
    try {
      const invoiceId = makeInvoiceId(companyId, rows.length)
      const payload = {
        organizationId: companyId,
        organizationName: company?.name || company?.companyName || 'Selected Company',
        invoiceId,
        invoiceDate: new Date(form.invoiceDate),
        dueDate: new Date(form.dueDate),
        lineItems: validLineItems.map((item) => ({
          description: String(item.description || '').trim(),
          qty: Number(item.qty || 0),
          price: Number(item.price || 0),
          tax: Number(item.tax || 0),
        })),
        notes: form.notes.trim(),
        subtotal: summary.subtotal,
        taxAmount: summary.taxAmount,
        totalDue: summary.total,
        status: 'unpaid',
        createdAt: serverTimestamp(),
      }

      const created = await addDoc(collection(db, 'invoices'), payload)
      const nextRow = {
        id: created.id,
        invoiceId,
        amount: summary.total,
        status: 'unpaid',
        sentAt: new Date(),
        dueDate: payload.dueDate,
        subtotal: payload.subtotal,
        taxAmount: payload.taxAmount,
        totalAmount: payload.totalDue,
        lineItems: payload.lineItems,
        notes: payload.notes,
      }
      setRows((prev) => [nextRow, ...prev])
      setShowCreateModal(false)
      setSuccessInvoice({
        id: created.id,
        invoiceId,
        clientName: payload.organizationName,
        amount: summary.total,
        dueDate: payload.dueDate,
        subtotal: payload.subtotal,
        taxAmount: payload.taxAmount,
        totalAmount: payload.totalDue,
        lineItems: payload.lineItems,
        notes: payload.notes,
      })
      setForm({
        invoiceDate: '',
        dueDate: '',
        notes: '',
        lineItems: [{ description: '', qty: 1, price: 0, tax: 0 }],
      })
      toast.push({ type: 'success', title: 'Invoice generated', message: 'New invoice created successfully.' })
    } catch (error) {
      const code = String(error?.code || '')
      const isPermissionIssue = code.includes('permission-denied')
      toast.push({
        type: 'error',
        title: isPermissionIssue ? 'Permission denied' : 'Failed to generate invoice',
        message: isPermissionIssue
          ? 'Firestore rules blocked writing to invoices collection. Please allow SUPER_ADMIN create access.'
          : error?.message || 'Something went wrong while generating invoice.',
      })
    } finally {
      setCreating(false)
    }
  }

  function exportCsv() {
    const header = ['Date', 'Invoice ID', 'Amount', 'Status']
    const body = filteredRows.map((row) => [formatDate(row.sentAt), row.invoiceId, formatMoney(row.amount), row.status])
    const csv = [header, ...body].map((line) => line.map(csvEscape).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `billing-history-${companyId}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="stack-gap billing-page">
      <header className="billing-head">
        <div>
          <p className="billing-breadcrumb">Subscribers &gt; {company?.name || company?.companyName || 'Company'} &gt; Billing History</p>
          <h2>{company?.name || company?.companyName || 'Billing History'}</h2>
          <span className="billing-status-line">ID: {companyId} • ACTIVE SUBSCRIBER</span>
        </div>
        <div className="billing-head-actions">
          <button type="button" className="secondary-btn" onClick={exportCsv}>
            <Download size={14} /> Export CSV
          </button>
          <button
            type="button"
            className="primary-btn"
            onClick={() => {
              const now = new Date()
              const due = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
              const planAmount = Number(company?.monthlyPrice ?? 0)
              const planLabel = company?.plan || company?.planName || 'Subscription'
              const seats = Number(company?.allocatedUsers || 0)
              setForm({
                invoiceDate: now.toISOString().slice(0, 10),
                dueDate: due.toISOString().slice(0, 10),
                notes: '',
                lineItems: [
                  {
                    description: `SafetyMate ${planLabel}${seats ? ` - ${seats} Allocated Users` : ''}`,
                    qty: 1,
                    price: planAmount,
                    tax: 0,
                  },
                ],
              })
              setShowCreateModal(true)
            }}
          >
            <Plus size={14} /> Create New Invoice
          </button>
        </div>
      </header>

      <section className="billing-kpis">
        <article className="dashboard-card billing-kpi">
          <span>TOTAL REVENUE</span>
          <h3>{loading ? '…' : formatMoney(totalRevenue)}</h3>
          <p>Paid invoices only</p>
        </article>
        <article className="dashboard-card billing-kpi">
          <span>NEXT RENEWAL</span>
          <h3>{renewalDate}</h3>
          <p>Annual Auto-Renewal enabled</p>
        </article>
        <article className="dashboard-card billing-kpi">
          <span>CURRENT PLAN</span>
          <h3>{currentPlan}</h3>
          <p>{allocatedUsersLabel}</p>
        </article>
      </section>

      <article className="dashboard-card billing-table-card">
        <div className="billing-table-head">
          <h3>Invoice History</h3>
          <div className="billing-filters">
            <label className="billing-search">
              <Search size={14} />
              <input
                placeholder="Search by Invoice ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <label className="billing-filter">
              <span>Status:</span>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All</option>
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid</option>
                <option value="overdue">Overdue</option>
                <option value="failed">Failed</option>
              </select>
            </label>
          </div>
        </div>

        <div className="billing-table-wrap">
          <table className="billing-table">
            <thead>
              <tr>
                <th>DATE</th>
                <th>INVOICE ID</th>
                <th>AMOUNT</th>
                <th>STATUS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="companies-loading">
                    Loading invoice history...
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="companies-loading">
                    No invoices found.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDate(row.sentAt)}</td>
                    <td className="billing-linkish">#{row.invoiceId}</td>
                    <td>{formatMoney(row.amount)}</td>
                    <td>
                      <span className={`status-badge tone-${statusTone(row.status)}`}>{row.status}</span>
                    </td>
                    <td>
                      <div className="billing-actions">
                        <button
                          type="button"
                          className="kebab-btn"
                          onClick={() => navigate(`/invoices/${row.id}`, { state: { company, invoice: row } })}
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          type="button"
                          className="kebab-btn"
                          onClick={() => {
                            window.open(`/invoices/${row.id}?print=true`, '_blank', 'noopener,noreferrer')
                          }}
                        >
                          <Download size={14} />
                        </button>
                        <button
                          type="button"
                          className="kebab-btn"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setEmailInvoice({
                              ...row,
                              organizationId: companyId,
                              organizationName: company?.name || company?.companyName || row.organizationName || null,
                            })
                            setEmailInvoiceOpen(true)
                          }}
                        >
                          <Mail size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </article>

      <EmailInvoiceModal
        isOpen={emailInvoiceOpen}
        onClose={() => {
          setEmailInvoiceOpen(false)
          setEmailInvoice(null)
        }}
        invoice={emailInvoice}
      />

      {showCreateModal ? (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <article className="invoice-modal">
            <header className="invoice-modal-head">
              <h3>
                <span className="notify-section-ic">
                  <FileText size={14} />
                </span>
                Create New Invoice
              </h3>
              <button type="button" className="topnav-icon" onClick={() => setShowCreateModal(false)}>
                <X size={16} />
              </button>
            </header>

            <div className="invoice-modal-body">
              <div className="invoice-grid-2">
                <label className="notify-field">
                  <span>Invoice Date</span>
                  <div className="notify-input-with-icon">
                    <CalendarDays size={14} />
                    <input
                      type="date"
                      value={form.invoiceDate}
                      onChange={(e) => setForm((prev) => ({ ...prev, invoiceDate: e.target.value }))}
                    />
                  </div>
                </label>
                <label className="notify-field">
                  <span>Due Date</span>
                  <div className="notify-input-with-icon">
                    <Clock3 size={14} />
                    <input
                      type="date"
                      value={form.dueDate}
                      onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))}
                    />
                  </div>
                </label>
              </div>

              <div className="invoice-line-items">
                <h4>Line Items</h4>
                <div className="invoice-line-head">
                  <span>Item Description</span>
                  <span>Qty</span>
                  <span>Price ($)</span>
                  <span>Tax (%)</span>
                  <span></span>
                </div>
                {form.lineItems.map((item, idx) => (
                  <div className="invoice-line-row" key={`line-${idx}`}>
                    <input
                      placeholder="e.g. Monthly Maintenance"
                      value={item.description}
                      onChange={(e) => updateLineItem(idx, 'description', e.target.value)}
                    />
                    <input
                      type="number"
                      min="1"
                      value={item.qty}
                      onChange={(e) => updateLineItem(idx, 'qty', e.target.value)}
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.price}
                      onChange={(e) => updateLineItem(idx, 'price', e.target.value)}
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.tax}
                      onChange={(e) => updateLineItem(idx, 'tax', e.target.value)}
                    />
                    <button
                      type="button"
                      className="invoice-line-delete"
                      onClick={() => deleteLineItem(idx)}
                      title="Delete line item"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" className="link-btn" onClick={addLineItem}>
                + Add Another Line Item
              </button>

              <label className="notify-field">
                <span>Additional Notes</span>
                <textarea
                  placeholder="Payment instructions, terms, or internal comments..."
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                />
              </label>

              <div className="invoice-total-box">
                <p>
                  <span>Subtotal</span>
                  <b>{formatMoney(summary.subtotal)}</b>
                </p>
                <p>
                  <span>Tax Amount</span>
                  <b>{formatMoney(summary.taxAmount)}</b>
                </p>
                <p className="invoice-total-due">
                  <span>Total Due</span>
                  <b>{formatMoney(summary.total)}</b>
                </p>
              </div>
            </div>

            <footer className="invoice-modal-foot">
              <button type="button" className="invoice-cancel-text" onClick={() => setShowCreateModal(false)}>
                Cancel
              </button>
              <button type="button" className="primary-btn" disabled={creating} onClick={onCreateInvoice}>
                {creating ? <Loader2 size={14} className="spin-icon" /> : <CheckCircle size={14} />}
                {creating ? 'Generating…' : 'Generate Invoice'}
              </button>
            </footer>
          </article>
        </div>
      ) : null}

      {successInvoice ? (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <article className="invoice-success-modal">
            <button type="button" className="invoice-success-close" onClick={() => setSuccessInvoice(null)}>
              <X size={16} />
            </button>
            <span className="invoice-success-icon">
              <CheckCircle2 size={28} />
            </span>
            <h3>Invoice Generated Successfully</h3>
            <p>The invoice has been created and is ready for processing.</p>

            <section className="invoice-summary-card">
              <h4>INVOICE SUMMARY</h4>
              <p>
                <span>Invoice ID</span>
                <b>{successInvoice.invoiceId}</b>
              </p>
              <p>
                <span>Client Name</span>
                <b>{successInvoice.clientName}</b>
              </p>
              <p>
                <span>Amount</span>
                <b>{formatMoney(successInvoice.amount)}</b>
              </p>
              <p>
                <span>Due Date</span>
                <b>{formatInputDate(successInvoice.dueDate)}</b>
              </p>
            </section>

            <div className="invoice-success-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() =>
                  navigate(`/company/${companyId}/billing-history/${successInvoice.id}`, {
                    state: { company, invoice: successInvoice },
                  })
                }
              >
                <FileText size={14} /> View Invoice PDF
              </button>
              <button
                type="button"
                className="primary-btn"
                onClick={() => openEmailModal(successInvoice)}
              >
                <Mail size={14} /> Email to Client
              </button>
            </div>

            <button type="button" className="link-btn" onClick={() => setSuccessInvoice(null)}>
              ← Return to Billing History
            </button>
          </article>
        </div>
      ) : null}

      {emailModal.open ? (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <article className="invoice-email-modal">
            <header className="invoice-modal-head">
              <h3>
                <span className="notify-section-ic">
                  <Mail size={14} />
                </span>
                Email Invoice
              </h3>
              <button type="button" className="topnav-icon" onClick={() => setEmailModal({ open: false })}>
                <X size={16} />
              </button>
            </header>
            <div className="invoice-modal-body">
              <label className="notify-field">
                <span>To</span>
                <div className="email-chip-row">
                  <span className="email-chip">
                    <CircleDot size={12} /> {emailModal.to}
                  </span>
                </div>
              </label>
              <label className="notify-field">
                <span>Subject</span>
                <input
                  value={emailModal.subject}
                  onChange={(e) => setEmailModal((prev) => ({ ...prev, subject: e.target.value }))}
                />
              </label>
              <label className="notify-field">
                <span>Message</span>
                <div className="notify-editor">
                  <div className="notify-toolbar">
                    <button type="button">B</button>
                    <button type="button">I</button>
                    <button type="button">
                      <Link2 size={12} />
                    </button>
                  </div>
                  <textarea
                    className="invoice-email-textarea"
                    value={emailModal.message}
                    onChange={(e) => setEmailModal((prev) => ({ ...prev, message: e.target.value }))}
                  />
                </div>
              </label>
              <div className="email-attachments">
                <small>Attachments (1)</small>
                <article>
                  <FileText size={14} />
                  <div>
                    <b>{emailModal.attachmentName}</b>
                    <span>PDF Document</span>
                  </div>
                  <button
                    type="button"
                    className="topnav-icon"
                    onClick={() =>
                      toast.push({ type: 'info', title: 'Locked', message: 'Invoice attachment is required.' })
                    }
                  >
                    <X size={14} />
                  </button>
                </article>
              </div>
            </div>
            <footer className="invoice-modal-foot">
              <button type="button" className="secondary-btn" onClick={() => setEmailModal({ open: false })}>
                Cancel
              </button>
              <button type="button" className="primary-btn" disabled={sendingEmail} onClick={onSendEmail}>
                {sendingEmail ? 'Sending…' : 'Send Email'}
              </button>
            </footer>
          </article>
        </div>
      ) : null}

      <footer className="billing-page-foot">SAFETYMATE ADMINISTRATION DASHBOARD © 2026</footer>
    </section>
  )
}
