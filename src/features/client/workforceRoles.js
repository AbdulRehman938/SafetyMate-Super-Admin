/** System roles selectable for org workforce members (not client_admin / SUPER_ADMIN). */
export const WORKFORCE_ROLES = ['Safety Officer', 'SHE Representative', 'Manager', 'General Worker']

/** Default for forms — must exist in WORKFORCE_ROLES so the role select value always matches an option. */
export const DEFAULT_WORKFORCE_ROLE = 'General Worker'

export function isWorkforceRole(role) {
  return WORKFORCE_ROLES.includes(String(role || ''))
}
