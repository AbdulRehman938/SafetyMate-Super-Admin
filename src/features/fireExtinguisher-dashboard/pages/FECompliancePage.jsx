import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, Mail, Link, CheckCircle, AlertCircle, Save, Eye, Edit, Copy, Send } from 'lucide-react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { db, app } from '../../../config/firebase.js'
import { useAuth } from '../../../app/providers/authContext.js'
import '../fe.css'

/* ─────────────────────────────────────────────────────────────
   Compliance Configuration Page
   Matches Figma design for Notification Management
───────────────────────────────────────────────────────────── */

const INTERVAL_CONFIGS = [
  {
    id: 'alert_90day',
    title: '90-Day Early Alert',
    desc: 'Initial courtesy notification for planning.',
    defaultEnabled: true,
  },
  {
    id: 'alert_30day',
    title: '30-Day Critical Alert',
    desc: 'Escalated warning for immediate scheduling.',
    defaultEnabled: true,
  },
  {
    id: 'alert_7day',
    title: '7-Day Urgent Alert',
    desc: 'High-priority warning for overdue compliance.',
    defaultEnabled: true,
  },
  {
    id: 'alert_expired',
    title: 'Expired Alert',
    desc: 'Legal compliance violation notification.',
    defaultEnabled: true,
  },
]

const DEFAULT_TEMPLATE = `COMPLIANCE ALERT: Fire Extinguisher Expiry

Dear [Client Name],

This is an automated notification regarding fire extinguisher compliance at [Location].

Asset Details:
• Unit ID: [Asset ID]
• Type: [Extinguisher Type]
• Expiry Date: [Expiry Date]

Please ensure inspection and certification are completed before the expiry date to maintain compliance.

Best regards,
SafetyMate Compliance Team`

/* ── Toggle Switch Component ── */
function ToggleSwitch({ enabled, onChange, disabled }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!enabled)}
      disabled={disabled}
      style={{
        width: 48,
        height: 26,
        borderRadius: 13,
        background: enabled ? 'rgba(22,201,136,0.85)' : 'rgba(255,255,255,0.08)',
        border: enabled ? '1px solid rgba(22,201,136,0.4)' : '1px solid rgba(255,255,255,0.12)',
        position: 'relative',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 0.2s, border-color 0.2s',
        padding: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: enabled ? 25 : 3,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: enabled ? '#fff' : 'rgba(148,163,184,0.5)',
          transition: 'left 0.2s cubic-bezier(0.16,1,0.3,1), background 0.2s',
          boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
        }}
      />
    </button>
  )
}

