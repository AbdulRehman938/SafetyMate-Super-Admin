/**
 * ClientFireDetPage
 * Fire Detection & Alarms module accessible to COMPANY users.
 * Renders the matching FD page component based on the `view` prop.
 */
import { FDDashboardPage }          from '../../fireDetection-dashboard/pages/FDDashboardPage.jsx'
import { AssetRegistryPage }        from '../../fireDetection-dashboard/pages/AssetRegistryPage.jsx'
import { PanelRegistryPage }        from '../../fireDetection-dashboard/pages/PanelRegistryPage.jsx'
import { InspectionPage }           from '../../fireDetection-dashboard/pages/InspectionPage.jsx'
import { ComplianceMonitoringPage } from '../../fireDetection-dashboard/pages/ComplianceMonitoringPage.jsx'

export function ClientFireDetPage({ view = 'dashboard' }) {
  switch (view) {
    case 'assets':      return <AssetRegistryPage />
    case 'panels':      return <PanelRegistryPage />
    case 'inspections': return <InspectionPage />
    case 'compliance':  return <ComplianceMonitoringPage />
    default:            return <FDDashboardPage />
  }
}
