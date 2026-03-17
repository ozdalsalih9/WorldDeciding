import { Link } from 'react-router-dom'

export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-body space-y-3">
          <h1 className="heading-1">Admin Panel</h1>
          <p className="text-sm text-muted">
            Manage question drafts, publish content, and bulk import new items.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Link to="/admin/categories" className="card transition hover:-translate-y-0.5">
          <div className="card-body space-y-2">
            <h2 className="heading-2">Categories</h2>
            <p className="text-sm text-muted">Create, rename, and delete question categories.</p>
          </div>
        </Link>

        <Link to="/admin/questions" className="card transition hover:-translate-y-0.5">
          <div className="card-body space-y-2">
            <h2 className="heading-2">Questions</h2>
            <p className="text-sm text-muted">Filter by status/language and publish drafts.</p>
          </div>
        </Link>

        <Link to="/admin/questions/import" className="card transition hover:-translate-y-0.5">
          <div className="card-body space-y-2">
            <h2 className="heading-2">Bulk Import</h2>
            <p className="text-sm text-muted">Upload JSON array, preview, validate, and import.</p>
          </div>
        </Link>

        <Link to="/admin/analytics" className="card transition hover:-translate-y-0.5">
          <div className="card-body space-y-2">
            <h2 className="heading-2">Analytics</h2>
            <p className="text-sm text-muted">Check GA4 configuration, consent state, and local event queue.</p>
          </div>
        </Link>
      </div>
    </div>
  )
}
