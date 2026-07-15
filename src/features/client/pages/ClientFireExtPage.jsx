/**
 * ClientFireExtPage
 * Fire Extinguisher Safety module accessible to COMPANY users.
 * Mirrors all routes from the dedicated FE dashboard so internal
 * navigate('/extinguisher/...') calls work correctly inside the client layout.
 */
import { FEDashboardPage }     from '../../fireExtinguisher-dashboard/pages/FEDashboardPage.jsx'
import { FEAssetRegistryPage } from '../../fireExtinguisher-dashboard/pages/FEAssetRegistryPage.jsx'
import { FERegisterAssetPage } from '../../fireExtinguisher-dashboard/pages/FERegisterAssetPage.jsx'
import { FEDetailPage }        from '../../fireExtinguisher-dashboard/pages/FEDetailPage.jsx'
import { FEInspectionPage }    from '../../fireExtinguisher-dashboard/pages/FEInspectionPage.jsx'
import { FECompliancePage }    from '../../fireExtinguisher-dashboard/pages/FECompliancePage.jsx'

export function ClientFireExtPage({ view = 'dashboard' }) {
  switch (view) {
    case 'assets':     return <FEAssetRegistryPage />
    case 'register':   return <FERegisterAssetPage />
    case 'detail':     return <FEDetailPage />
    case 'inspect':    return <FEInspectionPage />
    case 'compliance': return <FECompliancePage />
    default:           return <FEDashboardPage />
  }
}
