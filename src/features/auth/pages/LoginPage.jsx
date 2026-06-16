import { useState, useRef, useEffect } from 'react'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../../../config/firebase.js'
import { AlertCircle, Eye, EyeOff, Lock, Mail, ArrowRight, HelpCircle } from 'lucide-react'

export function LoginPage({ initialError = '' }) {
  const [error, setError] = useState(initialError)
  const [showPassword, setShowPassword] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  const tooltipRef = useRef(null)

  useEffect(() => {
    if (!showTooltip) return
    function handleOutsideClick(e) {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target)) {
        setShowTooltip(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [showTooltip])

  const errorCopy = {
    'auth/too-many-requests':
      'Access temporarily blocked due to too many failed attempts. Please try again later.',
    'auth/wrong-password': 'Invalid email or password. Please try again.',
    'auth/user-not-found': 'Invalid email or password. Please try again.',
    'auth/invalid-credential': 'Invalid email or password. Please try again.',
  }

  const loginSchema = Yup.object().shape({
    email: Yup.string()
      .email('Please enter a valid email address')
      .required('Email address is required'),
    password: Yup.string()
      .min(6, 'Password must be at least 6 characters')
      .required('Password is required'),
  })

  const formik = useFormik({
    initialValues: {
      email: '',
      password: '',
    },
    validationSchema: loginSchema,
    onSubmit: async (values, { setSubmitting }) => {
      setError('')
      try {
        await signInWithEmailAndPassword(auth, values.email.trim(), values.password)
      } catch (err) {
        setError(errorCopy[err?.code] || err?.message || 'Could not sign you in. Please try again.')
      } finally {
        setSubmitting(false)
      }
    },
  })

  return (
    <section className="login-shell">
      {/* Top status bar */}
      <div className="login-topbar">
        <div className="login-topbar-left">
          <span className="pulse-dot" />
          <span>PROTOCOL ALPHA: ONLINE</span>
        </div>
        <div className="login-topbar-right">
          <Lock size={12} className="encrypted-lock" />
          <span>END-TO-END ENCRYPTED</span>
          <span className="divider">|</span>
          <div className="help-icon-wrap" ref={tooltipRef}>
            <button
              type="button"
              className="help-icon-btn"
              aria-label="Learn about end-to-end encryption"
              onClick={() => setShowTooltip((v) => !v)}
              onMouseEnter={() => setShowTooltip(true)}
            >
              <HelpCircle size={14} />
            </button>
            {showTooltip && (
              <div className="encrypt-tooltip" role="tooltip">
                <div className="encrypt-tooltip-header">
                  <Lock size={13} />
                  <span>End-to-End Encryption</span>
                </div>
                <p className="encrypt-tooltip-body">
                  All data transmitted between your browser and SafetyMate servers is encrypted using <strong>TLS 1.3</strong> and <strong>AES-256</strong>. Your credentials are never stored in plain text.
                </p>
                <ul className="encrypt-tooltip-list">
                  <li>✓ Credentials encrypted in transit</li>
                  <li>✓ Zero plain-text password storage</li>
                  <li>✓ Session tokens expire automatically</li>
                  <li>✓ Firewall-protected backend access</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main container */}
      <div className="login-content-wrap">
        <header className="login-header">
          <img className="login-logo-img" src="/logo.png" alt="SafetyMate" />
          <h1 className="login-brand">
            <span className="brand-safety">Safety</span>
            <span className="brand-mate">Mate</span>
          </h1>
          <p className="login-kicker">SINGLE ADMINISTRATOR ACCESS ONLY</p>
          <p className="login-node">SYSTEM NODE: CORE-01</p>
        </header>

        <article className="panel login-card">
          <h2 className="login-title">Secure Sign In</h2>
          <p className="login-subtitle">Enter your credentials to access the portal</p>

          <form className="login-form" onSubmit={formik.handleSubmit}>
            <div className="form-group">
              <label htmlFor="login-email">Company Email</label>
              <div className="input-with-icon">
                <Mail size={16} className="input-icon" />
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@company.com"
                  {...formik.getFieldProps('email')}
                  onChange={(e) => {
                    if (error) setError('')
                    formik.handleChange(e)
                  }}
                />
              </div>
              <div
                className={`field-error ${
                  formik.touched.email && formik.errors.email ? 'is-visible' : ''
                }`}
                role="alert"
              >
                <AlertCircle size={12} />
                <span>{formik.touched.email && formik.errors.email ? formik.errors.email : '\u00A0'}</span>
              </div>
            </div>

            <div className="form-group">
              <div className="label-row">
                <label htmlFor="login-password">Password</label>
                <a href="#forgot" className="forgot-link" onClick={(e) => e.preventDefault()}>
                  Forgot Password?
                </a>
              </div>
              <div className="input-with-icon">
                <Lock size={16} className="input-icon" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  {...formik.getFieldProps('password')}
                  onChange={(e) => {
                    if (error) setError('')
                    formik.handleChange(e)
                  }}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div
                className={`field-error ${
                  formik.touched.password && formik.errors.password ? 'is-visible' : ''
                }`}
                role="alert"
              >
                <AlertCircle size={12} />
                <span>{formik.touched.password && formik.errors.password ? formik.errors.password : '\u00A0'}</span>
              </div>
            </div>

            {error ? (
              <div className="login-error" role="alert" aria-live="polite">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            ) : null}

            <button className="primary-btn secure-signin-btn" type="submit" disabled={formik.isSubmitting}>
              {formik.isSubmitting ? (
                'Signing in…'
              ) : (
                <>
                  Secure Sign In
                  <ArrowRight size={16} className="btn-arrow" />
                </>
              )}
            </button>
          </form>
        </article>

        {/* Footer messages */}
        <footer className="login-footer">
          <p className="warning-text">WARNING: UNAUTHORIZED ACCESS IS STRICTLY PROHIBITED</p>
        </footer>
      </div>

      <div className="bottom-copyright">
        © 2026 SECURE SYSTEMS PROTOCOL
      </div>
    </section>
  )
}

