/**
 * ClientFleetPage
 * Fleet Management module accessible to COMPANY users.
 * Renders the matching fleet page component based on the `view` prop.
 */
import { FleetDashboardPage }    from '../../fleet-dashboard/pages/FleetDashboardPage.jsx'
import { SiteMapPage }           from '../../fleet-dashboard/pages/SiteMapPage.jsx'
import { VehicleTwinsPage }      from '../../fleet-dashboard/pages/VehicleTwinsPage.jsx'
import { InspectionLogPage }     from '../../fleet-dashboard/pages/InspectionLogPage.jsx'
import { FuelIntelligencePage }  from '../../fleet-dashboard/pages/FuelIntelligencePage.jsx'

export function ClientFleetPage({ view = 'dashboard' }) {
  switch (view) {
    case 'site-map':    return <SiteMapPage />
    case 'vehicles':    return <VehicleTwinsPage />
    case 'inspections': return <InspectionLogPage />
    case 'fuel':        return <FuelIntelligencePage />
    default:            return <FleetDashboardPage />
  }
}
