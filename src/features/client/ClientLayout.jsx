import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Award,
  Bell,
  Calendar,
  Check,
  ClipboardList,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Menu,
  Package,
  UserCircle2,
  Users,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '../../app/providers/authContext.js'
import { GlobalSearch } from './components/GlobalSearch.jsx'
import { getDashboardPathForRole } from '../../shared/auth/currentUser.js'
import { useNotifications } from '../training-dashboard/hooks/useNotifications.js'
import './client.css'

const NAVS_BY_ROLE = {
  COMPANY: [
    { to: '/client/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/client/risk-assessment', label: 'Risk Assessment', icon: ClipboardList },
    { to: '/client/incidents', label: 'Incidents', icon: AlertTriangle },
    { to: '/client/certificates', label: 'Certificates', icon: Award },
    { to: '/client/workforce', label: 'Workforce', icon: Users },
    { to: '/client/ppe', label: 'PPE & Assets', icon: Package },
  ],
  client_admin: [
    { to: '/client/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/client/risk-assessment', label: 'Risk Assessment', icon: ClipboardList },
    { to: '/client/incidents', label: 'Incidents', icon: AlertTriangle },
    { to: '/client/certificates', label: 'Certificates', icon: Award },
    { to: '/client/workforce', label: 'Workforce', icon: Users },
    { to: '/client/ppe', label: 'PPE & Assets', icon: Package },
  ],
  TRAINING_PROVIDER: [
    { to: '/training/dashboard', label: 'Overview', icon: LayoutGrid },
    { to: '/training/requests', label: 'Training Requests', icon: ClipboardList },
    { to: '/training/calendar', label: 'Course Calendar', icon: Calendar },
    { to: '/training/certificates', label: 'Certificate Portal', icon: Award },
  ],
  FLEET: [
    { to: '/fleet/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  ],
  FIRE_EXTINGUISHER: [
    { to: '/extinguisher/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  ],
  FIRE_DETECTION: [
    { to: '/detection/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  ],
}

const SIDEBAR_W = 280
const MOBILE_BP = '(max-width: 960px)'
const sidebarSpring = { type: 'spring', stiffness: 400, damping: 40 }
const overlayTween = { duration: 0.25, ease: 'easeInOut' }

function formatTimeAgo(val) {
  if (!val) return ''
  let date
  if (typeof val.toDate === 'function') date = val.toDate()
  else if (val instanceof Date) date = val
  else date = new Date(val)
  if (isNaN(date.getTime())) return ''
  const diff = Date.now() - date.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function ClientLayout() {
  const navigate = useNavigate()
  const { profile, authUser, signOut } = useAuth()
  const displayName = profile?.fullName || profile?.name || profile?.email || '—'
  const role = profile?.role || 'COMPANY'
  const navItems = NAVS_BY_ROLE[role] || NAVS_BY_ROLE.COMPANY

  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_BP).matches)
  const [sidebarOpen, setSidebarOpen] = useState(() => !window.matchMedia(MOBILE_BP).matches)
  const [pendingPath, setPendingPath] = useState(null)

  // Notification panel state
  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef(null)

  // Real-time notifications (training provider only for now)
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications({
    uid: authUser?.uid ?? null,
    role: role,
  })

  // ── Responsive sidebar ────────────────────────────────────────
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_BP)
    const apply = () => {
      setIsMobile(mq.matches)
      setSidebarOpen(!mq.matches)
    }
    apply()
    mq.addEventListener?.('change', apply)
    return () => mq.removeEventListener?.('change', apply)
  }, [])

  // ── Close on Escape ───────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        setSidebarOpen(false)
        setNotifOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // ── Close notif panel on outside click ───────────────────────
  useEffect(() => {
    function onPointerDown(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  const closeSidebarIfMobile = () => {
    if (window.matchMedia(MOBILE_BP).matches) setSidebarOpen(false)
  }

  function guardedNavigate(target) {
    if (window.isIssueCertificateFormDirty) {
      setPendingPath(target)
    } else {
      navigate(target)
    }
  }

  async function handleNotifClick(notif) {
    setNotifOpen(false)
    await markRead(notif.id)

    let target = notif.navigateTo || getDashboardPathForRole(role)
    if (notif.type === 'training_request' && notif.sourceId) {
      target = `/training/requests?highlight=${encodeURIComponent(notif.sourceId)}`
    }

    guardedNavigate(target)
  }

  return (
    <div className={`app-shell client-app-shell ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      <motion.aside
        className="sidebar client-sidebar"
        initial={false}
        animate={{ x: sidebarOpen ? 0 : '-105%' }}
        transition={sidebarSpring}
      >
        <button
          type="button"
          className="brand-row brand-home"
          onClick={() => {
            closeSidebarIfMobile()
            const target = getDashboardPathForRole(role)
            guardedNavigate(target)
          }}
          aria-label="Go to Dashboard"
        >
          <img className="brand-logo" src="/logo.png" alt="SafetyMate" />
          <p className="brand">
            <span className="brand-safety">Safety</span>
            <span className="brand-mate">Mate</span>
          </p>
        </button>

        <nav className="sidebar-nav client-sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
                onClick={(e) => {
                  closeSidebarIfMobile()
                  if (window.isIssueCertificateFormDirty) {
                    e.preventDefault()
                    setPendingPath(item.to)
                  }
                }}
              >
                <span className="nav-icon">
                  <Icon size={14} />
                </span>
                {item.label}
              </NavLink>
            )
          })}
        </nav>

        <div className="client-profile-strip profile-strip">
          <div className="profile-avatar">
            <UserCircle2 size={16} />
          </div>
          <div className="client-profile-text">
            <p className="profile-name">{displayName}</p>
            <p className="profile-role client-profile-org">{profile?.role || 'Safety Manager'}</p>
          </div>
          <button
            type="button"
            className="profile-logout"
            onClick={() => {
              if (window.isIssueCertificateFormDirty) {
                setPendingPath('LOGOUT')
              } else {
                signOut()
              }
            }}
            aria-label="Log out"
            title="Log out"
          >
            <LogOut size={16} />
          </button>
        </div>

        <div className="sidebar-status-wrap">
          <div className="sidebar-status-inner">
            <span className="status-pulse-dot" />
            <span className="status-text">System Status: Secure</span>
          </div>
        </div>
      </motion.aside>

      <motion.button
        type="button"
        className="sidebar-overlay"
        aria-label="Close sidebar"
        onClick={() => setSidebarOpen(false)}
        initial={false}
        animate={{ opacity: isMobile && sidebarOpen ? 1 : 0 }}
        transition={overlayTween}
        style={{ pointerEvents: isMobile && sidebarOpen ? 'auto' : 'none' }}
      />

      <motion.div
        className="content-shell client-content-shell"
        initial={false}
        animate={{ marginLeft: !isMobile && sidebarOpen ? SIDEBAR_W : 0 }}
        transition={sidebarSpring}
      >
        <header className="topbar client-topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="sidebar-toggle"
              aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setSidebarOpen((v) => !v)}
            >
              <Menu size={16} />
            </button>
          </div>

          <div className="topbar-search-wrap">
            <GlobalSearch />
          </div>

          <div className="topbar-icons client-topbar-icons">
            {/* ── Notification Bell ── */}
            <div className="topbar-bell-wrap" ref={notifRef}>
              <button
                type="button"
                aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
                onClick={() => setNotifOpen((v) => !v)}
                className={notifOpen ? 'bell-btn-active' : ''}
              >
                <Bell size={15} />
                {unreadCount > 0 && (
                  <span className="bell-badge" aria-label={`${unreadCount} unread`}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="topbar-bell-popover client-notif-popover" role="dialog" aria-label="Notifications">
                  <div className="client-notif-header">
                    <div className="client-notif-header-left">
                      <Bell size={14} />
                      <b>Notifications</b>
                      {unreadCount > 0 && (
                        <span className="client-notif-badge">{unreadCount} new</span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        className="client-notif-mark-all"
                        onClick={(e) => {
                          e.stopPropagation()
                          markAllRead()
                        }}
                        title="Mark all as read"
                      >
                        <Check size={12} />
                        All read
                      </button>
                    )}
                  </div>

                  <div className="client-notif-list">
                    {notifications.length === 0 ? (
                      <div className="client-notif-empty">
                        <Bell size={22} />
                        <p>You&rsquo;re all caught up!</p>
                        <span>No new notifications</span>
                      </div>
                    ) : (
                      notifications.slice(0, 10).map((notif) => (
                        <button
                          key={notif.id}
                          type="button"
                          className={`client-notif-item${notif.read ? ' client-notif-item--read' : ''}`}
                          onClick={() => handleNotifClick(notif)}
                        >
                          <div className="client-notif-dot-wrap">
                            {!notif.read && <span className="client-notif-dot" />}
                          </div>
                          <div className="client-notif-body">
                            <p className="client-notif-title">{notif.title}</p>
                            <p className="client-notif-msg">{notif.message}</p>
                            <div className="client-notif-footer">
                              {notif.meta && (
                                <span className="client-notif-meta">{notif.meta}</span>
                              )}
                              <span className="client-notif-time">
                                {formatTimeAgo(notif.createdAt)}
                              </span>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>

                  {notifications.length > 10 && (
                    <div className="client-notif-footer-row">
                      <button
                        type="button"
                        className="client-notif-view-all"
                        onClick={() => {
                          setNotifOpen(false)
                          const target =
                            role === 'TRAINING_PROVIDER' ? '/training/requests' : getDashboardPathForRole(role)
                          guardedNavigate(target)
                        }}
                      >
                        View all {notifications.length} notifications
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="page-content client-page-content">
          <Outlet />
        </main>
      </motion.div>

      {/* ── Navigation guard modal ── */}
      {pendingPath && (
        <div className="prov-blocker-overlay" role="dialog" aria-modal="true">
          <div className="prov-blocker-modal">
            <div className="prov-blocker-icon-wrap">
              <AlertTriangle size={28} />
            </div>
            <h3 className="prov-blocker-title">Discard Unsaved Changes?</h3>
            <p className="prov-blocker-message">
              You are currently editing a new certificate. If you navigate away, all details will be permanently lost.
            </p>
            <div className="prov-blocker-actions">
              <button
                type="button"
                className="prov-blocker-btn-secondary"
                onClick={() => setPendingPath(null)}
              >
                Keep Editing
              </button>
              <button
                type="button"
                className="prov-blocker-btn-danger"
                onClick={() => {
                  window.isIssueCertificateFormDirty = false
                  const target = pendingPath
                  setPendingPath(null)
                  if (target === 'LOGOUT') {
                    signOut()
                  } else {
                    navigate(target)
                  }
                }}
              >
                Discard Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
