/**
 * Fleet dashboard utility functions — no dummy data, pure helpers.
 */

/** Convert a Firestore Timestamp, Date, or number to a JS Date. */
export function toDate(val) {
  if (!val) return null
  if (typeof val.toDate === 'function') return val.toDate()
  if (val instanceof Date) return val
  if (typeof val === 'number') return new Date(val)
  return null
}

/** Format a timestamp as "DD MMM YYYY" */
export function formatDate(val) {
  const d = toDate(val)
  if (!d) return '—'
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Format a timestamp as "DD MMM YYYY, HH:MM" */
export function formatDateTime(val) {
  const d = toDate(val)
  if (!d) return '—'
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

/** Time ago — "2h ago", "3d ago" etc */
export function timeAgo(val) {
  const d = toDate(val)
  if (!d) return ''
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

/** Return CSS class suffix for health score: high / mid / low */
export function healthClass(score) {
  if (score >= 70) return 'high'
  if (score >= 40) return 'mid'
  return 'low'
}

/** Map vehicle status to fleet-pill CSS class */
export function statusPillClass(status) {
  switch ((status || '').toLowerCase()) {
    case 'active':      return 'fleet-pill--active'
    case 'completed':   return 'fleet-pill--ok'
    case 'maintenance': return 'fleet-pill--warn'
    case 'offline':
    case 'inactive':    return 'fleet-pill--danger'
    default:            return 'fleet-pill--muted'
  }
}

/** Capitalise first letter */
export function cap(str) {
  if (!str) return '—'
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/** Build initials from a vehicle ID or name (up to 2 chars) */
export function vehicleInitials(id) {
  if (!id) return '?'
  return id.replace(/[^A-Z0-9]/gi, '').slice(0, 2).toUpperCase()
}

/** Export array of objects to CSV and trigger browser download */
export function exportToCSV(rows, filename = 'fleet-export.csv') {
  if (!rows || rows.length === 0) return
  const headers = Object.keys(rows[0])
  const lines = [
    headers.join(','),
    ...rows.map((r) =>
      headers.map((h) => {
        const v = r[h] ?? ''
        const s = String(v).replace(/"/g, '""')
        return s.includes(',') || s.includes('\n') ? `"${s}"` : s
      }).join(',')
    ),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Aggregate fuel usage per month from fuelLogs array */
export function fuelByMonth(fuelLogs, months = 6) {
  const now = new Date()
  const result = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    result.push({
      label: d.toLocaleString('en-US', { month: 'short' }),
      litres: 0,
      isCurrent: i === 0,
    })
  }
  fuelLogs.forEach((log) => {
    const d = toDate(log.loggedAt)
    if (!d) return
    const diffMonths =
      (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth())
    if (diffMonths >= 0 && diffMonths < months) {
      result[months - 1 - diffMonths].litres += Number(log.litres || 0)
    }
  })
  const max = Math.max(...result.map((r) => r.litres), 1)
  return result.map((r) => ({ ...r, heightPct: (r.litres / max) * 100 }))
}
