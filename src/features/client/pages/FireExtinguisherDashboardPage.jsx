import React from 'react'

export function FireExtinguisherDashboardPage() {
  return (
    <section className="client-page client-dashboard-page">
      <header className="client-dash-header">
        <h1>Fire Extinguisher Safety Dashboard</h1>
      </header>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginTop: '24px' }}>
        <article className="client-card">
          <h2 className="client-card-kicker">Registered Extinguishers</h2>
          <p style={{ fontSize: '32px', fontWeight: 'bold', margin: '12px 0 6px 0', color: 'var(--color-primary-light, #00d8ff)' }}>112</p>
          <p className="subtle">Total units registered across all sites</p>
        </article>

        <article className="client-card">
          <h2 className="client-card-kicker">Upcoming Inspections</h2>
          <p style={{ fontSize: '32px', fontWeight: 'bold', margin: '12px 0 6px 0', color: 'var(--color-warning, #f59e0b)' }}>18</p>
          <p className="subtle">Units due for pressure testing and visual checks this week</p>
        </article>

        <article className="client-card">
          <h2 className="client-card-kicker">Fully Compliant</h2>
          <p style={{ fontSize: '32px', fontWeight: 'bold', margin: '12px 0 6px 0', color: 'var(--color-success, #10b981)' }}>94%</p>
          <p className="subtle">Inspect status and compliance grade</p>
        </article>
      </div>
    </section>
  )
}
