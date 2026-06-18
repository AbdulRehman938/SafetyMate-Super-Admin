import React, { useState, useEffect, useRef } from 'react'
import {
  Award,
  Search,
  Calendar,
  ChevronDown,
  CheckCircle,
  Info,
  ArrowLeft,
  AlertTriangle,
  Clock,
  Printer,
  Download,
  X,
  Upload
} from 'lucide-react'
import { useToast } from '../../../shared/toast/toastContext.js'
import { CertificateTemplateDownloads } from '../components/CertificateTemplateDownloads.jsx'

const ISSUING_BODY_MAP = [
  { match: /fire/i, body: 'National Fire Inst.' },
  { match: /first aid/i, body: 'Red Cross Corp.' },
  { match: /confined space/i, body: 'OSHA Alliance' },
  { match: /height/i, body: 'Global Safety Org' },
  { match: /chemical|hazmat/i, body: 'Industrial Board' },
  { match: /osha/i, body: 'OSHA Alliance' },
]

const COURSES_LIST = [
  'Advanced Fire Safety',
  'OSHA 30-Hour',
  'Crisis Mgmt',
  'First Aid Cert',
  'Cyber Awareness',
  'Working at Heights',
  'Confined Space Entry',
  'Hazardous Materials LVE',
  'Fire Safety Level 1',
  'Emergency Responder Drill',
  'High-Altitude Safety',
]

// Unique certificate ID generator
const getIDNumber = (course, workerId) => {
  const initials = course.split(' ').map((w) => w[0]).join('').toUpperCase()
  const suffix = workerId ? workerId.slice(0, 5).toUpperCase() : Math.floor(10000 + Math.random() * 90000)
  return `CERT-${initials}-${suffix}`
}

