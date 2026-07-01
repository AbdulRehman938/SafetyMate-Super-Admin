import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Bell, Search, UserCircle2 } from 'lucide-react'
import { useAuth } from '../providers/authContext.js'
import { CopyrightFooter } from '../../shared/components/CopyrightFooter.jsx'

export function TopNavLayout() {
  const location = useLocation()
  const { profile } = useAuth()
  const name = profile?.fullName || profile?.name || profile?.email || 'Super Admin'
  const isExtendRoute = location.pathname.includes('/extend')
  const isBillingRoute = location.pathname.includes('/billing-history')
  const isInvoiceDetailRoute =
    location.pathname.includes('/billing-history/') && !location.pathname.endsWith('/billing-history')

  return (
    <div className="topnav-shell">
      <header className="topnav">
        <div className="topnav-left">
          <div className="topnav-brand">
            <span className="topnav-mark" aria-hidden="true" />
            <span className="topnav-brand-text">
              Safety<span>Mate</span>
            </span>
          </div>

          <nav className="topnav-links">
            <NavLink to="/dashboard" className={({ isActive }) => `topnav-link ${isActive ? 'topnav-active' : ''}`}>
              Dashboard
            </NavLink>
            <NavLink to="/company" className={({ isActive }) => `topnav-link ${isActive ? 'topnav-active' : ''}`}>
              Subscribers
            </NavLink>
            {isExtendRoute ? (
              <span className="topnav-link topnav-active" aria-current="page">
                Extend Subscription
              </span>
            ) : null}
            {isBillingRoute && !isInvoiceDetailRoute ? (
              <span className="topnav-link topnav-active" aria-current="page">
                Billing History
              </span>
            ) : null}
            {isInvoiceDetailRoute ? (
              <span className="topnav-link topnav-active" aria-current="page">
                Invoice Detail
              </span>
            ) : null}
            <button type="button" className="topnav-link topnav-muted">
              Settings
            </button>
          </nav>
        </div>

        <div className="topnav-right">
          <div className="topnav-search">
            <Search size={16} />
            <input placeholder="Search accounts..." />
          </div>
          <button type="button" className="topnav-icon" aria-label="Notifications">
            <Bell size={16} />
          </button>
          <div className="topnav-user">
            <UserCircle2 size={18} />
            <div>
              <p>{name}</p>
              <span>Super Admin</span>
            </div>
          </div>
        </div>
      </header>

      <main className="topnav-content">
        <Outlet />
      </main>
      <CopyrightFooter />
    </div>
  )
}

