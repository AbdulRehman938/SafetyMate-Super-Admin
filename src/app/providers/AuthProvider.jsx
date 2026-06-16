import { useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../../config/firebase.js'
import { AuthContext } from './authContext.js'

export function AuthProvider({ children }) {
  const [authReady, setAuthReady] = useState(false)
  const [authUser, setAuthUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [profileStatus, setProfileStatus] = useState('idle') // idle | loading | loaded | missing | forbidden | error
  const [error, setError] = useState('')

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setAuthUser(nextUser)
      setProfile(null)
      setError('')
      setProfileStatus(nextUser ? 'loading' : 'idle')
      setAuthReady(true)
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadProfile() {
      if (!authUser) return
      setLoadingProfile(true)
      setProfileStatus('loading')
      try {
        const snap = await getDoc(doc(db, 'user_profiles', authUser.uid))
        const data = snap.exists() ? snap.data() : null
        if (cancelled) return
        setProfile(data)
        setProfileStatus(data ? 'loaded' : 'missing')
      } catch (err) {
        if (cancelled) return
        setProfile(null)
        const code = err?.code || ''
        setProfileStatus(code === 'permission-denied' ? 'forbidden' : 'error')
      } finally {
        if (!cancelled) setLoadingProfile(false)
      }
    }

    loadProfile()
    return () => {
      cancelled = true
    }
  }, [authUser])

  const value = useMemo(() => {
    const role = profile?.role || null
    const isSuperAdmin = role === 'SUPER_ADMIN'
    const organizationId = profile?.organizationId ?? null

    return {
      authReady,
      authUser,
      profile,
      role,
      isSuperAdmin,
      organizationId,
      loadingProfile,
      profileStatus,
      error,
      setError,
      signOut: () => signOut(auth),
    }
  }, [authReady, authUser, profile, loadingProfile, profileStatus, error])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

