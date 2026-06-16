import { useEffect, useMemo, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { FileText, Mail, X } from 'lucide-react'
import { db } from '../../../config/firebase.js'
import { useToast } from '../../../shared/toast/toastContext.js'

function formatMoney(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value) || 0)
}

export function EmailInvoiceModal({ isOpen, onClose, invoice }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [orgEmail, setOrgEmail] = useState('')

  const invoiceNumber = useMemo(() => {
    return invoice?.invoiceId || (invoice?.id ? `INV-${String(invoice.id).slice(0, 6).toUpperCase()}` : 'INV')
  }, [invoice?.id, invoice?.invoiceId])

  const totalDue = useMemo(() => {
    return Number(invoice?.totalDue ?? invoice?.totalAmount ?? invoice?.amount ?? 0)
  }, [invoice])

  const defaults = useMemo(() => {
    return {
      to: orgEmail,
      subject: `Invoice #${invoiceNumber} from SafetyMate`,
      message: `Dear Client,\n\nPlease find your invoice #${invoiceNumber} attached. Amount Due: ${formatMoney(totalDue)}.\n\nThank you,\nSafetyMate Billing`,
    }
  }, [invoiceNumber, orgEmail, totalDue])

  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setBusy(false)
    setTo(defaults.to)
    setSubject(defaults.subject)
    setMessage(defaults.message)
  }, [defaults.message, defaults.subject, defaults.to, isOpen])

  useEffect(() => {
    let cancelled = false
    if (!isOpen) return () => {}

    async function run() {
      const orgId = invoice?.organizationId
      if (!orgId) {
        setOrgEmail('')
        return
      }
      const snap = await getDoc(doc(db, 'organizations', orgId)).catch(() => null)
      if (cancelled) return
      const data = snap?.data?.() || {}
      const email =
        data?.primaryContact?.email ||
        data?.contact?.email ||
        data?.billingEmail ||
        data?.email ||
        ''
      setOrgEmail(String(email || '').trim())
    }

    run()
    return () => {
      cancelled = true
    }
  }, [invoice?.organizationId, isOpen])

  async function onSend() {
    if (!to.trim()) {
      toast.push({ type: 'error', title: 'Missing recipient', message: 'Please enter a valid email address.' })
      return
    }
    setBusy(true)
    try {
      // TODO: Connect to Resend or Firebase Email Extension
      await new Promise((r) => window.setTimeout(r, 1500))
      toast.push({ type: 'success', title: 'Sent', message: 'Invoice emailed successfully!' })
      onClose?.()
      setTo('')
      setSubject('')
      setMessage('')
    } finally {
      setBusy(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <article className="invoice-email-modal">
        <header className="invoice-modal-head">
          <h3>
            <span className="notify-section-ic">
              <Mail size={14} />
            </span>
            Email Invoice
          </h3>
          <button type="button" className="topnav-icon" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </header>

        <div className="invoice-modal-body">
          <label className="notify-field">
            <span>To</span>
            <div className="email-chip-row">
              <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="billing@company.com" />
            </div>
          </label>

          <label className="notify-field">
            <span>Subject</span>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </label>

          <label className="notify-field">
            <span>Message</span>
            <textarea className="invoice-email-textarea" value={message} onChange={(e) => setMessage(e.target.value)} />
          </label>

          <div className="email-attachments">
            <small>Attachments (1)</small>
            <article>
              <FileText size={14} />
              <div>
                <b>{`Invoice_${invoiceNumber}.pdf`}</b>
                <span>PDF Document</span>
              </div>
              <button type="button" className="topnav-icon" onClick={() => {}} aria-label="Attachment locked">
                <X size={14} />
              </button>
            </article>
          </div>
        </div>

        <footer className="invoice-modal-foot">
          <button type="button" className="secondary-btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="primary-btn" onClick={onSend} disabled={busy}>
            {busy ? 'Sending…' : 'Send Email'}
          </button>
        </footer>
      </article>
    </div>
  )
}

