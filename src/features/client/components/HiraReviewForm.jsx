import { useState } from 'react'
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '../../../config/firebase.js'

/**
 * Reusable HIRA review (approve / send back for revision).
 * Expects a `hira` object with at least { id, siteName? }.
 */
export function HiraReviewForm({ hira, onDone, onToast }) {
  const [feedback, setFeedback] = useState('')
  const [busy, setBusy] = useState(false)

  async function approve() {
    if (!hira?.id) return
    setBusy(true)
    try {
      // TODO: Wire to Firestore where('organizationId', '==', orgId) — enforce via rules
      await updateDoc(doc(db, 'hira_assessments', hira.id), {
        status: 'approved',
        approvedAt: serverTimestamp(),
      })
      onToast?.({ tone: 'success', message: 'HIRA approved.' })
      onDone?.()
    } catch {
      onToast?.({ tone: 'error', message: 'Could not approve HIRA.' })
    } finally {
      setBusy(false)
    }
  }

  async function sendBack(e) {
    e.preventDefault()
    if (!hira?.id) return
    if (!feedback.trim()) {
      onToast?.({ tone: 'error', message: 'Manager Feedback is required.' })
      return
    }
    setBusy(true)
    try {
      // TODO: Wire to Firestore where('organizationId', '==', orgId) — enforce via rules
      await updateDoc(doc(db, 'hira_assessments', hira.id), {
        status: 'revision_required',
        managerFeedback: feedback.trim(),
        reviewedAt: serverTimestamp(),
      })
      onToast?.({ tone: 'success', message: 'Sent back for revision.' })
      onDone?.()
    } catch {
      onToast?.({ tone: 'error', message: 'Could not send back.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="client-drawer-form">
      <p className="client-drawer-summary">
        HIRA Review for <b>{hira?.siteName || 'Site'}</b>
      </p>
      <div className="client-drawer-split">
        <button
          type="button"
          className="client-btn client-btn--success client-btn--wide"
          onClick={approve}
          disabled={busy}
        >
          Confirm Approval
        </button>
        <button
          type="button"
          className="client-btn client-btn--danger client-btn--wide"
          onClick={() => {
            const el = document.getElementById('client-manager-feedback')
            el?.focus?.()
          }}
          disabled={busy}
        >
          Send Back for Revision
        </button>
      </div>

      <form className="client-drawer-form" onSubmit={sendBack}>
        <label htmlFor="client-manager-feedback">Manager Feedback</label>
        <textarea
          id="client-manager-feedback"
          name="managerFeedback"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="What needs to be corrected before approval?"
          required
          disabled={busy}
        />
        <button type="submit" className="client-btn client-btn--danger" disabled={busy}>
          Send Back
        </button>
      </form>
    </div>
  )
}

