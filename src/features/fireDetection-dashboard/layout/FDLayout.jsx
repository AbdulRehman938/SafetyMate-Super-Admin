import { useState, useEffect, useCallback } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Archive, ShieldCheck, Menu, LogOut, User } from 'lucide-react'
import { useAuth } from '../../../app/providers/authContext.js'
import { initials, avatarColor } from '../utils/fdHelpers.js'
import '../fd.css'

const NAV_ITEMS = [
  { to: '/detection/dashboard',   label: 'Dashboard',             Icon: LayoutDashboard },
  { to: '/detection/assets',       label: 'Asset Registry',        Icon: Archive         },
  { to: '/detection/inspection',   label: 'Inspection',            Icon: ShieldCheck     },
  { to: '/detection/panels',       label: 'Panel Registry',        Icon: Archive         },
  { to: '/detection/panel-inspection', label: 'Panel Inspection', Icon: ShieldCheck     },
  { to: '/detection/compliance',  label: 'Compliance Monitoring', Icon: ShieldCheck     },
]

function getGreeting(name) {
  const h = new Date().getHours()
  const first = name?.split(' ')[0] || name || 'there'
  if (h < 12) return `Good Morning, ${first}`
  if (h < 18) return `Good Afternoon, ${first}`
  return `Good Evening, ${first}`
}

export function FDLayout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 960)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 960px)')
    const apply = () => {
      setIsMobile(mq.matches)
      if (!mq.matches) setMobileSidebarOpen(false)
    }
    apply()
    mq.addEventListener?.('change', apply)
    return () => mq.removeEventListener?.('change', apply)
  }, [])

  // Close mobile sidebar on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setMobileSidebarOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const handleToggle = useCallback(() => {
    if (isMobile) setMobileSidebarOpen((v) => !v)
    else setSidebarCollapsed((v) => !v)
  }, [isMobile])

  const displayName = profile?.fullName || profile?.name || profile?.email || 'User'
  const role        = profile?.role || 'FIRE_DETECTION'
  const avatarImg   = profile?.avatar || null
  const avi         = initials(displayName)
  const aviBg       = avatarColor(displayName)

  const sidebarClass = [
    'fd-sidebar',
    !isMobile && sidebarCollapsed ? 'collapsed' : '',
    isMobile && mobileSidebarOpen ? 'mobile-open' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className="fd-shell">

      {/* ── Sidebar ── */}
      <aside className={sidebarClass} aria-label="Sidebar navigation">

        {/* Brand */}
        <div className="fd-brand">
          <p className="fd-brand-name">SAFETY MATE</p>
          <p className="fd-brand-sub">FIRE DASHBOARD</p>
          <p className="fd-brand-icon">SM</p>
        </div>

        {/* Nav */}
        <nav className="fd-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `fd-nav-link${isActive ? ' active' : ''}`}
              onClick={() => isMobile && setMobileSidebarOpen(false)}
            >
              <span className="fd-nav-icon"><item.Icon size={15} /></span>
              <span className="fd-nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Bottom: profile + signout */}
        <div className="fd-sidebar-bottom">
          <button
            type="button"
            className="fd-profile-btn"
            onClick={() => {
              if (isMobile) setMobileSidebarOpen(false)
              navigate('/detection/profile')
            }}
            title={sidebarCollapsed && !isMobile ? displayName : undefined}
          >
            <div className="fd-profile-avatar" style={{ background: aviBg }}>
              {avatarImg
                ? <img src={avatarImg} alt={displayName} onError={(e) => { e.target.style.display = 'none' }} />
                : avi}
            </div>
            <div className="fd-profile-info">
              <p className="fd-profile-name">{displayName}</p>
              <p className="fd-profile-role">
                {role === 'FIRE_DETECTION' ? 'Fire Detection Tech' : role}
              </p>
            </div>
          </button>

          <button type="button" className="fd-signout-btn" onClick={signOut}
            title={sidebarCollapsed && !isMobile ? 'Sign Out' : undefined}>
            <LogOut size={14} />
            <span className="fd-signout-label">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {isMobile && mobileSidebarOpen && (
        <button
          type="button"
          className="fd-overlay"
          aria-label="Close sidebar"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* ── Content shell ── */}
      <div className="fd-content-shell">

        {/* Topbar */}
        <header className="fd-topbar">
          <button
            type="button"
            className="fd-topbar-toggle"
            onClick={handleToggle}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <Menu size={16} />
          </button>

          {/* Logo and Brand */}
          <div className="fd-topbar-brand">
            <img className="fd-topbar-logo" src="/logo.png" alt="SafetyMate" />
            <p className="fd-topbar-brand-text">
              <span className="fd-topbar-brand-safety">Safety</span>
              <span className="fd-topbar-brand-mate">Mate</span>
            </p>
          </div>

          <span className="fd-topbar-greeting">{getGreeting(displayName)}</span>
          <span className="fd-topbar-sep">|</span>

          {/* Profile quick-access icon */}
          <button
            type="button"
            className="fd-icon-btn"
            onClick={() => navigate('/detection/profile')}
            title="Profile Settings"
            style={{ marginLeft: 'auto', flexShrink: 0 }}
          >
            <User size={15} />
          </button>
        </header>

        {/* Page content */}
        <main className="fd-page-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
