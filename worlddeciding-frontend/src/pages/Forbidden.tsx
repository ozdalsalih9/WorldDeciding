import { Link } from 'react-router-dom'

export default function Forbidden() {
  return (
    <div className="card">
      <div className="card-body space-y-3">
        <h1 className="heading-1">Forbidden</h1>
        <p className="text-sm text-muted">
          You do not have permission to access this page.
        </p>
        <Link className="btn-ghost" to="/">
          Return Home
        </Link>
      </div>
    </div>
  )
}
