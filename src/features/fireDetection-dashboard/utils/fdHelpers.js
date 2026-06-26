/** Convert Firestore Timestamp, Date, or number to JS Date */
export function toDate(val) {
  if (!val) return null
  if (typeof val.toDate === 'function') return val.toDate()
  if (val instanceof Date) return val
  if (typeof val === 'number') return new Date(val)
  return null
}

/** Format as "DD MMM YYYY" */
export function formatDate(val) {
  const d = toDate(val)
  if (!d) return '—'
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Format as "DD MMM YYYY, HH:MM" */
export function formatDateTime(val) {
  const d = toDate(val)
  if (!d) return '—'
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

/** "Oct 24, 09:12 AM" style used in activity log */
export function formatLogTime(val) {
  const d = toDate(val)
  if (!d) return '—'
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

/** Compact time-ago for alerts */
export function timeAgoShort(val) {
  const d = toDate(val)
  if (!d) return ''
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)   return 'now'
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'Yesterday'
  return `${days}d ago`
}

/** Capitalise first letter */
export function cap(s) {
  if (!s) return '—'
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Build 2-letter avatar initials from a name */
export function initials(name) {
  if (!name) return '?'
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
}

/** Deterministic avatar bg colour from initials */
const AVATAR_COLORS = [
  '#3a82ff', '#16c988', '#fe8e2a', '#9c5cff',
  '#ff535f', '#1ec8d3', '#e86c3a', '#5bb6ff',
]
export function avatarColor(name) {
  if (!name) return AVATAR_COLORS[0]
  let n = 0
  for (let i = 0; i < name.length; i++) n += name.charCodeAt(i)
  return AVATAR_COLORS[n % AVATAR_COLORS.length]
}

/** Export rows to CSV */
export function exportToCSV(rows, filename = 'export.csv') {
  if (!rows?.length) return
  const headers = Object.keys(rows[0])
  const lines = [
    headers.join(','),
    ...rows.map((r) =>
      headers.map((h) => {
        const v = String(r[h] ?? '')
        return v.includes(',') || v.includes('\n') ? `"${v.replace(/"/g, '""')}"` : v
      }).join(',')
    ),
  ]
  const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click()
  URL.revokeObjectURL(url)
}
