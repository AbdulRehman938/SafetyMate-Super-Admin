/**
 * Reusable SVG donut for compliance / health scores.
 * Renders as progress ring; pass percent 0–100.
 */
export function HealthScoreDonut({
  percent = 0,
  size = 160,
  strokeWidth = 12,
  trackColor = 'rgba(16, 47, 98, 0.45)',
  progressColor = '#2a9d7a',
}) {
  const p = Math.min(100, Math.max(0, Number(percent) || 0))
  const r = (size - strokeWidth) / 2
  const c = 2 * Math.PI * r
  const offset = c - (p / 100) * c

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="client-health-donut-svg"
      aria-hidden
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={trackColor}
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={progressColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="middle"
        textAnchor="middle"
        fill="currentColor"
        className="client-health-donut-value"
      >
        {Math.round(p)}%
      </text>
    </svg>
  )
}
