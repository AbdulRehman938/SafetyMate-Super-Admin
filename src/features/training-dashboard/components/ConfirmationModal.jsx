import React from 'react'
import { CheckCircle } from 'lucide-react'

export function ConfirmationModal({ isOpen, onClose, onConfirm, details, loading = false, error = null }) {
  if (!isOpen || !details) return null

  return (
    <div className="prov-modal-overlay">
      <div className="prov-modal">
        <h3 className="prov-modal-title">
          <CheckCircle size={18} style={{ color: '#16c988' }} />
          Confirm Certificate Registration
        </h3>
        <p className="prov-modal-desc">
          You are about to register and sync this verified training competency. This will upload the certificate and notify the client organization.
        </p>
        <div className="prov-modal-meta">
          <div className="prov-modal-meta-row">
            <span className="prov-modal-meta-label">Candidate Name</span>
            <span className="prov-modal-meta-value">{details.name}</span>
          </div>
          <div className="prov-modal-meta-row">
            <span className="prov-modal-meta-label">Competency Course</span>
            <span className="prov-modal-meta-value">{details.course}</span>
          </div>
          <div className="prov-modal-meta-row">
            <span className="prov-modal-meta-label">Linked Portal</span>
            <span className="prov-modal-meta-value">{details.orgName}</span>
          </div>
          <div className="prov-modal-meta-row">
            <span className="prov-modal-meta-label">Expiration Date</span>
            <span className="prov-modal-meta-value">{details.expiry}</span>
          </div>
        </div>
        {error && (
          <p style={{ color: '#ff8a8a', fontSize: '13px', margin: '0 0 12px' }}>{error}</p>
        )}
        <div className="prov-modal-actions">
          <button type="button" className="prov-modal-btn-cancel" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button type="button" className="prov-modal-btn-confirm" onClick={onConfirm} disabled={loading}>
            {loading ? 'Uploading…' : 'Confirm & Register'}
          </button>
        </div>
      </div>
    </div>
  )
}
