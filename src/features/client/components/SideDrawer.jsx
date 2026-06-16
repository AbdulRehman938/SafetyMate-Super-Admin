import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'

/**
 * Slide-over panel from the right with blurred backdrop.
 * Props: isOpen, onClose, title, children
 */
export function SideDrawer({ isOpen, onClose, title, children }) {
  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  return createPortal(
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.button
            key="client-drawer-backdrop"
            type="button"
            className="client-drawer-backdrop"
            aria-label="Close panel"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            key="client-drawer-panel"
            className="client-drawer-panel-outer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="client-drawer-title"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
          >
            <div className="client-drawer-panel-inner">
              <header className="client-drawer-header">
                <h2 id="client-drawer-title" className="client-drawer-title">
                  {title}
                </h2>
                <button
                  type="button"
                  className="client-drawer-close"
                  onClick={onClose}
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </header>
              <div className="client-drawer-body">{children}</div>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
