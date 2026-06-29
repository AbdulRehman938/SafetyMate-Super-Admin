import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import ReactDOM from 'react-dom'
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
  X,
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
  const [notifOpen,      setNotifOpen]      = useState(false)
  const [notifModalOpen, setNotifModalOpen] = useState(false)
  const notifRef   = useRef(null)
  const bellBtnRef = useRef(null)
  const [bellRect,  setBellRect]  = useState(null)
  const [isMobileView, setIsMobileView] = useState(() => window.innerWidth <= 768)

  // Track viewport for responsive notification panel
  useEffect(() => {
    const handler = () => setIsMobileView(window.innerWidth <= 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

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
        setNotifModalOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // ── Close notif panel on outside click ───────────────────────
  useEffect(() => {
    function onPointerDown(e) {
      // Close if click is outside the bell button AND outside the portal panel
      const panelEl = document.getElementById('notif-portal-panel')
      const bellEl  = bellBtnRef.current
      if (
        bellEl  && !bellEl.contains(e.target) &&
        panelEl && !panelEl.contains(e.target)
      ) {
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
            : role === 'FLEET'
              ? { x: 0, width: sidebarCollapsed ? 80 : SIDEBAR_W }
              : { x: sidebarOpen ? 0 : '-105%', width: SIDEBAR_W }
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
              : role !== 'FLEET' && !sidebarOpen
                ? 0
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
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setSidebarOpen((v) => !v)
                }}
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
              <div style={{ position: 'relative', display: 'inline-flex' }}>
                <button
                  ref={bellBtnRef}
                  type="button"
                  aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
                  onClick={() => {
                    if (notifOpen) {
                      setNotifOpen(false)
                    } else {
                      const rect = bellBtnRef.current?.getBoundingClientRect()
                      setBellRect(rect)
                      setNotifOpen(true)
                    }
                  }}
                  style={{
                    position: 'relative',
                    width: 36, height: 36,
                    borderRadius: 10,
                    border: notifOpen
                      ? '1px solid rgba(96,165,250,0.35)'
                      : '1px solid rgba(255,255,255,0.09)',
                    background: notifOpen
                      ? 'rgba(96,165,250,0.12)'
                      : 'rgba(255,255,255,0.05)',
                    color: notifOpen ? '#60a5fa' : 'rgba(148,163,184,0.85)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                    transition: 'background 150ms, color 150ms, border-color 150ms',
                  }}
                >
                  <Bell size={16} />
                  {unreadCount > 0 && (
                    <span style={{
                      position: 'absolute',
                      top: -5, right: -5,
                      minWidth: 18, height: 18,
                      borderRadius: 999,
                      background: '#ef4444',
                      boxShadow: '0 0 0 2px #0a0f1e',
                      fontSize: 10, fontWeight: 800,
                      color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: '0 4px',
                      lineHeight: 1,
                      pointerEvents: 'none',
                      zIndex: 1,
                    }}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {/* ── Portal panel — responsive: bottom sheet on mobile, dropdown on desktop ── */}
                {notifOpen && bellRect && ReactDOM.createPortal(
                  <>
                    {/* Mobile backdrop */}
                    {isMobileView && (
                      <div
                        onClick={() => setNotifOpen(false)}
                        style={{
                          position: 'fixed', inset: 0,
                          background: 'rgba(0,0,0,0.5)',
                          backdropFilter: 'blur(2px)',
                          zIndex: 9998,
                        }}
                      />
                    )}
                  <div
                    id="notif-portal-panel"
                    style={isMobileView ? {
                      // ── Bottom sheet (mobile / tablet) ──
                      position: 'fixed',
                      bottom: 0, left: 0, right: 0,
                      width: '100%',
                      maxHeight: '80vh',
                      display: 'flex', flexDirection: 'column',
                      background: '#0d1225',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '20px 20px 0 0',
                      boxShadow: '0 -12px 48px rgba(0,0,0,0.7)',
                      zIndex: 9999, overflow: 'hidden',
                      animation: 'notif-sheet-up 0.28s cubic-bezier(0.16,1,0.3,1) both',
                    } : {
                      // ── Dropdown (desktop) ──
                      position: 'fixed',
                      top: bellRect.bottom + 10,
                      right: Math.max(8, window.innerWidth - bellRect.right),
                      width: Math.min(370, window.innerWidth - 16),
                      maxHeight: 540,
                      display: 'flex', flexDirection: 'column',
                      background: '#0d1225',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 16,
                      boxShadow: '0 24px 72px rgba(0,0,0,0.65)',
                      zIndex: 9999, overflow: 'hidden',
                      animation: 'notif-panel-in 0.2s cubic-bezier(0.16,1,0.3,1) both',
                    }}
                  >
                    {/* Header */}
                    <div style={{
                      display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 16px 12px',
                      borderBottom: '1px solid rgba(255,255,255,0.07)',
                      flexShrink: 0,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Bell size={14} style={{ color: '#60a5fa' }} />
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'rgba(235,242,255,0.95)' }}>Notifications</span>
                        {unreadCount > 0 && (
                          <span style={{
                            background: 'rgba(239,68,68,0.15)',
                            color: '#f87171',
                            border: '1px solid rgba(239,68,68,0.25)',
                            fontSize: 10, fontWeight: 800,
                            padding: '2px 7px', borderRadius: 999,
                          }}>
                            {unreadCount} new
                          </span>
                        )}
                      </div>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); markAllRead() }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            fontSize: 11, color: '#60a5fa',
                            background: 'rgba(96,165,250,0.08)',
                            border: '1px solid rgba(96,165,250,0.2)',
                            borderRadius: 7, padding: '4px 9px',
                            cursor: 'pointer', whiteSpace: 'nowrap',
                          }}
                        >
                          <Check size={11} /> All read
                        </button>
                      )}
                    </div>

                    {/* List */}
                    <div style={{
                      flex: 1, overflowY: 'auto', padding: 10,
                      display: 'flex', flexDirection: 'column', gap: 4,
                      scrollbarWidth: 'thin',
                      scrollbarColor: 'rgba(255,255,255,0.08) transparent',
                    }}>
                      {notifications.length === 0 ? (
                        <div style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center',
                          justifyContent: 'center', gap: 8, padding: '36px 16px',
                          color: 'rgba(148,163,184,0.5)',
                        }}>
                          <Bell size={28} style={{ opacity: 0.35 }} />
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'rgba(148,163,184,0.75)' }}>
                            You're all caught up!
                          </p>
                          <span style={{ fontSize: 11 }}>No new notifications</span>
                        </div>
                      ) : (
                        notifications.slice(0, 10).map((notif) => (
                          <button
                            key={notif.id}
                            type="button"
                            onClick={() => handleNotifClick(notif)}
                            style={{
                              width: '100%',
                              display: 'flex', alignItems: 'flex-start', gap: 10,
                              padding: '10px 10px 10px 8px',
                              borderRadius: 10,
                              border: notif.read
                                ? '1px solid rgba(255,255,255,0.04)'
                                : '1px solid rgba(96,165,250,0.12)',
                              background: notif.read
                                ? 'rgba(255,255,255,0.02)'
                                : 'rgba(96,165,250,0.06)',
                              cursor: 'pointer', textAlign: 'left',
                              color: 'rgba(235,242,255,0.9)',
                              opacity: notif.read ? 0.7 : 1,
                              transition: 'background 150ms, opacity 150ms',
                            }}
                          >
                            {/* Unread dot */}
                            <div style={{ width: 8, flexShrink: 0, paddingTop: 4, display: 'flex', justifyContent: 'center' }}>
                              {!notif.read && (
                                <span style={{
                                  width: 7, height: 7, borderRadius: '50%',
                                  background: '#3b82f6',
                                  boxShadow: '0 0 6px rgba(59,130,246,0.6)',
                                  display: 'block', flexShrink: 0,
                                }} />
                              )}
                            </div>
                            {/* Content */}
                            <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 2 }}>
                              <p style={{
                                margin: 0, fontSize: 12.5, fontWeight: 600,
                                color: 'rgba(235,242,255,0.95)',
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                              }}>{notif.title}</p>
                              <p style={{
                                margin: 0, fontSize: 11.5,
                                color: 'rgba(148,163,184,0.85)',
                                lineHeight: 1.45,
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                              }}>{notif.message}</p>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                                {notif.meta && (
                                  <span style={{
                                    fontSize: 10,
                                    background: 'rgba(59,130,246,0.15)',
                                    color: '#60a5fa',
                                    border: '1px solid rgba(59,130,246,0.2)',
                                    borderRadius: 4, padding: '1px 5px', fontWeight: 600,
                                  }}>{notif.meta}</span>
                                )}
                                <span style={{
                                  fontSize: 10, color: 'rgba(148,163,184,0.45)', marginLeft: 'auto',
                                }}>
                                  {formatTimeAgo(notif.createdAt)}
                                </span>
                              </div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>

                    {/* View all footer */}
                    {notifications.length > 0 && (
                      <div style={{
                        padding: '8px 10px 10px',
                        borderTop: '1px solid rgba(255,255,255,0.07)',
                        flexShrink: 0,
                      }}>
                        <button
                          type="button"
                          onClick={() => { setNotifOpen(false); setNotifModalOpen(true) }}
                          style={{
                            width: '100%',
                            background: 'rgba(59,130,246,0.08)',
                            border: '1px solid rgba(59,130,246,0.18)',
                            color: '#60a5fa', fontSize: 12.5, fontWeight: 600,
                            borderRadius: 9, padding: '9px', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          }}
                        >
                          <Bell size={13}/>
                          View all {notifications.length} notification{notifications.length !== 1 ? 's' : ''} →
                        </button>
                      </div>
                    )}
                  </div>
                  </>,
                  document.body
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

      {/* ── All Notifications Modal ── */}
      {notifModalOpen && ReactDOM.createPortal(
        <div
          onClick={() => setNotifModalOpen(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 10000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 520,
              maxHeight: '60vh',
              display: 'flex', flexDirection: 'column',
              background: '#0d1225',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 20,
              boxShadow: '0 32px 96px rgba(0,0,0,0.7)',
              overflow: 'hidden',
              animation: 'notif-panel-in 0.22s cubic-bezier(0.16,1,0.3,1) both',
            }}
          >
            {/* Modal header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '18px 20px 14px',
              borderBottom: '1px solid rgba(255,255,255,0.07)',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 10,
                  background: 'rgba(59,130,246,0.12)',
                  border: '1px solid rgba(59,130,246,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#60a5fa', flexShrink: 0,
                }}>
                  <Bell size={16} />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'rgba(235,242,255,0.97)' }}>All Notifications</div>
                  <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.6)', marginTop: 1 }}>
                    {notifications.length} total · {unreadCount} unread
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => markAllRead()}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      fontSize: 11, color: '#60a5fa',
                      background: 'rgba(96,165,250,0.08)',
                      border: '1px solid rgba(96,165,250,0.2)',
                      borderRadius: 7, padding: '5px 10px',
                      cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                  >
                    <Check size={11} /> Mark all read
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setNotifModalOpen(false)}
                  style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: 'rgba(148,163,184,0.8)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Modal list */}
            <div style={{
              flex: 1, overflowY: 'auto', padding: '10px 12px',
              display: 'flex', flexDirection: 'column', gap: 6,
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(255,255,255,0.08) transparent',
            }}>
              {notifications.length === 0 ? (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', gap: 10, padding: '60px 20px',
                  color: 'rgba(148,163,184,0.5)',
                }}>
                  <Bell size={36} style={{ opacity: 0.25 }} />
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'rgba(148,163,184,0.7)' }}>
                    You're all caught up!
                  </p>
                  <span style={{ fontSize: 12 }}>No notifications yet</span>
                </div>
              ) : (
                notifications.map((notif) => (
                  <button
                    key={notif.id}
                    type="button"
                    onClick={() => { setNotifModalOpen(false); handleNotifClick(notif) }}
                    style={{
                      width: '100%',
                      display: 'flex', alignItems: 'flex-start', gap: 12,
                      padding: '12px 12px 12px 10px',
                      borderRadius: 12,
                      border: notif.read
                        ? '1px solid rgba(255,255,255,0.04)'
                        : '1px solid rgba(96,165,250,0.15)',
                      background: notif.read
                        ? 'rgba(255,255,255,0.02)'
                        : 'rgba(96,165,250,0.07)',
                      cursor: 'pointer', textAlign: 'left',
                      color: 'rgba(235,242,255,0.9)',
                      opacity: notif.read ? 0.65 : 1,
                      transition: 'background 150ms, opacity 150ms',
                    }}
                  >
                    {/* Dot indicator */}
                    <div style={{ paddingTop: 5, width: 10, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                      {!notif.read ? (
                        <span style={{
                          width: 8, height: 8, borderRadius: '50%',
                          background: '#3b82f6',
                          boxShadow: '0 0 6px rgba(59,130,246,0.7)',
                          display: 'block',
                        }} />
                      ) : (
                        <span style={{
                          width: 8, height: 8, borderRadius: '50%',
                          background: 'rgba(148,163,184,0.2)',
                          display: 'block',
                        }} />
                      )}
                    </div>
                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        margin: '0 0 3px', fontSize: 13, fontWeight: notif.read ? 500 : 700,
                        color: notif.read ? 'rgba(148,163,184,0.8)' : 'rgba(235,242,255,0.97)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>{notif.title}</p>
                      <p style={{
                        margin: '0 0 6px', fontSize: 12,
                        color: 'rgba(148,163,184,0.8)', lineHeight: 1.5,
                      }}>{notif.message}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {notif.meta && (
                          <span style={{
                            fontSize: 10,
                            background: 'rgba(59,130,246,0.15)',
                            color: '#60a5fa',
                            border: '1px solid rgba(59,130,246,0.2)',
                            borderRadius: 4, padding: '2px 6px', fontWeight: 700,
                          }}>{notif.meta}</span>
                        )}
                        <span style={{
                          fontSize: 10.5, color: 'rgba(148,163,184,0.4)', marginLeft: 'auto',
                        }}>{formatTimeAgo(notif.createdAt)}</span>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Modal footer */}
            <div style={{
              padding: '12px 16px 16px',
              borderTop: '1px solid rgba(255,255,255,0.07)',
              flexShrink: 0, display: 'flex', gap: 8,
            }}>
              {role === 'TRAINING_PROVIDER' && (
                <button
                  type="button"
                  onClick={() => {
                    setNotifModalOpen(false)
                    guardedNavigate('/training/requests')
                  }}
                  style={{
                    flex: 1,
                    background: 'rgba(59,130,246,0.1)',
                    border: '1px solid rgba(59,130,246,0.22)',
                    color: '#60a5fa', fontSize: 13, fontWeight: 700,
                    borderRadius: 10, padding: '10px',
                    cursor: 'pointer',
                  }}
                >
                  Go to Requests →
                </button>
              )}
              <button
                type="button"
                onClick={() => setNotifModalOpen(false)}
                style={{
                  flex: role === 'TRAINING_PROVIDER' ? '0 0 auto' : 1,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: 'rgba(148,163,184,0.8)', fontSize: 13, fontWeight: 600,
                  borderRadius: 10,
                  padding: role === 'TRAINING_PROVIDER' ? '10px 16px' : '10px',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
