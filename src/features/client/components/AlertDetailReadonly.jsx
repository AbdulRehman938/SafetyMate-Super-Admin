import {
  formatDateTime,
  formatGpsLocation,
  getMediaType,
  hiraStatusPillClass,
  incidentStatusPillClass,
  normalizeHiraStatus,
  normalizeIncidentStatus,
  normalizeSeverity,
  normalizeSosStatus,
  sosStatusPillClass,
} from '../alertDetailHelpers.js'

/**
 * Read-only incident-style payload (type / severity / status, details, evidence).
 * @param {'incident' | 'sos' | 'hira'} props.variant — which status labels / pill tones to use
 */
export function AlertDetailReadonly({
  variant = 'incident',
  type,
  severity,
  statusRaw,
  description,
  occurredAt,
  gpsLocation,
  evidenceUrls = [],
}) {
  const typeStr = String(type || '—')
  const sev = normalizeSeverity(severity)
  const sevClass =
    sev === 'High' ? 'client-pill--danger' : sev === 'Medium' ? 'client-pill--warn' : 'client-pill--warn'

  let statusLabel = '—'
  let statusClass = 'client-pill--warn'
  if (variant === 'sos') {
    statusLabel = normalizeSosStatus(statusRaw)
    statusClass = sosStatusPillClass(statusRaw)
  } else if (variant === 'hira') {
    statusLabel = normalizeHiraStatus(statusRaw)
    statusClass = hiraStatusPillClass(statusRaw)
  } else {
    statusLabel = normalizeIncidentStatus(statusRaw)
    statusClass = incidentStatusPillClass(statusRaw)
  }

  const desc = description != null && String(description).trim() ? String(description) : '—'

  return (
    <>
      <div className="incident-drawer-header-row" aria-label="Alert summary">
        <span className="client-pill client-pill--muted">{typeStr}</span>
        <span className={`client-pill ${sevClass}`}>{sev}</span>
        <span className={`client-pill ${statusClass}`}>{statusLabel}</span>
      </div>

      <div className="client-drawer-readonly">
        <p className="client-drawer-ro-label">Description</p>
        <p className="client-drawer-ro-value">{desc}</p>
        <p className="client-drawer-ro-label">Occurred at</p>
        <p className="client-drawer-ro-value">{formatDateTime(occurredAt)}</p>
        <p className="client-drawer-ro-label">GPS location</p>
        <p className="client-drawer-ro-value">{formatGpsLocation(gpsLocation)}</p>
      </div>

      {evidenceUrls?.length ? (
        <div className="incident-evidence-section">
          <p className="client-drawer-ro-label">Evidence</p>
          <div className="incident-evidence-list">
            {evidenceUrls.map((url, idx) => {
              const kind = getMediaType(url)
              return (
                <div key={`${idx}-${url}`} className="incident-evidence-item">
                  {kind === 'image' ? <img src={url} alt="Evidence" className="evidence-media" /> : null}
                  {kind === 'video' ? <video src={url} controls className="evidence-media" /> : null}
                  {kind === 'audio' ? <audio src={url} controls className="evidence-media" /> : null}
                  {kind === 'unknown' ? (
                    <a href={url} target="_blank" rel="noopener noreferrer" className="incident-evidence-link">
                      View File
                    </a>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
    </>
  )
}
