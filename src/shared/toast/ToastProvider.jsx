import { useCallback, useMemo, useState } from 'react'
import { ToastContext } from './toastContext.js'

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const push = useCallback((toast) => {
    const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random())
    const next = { id, type: 'info', title: '', message: '', durationMs: 2800, ...toast }
    setToasts((prev) => [...prev, next])
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, next.durationMs)
  }, [])

  const value = useMemo(() => ({ push }), [push])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-relevant="additions">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            {t.title ? <p className="toast-title">{t.title}</p> : null}
            <p className="toast-message">{t.message}</p>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

