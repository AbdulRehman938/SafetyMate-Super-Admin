export function MetricCard({ title, value, trend }) {
  return (
    <article className="panel metric-card">
      <p className="metric-title">{title}</p>
      <p className="metric-value">{value}</p>
      <p className="metric-trend">{trend}</p>
    </article>
  )
}
