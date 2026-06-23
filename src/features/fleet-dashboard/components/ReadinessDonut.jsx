import React from 'react'
import { TrendingUp } from 'lucide-react'

/**
 * ReadinessDonut — SVG donut showing site readiness score.
 * Props: score (0-100), size (px), label
 */
export function ReadinessDonut({ score = 0, size = 110 }) {
  const radius    = (size - 16) / 2
  const cx        = size / 2
  const cy        = size / 2
  const circ      = 2 * Math.PI * radius
  const pct       = Math.min(100, Math.max(0, score))
  const dashArray = `${(pct / 100) * circ} ${circ}`

  // Colour gradient stops based on score
  const strokeColor = pct >= 75 ? '#16c988' : pct >= 50 ? '#fe8e2a' : '#ff535f'

  return (
    <div className="fleet-readiness-donut">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        {/* Track */}
        <circle
          cx={cx} cy={cy} r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={10}
        />
        {/* Progress */}
        <circle
          cx={cx} cy={cy} r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={10}
          strokeDasharray={dashArray}
          strokeDashoffset={0}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: 'stroke-dasharray 600ms ease', filter: `drop-shadow(0 0 6px ${strokeColor}88)` }}
        />
        <text
          x={cx}
          y={cy}
          dominantBaseline="central"
          textAnchor="middle"
          className="fleet-readiness-value"
        >
          {pct}%
        </text>
      </svg>
    </div>
  )
}
