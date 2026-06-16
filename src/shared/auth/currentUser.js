export function getOrganizationLabel(profile) {
  if (!profile) return ''
  if (profile.role === 'SUPER_ADMIN') return 'SafetyMate Platform Control'
  if (!profile.organizationId) return '—'
  return profile.organizationName || profile.organizationId
}

