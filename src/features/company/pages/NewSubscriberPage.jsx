import { addDoc, collection, doc, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { app, db, storage } from '../../../config/firebase.js'
import { useToast } from '../../../shared/toast/toastContext.js'
import { Building2, CreditCard, Eye, EyeOff, ImageIcon, MapPin, UploadCloud, User2, X } from 'lucide-react'

const PLANS = [
  {
    key: 'Starter',
    label: 'Starter Plan',
    plan: 'Starter',
    monthlyPrice: 199,
    subtitle: 'Up to 50 active users',
    perks: ['Basic Analytics', 'Email Support'],
  },
  {
    key: 'Professional',
    label: 'Professional',
    plan: 'Professional',
    monthlyPrice: 499,
    subtitle: 'Up to 500 active users',
    perks: ['Advanced Analytics', 'Priority 24/7 Support'],
  },
  {
    key: 'Enterprise',
    label: 'Enterprise',
    plan: 'Enterprise',
    monthlyPrice: 1500,
    subtitle: 'Unlimited users',
    perks: ['API Access + SSO', 'Dedicated Manager'],
  },
]

const MAX_LOGO_BYTES = 2 * 1024 * 1024
const MAX_LOGO_DIMENSION = 500

async function compressImage(file, { maxDimension = MAX_LOGO_DIMENSION, quality = 0.82 } = {}) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Failed to read image file.'))
    reader.onload = () => resolve(String(reader.result || ''))
    reader.readAsDataURL(file)
  })

  const img = await new Promise((resolve, reject) => {
    const image = new window.Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Invalid image file.'))
    image.src = dataUrl
  })

  const w = img.width || 0
  const h = img.height || 0
  if (!w || !h) throw new Error('Invalid image dimensions.')

  const scale = Math.min(1, maxDimension / Math.max(w, h))
  const outW = Math.max(1, Math.round(w * scale))
  const outH = Math.max(1, Math.round(h * scale))

  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH

  const ctx = canvas.getContext('2d', { alpha: true })
  if (!ctx) throw new Error('Canvas is not supported in this browser.')

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, outW, outH)

  const originalIsPng = file.type === 'image/png'
  const mime = originalIsPng ? 'image/png' : 'image/jpeg'
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, mime, originalIsPng ? undefined : quality))
  if (!blob) throw new Error('Failed to compress image.')

  const ext = originalIsPng ? 'png' : 'jpg'
  const filenameBase = String(file.name || 'logo').replace(/\.[^/.]+$/, '')
  const safeBase = filenameBase.replaceAll(/[^a-zA-Z0-9._-]/g, '_').slice(0, 64) || 'logo'
  const outFile = new File([blob], `${safeBase}.${ext}`, { type: blob.type || mime })

  return { file: outFile, width: outW, height: outH, bytes: outFile.size }
}

