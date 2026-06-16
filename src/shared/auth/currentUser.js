export function getOrganizationLabel(profile) {
  if (!profile) return ''
  if (profile.role === 'SUPER_ADMIN') return 'SafetyMate Platform Control'
  if (!profile.organizationId) return '—'
  return profile.organizationName || profile.organizationId
}

export function getDashboardPathForRole(role) {
  switch (role) {
    case 'TRAINING_PROVIDER':
      return '/training/dashboard'
    case 'FLEET':
      return '/fleet/dashboard'
    case 'FIRE_EXTINGUISHER':
      return '/extinguisher/dashboard'
    case 'FIRE_DETECTION':
      return '/detection/dashboard'
    case 'SUPER_ADMIN':
      return '/dashboard'
    case 'COMPANY':
    case 'client_admin':
    default:
      return '/client/dashboard'
  }
}


