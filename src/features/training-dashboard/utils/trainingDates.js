/**
 * Parse training request dates from Firestore fields (startDate ISO or preferredDate text).
 */

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function parseIsoDate(str) {
  if (!str || typeof str !== 'string') return null
  const d = new Date(`${str}T00:00:00`)
  return isNaN(d.getTime()) ? null : d
}

function parsePreferredDate(dateVal) {
  if (!dateVal) return { start: null, end: null }

  // If it's a Firestore Timestamp or similar object
  if (typeof dateVal.toDate === 'function') {
    dateVal = dateVal.toDate()
  } else if (typeof dateVal === 'object' && dateVal.seconds !== undefined) {
    dateVal = new Date(dateVal.seconds * 1000)
  }

  // If it's a JS Date object
  if (dateVal instanceof Date) {
    if (!isNaN(dateVal.getTime())) return { start: dateVal, end: dateVal }
    return { start: null, end: null }
  }

  // If it is a number (timestamp)
  if (typeof dateVal === 'number') {
    const parsed = new Date(dateVal)
    if (!isNaN(parsed.getTime())) return { start: parsed, end: parsed }
    return { start: null, end: null }
  }

  // Otherwise treat as string or try to stringify
  if (typeof dateVal !== 'string') {
    try {
      dateVal = String(dateVal)
    } catch {
      return { start: null, end: null }
    }
  }

  const dateStr = dateVal

  const iso = parseIsoDate(dateStr)
  if (iso) return { start: iso, end: iso }

  try {
    const single = new Date(dateStr)
    if (!isNaN(single.getTime())) return { start: single, end: single }
  } catch {}

  const rangeMatch = dateStr.match(
    /([a-zA-Z]+)\s+(\d+)\s*-\s*([a-zA-Z]+)?\s*(\d+),\s*(\d{4})/,
  )
  if (rangeMatch) {
    const startMonthName = rangeMatch[1]
    const startDay = parseInt(rangeMatch[2], 10)
    const endMonthName = rangeMatch[3] || startMonthName
    const endDay = parseInt(rangeMatch[4], 10)
    const year = parseInt(rangeMatch[5], 10)
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
    const startMonth = months.findIndex((m) => startMonthName.toLowerCase().startsWith(m))
    const endMonth = months.findIndex((m) => endMonthName.toLowerCase().startsWith(m))
    if (startMonth >= 0 && endMonth >= 0) {
      return {
        start: new Date(year, startMonth, startDay),
        end: new Date(year, endMonth, endDay),
      }
    }
  }

  const singleMatch = dateStr.match(/([a-zA-Z]+)\s+(\d+),\s*(\d{4})/)
  if (singleMatch) {
    const monthName = singleMatch[1]
    const day = parseInt(singleMatch[2], 10)
    const year = parseInt(singleMatch[3], 10)
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
    const month = months.findIndex((m) => monthName.toLowerCase().startsWith(m))
    if (month >= 0) {
      const d = new Date(year, month, day)
      return { start: d, end: d }
    }
  }

  return { start: null, end: null }
}

/** @returns {{ start: Date|null, end: Date|null }} */
export function getRequestDateRange(req) {
  const startFromField = parseIsoDate(req.startDate)
  const endFromField = parseIsoDate(req.endDate)

  if (startFromField) {
    return {
      start: startFromField,
      end: endFromField || startFromField,
    }
  }

  return parsePreferredDate(req.preferredDate || '')
}

export function isDateInRange(target, start, end) {
  if (!start || !end) return false
  const t = startOfDay(target).getTime()
  return t >= startOfDay(start).getTime() && t <= startOfDay(end).getTime()
}

export function isTodayInRange(req) {
  const { start, end } = getRequestDateRange(req)
  return isDateInRange(new Date(), start, end)
}

/** Approved/accepted sessions starting within the next 48 hours. */
export function getUpcomingSessions(requests, windowHours = 48) {
  const now = new Date()
  const windowEnd = new Date(now.getTime() + windowHours * 60 * 60 * 1000)

  return requests
    .filter((r) => r.status === 'approved' || r.status === 'accepted')
    .map((r) => {
      const { start, end } = getRequestDateRange(r)
      if (!start) return null
      const sessionStart = startOfDay(start)
      if (sessionStart < startOfDay(now) || sessionStart > windowEnd) return null
      return {
        id: r.id,
        name: r.course,
        date: sessionStart,
        time: r.timeDetail || 'TBD',
        company: r.company,
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.date - b.date)
}

export function countCoursesToday(requests) {
  return requests.filter(
    (r) =>
      (r.status === 'approved' || r.status === 'accepted') && isTodayInRange(r),
  ).length
}
