import { addDoc, collection, serverTimestamp, Timestamp } from 'firebase/firestore'
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  LayoutGrid,
  Mail,
  Megaphone,
  Send,
  Shield,
  Smartphone,
  Users,
  Zap,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { db } from '../config/firebase.js'
import { useAuth } from '../app/providers/authContext.js'

const AUDIENCE_OPTIONS = [
  { value: 'all_users', label: 'All Users', meta: 'Total: 452 employees', icon: Users },
  { value: 'admins_only', label: 'Admins Only', meta: 'Safety managers + supervisors', icon: Shield },
  { value: 'specific_departments', label: 'Specific Departments', meta: 'Select by team or region', icon: LayoutGrid },
]

const CHANNEL_OPTIONS = [
  { key: 'email', label: 'Email', highOpenRate: true, icon: Mail },
  { key: 'in_app', label: 'In-App Notification', icon: Megaphone },
  { key: 'sms', label: 'SMS Message', premium: true },
]

const TOOLBAR_ITEMS = ['B', 'I', 'U', '•', '1.', 'Link', 'Image']

export function SendNotificationPage() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const { companyId } = useParams()
  const { authUser } = useAuth()

  const companyName = state?.companyName || state?.company?.name || state?.company?.companyName || 'Selected Company'

  const [audience, setAudience] = useState('all_users')
  const [channels, setChannels] = useState({ email: true, in_app: true, sms: false })
  const [subject, setSubject] = useState('')
  const [messageBody, setMessageBody] = useState('')
  const [scheduleMode, setScheduleMode] = useState('immediate')
  const [scheduledAt, setScheduledAt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [successCampaignId, setSuccessCampaignId] = useState(null)

  const selectedChannels = useMemo(
    () => CHANNEL_OPTIONS.filter((c) => channels[c.key]).map((c) => c.label),
    [channels],
  )

  const estimatedRecipients = useMemo(() => {
    if (audience === 'admins_only') return 42
    if (audience === 'specific_departments') return 120
    return 452
  }, [audience])

  const smsCharacterCount = messageBody.length

  async function onSubmit() {
    if (!subject.trim() || !messageBody.trim()) return
    if (selectedChannels.length === 0) return
    if (scheduleMode === 'later' && !scheduledAt) return

    setSubmitting(true)
    try {
      const scheduleValue =
        scheduleMode === 'immediate'
          ? 'immediate'
          : Timestamp.fromDate(new Date(scheduledAt))

      const docRef = await addDoc(collection(db, 'notification_campaigns'), {
        organizationId: companyId,
        organizationName: companyName,
        audience,
        channels: selectedChannels,
        subject: subject.trim(),
        messageBody: messageBody.trim(),
        schedule: scheduleValue,
        status: 'pending',
        createdBy: authUser?.uid || null,
        createdAt: serverTimestamp(),
      })

      setSuccessCampaignId(docRef.id)
    } finally {
      setSubmitting(false)
    }
  }

  if (successCampaignId) {
    return (
      <section className="stack-gap notify-shell">
        <article className="dashboard-card notify-success-card">
          <span className="notify-success-icon">
            <CheckCircle2 size={22} />
          </span>
          <h2>Notification Sent Successfully</h2>
          <p>
            Your campaign has been queued for delivery to <b>{companyName}</b>.
          </p>
          <div className="notify-success-meta">
            <span>Campaign ID: {successCampaignId}</span>
            <span>Recipients: {estimatedRecipients}</span>
          </div>
          <div className="notify-success-actions">
            <button
              type="button"
              className="secondary-btn"
              onClick={() => {
                setSuccessCampaignId(null)
                setSubject('')
                setMessageBody('')
              }}
            >
              Create Another
            </button>
            <button type="button" className="primary-btn" onClick={() => navigate('/company')}>
              Back to Subscribers
            </button>
          </div>
        </article>
      </section>
    )
  }

  return (
    <section className="stack-gap notify-shell">
      <header className="notify-header">
        <h2>Send Notification</h2>
        <p>Compose and broadcast messages to {companyName} staff.</p>
      </header>

      <section className="notify-grid">
        <div className="notify-left">
          <article className="dashboard-card notify-card">
            <h3 className="notify-section-title">
              <span className="notify-section-ic">
                <Users size={14} />
              </span>
              1. Target Audience
            </h3>
            <div className="notify-option-list">
              {AUDIENCE_OPTIONS.map((option) => (
                <label className="notify-option notify-option-card" key={option.value}>
                  <div className="notify-option-left">
                    <span className="notify-option-ic">
                      <option.icon size={14} />
                    </span>
                    <div>
                      <b>{option.label}</b>
                      <span>{option.meta}</span>
                    </div>
                  </div>
                  <input
                    type="radio"
                    name="audience"
                    checked={audience === option.value}
                    onChange={() => setAudience(option.value)}
                  />
                </label>
              ))}
            </div>
          </article>

          <article className="dashboard-card notify-card">
            <div className="notify-card-head-row">
              <h3 className="notify-section-title">
                <span className="notify-section-ic">
                  <Megaphone size={14} />
                </span>
                3. Compose Message
              </h3>
              <label className="notify-template-select">
                <span>Load Template:</span>
                <button type="button" className="notify-template-btn">
                  Select a template... <ChevronDown size={14} />
                </button>
              </label>
            </div>

            <label className="notify-field">
              <span>SUBJECT LINE</span>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Urgent: Site Closure - Weather Alert"
              />
            </label>

            <label className="notify-field">
              <span>MESSAGE BODY</span>
              <div className="notify-editor">
                <div className="notify-toolbar" aria-hidden="true">
                  {TOOLBAR_ITEMS.map((item) => (
                    <button key={item} type="button">
                      {item}
                    </button>
                  ))}
                  <span className="notify-char-counter">Characters: {smsCharacterCount} / 160 (SMS limit)</span>
                </div>
                <textarea
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                  placeholder="Type your message here..."
                />
              </div>
            </label>
          </article>

          <article className="dashboard-card notify-card">
            <h3 className="notify-section-title">
              <span className="notify-section-ic">
                <Clock3 size={14} />
              </span>
              4. Delivery Schedule
            </h3>
            <div className="notify-schedule-grid">
              <div className="notify-option-list">
                <label
                  className={`notify-option notify-schedule-option ${
                    scheduleMode === 'immediate' ? 'notify-schedule-option-active' : ''
                  }`}
                >
                  <input
                    type="radio"
                    name="schedule"
                    checked={scheduleMode === 'immediate'}
                    onChange={() => setScheduleMode('immediate')}
                  />
                  <div className="notify-schedule-copy">
                    <b className="notify-schedule-title">
                      <span className="notify-schedule-title-icon">
                        <Zap size={14} />
                      </span>
                      Send Immediately
                    </b>
                    <span>Broadcast to all selected channels now.</span>
                  </div>
                </label>

                <label
                  className={`notify-option notify-schedule-option ${
                    scheduleMode === 'later' ? 'notify-schedule-option-active' : ''
                  }`}
                >
                  <input
                    type="radio"
                    name="schedule"
                    checked={scheduleMode === 'later'}
                    onChange={() => setScheduleMode('later')}
                  />
                  <div className="notify-schedule-copy">
                    <b className="notify-schedule-title">
                      <span className="notify-schedule-title-icon">
                        <CalendarDays size={14} />
                      </span>
                      Schedule for Later
                    </b>
                    <span>Pick a specific date and time for delivery.</span>
                  </div>
                </label>
              </div>

              <div className={`notify-schedule-picker ${scheduleMode !== 'later' ? 'notify-disabled' : ''}`}>
                <label>
                  <span>DATE</span>
                  <div className="notify-input-with-icon">
                    <CalendarDays size={14} />
                    <input
                      type="date"
                      value={scheduledAt.split('T')[0] || ''}
                      onChange={(e) => {
                        const prevTime = scheduledAt.includes('T') ? scheduledAt.split('T')[1] : '00:00'
                        setScheduledAt(`${e.target.value}T${prevTime}`)
                      }}
                      disabled={scheduleMode !== 'later'}
                    />
                  </div>
                </label>
                <label>
                  <span>TIME</span>
                  <div className="notify-input-with-icon">
                    <Clock3 size={14} />
                    <input
                      type="time"
                      value={scheduledAt.includes('T') ? scheduledAt.split('T')[1] : ''}
                      onChange={(e) => {
                        const prevDate = scheduledAt.split('T')[0] || new Date().toISOString().slice(0, 10)
                        setScheduledAt(`${prevDate}T${e.target.value}`)
                      }}
                      disabled={scheduleMode !== 'later'}
                    />
                  </div>
                </label>
                <p className="notify-timezone">Timezone: Central Standard Time (GMT-6)</p>
              </div>
            </div>
          </article>
        </div>

        <div className="notify-right">
          <article className="dashboard-card notify-card">
            <h3 className="notify-section-title">
              <span className="notify-section-ic">
                <Mail size={14} />
              </span>
              2. Notification Channels
            </h3>
            <div className="notify-option-list">
              {CHANNEL_OPTIONS.map((channel) => (
                <label className="notify-option notify-option-card" key={channel.key}>
                  <div className="notify-option-left">
                    <span className="notify-option-ic">
                      {channel.key === 'email' ? <Mail size={14} /> : null}
                      {channel.key === 'in_app' ? <Megaphone size={14} /> : null}
                      {channel.key === 'sms' ? <Smartphone size={14} /> : null}
                    </span>
                    <div className="notify-channel-row">
                      <b>{channel.label}</b>
                      <div className="notify-channel-badges">
                        {channel.highOpenRate ? <span className="notify-open-badge">High Open Rate</span> : null}
                        {channel.premium ? <span className="notify-premium-badge">Premium</span> : null}
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(channels[channel.key])}
                    onChange={(e) =>
                      setChannels((prev) => ({
                        ...prev,
                        [channel.key]: e.target.checked,
                      }))
                    }
                  />
                </label>
              ))}
            </div>
          </article>
        </div>
      </section>

      <footer className="notify-footer">
        <div className="notify-footer-left">
          <button type="button" className="link-btn" onClick={() => navigate('/company')}>
            Cancel
          </button>
          <button type="button" className="secondary-btn">
            Save as Draft
          </button>
        </div>

        <div className="notify-footer-right">
          <span>
            ESTIMATED <b>{estimatedRecipients} Notifications</b>
          </span>
          <button
            type="button"
            className="primary-btn notify-send-btn"
            disabled={
              submitting ||
              !subject.trim() ||
              !messageBody.trim() ||
              selectedChannels.length === 0 ||
              (scheduleMode === 'later' && !scheduledAt)
            }
            onClick={onSubmit}
          >
            <Send size={14} /> {submitting ? 'Sending…' : 'Send Notification'}
          </button>
        </div>
      </footer>
    </section>
  )
}