/* ── Main Page Component ── */
export function FECompliancePage() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [config, setConfig] = useState({
    intervals: INTERVAL_CONFIGS.reduce((acc, cfg) => ({ ...acc, [cfg.id]: cfg.defaultEnabled }), {}),
    channels: {
      email: true,
      sms: false,
    },
    recipientEmail: '', // Email where alerts are sent
    emailTemplate: DEFAULT_TEMPLATE,
  })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const [activeTab, setActiveTab] = useState('email')
  const [editingTemplate, setEditingTemplate] = useState(false)
  const [templateContent, setTemplateContent] = useState(DEFAULT_TEMPLATE)

  // Load config from Firestore on mount
  useEffect(() => {
    async function loadConfig() {
      try {
        const docRef = doc(db, 'fe_compliance_config', 'default')
        const docSnap = await getDoc(docRef)
        if (docSnap.exists()) {
          const data = docSnap.data()
          setConfig(data)
          if (data.emailTemplate) {
            setTemplateContent(data.emailTemplate)
          }
        }
      } catch (err) {
        console.error('Failed to load compliance config:', err)
      }
    }
    loadConfig()
  }, [])

  function handleIntervalToggle(id) {
    setConfig((prev) => ({
      ...prev,
      intervals: { ...prev.intervals, [id]: !prev.intervals[id] },
    }))
  }

  function handleChannelToggle(channel) {
    setConfig((prev) => ({
      ...prev,
      channels: { ...prev.channels, [channel]: !prev.channels[channel] },
    }))
  }

  async function handleSave() {
    setSaving(true)
    setToast(null)
    try {
      await setDoc(doc(db, 'fe_compliance_config', 'default'), config, { merge: true })
      setToast({ type: 'ok', text: 'Configuration saved successfully.' })
      setTimeout(() => setToast(null), 3000)
    } catch (err) {
      setToast({ type: 'err', text: 'Failed to save configuration.' })
    } finally {
      setSaving(false)
    }
  }

  async function handleTestNotification() {
    const recipient = config.recipientEmail?.trim()
    if (!recipient) {
      setToast({ type: 'err', text: 'Enter a recipient email address before sending a test.' })
      return
    }

    setSaving(true)
    setToast(null)
    try {
      const functions = getFunctions(app)
      const sendAlert = httpsCallable(functions, 'sendFEComplianceAlert')

      const result = await sendAlert({
        to: recipient,
        subject: 'COMPLIANCE ALERT: Fire Extinguisher Expiry',
        isTest: true,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f4f6fa;padding:32px;">
            <div style="background:#0a0f1e;border-radius:12px;padding:28px;color:#fff;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:800;letter-spacing:0.08em;color:rgba(254,142,42,0.9);text-transform:uppercase;">
                🧪 Test Email — SafetyMate Compliance System
              </p>
              <h1 style="margin:0 0 16px;font-size:20px;color:#fff;">COMPLIANCE ALERT: Fire Extinguisher Expiry</h1>
              <p style="margin:0 0 12px;color:rgba(203,214,255,0.8);font-size:14px;">
                Dear <strong style="color:#fff;">[Client Name]</strong>,
              </p>
              <p style="margin:0 0 12px;color:rgba(203,214,255,0.8);font-size:14px;">
                This is an automated notification regarding fire extinguisher compliance at <strong style="color:#fff;">[Location]</strong>.
              </p>
              <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:16px;margin:0 0 16px;">
                <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:rgba(148,163,184,0.7);letter-spacing:0.05em;text-transform:uppercase;">Asset Details</p>
                <p style="margin:4px 0;font-size:13px;color:rgba(235,242,255,0.9);">• Unit ID: <span style="color:#8ab8ff;font-weight:600;">[Asset ID]</span></p>
                <p style="margin:4px 0;font-size:13px;color:rgba(235,242,255,0.9);">• Type: <span style="color:#8ab8ff;font-weight:600;">[Extinguisher Type]</span></p>
                <p style="margin:4px 0;font-size:13px;color:rgba(235,242,255,0.9);">• Expiry Date: <span style="color:#ff8080;font-weight:600;">[Expiry Date]</span></p>
              </div>
              <p style="margin:0 0 12px;color:rgba(203,214,255,0.8);font-size:14px;">
                Please ensure inspection and certification are completed before the expiry date to maintain compliance.
              </p>
              <p style="margin:0;color:rgba(203,214,255,0.8);font-size:14px;">
                Best regards,<br/>
                <strong style="color:#fff;">SafetyMate Compliance Team</strong>
              </p>
            </div>
            <p style="text-align:center;margin:16px 0 0;font-size:11px;color:rgba(148,163,184,0.5);">
              © 2026 BGB Group (Pty) Ltd. All Rights Reserved. SafetyMate™
            </p>
          </div>
        `,
        text: templateContent,
      })

      if (result.data?.ok) {
        setToast({ type: 'ok', text: `Test email sent to ${recipient} via Brevo SMTP.` })
      } else {
        setToast({ type: 'err', text: 'Email function returned an unexpected response.' })
      }
    } catch (err) {
      console.error('Test email failed:', err)
      setToast({ type: 'err', text: `Failed to send test: ${err.message || 'Unknown error'}` })
    } finally {
      setSaving(false)
      setTimeout(() => setToast(null), 5000)
    }
  }

  function handleCopyTemplate() {
    navigator.clipboard.writeText(templateContent).then(() => {
      setToast({ type: 'ok', text: 'Template copied to clipboard.' })
      setTimeout(() => setToast(null), 3000)
    }).catch(() => {
      setToast({ type: 'err', text: 'Failed to copy template.' })
    })
  }

  function handleEditTemplate() {
    setEditingTemplate(!editingTemplate)
  }

  function handleTemplateChange(e) {
    const newContent = e.target.value
    setTemplateContent(newContent)
    setConfig((prev) => ({
      ...prev,
      emailTemplate: newContent,
    }))
  }

  return (
    <div className="fe-subpage fe-comp-page">

      {/* ── Header ── */}
      <div className="fe-comp-header">
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, flexWrap:'wrap' }}>
            <span className="fe-comp-kicker">SECURITY PROTOCOL CONFIG</span>
          </div>
          <h1 className="fe-comp-title">Notification Management</h1>
          <p className="fe-comp-subtitle">
            Configure multi-stage compliance alerts for critical safety asset expiry. 
            Orchestrate automated communications across multiple high-availability channels.
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button
            type="button"
            className="fe-btn fe-btn--primary"
            onClick={handleSave}
            disabled={saving}
            style={{ flexShrink:0 }}
          >
            {saving ? <span className="fe-spinner" style={{ width:14, height:14 }}/> : <Save size={14}/>}
            Apply Changes
          </button>
        </div>
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div className={toast.type==='ok' ? 'fe-toast-ok' : 'fe-toast-err'} style={{ marginBottom:16 }}>
          {toast.type==='ok' ? <CheckCircle size={14}/> : <AlertCircle size={14}/>} {toast.text}
        </div>
      )}

      {/* ── Main Grid ── */}
      <div className="fe-comp-grid">

        {/* LEFT: Interval Configuration */}
        <div className="fe-card fe-comp-card">
          <div className="fe-card-head">
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div className="fe-reg-section-icon" style={{ color:'#4deba0', borderColor:'rgba(22,201,136,0.25)', background:'rgba(22,201,136,0.1)' }}>
                <Clock size={14}/>
              </div>
              <span className="fe-card-title">Interval Configuration</span>
            </div>
          </div>
          <div style={{ padding:'12px 0' }}>
            {INTERVAL_CONFIGS.map((cfg) => (
              <div key={cfg.id} className="fe-comp-interval-row">
                <div className="fe-comp-interval-body">
                  <p className="fe-comp-interval-title">{cfg.title}</p>
                  <p className="fe-comp-interval-desc">{cfg.desc}</p>
                </div>
                <ToggleSwitch
                  enabled={config.intervals[cfg.id]}
                  onChange={() => handleIntervalToggle(cfg.id)}
                  disabled={saving}
                />
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: Template Preview */}
        <div className="fe-card fe-comp-card">
          <div className="fe-card-head">
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div className="fe-reg-section-icon" style={{ color:'#5ba8ff', borderColor:'rgba(58,130,255,0.25)', background:'rgba(58,130,255,0.1)' }}>
                <Mail size={14}/>
              </div>
              <span className="fe-card-title">Template Preview</span>
            </div>
            <div style={{ display:'flex', gap:6 }}>
              <button
                type="button"
                className="fe-icon-btn"
                onClick={handleEditTemplate}
                title="Edit template"
                style={{ width:28, height:28 }}
              >
                <Edit size={12}/>
              </button>
              <button
                type="button"
                className="fe-icon-btn"
                onClick={handleCopyTemplate}
                title="Copy template"
                style={{ width:28, height:28 }}
              >
                <Copy size={12}/>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display:'flex', gap:4, padding:'0 18px', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
            <button
              type="button"
              className={`fe-comp-tab${activeTab === 'email' ? ' active' : ''}`}
              onClick={() => setActiveTab('email')}
            >
              PROTOCOL EMAIL GATEWAY
            </button>
          </div>

          {/* Preview Content */}
          <div className="fe-comp-template-preview">
            {editingTemplate ? (
              <textarea
                value={templateContent}
                onChange={handleTemplateChange}
                className="fe-comp-template-editor"
                style={{
                  width: '100%',
                  minHeight: 200,
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(58,130,255,0.3)',
                  borderRadius: 6,
                  color: 'rgba(235,242,255,0.9)',
                  fontFamily: "'SFMono-Regular','Consolas',monospace",
                  fontSize: '11px',
                  lineHeight: 1.6,
                  padding: '14px',
                  resize: 'vertical',
                  outline: 'none',
                }}
              />
            ) : (
              <>
                <div className="fe-comp-email-header">
                  <p className="fe-comp-email-subject">COMPLIANCE ALERT: Fire Extinguisher Expiry</p>
                  <p className="fe-comp-email-meta">From: SafetyMate System &lt;alerts@safetymate.com&gt;</p>
                </div>
                <div className="fe-comp-email-body">
                  <p className="fe-comp-email-text">
                    Dear <span className="fe-comp-placeholder">[Client Name]</span>,
                  </p>
                  <p className="fe-comp-email-text">
                    This is an automated notification regarding fire extinguisher compliance at <span className="fe-comp-placeholder">[Location]</span>.
                  </p>
                  <p className="fe-comp-email-text">
                    <strong>Asset Details:</strong><br/>
                    • Unit ID: <span className="fe-comp-placeholder">[Asset ID]</span><br/>
                    • Type: <span className="fe-comp-placeholder">[Extinguisher Type]</span><br/>
                    • Expiry Date: <span className="fe-comp-placeholder">[Expiry Date]</span>
                  </p>
                  <p className="fe-comp-email-text">
                    Please ensure inspection and certification are completed before the expiry date to maintain compliance.
                  </p>
                  <p className="fe-comp-email-text">
                    Best regards,<br/>
                    SafetyMate Compliance Team
                  </p>
                </div>
              </>
            )}
          </div>

          <div style={{ padding:'14px 18px', borderTop:'1px solid rgba(255,255,255,0.05)' }}>
            <button 
              type="button" 
              className="fe-btn fe-btn--ghost" 
              style={{ width:'100%', justifyContent:'center', fontSize:12 }}
              onClick={() => navigate('/extinguisher/assets')}
            >
              <Eye size={12}/> View Asset Log
            </button>
          </div>
        </div>
      </div>

      {/* ── Channel Management ── */}
      <div className="fe-card fe-comp-card" style={{ marginTop:18 }}>
        <div className="fe-card-head">
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div className="fe-reg-section-icon" style={{ color:'#ffb56e', borderColor:'rgba(254,142,42,0.25)', background:'rgba(254,142,42,0.1)' }}>
              <Link size={14}/>
            </div>
            <span className="fe-card-title">Channel Management</span>
          </div>
        </div>

        {/* Recipient email input */}
        <div style={{ padding:'16px 20px 0', borderBottom:'1px solid rgba(255,255,255,0.05)', marginBottom:4 }}>
          <label style={{ display:'block', fontSize:11, fontWeight:800, letterSpacing:'0.07em', color:'rgba(148,163,184,0.7)', marginBottom:6 }}>
            ALERT RECIPIENT EMAIL
          </label>
          <div style={{ display:'flex', gap:10, alignItems:'center', paddingBottom:16 }}>
            <input
              type="email"
              value={config.recipientEmail || ''}
              onChange={(e) => setConfig((prev) => ({ ...prev, recipientEmail: e.target.value }))}
              placeholder="e.g. safety@yourcompany.com"
              style={{
                flex:1, padding:'9px 12px',
                background:'rgba(255,255,255,0.04)',
                border:'1px solid rgba(255,255,255,0.1)',
                borderRadius:8, color:'rgba(235,242,255,0.9)',
                fontSize:13.5, outline:'none',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(58,130,255,0.5)' }}
              onBlur={(e)  => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
            />
            <button
              type="button"
              className="fe-btn fe-btn--ghost"
              onClick={handleTestNotification}
              disabled={saving || !config.recipientEmail?.trim()}
              style={{ flexShrink:0, gap:6 }}
            >
              {saving
                ? <span className="fe-spinner" style={{ width:13, height:13 }}/>
                : <Send size={13}/>
              }
              Send Test
            </button>
          </div>
          <p style={{ margin:'0 0 12px', fontSize:11.5, color:'rgba(148,163,184,0.45)' }}>
            Compliance alerts for expiring/expired assets will be sent to this address. Use "Send Test" to verify delivery.
          </p>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:16, padding:'16px 20px' }}>
          <div className="fe-comp-channel-card">
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
              <p className="fe-comp-channel-name">Email Protocol</p>
              <span className={`fe-comp-channel-status${config.channels.email ? ' active' : ''}`}>
                {config.channels.email ? 'ACTIVE' : 'INACTIVE'}
              </span>
            </div>
            <p className="fe-comp-channel-desc">Primary notification channel for all compliance alerts.</p>
            <div style={{ marginTop:12 }}>
              <ToggleSwitch
                enabled={config.channels.email}
                onChange={() => handleChannelToggle('email')}
                disabled={saving}
              />
            </div>
          </div>
          <div className="fe-comp-channel-card">
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
              <p className="fe-comp-channel-name">SMS Direct</p>
              <span className={`fe-comp-channel-status${config.channels.sms ? ' active' : ''}`}>
                {config.channels.sms ? 'ACTIVE' : 'PENDING'}
              </span>
            </div>
            <p className="fe-comp-channel-desc">Urgent alerts via SMS for critical compliance violations.</p>
            <div style={{ marginTop:12 }}>
              <ToggleSwitch
                enabled={config.channels.sms}
                onChange={() => handleChannelToggle('sms')}
                disabled={saving}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Data Infrastructure ── */}
      <div className="fe-comp-infrastructure">
        <div className="fe-comp-infra-content">
          <h3 className="fe-comp-infra-title">Data Infrastructure</h3>
          <p className="fe-comp-infra-desc">
            Redundant cloud instances ensuring 99.99% notification reliability across all global jurisdictions.
          </p>
        </div>
      </div>

    </div>
  )
}
