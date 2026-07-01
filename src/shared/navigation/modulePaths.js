import { useCallback } from 'react'
import { useLocation } from 'react-router-dom'

export function useModulePath(defaultBase, clientBase) {
  const { pathname } = useLocation()
  const base = pathname.startsWith(clientBase) ? clientBase : defaultBase

  return useCallback((path = '') => {
    if (!path) return base
    return `${base}${path.startsWith('/') ? path : `/${path}`}`
  }, [base])
}
