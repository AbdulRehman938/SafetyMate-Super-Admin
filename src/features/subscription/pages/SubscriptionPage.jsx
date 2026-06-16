export function SubscriptionPage() {
  return (
    <section className="stack-gap">
      <article className="panel">
        <h2>New Subscription</h2>
        <p className="subtle">Use this form flow to create and activate subscriptions.</p>
      </article>

      <form className="panel form-grid">
        <label>
          Company Name
          <input type="text" placeholder="Type company name" />
        </label>

        <label>
          Plan
          <select>
            <option>Starter</option>
            <option>Business</option>
            <option>Enterprise</option>
          </select>
        </label>

        <label>
          Billing Cycle
          <select>
            <option>Monthly</option>
            <option>Yearly</option>
          </select>
        </label>

        <button className="primary-btn" type="button">
          Create Subscription
        </button>
      </form>
    </section>
  )
}
