import { useEffect, useMemo, useState } from 'react'
import { getApps, initializeApp } from 'firebase/app'
import { createUserWithEmailAndPassword, getAuth } from 'firebase/auth'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { collection, doc, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore'
import { useAuth } from '../../../app/providers/authContext.js'
import { app, db, firebaseConfig } from '../../../config/firebase.js'
import { SideDrawer } from '../components/SideDrawer.jsx'
import { DEFAULT_WORKFORCE_ROLE, WORKFORCE_ROLES, isWorkforceRole } from '../workforceRoles.js'

const SECONDARY_APP_NAME = 'SecondaryApp'
const secondaryApp =
  getApps().find((a) => a.name === SECONDARY_APP_NAME) ?? initializeApp(firebaseConfig, SECONDARY_APP_NAME)
const secondaryAuth = getAuth(secondaryApp)

function normalizeStatus(raw) {
  const s = String(raw || '').toLowerCase()
  if (s === 'active') return 'Active'
  if (s === 'restricted') return 'Restricted'
  if (s === 'probation') return 'Probation'
  return 'Pending'
}

export function WorkforcePage() {
  const { profile, organizationId, authUser } = useAuth()
  const orgId = profile?.organizationId ?? organizationId
  const [allocatedUsers, setAllocatedUsers] = useState(null)
  const [workers, setWorkers] = useState([])
  const workerCount = workers.length

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [form, setForm] = useState({
    fullName: '',
    role: DEFAULT_WORKFORCE_ROLE,
    phone: '',
    email: '',
    password: '',
  })
  const [toast, setToast] = useState(null) // { tone, message }

  const seatsPct = useMemo(() => {
    if (allocatedUsers == null) return 0
    if (allocatedUsers <= 0) return workerCount > 0 ? 100 : 0
    return Math.min(100, Math.round((workerCount / allocatedUsers) * 100))
  }, [allocatedUsers, workerCount])

  const seatLimitReached = allocatedUsers != null && workerCount >= allocatedUsers

  useEffect(() => {
    if (!orgId) {
      setAllocatedUsers(null)
      setWorkers([])
      return undefined
    }

    const unsubOrg = onSnapshot(
      doc(db, 'organizations', orgId),
      (snap) => {
        const data = snap.data() || {}
        if (!Object.prototype.hasOwnProperty.call(data, 'allocatedUsers')) {
          setAllocatedUsers(10)
          return
        }
        const n = Number(data.allocatedUsers)
        setAllocatedUsers(Number.isFinite(n) && n >= 0 ? n : 0)
      },
      () => setAllocatedUsers(null),
    )

    const workersQ = query(collection(db, 'user_profiles'), where('organizationId', '==', orgId))
    const unsubWorkers = onSnapshot(
      workersQ,
      (snap) => {
        const rows = snap.docs
          .map((d) => {
            const data = d.data() || {}
            return {
              id: d.id,
              fullName: data.fullName || data.name || '—',
              role: data.role || '',
              phone: data.phone || '—',
              status: data.status || 'pending',
            }
          })
          .filter((row) => isWorkforceRole(row.role))
          .sort((a, b) => String(a.fullName).localeCompare(String(b.fullName), undefined, { sensitivity: 'base' }))
        setWorkers(rows)
      },
      () => setWorkers([]),
    )

    return () => {
      unsubOrg()
      unsubWorkers()
    }
  }, [orgId])

  function showToast(nextToast) {
    setToast(nextToast)
    window.setTimeout(() => setToast(null), 2600)
  }

  function openAddWorker() {
    setForm({
      fullName: '',
      role: DEFAULT_WORKFORCE_ROLE,
      phone: '',
      email: '',
      password: '',
    })
    setDrawerOpen(true)
  }

  function closeDrawer() {
    setDrawerOpen(false)
    setBusy(false)
    setForm({
      fullName: '',
      role: DEFAULT_WORKFORCE_ROLE,
      phone: '',
      email: '',
      password: '',
    })
  }

  async function onDeleteWorker(w) {
    if (!orgId || !authUser?.uid || w.id === authUser.uid) return
    const ok = window.confirm(`Remove ${w.fullName} from the workforce? This cannot be undone.`)
    if (!ok) return
    setDeletingId(w.id)
    try {
      const functions = getFunctions(app)
      const deleteWorkforceMember = httpsCallable(functions, 'deleteWorkforceMember')
      await deleteWorkforceMember({ targetUid: w.id })
      showToast({ tone: 'success', message: 'Worker removed.' })
    } catch (error) {
      console.error('Delete workforce member:', error)
      const msg = error?.message || String(error)
      showToast({ tone: 'error', message: `Failed: ${msg}` })
    } finally {
      setDeletingId(null)
    }
  }

  async function onAddWorker(e) {
    e.preventDefault()
    if (!orgId) {
      showToast({ tone: 'error', message: 'Failed: Organization ID is missing.' })
      console.error('Worker Creation Error:', new Error('Organization ID is missing.'))
      return
    }
    if (seatLimitReached) return
    const fullName = String(form.fullName || '').trim()
    const role = String(form.role || '').trim()
    const phone = String(form.phone || '').trim()
    const email = String(form.email || '').trim().toLowerCase()
    const password = String(form.password || '')
    if (!fullName) {
      showToast({ tone: 'error', message: 'Full Name is required.' })
      return
    }
    if (!email) {
      showToast({ tone: 'error', message: 'Email Address is required.' })
      return
    }
    if (password.length < 8) {
      showToast({ tone: 'error', message: 'Password must be at least 8 characters.' })
      return
    }
    if (!WORKFORCE_ROLES.includes(role)) {
      showToast({ tone: 'error', message: 'Please select a valid system role.' })
      return
    }

    setBusy(true)
    try {
      // Create Auth user on a secondary Firebase app so the manager’s primary session is not switched.
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password)
      const newUid = userCredential.user.uid

      const workerData = {
        fullName,
        phone,
        email,
        role,
        organizationId: orgId,
        status: 'pending',
        createdAt: serverTimestamp(),
      }

      await setDoc(doc(db, 'user_profiles', newUid), workerData)

      await secondaryAuth.signOut()

      showToast({ tone: 'success', message: 'Worker created.' })
      closeDrawer()
    } catch (error) {
      try {
        await secondaryAuth.signOut()
      } catch {
        /* secondary may not be signed in */
      }
      console.error('Worker Creation Error:', error)
      const code = String(error?.code || '')
      if (code === 'auth/email-already-in-use') {
        showToast({ tone: 'error', message: 'Failed: This email is already registered.' })
      } else {
        showToast({ tone: 'error', message: `Failed: ${error?.message || String(error)}` })
      }
      setBusy(false)
    }
  }

  return (
    <section className="client-page client-workforce-page">
      <header className="client-dash-header">
        <h1>Workforce</h1>
        <p className="client-dash-sub">Manage field workers and seat usage.</p>
      </header>

      <article className="client-card client-seat-card">
        <div className="client-seat-head">
          <div>
            <h2>Seat Usage</h2>
            <p className="client-seat-sub">
              Using <b>{workerCount}</b> of <b>{allocatedUsers == null ? '…' : allocatedUsers}</b> Seats
            </p>
          </div>
          <button
            type="button"
            className={`client-btn ${seatLimitReached ? 'client-btn--muted' : 'client-btn--primary'}`}
            onClick={openAddWorker}
            disabled={seatLimitReached}
          >
            {seatLimitReached ? 'Seat Limit Reached - Upgrade Plan' : 'Add Worker'}
          </button>
        </div>

        <div className="client-seat-track" aria-hidden>
          <div className="client-seat-fill" style={{ width: `${seatsPct}%` }} />
        </div>
      </article>

      <article className="client-card client-risk-table-card">
        <div className="client-risk-toolbar">
          <div>
            <h2>Workers</h2>
            <p className="client-risk-toolbar-sub">{workerCount} total</p>
          </div>
        </div>

        <div className="client-table-wrap">
          <table className="client-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Status</th>
                <th className="client-th-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {!workers.length ? (
                <tr>
                  <td colSpan={4} className="client-table-empty">
                    No workers yet.
                  </td>
                </tr>
              ) : null}
              {workers.map((w) => {
                const st = String(w.status || '').toLowerCase()
                const pillTone =
                  st === 'active'
                    ? 'client-pill--ok'
                    : st === 'restricted'
                      ? 'client-pill--danger'
                      : st === 'probation'
                        ? 'client-pill--warn'
                        : 'client-pill--warn'
                const canDelete = authUser?.uid && w.id !== authUser.uid
                return (
                  <tr key={w.id}>
                    <td className="client-td-strong">
                      <div className="client-worker-name">
                        <span>{w.fullName}</span>
                        {w.role ? <small className="client-worker-role">{w.role}</small> : null}
                      </div>
                    </td>
                    <td className="client-td-muted">{w.phone}</td>
                    <td>
                      <span className={`client-pill ${pillTone}`}>{normalizeStatus(w.status)}</span>
                    </td>
                    <td className="client-td-actions">
                      {canDelete ? (
                        <button
                          type="button"
                          className="client-btn client-btn--danger client-workforce-del"
                          disabled={deletingId === w.id}
                          onClick={() => onDeleteWorker(w)}
                        >
                          {deletingId === w.id ? 'Removing…' : 'Delete'}
                        </button>
                      ) : (
                        <span className="client-td-muted">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </article>

      <SideDrawer isOpen={drawerOpen} onClose={closeDrawer} title="Add New Worker">
        <form className="client-drawer-form" onSubmit={onAddWorker}>
          <label htmlFor="worker-fullname">Full Name</label>
          <input
            id="worker-fullname"
            value={form.fullName}
            onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
            placeholder="e.g. Ali Raza"
            required
            disabled={busy}
          />
          <label htmlFor="worker-role">System role</label>
          <select
            id="worker-role"
            className="client-select"
            value={form.role}
            onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
            disabled={busy}
          >
            {WORKFORCE_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <label htmlFor="worker-phone">Phone Number</label>
          <input
            id="worker-phone"
            value={form.phone}
            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            placeholder="+92 300 1234567"
            disabled={busy}
          />
          <label htmlFor="worker-email">Email Address</label>
          <input
            id="worker-email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            placeholder="worker@company.com"
            disabled={busy}
            required
          />
          <label htmlFor="worker-password">Password</label>
          <input
            id="worker-password"
            type="password"
            value={form.password}
            onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
            placeholder="At least 8 characters"
            disabled={busy}
            required
          />
          <button type="submit" className="client-btn client-btn--primary" disabled={busy}>
            {busy ? 'Creating…' : 'Create Worker'}
          </button>
        </form>
      </SideDrawer>

      {toast ? (
        <div
          className={`client-toast ${toast.tone === 'error' ? 'client-toast--error' : 'client-toast--success'}`}
          role="status"
          aria-live="polite"
        >
          {toast.message}
        </div>
      ) : null}
    </section>
  )
}

