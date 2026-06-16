import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { useAuth } from '../../../app/providers/authContext.js'
import { db } from '../../../config/firebase.js'
import { SideDrawer } from '../components/SideDrawer.jsx'

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

function expiryBucket(expiryDate) {
  const today = startOfDay(new Date())
  const exp = toDate(expiryDate)
  if (!exp) return 'active'
  const e = startOfDay(exp)
  const in30 = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
  if (e.getTime() < today.getTime()) return 'expired'
  if (e.getTime() <= in30.getTime()) return 'expiring'
  return 'active'
}

function truthy(v) {
  return v === true || v === 'true' || v === 1
}

export function PPEPage() {
  const { profile, organizationId } = useAuth()
  const orgId = profile?.organizationId ?? organizationId

  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    if (!orgId) {
      setAssets([])
      setLoading(false)
      return undefined
    }

    setLoading(true)

    const qy = query(
      collection(db, 'ppe_assets'),
      where('organizationId', '==', orgId),
      orderBy('createdAt', 'desc'),
      limit(500),
    )

    const unsub = onSnapshot(
      qy,
      (snap) => {
        const rows = snap.docs.map((d) => {
          const data = d.data() || {}
          return {
            id: d.id,
            assetId: data.assetId || d.id,
            category: data.category || '—',
            condition: data.condition || '—',
            size: data.size || '—',
            quantity: data.quantity ?? '—',
            status: data.status || '—',
            description: data.description || '',
            issueDate: data.issueDate || null,
            expiryDate: data.expiryDate || null,
            createdAt: data.createdAt || null,
            updatedAt: data.updatedAt || null,
            assigneeName: data.assigneeName || data.recipientName || '—',
            assigneeUid: data.assigneeUid || data.recipientUid || '',
            issuerName: data.issuerName || '—',
            issuerUid: data.issuerUid || '',
            issuerSecureId: data.issuerSecureId || '',
            issuerVerified: truthy(data.issuerVerified),
            issuerVerifiedAtLocal: data.issuerVerifiedAtLocal || null,
            recipientName: data.recipientName || data.assigneeName || '—',
            recipientConfirmed: truthy(data.recipientConfirmed),
            recipientConfirmedAtLocal: data.recipientConfirmedAtLocal || null,
            organizationId: data.organizationId || '',
            raw: data,
          }
        })
        setAssets(rows)
        setLoading(false)
      },
      () => {
        setAssets([])
        setLoading(false)
      },
    )

    return () => unsub()
  }, [orgId])

  const kpis = useMemo(() => {
    const total = assets.length
    const pendingConfirm = assets.filter((a) => !truthy(a.recipientConfirmed)).length
    const expiringOrExpired = assets.filter((a) => {
      const st = String(a.status || '').toUpperCase()
      if (st && st !== 'ACTIVE') return false
      const b = expiryBucket(a.expiryDate)
      return b === 'expired' || b === 'expiring'
    }).length
    return { total, pendingConfirm, expiringOrExpired }
  }, [assets])

  function openDrawer(row) {
    setSelected(row)
    setDrawerOpen(true)
  }

  function closeDrawer() {
    setDrawerOpen(false)
    setSelected(null)
  }

  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    const openId = searchParams.get('open')
    if (!openId || loading) return
    const match = assets.find((a) => a.id === openId)
    if (match) {
      openDrawer(match)
      const next = new URLSearchParams(searchParams)
      next.delete('open')
      setSearchParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, assets, loading])

  return (
    <section className="client-page client-ppe-page">
      <header className="client-dash-header">
        <h1>PPE &amp; Assets</h1>
        <p className="client-dash-sub">Track issued PPE, verification, confirmations, and expirations.</p>
      </header>

      <div className="client-risk-kpis">
        <article className="client-card client-kpi">
          <p className="client-kpi-label">Total Assets Issued</p>
          <p className="client-kpi-value">{String(kpis.total).padStart(2, '0')}</p>
        </article>
        <article className="client-card client-kpi client-kpi--warn">
          <p className="client-kpi-label">Pending Confirmation</p>
          <p className="client-kpi-value">{String(kpis.pendingConfirm).padStart(2, '0')}</p>
        </article>
        <article className="client-card client-kpi client-kpi--danger">
          <p className="client-kpi-label">Expiring Soon / Expired</p>
          <p className="client-kpi-value">{String(kpis.expiringOrExpired).padStart(2, '0')}</p>
        </article>
      </div>

      <article className="client-card client-risk-table-card">
        <div className="client-risk-toolbar">
          <div>
            <h2>PPE Assets</h2>
            <p className="client-risk-toolbar-sub">{loading ? 'Loading…' : `${assets.length} total`}</p>
          </div>
        </div>

        <div className="client-table-wrap">
          <table className="client-table">
            <thead>
              <tr>
                <th>Item Category</th>
                <th>Assignee</th>
                <th>Condition &amp; Size</th>
                <th>Issue Date</th>
                <th>Verification</th>
              </tr>
            </thead>
            <tbody>
              {!loading && assets.length === 0 ? (
                <tr>
                  <td colSpan={5} className="client-table-empty">
                    No PPE assets found.
                  </td>
                </tr>
              ) : null}
              {assets.map((a) => {
                const issuerPill = a.issuerVerified ? 'client-pill--ok' : 'client-pill--warn'
                const recipPill = a.recipientConfirmed ? 'client-pill--ok' : 'client-pill--warn'
                return (
                  <tr key={a.id} className="client-row-click" onClick={() => openDrawer(a)} role="button" tabIndex={0}>
                    <td className="client-td-strong">{a.category}</td>
                    <td className="client-td-muted">{a.assigneeName}</td>
                    <td>
                      <span className="client-td-muted">
                        {String(a.condition || '—')} - {String(a.size || '—')}
                      </span>
                    </td>
                    <td>{formatDate(a.issueDate)}</td>
                    <td>
                      <div className="client-pill-stack">
                        <span className={`client-pill ${issuerPill}`}>{a.issuerVerified ? 'Issuer Verified' : 'Issuer Pending'}</span>
                        <span className={`client-pill ${recipPill}`}>{a.recipientConfirmed ? 'Recipient Confirmed' : 'Recipient Pending'}</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </article>

      <SideDrawer
        isOpen={drawerOpen}
        onClose={closeDrawer}
        title={selected ? `PPE Asset: ${selected.assetId}` : 'PPE Asset'}
      >
        {selected ? (
          <div className="client-drawer-form">
            <div className="client-drawer-readonly">
              <p className="client-drawer-ro-label">Category</p>
              <p className="client-drawer-ro-value">{selected.category}</p>
              <p className="client-drawer-ro-label">Assignee</p>
              <p className="client-drawer-ro-value">
                {selected.assigneeName}
                {selected.assigneeUid ? <span className="client-td-muted"> • {selected.assigneeUid}</span> : null}
              </p>
              <p className="client-drawer-ro-label">Condition / Size / Quantity</p>
              <p className="client-drawer-ro-value">
                {selected.condition} • {selected.size} • Qty {String(selected.quantity)}
              </p>
              <p className="client-drawer-ro-label">Issue date</p>
              <p className="client-drawer-ro-value">{formatDate(selected.issueDate)}</p>
              <p className="client-drawer-ro-label">Expiry date</p>
              <p className="client-drawer-ro-value">{formatDate(selected.expiryDate)}</p>
              <p className="client-drawer-ro-label">Status</p>
              <p className="client-drawer-ro-value">{String(selected.status || '—')}</p>
              {selected.description ? (
                <>
                  <p className="client-drawer-ro-label">Description</p>
                  <p className="client-drawer-ro-value">{selected.description}</p>
                </>
              ) : null}
            </div>

            <div className="client-drawer-readonly" style={{ marginTop: 12 }}>
              <p className="client-drawer-ro-label">Chain of custody</p>
              <p className="client-drawer-ro-value">
                <b>Issuer verified:</b> {selected.issuerVerified ? 'Yes' : 'No'}{' '}
                <span className="client-td-muted">({formatDate(selected.issuerVerifiedAtLocal)})</span>
              </p>
              <p className="client-drawer-ro-value">
                <b>Recipient confirmed:</b> {selected.recipientConfirmed ? 'Yes' : 'No'}{' '}
                <span className="client-td-muted">({formatDate(selected.recipientConfirmedAtLocal)})</span>
              </p>
            </div>

            <details className="client-raw-details">
              <summary className="client-td-muted">Raw payload</summary>
              <pre className="client-raw-json">{JSON.stringify(selected.raw || {}, null, 2)}</pre>
            </details>
          </div>
        ) : null}
      </SideDrawer>
    </section>
  )
}

