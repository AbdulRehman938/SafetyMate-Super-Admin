import { Navigate, Route, Routes } from 'react-router-dom'
import { useEffect } from 'react'
import { AppLayout } from '../layout/AppLayout.jsx'
import { DashboardPage } from '../../features/dashboard/pages/DashboardPage.jsx'
import { CompanyPage } from '../../features/company/pages/CompanyPage.jsx'
import { CompanyDetailPage } from '../../features/company/pages/CompanyDetailPage.jsx'
import { NewSubscriberPage } from '../../features/company/pages/NewSubscriberPage.jsx'
import { SubscriberCreatedPage } from '../../features/company/pages/SubscriberCreatedPage.jsx'
import { SuspendSuccessPage } from '../../features/company/pages/SuspendSuccessPage.jsx'
import { UpgradePlanPage } from '../../features/company/pages/UpgradePlanPage.jsx'
import { UpgradeSuccessPage } from '../../features/company/pages/UpgradeSuccessPage.jsx'
import { ExtendSubscriptionPage } from '../../features/company/pages/ExtendSubscriptionPage.jsx'
import { BillingHistoryPage } from '../../features/company/pages/BillingHistoryPage.jsx'
import { InvoiceDetailPage } from '../../features/company/pages/InvoiceDetailPage.jsx'
import { SubscriptionPage } from '../../features/subscription/pages/SubscriptionPage.jsx'
import { AnnouncementComposerPage } from '../../features/announcement/pages/AnnouncementComposerPage.jsx'
import { BillingPage } from '../../features/billing/pages/BillingPage.jsx'
import { SecurityLogsPage } from '../../features/security/pages/SecurityLogsPage.jsx'
import { SettingsPage } from '../../features/settings/pages/SettingsPage.jsx'
import { UserProfilePage } from '../../features/users/pages/UserProfilePage.jsx'
import { ModuleRequestsPage } from '../../features/module-requests/pages/ModuleRequestsPage.jsx'
import { LoginPage } from '../../features/auth/pages/LoginPage.jsx'
import { MobileAppBlockedPage } from '../../features/mobile/pages/MobileAppBlockedPage.jsx'
import { ClientLayout } from '../../features/client/ClientLayout.jsx'
import { ClientHomePage } from '../../features/client/pages/ClientHomePage.jsx'
import { ClientDashboardPage } from '../../features/client/pages/ClientDashboardPage.jsx'
import { RiskAssessmentPage } from '../../features/client/pages/RiskAssessmentPage.jsx'
import { WorkforcePage } from '../../features/client/pages/WorkforcePage.jsx'
import { IncidentsPage } from '../../features/client/pages/IncidentsPage.jsx'
import { CertificatesPage } from '../../features/client/pages/CertificatesPage.jsx'
import { PPEPage } from '../../features/client/pages/PPEPage.jsx'
import { ClientFleetPage } from '../../features/client/pages/ClientFleetPage.jsx'
import { ClientFireExtPage } from '../../features/client/pages/ClientFireExtPage.jsx'
import { ClientFireDetPage } from '../../features/client/pages/ClientFireDetPage.jsx'
import { TrainingDashboardPage } from '../../features/training-dashboard/pages/TrainingDashboardPage.jsx'
import { FleetDashboardPage }       from '../../features/fleet-dashboard/pages/FleetDashboardPage.jsx'
import { SiteMapPage }              from '../../features/fleet-dashboard/pages/SiteMapPage.jsx'
import { VehicleTwinsPage }         from '../../features/fleet-dashboard/pages/VehicleTwinsPage.jsx'
import { InspectionLogPage }        from '../../features/fleet-dashboard/pages/InspectionLogPage.jsx'
import { FuelIntelligencePage }     from '../../features/fleet-dashboard/pages/FuelIntelligencePage.jsx'
import { ProfileSettingsPage }      from '../../features/fleet-dashboard/pages/ProfileSettingsPage.jsx'
import { FELayout }             from '../../features/fireExtinguisher-dashboard/FELayout.jsx'
import { FEDashboardPage }      from '../../features/fireExtinguisher-dashboard/pages/FEDashboardPage.jsx'
import { FEAssetRegistryPage }  from '../../features/fireExtinguisher-dashboard/pages/FEAssetRegistryPage.jsx'
import { FERegisterAssetPage }  from '../../features/fireExtinguisher-dashboard/pages/FERegisterAssetPage.jsx'
import { FEInspectionPage }     from '../../features/fireExtinguisher-dashboard/pages/FEInspectionPage.jsx'
import { FECompliancePage }     from '../../features/fireExtinguisher-dashboard/pages/FECompliancePage.jsx'
import { FEProfilePage }        from '../../features/fireExtinguisher-dashboard/pages/FEProfilePage.jsx'
import { FEDetailPage }         from '../../features/fireExtinguisher-dashboard/pages/FEDetailPage.jsx'
import { FDLayout } from '../../features/fireDetection-dashboard/layout/FDLayout.jsx'
import { FDDashboardPage } from '../../features/fireDetection-dashboard/pages/FDDashboardPage.jsx'
import { FDProfilePage } from '../../features/fireDetection-dashboard/pages/FDProfilePage.jsx'
import { AssetRegistryPage } from '../../features/fireDetection-dashboard/pages/AssetRegistryPage.jsx'
import { HydrantDetailPage } from '../../features/fireDetection-dashboard/pages/HydrantDetailPage.jsx'
import { PanelRegistryPage } from '../../features/fireDetection-dashboard/pages/PanelRegistryPage.jsx'
import { PanelDetailPage } from '../../features/fireDetection-dashboard/pages/PanelDetailPage.jsx'
import { InspectionPage } from '../../features/fireDetection-dashboard/pages/InspectionPage.jsx'
import { InspectionHistoryPage } from '../../features/fireDetection-dashboard/pages/InspectionHistoryPage.jsx'
import { RegisterPanelPage } from '../../features/fireDetection-dashboard/pages/RegisterPanelPage.jsx'
import { PanelInspectionPage } from '../../features/fireDetection-dashboard/pages/PanelInspectionPage.jsx'
import { ComplianceMonitoringPage } from '../../features/fireDetection-dashboard/pages/ComplianceMonitoringPage.jsx'
import { useAuth } from '../providers/authContext.js'

