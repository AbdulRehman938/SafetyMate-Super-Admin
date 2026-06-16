import { AlertTriangle, X } from 'lucide-react'

export function ConfirmModal({
  isOpen,
  title = 'Confirm',
  message = '',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  busy = false,
  tone = 'warn',
  onConfirm,
  onCancel,
}) {
  if (!isOpen) return null

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <article className={`confirm-modal tone-${tone}`}>
        <header className="confirm-modal-head">
          <h3>
            <span className="confirm-ic" aria-hidden="true">
              <AlertTriangle size={14} />
            </span>
            {title}
          </h3>
          <button type="button" className="topnav-icon" onClick={onCancel} aria-label="Close" disabled={busy}>
            <X size={16} />
          </button>
        </header>

        <div className="confirm-modal-body">
          <p>{message}</p>
        </div>

        <footer className="confirm-modal-foot">
          <button type="button" className="secondary-btn" onClick={onCancel} disabled={busy}>
            {cancelText}
          </button>
          <button type="button" className="primary-btn" onClick={onConfirm} disabled={busy}>
            {busy ? 'Working…' : confirmText}
          </button>
        </footer>
      </article>
    </div>
  )
}

