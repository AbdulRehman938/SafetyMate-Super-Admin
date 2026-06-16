import { useEffect, useMemo, useState } from 'react'
import {
  collection,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from 'firebase/firestore'
import { CalendarDays, Download, Eye, Mail, WalletCards } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { db } from '../../../config/firebase.js'
import { useToast } from '../../../shared/toast/toastContext.js'
import { EmailInvoiceModal } from '../../company/components/EmailInvoiceModal.jsx'

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

function formatMoney(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
    Number(value) || 0,
  )
}

function statusTone(status) {
  const s = String(status || '').toLowerCase()
  if (s === 'paid') return 'success'
  if (s === 'pending' || s === 'unpaid') return 'warn'
  if (s === 'failed' || s === 'overdue') return 'danger'
  return 'muted'
}

export function BillingPaymentsPage() {
  const navigate = useNavigate()
  const toast = useToast()

  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])
  const [companiesById, setCompaniesById] = useState({})
  const [statusFilter, setStatusFilter] = useState('all')
  const [emailInvoiceOpen, setEmailInvoiceOpen] = useState(false)
  const [emailInvoice, setEmailInvoice] = useState(null)
  const [metrics, setMetrics] = useState({
    totalMrr: 0,
    churnRate: 0,
    netRevenue: 0,
    averageLtv: 0,
  })
  const [churnDist, setChurnDist] = useState({
    voluntary: 64,
    payment: 22,
    expiring: 14,
  })

  useEffect(() => {
    let cancelled = false

    async function run() {
      setLoading(true)
      try {
        const invoicesPromise = getDocs(query(collection(db, 'invoices'), orderBy('createdAt', 'desc'), limit(120))).catch(
          () => null,
        )
        const companiesPromise = getDocs(collection(db, 'organizations')).catch(() => null)
        const activeCountPromise = getCountFromServer(
          query(collection(db, 'organizations'), where('status', '==', 'active')),
        ).catch(() => null)
        const suspendedCountPromise = getCountFromServer(
          query(collection(db, 'organizations'), where('status', '==', 'suspended')),
        ).catch(() => null)

        const [invoicesSnap, companiesSnap, activeCountSnap, suspendedCountSnap] = await Promise.all([
          invoicesPromise,
          companiesPromise,
          activeCountPromise,
          suspendedCountPromise,
        ])
        if (cancelled) return

        const companyMap =
          companiesSnap?.docs?.reduce((acc, d) => {
            acc[d.id] = d.data()?.name || d.data()?.companyName || d.id
            return acc
          }, {}) || {}
        setCompaniesById(companyMap)

        const mappedRows =
          invoicesSnap?.docs?.map((d) => {
            const data = d.data()
            return {
              id: d.id,
              organizationId: data.organizationId || null,
              companyName: data.organizationName || companyMap[data.organizationId] || '—',
              invoiceId: data.invoiceId || `INV-${d.id.slice(0, 6).toUpperCase()}`,
              amount: Number(data.totalDue ?? data.totalAmount ?? 0),
              status: String(data.status || 'unpaid').toLowerCase(),
              createdAt: data.createdAt || null,
            }
          }) || []
        setRows(mappedRows)

        const paidTotal = mappedRows
          .filter((r) => r.status === 'paid')
          .reduce((sum, row) => sum + Number(row.amount || 0), 0)
        const unpaidTotal = mappedRows
          .filter((r) => r.status !== 'paid')
          .reduce((sum, row) => sum + Number(row.amount || 0), 0)
        const activeCompanies = activeCountSnap?.data?.()?.count || 0
        const suspendedCompanies = suspendedCountSnap?.data?.()?.count || 0
        const totalCompanies = activeCompanies + suspendedCompanies || 1

        setMetrics({
          totalMrr: paidTotal,
          churnRate: Number(((suspendedCompanies / totalCompanies) * 100).toFixed(1)),
          netRevenue: paidTotal - unpaidTotal * 0.15,
          averageLtv: activeCompanies > 0 ? paidTotal / activeCompanies : 0,
        })

        const failedCount = mappedRows.filter((r) => r.status === 'failed').length
        const overdueCount = mappedRows.filter((r) => r.status === 'overdue').length
        const unpaidCount = mappedRows.filter((r) => r.status === 'unpaid' || r.status === 'pending').length
        const totalChurnEvents = failedCount + overdueCount + unpaidCount || 1
        setChurnDist({
          voluntary: Math.round((unpaidCount / totalChurnEvents) * 100),
          payment: Math.round((failedCount / totalChurnEvents) * 100),
          expiring: Math.max(0, 100 - Math.round((unpaidCount / totalChurnEvents) * 100) - Math.round((failedCount / totalChurnEvents) * 100)),
        })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [])

  const filteredRows = useMemo(() => {
    if (statusFilter === 'all') return rows
    return rows.filter((r) => r.status === statusFilter)
  }, [rows, statusFilter])

  const revenueSeries = useMemo(() => {
    const monthKeys = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul']
    const monthTotals = monthKeys.map((key) => ({ key, value: 0 }))
    rows.forEach((row) => {
      const d = toDate(row.createdAt)
      if (!d) return
      const idx = Math.min(6, Math.max(0, d.getMonth()))
      monthTotals[idx].value += Number(row.amount || 0)
    })
    const max = Math.max(...monthTotals.map((m) => m.value), 1)
    return monthTotals.map((m) => ({ ...m, pct: Math.max(8, Math.round((m.value / max) * 100)) }))
  }, [rows])

  const kpis = [
    { label: 'TOTAL MRR', value: formatMoney(metrics.totalMrr), delta: '+12.5%' },
    { label: 'CHURN RATE', value: `${metrics.churnRate}%`, delta: '-0.8%' },
    { label: 'NET REVENUE', value: formatMoney(metrics.netRevenue), delta: '+5.2%' },
    { label: 'AVERAGE LTV', value: formatMoney(metrics.averageLtv), delta: '+3.1%' },
  ]

  return (
    <section className="stack-gap billing-pay-page">
      <header className="billing-pay-head">
        <div>
          <h2>Billing &amp; Payments</h2>
          <p>Manage your global revenue operations and subscription lifecycles.</p>
        </div>
        <button type="button" className="secondary-btn billing-pay-range-btn">
          <CalendarDays size={14} /> Last 30 Days
        </button>
      </header>

      <section className="billing-pay-kpis">
        {kpis.map((kpi) => (
          <article className="dashboard-card billing-pay-kpi" key={kpi.label}>
            <span>{kpi.label}</span>
            <h3>{loading ? '…' : kpi.value}</h3>
            <p>{kpi.delta}</p>
            <div className="billing-pay-mini-bars" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </div>
          </article>
        ))}
      </section>

      <section className="billing-pay-analytics-row">
        <article className="dashboard-card billing-pay-revenue">
          <header>
            <h3>Revenue Analytics</h3>
            <small>Monthly revenue performance for current fiscal year</small>
          </header>
          <div className="billing-pay-chart">
            {revenueSeries.map((m) => (
              <div key={m.key} className="billing-pay-bar-col">
                <div className="billing-pay-bar-track">
                  <span style={{ height: `${m.pct}%` }} />
                </div>
                <small>{m.key}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="dashboard-card billing-pay-churn">
          <h3>Churn Distribution</h3>
          <div className="billing-pay-churn-list">
            <p>
              <span>Voluntary Cancel</span>
              <b>{churnDist.voluntary}%</b>
            </p>
            <div><i style={{ width: `${churnDist.voluntary}%` }} /></div>
            <p>
              <span>Payment Failure</span>
              <b>{churnDist.payment}%</b>
            </p>
            <div><i style={{ width: `${churnDist.payment}%` }} /></div>
            <p>
              <span>Expiring Card</span>
              <b>{churnDist.expiring}%</b>
            </p>
            <div><i style={{ width: `${churnDist.expiring}%` }} /></div>
          </div>
          <button type="button" className="primary-btn">View Detailed Retention</button>
        </article>
      </section>

      <article className="dashboard-card billing-pay-table-card">
        <header className="billing-pay-table-head">
          <h3>Recent Invoices</h3>
          <div className="billing-pay-tabs">
            {[
              { id: 'all', label: 'All' },
              { id: 'paid', label: 'Paid' },
              { id: 'unpaid', label: 'Pending' },
            ].map((tab) => (
              <button
                type="button"
                key={tab.id}
                className={statusFilter === tab.id ? 'active' : ''}
                onClick={() => setStatusFilter(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </header>
        <div className="billing-pay-table-wrap">
          <table className="billing-pay-table">
            <thead>
              <tr>
                <th>DATE</th>
                <th>COMPANY</th>
                <th>INVOICE ID</th>
                <th>AMOUNT</th>
                <th>STATUS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="companies-loading">Loading invoices...</td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="companies-loading">No invoices found.</td>
                </tr>
              ) : (
                filteredRows.slice(0, 12).map((row) => (
                  <tr key={row.id}>
                    <td>{formatDate(row.createdAt)}</td>
                    <td className="billing-pay-company-cell">
                      <span className="billing-pay-company-badge">{(row.companyName || '—').slice(0, 2).toUpperCase()}</span>
                      <b>{row.companyName || companiesById[row.organizationId] || '—'}</b>
                    </td>
                    <td>{row.invoiceId}</td>
                    <td>{formatMoney(row.amount)}</td>
                    <td>
                      <span className={`status-badge tone-${statusTone(row.status)}`}>{row.status}</span>
                    </td>
                    <td>
                      <div className="billing-actions">
                        <button
                          type="button"
                          className="kebab-btn"
                          onClick={() => {
                            if (!row.organizationId) {
                              toast.push({ type: 'error', title: 'Missing organization', message: 'This invoice has no organization reference.' })
                              return
                            }
                            navigate(`/invoices/${row.id}`, { state: { invoice: row } })
                          }}
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          type="button"
                          className="kebab-btn"
                          onClick={() => window.open(`/invoices/${row.id}?print=true`, '_blank', 'noopener,noreferrer')}
                        >
                          <Download size={14} />
                        </button>
                        <button
                          type="button"
                          className="kebab-btn"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setEmailInvoice({
                              ...row,
                              organizationName: row.companyName || companiesById[row.organizationId] || row.organizationName || null,
                            })
                            setEmailInvoiceOpen(true)
                          }}
                        >
                          <Mail size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </article>

      <EmailInvoiceModal
        isOpen={emailInvoiceOpen}
        onClose={() => {
          setEmailInvoiceOpen(false)
          setEmailInvoice(null)
        }}
        invoice={emailInvoice}
      />
    </section>
  )
}
