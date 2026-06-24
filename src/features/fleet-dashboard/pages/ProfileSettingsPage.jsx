import { useState, useEffect } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { updatePassword } from 'firebase/auth'
import { db } from '../../../config/firebase.js'
import { useAuth } from '../../../app/providers/authContext.js'
import { User, Shield, Key, Mail, Phone, Camera, Save, AlertCircle, CheckCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion' // eslint-disable-line no-unused-vars
import '../fleet.css'

export function ProfileSettingsPage() {
  const { authUser, profile } = useAuth()
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    avatar: ''
  })
  const [passwordData, setPasswordData] = useState({
    currentPassword: '', // just for completeness/UI
    newPassword: '',
    confirmPassword: ''
  })
  
  const [loading, setLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [passLoading, setPassLoading] = useState(false)
  const [passSuccessMsg, setPassSuccessMsg] = useState('')
  const [passErrorMsg, setPassErrorMsg] = useState('')

  // Seed form from profile — wrapped in timeout to avoid setState-in-effect
  useEffect(() => {
    if (!profile) return
    const t = setTimeout(() => {
      setFormData({
        fullName: profile.fullName || profile.name || '',
        email:    profile.email    || authUser?.email || '',
        phone:    profile.phone    || profile.contactNumber || '',
        avatar:   profile.avatar   || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&q=80',
      })
    }, 0)
    return () => clearTimeout(t)
  }, [profile, authUser])

  const handleProfileSubmit = async (e) => {
    e.preventDefault()
    if (!authUser) return
    setLoading(true)
    setSuccessMsg('')
    setErrorMsg('')
    try {
      const userRef = doc(db, 'user_profiles', authUser.uid)
      await updateDoc(userRef, {
        fullName: formData.fullName,
        phone: formData.phone,
        avatar: formData.avatar,
        updatedAt: new Date()
      })
      setSuccessMsg('Profile details updated successfully! Reloading page to apply changes.')
      setTimeout(() => {
        window.location.reload()
      }, 1500)
    } catch (err) {
      console.error(err)
      setErrorMsg(err.message || 'Error updating profile. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordSubmit = async (e) => {
    e.preventDefault()
    if (!authUser) return
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPassErrorMsg('New passwords do not match')
      return
    }
    if (passwordData.newPassword.length < 6) {
      setPassErrorMsg('Password should be at least 6 characters long')
      return
    }

    setPassLoading(true)
    setPassSuccessMsg('')
    setPassErrorMsg('')
    try {
      await updatePassword(authUser, passwordData.newPassword)
      setPassSuccessMsg('Password updated successfully!')
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (err) {
      console.error(err)
      setPassErrorMsg(err.message || 'Error updating password. If it has been a long time since your last sign-in, please sign out and sign back in to perform this operation.')
    } finally {
      setPassLoading(false)
    }
  }

  const handleAvatarChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setFormData((prev) => ({ ...prev, avatar: reader.result }))
      }
      reader.readAsDataURL(file)
    }
  }

  return (
    <div className="fleet-subpage" style={{ padding: '0 24px 28px', color: '#ffffff' }}>
      
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 className="fleet-subpage-title" style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.025em' }}>
          Profile Settings
        </h1>
        <p className="fleet-subpage-sub" style={{ margin: 0, fontSize: '13px', color: 'rgba(148, 163, 184, 0.7)', fontWeight: 600 }}>
          Manage your personal information, contact credentials, and security configurations.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px', alignItems: 'start' }}>
        
        {/* Left Side: Avatar Card */}
        <div className="fleet-section-card" style={{ padding: '24px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'relative', width: '120px', height: '120px', margin: '0 auto 20px', borderRadius: '50%', overflow: 'hidden', border: '2px solid rgba(58, 130, 255, 0.4)', boxShadow: '0 0 20px rgba(58, 130, 255, 0.15)' }}>
            <img 
              src={formData.avatar} 
              alt="Avatar" 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => {
                e.target.src = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&q=80'
              }}
            />
            <label style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              background: 'rgba(7, 12, 28, 0.75)',
              padding: '6px 0',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'opacity 0.2s'
            }}>
              <Camera size={14} style={{ color: '#ffffff' }} />
              <input type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: 'none' }} />
            </label>
          </div>

          <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 800 }}>{formData.fullName || 'User Profile'}</h3>
          <p style={{ margin: '0 0 16px', fontSize: '10.5px', fontWeight: 800, color: '#3a82ff', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            SITE SUPERVISOR
          </p>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(22, 201, 136, 0.08)', border: '1px solid rgba(22, 201, 136, 0.15)', color: '#4deba0', padding: '4px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: 800 }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#16c988' }} />
            CONNECTED TO DATABASE
          </div>
        </div>

        {/* Right Side: Account and Security forms */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Card 1: Account Information */}
          <div className="fleet-section-card" style={{ padding: '24px' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: '15px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px' }}>
              <User size={16} style={{ color: '#3a82ff' }} /> Personal Details
            </h3>

            <form onSubmit={handleProfileSubmit} noValidate>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '10px', fontWeight: 800, color: 'rgba(148, 163, 184, 0.6)', letterSpacing: '0.08em' }}>FULL NAME</label>
                  <input 
                    type="text" 
                    value={formData.fullName} 
                    onChange={(e) => setFormData(p => ({ ...p, fullName: e.target.value }))}
                    style={{
                      padding: '10px 12px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                    required
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '10px', fontWeight: 800, color: 'rgba(148, 163, 184, 0.6)', letterSpacing: '0.08em' }}>CONTACT NUMBER</label>
                  <div style={{ position: 'relative' }}>
                    <Phone size={13} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(148,163,184,0.4)' }} />
                    <input 
                      type="text" 
                      value={formData.phone} 
                      onChange={(e) => setFormData(p => ({ ...p, phone: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '10px 12px 10px 34px',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: '8px',
                        color: '#ffffff',
                        fontSize: '13px',
                        outline: 'none'
                      }}
                      placeholder="e.g. +27 82 123 4567"
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '24px' }}>
                <label style={{ fontSize: '10px', fontWeight: 800, color: 'rgba(148, 163, 184, 0.6)', letterSpacing: '0.08em' }}>EMAIL ADDRESS (READ-ONLY)</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={13} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(148,163,184,0.3)' }} />
                  <input 
                    type="email" 
                    value={formData.email} 
                    disabled
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 34px',
                      background: 'rgba(255,255,255,0.01)',
                      border: '1px solid rgba(255,255,255,0.03)',
                      borderRadius: '8px',
                      color: 'rgba(255,255,255,0.4)',
                      fontSize: '13px',
                      cursor: 'not-allowed',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              <AnimatePresence>
                {successMsg && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(22, 201, 136, 0.08)', border: '1px solid rgba(22, 201, 136, 0.15)', color: '#4deba0', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', marginBottom: '16px' }}>
                    <CheckCircle size={14} /> {successMsg}
                  </motion.div>
                )}
                {errorMsg && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255, 83, 95, 0.08)', border: '1px solid rgba(255, 83, 95, 0.15)', color: '#ff8080', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', marginBottom: '16px' }}>
                    <AlertCircle size={14} /> {errorMsg}
                  </motion.div>
                )}
              </AnimatePresence>

              <button 
                type="submit" 
                className="fleet-btn"
                disabled={loading}
                style={{
                  background: 'linear-gradient(135deg, #3a82ff, #1c5fb3)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#ffffff',
                  padding: '9px 18px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer'
                }}
              >
                {loading ? <span className="fleet-spinner" /> : <Save size={14} />}
                Save Changes
              </button>
            </form>
          </div>

          {/* Card 2: Security & Password Update */}
          <div className="fleet-section-card" style={{ padding: '24px' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: '15px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px' }}>
              <Shield size={16} style={{ color: '#3a82ff' }} /> Security & Password
            </h3>

            <form onSubmit={handlePasswordSubmit} noValidate>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '10px', fontWeight: 800, color: 'rgba(148, 163, 184, 0.6)', letterSpacing: '0.08em' }}>NEW PASSWORD</label>
                  <div style={{ position: 'relative' }}>
                    <Key size={13} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(148,163,184,0.4)' }} />
                    <input 
                      type="password" 
                      value={passwordData.newPassword} 
                      onChange={(e) => setPasswordData(p => ({ ...p, newPassword: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '10px 12px 10px 34px',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: '8px',
                        color: '#ffffff',
                        fontSize: '13px',
                        outline: 'none'
                      }}
                      placeholder="At least 6 chars"
                      required
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '10px', fontWeight: 800, color: 'rgba(148, 163, 184, 0.6)', letterSpacing: '0.08em' }}>CONFIRM NEW PASSWORD</label>
                  <div style={{ position: 'relative' }}>
                    <Key size={13} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(148,163,184,0.4)' }} />
                    <input 
                      type="password" 
                      value={passwordData.confirmPassword} 
                      onChange={(e) => setPasswordData(p => ({ ...p, confirmPassword: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '10px 12px 10px 34px',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: '8px',
                        color: '#ffffff',
                        fontSize: '13px',
                        outline: 'none'
                      }}
                      placeholder="Repeat password"
                      required
                    />
                  </div>
                </div>
              </div>

              <AnimatePresence>
                {passSuccessMsg && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(22, 201, 136, 0.08)', border: '1px solid rgba(22, 201, 136, 0.15)', color: '#4deba0', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', marginBottom: '16px' }}>
                    <CheckCircle size={14} /> {passSuccessMsg}
                  </motion.div>
                )}
                {passErrorMsg && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255, 83, 95, 0.08)', border: '1px solid rgba(255, 83, 95, 0.15)', color: '#ff8080', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', marginBottom: '16px' }}>
                    <AlertCircle size={14} /> {passErrorMsg}
                  </motion.div>
                )}
              </AnimatePresence>

              <button 
                type="submit" 
                className="fleet-btn"
                disabled={passLoading}
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: 'rgba(235,242,255,0.85)',
                  padding: '9px 18px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer'
                }}
              >
                {passLoading ? <span className="fleet-spinner" /> : <Key size={14} />}
                Update Password
              </button>
            </form>
          </div>

        </div>

      </div>

    </div>
  )
}
