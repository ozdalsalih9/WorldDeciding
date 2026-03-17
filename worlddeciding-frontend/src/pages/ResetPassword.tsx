import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import useAuth from '@/features/auth'
import { useToast } from '@/shared/ui/toast'
import worldDecidingLogo from '@/shared/logo/worlddeciding.png'

const passwordRules = [
  'At least 10 characters',
  'At least 1 digit',
  'At least 1 uppercase letter',
  'At least 1 lowercase letter',
  'At least 1 symbol (e.g. !@#$%)',
]

export default function ResetPassword() {
  const { resetPassword, requestPasswordReset } = useAuth()
  const nav = useNavigate()
  const toast = useToast()
  const [searchParams] = useSearchParams()

  const initialEmail = useMemo(() => searchParams.get('email')?.trim() ?? '', [searchParams])
  const initialToken = useMemo(() => searchParams.get('token')?.trim() ?? '', [searchParams])
  const hasPrefilledToken = initialToken.length > 0
  const hasPrefilledEmail = initialEmail.length > 0

  const [email, setEmail] = useState(initialEmail)
  const [token, setToken] = useState(initialToken)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setSubmitting] = useState(false)
  const [isRequesting, setIsRequesting] = useState(false)

  const handleRequestReset = async () => {
    if (!email || isRequesting) return
    setError(null)
    setIsRequesting(true)
    try {
      await requestPasswordReset(email)
      toast.success('Reset link sent. Please check your email.')
    } catch (err: any) {
      const msg = err?.message ?? 'Could not send reset email.'
      setError(msg)
      toast.error(msg)
    } finally {
      setIsRequesting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (newPassword !== confirmPassword) {
      const msg = 'Passwords do not match.'
      setError(msg)
      toast.error(msg)
      return
    }

    setSubmitting(true)
    try {
      const trimmedToken = token.trim()
      if (!trimmedToken) {
        const msg = 'Reset token is required.'
        setError(msg)
        toast.error(msg)
        setSubmitting(false)
        return
      }
      await resetPassword({
        email,
        token: trimmedToken,
        newPassword,
        confirmNewPassword: confirmPassword,
      })
      const successMessage = 'Password updated. You can now sign in.'
      toast.success(successMessage)
      nav('/login', { replace: true, state: { message: successMessage } })
    } catch (err: any) {
      const msg = err?.message ?? 'Password reset failed.'
      setError(msg)
      toast.error(msg)
    } finally {
      setSubmitting(false)
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
          <p className="auth-kicker">Account recovery</p>
          <h1 className="auth-title">Reset your password</h1>
          <p className="auth-subtitle">
            Enter your email, reset token, and a new password to regain access.
          </p>

          <form className="auth-form" onSubmit={handleSubmit}>
            <div>
              <label className="label">Email</label>
              <input
                required
                type="email"
                className="input auth-input"
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={hasPrefilledEmail}
              />
              {!hasPrefilledToken && (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={handleRequestReset}
                    disabled={!email || isRequesting}
                    className="btn-ghost w-full"
                  >
                    {isRequesting ? 'Sending reset link...' : 'Send reset link to email'}
                  </button>
                </div>
              )}
            </div>

            {hasPrefilledToken ? (
              <div className="auth-rules">
                Reset token detected from your email link.
              </div>
            ) : (
              <div>
                <label className="label">Reset token</label>
                <input
                  required
                  className="input auth-input"
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  placeholder="Paste the token from your email"
                />
              </div>
            )}

            <div>
              <label className="label">New password</label>
              <input
                required
                type="password"
                className="input auth-input"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
              />
            </div>

            <div>
              <label className="label">Confirm new password</label>
              <input
                required
                type="password"
                className="input auth-input"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
              />
            </div>

            <div className="auth-rules">
              <p className="auth-rules-title">Password rules</p>
              <ul className="auth-rules-list">
                {passwordRules.map(rule => (
                  <li key={rule}>- {rule}</li>
                ))}
              </ul>
            </div>

            {error && <p className="auth-error">{error}</p>}

            <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
              {isSubmitting ? 'Updating password...' : 'Update password'}
            </button>

            <p className="text-sm text-muted">
              Back to <Link to="/login" className="btn-link">sign in</Link>
            </p>
          </form>
        </div>
      </div>
    </section>
  )
}
