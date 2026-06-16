import { doc, getDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { db } from '../../../config/firebase.js'

export function UserProfilePage() {
  const { uid } = useParams()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      try {
        const snap = await getDoc(doc(db, 'user_profiles', uid)).catch(() => null)
        if (cancelled) return
        setUser(snap?.exists?.() ? { id: snap.id, ...snap.data() } : null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [uid])

  if (loading) {
    return (
      <section className="stack-gap">
        <article className="dashboard-card">Loading user profile…</article>
      </section>
    )
  }

  if (!user) {
    return (
      <section className="stack-gap">
        <article className="dashboard-card">User not found.</article>
      </section>
    )
  }

  return (
    <section className="stack-gap">
      <header className="card-head">
        <div>
          <h2>User Profile</h2>
          <p>{user.email || user.id}</p>
        </div>
      </header>

      <article className="dashboard-card">
        <div className="form-grid-2">
          <label>
            Name
            <input value={user.fullName || user.name || '—'} readOnly />
          </label>
          <label>
            Email
            <input value={user.email || '—'} readOnly />
          </label>
          <label>
            Role
            <input value={user.role || '—'} readOnly />
          </label>
          <label>
            Organization ID
            <input value={user.organizationId ?? '—'} readOnly />
          </label>
        </div>
      </article>
    </section>
  )
}

