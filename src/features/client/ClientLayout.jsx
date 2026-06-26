import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Award,
  Bell,
  Calendar,
  Check,
  ClipboardList,
  Fuel,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Map,
  Menu,
  Package,
  Truck,
  UserCircle2,
  Users,
  Wrench,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
// eslint-disable-next-line no-unused-vars
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
    { to: '/fleet/dashboard',   label: 'Dashboard',        icon: LayoutDashboard },
    { to: '/fleet/site-map',    label: 'Site Map',          icon: Map             },
    { to: '/fleet/twins',       label: 'Vehicle Twins',     icon: Truck           },
    { to: '/fleet/inspections', label: 'Inspection Log',    icon: Wrench          },
    { to: '/fleet/fuel',        label: 'Fuel Intelligence', icon: Fuel            },
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
  const getGreeting = () => {
    const hr = new Date().getHours()
    const name = profile?.fullName || profile?.name || profile?.email || 'User'
    const firstName = name.split(' ')[0]
    if (hr < 12) return `Good Morning, ${firstName}`
    if (hr < 18) return `Good Afternoon, ${firstName}`
    return `Good Evening, ${firstName}`
  }
  const role = profile?.role || 'COMPANY'
  const navItems = NAVS_BY_ROLE[role] || NAVS_BY_ROLE.COMPANY

  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_BP).matches)
  const [sidebarOpen, setSidebarOpen] = useState(() => !window.matchMedia(MOBILE_BP).matches)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
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
      if (mq.matches) {
        setSidebarCollapsed(false)
      }
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

  const handleToggle = () => {
    if (isMobile) {
      setSidebarOpen((v) => !v)
    } else {
      setSidebarCollapsed((v) => !v)
    }
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
    <div className={`app-shell client-app-shell ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'} ${role === 'FLEET' && sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <motion.aside
        className={`sidebar client-sidebar ${role === 'FLEET' && sidebarCollapsed ? 'collapsed' : ''}`}
        initial={false}
        animate={
          isMobile
            ? { x: sidebarOpen ? 0 : '-105%', width: SIDEBAR_W }
            : { x: 0, width: role === 'FLEET' && sidebarCollapsed ? 80 : SIDEBAR_W }
        }
        transition={sidebarSpring}
        style={{ overflowX: 'hidden' }}
      >
        {role === 'FLEET' ? (
          <div className="fleet-sidebar-brand" style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', marginBottom: '16px', overflow: 'hidden' }}>
            {!(role === 'FLEET' && sidebarCollapsed) ? (
              <>
                <div className="fleet-brand-main" style={{ fontSize: '16px', fontWeight: 800, letterSpacing: '0.08em', color: '#ffffff', lineHeight: 1.2, whiteSpace: 'nowrap' }}>SAFETY MATE</div>
                <div className="fleet-brand-sub" style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', color: 'rgba(148, 163, 184, 0.5)', marginTop: '4px', whiteSpace: 'nowrap' }}>FLEET DASHBOARD</div>
              </>
            ) : (
              <div className="fleet-brand-main" style={{ fontSize: '16px', fontWeight: 800, letterSpacing: '0.08em', color: '#ffffff', display: 'flex', justifyContent: 'center' }}>SM</div>
            )}
          </div>
        ) : (
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
        )}

        <nav className="sidebar-nav client-sidebar-nav" style={role === 'FLEET' ? { gap: '10px' } : undefined}>
          {navItems.map((item) => {
            const Icon = item.icon
            const isCollapsed = role === 'FLEET' && sidebarCollapsed
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
                style={role === 'FLEET' ? {
                  textTransform: 'uppercase',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  padding: isCollapsed ? '12px 0' : '12px 20px',
                  borderRadius: '0px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                } : undefined}
                title={isCollapsed ? item.label : undefined}
                onClick={(e) => {
                  closeSidebarIfMobile()
                  if (window.isIssueCertificateFormDirty) {
                    e.preventDefault()
                    setPendingPath(item.to)
                  }
                }}
              >
                <span className="nav-icon" style={isCollapsed ? { margin: 0 } : undefined}>
                  <Icon size={14} />
                </span>
                {!isCollapsed && item.label}
              </NavLink>
            )
          })}
        </nav>

        {role === 'FLEET' ? (
          <div className="fleet-sidebar-bottom" style={{ marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column' }}>
            <div 
              className="fleet-sidebar-profile" 
              onClick={() => guardedNavigate('/fleet/profile')}
              title={role === 'FLEET' && sidebarCollapsed ? displayName : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: role === 'FLEET' && sidebarCollapsed ? 'center' : 'flex-start',
                gap: '12px',
                padding: role === 'FLEET' && sidebarCollapsed ? '16px 0' : '16px 20px',
                cursor: 'pointer',
                transition: 'background 0.2s',
                borderBottom: '1px solid rgba(255, 255, 255, 0.03)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
            >
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.15)', flexShrink: 0 }}>
                <img
                  src={profile?.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&q=80"}
                  alt="Avatar"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => {
                    e.target.src = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&q=80'
                  }}
                />
              </div>
              {!(role === 'FLEET' && sidebarCollapsed) && (
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName}</p>
                  <p style={{ margin: 0, fontSize: '9.5px', fontWeight: 800, color: '#3a82ff', letterSpacing: '0.06em' }}>SITE SUPERVISOR</p>
                </div>
              )}
            </div>
            <button
              type="button"
              className="nav-link"
              title={role === 'FLEET' && sidebarCollapsed ? "Sign Out" : undefined}
              onClick={() => {
                if (window.isIssueCertificateFormDirty) {
                  setPendingPath('LOGOUT')
                } else {
                  signOut()
                }
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: role === 'FLEET' && sidebarCollapsed ? 'center' : 'flex-start',
                gap: '10px',
                padding: role === 'FLEET' && sidebarCollapsed ? '16px 0' : '16px 20px',
                background: 'none',
                border: 'none',
                textTransform: 'uppercase',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                color: 'rgba(148, 163, 184, 0.6)',
                textAlign: 'left',
                cursor: 'pointer'
              }}
            >
              <span className="nav-icon"><LogOut size={14} /></span>
              {!(role === 'FLEET' && sidebarCollapsed) && "Sign Out"}
            </button>
          </div>
        ) : (
          <>
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
          </>
        )}
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
        animate={{
          marginLeft: isMobile
            ? 0
            : role === 'FLEET' && sidebarCollapsed
              ? 80
              : SIDEBAR_W
        }}
        transition={sidebarSpring}
      >
        <header className="topbar client-topbar">
          <div className="topbar-left" style={role === 'FLEET' ? { display: 'flex', alignItems: 'center', gap: '16px' } : undefined}>
            {role === 'FLEET' ? (
              <>
                <button
                  type="button"
                  className="sidebar-toggle"
                  aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                  onClick={handleToggle}
                >
                  <Menu size={16} />
                </button>
                <span style={{ fontSize: '15px', fontWeight: 800, color: '#ffffff', letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>
                  {getGreeting()}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '16px', fontWeight: 300 }}>|</span>
              </>
            ) : (
              <button
                type="button"
                className="sidebar-toggle"
                aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
                onClick={() => setSidebarOpen((v) => !v)}
              >
                <Menu size={16} />
              </button>
            )}
          </div>

          <div className="topbar-search-wrap">
            <GlobalSearch />
          </div>

          {role === 'FLEET' ? (
            !isMobile && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: 'auto' }}>
                <div style={{ 
                  fontSize: '11px', 
                  fontWeight: 800, 
                  color: '#3a82ff', 
                  letterSpacing: '0.06em', 
                  background: 'rgba(58, 130, 255, 0.08)',
                  border: '1px solid rgba(58, 130, 255, 0.15)',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  textTransform: 'uppercase'
                }}>
                  SITE SUPERVISOR
                </div>
              </div>
            )
          ) : (
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
          )}
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
