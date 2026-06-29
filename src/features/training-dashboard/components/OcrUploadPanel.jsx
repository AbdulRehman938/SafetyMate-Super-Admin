import React, { useState, useRef, useCallback } from 'react'
import { AlertTriangle } from 'lucide-react'
import { CertificateTemplateDownloads } from './CertificateTemplateDownloads.jsx'
import { parseExpiryDate, formatReadableDate } from '../utils/dateHelpers.js'

const OCR_API_BASE = import.meta.env.VITE_OCR_API_URL || 'http://localhost:5000'
const OCR_API_URL = `${OCR_API_BASE.replace(/\/$/, '')}/ocr`

function isValidFileType(file) {
  return (
    file.type.match('application/pdf') ||
    file.type.match('image/.*') ||
    file.name.endsWith('.pdf') ||
    file.name.endsWith('.png') ||
    file.name.endsWith('.jpg') ||
    file.name.endsWith('.jpeg')
  )
}

function matchEmployeeByName(name, employees) {
  if (!name) return null
  const normalized = name.trim().toLowerCase()
  return (
    employees.find((emp) => emp.fullName && emp.fullName.trim().toLowerCase() === normalized) ||
    employees.find(
      (emp) =>
        emp.fullName &&
        (normalized.includes(emp.fullName.trim().toLowerCase()) ||
          emp.fullName.trim().toLowerCase().includes(normalized)),
    ) ||
    null
  )
}

