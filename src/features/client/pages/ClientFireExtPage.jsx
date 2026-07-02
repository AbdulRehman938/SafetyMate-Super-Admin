/**
 * ClientFireExtPage
 * Fire Extinguisher Safety module accessible to COMPANY users.
 * Renders the matching FE page component based on the `view` prop.
 */
import { FEDashboardPage }     from '../../fireExtinguisher-dashboard/pages/FEDashboardPage.jsx'
import { FEAssetRegistryPage } from '../../fireExtinguisher-dashboard/pages/FEAssetRegistryPage.jsx'
import { FECompliancePage }    from '../../fireExtinguisher-dashboard/pages/FECompliancePage.jsx'

export function ClientFireExtPage({ view = 'dashboard' }) {
  switch (view) {
    case 'assets':     return <FEAssetRegistryPage />
    case 'compliance': return <FECompliancePage />
    default:           return <FEDashboardPage />
  }
}
