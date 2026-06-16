const toneClass = {
  critical: 'client-alert--critical',
  warning: 'client-alert--warning',
  info: 'client-alert--info',
}

/**
 * Sentinel-style alerts list. Designed to later receive Firestore-backed rows filtered by organizationId.
 */
export function SentinelAlertsFeed({ alerts = [], onAction, onDismiss }) {
  if (!alerts.length) {
    return (
      <div className="client-sentinel-empty" role="status" aria-live="polite">
        <p className="client-sentinel-empty-title">No recent alerts</p>
        <p className="client-sentinel-empty-sub">You’re all caught up. New SOS, HIRA, and incident items will appear here.</p>
      </div>
    )
  }

  return (
    <ul className="client-sentinel-list">
      {alerts.map((a) => (
        <li key={a.id} className={`client-sentinel-item ${toneClass[a.tone] || toneClass.info}`}>
          <div className="client-sentinel-body">
            <p className="client-sentinel-title">
              {a.icon ? (
                <span className="client-sentinel-icon" aria-hidden>
                  <a.icon size={14} />
                </span>
              ) : null}
              <span className="client-sentinel-title-text">{a.title}</span>
              {a.type ? <span className="client-sentinel-pill">{a.type}</span> : null}
            </p>
            <p className="client-sentinel-desc">{a.description}</p>
          </div>
          <div className="client-sentinel-actions">
            <button type="button" className="client-btn client-btn--primary" onClick={() => onAction?.(a)}>
              {a.actionLabel || 'Respond Now'}
            </button>
            <button
              type="button"
              className="client-btn client-btn--muted"
              onClick={() => onDismiss?.(a)}
            >
              Dismiss
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}