function PlanCard({ plan, selected, onSelect }) {
  return (
    <button
      type="button"
      className={`plan-card ${selected ? 'plan-card-selected' : ''}`}
      onClick={onSelect}
    >
      <div className="plan-card-top">
        <p className="plan-title">{plan.label}</p>
        <p className="plan-subtitle">{plan.subtitle}</p>
      </div>
      <div className="plan-price">
        <b>${plan.monthlyPrice}</b>
        <span>/mo</span>
      </div>
      <ul className="plan-perks">
        {plan.perks.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
    </button>
  )
}

function SectionHeader({ icon, title }) {
  return (
    <div className="section-header">
      <span className="section-icon" aria-hidden="true">
        {icon}
      </span>
      <div className="section-title">{title}</div>
    </div>
  )
}

export function NewSubscriberPage() {
  const navigate = useNavigate()
  const toast = useToast()

  const [submitting, setSubmitting] = useState(false)

  const [legal, setLegal] = useState({ name: '', regNumber: '', vatId: '' })
  const [logoFile, setLogoFile] = useState(null)
  const [logoPreviewUrl, setLogoPreviewUrl] = useState('')
  const logoInputRef = useRef(null)
  const [logoDragActive, setLogoDragActive] = useState(false)
  const [contact, setContact] = useState({ fullName: '', email: '', phone: '' })
  const [address, setAddress] = useState({
    street: '',
    city: '',
    postalCode: '',
    country: '',
  })
  const [billingCycle, setBillingCycle] = useState('Monthly')
  const [selectedPlanKey, setSelectedPlanKey] = useState('Starter')
  const [allocatedUsers, setAllocatedUsers] = useState(10)

  const selectedPlan = useMemo(
    () => PLANS.find((p) => p.key === selectedPlanKey) || PLANS[0],
    [selectedPlanKey],
  )

  useEffect(() => {
    if (!logoFile) {
      setLogoPreviewUrl('')
      return
    }
    const url = URL.createObjectURL(logoFile)
    setLogoPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [logoFile])

  function setLogoFromFile(file) {
    if (!file) {
      setLogoFile(null)
      return
    }
    const okType = file.type === 'image/png' || file.type === 'image/jpeg'
    if (!okType) {
      toast.push({
        type: 'error',
        title: 'Invalid file',
        message: 'Please upload a PNG or JPG image.',
      })
      if (logoInputRef.current) logoInputRef.current.value = ''
      setLogoFile(null)
      return
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.push({
        type: 'error',
        title: 'File too large',
        message: 'Logo must be 2MB or less.',
      })
      if (logoInputRef.current) logoInputRef.current.value = ''
      setLogoFile(null)
      return
    }
    setLogoFile(file)
  }

  async function onCreate() {
    setSubmitting(true)
    try {
      const now = new Date()
      const expiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

      let logoUrl = null
      if (logoFile) {
        const compressed = await compressImage(logoFile, { maxDimension: MAX_LOGO_DIMENSION, quality: 0.82 })
        const safeName = String(compressed.file.name || 'logo').replaceAll(/[^a-zA-Z0-9._-]/g, '_')
        const objectPath = `organizations/logos/${Date.now()}_${safeName}`
        const objectRef = ref(storage, objectPath)
        await uploadBytes(objectRef, compressed.file, { contentType: compressed.file.type || undefined })
        logoUrl = await getDownloadURL(objectRef)
      }

      const payload = {
        name: legal.name.trim(),
        regNumber: legal.regNumber.trim(),
        vatId: legal.vatId.trim(),
        logoUrl,
        primaryContact: {
          fullName: contact.fullName.trim(),
          email: contact.email.trim(),
          phone: contact.phone.trim(),
        },
        address: {
          street: address.street.trim(),
          city: address.city.trim(),
          postalCode: address.postalCode.trim(),
          country: address.country.trim(),
        },
        plan: selectedPlan.plan,
        monthlyPrice: Number(selectedPlan.monthlyPrice),
        allocatedUsers: Number(allocatedUsers),
        billingMode: 'manual',
        status: 'pending_payment',
        createdAt: serverTimestamp(),
        subscriptionExpiry: Timestamp.fromDate(expiry),
        billingCycle,
      }
      const allocatedUsersValue = Number(payload.allocatedUsers)

      if (!payload.name) {
        toast.push({ type: 'error', title: 'Missing fields', message: 'Company Name is required.' })
        return
      }
      if (!payload.regNumber) {
        toast.push({
          type: 'error',
          title: 'Missing fields',
          message: 'Registration Number is required.',
        })
        return
      }
      if (!payload.primaryContact.fullName || !payload.primaryContact.email) {
        toast.push({
          type: 'error',
          title: 'Missing fields',
          message: 'Primary Contact name and email are required.',
        })
        return
      }
      if (!Number.isFinite(allocatedUsersValue) || allocatedUsersValue < 1) {
        toast.push({
          type: 'error',
          title: 'Invalid seats',
          message: 'Allocated Users must be at least 1.',
        })
        return
      }
      const adminEmail = contact.email.trim()
      if (!adminEmail) {
        toast.push({
          type: 'error',
          title: 'Missing fields',
          message: 'Email Address in Primary Contact is required to create the Primary Admin account.',
        })
        return
      }
      payload.allocatedUsers = allocatedUsersValue

      const orgDocRef = await addDoc(collection(db, 'organizations'), payload)

      // IMPORTANT:
      // Creating a Firebase Auth user from the client SDK would switch the current session
      // (logging the Super Admin out). To avoid that, this must be done server-side using
      // the Firebase Admin SDK (e.g. a Callable Cloud Function).
      //
      // The createClientAdmin function now creates the user WITHOUT a password
      // and generates a setup token. The user will set their password via email link.
      let newAdminUid = null
      let setupToken = null
      try {
        const functions = getFunctions(app)
        const createClientAdmin = httpsCallable(functions, 'createClientAdmin')
        const res = await createClientAdmin({
          email: adminEmail,
          organizationId: orgDocRef.id,
          fullName: payload.primaryContact.fullName,
        })
        newAdminUid = res?.data?.uid || null
        setupToken = res?.data?.setupToken || null
      } catch (err) {
        // If you haven't deployed the cloud function yet, you'll land here.
        // Deploying it is required to create client admin accounts without session switching.
        throw new Error(
          err?.message ||
            'Cloud Function createClientAdmin is not available. Deploy a callable function using Firebase Admin SDK to create the Primary Admin Auth user.',
        )
      }

      if (!newAdminUid) {
        throw new Error('Primary Admin user was created but no uid was returned.')
      }

      // Send password setup email
      try {
        const functions = getFunctions(app)
        const sendPasswordSetupEmail = httpsCallable(functions, 'sendPasswordSetupEmail')
        await sendPasswordSetupEmail({
          setupToken,
          email: adminEmail,
          fullName: payload.primaryContact.fullName,
          organizationName: payload.name,
        })
      } catch (err) {
        // Call backend cleanup function to rollback user creation
        console.error('Failed to send password setup email, calling cleanup:', err)
        try {
          const cleanupUserCreation = httpsCallable(functions, 'cleanupUserCreation')
          await cleanupUserCreation({ uid: newAdminUid, organizationId: orgDocRef.id, setupToken })
        } catch (cleanupErr) {
          console.error('Failed to cleanup user creation:', cleanupErr)
        }

        toast.push({
          type: 'error',
          title: 'Subscriber creation failed',
          message: 'Failed to send password setup email. Subscriber creation has been rolled back. Please check your Brevo SMTP configuration and try again.',
        })
        return
      }

      // Create Firestore user profile for the new Primary Admin.
      await setDoc(doc(db, 'user_profiles', newAdminUid), {
        role: 'client_admin',
        organizationId: orgDocRef.id,
        fullName: payload.primaryContact.fullName,
        email: adminEmail,
        createdAt: serverTimestamp(),
      })

      // MVP manual-invoicing flow:
      // create first unpaid invoice immediately after subscriber creation.
      const dueDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
      const planAmount = Number(selectedPlan.monthlyPrice || 0)
      await addDoc(collection(db, 'invoices'), {
        organizationId: orgDocRef.id,
        organizationName: payload.name,
        items: [
          {
            description: `SafetyMate ${selectedPlan.plan} - ${allocatedUsersValue} Allocated Users`,
            qty: 1,
            rate: planAmount,
            amount: planAmount,
          },
        ],
        amount: planAmount,
        totalDue: planAmount,
        subtotal: planAmount,
        taxAmount: 0,
        status: 'unpaid',
        issueDate: serverTimestamp(),
        invoiceDate: Timestamp.fromDate(now),
        dueDate: Timestamp.fromDate(dueDate),
        billingCycle: 'monthly',
        createdAt: serverTimestamp(),
      })

      toast.push({
        type: 'success',
        title: 'Created',
        message: 'Company and Admin Account created successfully!',
      })
      navigate('/company/created', {
        state: {
          id: orgDocRef.id,
          name: payload.name,
          plan: payload.plan,
          monthlyPrice: payload.monthlyPrice,
          primaryContact: payload.primaryContact,
          primaryAdmin: { uid: newAdminUid, email: adminEmail },
          createdAt: new Date(),
        },
        replace: true,
      })
    } catch (e) {
      toast.push({
        type: 'error',
        title: 'Failed',
        message: e?.message || 'Could not create subscriber.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="new-subscriber-page">
      <div className="dash-title-wrap">
        <p className="subtle">SUPER ADMIN / SUBSCRIBERS</p>
        <h1>New Subscriber</h1>
      </div>

      <div className="new-subscriber-shell">
        <div className="new-subscriber-content">
          <article id="ns-legal" className="dashboard-card form-section">
            <SectionHeader
              icon={<Building2 size={14} />}
              title="1. Legal & Registration Info"
            />
            <div className="form-grid-2">
              <label>
                Company Name *
                <input
                  value={legal.name}
                  onChange={(e) => setLegal((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Acme Corporation Ltd."
                />
              </label>
              <label>
                Registration Number *
                <input
                  value={legal.regNumber}
                  onChange={(e) => setLegal((p) => ({ ...p, regNumber: e.target.value }))}
                  placeholder="CRN-2023-XXXX"
                />
              </label>
              <label className="span-2">
                VAT ID / Tax Identification
                <input
                  value={legal.vatId}
                  onChange={(e) => setLegal((p) => ({ ...p, vatId: e.target.value }))}
                  placeholder="EU123456789"
                />
              </label>
              <label className="span-2">
                Company Logo
                <div className="logo-upload-row">
                  <label
                    className={`logo-dropzone ${logoDragActive ? 'is-dragging' : ''}`}
                    onDragEnter={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setLogoDragActive(true)
                    }}
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setLogoDragActive(true)
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setLogoDragActive(false)
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setLogoDragActive(false)
                      const file = e.dataTransfer?.files?.[0] || null
                      setLogoFromFile(file)
                    }}
                  >
                    <input
                      ref={logoInputRef}
                      className="logo-input-hidden"
                      type="file"
                      accept="image/png,image/jpeg"
                      onChange={(e) => setLogoFromFile(e.target.files?.[0] || null)}
                    />

                    {!logoPreviewUrl ? (
                      <div className="logo-dropzone-empty">
                        <span className="logo-dropzone-ic" aria-hidden="true">
                          <UploadCloud size={18} />
                        </span>
                        <div>
                          <b>Click to upload logo</b>
                          <span>PNG or JPG (max. 2MB)</span>
                        </div>
                      </div>
                    ) : (
                      <div className="logo-dropzone-preview">
                        <img className="logo-preview-lg" src={logoPreviewUrl} alt="Selected company logo preview" />
                        <button
                          type="button"
                          className="logo-remove-btn"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            if (logoInputRef.current) logoInputRef.current.value = ''
                            setLogoFile(null)
                          }}
                          aria-label="Remove logo"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )}
                  </label>

                  <div className="logo-hint-row">
                    <span className="logo-hint-ic" aria-hidden="true">
                      <ImageIcon size={14} />
                    </span>
                    <span className="logo-hint-text">Drag &amp; drop supported • Recommended: square logo</span>
                  </div>
                </div>
              </label>
            </div>
          </article>

          <article id="ns-contact" className="dashboard-card form-section">
            <SectionHeader icon={<User2 size={14} />} title="2. Primary Contact" />
            <div className="form-grid-3">
              <label>
                Full Name *
                <input
                  value={contact.fullName}
                  onChange={(e) => setContact((p) => ({ ...p, fullName: e.target.value }))}
                  placeholder="John Doe"
                />
              </label>
              <label>
                Email Address *
                <input
                  value={contact.email}
                  onChange={(e) => setContact((p) => ({ ...p, email: e.target.value }))}
                  placeholder="john@company.com"
                  type="email"
                />
              </label>
              <label>
                Phone Number
                <input
                  value={contact.phone}
                  onChange={(e) => setContact((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="+1 (555) 000-0000"
                />
              </label>
            </div>
          </article>

          <article id="ns-address" className="dashboard-card form-section">
            <SectionHeader icon={<MapPin size={14} />} title="3. Headquarters Address" />
            <div className="form-grid-3">
              <label className="span-3">
                Street Address *
                <input
                  value={address.street}
                  onChange={(e) => setAddress((p) => ({ ...p, street: e.target.value }))}
                  placeholder="123 Industrial Way, Suite 400"
                />
              </label>
              <label>
                City *
                <input
                  value={address.city}
                  onChange={(e) => setAddress((p) => ({ ...p, city: e.target.value }))}
                  placeholder="San Francisco"
                />
              </label>
              <label>
                Postal Code *
                <input
                  value={address.postalCode}
                  onChange={(e) => setAddress((p) => ({ ...p, postalCode: e.target.value }))}
                  placeholder="94103"
                />
              </label>
              <label>
                Country *
                <input
                  value={address.country}
                  onChange={(e) => setAddress((p) => ({ ...p, country: e.target.value }))}
                  placeholder="United States"
                />
              </label>
            </div>
          </article>

          <article id="ns-subscription" className="dashboard-card form-section">
            <div className="subscription-head">
              <SectionHeader icon={<CreditCard size={14} />} title="4. Subscription Setup" />
              <div className={`segmented ${billingCycle === 'Annual' ? 'seg-right' : 'seg-left'}`}>
                <span className="seg-slider" aria-hidden="true" />
                <button
                  type="button"
                  className={billingCycle === 'Monthly' ? 'seg-active' : ''}
                  onClick={() => setBillingCycle('Monthly')}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  className={billingCycle === 'Annual' ? 'seg-active' : ''}
                  onClick={() => setBillingCycle('Annual')}
                >
                  Annual (Save 20%)
                </button>
              </div>
            </div>

            <label className="allocated-users-field">
              Allocated Users *
              <input
                type="number"
                min={1}
                step={1}
                value={allocatedUsers}
                onChange={(e) => setAllocatedUsers(Number(e.target.value))}
                placeholder="Seats on invoice"
              />
              <span className="allocated-users-hint">Number of user seats this organization is paying for (manual billing).</span>
            </label>

            <div className="plan-grid">
              {PLANS.map((p) => (
                <PlanCard
                  key={p.key}
                  plan={p}
                  selected={p.key === selectedPlanKey}
                  onSelect={() => setSelectedPlanKey(p.key)}
                />
              ))}
            </div>
          </article>

          <footer className="dashboard-card new-subscriber-footer">
            <div className="summary">
              <p className="summary-title">SUMMARY</p>
              <p className="summary-text">
                Selected: <b>{selectedPlan.plan}</b> (${selectedPlan.monthlyPrice}/mo)
              </p>
            </div>
            <div className="footer-actions">
              <button type="button" className="secondary-btn" onClick={() => navigate('/company')}>
                Cancel
              </button>
              <button
                type="button"
                className="primary-btn"
                disabled={submitting}
                onClick={onCreate}
              >
                {submitting ? 'Creating Organization…' : 'Create Subscriber'}
              </button>
            </div>
          </footer>
        </div>
      </div>
    </section>
  )
}

