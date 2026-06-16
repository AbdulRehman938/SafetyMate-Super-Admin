import React from 'react'

export function FleetDashboardPage() {
  return (
    <section className="client-page client-dashboard-page">
      <header className="client-dash-header">
        <h1>Fleet Safety Dashboard</h1>
      </header>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginTop: '24px' }}>
        <article className="client-card">
          <h2 className="client-card-kicker">Active Vehicles</h2>
          <p style={{ fontSize: '32px', fontWeight: 'bold', margin: '12px 0 6px 0', color: 'var(--color-primary-light, #00d8ff)' }}>45</p>
          <p className="subtle">Vehicles currently logged in operation</p>
        </article>

        <article className="client-card">
          <h2 className="client-card-kicker">Driver Certifications</h2>
          <p style={{ fontSize: '32px', fontWeight: 'bold', margin: '12px 0 6px 0', color: 'var(--color-success, #10b981)' }}>98%</p>
          <p className="subtle">Drivers with active and valid safety permits</p>
        </article>

        <article className="client-card">
          <h2 className="client-card-kicker">Maintenance Alerts</h2>
          <p style={{ fontSize: '32px', fontWeight: 'bold', margin: '12px 0 6px 0', color: 'var(--color-error, #ef4444)' }}>4</p>
          <p className="subtle">Vehicles overdue for inspections or service</p>
        </article>
      </div>
    </section>
  )
}
