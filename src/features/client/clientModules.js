const MODULE_ALIASES = [
  { key: 'safety-files', tests: ['safetyfiles', 'safetyfile', 'files', 'documents'] },
  { key: 'risk-assessments', tests: ['riskassessments', 'riskassessment', 'risk', 'hira'] },
  { key: 'training', tests: ['training', 'trainingmanagement'] },
  { key: 'fleet', tests: ['fleet', 'fleetmanagement'] },
  { key: 'fire-safety', tests: ['firesafety', 'firesafetysystem', 'fire', 'extinguisher', 'detection'] },
  { key: 'contractors', tests: ['contractors', 'contractormanagement'] },
  { key: 'reports', tests: ['reports', 'analytics', 'reportsanalytics'] },
  { key: 'incidents', tests: ['incidents', 'incident'] },
  { key: 'certificates', tests: ['certificates', 'certificate'] },
  { key: 'workforce', tests: ['workforce', 'workers'] },
  { key: 'ppe', tests: ['ppe', 'assets', 'ppeassets'] },
  { key: 'settings', tests: ['settings'] },
]

function normalizeToken(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function collectValues(value, out = []) {
  if (!value) return out
  if (Array.isArray(value)) {
    value.forEach((item) => collectValues(item, out))
    return out
  }
  if (typeof value === 'object') {
    Object.entries(value).forEach(([key, val]) => {
      if (val === true || val === 'true' || val === 'enabled' || val === 'active') out.push(key)
      if (typeof val === 'string') out.push(val)
      if (Array.isArray(val)) collectValues(val, out)
    })
    return out
  }
  out.push(value)
  return out
}

export function getSubscribedModuleKeys(profile) {
  const candidates = [
    profile?.subscribedServices,
    profile?.services,
    profile?.serviceModules,
    profile?.modules,
    profile?.enabledModules,
    profile?.subscription?.services,
    profile?.subscription?.modules,
    profile?.organization?.subscribedServices,
    profile?.organization?.modules,
  ]

  const values = candidates.flatMap((candidate) => collectValues(candidate, []))
  if (!values.length) return null

  const keys = new Set()
  values.map(normalizeToken).forEach((token) => {
    MODULE_ALIASES.forEach(({ key, tests }) => {
      if (tests.some((test) => token === test || token.includes(test))) keys.add(key)
    })
  })

  return keys.size ? keys : null
}

export function shouldShowClientModule(moduleKey, subscribedKeys, alwaysVisible = false) {
  if (alwaysVisible) return true
  if (!subscribedKeys) return true
  return subscribedKeys.has(moduleKey)
}