export function AppRouter() {
  const {
    authReady,
    authUser,
    role,
    organizationId,
    loadingProfile,
    profileStatus,
    profile,
    error,
    setError,
    signOut,
  } = useAuth()

  const isSuperAdmin = role === 'SUPER_ADMIN'
  const isProvider = ['TRAINING_PROVIDER', 'FLEET', 'FIRE_EXTINGUISHER', 'FIRE_DETECTION'].includes(role)
  const isClientUser =
    Boolean(profile && (organizationId || isProvider) && profileStatus === 'loaded' && !isSuperAdmin)

  useEffect(() => {
    if (!authReady) return
    if (!authUser) return
    if (loadingProfile) return
    if (profileStatus === 'forbidden') return
    if (isSuperAdmin) return
    if (isClientUser) return
    // Handled in-render: show “no organization” panel instead of signing out.
    if (profileStatus === 'loaded' && profile && !organizationId && !isProvider) return

    if (profileStatus === 'missing' || profileStatus === 'error') {
      signOut()
      setError('Unauthorized: sign in with a valid Safety Mate account.')
    }
  }, [
    authReady,
    authUser,
    loadingProfile,
    profileStatus,
    profile,
    organizationId,
    isSuperAdmin,
    isClientUser,
    isProvider,
    setError,
    signOut,
  ])

  if (!authReady) {
    return (
      <section className="login-shell">
        <div className="login-content-wrap">
          <header className="login-header">
            <img className="login-logo-img" src="/logo.png" alt="SafetyMate" />
            <h1 className="login-brand">
              <span className="brand-safety">Safety</span>
              <span className="brand-mate">Mate</span>
            </h1>
          </header>
          <article className="panel login-card loading-state-card">
            <div className="loading-spinner" aria-hidden="true" />
            <p className="loading-state-title">Initializing</p>
            <p className="loading-state-sub">Checking your session…</p>
          </article>
        </div>
      </section>
    )
  }

  if (!authUser) {
    return <LoginPage initialError={error} />
  }

  if (loadingProfile) {
    return (
      <section className="login-shell">
        <div className="login-content-wrap">
          <header className="login-header">
            <img className="login-logo-img" src="/logo.png" alt="SafetyMate" />
            <h1 className="login-brand">
              <span className="brand-safety">Safety</span>
              <span className="brand-mate">Mate</span>
            </h1>
          </header>
          <article className="panel login-card loading-state-card">
            <div className="loading-spinner" aria-hidden="true" />
            <p className="loading-state-title">Verifying Access</p>
            <p className="loading-state-sub">Loading your profile and permissions…</p>
          </article>
        </div>
      </section>
    )
  }

  if (profileStatus === 'forbidden') {
    return (
      <section className="login-shell">
        <div className="login-content-wrap">
          <header className="login-header">
            <img className="login-logo-img" src="/logo.png" alt="SafetyMate" />
            <h1 className="login-brand">
              <span className="brand-safety">Safety</span>
              <span className="brand-mate">Mate</span>
            </h1>
          </header>
          <article className="panel login-card loading-state-card loading-state-card--error">
            <div className="loading-state-icon loading-state-icon--error">⛔</div>
            <p className="loading-state-title">Permission Denied</p>
            <p className="loading-state-sub">
              Firestore blocked access to your profile. Ensure rules allow{' '}
              <code className="loading-state-code">SUPER_ADMIN</code> and{' '}
              <code className="loading-state-code">user_profiles/{'{uid}'}</code> reads.
            </p>
            <button className="secure-signin-btn" style={{ marginTop: '20px' }} type="button" onClick={() => signOut()}>
              Sign out
            </button>
          </article>
        </div>
      </section>
    )
  }

  if (profileStatus === 'loaded' && profile && !organizationId && !isSuperAdmin && !isProvider) {
    return (
      <section className="login-shell">
        <div className="login-content-wrap">
          <header className="login-header">
            <img className="login-logo-img" src="/logo.png" alt="SafetyMate" />
            <h1 className="login-brand">
              <span className="brand-safety">Safety</span>
              <span className="brand-mate">Mate</span>
            </h1>
          </header>
          <article className="panel login-card loading-state-card loading-state-card--warn">
            <div className="loading-state-icon loading-state-icon--warn">🔗</div>
            <p className="loading-state-title">No Organization Linked</p>
            <p className="loading-state-sub">
              Your account is not linked to an organization yet. Contact your administrator to get assigned.
            </p>
            <button className="secure-signin-btn" style={{ marginTop: '20px' }} type="button" onClick={() => signOut()}>
              Sign out
            </button>
          </article>
        </div>
      </section>
    )
  }

  if (isClientUser) {
    if (role === 'TRAINING_PROVIDER') {
      return (
        <Routes>
          <Route element={<ClientLayout />}>
            <Route path="/training/dashboard" element={<TrainingDashboardPage view="overview" />} />
            <Route path="/training/requests" element={<TrainingDashboardPage view="requests" />} />
            <Route path="/training/calendar" element={<TrainingDashboardPage view="calendar" />} />
            <Route path="/training/certificates" element={<TrainingDashboardPage view="certificates" />} />
          </Route>
          <Route path="*" element={<Navigate to="/training/dashboard" replace />} />
        </Routes>
      )
    }

    if (role === 'FLEET') {
      return (
        <Routes>
          <Route element={<ClientLayout />}>
            <Route path="/fleet/dashboard"   element={<FleetDashboardPage />} />
            <Route path="/fleet/site-map"    element={<SiteMapPage />} />
            <Route path="/fleet/twins"       element={<VehicleTwinsPage />} />
            <Route path="/fleet/inspections" element={<InspectionLogPage />} />
            <Route path="/fleet/fuel"        element={<FuelIntelligencePage />} />
            <Route path="/fleet/profile"     element={<ProfileSettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/fleet/dashboard" replace />} />
        </Routes>
      )
    }

    if (role === 'FIRE_EXTINGUISHER') {
      return (
        <Routes>
          <Route element={<FELayout />}>
            <Route path="/extinguisher/dashboard"             element={<FEDashboardPage />} />
            <Route path="/extinguisher/assets"                element={<FEAssetRegistryPage />} />
            <Route path="/extinguisher/assets/new"            element={<FERegisterAssetPage />} />
            <Route path="/extinguisher/assets/:id"             element={<FEDetailPage />} />
            <Route path="/extinguisher/assets/:assetId/inspect" element={<FEInspectionPage />} />
            <Route path="/extinguisher/compliance"            element={<FECompliancePage />} />
            <Route path="/extinguisher/profile"               element={<FEProfilePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/extinguisher/dashboard" replace />} />
        </Routes>
      )
    }

    if (role === 'FIRE_DETECTION') {
      return (
        <Routes>
          <Route element={<FDLayout />}>
            <Route path="/detection/dashboard"           element={<FDDashboardPage />} />
            <Route path="/detection/assets"               element={<AssetRegistryPage />} />
            <Route path="/detection/assets/:id"           element={<HydrantDetailPage />} />
            <Route path="/detection/inspection"           element={<InspectionPage />} />
            <Route path="/detection/inspection-history/:id" element={<InspectionHistoryPage />} />
            <Route path="/detection/panels"               element={<PanelRegistryPage />} />
            <Route path="/detection/panels/:id"           element={<PanelDetailPage />} />
            <Route path="/detection/panels/new"           element={<RegisterPanelPage />} />
            <Route path="/detection/panel-inspection"     element={<PanelInspectionPage />} />
            <Route path="/detection/compliance"            element={<ComplianceMonitoringPage />} />
            <Route path="/detection/profile"               element={<FDProfilePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/detection/dashboard" replace />} />
        </Routes>
      )
    }

    return (
      <Routes>
        <Route element={<ClientLayout />}>
          <Route path="/client/home"           element={<ClientHomePage />} />
          <Route path="/client/dashboard"      element={<ClientDashboardPage />} />
          <Route path="/client/risk-assessment" element={<RiskAssessmentPage />} />
          <Route path="/client/incidents"      element={<IncidentsPage />} />
          <Route path="/client/certificates"   element={<CertificatesPage />} />
          <Route path="/client/workforce"      element={<WorkforcePage />} />
          <Route path="/client/ppe"            element={<PPEPage />} />

          {/* ── Fleet module ── */}
          <Route path="/client/fleet"                element={<ClientFleetPage view="dashboard" />} />
          <Route path="/client/fleet/site-map"       element={<ClientFleetPage view="site-map" />} />
          <Route path="/client/fleet/vehicles"       element={<ClientFleetPage view="vehicles" />} />
          <Route path="/client/fleet/inspections"    element={<ClientFleetPage view="inspections" />} />
          <Route path="/client/fleet/fuel"           element={<ClientFleetPage view="fuel" />} />

          {/* ── Fire Extinguisher module ── */}
          <Route path="/client/fire-ext"             element={<ClientFireExtPage view="dashboard" />} />
          <Route path="/client/fire-ext/assets"      element={<ClientFireExtPage view="assets" />} />
          <Route path="/client/fire-ext/compliance"  element={<ClientFireExtPage view="compliance" />} />

          {/* ── Fire Detection module ── */}
          <Route path="/client/fire-det"             element={<ClientFireDetPage view="dashboard" />} />
          <Route path="/client/fire-det/assets"      element={<ClientFireDetPage view="assets" />} />
          <Route path="/client/fire-det/panels"      element={<ClientFireDetPage view="panels" />} />
          <Route path="/client/fire-det/inspections" element={<ClientFireDetPage view="inspections" />} />
          <Route path="/client/fire-det/compliance"  element={<ClientFireDetPage view="compliance" />} />
        </Route>
        <Route path="/" element={<Navigate to="/client/home" replace />} />
        <Route path="*" element={<Navigate to="/client/home" replace />} />
      </Routes>
    )
  }

  if (!isSuperAdmin) {
    return <LoginPage initialError={error || 'Unauthorized: Super Admin access required.'} />
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/company" element={<CompanyPage />} />
        <Route path="/company/new" element={<NewSubscriberPage />} />
        <Route path="/company/created" element={<SubscriberCreatedPage />} />
        <Route path="/company/:companyId" element={<CompanyDetailPage />} />
        <Route path="/company/:companyId/suspend-success" element={<SuspendSuccessPage />} />
        <Route path="/company/:companyId/upgrade" element={<UpgradePlanPage />} />
        <Route path="/company/:companyId/upgrade-success" element={<UpgradeSuccessPage />} />
        <Route path="/company/:companyId/extend" element={<ExtendSubscriptionPage />} />
        <Route path="/company/:companyId/billing-history" element={<BillingHistoryPage />} />
        <Route path="/company/:companyId/billing-history/:invoiceDocId" element={<InvoiceDetailPage />} />
        <Route path="/invoices/:invoiceDocId" element={<InvoiceDetailPage />} />
        <Route path="/subscription" element={<SubscriptionPage />} />
        <Route path="/announcements" element={<AnnouncementComposerPage />} />
        <Route path="/billing" element={<BillingPage />} />
        <Route path="/security-logs" element={<SecurityLogsPage />} />
        <Route path="/module-requests" element={<ModuleRequestsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/users/:uid" element={<UserProfilePage />} />
        <Route path="/mobile" element={<MobileAppBlockedPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  )
}
