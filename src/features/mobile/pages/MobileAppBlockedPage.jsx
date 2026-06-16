import { useAuth } from '../../../app/providers/authContext.js'

export function MobileAppBlockedPage() {
  const { isSuperAdmin } = useAuth()

  if (!isSuperAdmin) return null

  return (
    <section className="stack-gap">
      <article className="dashboard-card">
        <h2>Admin View</h2>
        <p className="subtle">
          Please use the Web Dashboard for platform management.
        </p>
      </article>
    </section>
  )
}

