import { addDoc, collection, serverTimestamp } from 'firebase/firestore'

/**
 * Writes a security audit log entry.
 * Schema:
 * - timestamp, actor, actionType, resource, severity, details
 */
export async function writeSecurityAuditLog(db, entry) {
  const actor = String(entry?.actor || '').trim() || 'unknown'
  const actionType = String(entry?.actionType || '').trim() || 'UNKNOWN_ACTION'
  const resource = String(entry?.resource || '').trim() || '—'
  const severity = String(entry?.severity || '').trim() || 'Low'
  const details = String(entry?.details || '').trim() || ''

  return await addDoc(collection(db, 'security_audit_logs'), {
    timestamp: serverTimestamp(),
    actor,
    actionType,
    resource,
    severity,
    details,
  })
}

