import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp, where } from 'firebase/firestore'
import { useAuth } from '../../../app/providers/authContext.js'
import { db } from '../../../config/firebase.js'
import { SideDrawer } from '../components/SideDrawer.jsx'
import { isWorkforceRole } from '../workforceRoles.js'

function toDate(value) {
  if (!value) return null
  if (typeof value?.toDate === 'function') return value.toDate()
  if (value instanceof Date) return value
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function formatDate(value) {
  const d = toDate(value)
  if (!d) return '—'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).format(d)
}

function startOfDay(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function statusForExpiry(expiryDate) {
  const today = startOfDay(new Date())
  const expiry = toDate(expiryDate)
  if (!expiry) return { label: '—', tone: 'warn' }
  const exp = startOfDay(expiry)
  const in30 = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)

  if (exp.getTime() < today.getTime()) return { label: 'Expired', tone: 'danger' }
  if (exp.getTime() <= in30.getTime()) return { label: 'Expiring Soon', tone: 'warn' }
  return { label: 'Active', tone: 'ok' }
}

/** Row badge for appointment letters (Firestore status + expiry). */
function appointmentBadge(row) {
  const raw = String(row.status || '').trim().toUpperCase()
  if (raw === 'REVOKED') return { label: 'Revoked', pillClass: 'client-pill--danger' }

  const today = startOfDay(new Date())
  const exp = toDate(row.expiryDate)
  if (exp && startOfDay(exp).getTime() < today.getTime()) {
    return { label: 'Expired', pillClass: 'client-pill--danger' }
  }

  if (raw === 'ISSUED' || raw === '') {
    return { label: 'Issued', pillClass: 'client-pill--ok' }
  }

  return { label: raw || 'Unknown', pillClass: 'client-pill--warn' }
}

