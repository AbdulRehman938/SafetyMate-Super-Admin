import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Bell,
  Building2,
  LayoutDashboard,
  LogOut,
  Menu,
  Megaphone,
  Search,
  Settings,
  ShieldCheck,
  UserCircle2,
  WalletCards,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { collection, getDocs, limit, onSnapshot, orderBy, query, startAt, endAt, where } from 'firebase/firestore'
import { useAuth } from '../providers/authContext.js'
import { getOrganizationLabel } from '../../shared/auth/currentUser.js'
import { db } from '../../config/firebase.js'

const primaryNavItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/company', label: 'Companies', icon: Building2 },
]

const secondaryNavItems = [
  { to: '/announcements', label: 'Announcements', icon: Megaphone },
  { to: '/billing', label: 'Billing & Payment', icon: WalletCards },
  { to: '/security-logs', label: 'Security & Logs', icon: ShieldCheck },
]

const SIDEBAR_W = 280
const MOBILE_BP = '(max-width: 960px)'
const sidebarSpring = { type: 'spring', stiffness: 400, damping: 40 }
const overlayTween = { duration: 0.25, ease: 'easeInOut' }

export function AppLayout() {
  const navigate = useNavigate()
  const { profile, signOut } = useAuth()
  const name = profile?.fullName || profile?.name || profile?.email || '—'
  const orgLabel = getOrganizationLabel(profile)

  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_BP).matches)
  const [sidebarOpen, setSidebarOpen] = useState(() => !window.matchMedia(MOBILE_BP).matches)
  const [q, setQ] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [companyResults, setCompanyResults] = useState([])
  const [searchBusy, setSearchBusy] = useState(false)
  const searchWrapRef = useRef(null)

  const [alertsOpen, setAlertsOpen] = useState(false)
  const [recentAlerts, setRecentAlerts] = useState([])
  const [hasActiveAlerts, setHasActiveAlerts] = useState(false)
  const alertsRef = useRef(null)

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
    // Close popovers on outside click.
    function onPointerDown(e) {
      const el = e.target
      if (!(el instanceof HTMLElement)) return
      if (searchWrapRef.current && !searchWrapRef.current.contains(el)) setSearchOpen(false)
      if (alertsRef.current && !alertsRef.current.contains(el)) setAlertsOpen(false)
    }
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        setSearchOpen(false)
        setAlertsOpen(false)
        setSidebarOpen(false)
      }
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  useEffect(() => {
    // SOS ACTIVE alerts indicator + recent list.
    const sosRef = collection(db, 'sos_alerts')
    const qActive = query(sosRef, where('status', '==', 'ACTIVE'), orderBy('triggeredAt', 'desc'), limit(3))
    const unsub = onSnapshot(
      qActive,
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        setRecentAlerts(docs)
        setHasActiveAlerts(docs.length > 0)
      },
      () => {
        setRecentAlerts([])
        setHasActiveAlerts(false)
      },
    )
    return () => unsub()
  }, [])

  useEffect(() => {
    let cancelled = false
    const term = q.trim()
    if (!term) {
      setCompanyResults([])
      setSearchBusy(false)
      return
    }

    setSearchBusy(true)
    const t = window.setTimeout(async () => {
      try {
        const orgsRef = collection(db, 'organizations')

        const orgQuery = query(
          orgsRef,
          orderBy('name'),
          startAt(term),
          endAt(`${term}\uf8ff`),
          limit(6),
        )
        const orgSnap = await getDocs(orgQuery).catch(() => null)
        if (cancelled) return

        setCompanyResults(
          (orgSnap?.docs || []).map((d) => ({
            id: d.id,
            name: d.data()?.name || d.data()?.companyName || d.id,
          })),
        )
      } finally {
        if (!cancelled) setSearchBusy(false)
      }
    }, 180)

    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [q])

  const anySearchResults = useMemo(
    () => companyResults.length > 0,
    [companyResults.length],
  )

  const closeSidebarIfMobile = () => {
    if (window.matchMedia('(max-width: 960px)').matches) setSidebarOpen(false)
  }

  return (
    <div className={`app-shell ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      <motion.aside
        className="sidebar"
        initial={false}
        animate={{ x: sidebarOpen ? 0 : '-105%' }}
        transition={sidebarSpring}
      >
        <button
          type="button"
          className="brand-row brand-home"
          onClick={() => {
            closeSidebarIfMobile()
            navigate('/dashboard')
          }}
          aria-label="Go to Dashboard"
        >
          <img className="brand-logo" src="/logo.png" alt="SafetyMate" />
          <p className="brand">
            <span className="brand-safety">Safety</span>
            <span className="brand-mate">Mate</span>
          </p>
        </button>
        <nav className="sidebar-nav">
          {primaryNavItems.map((item) => {
            const Icon = item.icon
            return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `nav-link ${isActive ? 'nav-link-active' : ''}`
              }
              onClick={closeSidebarIfMobile}
            >
              <span className="nav-icon">
                <Icon size={14} />
              </span>
              {item.label}
            </NavLink>
            )
          })}

          {secondaryNavItems.map((item) => {
            const Icon = item.icon
            if (item.to) {
              return (
                <NavLink
                  key={item.label}
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
            }
            return (
            <button key={item.label} className="nav-link nav-button-muted" type="button">
              <span className="nav-icon">
                <Icon size={14} />
              </span>
              {item.label}
            </button>
            )
          })}
        </nav>

        <div className="profile-strip">
          <div className="profile-avatar">
            <UserCircle2 size={16} />
          </div>
          <div>
            <p className="profile-name">{name}</p>
            <p className="profile-role">{orgLabel}</p>
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
        className="content-shell"
        initial={false}
        animate={{ marginLeft: !isMobile && sidebarOpen ? SIDEBAR_W : 0 }}
        transition={sidebarSpring}
      >
        <header className="topbar">
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
          <div className="topbar-search-wrap" ref={searchWrapRef}>
            <div className="search-box">
              <span>
                <Search size={15} />
              </span>
              <input
                placeholder="Search companies..."
                type="text"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value)
                  setSearchOpen(true)
                }}
                onFocus={() => setSearchOpen(true)}
              />
            </div>

            {searchOpen && q.trim() ? (
              <div className="topbar-search-dropdown" role="listbox">
                {searchBusy ? <div className="topbar-search-empty">Searching…</div> : null}

                {!searchBusy && !anySearchResults ? (
                  <div className="topbar-search-empty">No results found.</div>
                ) : null}

                {companyResults.length ? (
                  <div className="topbar-search-group">
                    <p>Companies</p>
                    {companyResults.map((r) => (
                      <button
                        type="button"
                        key={r.id}
                        className="topbar-search-item"
                        onClick={() => {
                          setSearchOpen(false)
                          setQ('')
                          navigate(`/company/${r.id}`, { state: { companyId: r.id, companyName: r.name } })
                        }}
                      >
                        <b>{r.name}</b>
                        <span>{r.id}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="topbar-icons">
            <div className="topbar-bell-wrap" ref={alertsRef}>
              <button
                type="button"
                aria-label="Notifications"
                onClick={() => setAlertsOpen((v) => !v)}
              >
                <Bell size={15} />
                {hasActiveAlerts ? <span className="bell-badge" aria-hidden="true" /> : null}
              </button>
              {alertsOpen ? (
                <div className="topbar-bell-popover" role="menu">
                  <div className="topbar-bell-head">
                    <b>Active Alerts</b>
                    <span>{recentAlerts.length ? `${recentAlerts.length} active` : 'None'}</span>
                  </div>
                  {recentAlerts.length ? (
                    <div className="topbar-bell-list">
                      {recentAlerts.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          className="topbar-bell-item"
                          onClick={() => {
                            setAlertsOpen(false)
                            navigate('/dashboard')
                          }}
                        >
                          <b>{a.organizationName || a.companyName || 'Organization'}</b>
                          <span>{String(a.message || a.description || 'SOS alert active').slice(0, 70)}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="topbar-search-empty">System secure.</div>
                  )}
                </div>
              ) : null}
            </div>

            <button type="button" aria-label="Settings" onClick={() => navigate('/settings')}>
              <Settings size={15} />
            </button>
          </div>
        </header>
        <main className="page-content">
          <Outlet />
        </main>
      </motion.div>
    </div>
  )
}
