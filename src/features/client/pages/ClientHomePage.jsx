/**
 * ClientHomePage — module launchpad
 * Shows lockable platform modules with three states:
 *   - Unlocked (active) — clickable card
 *   - Paused — amber badge, cannot open, can't re-request until pause expires
 *   - Locked (not activated) — "Request Access" button (blocked if requests are paused)
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getFunctions, httpsCallable } from 'firebase/functions'
import {
  Truck, Flame, Siren, ArrowRight,
  Lock, Send, X, CheckCircle, PauseCircle, Clock,
} from 'lucide-react'
import { useAuth } from '../../../app/providers/authContext.js'
import { app } from '../../../config/firebase.js'

const PLATFORM_MODULES = [
  {
    key: 'fleet',
    title: 'Fleet Management',
    desc: 'Track vehicles, manage driver certifications, monitor fuel consumption, schedule inspections and receive real-time alerts on your entire fleet from a single dashboard.',
    icon: Truck,
    to: '/client/fleet',
    color: 'blue',
  },
  {
    key: 'fire_extinguisher',
    title: 'Fire Extinguisher Safety',
    desc: 'Register and track all fire extinguisher units across sites, schedule pressure tests and visual inspections, monitor compliance grades and receive expiry alerts automatically.',
    icon: Flame,
    to: '/client/fire-ext',
    color: 'orange',
  },
  {
    key: 'fire_detection',
    title: 'Fire Detection & Alarms',
    desc: 'Manage smoke detectors, heat sensors and fire alarm panels across your premises. Log inspections, track panel health, monitor zone coverage and maintain full compliance records.',
    icon: Siren,
    to: '/client/fire-det',
    color: 'red',
  },
]

function formatDate(date) {
  if (!date) return ''
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Module card ───────────────────────────────────────────────────────────────
function ModuleCard({ module, isUnlocked, isPaused, pausedUntil, requestsBlocked, requestsBlockedUntil, onOpen, onRequestAccess }) {
  const BgIcon = module.icon

  if (isUnlocked && !isPaused) {
    return (
      <button type="button" className={`client-module-card client-module-card--${module.color}`}
        onClick={() => onOpen(module.to)} aria-label={`Open ${module.title}`}>
        <span className="client-module-card__bg-icon" aria-hidden="true"><BgIcon size={170} strokeWidth={1} /></span>
        <div className="client-module-card__body">
          <p className="client-module-card__title">{module.title}</p>
          <p className="client-module-card__desc">{module.desc}</p>
        </div>
        <div className="client-module-card__footer">
          <span className="client-module-card__cta">Open Module</span>
          <span className="client-module-card__arrow" aria-hidden="true"><ArrowRight size={13} /></span>
        </div>
      </button>
    )
  }

  if (isPaused) {
    return (
      <div className={`client-module-card client-module-card--paused client-module-card--${module.color}`}>
        <span className="client-module-card__bg-icon client-module-card__bg-icon--locked" aria-hidden="true"><BgIcon size={170} strokeWidth={1} /></span>
        <div className="client-module-card__pause-badge">
          <PauseCircle size={12} />
          <span>Access Paused</span>
        </div>
        <div className="client-module-card__body">
          <p className="client-module-card__title">{module.title}</p>
          <p className="client-module-card__desc">{module.desc}</p>
        </div>
        <div className="client-module-card__footer">
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'rgba(251,191,36,0.85)', fontWeight: 600 }}>
            <Clock size={11} />
            {pausedUntil ? `Resumes ${formatDate(pausedUntil)}` : 'Temporarily paused'}
          </span>
        </div>
      </div>
    )
  }

  // Locked — not activated
  return (
    <div className={`client-module-card client-module-card--locked client-module-card--${module.color}`}>
      <span className="client-module-card__bg-icon client-module-card__bg-icon--locked" aria-hidden="true"><BgIcon size={170} strokeWidth={1} /></span>
      <div className="client-module-card__lock-badge"><Lock size={12} /><span>Not Activated</span></div>
      <div className="client-module-card__body">
        <p className="client-module-card__title">{module.title}</p>
        <p className="client-module-card__desc">{module.desc}</p>
      </div>
      <div className="client-module-card__footer">
        {requestsBlocked ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'rgba(251,191,36,0.8)', fontWeight: 600 }}>
            <Clock size={11} />
            {requestsBlockedUntil ? `Requests blocked until ${formatDate(requestsBlockedUntil)}` : 'Requests temporarily blocked'}
          </span>
        ) : (
          <button type="button" className="client-module-card__request-btn" onClick={() => onRequestAccess(module)}>
            <Send size={12} /> Request Access
          </button>
        )}
      </div>
    </div>
  )
}

// ── Request modal ─────────────────────────────────────────────────────────────
function RequestAccessModal({ module, onClose, onSubmit, submitting, sent, errorMsg }) {
  const [message, setMessage] = useState('')
  if (sent) {
    return (
      <div className="client-modal-overlay" role="dialog" aria-modal="true">
        <div className="client-modal client-modal--sm">
          <div style={{ textAlign: 'center', padding: '24px 20px 16px' }}>
            <CheckCircle size={42} style={{ color: '#16c988', marginBottom: 14 }} />
            <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700, color: '#fff' }}>Request Sent</h3>
            <p style={{ margin: '0 0 22px', fontSize: 13, color: 'rgba(148,163,184,0.8)', lineHeight: 1.55 }}>
              Your request for <strong style={{ color: '#4deba0' }}>{module.title}</strong> has been sent to the administrator.
            </p>
            <button type="button" className="client-btn client-btn--primary" onClick={onClose}>Done</button>
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="client-modal-overlay" role="dialog" aria-modal="true">
      <div className="client-modal client-modal--sm">
        <div className="client-modal-header">
          <h3 className="client-modal-title">Request Module Access</h3>
          <button type="button" className="client-drawer-close" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        <div style={{ padding: '18px' }}>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: 'rgba(148,163,184,0.85)', lineHeight: 1.55 }}>
            Requesting access to <strong style={{ color: 'rgba(235,242,255,0.95)' }}>{module.title}</strong>.
            An email will be sent to the administrator with your details.
          </p>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(148,163,184,0.7)', marginBottom: 6 }}>
            Additional Message (optional)
          </label>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)}
            placeholder="Explain why your company needs this module…"
            style={{ width: '100%', minHeight: 90, resize: 'vertical', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(7,10,22,0.7)', color: 'rgba(235,242,255,0.9)', font: 'inherit', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
            {errorMsg && (
              <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(255,83,95,0.1)', border: '1px solid rgba(255,83,95,0.3)', color: '#ff9aa2', fontSize: 12.5 }}>
                ⚠ {errorMsg}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="client-btn client-btn--ghost" onClick={onClose}>Cancel</button>
              <button type="button" className="client-btn client-btn--primary" disabled={submitting} onClick={() => onSubmit(message)}>
                {submitting ? 'Sending…' : <><Send size={13} style={{ marginRight: 6 }} />Send Request</>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function ClientHomePage() {
  const navigate = useNavigate()
  const { profile, organizationId, orgDoc, modules, isModulePaused, isRequestsPaused, requestsPausedUntilDate, pausedModules } = useAuth()
  const firstName = (profile?.fullName || profile?.name || profile?.email || 'there').split(' ')[0]

  const [requestingModule, setRequestingModule] = useState(null)
  const [submitting, setSubmitting]             = useState(false)
  const [sent, setSent]                         = useState(false)
  const [errorMsg, setErrorMsg]                 = useState('')

  const requestsBlocked = isRequestsPaused?.() ?? false

  function openRequest(mod) { setRequestingModule(mod); setSent(false); setErrorMsg('') }
  function closeRequest()   { setRequestingModule(null); setSent(false); setErrorMsg('') }

  async function handleSubmitRequest(message) {
    if (!requestingModule) return
    setSubmitting(true)
    setErrorMsg('')
    try {
      const fns = getFunctions(app)
      await httpsCallable(fns, 'sendModuleRequestEmail')({
        organizationId:   organizationId || orgDoc?.id || '',
        organizationName: orgDoc?.name || profile?.organizationName || 'Unknown Company',
        moduleKey:        requestingModule.key,
        moduleLabel:      requestingModule.title,
        requesterName:    profile?.fullName || profile?.name || '',
        requesterEmail:   profile?.email || '',
        message,
      })
      setSent(true)
    } catch (err) {
      setErrorMsg(err?.message || 'Failed to send request. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function getPausedUntil(moduleKey) {
    const entry = pausedModules?.[moduleKey]
    if (!entry?.until) return null
    return typeof entry.until?.toDate === 'function' ? entry.until.toDate() : new Date(entry.until)
  }

  return (
    <section className="client-page client-home-page">
      <header className="client-home-header">
        <h1>Welcome back, {firstName}</h1>
        <p>Manage your subscribed platform modules below. Use the sidebar to access your core safety tools.</p>
      </header>

      {requestsBlocked && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', marginBottom: 20, borderRadius: 10, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', color: 'rgba(251,191,36,0.9)', fontSize: 13 }}>
          <Clock size={15} />
          <span>
            New module access requests are temporarily blocked
            {requestsPausedUntilDate ? ` until ${formatDate(requestsPausedUntilDate)}` : ''}.
            Contact your administrator for assistance.
          </span>
        </div>
      )}

      <p className="client-home-section-label">Platform Modules</p>
      <div className="client-modules-grid">
        {PLATFORM_MODULES.map((m) => (
          <ModuleCard
            key={m.key}
            module={m}
            isUnlocked={modules.includes(m.key)}
            isPaused={isModulePaused?.(m.key) ?? false}
            pausedUntil={getPausedUntil(m.key)}
            requestsBlocked={requestsBlocked}
            requestsBlockedUntil={requestsPausedUntilDate}
            onOpen={navigate}
            onRequestAccess={openRequest}
          />
        ))}
      </div>

      {requestingModule && (
        <RequestAccessModal module={requestingModule} onClose={closeRequest} onSubmit={handleSubmitRequest}
          submitting={submitting} sent={sent} errorMsg={errorMsg} />
      )}
    </section>
  )
}
