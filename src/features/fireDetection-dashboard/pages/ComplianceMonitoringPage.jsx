import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCircle2, AlertCircle, Clock, Shield, MessageSquare, Smartphone, RefreshCw, XCircle } from 'lucide-react'
import { useFireDetectionData } from '../hooks/useFireDetectionData.js'
import '../fd.css'

export function ComplianceMonitoringPage() {
  const navigate = useNavigate()
  const {
    complianceNotifications,
    updateComplianceNotifications,
    loading,
    addActivityEntry,
    activityLog,
  } = useFireDetectionData()

  const [localConfig, setLocalConfig] = useState(null)
  const [saving, setSaving] = useState(false)
  const [modal, setModal] = useState({ show: false, title: '', message: '', type: 'info' })
  const [showAuditLog, setShowAuditLog] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState(false)
  const [templateSubject, setTemplateSubject] = useState('')
  const [templateBody, setTemplateBody] = useState('')

  useEffect(() => {
    if (complianceNotifications) {
      setLocalConfig(complianceNotifications)
      setTemplateSubject(complianceNotifications.emailSubject || 'URGENT: Fire Compliance Expiry Notice')
      setTemplateBody(complianceNotifications.emailBody || 'Dear {user}, Administrator,\n\nThis is a system-generated alert regarding the Fire safety certification for {asset_type} is set to expire on {expiry_date}.\n\nIn accordance with our {standard} and safety regulations, all inspections must be logged within the next 7 business days.')
    }
  }, [complianceNotifications])

  const handleToggle = (key) => {
    setLocalConfig(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  const handleSave = async () => {
    if (!localConfig) return
    setSaving(true)
    try {
      await updateComplianceNotifications(localConfig)
      await addActivityEntry({
        type: 'compliance_update',
        message: 'Compliance notification settings updated',
        status: 'success',
      })
      setModal({
        show: true,
        title: 'Success',
        message: 'Compliance notification settings updated successfully!',
        type: 'success'
      })
    } catch (err) {
      console.error('Failed to update compliance settings:', err)
      setModal({
        show: true,
        title: 'Error',
        message: 'Failed to update compliance settings. Please try again.',
        type: 'error'
      })
    } finally {
      setSaving(false)
    }
  }

  const handleViewAuditLog = () => {
    setShowAuditLog(true)
  }

  const handleValidateTemplate = () => {
    setModal({
      show: true,
      title: 'Template Validated',
      message: 'Email template structure is valid and ready for use.',
      type: 'success'
    })
  }

  const handleEditTemplate = () => {
    setEditingTemplate(true)
  }

  const handleSaveTemplate = () => {
    setLocalConfig(prev => ({
      ...prev,
      emailSubject: templateSubject,
      emailBody: templateBody
    }))
    setEditingTemplate(false)
    setModal({
      show: true,
      title: 'Template Updated',
      message: 'Email template has been updated successfully. Remember to click "Apply Changes" to save your settings.',
      type: 'success'
    })
  }

  if (loading || !localConfig) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '60vh', gap: 16, color: 'rgba(148,163,184,0.8)' }}>
        <span className="fd-spinner fd-spinner--lg" />
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          Loading compliance settings...
        </span>
      </div>
    )
  }

  return (
    <div className="fd-subpage">
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: 'rgba(148,163,184,0.55)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                FIREGUARD COMMAND CENTER
              </span>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#16c988', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16c988' }} />
                SYSTEM STATUS: OPERATIONAL
              </span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#3a82ff', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, display: 'block' }}>
              SECURITY PROTOCOL CONFIG
            </span>
            <h1 style={{ margin: 0, fontSize: 'clamp(1.4rem, 3vw, 1.9rem)', fontWeight: 900, color: 'rgba(235,242,255,0.97)', letterSpacing: '-0.025em' }}>
              Notification Management
            </h1>
            <p style={{ margin: '8px 0 0', fontSize: 13, color: 'rgba(148,163,184,0.72)' }}>
              Configure multi-stage compliance alerts for critical safety asset expiry. Orchestrate automated communications across multiple high-availability channels.
            </p>
          </div>
          <button
            type="button"
            className="fd-btn fd-btn--primary"
            onClick={handleSave}
            disabled={saving}
            style={{ fontWeight: 800 }}
          >
            {saving ? <RefreshCw size={14} className="fd-spinner" /> : 'Apply Changes'}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 20, marginBottom: 20 }}>
        {/* Left: Interval Configuration */}
        <div className="fd-card" style={{ padding: '20px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <CheckCircle2 size={18} style={{ color: '#3a82ff' }} />
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'rgba(235,242,255,0.97)' }}>
              Interval Configuration
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* 90-Day Early Alert */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(235,242,255,0.9)' }}>
                  90-Day Early Alert
                </span>
                <span style={{ fontSize: 11, color: 'rgba(148,163,184,0.6)' }}>
                  Pre-warn safety teams for planning
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleToggle('ninetyDayEarlyAlert')}
                style={{
                  width: 48,
                  height: 28,
                  borderRadius: 14,
                  background: localConfig.ninetyDayEarlyAlert ? '#3a82ff' : 'rgba(255,255,255,0.1)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 2,
                  transition: 'background 0.2s',
                }}
              >
                <div style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: '#fff',
                  marginLeft: localConfig.ninetyDayEarlyAlert ? 'auto' : 0,
                  transition: 'margin-left 0.2s',
                }} />
              </button>
            </div>

            {/* 30-Day Critical Alert */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(235,242,255,0.9)' }}>
                  30-Day Critical Alert
                </span>
                <span style={{ fontSize: 11, color: 'rgba(148,163,184,0.6)' }}>
                  Escalated warning for immediate awareness
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleToggle('thirtyDayCriticalAlert')}
                style={{
                  width: 48,
                  height: 28,
                  borderRadius: 14,
                  background: localConfig.thirtyDayCriticalAlert ? '#3a82ff' : 'rgba(255,255,255,0.1)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 2,
                  transition: 'background 0.2s',
                }}
              >
                <div style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: '#fff',
                  marginLeft: localConfig.thirtyDayCriticalAlert ? 'auto' : 0,
                  transition: 'margin-left 0.2s',
                }} />
              </button>
            </div>

            {/* 7-Day Urgent Alert */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(235,242,255,0.9)' }}>
                  7-Day Urgent Alert
                </span>
                <span style={{ fontSize: 11, color: 'rgba(148,163,184,0.6)' }}>
                  High-priority time-sensitive awareness
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleToggle('sevenDayUrgentAlert')}
                style={{
                  width: 48,
                  height: 28,
                  borderRadius: 14,
                  background: localConfig.sevenDayUrgentAlert ? '#3a82ff' : 'rgba(255,255,255,0.1)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 2,
                  transition: 'background 0.2s',
                }}
              >
                <div style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: '#fff',
                  marginLeft: localConfig.sevenDayUrgentAlert ? 'auto' : 0,
                  transition: 'margin-left 0.2s',
                }} />
              </button>
            </div>

            {/* Expired Alert */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(235,242,255,0.9)' }}>
                  Expired Alert
                </span>
                <span style={{ fontSize: 11, color: 'rgba(148,163,184,0.6)' }}>
                  Legal compliance-required notification
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleToggle('expiredAlert')}
                style={{
                  width: 48,
                  height: 28,
                  borderRadius: 14,
                  background: localConfig.expiredAlert ? '#3a82ff' : 'rgba(255,255,255,0.1)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 2,
                  transition: 'background 0.2s',
                }}
              >
                <div style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: '#fff',
                  marginLeft: localConfig.expiredAlert ? 'auto' : 0,
                  transition: 'margin-left 0.2s',
                }} />
              </button>
            </div>
          </div>
        </div>

        {/* Right: Template Preview */}
        <div className="fd-card" style={{ padding: '20px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle2 size={18} style={{ color: '#3a82ff' }} />
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'rgba(235,242,255,0.97)' }}>
                Email Template
              </h3>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {!editingTemplate && (
                <button
                  type="button"
                  onClick={handleEditTemplate}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 6,
                    background: 'rgba(58,130,255,0.1)',
                    border: '1px solid rgba(58,130,255,0.3)',
                    color: '#3a82ff',
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em'
                  }}
                >
                  Edit
                </button>
              )}
              {editingTemplate && (
                <button
                  type="button"
                  onClick={handleSaveTemplate}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 6,
                    background: '#16c988',
                    border: 'none',
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em'
                  }}
                >
                  Save
                </button>
              )}
              <button
                type="button"
                onClick={handleValidateTemplate}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: 'rgba(148,163,184,0.7)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <CheckCircle2 size={16} />
              </button>
            </div>
          </div>

          {/* Email Preview/Edit */}
          <div style={{
            background: 'rgba(0,0,0,0.3)',
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
            border: '1px solid rgba(255,255,255,0.08)',
          }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(148,163,184,0.6)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>PROTOCOL: EMAIL GATEWAY</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#3a82ff' }}>TO: safety.ai@company.com</span>
            </div>
            
            {editingTemplate ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 800, color: 'rgba(148,163,184,0.6)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, display: 'block' }}>
                    Subject
                  </label>
                  <input
                    type="text"
                    value={templateSubject}
                    onChange={(e) => setTemplateSubject(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 8,
                      color: 'rgba(235,242,255,0.9)',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 800, color: 'rgba(148,163,184,0.6)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, display: 'block' }}>
                    Body
                  </label>
                  <textarea
                    value={templateBody}
                    onChange={(e) => setTemplateBody(e.target.value)}
                    rows={6}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 8,
                      color: 'rgba(235,242,255,0.9)',
                      fontSize: 12,
                      lineHeight: '1.5',
                      resize: 'vertical',
                    }}
                  />
                  <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.5)', marginTop: 4 }}>
                    Available variables: {'{user}'}, {'{asset_type}'}, {'{expiry_date}'}, {'{standard}'}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(235,242,255,0.9)' }}>Subject:</span>
                  <span style={{ fontSize: 12, color: 'rgba(235,242,255,0.7)', marginLeft: 8 }}>
                    {templateSubject}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'rgba(148,163,184,0.7)', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                  {templateBody}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            className="fd-btn fd-btn--primary"
            onClick={handleViewAuditLog}
            style={{
              padding: '10px 16px',
              fontWeight: 800,
            }}
          >
            View Audit Log
          </button>
        </div>
      </div>

      {/* Channel Management */}
      <div className="fd-card" style={{ padding: '20px 22px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <MessageSquare size={18} style={{ color: '#3a82ff' }} />
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'rgba(235,242,255,0.97)' }}>
            Channel Management
          </h3>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          {/* Email Protocol */}
          <button
            type="button"
            onClick={() => handleToggle('emailProtocol')}
            style={{
              width: 120,
              padding: '24px 16px',
              borderRadius: 10,
              background: localConfig.emailProtocol ? 'rgba(58,130,255,0.1)' : 'rgba(255,255,255,0.03)',
              border: localConfig.emailProtocol ? '1px solid rgba(58,130,255,0.3)' : '1px solid rgba(255,255,255,0.05)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
            }}
          >
            <MessageSquare size={24} style={{ color: localConfig.emailProtocol ? '#3a82ff' : 'rgba(148,163,184,0.6)' }} />
            <span style={{ fontSize: 11, fontWeight: 800, color: localConfig.emailProtocol ? '#3a82ff' : 'rgba(148,163,184,0.6)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Email Protocol
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, color: localConfig.emailProtocol ? '#16c988' : 'rgba(148,163,184,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {localConfig.emailProtocol ? 'ACTIVE' : 'STANDBY'}
            </span>
          </button>

          {/* SMS Direct */}
          <button
            type="button"
            onClick={() => handleToggle('smsDirect')}
            style={{
              width: 120,
              padding: '24px 16px',
              borderRadius: 10,
              background: localConfig.smsDirect ? 'rgba(58,130,255,0.1)' : 'rgba(255,255,255,0.03)',
              border: localConfig.smsDirect ? '1px solid rgba(58,130,255,0.3)' : '1px solid rgba(255,255,255,0.05)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
            }}
          >
            <Smartphone size={24} style={{ color: localConfig.smsDirect ? '#3a82ff' : 'rgba(148,163,184,0.6)' }} />
            <span style={{ fontSize: 11, fontWeight: 800, color: localConfig.smsDirect ? '#3a82ff' : 'rgba(148,163,184,0.6)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              SMS Direct
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, color: localConfig.smsDirect ? '#16c988' : 'rgba(148,163,184,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {localConfig.smsDirect ? 'ACTIVE' : 'STANDBY'}
            </span>
          </button>
        </div>
      </div>

      {/* Data Infrastructure */}
      <div className="fd-card" style={{ padding: '20px 22px', position: 'relative', overflow: 'hidden' }}>
        {/* Background image overlay */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.7))',
          zIndex: 0,
        }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800, color: 'rgba(235,242,255,0.97)' }}>
            Data Infrastructure
          </h3>
          <p style={{ margin: 0, fontSize: 13, color: 'rgba(148,163,184,0.75)', lineHeight: '1.5' }}>
            Redundant cloud instances ensuring 99.9% notification reliability across all global jurisdictions.
          </p>
        </div>
      </div>

      {/* Custom Modal */}
      {modal.show && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
          <div style={{ background: '#0b0f1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '32px 36px', maxWidth: 440, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              {modal.type === 'success' && <CheckCircle2 size={28} style={{ color: '#16c988' }} />}
              {modal.type === 'error' && <XCircle size={28} style={{ color: '#ff535f' }} />}
              {modal.type === 'info' && <AlertCircle size={28} style={{ color: '#3a82ff' }} />}
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: 'rgba(235,242,255,0.97)' }}>
                {modal.title}
              </h2>
            </div>
            <p style={{ margin: '0 0 24px', fontSize: 14, color: 'rgba(148,163,184,0.85)', lineHeight: '1.6' }}>
              {modal.message}
            </p>
            <button
              type="button"
              onClick={() => setModal({ show: false, title: '', message: '', type: 'info' })}
              style={{
                width: '100%',
                padding: '14px',
                background: modal.type === 'success' ? '#16c988' : modal.type === 'error' ? '#ff535f' : '#3a82ff',
                border: 'none',
                borderRadius: 10,
                color: '#fff',
                fontSize: 14,
                fontWeight: 900,
                cursor: 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '0.06em'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Audit Log Modal */}
      {showAuditLog && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
          <div style={{ background: '#0b0f1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '32px', maxWidth: 700, width: '90%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Clock size={24} style={{ color: '#3a82ff' }} />
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: 'rgba(235,242,255,0.97)' }}>
                  Compliance Audit Log
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowAuditLog(false)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: 'rgba(148,163,184,0.7)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={16} />
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', marginBottom: 20 }}>
              {activityLog && activityLog.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {activityLog
                    .filter(log => log.type === 'compliance_update')
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                    .map((log, index) => (
                      <div key={index} style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(235,242,255,0.9)' }}>
                            {log.message}
                          </span>
                          <span style={{ fontSize: 10, fontWeight: 800, color: log.status === 'success' ? '#16c988' : '#ff535f', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            {log.status}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.6)' }}>
                          {log.createdAt ? new Date(log.createdAt).toLocaleString() : 'Unknown date'}
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(148,163,184,0.6)' }}>
                  <Clock size={48} style={{ color: 'rgba(148,163,184,0.3)', marginBottom: 16 }} />
                  <p style={{ margin: 0, fontSize: 14 }}>
                    No compliance activity logs found
                  </p>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowAuditLog(false)}
              style={{
                width: '100%',
                padding: '14px',
                background: '#3a82ff',
                border: 'none',
                borderRadius: 10,
                color: '#fff',
                fontSize: 14,
                fontWeight: 900,
                cursor: 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '0.06em'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
