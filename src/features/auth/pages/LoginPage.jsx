import { useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../../../config/firebase.js'
import { AlertCircle } from 'lucide-react'

export function LoginPage({ initialError = '' }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(initialError)

  const errorCopy = {
    'auth/too-many-requests':
      'Access temporarily blocked due to too many failed attempts. Please try again later.',
    'auth/wrong-password': 'Invalid email or password. Please try again.',
    'auth/user-not-found': 'Invalid email or password. Please try again.',
    'auth/invalid-credential': 'Invalid email or password. Please try again.',
  }

  async function onSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password)
    } catch (err) {
      setError(errorCopy[err?.code] || err?.message || 'Could not sign you in. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="login-shell">
      <article className="panel login-card">
        <img className="login-logo" src="/logo.png" alt="SafetyMate" />
        <h1>Safety Mate Admin</h1>
        <p className="subtle">Sign in to continue.</p>

        <form className="login-form" onSubmit={onSubmit}>
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => {
                if (error) setError('')
                setEmail(e.target.value)
              }}
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => {
                if (error) setError('')
                setPassword(e.target.value)
              }}
              required
            />
          </label>

          {error ? (
            <div className="login-error" role="alert" aria-live="polite">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          ) : null}

          <button className="primary-btn login-btn" type="submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </article>
    </section>
  )
}
