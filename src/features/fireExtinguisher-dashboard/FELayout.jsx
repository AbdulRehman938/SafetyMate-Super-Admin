import { useState, useEffect, useCallback } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Archive, ShieldCheck, Menu, LogOut, User } from 'lucide-react'
import { useAuth } from '../../app/providers/authContext.js'
import { initials, avatarColor } from './utils/feHelpers.js'
import './fe.css'

const NAV_ITEMS = [
  { to: '/extinguisher/dashboard',   label: 'Dashboard',             Icon: LayoutDashboard },
  { to: '/extinguisher/assets',      label: 'Asset Registry',        Icon: Archive         },
  { to: '/extinguisher/compliance',  label: 'Compliance Monitoring', Icon: ShieldCheck     },
]

function getGreeting(name) {
  const h = new Date().getHours()
  const first = name?.split(' ')[0] || name || 'there'
  if (h < 12) return `Good Morning, ${first}`
  if (h < 18) return `Good Afternoon, ${first}`
  return `Good Evening, ${first}`
}

export function FELayout() {
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
  const role        = profile?.role || 'FIRE_EXTINGUISHER'
  const avatarImg   = profile?.avatar || null
  const avi         = initials(displayName)
  const aviBg       = avatarColor(displayName)

  const sidebarClass = [
    'fe-sidebar',
    !isMobile && sidebarCollapsed ? 'collapsed' : '',
    isMobile && mobileSidebarOpen ? 'mobile-open' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className="fe-shell">

      {/* ── Sidebar ── */}
      <aside className={sidebarClass} aria-label="Sidebar navigation">

        {/* Brand */}
        <div className="fe-brand">
          <p className="fe-brand-name">SAFETY MATE</p>
          <p className="fe-brand-sub">FIRE DASHBOARD</p>
          <p className="fe-brand-icon">SM</p>
        </div>

        {/* Nav */}
        <nav className="fe-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `fe-nav-link${isActive ? ' active' : ''}`}
              onClick={() => isMobile && setMobileSidebarOpen(false)}
            >
              <span className="fe-nav-icon"><item.Icon size={15} /></span>
              <span className="fe-nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Bottom: profile + signout */}
        <div className="fe-sidebar-bottom">
          <button
            type="button"
            className="fe-profile-btn"
            onClick={() => {
              if (isMobile) setMobileSidebarOpen(false)
              navigate('/extinguisher/profile')
            }}
            title={sidebarCollapsed && !isMobile ? displayName : undefined}
          >
            <div className="fe-profile-avatar" style={{ background: aviBg }}>
              {avatarImg
                ? <img src={avatarImg} alt={displayName} onError={(e) => { e.target.style.display = 'none' }} />
                : avi}
            </div>
            <div className="fe-profile-info">
              <p className="fe-profile-name">{displayName}</p>
              <p className="fe-profile-role">
                {role === 'FIRE_EXTINGUISHER' ? 'Fire Safety Tech' : role}
              </p>
            </div>
          </button>

          <button type="button" className="fe-signout-btn" onClick={signOut}
            title={sidebarCollapsed && !isMobile ? 'Sign Out' : undefined}>
            <LogOut size={14} />
            <span className="fe-signout-label">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {isMobile && mobileSidebarOpen && (
        <button
          type="button"
          className="fe-overlay"
          aria-label="Close sidebar"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* ── Content shell ── */}
      <div className="fe-content-shell">

        {/* Topbar */}
        <header className="fe-topbar">
          <button
            type="button"
            className="fe-topbar-toggle"
            onClick={handleToggle}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <Menu size={16} />
          </button>

          {/* Logo and Brand */}
          <div className="fe-topbar-brand">
            <img className="fe-topbar-logo" src="/logo.png" alt="SafetyMate" />
            <p className="fe-topbar-brand-text">
              <span className="fe-topbar-brand-safety">Safety</span>
              <span className="fe-topbar-brand-mate">Mate</span>
            </p>
          </div>

          <span className="fe-topbar-greeting">{getGreeting(displayName)}</span>
          <span className="fe-topbar-sep">|</span>
          {/* Profile quick-access icon */}
          <button
            type="button"
            className="fe-icon-btn"
            onClick={() => navigate('/extinguisher/profile')}
            title="Profile Settings"
            style={{ marginLeft: 'auto', flexShrink: 0 }}
          >
            <User size={15} />
          </button>
        </header>

        {/* Page content */}
        <main className="fe-page-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
