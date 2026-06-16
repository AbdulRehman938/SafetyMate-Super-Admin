import React from 'react'

export function TrainingDashboardPage() {
  return (
    <section className="client-page client-dashboard-page">
      <header className="client-dash-header">
        <h1>Training Provider Dashboard</h1>
      </header>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginTop: '24px' }}>
        <article className="client-card">
          <h2 className="client-card-kicker">Active Courses</h2>
          <p style={{ fontSize: '32px', fontWeight: 'bold', margin: '12px 0 6px 0', color: 'var(--color-primary-light, #00d8ff)' }}>12</p>
          <p className="subtle">Scheduled safety & compliance courses this month</p>
        </article>

        <article className="client-card">
          <h2 className="client-card-kicker">Certified Students</h2>
          <p style={{ fontSize: '32px', fontWeight: 'bold', margin: '12px 0 6px 0', color: 'var(--color-success, #10b981)' }}>148</p>
          <p className="subtle">Total workers certified through SafetyMate</p>
        </article>

        <article className="client-card">
          <h2 className="client-card-kicker">Pending Reviews</h2>
          <p style={{ fontSize: '32px', fontWeight: 'bold', margin: '12px 0 6px 0', color: 'var(--color-warning, #f59e0b)' }}>3</p>
          <p className="subtle">Assessments awaiting provider feedback</p>
        </article>
      </div>
    </section>
  )
}
