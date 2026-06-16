import { sendPasswordResetEmail } from 'firebase/auth'
import { useState } from 'react'
import { auth } from '../../../config/firebase.js'
import { useAuth } from '../../../app/providers/authContext.js'
import { useToast } from '../../../shared/toast/toastContext.js'

export function SettingsPage() {
  const toast = useToast()
  const { authUser, profile } = useAuth()
  const [busy, setBusy] = useState(false)

  const email = authUser?.email || profile?.email || ''
  const name = profile?.fullName || profile?.name || '—'
  const role = profile?.role || '—'
  const orgId = profile?.organizationId ?? '—'

  async function onResetPassword() {
    if (!email) {
      toast.push({ type: 'error', title: 'Missing email', message: 'No email found for your account.' })
      return
    }
    setBusy(true)
    try {
      await sendPasswordResetEmail(auth, email)
      toast.push({ type: 'success', title: 'Email sent', message: 'Password reset email sent successfully.' })
    } catch (e) {
      toast.push({ type: 'error', title: 'Failed', message: e?.message || 'Could not send reset email.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="stack-gap">
      <header className="card-head">
        <div>
          <h2>Settings</h2>
          <p>Manage your admin account.</p>
        </div>
      </header>

      <article className="dashboard-card">
        <div className="form-grid-2">
          <label>
            Name
            <input value={name} readOnly />
          </label>
          <label>
            Email
            <input value={email || '—'} readOnly />
          </label>
          <label>
            Role
            <input value={role} readOnly />
          </label>
          <label>
            Organization ID
            <input value={String(orgId)} readOnly />
          </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
          <button type="button" className="primary-btn" disabled={busy} onClick={onResetPassword}>
            {busy ? 'Sending…' : 'Reset Password'}
          </button>
        </div>
      </article>
    </section>
  )
}

