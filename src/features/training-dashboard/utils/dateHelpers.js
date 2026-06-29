/**
 * Centralized date parsing and formatting utilities for training dashboard
 * Ensures consistent date handling across all components
 */

/**
 * Parse expiry date from various formats (ISO string, Date object, or formatted string)
 * @param {string|Date} expiryStr - The expiry date to parse
 * @returns {Date|null} - Parsed Date object or null if invalid
 */
export function parseExpiryDate(expiryStr) {
  if (!expiryStr || expiryStr === '—') return null
  
  // Try ISO format first (YYYY-MM-DD)
  const isoMatch = String(expiryStr).match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10)
    const month = parseInt(isoMatch[2], 10) - 1
    const day = parseInt(isoMatch[3], 10)
    const date = new Date(year, month, day)
    if (!isNaN(date.getTime())) return date
  }
  
  // Try parsing as Date object
  const parsed = new Date(expiryStr)
  if (!isNaN(parsed.getTime())) return parsed
  
  return null
}

/**
 * Format expiry date to ISO string format (YYYY-MM-DD)
 * @param {Date|string} date - The date to format
 * @returns {string} - Formatted date string or '—' if invalid
 */
export function formatExpiryDate(date) {
  if (!date) return '—'
  
  const parsed = date instanceof Date ? date : parseExpiryDate(date)
  if (!parsed) return '—'
  
  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Format date to readable format (e.g., "Jan 15, 2025")
 * @param {Date|string} date - The date to format
 * @returns {string} - Formatted readable date string
 */
export function formatReadableDate(date) {
  if (!date) return '—'
  
  const parsed = date instanceof Date ? date : parseExpiryDate(date)
  if (!parsed) return '—'
  
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * Get certificate status based on expiry date
 * @param {Date|string} expiryDate - The expiry date
 * @returns {string} - 'COMPLIANT', 'EXPIRING_SOON', or 'EXPIRED'
 */
export function getCertStatus(expiryDate) {
  if (!expiryDate) return 'COMPLIANT'
  
  const parsed = expiryDate instanceof Date ? expiryDate : parseExpiryDate(expiryDate)
  if (!parsed) return 'COMPLIANT'
  
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const threshold = new Date(now)
  threshold.setDate(threshold.getDate() + 30)
  
  const exp = new Date(parsed)
  exp.setHours(0, 0, 0, 0)
  
  if (exp < now) return 'EXPIRED'
  if (exp <= threshold) return 'EXPIRING_SOON'
  return 'COMPLIANT'
}

/**
 * Calculate days remaining until expiry
 * @param {Date|string} expiryDate - The expiry date
 * @returns {number} - Days remaining (0 if expired)
 */
export function getDaysRemaining(expiryDate) {
  if (!expiryDate) return 0
  
  const parsed = expiryDate instanceof Date ? expiryDate : parseExpiryDate(expiryDate)
  if (!parsed) return 0
  
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const exp = new Date(parsed)
  exp.setHours(0, 0, 0, 0)
  
  const diffTime = exp.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  return diffDays < 0 ? 0 : diffDays
}

/**
 * Get recommended renewal date (30 days before expiry)
 * @param {Date|string} expiryDate - The expiry date
 * @returns {string} - Formatted renewal date
 */
export function getRenewalDate(expiryDate) {
  if (!expiryDate) return '—'
  
  const parsed = expiryDate instanceof Date ? expiryDate : parseExpiryDate(expiryDate)
  if (!parsed) return '—'
  
  const renewal = new Date(parsed)
  renewal.setDate(renewal.getDate() - 30)
  return formatReadableDate(renewal)
}
