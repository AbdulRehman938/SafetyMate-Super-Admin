export function toDate(value) {
  if (!value) return null
  if (typeof value?.toDate === 'function') return value.toDate()
  if (value instanceof Date) return value
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export function formatDate(value) {
  const d = toDate(value)
  if (!d) return '—'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).format(d)
}

export function formatDateTime(value) {
  const d = toDate(value)
  if (!d) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export function formatGpsLocation(gps) {
  if (gps == null || gps === '') return '—'
  if (typeof gps === 'string') {
    const parts = gps.split(',').map((s) => s.trim())
    if (parts.length >= 2) return `Lat: ${parts[0]}, Lng: ${parts[1]}`
    return gps
  }
  const lat = gps.latitude ?? gps.lat
  const lng = gps.longitude ?? gps.lng ?? gps.lon
  if (lat != null && lng != null && lat !== '' && lng !== '') {
    return `Lat: ${lat}, Lng: ${lng}`
  }
  return '—'
}

export function getMediaType(url) {
  if (!url) return 'unknown'
  const baseUrl = String(url).split('?')[0].toLowerCase()
  if (baseUrl.match(/\.(jpeg|jpg|gif|png|webp)$/)) return 'image'
  if (baseUrl.match(/\.(mp4|webm|ogg|mov)$/)) return 'video'
  if (baseUrl.match(/\.(mp3|wav|m4a|aac)$/)) return 'audio'
  return 'unknown'
}

export function normalizeEvidenceUrls(raw) {
  if (Array.isArray(raw)) return raw.filter((u) => typeof u === 'string' && u.trim())
  if (typeof raw === 'string' && raw.trim()) return [raw.trim()]
  return []
}

export function normalizeSeverity(raw) {
  const s = String(raw || '').toLowerCase()
  if (s === 'high' || s === 'critical') return 'High'
  if (s === 'medium') return 'Medium'
  if (s === 'low') return 'Low'
  return raw ? String(raw) : 'Low'
}

export function normalizeIncidentStatus(raw) {
  const s = String(raw || '').toLowerCase()
  if (s === 'closed') return 'Closed'
  if (s === 'investigating' || s === 'investigation_assigned') return 'Investigating'
  return 'Pending'
}

export function normalizeSosStatus(raw) {
  const s = String(raw || '').toLowerCase()
  if (s === 'resolved') return 'Resolved'
  if (s === 'acknowledged') return 'Acknowledged'
  return 'Pending'
}

export function normalizeHiraStatus(raw) {
  const s = String(raw || '').toLowerCase()
  if (s === 'approved') return 'Approved'
  if (s === 'revision_required') return 'Revision Required'
  if (s === 'rejected') return 'Rejected'
  return 'Pending'
}

export function incidentStatusPillClass(statusRaw) {
  const s = String(statusRaw || '').toLowerCase()
  if (s === 'closed') return 'client-pill--ok'
  if (s === 'investigating' || s === 'investigation_assigned') return 'client-pill--warn'
  return 'client-pill--warn'
}

export function sosStatusPillClass(statusRaw) {
  const s = String(statusRaw || '').toLowerCase()
  if (s === 'resolved') return 'client-pill--ok'
  if (s === 'acknowledged') return 'client-pill--warn'
  return 'client-pill--warn'
}

export function hiraStatusPillClass(statusRaw) {
  const s = String(statusRaw || '').toLowerCase()
  if (s === 'approved') return 'client-pill--ok'
  if (s === 'revision_required' || s === 'rejected') return 'client-pill--danger'
  return 'client-pill--warn'
}
