import React, { useState } from 'react'
import { Download } from 'lucide-react'
import {
  CERTIFICATE_TEMPLATE_FORMATS,
  downloadCertificateTemplate,
} from '../utils/certificateTemplateDownloads.js'

export function CertificateTemplateDownloads({ compact = false }) {
  const [downloading, setDownloading] = useState(null)
  const [error, setError] = useState(null)

  async function handleDownload(format) {
    setDownloading(format)
    setError(null)
    try {
      await downloadCertificateTemplate(format)
    } catch (err) {
      console.error('Template download failed:', err)
      setError(err.message || 'Could not download template.')
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className={`prov-template-downloads${compact ? ' prov-template-downloads--compact' : ''}`}>
      <div className="prov-template-downloads-head">
        <p className="prov-template-downloads-title">Required Layout Templates</p>
        {!compact && (
          <p className="prov-template-downloads-desc">
            Download the standard certificate layout before scanning or uploading. Include candidate name, course,
            issue date, and expiry date so OCR can register the record correctly.
          </p>
        )}
      </div>
      <div className="prov-template-downloads-actions">
        {CERTIFICATE_TEMPLATE_FORMATS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className="prov-template-download-btn"
            onClick={() => handleDownload(id)}
            disabled={Boolean(downloading)}
          >
            <Download size={13} />
            {downloading === id ? 'Preparing…' : label}
          </button>
        ))}
      </div>
      {error && <p className="prov-template-downloads-error">{error}</p>}
    </div>
  )
}
