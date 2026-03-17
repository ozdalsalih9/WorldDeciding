import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import useAuth from '@/features/auth'
import { useToast } from '@/shared/ui/toast'
import worldDecidingLogo from '@/shared/logo/worlddeciding.png'

function resolveSafeRedirectPath(candidate: unknown): string {
  if (typeof candidate !== 'string') return '/'
  const value = candidate.trim()
  if (!value.startsWith('/')) return '/'
  if (value.startsWith('//')) return '/'
  if (value === '/profile' || value.startsWith('/profile/')) return '/'
  return value
}

export default function Login() {
  const { login, resendConfirmationEmail } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isResending, setIsResending] = useState(false)
  const nav = useNavigate()
  const loc = useLocation() as any
  const [searchParams, setSearchParams] = useSearchParams()
  const message = loc?.state?.message as string | undefined
  const toast = useToast()
  const isConfirmed = searchParams.get('confirmed') === '1'

  useEffect(() => {
    if (message) {
      toast.success(message)
      // Clear location state so the toast does not repeat on remounts/navigation.
      nav(loc.pathname, { replace: true, state: {} })
    }
  }, [loc.pathname, message, nav, toast])

  useEffect(() => {
    if (!isConfirmed) return
    toast.success('Email confirmed. You can now sign in.')
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('confirmed')
    setSearchParams(nextParams, { replace: true })
  }, [isConfirmed, searchParams, setSearchParams, toast])

  const loweredError = (error ?? '').toLowerCase()
  const isUnverifiedEmailError =
    loweredError.includes('verify your email') ||
    loweredError.includes('confirm your email') ||
    loweredError.includes('email not verified') ||
    loweredError.includes('email not confirmed') ||
    loweredError.includes('verification required')

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await login(email, password)
      toast.success('Signed in successfully.')
      const dest = resolveSafeRedirectPath(loc?.state?.from?.pathname)
      nav(dest, { replace: true })
    } catch (err: any) {
      const msg = err?.message ?? 'Login failed'
      setError(msg)
      toast.error(msg)
    }
  }

  const handleResendConfirmation = async () => {
    if (!email || isResending) return
    setIsResending(true)
    try {
      await resendConfirmationEmail(email)
      toast.success('Confirmation email sent. Please check your inbox.')
    } catch (err: any) {
      const msg = err?.message ?? 'Could not resend confirmation email.'
      toast.error(msg)
    } finally {
      setIsResending(false)
    }
  }

  return (
    <section className="auth-stage">
      <div className="auth-stage-backdrop">
        <span className="auth-orb auth-orb-a" />
        <span className="auth-orb auth-orb-b" />
        <span className="auth-grid" />
      </div>

      <div className="auth-shell">
        <div className="auth-panel">
          <div className="auth-brand">
            <img src={worldDecidingLogo} alt="WorldDeciding logo" className="auth-brand-logo" />
            <span>WorldDeciding</span>
          </div>
          <p className="auth-kicker">Welcome back</p>
          <h1 className="auth-title">Sign in to WorldDeciding</h1>
          <p className="auth-subtitle">
            Join live voting streams, comments, and real-time stats from one place.
          </p>

          <form className="auth-form" onSubmit={onSubmit}>
            <div>
              <label className="label">Email</label>
              <input
                required
                type="email"
                className="input auth-input"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                required
                type="password"
                className="input auth-input"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>

            {error && <p className="auth-error">{error}</p>}

            {isUnverifiedEmailError && (
              <button
                type="button"
                onClick={handleResendConfirmation}
                disabled={!email || isResending}
                className="btn-ghost w-full"
              >
                {isResending ? 'Sending confirmation email...' : 'Resend confirmation email'}
              </button>
            )}

            <button className="btn-primary w-full">Sign in</button>

            <div className="auth-links">
              <p className="text-sm text-muted">
                Forgot your password?{' '}
                <Link to="/reset-password" className="btn-link">Reset it</Link>
              </p>
              <p className="text-sm text-muted">
                No account yet?{' '}
                <Link to="/register" className="btn-link">Create one</Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </section>
  )
}
