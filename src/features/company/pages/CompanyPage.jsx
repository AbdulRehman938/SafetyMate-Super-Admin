import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '../../../config/firebase.js'
import { useAuth } from '../../../app/providers/authContext.js'
import { useToast } from '../../../shared/toast/toastContext.js'
import { writeSecurityAuditLog } from '../../../shared/security/auditLog.js'
import {
  AlertTriangle,
  ArrowUpDown,
  Ban,
  BriefcaseBusiness,
  CircleCheck,
  History,
  LayoutDashboard,
  MoreVertical,
  RotateCw,
  Send,
  Shield,
  Trash2,
  X,
} from 'lucide-react'

function formatDate(value) {
  if (!value) return '—'
  const date =
    value?.toDate?.() instanceof Date
      ? value.toDate()
      : value instanceof Date
        ? value
        : null
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).format(date)
}

function StatusBadge({ status }) {
  const s = String(status || '')
    .toLowerCase()
    .replace(/\s+/g, '_')
  let tone = 'muted'
  let label = status ? String(status).replace(/_/g, ' ') : '—'

  if (s === 'active') {
    tone = 'success'
    label = 'Active'
  } else if (s === 'pending_payment') {
    tone = 'pending-payment'
    label = 'Pending payment'
  } else if (s === 'suspended') {
    tone = 'danger'
    label = 'Suspended'
  } else if (s === 'pending') {
    tone = 'warn'
    label = 'Pending'
  }

  return <span className={`status-badge tone-${tone}`}>{label}</span>
}

