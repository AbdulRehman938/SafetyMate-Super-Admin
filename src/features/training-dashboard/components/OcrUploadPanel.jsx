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
  const [ocrState, setOcrState] = useState('idle') // idle | processing | review | manual
  const [dragOver, setDragOver] = useState(false)
  const [extracted, setExtracted] = useState(null)
  const [uploadedFile, setUploadedFile] = useState(null)
  const [ocrError, setOcrError] = useState(null)
  const [manualData, setManualData] = useState({ name: '', course: '', expiry: '' })
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
        console.log('OCR API Response:', data)
      } catch {
        const text = await response.text()
        console.error('OCR API non-JSON response:', text)
        throw new Error(`OCR API returned invalid JSON (${response.status}): ${text}`)
      }

      if (!response.ok || data.error) {
        console.error('OCR API Error:', data)
        throw new Error(data.error || data.message || `OCR request failed (${response.status})`)
      }

      const ocrName = (data.name || '').trim()
      const ocrCourse = (data.course || '').trim()
      const ocrExpiry = (data.expiry || '').trim()

      // If OCR couldn't extract required fields, show error with options
      if (!ocrName || !ocrCourse || !ocrExpiry) {
        const missingFields = []
        if (!ocrName) missingFields.push('name')
        if (!ocrCourse) missingFields.push('course')
        if (!ocrExpiry) missingFields.push('expiry')

        setOcrError({
          title: 'OCR Extraction Incomplete',
          message: `Could not extract: ${missingFields.join(', ')}. The certificate may be unclear or in an unsupported format.`,
          allowRetry: true,
          allowManual: true,
          partialData: { name: ocrName, course: ocrCourse, expiry: ocrExpiry },
        })
        setOcrState('idle')
        setUploadedFile(null)
        return
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
    setManualData({ name: '', course: '', expiry: '' })
    if (inputRef.current) inputRef.current.value = ''
  }

  function handleRetry() {
    setOcrError(null)
    if (uploadedFile) {
      processOcr(uploadedFile)
    }
  }

  function handleManualEntry() {
    setOcrError(null)
    setManualData({
      name: ocrError?.partialData?.name || '',
      course: ocrError?.partialData?.course || '',
      expiry: ocrError?.partialData?.expiry || '',
    })
    setOcrState('manual')
  }

  function confirm() {
    if (!uploadedFile) {
      setOcrError({
        title: 'Missing File',
        message: 'Certificate file was lost. Please upload again.',
      })
      return
    }

    let finalName, finalCourse, finalExpiry, finalExpiryDisplay

    if (ocrState === 'manual') {
      // Manual entry mode
      finalName = manualData.name.trim()
      finalCourse = manualData.course.trim()
      const expiryInput = manualData.expiry.trim()

      if (!finalName || !finalCourse || !expiryInput) {
        setOcrError({
          title: 'Missing Fields',
          message: 'Please fill in all required fields: name, course, and expiry date.',
        })
        return
      }

      const parsedDate = parseExpiryDate(expiryInput)
      if (!parsedDate) {
        setOcrError({
          title: 'Invalid Date',
          message: 'Could not parse expiry date. Expected format YYYY-MM-DD.',
        })
        return
      }
      if (parsedDate < new Date()) {
        setOcrError({
          title: 'Certificate Expired',
          message: `The certificate expired on ${formatReadableDate(parsedDate)}. Expired certificates cannot be registered.`,
        })
        return
      }

      finalExpiry = parsedDate
      finalExpiryDisplay = formatReadableDate(parsedDate)
    } else {
      // OCR extraction mode
      if (!extracted) {
        setOcrError({
          title: 'Missing Data',
          message: 'Extracted data was lost. Please upload again.',
        })
        return
      }
      finalName = extracted.name
      finalCourse = extracted.course
      finalExpiry = extracted.rawExpiryDate
      finalExpiryDisplay = extracted.expiry
    }

    // Match employee
    const matchedEmp = matchEmployeeByName(finalName, employees)
    if (!matchedEmp) {
      setOcrError({
        title: 'Candidate Not Found',
        message: `Could not match "${finalName}" to any workforce member in the database.`,
      })
      return
    }

    const org = organizations.find((o) => o.id === matchedEmp.organizationId)
    const orgName = org?.name || '—'

    onConfirm({
      name: matchedEmp.fullName,
      email: matchedEmp.email || '',
      uid: matchedEmp.uid,
      orgId: matchedEmp.organizationId || '',
      orgName,
      course: finalCourse,
      expiry: finalExpiryDisplay,
      rawExpiryDate: finalExpiry,
      trainingRequestId,
      file: uploadedFile,
    })
    discard()
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
          ) : ocrState === 'manual' ? (
            <div style={{ width: '100%' }}>
              <div className="prov-ocr-review">
                <p className="prov-ocr-review-title">📝 Manual Entry — Fill Certificate Details</p>
                <div className="prov-ocr-fields">
                  <div className="prov-ocr-field">
                    <span className="prov-ocr-field-label">Candidate Name</span>
                    <input
                      type="text"
                      value={manualData.name}
                      onChange={(e) => setManualData({ ...manualData, name: e.target.value })}
                      placeholder="Enter full name"
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid rgba(148, 163, 184, 0.3)',
                        background: 'rgba(8, 13, 26, 0.5)',
                        color: '#fff',
                        fontSize: '13px',
                        width: '100%',
                      }}
                    />
                  </div>
                  <div className="prov-ocr-field">
                    <span className="prov-ocr-field-label">Course Name</span>
                    <input
                      type="text"
                      value={manualData.course}
                      onChange={(e) => setManualData({ ...manualData, course: e.target.value })}
                      placeholder="Enter course name"
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid rgba(148, 163, 184, 0.3)',
                        background: 'rgba(8, 13, 26, 0.5)',
                        color: '#fff',
                        fontSize: '13px',
                        width: '100%',
                      }}
                    />
                  </div>
                  <div className="prov-ocr-field">
                    <span className="prov-ocr-field-label">Expiry Date (YYYY-MM-DD)</span>
                    <input
                      type="text"
                      value={manualData.expiry}
                      onChange={(e) => setManualData({ ...manualData, expiry: e.target.value })}
                      placeholder="e.g., 2025-12-31"
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid rgba(148, 163, 184, 0.3)',
                        background: 'rgba(8, 13, 26, 0.5)',
                        color: '#fff',
                        fontSize: '13px',
                        width: '100%',
                      }}
                    />
                  </div>
                </div>
                <div className="prov-ocr-actions">
                  <button type="button" className="prov-btn-confirm" onClick={confirm}>
                    Confirm & Register
                  </button>
                  <button type="button" className="prov-btn-discard" onClick={discard}>
                    Cancel
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
