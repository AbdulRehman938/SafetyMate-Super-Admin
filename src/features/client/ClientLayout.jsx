import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Award,
  Bell,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  UserCircle2,
  Users,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '../../app/providers/authContext.js'
import { GlobalSearch } from './components/GlobalSearch.jsx'
import './client.css'

const NAV = [
  { to: '/client/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/client/risk-assessment', label: 'Risk Assessment', icon: ClipboardList },
  { to: '/client/incidents', label: 'Incidents', icon: AlertTriangle },
  { to: '/client/certificates', label: 'Certificates', icon: Award },
  { to: '/client/workforce', label: 'Workforce', icon: Users },
  { to: '/client/ppe', label: 'PPE & Assets', icon: Package },
]

const SIDEBAR_W = 280
const MOBILE_BP = '(max-width: 960px)'
const sidebarSpring = { type: 'spring', stiffness: 400, damping: 40 }
const overlayTween = { duration: 0.25, ease: 'easeInOut' }

export function ClientLayout() {
  const navigate = useNavigate()
  const { profile, signOut } = useAuth()
  const displayName = profile?.fullName || profile?.name || profile?.email || '—'

  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_BP).matches)
  const [sidebarOpen, setSidebarOpen] = useState(() => !window.matchMedia(MOBILE_BP).matches)

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

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') setSidebarOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const closeSidebarIfMobile = () => {
    if (window.matchMedia(MOBILE_BP).matches) setSidebarOpen(false)
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
            navigate('/client/dashboard')
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
          {NAV.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
                onClick={closeSidebarIfMobile}
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
            onClick={() => signOut()}
            aria-label="Log out"
            title="Log out"
          >
            <LogOut size={16} />
          </button>
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
            <button type="button" aria-label="Notifications">
              <Bell size={15} />
            </button>
          </div>
        </header>

        <main className="page-content client-page-content">
          <Outlet />
        </main>
      </motion.div>
    </div>
  )
}