export function CompanyPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { authUser, profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])
  const [summary, setSummary] = useState({
    totalActive: null,
    expiringSoon: null,
    pendingApprovals: null,
  })
  const [actionBusyId, setActionBusyId] = useState(null)
  const [openMenuId, setOpenMenuId] = useState(null)
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 })
  const [suspendModal, setSuspendModal] = useState({ open: false, company: null })
  const [suspendReason, setSuspendReason] = useState('')
  const [sendNotification, setSendNotification] = useState(true)
  const [deleteModal, setDeleteModal] = useState({ open: false, company: null })
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleteStats, setDeleteStats] = useState({ loading: false, users: '—', sites: '—', files: '—' })

  const triggerRefs = useMemo(() => new Map(), [])

  useEffect(() => {
    function onGlobalPointerDown(e) {
      const el = e.target
      if (!(el instanceof HTMLElement)) return
      if (el.closest('[data-company-menu-root]')) return
      if (el.closest('[data-company-menu-floating]')) return
      setOpenMenuId(null)
    }

    window.addEventListener('pointerdown', onGlobalPointerDown)
    return () => window.removeEventListener('pointerdown', onGlobalPointerDown)
  }, [])

  useEffect(() => {
    if (!openMenuId) return

    const trigger = triggerRefs.get(openMenuId)
    if (!trigger) return

    const rect = trigger.getBoundingClientRect()
    const menuWidth = 260
    const gap = 8
    const viewportPadding = 8

    const top = Math.round(rect.bottom + gap)
    const preferredLeft = rect.right - menuWidth
    const left = Math.round(
      Math.max(viewportPadding, Math.min(preferredLeft, window.innerWidth - menuWidth - viewportPadding)),
    )

    setMenuPosition({ top, left })
  }, [openMenuId, triggerRefs])

  useEffect(() => {
    if (!openMenuId) return

    function closeMenu() {
      setOpenMenuId(null)
    }

    function onKeyDown(e) {
      if (e.key === 'Escape') setOpenMenuId(null)
    }

    window.addEventListener('scroll', closeMenu, true)
    window.addEventListener('resize', closeMenu)
    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('scroll', closeMenu, true)
      window.removeEventListener('resize', closeMenu)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [openMenuId])

  useEffect(() => {
    let cancelled = false

    async function run() {
      setLoading(true)
      try {
        const orgsRef = collection(db, 'organizations')
        const profilesRef = collection(db, 'user_profiles')

        const now = new Date()
        const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

        const totalActivePromise = getCountFromServer(query(orgsRef, where('status', '==', 'active'))).catch(() => null)
        const pendingPromise = getCountFromServer(query(orgsRef, where('status', '==', 'pending'))).catch(() => null)
        const expiringSoonPromise = getCountFromServer(
          query(orgsRef, where('subscriptionExpiry', '>=', now), where('subscriptionExpiry', '<=', in30Days)),
        ).catch(() => null)

        const orgDocsPromise = getDocs(orgsRef)

        const [activeSnap, pendingSnap, expiringSnap, orgDocs] = await Promise.all([
          totalActivePromise,
          pendingPromise,
          expiringSoonPromise,
          orgDocsPromise,
        ])

        if (cancelled) return

        setSummary({
          totalActive: activeSnap && 'data' in activeSnap ? activeSnap.data().count : null,
          expiringSoon: expiringSnap && 'data' in expiringSnap ? expiringSnap.data().count : null,
          pendingApprovals: pendingSnap && 'data' in pendingSnap ? pendingSnap.data().count : null,
        })

        const orgList = orgDocs.docs.map((d) => ({ id: d.id, ...d.data() }))

        // User counts (per org) using efficient server-side counts.
        const userCountSnaps = await Promise.all(
          orgList.map((org) =>
            getCountFromServer(query(profilesRef, where('organizationId', '==', org.id))).catch(() => null),
          ),
        )

        if (cancelled) return

        const mapped = orgList.map((org, idx) => {
          const userCountSnap = userCountSnaps[idx]
          const userCount =
            userCountSnap && 'data' in userCountSnap ? userCountSnap.data().count : null
          return {
            id: org.id,
            name: org.name || org.companyName || org.organizationName || '—',
            industry: org.industry || '—',
            plan: org.plan || org.planName || org.subscriptionPlan || '—',
            status: org.status || '—',
            statusRaw: String(org.status || '').toLowerCase(),
            users: userCount == null ? '—' : new Intl.NumberFormat('en-US').format(userCount),
            expiry: formatDate(org.subscriptionExpiry || org.expiry || org.expiryDate),
            expiryRaw: org.subscriptionExpiry || org.expiry || org.expiryDate || null,
            monthlyPrice: Number(org.monthlyPrice || 0),
          }
        })

        setRows(mapped)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [])

  const summaryCards = useMemo(
    () => [
      { title: 'TOTAL ACTIVE', value: loading ? '…' : summary.totalActive ?? '—', delta: '+ 5.2%' },
      { title: 'EXPIRING SOON', value: loading ? '…' : summary.expiringSoon ?? '—', delta: '45' },
      { title: 'PENDING APPROVALS', value: loading ? '…' : summary.pendingApprovals ?? '—', delta: '12' },
    ],
    [loading, summary],
  )

  async function onDeleteCompany(companyId) {
    setActionBusyId(companyId)
    try {
      await deleteDoc(doc(db, 'organizations', companyId))
      setRows((prev) => prev.filter((r) => r.id !== companyId))
      toast.push({ type: 'success', title: 'Deleted', message: 'Company deleted.' })
    } finally {
      setActionBusyId(null)
    }
  }

  function openDeleteModal(company) {
    setDeleteConfirmText('')
    setDeleteModal({ open: true, company })
    setDeleteStats({ loading: true, users: company.users || '—', sites: '—', files: '—' })

    Promise.all([
      getCountFromServer(query(collection(db, 'user_profiles'), where('organizationId', '==', company.id))).catch(() => null),
      getCountFromServer(query(collection(db, 'sites'), where('organizationId', '==', company.id))).catch(() => null),
      getCountFromServer(query(collection(db, 'files_documents'), where('organizationId', '==', company.id))).catch(() => null),
    ]).then(([usersSnap, sitesSnap, filesSnap]) => {
      setDeleteStats({
        loading: false,
        users: usersSnap?.data ? new Intl.NumberFormat('en-US').format(usersSnap.data().count) : company.users || '—',
        sites: sitesSnap?.data ? new Intl.NumberFormat('en-US').format(sitesSnap.data().count) : '—',
        files: filesSnap?.data ? new Intl.NumberFormat('en-US').format(filesSnap.data().count) : '—',
      })
    })
  }

  function closeDeleteModal() {
    if (deleteModal.company && actionBusyId === deleteModal.company.id) return
    setDeleteModal({ open: false, company: null })
    setDeleteConfirmText('')
    setDeleteStats({ loading: false, users: '—', sites: '—', files: '—' })
  }

  async function onConfirmDeleteModal() {
    if (!deleteModal.company) return
    await onDeleteCompany(deleteModal.company.id)
    setDeleteModal({ open: false, company: null })
    setDeleteConfirmText('')
    setDeleteStats({ loading: false, users: '—', sites: '—', files: '—' })
  }

  useEffect(() => {
    if (!deleteModal.open) return

    function onKeyDown(e) {
      if (e.key !== 'Escape') return
      if (deleteModal.company && actionBusyId === deleteModal.company.id) return
      setDeleteModal({ open: false, company: null })
      setDeleteConfirmText('')
      setDeleteStats({ loading: false, users: '—', sites: '—', files: '—' })
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [deleteModal, actionBusyId])

  async function onActivateAccount(company) {
    if (!company?.id) return
    setActionBusyId(company.id)
    try {
      await updateDoc(doc(db, 'organizations', company.id), { status: 'active' })
      const actor = profile?.email || authUser?.email || 'unknown'
      await writeSecurityAuditLog(db, {
        actor,
        actionType: 'ORGANIZATION_ACTIVATED',
        resource: `organizations/${company.id}`,
        severity: 'Medium',
        details: `Activated account "${company.name}" (pending_payment → active).`,
      }).catch(() => {})
      setRows((prev) =>
        prev.map((r) => (r.id === company.id ? { ...r, status: 'active', statusRaw: 'active' } : r)),
      )
      toast.push({ type: 'success', title: 'Activated', message: 'Company account is now active.' })
    } catch (e) {
      toast.push({
        type: 'error',
        title: 'Activation failed',
        message: e?.message || 'Could not activate account.',
      })
    } finally {
      setActionBusyId(null)
    }
  }

  async function onToggleStatus(companyId, currentStatus) {
    const s = String(currentStatus || '').toLowerCase()
    const next = s === 'active' ? 'suspended' : 'active'
    setActionBusyId(companyId)
    try {
      await updateDoc(doc(db, 'organizations', companyId), { status: next })
      setRows((prev) => prev.map((r) => (r.id === companyId ? { ...r, status: next } : r)))
      toast.push({
        type: 'success',
        title: 'Updated',
        message: `Company ${next === 'active' ? 'activated' : 'suspended'}.`,
      })
    } finally {
      setActionBusyId(null)
    }
  }

  async function onSuspendCompany() {
    if (!suspendModal.company) return
    const company = suspendModal.company

    setActionBusyId(company.id)
    try {
      await updateDoc(doc(db, 'organizations', company.id), {
        status: 'suspended',
        suspendedAt: serverTimestamp(),
        suspensionReason: suspendReason.trim(),
        notificationEmailSent: Boolean(sendNotification),
      })

      // Keep UI flow resilient: core update succeeds even if logging collection is restricted.
      await addDoc(collection(db, 'organization_audit_logs'), {
        organizationId: company.id,
        type: 'COMPANY_SUSPENDED',
        reason: suspendReason.trim() || null,
        notifyAdmin: Boolean(sendNotification),
        createdAt: serverTimestamp(),
      }).catch(() => {})

      setRows((prev) =>
        prev.map((r) =>
          r.id === company.id ? { ...r, status: 'suspended', statusRaw: 'suspended' } : r,
        ),
      )

      setSuspendModal({ open: false, company: null })
      setSuspendReason('')
      setSendNotification(true)

      navigate(`/company/${company.id}/suspend-success`, {
        state: {
          name: company.name,
          reason: suspendReason.trim(),
          effectiveDate: new Date(),
          id: company.id,
        },
      })
    } finally {
      setActionBusyId(null)
    }
  }

  function comingSoon(feature) {
    toast.push({ type: 'info', title: 'Coming soon', message: `${feature} is coming soon.` })
  }

  return (
    <section className="stack-gap">
      <header className="card-head companies-head">
        <h2>Subscriber Management</h2>
        <div className="companies-actions">
          <button className="primary-btn" type="button" onClick={() => navigate('/company/new')}>
            + New Subscriber
          </button>
        </div>
      </header>

      <section className="kpi-grid companies-kpis">
        {summaryCards.map((c) => (
          <article className="dashboard-card kpi-card" key={c.title}>
            <div className="kpi-top">
              <span className="kpi-label">{c.title}</span>
              <span className="kpi-delta kpi-up">{c.delta}</span>
            </div>
            <p className="kpi-value">{c.value}</p>
          </article>
        ))}
      </section>

      <article className="dashboard-card">
        <div className="companies-table-wrap">
          <table className="companies-table">
            <thead>
              <tr>
                <th>COMPANY NAME &amp; ID</th>
                <th>INDUSTRY</th>
                <th>PLAN TYPE</th>
                <th>STATUS</th>
                <th>USER COUNT</th>
                <th>EXPIRY DATE</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="companies-loading">
                    Loading companies…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="companies-loading">
                    No companies found.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="company-name">
                        <b>{r.name}</b>
                        <span>ID: {r.id}</span>
                      </div>
                    </td>
                    <td>{r.industry}</td>
                    <td>
                      <span className="plan-pill">{String(r.plan)}</span>
                    </td>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                    <td>{r.users}</td>
                    <td>{r.expiry}</td>
                    <td>
                      <div className="actions-cell" data-company-menu-root>
                        <button
                          type="button"
                          className="kebab-btn"
                          aria-haspopup="menu"
                          aria-expanded={openMenuId === r.id}
                          disabled={actionBusyId === r.id}
                          ref={(el) => {
                            if (el) triggerRefs.set(r.id, el)
                            else triggerRefs.delete(r.id)
                          }}
                          onClick={() => setOpenMenuId((prev) => (prev === r.id ? null : r.id))}
                        >
                          <MoreVertical size={16} />
                        </button>

                        {openMenuId === r.id ? (
                          createPortal(
                            <div
                              className="actions-menu"
                              role="menu"
                              data-company-menu-floating
                              style={{ top: menuPosition.top, left: menuPosition.left }}
                            >
                              <button
                                type="button"
                                className="menu-item"
                                role="menuitem"
                                onClick={() => {
                                  setOpenMenuId(null)
                                  navigate('/dashboard')
                                }}
                              >
                                <LayoutDashboard size={16} />
                                View Dashboard
                              </button>

                              {String(r.statusRaw || r.status || '')
                                .toLowerCase()
                                .replace(/\s+/g, '_') === 'pending_payment' ? (
                                <button
                                  type="button"
                                  className="menu-item"
                                  role="menuitem"
                                  disabled={actionBusyId === r.id}
                                  onClick={() => {
                                    setOpenMenuId(null)
                                    onActivateAccount(r)
                                  }}
                                >
                                  <CircleCheck size={16} />
                                  Activate Account
                                </button>
                              ) : null}

                              {String(r.statusRaw || r.status || '').toLowerCase() === 'active' ? (
                                <button
                                  type="button"
                                  className="menu-item"
                                  role="menuitem"
                                  disabled={actionBusyId === r.id}
                                  onClick={() => {
                                    setOpenMenuId(null)
                                    setSuspendModal({ open: true, company: r })
                                  }}
                                >
                                  <Ban size={16} />
                                  Suspend Company
                                </button>
                              ) : null}

                              {String(r.statusRaw || r.status || '').toLowerCase() === 'suspended' ? (
                                <button
                                  type="button"
                                  className="menu-item"
                                  role="menuitem"
                                  disabled={actionBusyId === r.id}
                                  onClick={() => {
                                    setOpenMenuId(null)
                                    onToggleStatus(r.id, r.status)
                                  }}
                                >
                                  <Ban size={16} />
                                  Activate Company
                                </button>
                              ) : null}

                              <button
                                type="button"
                                className="menu-item"
                                role="menuitem"
                                onClick={() => {
                                  setOpenMenuId(null)
                                  navigate(`/company/${r.id}/upgrade`, { state: { company: r } })
                                }}
                              >
                                <ArrowUpDown size={16} />
                                Upgrade/Downgrade Plan
                              </button>

                              <button
                                type="button"
                                className="menu-item"
                                role="menuitem"
                                onClick={() => {
                                  setOpenMenuId(null)
                                  navigate(`/company/${r.id}/extend`, { state: { company: r } })
                                }}
                              >
                                <RotateCw size={16} />
                                Extend Subscription
                              </button>

                              <button
                                type="button"
                                className="menu-item"
                                role="menuitem"
                                onClick={() => {
                                  setOpenMenuId(null)
                                  navigate('/announcements', {
                                    state: { preselectCompany: { id: r.id, name: r.name } },
                                  })
                                }}
                              >
                                <Send size={16} />
                                Send Notifications
                              </button>

                              <button
                                type="button"
                                className="menu-item"
                                role="menuitem"
                                onClick={() => {
                                  setOpenMenuId(null)
                                  navigate(`/company/${r.id}/billing-history`, {
                                    state: { company: r, companyName: r.name, companyId: r.id },
                                  })
                                }}
                              >
                                <History size={16} />
                                View Billing History
                              </button>

                              <div className="menu-divider" role="separator" />

                              <button
                                type="button"
                                className="menu-item menu-danger"
                                role="menuitem"
                                disabled={actionBusyId === r.id}
                                onClick={() => {
                                  setOpenMenuId(null)
                                  openDeleteModal(r)
                                }}
                              >
                                <Trash2 size={16} />
                                Delete Company
                              </button>
                            </div>,
                            document.body,
                          )
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </article>

      {suspendModal.open && suspendModal.company ? (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <article className="suspend-modal">
            <header className="suspend-modal-head">
              <h3>
                <Ban size={18} />
                Suspend Company
              </h3>
              <button
                type="button"
                className="topnav-icon"
                onClick={() => {
                  setSuspendModal({ open: false, company: null })
                  setSuspendReason('')
                  setSendNotification(true)
                }}
              >
                ×
              </button>
            </header>

            <div className="suspend-alert-box">
              Are you sure you want to suspend <b>{suspendModal.company.name}</b>? This will
              immediately revoke access for all users.
            </div>

            <label>
              Reason for Suspension (Optional)
              <textarea
                className="suspend-textarea"
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="Provide a brief explanation for the suspension..."
              />
            </label>

            <label className="suspend-checkbox-row">
              <input
                type="checkbox"
                checked={sendNotification}
                onChange={(e) => setSendNotification(e.target.checked)}
              />
              <span>Send notification email to company administrator</span>
            </label>

            <footer className="suspend-footer">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => {
                  setSuspendModal({ open: false, company: null })
                  setSuspendReason('')
                  setSendNotification(true)
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="danger-btn"
                disabled={actionBusyId === suspendModal.company.id}
                onClick={onSuspendCompany}
              >
                {actionBusyId === suspendModal.company.id ? 'Suspending…' : 'Suspend Company'}
              </button>
            </footer>
          </article>
        </div>
      ) : null}

      {deleteModal.open && deleteModal.company
        ? createPortal(
            <div
              className="modal-overlay"
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-company-title"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) closeDeleteModal()
              }}
            >
              <div className="delete-company-modal">
                <header className="delete-company-head">
                  <div className="delete-company-title-wrap">
                    <span className="delete-company-alert-icon" aria-hidden="true">
                      <AlertTriangle size={16} />
                    </span>
                    <div>
                      <h3 id="delete-company-title">Delete Company</h3>
                      <p>Subscriber Management / {deleteModal.company.name}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="delete-company-close"
                    onClick={closeDeleteModal}
                    disabled={actionBusyId === deleteModal.company.id}
                    aria-label="Close"
                  >
                    <X size={16} />
                  </button>
                </header>

                <div className="delete-company-body">
                  <p className="delete-company-message">
                    Are you sure you want to permanently delete <u>{deleteModal.company.name}</u>? This action{' '}
                    <span>cannot be undone.</span>
                  </p>

                  <section className="delete-company-impact">
                    <p className="delete-company-impact-title">
                      <Shield size={12} /> The following data will be immediately purged from the system:
                    </p>

                    <div className="delete-company-impact-grid">
                      <article>
                    <b>{deleteStats.loading ? '…' : deleteStats.users}</b>
                        <small>USERS</small>
                      </article>
                      <article>
                    <b>{deleteStats.loading ? '…' : deleteStats.sites}</b>
                        <small>ACTIVE PROJECTS</small>
                      </article>
                      <article>
                    <b>{deleteStats.loading ? '…' : deleteStats.files}</b>
                        <small>SAFETY FILES</small>
                      </article>
                    </div>
                  </section>

                  <p className="delete-company-confirm-hint">
                    To confirm, please type <strong>DELETE</strong> in the box below.
                  </p>

                  <input
                    type="text"
                    className="delete-company-input"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="Type 'DELETE' to confirm"
                    autoFocus
                  />
                </div>

                <footer className="delete-company-footer">
                  <button
                    type="button"
                    className="delete-company-cancel"
                    onClick={closeDeleteModal}
                    disabled={actionBusyId === deleteModal.company.id}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="delete-company-danger-btn"
                    disabled={
                      actionBusyId === deleteModal.company.id || deleteConfirmText.trim().toUpperCase() !== 'DELETE'
                    }
                    onClick={onConfirmDeleteModal}
                  >
                    <BriefcaseBusiness size={14} /> Delete Permanently
                  </button>
                </footer>
              </div>
            </div>,
            document.body,
          )
        : null}
    </section>
  )
}