export function OcrUploadPanel({ onConfirm, employees, organizations, trainingRequestId = null }) {
  const [ocrState, setOcrState] = useState('idle') // idle | processing | review
  const [dragOver, setDragOver] = useState(false)
  const [extracted, setExtracted] = useState(null)
  const [uploadedFile, setUploadedFile] = useState(null)
  const [ocrError, setOcrError] = useState(null)
  const inputRef = useRef(null)

  async function processOcr(file) {
    setOcrState('processing')
    setOcrError(null)
    setExtracted(null)
    setUploadedFile(file)

    if (!isValidFileType(file)) {
      setOcrError({
        title: 'Unsupported Format',
        message: 'Please upload a valid PDF or image file (.png, .jpg, .jpeg, .pdf).',
      })
      setOcrState('idle')
      setUploadedFile(null)
      return
    }

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(OCR_API_URL, {
        method: 'POST',
        body: formData,
      })

      let data
      try {
        data = await response.json()
      } catch {
        throw new Error(`OCR API returned invalid JSON (${response.status})`)
      }

      if (!response.ok || data.error) {
        throw new Error(data.error || `OCR request failed (${response.status})`)
      }

      const ocrName = (data.name || '').trim()
      const ocrCourse = (data.course || '').trim()
      const ocrExpiry = (data.expiry || '').trim()

      if (!ocrName || !ocrCourse || !ocrExpiry) {
        throw new Error('OCR did not return name, course, and expiry. Please try a clearer scan.')
      }

      const matchedEmp = matchEmployeeByName(ocrName, employees)
      if (!matchedEmp) {
        setOcrError({
          title: 'Candidate Not Found',
          message: `Could not match "${ocrName}" to any workforce member in the database.`,
        })
        setOcrState('idle')
        setUploadedFile(null)
        return
      }

      const matchedDate = parseExpiryDate(ocrExpiry)
      if (!matchedDate) {
        setOcrError({
          title: 'Expiry Date Missing',
          message: `Could not parse expiry date "${ocrExpiry}". Expected format YYYY-MM-DD.`,
        })
        setOcrState('idle')
        setUploadedFile(null)
        return
      }

      if (matchedDate < new Date()) {
        setOcrError({
          title: 'Certificate Expired',
          message: `The certificate expired on ${formatReadableDate(matchedDate)}. Expired certificates cannot be registered.`,
        })
        setOcrState('idle')
        setUploadedFile(null)
        return
      }

      const org = organizations.find((o) => o.id === matchedEmp.organizationId)
      const orgName = org?.name || '—'

      setExtracted({
        name: matchedEmp.fullName,
        email: matchedEmp.email || '',
        uid: matchedEmp.uid,
        orgId: matchedEmp.organizationId || '',
        orgName,
        course: ocrCourse,
        expiry: formatReadableDate(matchedDate),
        rawExpiryDate: matchedDate,
        trainingRequestId,
      })
      setOcrState('review')
    } catch (err) {
      console.error('OCR processing failed:', err)
      setOcrError({
        title: 'OCR Failed',
        message: err.message || 'Could not process the certificate file.',
      })
      setOcrState('idle')
      setUploadedFile(null)
    }
  }

  const handleFileChange = useCallback(
    (e) => {
      const file = e.target.files[0]
      if (file) processOcr(file)
    },
    [employees, organizations],
  )

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length > 0) processOcr(e.dataTransfer.files[0])
  }

  function discard() {
    setOcrState('idle')
    setExtracted(null)
    setUploadedFile(null)
    setOcrError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  function confirm() {
    if (!extracted || !uploadedFile) {
      setOcrError({
        title: 'Missing File',
        message: 'Certificate file was lost. Please upload again.',
      })
      return
    }

    onConfirm({ ...extracted, file: uploadedFile })
    setOcrState('idle')
    setExtracted(null)
    setUploadedFile(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div style={{ width: '100%', marginBottom: '22px' }}>
      <div className="provider-upload-grid">
        <div
          className={`prov-dropzone${dragOver ? ' prov-dropzone--drag-over' : ''}`}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          {ocrState === 'processing' ? (
            <div className="prov-ocr-processing">
              <div className="prov-ocr-spinner" />
              <p className="prov-ocr-label">Analyzing file with OCR engine…</p>
            </div>
          ) : ocrState === 'review' ? (
            <div style={{ width: '100%' }}>
              <div className="prov-ocr-review">
                <p className="prov-ocr-review-title">✅ Extraction Complete — Review Below</p>
                <div className="prov-ocr-fields">
                  <div className="prov-ocr-field">
                    <span className="prov-ocr-field-label">Candidate</span>
                    <span className="prov-ocr-field-value">{extracted?.name}</span>
                  </div>
                  <div className="prov-ocr-field">
                    <span className="prov-ocr-field-label">Linked Org</span>
                    <span className="prov-ocr-field-value">{extracted?.orgName}</span>
                  </div>
                  <div className="prov-ocr-field">
                    <span className="prov-ocr-field-label">Course</span>
                    <span className="prov-ocr-field-value">{extracted?.course}</span>
                  </div>
                  <div className="prov-ocr-field">
                    <span className="prov-ocr-field-label">Expiry</span>
                    <span className="prov-ocr-field-value">{extracted?.expiry}</span>
                  </div>
                </div>
                <div className="prov-ocr-actions">
                  <button type="button" className="prov-btn-confirm" onClick={confirm}>
                    Approve & Register
                  </button>
                  <button type="button" className="prov-btn-discard" onClick={discard}>
                    Discard
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <input ref={inputRef} type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={handleFileChange} style={{ display: 'none' }} id="file-upload-input" />
              <label htmlFor="file-upload-input" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', height: '100%', justifyContent: 'center' }}>
                <div className="prov-dropzone-icon">☁</div>
                <p className="prov-dropzone-label">Drop PDF or Scan</p>
                <p className="prov-dropzone-hint">or click to browse your files</p>
              </label>
            </>
          )}
        </div>

        <div className="prov-upload-info">
          <h3 className="prov-upload-info-title">Instant Certificate Bulk Upload</h3>
          <p className="prov-upload-info-desc">
            Drag your completed training certification files here. Our OCR engine will automatically map names, dates,
            and competency levels to employee records across all verified client portals.
          </p>
          <div className="prov-upload-badges">
            <span className="prov-upload-badge">✓ OCR Validation Active</span>
            <span className="prov-upload-badge prov-upload-badge--pending">Supports PDF, PNG, JPG</span>
          </div>
          <CertificateTemplateDownloads compact />
          <div style={{ marginTop: '12px', fontSize: '11px', color: 'rgba(148, 163, 184, 0.6)', lineHeight: '1.4' }}>
            💡 <strong>OCR Testing Tip:</strong> Ensure the certificate clearly shows candidate name, course, and expiry date.
          </div>
        </div>
      </div>

      {ocrError && (
        <div className="prov-ocr-error">
          <AlertTriangle className="prov-ocr-error-icon" size={16} />
          <div>
            <p className="prov-ocr-error-title">{ocrError.title}</p>
            <p className="prov-ocr-error-msg">{ocrError.message}</p>
          </div>
        </div>
      )}
    </div>
  )
}
