/**
 * ClientFireDetPage
 * Fire Detection & Alarms module accessible to COMPANY users.
 * Mirrors all routes from the dedicated FD dashboard so internal
 * navigate('/detection/...') calls work correctly inside the client layout.
 */
import { FDDashboardPage }          from '../../fireDetection-dashboard/pages/FDDashboardPage.jsx'
import { AssetRegistryPage }        from '../../fireDetection-dashboard/pages/AssetRegistryPage.jsx'
import { HydrantDetailPage }        from '../../fireDetection-dashboard/pages/HydrantDetailPage.jsx'
import { PanelRegistryPage }        from '../../fireDetection-dashboard/pages/PanelRegistryPage.jsx'
import { RegisterPanelPage }        from '../../fireDetection-dashboard/pages/RegisterPanelPage.jsx'
import { PanelDetailPage }          from '../../fireDetection-dashboard/pages/PanelDetailPage.jsx'
import { InspectionPage }           from '../../fireDetection-dashboard/pages/InspectionPage.jsx'
import { InspectionHistoryPage }    from '../../fireDetection-dashboard/pages/InspectionHistoryPage.jsx'
import { PanelInspectionPage }      from '../../fireDetection-dashboard/pages/PanelInspectionPage.jsx'
import { ComplianceMonitoringPage } from '../../fireDetection-dashboard/pages/ComplianceMonitoringPage.jsx'

export function ClientFireDetPage({ view = 'dashboard' }) {
  switch (view) {
    case 'assets':            return <AssetRegistryPage />
    case 'assetDetail':       return <HydrantDetailPage />
    case 'panels':            return <PanelRegistryPage />
    case 'registerPanel':     return <RegisterPanelPage />
    case 'panelDetail':       return <PanelDetailPage />
    case 'inspections':       return <InspectionPage />
    case 'inspectionHistory': return <InspectionHistoryPage />
    case 'panelInspection':   return <PanelInspectionPage />
    case 'compliance':        return <ComplianceMonitoringPage />
    default:                  return <FDDashboardPage />
  }
}