export function IssueCertificatePage({ onCancel, employees = [], organizations = [], onIssue }) {
  const toast = useToast()

  // Steps: 'form' | 'success'
  const [step, setStep] = useState('form')

  // Form Field States
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)

  const [certificateType, setCertificateType] = useState('Advanced Fire Safety')
  const [issuingBody, setIssuingBody] = useState('National Fire Inst.')
  const [issueDate, setIssueDate] = useState('')
  const [expiryDate, setExpiryDate] = useState('')

  // Submitting & Errors
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState({})
  const [issuedCertificate, setIssuedCertificate] = useState(null)

  // Discard Confirmation Modal State (for cancel button click)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)

  // Success view states
  const [pdfSearchTerm, setPdfSearchTerm] = useState('')
  const [showSearchInput, setShowSearchInput] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  // Autocomplete search and file refs
  const searchInputRef = useRef(null)
  const dropdownRef = useRef(null)
  const fileInputRef = useRef(null)

  // Compute dirty flag
  const isDirty =
    selectedEmployee !== null ||
    employeeSearch !== '' ||
    issueDate !== '' ||
    expiryDate !== ''

  // Sync dirty status to global window variable for ClientLayout blocker
  useEffect(() => {
    window.isIssueCertificateFormDirty = isDirty
    return () => {
      window.isIssueCertificateFormDirty = false
    }
  }, [isDirty])

  // Browser reload / tab close protection
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

  // Prefill Issuing Body based on selected Certificate Type
  useEffect(() => {
    if (certificateType) {
      const match = ISSUING_BODY_MAP.find((entry) => entry.match.test(certificateType))
      setIssuingBody(match ? match.body : 'SafetyMate Certified')
    }
  }, [certificateType])

  // Autoclose dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target) &&
          searchInputRef.current && !searchInputRef.current.contains(e.target)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  // Keyboard shortcut to focus search input: Cmd+K / Ctrl+K
  useEffect(() => {
    const handleShortcut = (e) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        searchInputRef.current?.focus()
        setIsDropdownOpen(true)
      }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [])

  // Filter employees list for autocomplete
  const filteredEmployees = employees.filter((emp) => {
    const name = emp.fullName || emp.displayName || ''
    const email = emp.email || ''
    const term = employeeSearch.toLowerCase().trim()
    return name.toLowerCase().includes(term) || email.toLowerCase().includes(term)
  })

  // Keyboard handling inside search input
  const handleSearchKeyDown = (e) => {
    if (!isDropdownOpen || filteredEmployees.length === 0) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsDropdownOpen(true)
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex((prev) => (prev + 1) % filteredEmployees.length)
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex((prev) => (prev - 1 + filteredEmployees.length) % filteredEmployees.length)
        break
      case 'Enter':
        e.preventDefault()
        selectEmployee(filteredEmployees[highlightedIndex])
        break
      case 'Escape':
        e.preventDefault()
        setIsDropdownOpen(false)
        break
      default:
        break
    }
  }

  const selectEmployee = (emp) => {
    setSelectedEmployee(emp)
    setEmployeeSearch(emp.fullName || emp.displayName || emp.email || '')
    setIsDropdownOpen(false)
    setErrors((prev) => ({ ...prev, employee: null }))
  }

  // Handle issue date change - sets expiry date to exactly 2 years later by default
  const handleIssueDateChange = (val) => {
    setIssueDate(val)
    setErrors((prev) => ({ ...prev, issueDate: null }))
    if (val) {
      try {
        const d = new Date(val)
        d.setFullYear(d.getFullYear() + 2)
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        setExpiryDate(`${y}-${m}-${day}`)
        setErrors((prev) => ({ ...prev, expiryDate: null }))
      } catch (e) {
        console.error(e)
      }
    }
  }

  // Handle Cancel and Return button
  const handleCancelClick = () => {
    if (isDirty) {
      setShowDiscardConfirm(true)
    } else {
      onCancel()
    }
  }

  // Submit flow
  const handleSubmit = async (e) => {
    if (e) e.preventDefault()

    const newErrors = {}
    if (!selectedEmployee) {
      newErrors.employee = 'Please select a registered employee from the list.'
    }
    if (!issueDate) {
      newErrors.issueDate = 'Please select the certificate issue date.'
    }
    if (!expiryDate) {
      newErrors.expiryDate = 'Please select the certificate expiration date.'
    } else if (issueDate && new Date(expiryDate) <= new Date(issueDate)) {
      newErrors.expiryDate = 'The expiration date must be after the issue date.'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      toast.push({
        type: 'danger',
        title: 'Validation Failed',
        message: 'Please resolve the errors highlighted on the form.',
      })
      return
    }

    setIsSubmitting(true)
    try {
      const selectedOrg = organizations.find((o) => o.id === selectedEmployee.organizationId)
      const orgName = selectedOrg?.name || selectedOrg?.companyName || selectedOrg?.organizationName || 'IronForge Industrial'
      const idNumber = getIDNumber(certificateType, selectedEmployee.uid)

      const certData = {
        orgId: selectedEmployee.organizationId || '',
        workerId: selectedEmployee.uid,
        workerName: selectedEmployee.fullName || selectedEmployee.displayName || '',
        certificateName: certificateType,
        issuingBody: issuingBody,
        issueDate: new Date(issueDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        expiryDate: new Date(expiryDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      }

      await onIssue(certData)

      setIssuedCertificate({
        ...certData,
        orgName,
        idNumber,
        rawIssueDate: issueDate,
        rawExpiryDate: expiryDate,
      })

      // Turn off dirty checking so we can navigate or show success screen without modal popups
      window.isIssueCertificateFormDirty = false
      setStep('success')

      toast.push({
        type: 'success',
        title: 'Certificate Issued',
        message: `${certData.workerName} has been certified in ${certData.certificateName}.`,
      })
    } catch (err) {
      toast.push({
        type: 'danger',
        title: 'Database Error',
        message: 'Could not register the certificate in Firestore. Please try again.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResetForm = () => {
    setSelectedEmployee(null)
    setEmployeeSearch('')
    setCertificateType('Advanced Fire Safety')
    setIssueDate('')
    setExpiryDate('')
    setErrors({})
    setPdfSearchTerm('')
    setShowSearchInput(false)
    setStep('form')
  }

  // Load html2pdf bundle dynamically
  const loadHtml2Pdf = () => {
    return new Promise((resolve) => {
      if (window.html2pdf) {
        resolve(window.html2pdf)
        return
      }
      const script = document.createElement('script')
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'
      script.onload = () => resolve(window.html2pdf)
      document.body.appendChild(script)
    })
  }

  // Generate and download PDF
  const handleDownloadPDF = async () => {
    if (!issuedCertificate) return
    try {
      const element = document.getElementById('cert-pdf-document')
      const html2pdf = await loadHtml2Pdf()
      const opt = {
        margin: 0.2,
        filename: `${issuedCertificate.workerName.replace(/\s+/g, '_')}_Certificate.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
      }
      html2pdf().from(element).set(opt).save()
      toast.push({
        type: 'success',
        title: 'Download Started',
        message: 'Your custom certificate PDF is downloading.',
      })
    } catch (err) {
      console.error(err)
      toast.push({
        type: 'danger',
        title: 'Download Failed',
        message: 'Failed to generate PDF document.',
      })
    }
  }

  // Print PDF
  const handlePrintPDF = async () => {
    if (!issuedCertificate) return
    try {
      const element = document.getElementById('cert-pdf-document')
      const html2pdf = await loadHtml2Pdf()
      const opt = {
        margin: 0.2,
        filename: `${issuedCertificate.workerName.replace(/\s+/g, '_')}_Certificate.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
      }
      toast.push({
        type: 'info',
        title: 'Preparing Print',
        message: 'Opening print dialog...',
      })
      html2pdf().from(element).set(opt).toPdf().get('pdf').then((pdf) => {
        const blobUrl = pdf.output('bloburl')
        const printWindow = window.open(blobUrl, '_blank')
        if (printWindow) {
          printWindow.addEventListener('load', () => {
            printWindow.print()
          })
        }
      })
    } catch (err) {
      console.error(err)
      toast.push({
        type: 'danger',
        title: 'Print Failed',
        message: 'Could not trigger print options.',
      })
    }
  }

  // Mock Upload new scanned version
  const handleNewUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setIsUploading(true)
      setTimeout(() => {
        setIsUploading(false)
        toast.push({
          type: 'success',
          title: 'Version Updated',
          message: 'High-quality scanned certificate has been successfully uploaded and synced.',
        })
      }, 1500)
    }
  }

  // Dynamic values helper for validity status
  const getValidityStats = () => {
    if (!issuedCertificate) return { status: 'UNKNOWN', days: 0, pillClass: '', progressClass: '', textClass: '', percent: 0 }
    
    const exp = new Date(issuedCertificate.rawExpiryDate)
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    
    const diffTime = exp.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    let statusText = 'Compliant'
    let pillCls = 'prov-detail-status-pill'
    let progressCls = 'prov-validity-progress-bar--green'
    let textCls = 'prov-validity-icon'
    
    if (diffDays <= 0) {
      statusText = 'Expired'
      pillCls = 'prov-detail-status-pill prov-detail-status-pill--danger'
      progressCls = 'prov-validity-progress-bar--danger'
      textCls = 'prov-validity-icon--danger'
    } else if (diffDays <= 90) {
      statusText = 'Expires Soon'
      pillCls = 'prov-detail-status-pill prov-detail-status-pill--warn'
      progressCls = 'prov-validity-progress-bar--warn'
      textCls = 'prov-validity-icon--warn'
    }
    
    const percent = Math.max(0, Math.min(100, (diffDays / 730) * 100))
    
    // Recommended renewal is 30 days before expiry
    const recRenewal = new Date(issuedCertificate.rawExpiryDate)
    recRenewal.setDate(recRenewal.getDate() - 30)
    const renewalStr = recRenewal.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

    return {
      status: statusText,
      days: diffDays < 0 ? 0 : diffDays,
      pillClass: pillCls,
      progressClass: progressCls,
      textClass: textCls,
      percent,
      renewalStr
    }
  }

  // Highlight search matching text in PDF Mockup
  const highlightPDFText = (text) => {
    if (!pdfSearchTerm.trim()) return text
    const regex = new RegExp(`(${pdfSearchTerm})`, 'gi')
    const parts = String(text).split(regex)
    return (
      <span>
        {parts.map((part, i) =>
          part.toLowerCase() === pdfSearchTerm.toLowerCase() ? (
            <mark key={i} className="prov-pdf-search-highlight">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </span>
    )
  }

  // RENDER: Success / Detail View Subpage
  if (step === 'success' && issuedCertificate) {
    const valStats = getValidityStats()
    const lastName = issuedCertificate.workerName.split(' ').pop()
    const pdfFilename = `${issuedCertificate.certificateName.replace(/\s+/g, '_')}_${lastName}.pdf`

    return (
      <div className="prov-cert-issue-page" style={{ padding: '28px', color: '#fff', maxWidth: '1280px', margin: '0 auto' }}>
        {/* Navigation Breadcrumbs & Back Button */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <div className="prov-detail-breadcrumbs">
              <a onClick={onCancel}>Compliance</a> &rsaquo; <a onClick={onCancel}>Certificates</a> &rsaquo; <span>Detail View</span>
            </div>
            <div className="prov-detail-header">
              <h1 className="prov-detail-title">{issuedCertificate.certificateName}</h1>
              <span className={valStats.pillClass}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor', marginRight: '4px' }} />
                {valStats.status.toUpperCase()}
              </span>
            </div>
            <p className="prov-detail-desc">
              Global safety competency registration and audit record.
            </p>
          </div>

          <button
            type="button"
            className="prov-success-btn-secondary"
            onClick={onCancel}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <ArrowLeft size={16} />
            Back to Portal
          </button>
        </div>

        {/* Detailed Two-Column Grid */}
        <div className="prov-detail-grid">
          {/* Left Column: Validity and Metadata */}
          <div className="prov-detail-left-col">
            {/* Validity status card */}
            <div className="prov-detail-card">
              <div className="prov-detail-card-title">Validity Status</div>
              <div className="prov-validity-main">
                <span className="prov-validity-status">{valStats.status}</span>
                <Clock size={20} className={valStats.textClass} />
              </div>
              <div className="prov-validity-days-row">
                <span className="prov-validity-days-label">Days Remaining</span>
                <span className="prov-validity-days-val">{valStats.days}</span>
              </div>
              <div className="prov-validity-progress">
                <div
                  className={`prov-validity-progress-bar ${valStats.progressClass}`}
                  style={{ width: `${valStats.percent}%` }}
                />
              </div>
              <p className="prov-validity-renewal">
                Recommended renewal date: <strong>{valStats.renewalStr}</strong>
              </p>
            </div>

            {/* Certificate Metadata Card */}
            <div className="prov-detail-card">
              <div className="prov-detail-card-title">Certificate Metadata</div>
              <div className="prov-metadata-table">
                <div className="prov-metadata-row">
                  <span className="prov-metadata-label">Issue Date</span>
                  <span className="prov-metadata-value">{issuedCertificate.issueDate}</span>
                </div>
                <div className="prov-metadata-row">
                  <span className="prov-metadata-label">Expiry Date</span>
                  <span className="prov-metadata-value">{issuedCertificate.expiryDate}</span>
                </div>
                <div className="prov-metadata-row">
                  <span className="prov-metadata-label">ID Number</span>
                  <span className="prov-metadata-value">{issuedCertificate.idNumber}</span>
                </div>
                <div className="prov-metadata-row">
                  <span className="prov-metadata-label">Issuing Body</span>
                  <span className="prov-metadata-value">{issuedCertificate.issuingBody}</span>
                </div>
              </div>
            </div>

            {/* Clean bottom navigation link */}
            <div style={{ marginTop: '10px' }}>
              <button
                type="button"
                className="prov-btn-cancel-return"
                onClick={handleResetForm}
                style={{ padding: '12px 16px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', width: '100%', justifyContent: 'center' }}
              >
                Issue Another Certificate
              </button>
            </div>
          </div>

          {/* Right Column: PDF Viewer */}
          <div className="prov-pdf-viewer">
            {/* Toolbar Header */}
            <div className="prov-pdf-header">
              <div className="prov-pdf-filename-box">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#ef4444' }}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
                <span>{pdfFilename}</span>
              </div>
              <div className="prov-pdf-actions">
                <button
                  type="button"
                  className="prov-pdf-action-btn"
                  title="Search in PDF"
                  onClick={() => setShowSearchInput(!showSearchInput)}
                >
                  <Search size={16} />
                </button>
                <button
                  type="button"
                  className="prov-pdf-action-btn"
                  title="Download PDF"
                  onClick={handleDownloadPDF}
                >
                  <Download size={16} />
                </button>
                <button
                  type="button"
                  className="prov-pdf-action-btn"
                  title="Print Certificate"
                  onClick={handlePrintPDF}
                >
                  <Printer size={16} />
                </button>
              </div>
            </div>

            {/* Search Input Bar (Toggled) */}
            {showSearchInput && (
              <div className="prov-pdf-search-bar">
                <Search size={14} style={{ color: 'rgba(148, 163, 184, 0.5)' }} />
                <input
                  type="text"
                  className="prov-pdf-search-input"
                  placeholder="Search certificate text..."
                  value={pdfSearchTerm}
                  onChange={(e) => setPdfSearchTerm(e.target.value)}
                  autoFocus
                />
                {pdfSearchTerm && (
                  <button
                    type="button"
                    className="prov-pdf-search-close"
                    onClick={() => setPdfSearchTerm('')}
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  className="prov-pdf-search-close"
                  onClick={() => {
                    setShowSearchInput(false)
                    setPdfSearchTerm('')
                  }}
                >
                  Close
                </button>
              </div>
            )}

            {/* PDF Sheet Canvas */}
            <div className="prov-pdf-sheet-container">
              <div className="prov-pdf-sheet" id="cert-pdf-document">
                {/* Header Row */}
                <div className="prov-pdf-top-row">
                  <div className="prov-pdf-logo-box">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  </div>
                  <div className="prov-pdf-cert-no">
                    <div className="prov-pdf-cert-no-label">Certificate No.</div>
                    <div className="prov-pdf-cert-no-val">{highlightPDFText(issuedCertificate.idNumber)}</div>
                  </div>
                </div>

                {/* Central Body Content */}
                <div className="prov-pdf-center-content">
                  <h3 className="prov-pdf-title">Certificate of Competence</h3>
                  <p className="prov-pdf-certify-text">This is to certify that</p>
                  <h2 className="prov-pdf-name">{highlightPDFText(issuedCertificate.workerName)}</h2>
                  <p className="prov-pdf-completed-text">has successfully completed the training for</p>
                  <h4 className="prov-pdf-course">{highlightPDFText(issuedCertificate.certificateName.toUpperCase())}</h4>
                  <div className="prov-pdf-divider-line" />
                </div>

                {/* Footer Section */}
                <div className="prov-pdf-footer">
                  <div className="prov-pdf-signature">
                    <div className="prov-pdf-sig-image">J. Henderson</div>
                    <div className="prov-pdf-sig-label">Programme Director</div>
                  </div>
                  <div className="prov-pdf-seal">
                    <svg width="68" height="68" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(17, 24, 39, 0.15)" strokeWidth="1.5" />
                      <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(17, 24, 39, 0.2)" strokeWidth="1" strokeDasharray="3 2" />
                      <circle cx="50" cy="50" r="30" fill="none" stroke="rgba(17, 24, 39, 0.15)" strokeWidth="1.5" />
                      <path id="seal-text-path" d="M 24 50 A 26 26 0 1 1 76 50" fill="none" stroke="none" />
                      <text fontFamily="Inter, sans-serif" fontSize="6.5" fontWeight="900" fill="rgba(17, 24, 39, 0.45)" letterSpacing="1.2">
                        <textPath href="#seal-text-path" startOffset="50%" textAnchor="middle">
                          VERIFIED COMPLIANCE
                        </textPath>
                      </text>
                      <path d="M42 50 L48 56 L58 44" fill="none" stroke="rgba(17, 24, 39, 0.5)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom upload card block */}
            <div className="prov-pdf-upload-box">
              <div className="prov-pdf-upload-text">
                <h4 className="prov-pdf-upload-title">New version available?</h4>
                <p className="prov-pdf-upload-desc">Upload a scanned PDF or high-quality image of the new certificate.</p>
                <CertificateTemplateDownloads compact />
              </div>
              <button
                type="button"
                className="prov-pdf-upload-btn"
                onClick={handleNewUploadClick}
                disabled={isUploading}
              >
                <Upload size={14} />
                {isUploading ? 'Uploading...' : 'Upload New Certificate'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // RENDER: Main Form View
  return (
    <div className="prov-cert-issue-page" style={{ padding: '28px', color: '#fff', maxWidth: '1280px', margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(148, 163, 184, 0.5)', fontWeight: 800, marginBottom: '4px' }}>
          Certificates &rsaquo; <span style={{ color: '#fff' }}>Issue New</span>
        </div>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: '#fff', margin: '0 0 6px 0' }}>Issue New Certificate</h1>
        <p style={{ margin: 0, fontSize: '13px', color: 'rgba(148, 163, 184, 0.7)' }}>
          Register a new workforce credential for compliance tracking.
        </p>
      </div>

      <div className="prov-cert-grid">
        {/* Left Column: Form Card */}
        <div className="prov-section-card" style={{ padding: '32px' }}>
          {/* Card Header details */}
          <div className="prov-card-header-with-icon">
            <div className="prov-card-header-icon-wrapper">
              <Award size={20} />
            </div>
            <div className="prov-card-header-info">
              <h2 className="prov-card-header-title">Credential Details</h2>
              <p className="prov-card-header-desc">
                Provide the core information for the new workforce certificate.
              </p>
            </div>
          </div>

          <CertificateTemplateDownloads />

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Employee Name Autocomplete Search */}
            <div className="prov-form-group prov-form-group--full" style={{ position: 'relative' }}>
              <label className="prov-field-label">Employee Name</label>
              <div className="prov-input-wrapper">
                <span className="prov-input-icon">
                  <Search size={16} />
                </span>
                <input
                  ref={searchInputRef}
                  type="text"
                  className={`prov-input-field prov-input-field--with-icon ${errors.employee ? 'prov-input-field--error' : ''}`}
                  placeholder="Start typing employee name..."
                  value={employeeSearch}
                  onChange={(e) => {
                    setEmployeeSearch(e.target.value)
                    setIsDropdownOpen(true)
                    setHighlightedIndex(0)
                    if (selectedEmployee) {
                      setSelectedEmployee(null) // Reset selection if edited
                    }
                  }}
                  onFocus={() => {
                    setIsDropdownOpen(true)
                    setHighlightedIndex(0)
                  }}
                  onKeyDown={handleSearchKeyDown}
                />
                {!selectedEmployee && (
                  <div className="prov-shortcut-badge">
                    <span className="prov-key-cap">Cmd</span>
                    <span className="prov-key-cap">K</span>
                  </div>
                )}
              </div>

              {/* Suggestions Dropdown */}
              {isDropdownOpen && employeeSearch.trim() !== '' && (
                <div className="prov-autocomplete-dropdown" ref={dropdownRef}>
                  {filteredEmployees.length === 0 ? (
                    <div className="prov-autocomplete-empty">No matching employees found</div>
                  ) : (
                    filteredEmployees.map((emp, idx) => (
                      <div
                        key={emp.uid}
                        className={`prov-autocomplete-item ${idx === highlightedIndex ? 'prov-autocomplete-item--highlighted' : ''}`}
                        onClick={() => selectEmployee(emp)}
                      >
                        <span className="prov-autocomplete-name">{emp.fullName || emp.displayName}</span>
                        <span className="prov-autocomplete-email">{emp.email || 'No email registered'}</span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {errors.employee && (
                <span className="prov-input-error-msg">{errors.employee}</span>
              )}
            </div>

            {/* Certificate Type and Issuing Body Row */}
            <div className="prov-form-row">
              {/* Certificate Type Dropdown */}
              <div className="prov-form-group">
                <label className="prov-field-label">Certificate Type</label>
                <div className="prov-input-wrapper">
                  <select
                    className="prov-input-field"
                    style={{ appearance: 'none', paddingRight: '38px' }}
                    value={certificateType}
                    onChange={(e) => setCertificateType(e.target.value)}
                  >
                    {COURSES_LIST.map((course) => (
                      <option key={course} value={course} style={{ background: '#0b0f19' }}>
                        {course}
                      </option>
                    ))}
                  </select>
                  <span className="prov-input-icon" style={{ left: 'auto', right: '12px' }}>
                    <ChevronDown size={16} />
                  </span>
                </div>
              </div>

              {/* Issuing Body Text Field */}
              <div className="prov-form-group">
                <label className="prov-field-label">Issuing Body</label>
                <input
                  type="text"
                  className="prov-input-field"
                  placeholder="e.g., Red Cross, OSHA"
                  value={issuingBody}
                  onChange={(e) => setIssuingBody(e.target.value)}
                />
              </div>
            </div>

            {/* Dates Row */}
            <div className="prov-form-row">
              {/* Issue Date */}
              <div className="prov-form-group">
                <label className="prov-field-label">Issue Date</label>
                <div className="prov-input-wrapper">
                  <span className="prov-input-icon">
                    <Calendar size={16} />
                  </span>
                  <input
                    type="date"
                    className={`prov-input-field prov-input-field--with-icon ${errors.issueDate ? 'prov-input-field--error' : ''}`}
                    value={issueDate}
                    onChange={(e) => handleIssueDateChange(e.target.value)}
                  />
                </div>
                {errors.issueDate && (
                  <span className="prov-input-error-msg">{errors.issueDate}</span>
                )}
              </div>

              {/* Expiry Date */}
              <div className="prov-form-group">
                <label className="prov-field-label">Expiry Date</label>
                <div className="prov-input-wrapper">
                  <span className="prov-input-icon">
                    <Calendar size={16} />
                  </span>
                  <input
                    type="date"
                    className={`prov-input-field prov-input-field--with-icon ${errors.expiryDate ? 'prov-input-field--error' : ''}`}
                    value={expiryDate}
                    onChange={(e) => {
                      setExpiryDate(e.target.value)
                      setErrors((prev) => ({ ...prev, expiryDate: null }))
                    }}
                  />
                </div>
                {errors.expiryDate && (
                  <span className="prov-input-error-msg">{errors.expiryDate}</span>
                )}
              </div>
            </div>
          </form>
        </div>

        {/* Right Column: Info Card */}
        <div className="prov-sync-card">
          <div className="prov-sync-icon-wrapper">
            <Info size={18} />
          </div>
          <div className="prov-sync-info">
            <h3 className="prov-sync-title">Compliance Sync</h3>
            <p className="prov-sync-desc">
              Once issued, this certificate will be automatically synced with the global safety dashboard and relevant audit logs.
            </p>
          </div>
        </div>
      </div>

      {/* Action Bar Footer */}
      <div className="prov-action-bar">
        <button
          type="button"
          className="prov-btn-cancel-return"
          onClick={handleCancelClick}
        >
          <ArrowLeft size={16} />
          Cancel and Return
        </button>

        <button
          type="button"
          className="prov-btn-issue-glowing"
          onClick={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Issuing...' : 'Issue Certificate'}
        </button>
      </div>

      {/* Discard Confirmation Modal (when clicking cancel button) */}
      {showDiscardConfirm && (
        <div className="prov-blocker-overlay" role="dialog" aria-modal="true">
          <div className="prov-blocker-modal">
            <div className="prov-blocker-icon-wrap">
              <AlertTriangle size={28} />
            </div>
            <h3 className="prov-blocker-title">Discard Unsaved Changes?</h3>
            <p className="prov-blocker-message">
              You have unsaved changes in the certificate form. If you go back, these changes will be lost permanently.
            </p>
            <div className="prov-blocker-actions">
              <button
                type="button"
                className="prov-blocker-btn-secondary"
                onClick={() => setShowDiscardConfirm(false)}
              >
                Keep Editing
              </button>
              <button
                type="button"
                className="prov-blocker-btn-danger"
                onClick={() => {
                  window.isIssueCertificateFormDirty = false
                  setShowDiscardConfirm(false)
                  onCancel()
                }}
              >
                Discard Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
