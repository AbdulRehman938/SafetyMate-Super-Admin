import { useState } from 'react'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import { ArrowLeft, User, Lock, Camera, CheckCircle, XCircle, Save } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '../../../config/firebase.js'
import { useAuth } from '../../../app/providers/authContext.js'
import { initials, avatarColor } from '../utils/fdHelpers.js'
import '../fd.css'

/* ── Yup schemas ── */
const profileSchema = Yup.object({
  fullName: Yup.string().trim().required('Full name is required').min(2, 'Min 2 characters').max(80),
  phone:    Yup.string().trim().max(30, 'Max 30 characters').nullable(),
})

const passwordSchema = Yup.object({
  currentPassword: Yup.string().required('Current password is required'),
  newPassword:     Yup.string().required('New password is required').min(8, 'Min 8 characters')
    .matches(/[A-Z]/, 'Must contain uppercase')
    .matches(/[0-9]/, 'Must contain a number'),
  confirmPassword: Yup.string()
    .required('Confirm your new password')
    .oneOf([Yup.ref('newPassword')], 'Passwords do not match'),
})

export function FDProfilePage() {
  const navigate                = useNavigate()
  const { authUser, profile }   = useAuth()
  const [profileMsg, setProfileMsg] = useState(null)  // { type, text }
  const [passMsg,    setPassMsg]    = useState(null)

  const displayName = profile?.fullName || profile?.name || authUser?.email || '—'
  const avi         = initials(displayName)
  const aviBg       = avatarColor(displayName)
  const role        = profile?.role || 'FIRE_DETECTION'
  const avatarImg   = profile?.avatar || null

  /* ── Profile form ── */
  const profileFormik = useFormik({
    enableReinitialize: true,
    initialValues: {
      fullName: profile?.fullName || profile?.name || '',
      phone:    profile?.phone    || profile?.contactNumber || '',
    },
    validationSchema: profileSchema,
    validateOnBlur:   true,
    validateOnChange: false,
    onSubmit: async (values) => {
      if (!authUser) return
      try {
        await updateDoc(doc(db, 'user_profiles', authUser.uid), {
          fullName:  values.fullName.trim(),
          phone:     values.phone.trim() || null,
          updatedAt: serverTimestamp(),
        })
        setProfileMsg({ type: 'ok', text: 'Profile updated successfully.' })
        setTimeout(() => setProfileMsg(null), 4000)
      } catch {
        setProfileMsg({ type: 'err', text: 'Failed to update profile. Please try again.' })
      }
    },
  })

  /* ── Password form ── */
  const passFormik = useFormik({
    initialValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
    validationSchema: passwordSchema,
    validateOnBlur:   true,
    validateOnChange: false,
    onSubmit: async (values, { resetForm }) => {
      if (!authUser) return
      try {
        const cred = EmailAuthProvider.credential(authUser.email, values.currentPassword)
        await reauthenticateWithCredential(auth.currentUser, cred)
        await updatePassword(auth.currentUser, values.newPassword)
        resetForm()
        setPassMsg({ type: 'ok', text: 'Password changed successfully.' })
        setTimeout(() => setPassMsg(null), 4000)
      } catch (err) {
        const msg = err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential'
          ? 'Current password is incorrect.'
          : 'Failed to update password. Please try again.'
        setPassMsg({ type: 'err', text: msg })
      }
    },
  })

  const pF = profileFormik
  const pwF = passFormik

  return (
    <div className="fd-profile-page">

      {/* Back */}
      <button type="button" onClick={() => navigate(-1)}
        style={{ display:'flex', alignItems:'center', gap:7, background:'none', border:'none',
          color:'rgba(148,163,184,0.7)', cursor:'pointer', fontSize:13, fontWeight:700,
          padding:'4px 0', marginBottom:20, transition:'color 0.15s' }}
        onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
        onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(148,163,184,0.7)'}>
        <ArrowLeft size={16} /> Back
      </button>

      <h1 style={{ margin:'0 0 6px', fontSize:'clamp(1.2rem,2.5vw,1.5rem)', fontWeight:900,
        color:'rgba(235,242,255,0.97)', letterSpacing:'-0.025em' }}>
        Profile Settings
      </h1>
      <p style={{ margin:'0 0 26px', fontSize:13, color:'rgba(148,163,184,0.65)' }}>
        Manage your account details and security credentials.
      </p>

      <div className="fd-profile-grid">

        {/* ── Left: avatar card ── */}
        <div className="fd-card" style={{ padding:28, display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', gap:14 }}>
          <div style={{ position:'relative', width:96, height:96 }}>
            <div style={{ width:96, height:96, borderRadius:'50%', background:aviBg,
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:28, fontWeight:800, color:'#fff',
              border:'3px solid rgba(58,130,255,0.4)', overflow:'hidden' }}>
              {avatarImg
                ? <img src={avatarImg} alt={displayName} style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={(e) => { e.target.style.display='none' }} />
                : avi}
            </div>
            {/* avatar edit hint */}
            <div style={{ position:'absolute', bottom:0, right:0, width:28, height:28, borderRadius:'50%',
              background:'#3a82ff', display:'flex', alignItems:'center', justifyContent:'center',
              border:'2px solid #080d1a', cursor:'pointer' }}>
              <Camera size={13} style={{ color:'#fff' }} />
            </div>
          </div>

          <div>
            <p style={{ margin:'0 0 4px', fontSize:16, fontWeight:800, color:'rgba(235,242,255,0.97)' }}>{displayName}</p>
            <p style={{ margin:'0 0 4px', fontSize:11, fontWeight:800, color:'#3a82ff', letterSpacing:'0.07em', textTransform:'uppercase' }}>
              {role === 'FIRE_DETECTION' ? 'Fire Detection Technician' : role}
            </p>
            <p style={{ margin:0, fontSize:12, color:'rgba(148,163,184,0.5)' }}>{authUser?.email || '—'}</p>
          </div>

          <div style={{ width:'100%', padding:'14px 0 0', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', fontSize:12 }}>
              <span style={{ color:'rgba(148,163,184,0.55)', fontWeight:700 }}>UID</span>
              <span style={{ color:'rgba(235,242,255,0.6)', fontFamily:'monospace', fontSize:11 }}>
                {authUser?.uid?.slice(0,12)}…
              </span>
            </div>
          </div>
        </div>

        {/* ── Right: forms ── */}
        <div style={{ display:'flex', flexDirection:'column', gap:18 }}>

          {/* Personal Info */}
          <div className="fd-card" style={{ padding:24 }}>
            <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:20, paddingBottom:14, borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ width:30, height:30, borderRadius:8, background:'rgba(58,130,255,0.1)', border:'1px solid rgba(58,130,255,0.22)', display:'flex', alignItems:'center', justifyContent:'center', color:'#5ba8ff' }}>
                <User size={14} />
              </div>
              <span style={{ fontSize:12, fontWeight:800, color:'rgba(235,242,255,0.88)', letterSpacing:'0.07em', textTransform:'uppercase' }}>
                Personal Information
              </span>
            </div>

            {profileMsg && (
              <div className={profileMsg.type === 'ok' ? 'fd-toast-ok' : 'fd-toast-err'}>
                {profileMsg.type === 'ok' ? <CheckCircle size={14} /> : <XCircle size={14} />}
                {profileMsg.text}
              </div>
            )}

            <form onSubmit={pF.handleSubmit} noValidate>
              <div className="fd-form-grid">
                <div className="fd-form-group">
                  <label className="fd-form-label" htmlFor="fd-fullName">FULL NAME *</label>
                  <input id="fd-fullName" type="text" className={`fd-form-input${pF.errors.fullName && pF.touched.fullName ? ' fd-form-input--err' : ''}`}
                    {...pF.getFieldProps('fullName')} />
                  {pF.errors.fullName && pF.touched.fullName && <span className="fd-field-err">{pF.errors.fullName}</span>}
                </div>
                <div className="fd-form-group">
                  <label className="fd-form-label" htmlFor="fd-phone">PHONE NUMBER</label>
                  <input id="fd-phone" type="tel" className="fd-form-input" placeholder="+27 xx xxx xxxx"
                    {...pF.getFieldProps('phone')} />
                  {pF.errors.phone && pF.touched.phone && <span className="fd-field-err">{pF.errors.phone}</span>}
                </div>
              </div>

              <div style={{ display:'flex', justifyContent:'flex-end', marginTop:6 }}>
                <button type="submit" className="fd-btn fd-btn--primary" disabled={pF.isSubmitting}>
                  {pF.isSubmitting ? <span className="fd-spinner" style={{ width:14, height:14 }} /> : <Save size={13} />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>

          {/* Change Password */}
          <div className="fd-card" style={{ padding:24 }}>
            <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:20, paddingBottom:14, borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ width:30, height:30, borderRadius:8, background:'rgba(58,130,255,0.1)', border:'1px solid rgba(58,130,255,0.22)', display:'flex', alignItems:'center', justifyContent:'center', color:'#5ba8ff' }}>
                <Lock size={14} />
              </div>
              <span style={{ fontSize:12, fontWeight:800, color:'rgba(235,242,255,0.88)', letterSpacing:'0.07em', textTransform:'uppercase' }}>
                Change Password
              </span>
            </div>

            {passMsg && (
              <div className={passMsg.type === 'ok' ? 'fd-toast-ok' : 'fd-toast-err'}>
                {passMsg.type === 'ok' ? <CheckCircle size={14} /> : <XCircle size={14} />}
                {passMsg.text}
              </div>
            )}

            <form onSubmit={pwF.handleSubmit} noValidate>
              <div className="fd-form-group">
                <label className="fd-form-label" htmlFor="fd-currPass">CURRENT PASSWORD *</label>
                <input id="fd-currPass" type="password" className={`fd-form-input${pwF.errors.currentPassword && pwF.touched.currentPassword ? ' fd-form-input--err' : ''}`}
                  {...pwF.getFieldProps('currentPassword')} />
                {pwF.errors.currentPassword && pwF.touched.currentPassword && <span className="fd-field-err">{pwF.errors.currentPassword}</span>}
              </div>

              <div className="fd-form-grid">
                <div className="fd-form-group">
                  <label className="fd-form-label" htmlFor="fd-newPass">NEW PASSWORD *</label>
                  <input id="fd-newPass" type="password" className={`fd-form-input${pwF.errors.newPassword && pwF.touched.newPassword ? ' fd-form-input--err' : ''}`}
                    {...pwF.getFieldProps('newPassword')} />
                  {pwF.errors.newPassword && pwF.touched.newPassword && <span className="fd-field-err">{pwF.errors.newPassword}</span>}
                </div>
                <div className="fd-form-group">
                  <label className="fd-form-label" htmlFor="fd-confPass">CONFIRM PASSWORD *</label>
                  <input id="fd-confPass" type="password" className={`fd-form-input${pwF.errors.confirmPassword && pwF.touched.confirmPassword ? ' fd-form-input--err' : ''}`}
                    {...pwF.getFieldProps('confirmPassword')} />
                  {pwF.errors.confirmPassword && pwF.touched.confirmPassword && <span className="fd-field-err">{pwF.errors.confirmPassword}</span>}
                </div>
              </div>

              <div style={{ display:'flex', justifyContent:'flex-end', marginTop:6 }}>
                <button type="submit" className="fd-btn fd-btn--primary" disabled={pwF.isSubmitting}>
                  {pwF.isSubmitting ? <span className="fd-spinner" style={{ width:14, height:14 }} /> : <Lock size={13} />}
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
