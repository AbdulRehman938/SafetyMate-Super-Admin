import { useState } from 'react'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { app } from '../../../config/firebase.js'
import { AlertCircle, Eye, EyeOff, Lock, CheckCircle2, ArrowRight } from 'lucide-react'

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const resetToken = searchParams.get('token')

  const resetSchema = Yup.object().shape({
    password: Yup.string()
      .min(8, 'Password must be at least 8 characters')
      .matches(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .matches(/[a-z]/, 'Password must contain at least one lowercase letter')
      .matches(/[0-9]/, 'Password must contain at least one number')
      .required('Password is required'),
    confirmPassword: Yup.string()
      .oneOf([Yup.ref('password'), null], 'Passwords must match')
      .required('Please confirm your password'),
  })

  const formik = useFormik({
    initialValues: {
      password: '',
      confirmPassword: '',
    },
    validationSchema: resetSchema,
    onSubmit: async (values, { setSubmitting }) => {
      setError('')
      setSuccess(false)

      if (!resetToken) {
        setError('Invalid reset link. Please contact your administrator.')
        setSubmitting(false)
        return
      }

      try {
        const functions = getFunctions(app)
        const completePasswordReset = httpsCallable(functions, 'completePasswordReset')
        await completePasswordReset({
          resetToken,
          password: values.password,
        })
        setSuccess(true)
        
        // Redirect to login after 3 seconds
        setTimeout(() => {
          window.location.href = '/login'
        }, 3000)
      } catch (err) {
        const errorMessage = err?.message || 'Failed to reset password. Please try again.'
        
        if (errorMessage.includes('expired')) {
          setError('This reset link has expired. Please request a new password reset from the login page.')
        } else if (errorMessage.includes('already been used')) {
          setError('This reset link has already been used. You can now log in with your password.')
          setTimeout(() => {
            window.location.href = '/login'
          }, 3000)
        } else {
          setError(errorMessage)
        }
      } finally {
        setSubmitting(false)
      }
    },
  })

  if (!resetToken) {
    return (
      <section className="login-shell">
        <div className="login-content-wrap">
          <header className="login-header">
            <img className="login-logo-img" src="/logo.png" alt="SafetyMate" />
            <h1 className="login-brand">
              <span className="brand-safety">Safety</span>
              <span className="brand-mate">Mate</span>
            </h1>
          </header>

          <article className="panel login-card">
            <div className="login-error" role="alert">
              <AlertCircle size={16} />
              <span>Invalid reset link. Please contact your administrator.</span>
            </div>
          </article>
        </div>
      </section>
    )
  }

  if (success) {
    return (
      <section className="login-shell">
        <div className="login-content-wrap">
          <header className="login-header">
            <img className="login-logo-img" src="/logo.png" alt="SafetyMate" />
            <h1 className="login-brand">
              <span className="brand-safety">Safety</span>
              <span className="brand-mate">Mate</span>
            </h1>
          </header>

          <article className="panel login-card">
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <CheckCircle2 size={64} style={{ color: '#4deba0', marginBottom: '24px' }} />
              <h2 style={{ marginBottom: '16px', color: '#ffffff' }}>Password Reset Successfully!</h2>
              <p style={{ color: 'rgba(203,214,255,0.7)', marginBottom: '24px' }}>
                You can now log in with your email and new password.
              </p>
              <p style={{ color: 'rgba(148,163,184,0.7)', fontSize: '14px' }}>
                Redirecting to login page...
              </p>
            </div>
          </article>
        </div>
      </section>
    )
  }

  return (
    <section className="login-shell">
      <div className="login-content-wrap">
        <header className="login-header">
          <img className="login-logo-img" src="/logo.png" alt="SafetyMate" />
          <h1 className="login-brand">
            <span className="brand-safety">Safety</span>
            <span className="brand-mate">Mate</span>
          </h1>
          <p className="login-kicker">RESET YOUR PASSWORD</p>
        </header>

        <article className="panel login-card">
          <h2 className="login-title">Create New Password</h2>
          <p className="login-subtitle">Secure your account with a new password</p>

          <form className="login-form" onSubmit={formik.handleSubmit}>
            <div className="form-group">
              <label htmlFor="reset-password">New Password</label>
              <div className="input-with-icon">
                <Lock size={16} className="input-icon" />
                <input
                  id="reset-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
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

            <div className="form-group">
              <label htmlFor="reset-confirm-password">Confirm New Password</label>
              <div className="input-with-icon">
                <Lock size={16} className="input-icon" />
                <input
                  id="reset-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  {...formik.getFieldProps('confirmPassword')}
                  onChange={(e) => {
                    if (error) setError('')
                    formik.handleChange(e)
                  }}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div
                className={`field-error ${
                  formik.touched.confirmPassword && formik.errors.confirmPassword ? 'is-visible' : ''
                }`}
                role="alert"
              >
                <AlertCircle size={12} />
                <span>{formik.touched.confirmPassword && formik.errors.confirmPassword ? formik.errors.confirmPassword : '\u00A0'}</span>
              </div>
            </div>

            {error ? (
              <div className="login-error" role="alert" aria-live="polite">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            ) : null}

            <div style={{ margin: '20px 0', padding: '16px', background: 'rgba(58,130,255,0.1)', borderRadius: '8px', border: '1px solid rgba(58,130,255,0.25)' }}>
              <p style={{ margin: '0 0 8px', fontSize: '13px', color: 'rgba(235,242,255,0.85)', fontWeight: 600 }}>
                Password Requirements:
              </p>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: 'rgba(203,214,255,0.7)' }}>
                <li>At least 8 characters</li>
                <li>At least one uppercase letter</li>
                <li>At least one lowercase letter</li>
                <li>At least one number</li>
              </ul>
            </div>

            <button className="primary-btn secure-signin-btn" type="submit" disabled={formik.isSubmitting}>
              {formik.isSubmitting ? (
                'Resetting Password…'
              ) : (
                <>
                  Reset Password
                  <ArrowRight size={16} className="btn-arrow" />
                </>
              )}
            </button>
          </form>
        </article>
      </div>
    </section>
  )
}
