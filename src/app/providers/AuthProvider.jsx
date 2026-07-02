import { useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { doc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore'
import { auth, db } from '../../config/firebase.js'
import { AuthContext } from './authContext.js'

// Roles that belong to a company organisation (not stand-alone providers)
const COMPANY_ROLES = ['COMPANY', 'client_admin']

export function AuthProvider({ children }) {
  const [authReady, setAuthReady]       = useState(false)
  const [authUser, setAuthUser]         = useState(null)
  const [profile, setProfile]           = useState(null)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [profileStatus, setProfileStatus]   = useState('idle')
  const [error, setError]               = useState('')

  // Organisation document (only loaded for COMPANY / client_admin roles)
  const [orgDoc, setOrgDoc]             = useState(null)
  const [orgUnsub, setOrgUnsub]         = useState(null)

  // ── Auth state ────────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setAuthUser(nextUser)
      setProfile(null)
      setOrgDoc(null)
      setError('')
      setProfileStatus(nextUser ? 'loading' : 'idle')
      setAuthReady(true)
    })
    return () => unsubscribe()
  }, [])

  // ── Profile load ──────────────────────────────────────────────
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
    return () => { cancelled = true }
  }, [authUser])

  // ── Organisation document (real-time) ─────────────────────────
  // Only subscribe for COMPANY / client_admin roles so the modules[] array
  // is always fresh — if the Super Admin grants/revokes access it reflects
  // immediately without requiring the user to log out.
  useEffect(() => {
    // Tear down any previous subscription
    if (orgUnsub) {
      orgUnsub()
      setOrgUnsub(null)
    }
    setOrgDoc(null)

    const role = profile?.role || null
    const organizationId = profile?.organizationId || null

    if (!COMPANY_ROLES.includes(role) || !organizationId) return

    const unsub = onSnapshot(
      doc(db, 'organizations', organizationId),
      (snap) => {
        setOrgDoc(snap.exists() ? { id: snap.id, ...snap.data() } : null)
      },
      () => setOrgDoc(null),
    )

    setOrgUnsub(() => unsub)
    return () => unsub()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.role, profile?.organizationId])

  const value = useMemo(() => {
    const role           = profile?.role || null
    const isSuperAdmin   = role === 'SUPER_ADMIN'
    const organizationId = profile?.organizationId ?? null

    // modules[] from the organisation document.
    // Falls back to empty array so downstream code can always do modules.includes(...)
    // SUPER_ADMIN gets ALL modules by convention (they manage the platform).
    const modules = isSuperAdmin
      ? ['fleet', 'fire_extinguisher', 'fire_detection']
      : (Array.isArray(orgDoc?.modules) ? orgDoc.modules : [])

    const updateProfile = async (updates) => {
      if (!authUser) throw new Error('No authenticated user')
      const userRef = doc(db, 'user_profiles', authUser.uid)
      await updateDoc(userRef, { ...updates, updatedAt: new Date() })
      setProfile((prev) => (prev ? { ...prev, ...updates } : updates))
    }

    return {
      authReady,
      authUser,
      profile,
      role,
      isSuperAdmin,
      organizationId,
      orgDoc,
      modules,          // ← string[] e.g. ['fleet', 'fire_extinguisher']
      loadingProfile,
      profileStatus,
      error,
      setError,
      signOut: () => signOut(auth),
      updateProfile,
    }
  }, [authReady, authUser, profile, orgDoc, loadingProfile, profileStatus, error])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
