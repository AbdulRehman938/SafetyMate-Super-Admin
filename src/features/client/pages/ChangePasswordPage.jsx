import { useState } from 'react'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { app } from '../../../config/firebase.js'
import { useAuth } from '../../../app/providers/authContext.js'
import { useToast } from '../../../shared/toast/toastContext.js'
import { AlertCircle, Eye, EyeOff, Lock, CheckCircle2, ArrowRight } from 'lucide-react'

export function ChangePasswordPage() {
  const { authUser } = useAuth()
  const toast = useToast()
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const changePasswordSchema = Yup.object().shape({
    currentPassword: Yup.string()
      .required('Current password is required'),
    newPassword: Yup.string()
      .min(8, 'Password must be at least 8 characters')
      .matches(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .matches(/[a-z]/, 'Password must contain at least one lowercase letter')
      .matches(/[0-9]/, 'Password must contain at least one number')
      .required('New password is required'),
    confirmPassword: Yup.string()
      .oneOf([Yup.ref('newPassword'), null], 'Passwords must match')
      .required('Please confirm your new password'),
  })

  const formik = useFormik({
    initialValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
    validationSchema: changePasswordSchema,
    onSubmit: async (values, { setSubmitting }) => {
      setError('')
      setSuccess(false)

      try {
        const functions = getFunctions(app)
        const changePassword = httpsCallable(functions, 'changePassword')
        await changePassword({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        })
        setSuccess(true)
        
        // Reset form after successful change
        formik.resetForm()
        
        // Clear success message after 5 seconds
        setTimeout(() => {
          setSuccess(false)
        }, 5000)
      } catch (err) {
        const errorMessage = err?.message || 'Failed to change password. Please try again.'
        setError(errorMessage)
      } finally {
        setSubmitting(false)
      }
    },
  })

  return (
    <div className="dashboard-content">
      <div className="dash-title-wrap">
        <p className="subtle">SETTINGS</p>
        <h1>Change Password</h1>
      </div>

      <article className="dashboard-card">
        <div style={{ maxWidth: '500px' }}>
          <p style={{ marginBottom: '24px', color: 'rgba(203,214,255,0.7)', fontSize: '14px' }}>
            Update your password to keep your account secure. Make sure to use a strong password that you don't use elsewhere.
          </p>

          {success ? (
            <div style={{ 
              padding: '16px', 
              background: 'rgba(77,235,160,0.1)', 
              border: '1px solid rgba(77,235,160,0.3)', 
              borderRadius: '8px',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <CheckCircle2 size={20} style={{ color: '#4deba0' }} />
              <span style={{ color: '#4deba0', fontSize: '14px' }}>
                Password changed successfully!
              </span>
            </div>
          ) : null}

          <form onSubmit={formik.handleSubmit}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px', 
                fontSize: '13px', 
                fontWeight: 500,
                color: 'rgba(235,242,255,0.9)'
              }}>
                Current Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={formik.values.currentPassword}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  name="currentPassword"
                  placeholder="Enter your current password"
                  style={{
                    width: '100%',
                    padding: '12px 40px 12px 12px',
                    background: 'rgba(10,15,30,0.6)',
                    border: '1px solid rgba(58,130,255,0.3)',
                    borderRadius: '6px',
                    color: '#ffffff',
                    fontSize: '14px',
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'rgba(148,163,184,0.7)',
                    cursor: 'pointer',
                    padding: '4px',
                  }}
                >
                  {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {formik.touched.currentPassword && formik.errors.currentPassword ? (
                <div style={{ 
                  marginTop: '6px', 
                  fontSize: '12px', 
                  color: '#f87171',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <AlertCircle size={12} />
                  {formik.errors.currentPassword}
                </div>
              ) : null}
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px', 
                fontSize: '13px', 
                fontWeight: 500,
                color: 'rgba(235,242,255,0.9)'
              }}>
                New Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={formik.values.newPassword}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  name="newPassword"
                  placeholder="Enter your new password"
                  style={{
                    width: '100%',
                    padding: '12px 40px 12px 12px',
                    background: 'rgba(10,15,30,0.6)',
                    border: '1px solid rgba(58,130,255,0.3)',
                    borderRadius: '6px',
                    color: '#ffffff',
                    fontSize: '14px',
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'rgba(148,163,184,0.7)',
                    cursor: 'pointer',
                    padding: '4px',
                  }}
                >
                  {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {formik.touched.newPassword && formik.errors.newPassword ? (
                <div style={{ 
                  marginTop: '6px', 
                  fontSize: '12px', 
                  color: '#f87171',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <AlertCircle size={12} />
                  {formik.errors.newPassword}
                </div>
              ) : null}
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px', 
                fontSize: '13px', 
                fontWeight: 500,
                color: 'rgba(235,242,255,0.9)'
              }}>
                Confirm New Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formik.values.confirmPassword}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  name="confirmPassword"
                  placeholder="Confirm your new password"
                  style={{
                    width: '100%',
                    padding: '12px 40px 12px 12px',
                    background: 'rgba(10,15,30,0.6)',
                    border: '1px solid rgba(58,130,255,0.3)',
                    borderRadius: '6px',
                    color: '#ffffff',
                    fontSize: '14px',
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'rgba(148,163,184,0.7)',
                    cursor: 'pointer',
                    padding: '4px',
                  }}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {formik.touched.confirmPassword && formik.errors.confirmPassword ? (
                <div style={{ 
                  marginTop: '6px', 
                  fontSize: '12px', 
                  color: '#f87171',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <AlertCircle size={12} />
                  {formik.errors.confirmPassword}
                </div>
              ) : null}
            </div>

            {error ? (
              <div style={{ 
                marginBottom: '20px', 
                padding: '12px', 
                background: 'rgba(248,113,113,0.1)', 
                border: '1px solid rgba(248,113,113,0.3)', 
                borderRadius: '6px',
                fontSize: '13px',
                color: '#f87171',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertCircle size={16} />
                {error}
              </div>
            ) : null}

            <div style={{ 
              marginBottom: '24px', 
              padding: '16px', 
              background: 'rgba(58,130,255,0.1)', 
              borderRadius: '8px', 
              border: '1px solid rgba(58,130,255,0.25)' 
            }}>
              <p style={{ 
                margin: '0 0 8px', 
                fontSize: '13px', 
                color: 'rgba(235,242,255,0.85)', 
                fontWeight: 600 
              }}>
                Password Requirements:
              </p>
              <ul style={{ 
                margin: 0, 
                paddingLeft: '20px', 
                fontSize: '13px', 
                color: 'rgba(203,214,255,0.7)' 
              }}>
                <li>At least 8 characters</li>
                <li>At least one uppercase letter</li>
                <li>At least one lowercase letter</li>
                <li>At least one number</li>
              </ul>
            </div>

            <button
              type="submit"
              disabled={formik.isSubmitting}
              style={{
                background: '#3a82ff',
                color: '#ffffff',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: formik.isSubmitting ? 'not-allowed' : 'pointer',
                opacity: formik.isSubmitting ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {formik.isSubmitting ? (
                'Changing Password…'
              ) : (
                <>
                  Change Password
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        </div>
      </article>
    </div>
  )
}