export function CertificatesPage() {
  const { profile, organizationId } = useAuth()
  const orgId = profile?.organizationId ?? organizationId

  const [mainTab, setMainTab] = useState('certificates')
  const [certs, setCerts] = useState([])
  const [appointments, setAppointments] = useState([])
  const [inductions, setInductions] = useState([])
  const [workers, setWorkers] = useState([])
  const [loading, setLoading] = useState(true)
  const [apptsLoading, setApptsLoading] = useState(true)
  const [inductionsLoading, setInductionsLoading] = useState(true)
  const [certsError, setCertsError] = useState('')
  const [apptsError, setApptsError] = useState('')
  const [inductionsError, setInductionsError] = useState('')

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState(null) // { tone, message }
  const [drawerMode, setDrawerMode] = useState('add_certificate') // add_certificate | induction_details
  const [selectedInduction, setSelectedInduction] = useState(null)
  const [form, setForm] = useState({
    workerId: '',
    certificateName: '',
    issueDate: '',
    expiryDate: '',
  })

  useEffect(() => {
    if (!orgId) {
      setCerts([])
      setAppointments([])
      setInductions([])
      setWorkers([])
      setLoading(false)
      setApptsLoading(false)
      setInductionsLoading(false)
      setCertsError('')
      setApptsError('')
      setInductionsError('')
      return undefined
    }

    setLoading(true)
    setApptsLoading(true)
    setInductionsLoading(true)
    setCertsError('')
    setApptsError('')
    setInductionsError('')

    // TODO: Wire to Firestore where('organizationId', '==', orgId) — certificates list (expiring first)
    const certsQ = query(
      collection(db, 'certificates'),
      where('organizationId', '==', orgId),
      orderBy('expiryDate', 'asc'),
    )

    const unsubCerts = onSnapshot(
      certsQ,
      (snap) => {
        setCertsError('')
        const rows = snap.docs.map((d) => {
          const data = d.data() || {}
          return {
            id: d.id,
            workerId: data.workerId || '',
            workerName: data.workerName || '',
            certificateName: data.certificateName || data.name || '—',
            issueDate: data.issueDate || null,
            expiryDate: data.expiryDate || null,
          }
        })
        setCerts(rows)
        setLoading(false)
      },
      (err) => {
        console.error('[CertificatesPage] certificates listener failed', err)
        setCertsError(String(err?.message || 'Failed to load certificates.'))
        setCerts([])
        setLoading(false)
      },
    )

    const apptsQ = query(
      collection(db, 'appointment_letters'),
      where('organizationId', '==', orgId),
      orderBy('expiryDate', 'asc'),
    )

    const unsubAppts = onSnapshot(
      apptsQ,
      (snap) => {
        setApptsError('')
        const rows = snap.docs.map((d) => {
          const data = d.data() || {}
          return {
            id: d.id,
            letterId: data.letterId || d.id,
            appointeeName: data.appointeeName || '—',
            role: data.role || '—',
            siteName: data.siteName || '—',
            appointmentDate: data.appointmentDate || null,
            expiryDate: data.expiryDate || null,
            status: data.status || '',
          }
        })
        setAppointments(rows)
        setApptsLoading(false)
      },
      (err) => {
        console.error('[CertificatesPage] appointment_letters listener failed', err)
        setApptsError(String(err?.message || 'Failed to load appointment letters.'))
        setAppointments([])
        setApptsLoading(false)
      },
    )

    const inductionsQ = query(
      collection(db, 'safety_inductions'),
      where('organizationId', '==', orgId),
      orderBy('inductionDate', 'desc'),
    )

    const unsubInductions = onSnapshot(
      inductionsQ,
      (snap) => {
        setInductionsError('')
        const rows = snap.docs.map((d) => {
          const data = d.data() || {}
          return {
            id: d.id,
            fullName: data.fullName || data.workerName || data.name || '—',
            company: data.company || data.employer || '—',
            idNumber: data.idNumber || data.cnic || data.employeeId || '—',
            inductionType: data.inductionType || data.type || '—',
            siteName: data.siteName || data.site || '',
            inductionDate: data.inductionDate || data.createdAt || null,
            isVerified: Boolean(data.isVerified),
            inductorName: data.inductorName || data.trainerName || data.createdByName || '—',
            checklist: data.checklist || {},
            signedAt: data.signedAt || data.signatureAt || null,
            raw: data,
          }
        })
        setInductions(rows)
        setInductionsLoading(false)
      },
      (err) => {
        console.error('[CertificatesPage] safety_inductions listener failed', err)
        setInductionsError(String(err?.message || 'Failed to load safety inductions.'))
        setInductions([])
        setInductionsLoading(false)
      },
    )

    // TODO: Wire to Firestore where('organizationId', '==', orgId) — workers list for dropdown
    const workersQ = query(collection(db, 'user_profiles'), where('organizationId', '==', orgId))

    const unsubWorkers = onSnapshot(
      workersQ,
      (snap) => {
        const rows = snap.docs
          .map((d) => {
            const data = d.data() || {}
            return {
              id: d.id,
              fullName: data.fullName || data.name || '—',
              role: data.role || '',
            }
          })
          .filter((row) => isWorkforceRole(row.role))
          .sort((a, b) => String(a.fullName).localeCompare(String(b.fullName), undefined, { sensitivity: 'base' }))
        setWorkers(rows)
      },
      () => setWorkers([]),
    )

    return () => {
      unsubCerts()
      unsubAppts()
      unsubInductions()
      unsubWorkers()
    }
  }, [orgId])

  const workerNameById = useMemo(() => {
    const map = new Map()
    for (const w of workers) map.set(w.id, w.fullName)
    return map
  }, [workers])

  const kpis = useMemo(() => {
    // Certificates + appointment letters: Expired / Expiring Soon / Active
    if (mainTab === 'certificates' || mainTab === 'appointments') {
      let expired = 0
      let expiring = 0
      let active = 0
      const rows = mainTab === 'certificates' ? certs : appointments
      for (const row of rows) {
        if (mainTab === 'appointments' && String(row.status || '').trim().toUpperCase() === 'REVOKED') continue
        const s = statusForExpiry(row.expiryDate)
        if (s.label === 'Expired') expired += 1
        else if (s.label === 'Expiring Soon') expiring += 1
        else if (s.label === 'Active') active += 1
      }
      return { a: expired, b: expiring, c: active }
    }

    // Safety inductions: Verified / Pending / Total
    const verified = inductions.filter((i) => i.isVerified).length
    const pending = inductions.length - verified
    return { a: verified, b: pending, c: inductions.length }
  }, [mainTab, certs, appointments, inductions])

  function showToast(nextToast) {
    setToast(nextToast)
    window.setTimeout(() => setToast(null), 2600)
  }

  function openDrawer() {
    setForm({ workerId: '', certificateName: '', issueDate: '', expiryDate: '' })
    setDrawerMode('add_certificate')
    setDrawerOpen(true)
  }

  function openInductionDrawer(induction) {
    setSelectedInduction(induction)
    setDrawerMode('induction_details')
    setDrawerOpen(true)
  }

  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab && ['certificates', 'appointments', 'inductions'].includes(tab) && tab !== mainTab) {
      setMainTab(tab)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  useEffect(() => {
    const openId = searchParams.get('open')
    const tab = searchParams.get('tab')
    if (!openId || tab !== 'inductions' || inductionsLoading) return
    const match = inductions.find((i) => i.id === openId)
    if (match) {
      openInductionDrawer(match)
      const next = new URLSearchParams(searchParams)
      next.delete('open')
      setSearchParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, inductions, inductionsLoading])

  function closeDrawer() {
    setDrawerOpen(false)
    setBusy(false)
    setSelectedInduction(null)
  }

  async function onAddCertificate(e) {
    e.preventDefault()
    if (!orgId) return

    const workerId = String(form.workerId || '')
    const certificateName = String(form.certificateName || '').trim()
    const issueDate = form.issueDate ? new Date(`${form.issueDate}T00:00:00`) : null
    const expiryDate = form.expiryDate ? new Date(`${form.expiryDate}T00:00:00`) : null

    if (!workerId) {
      showToast({ tone: 'error', message: 'Select a worker.' })
      return
    }
    if (!certificateName) {
      showToast({ tone: 'error', message: 'Certificate name is required.' })
      return
    }
    if (!issueDate || Number.isNaN(issueDate.getTime())) {
      showToast({ tone: 'error', message: 'Issue date is required.' })
      return
    }
    if (!expiryDate || Number.isNaN(expiryDate.getTime())) {
      showToast({ tone: 'error', message: 'Expiry date is required.' })
      return
    }

    setBusy(true)
    try {
      const workerName = workerNameById.get(workerId) || ''
      // TODO: Wire to Firestore where('organizationId', '==', orgId) — enforce via rules
      await addDoc(collection(db, 'certificates'), {
        organizationId: orgId,
        workerId,
        workerName,
        certificateName,
        issueDate,
        expiryDate,
        createdAt: serverTimestamp(),
      })
      showToast({ tone: 'success', message: 'Certificate added.' })
      closeDrawer()
    } catch {
      showToast({ tone: 'error', message: 'Could not add certificate.' })
      setBusy(false)
    }
  }

  return (
    <section className="client-page client-cert-page">
      <header className="client-dash-header client-cert-head">
        <div>
          <h1>Certificates</h1>
          <p className="client-dash-sub">Track certifications, legal appointment letters, and expirations.</p>
        </div>
        {mainTab === 'certificates' ? (
          <button type="button" className="client-btn client-btn--primary" onClick={openDrawer}>
            Add Certificate
          </button>
        ) : (
          <span className="client-td-muted" style={{ fontSize: 13 }}>
            Issued from the mobile app
          </span>
        )}
      </header>

      <div className="client-cert-tabs" role="tablist" aria-label="Certificates or appointment letters">
        <button
          type="button"
          role="tab"
          aria-selected={mainTab === 'certificates'}
          className="client-cert-tab"
          onClick={() => setMainTab('certificates')}
        >
          Certificates
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mainTab === 'appointments'}
          className="client-cert-tab"
          onClick={() => setMainTab('appointments')}
        >
          Appointment Letters
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mainTab === 'inductions'}
          className="client-cert-tab"
          onClick={() => setMainTab('inductions')}
        >
          Safety Inductions
        </button>
      </div>

      <div className="client-risk-kpis">
        <article className="client-card client-kpi client-kpi--danger">
          <p className="client-kpi-label">
            {mainTab === 'inductions' ? 'Verified' : 'Expired'}
          </p>
          <p className="client-kpi-value">{String(kpis.a).padStart(2, '0')}</p>
        </article>
        <article className="client-card client-kpi client-kpi--warn">
          <p className="client-kpi-label">
            {mainTab === 'inductions' ? 'Pending' : 'Expiring Soon'}
          </p>
          <p className="client-kpi-value">{String(kpis.b).padStart(2, '0')}</p>
        </article>
        <article className="client-card client-kpi client-kpi--ok">
          <p className="client-kpi-label">
            {mainTab === 'inductions' ? 'Total' : 'Active'}
          </p>
          <p className="client-kpi-value">{String(kpis.c).padStart(2, '0')}</p>
        </article>
      </div>

      <article className="client-card client-risk-table-card">
        <div className="client-risk-toolbar">
          <div>
            <h2>
              {mainTab === 'certificates'
                ? 'Certificates'
                : mainTab === 'appointments'
                  ? 'Appointment Letters'
                  : 'Safety Inductions'}
            </h2>
            <p className="client-risk-toolbar-sub">
              {mainTab === 'certificates'
                ? loading
                  ? 'Loading…'
                  : `${certs.length} total`
                : mainTab === 'appointments'
                  ? apptsLoading
                    ? 'Loading…'
                    : `${appointments.length} total`
                  : inductionsLoading
                    ? 'Loading…'
                    : `${inductions.length} total`}
            </p>
            {mainTab === 'certificates' && certsError ? (
              <p className="client-risk-toolbar-sub" style={{ color: 'rgba(255, 154, 162, 0.9)' }}>
                {certsError}
              </p>
            ) : null}
            {mainTab === 'appointments' && apptsError ? (
              <p className="client-risk-toolbar-sub" style={{ color: 'rgba(255, 154, 162, 0.9)' }}>
                {apptsError}
              </p>
            ) : null}
            {mainTab === 'inductions' && inductionsError ? (
              <p className="client-risk-toolbar-sub" style={{ color: 'rgba(255, 154, 162, 0.9)' }}>
                {inductionsError}
              </p>
            ) : null}
          </div>
        </div>

        <div className="client-table-wrap">
          {mainTab === 'certificates' ? (
            <table className="client-table">
              <thead>
                <tr>
                  <th>Worker Name</th>
                  <th>Certificate Type</th>
                  <th>Issue Date</th>
                  <th>Expiry Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {!loading && certs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="client-table-empty">
                      No certificates found.
                    </td>
                  </tr>
                ) : null}
                {certs.map((c) => {
                  const workerName = c.workerName || workerNameById.get(c.workerId) || '—'
                  const status = statusForExpiry(c.expiryDate)
                  const pillTone =
                    status.tone === 'danger'
                      ? 'client-pill--danger'
                      : status.tone === 'warn'
                        ? 'client-pill--warn'
                        : 'client-pill--ok'
                  return (
                    <tr key={c.id}>
                      <td className="client-td-strong">{workerName}</td>
                      <td className="client-td-muted">{c.certificateName}</td>
                      <td>{formatDate(c.issueDate)}</td>
                      <td>{formatDate(c.expiryDate)}</td>
                      <td>
                        <span className={`client-pill ${pillTone}`}>{status.label}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : mainTab === 'appointments' ? (
            <table className="client-table">
              <thead>
                <tr>
                  <th>Appointee Name</th>
                  <th>Appointed Role</th>
                  <th>Site / Location</th>
                  <th>Appointment Date</th>
                  <th>Expiry Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {!apptsLoading && appointments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="client-table-empty">
                      No appointment letters found.
                    </td>
                  </tr>
                ) : null}
                {appointments.map((a) => {
                  const badge = appointmentBadge(a)
                  return (
                    <tr key={a.id}>
                      <td className="client-td-strong">{a.appointeeName}</td>
                      <td className="client-td-muted">{a.role}</td>
                      <td>{a.siteName}</td>
                      <td>{formatDate(a.appointmentDate)}</td>
                      <td>{formatDate(a.expiryDate)}</td>
                      <td>
                        <span className={`client-pill ${badge.pillClass}`}>{badge.label}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <table className="client-table">
              <thead>
                <tr>
                  <th>Worker Name</th>
                  <th>Company / ID</th>
                  <th>Induction Type</th>
                  <th>Site</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {!inductionsLoading && inductions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="client-table-empty">
                      No safety inductions found.
                    </td>
                  </tr>
                ) : null}
                {inductions.map((i) => {
                  const pillClass = i.isVerified ? 'client-pill--ok' : 'client-pill--warn'
                  const site = String(i.siteName || '').trim() ? i.siteName : 'General'
                  return (
                    <tr
                      key={i.id}
                      className="client-row-click"
                      onClick={() => openInductionDrawer(i)}
                      role="button"
                      tabIndex={0}
                    >
                      <td className="client-td-strong">{i.fullName}</td>
                      <td className="client-td-muted">
                        {i.company || '—'} / {i.idNumber || '—'}
                      </td>
                      <td>{i.inductionType}</td>
                      <td>{site}</td>
                      <td>{formatDate(i.inductionDate)}</td>
                      <td>
                        <span className={`client-pill ${pillClass}`}>{i.isVerified ? 'Verified' : 'Pending'}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </article>

      <SideDrawer
        isOpen={drawerOpen}
        onClose={closeDrawer}
        title={drawerMode === 'induction_details' ? 'Safety Induction' : 'Add Certificate'}
      >
        {drawerMode === 'induction_details' && selectedInduction ? (
          <div className="client-drawer-form">
            <div className="client-drawer-readonly">
              <p className="client-drawer-ro-label">Worker</p>
              <p className="client-drawer-ro-value">{selectedInduction.fullName}</p>
              <p className="client-drawer-ro-label">Inductor</p>
              <p className="client-drawer-ro-value">{selectedInduction.inductorName}</p>
              <p className="client-drawer-ro-label">Date</p>
              <p className="client-drawer-ro-value">{formatDate(selectedInduction.inductionDate)}</p>
            </div>

            <div className="induction-checklist">
              <p className="client-drawer-ro-label">Checklist</p>
              {['emergency', 'fire', 'incident', 'ppe'].map((key) => {
                const v = Boolean(selectedInduction.checklist?.[key])
                return (
                  <div key={key} className="induction-check-item">
                    <span className={`induction-check-icon ${v ? 'ok' : 'bad'}`}>{v ? '✓' : '✕'}</span>
                    <span className="induction-check-label">{key.toUpperCase()}</span>
                  </div>
                )
              })}
            </div>

            <div className="client-drawer-readonly" style={{ marginTop: 12 }}>
              <p className="client-drawer-ro-label">Signed at</p>
              <p className="client-drawer-ro-value">{formatDate(selectedInduction.signedAt)}</p>
            </div>
          </div>
        ) : (
          <form className="client-drawer-form" onSubmit={onAddCertificate}>
            <label htmlFor="cert-worker">Worker</label>
            <select
              id="cert-worker"
              className="client-select"
              value={form.workerId}
              onChange={(e) => setForm((p) => ({ ...p, workerId: e.target.value }))}
              disabled={busy}
              required
            >
              <option value="" disabled>
                Select worker…
              </option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.fullName}
                </option>
              ))}
            </select>

            <label htmlFor="cert-name">Certificate Name</label>
            <input
              id="cert-name"
              value={form.certificateName}
              onChange={(e) => setForm((p) => ({ ...p, certificateName: e.target.value }))}
              placeholder="e.g., Working at Heights"
              disabled={busy}
              required
            />

            <label htmlFor="cert-issue">Issue Date</label>
            <input
              id="cert-issue"
              type="date"
              value={form.issueDate}
              onChange={(e) => setForm((p) => ({ ...p, issueDate: e.target.value }))}
              disabled={busy}
              required
            />

            <label htmlFor="cert-expiry">Expiry Date</label>
            <input
              id="cert-expiry"
              type="date"
              value={form.expiryDate}
              onChange={(e) => setForm((p) => ({ ...p, expiryDate: e.target.value }))}
              disabled={busy}
              required
            />

            <button type="submit" className="client-btn client-btn--primary" disabled={busy}>
              {busy ? 'Saving…' : 'Add Certificate'}
            </button>
          </form>
        )}
      </SideDrawer>

      {toast ? (
        <div
          className={`client-toast ${toast.tone === 'error' ? 'client-toast--error' : 'client-toast--success'}`}
          role="status"
          aria-live="polite"
        >
          {toast.message}
        </div>
      ) : null}
    </section>
  )
}

