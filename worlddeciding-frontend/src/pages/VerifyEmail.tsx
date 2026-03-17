import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import useAuth from '@/features/auth'
import { useToast } from '@/shared/ui/toast'

type Status = 'loading' | 'success' | 'error'
type Mode = 'auto' | 'forced-success' | 'forced-error'

export default function VerifyEmail() {
  const { confirmEmail } = useAuth()
  const toast = useToast()
  const [params] = useSearchParams()
  const statusParam = (params.get('status') ?? '').trim().toLowerCase()
  const messageParam = params.get('message')?.trim() ?? ''
  const userId =
    params.get('userId')?.trim() ||
    params.get('userid')?.trim() ||
    params.get('id')?.trim() ||
    ''
  const rawToken =
    params.get('token')?.trim() ||
    params.get('code')?.trim() ||
    ''
  const [status, setStatus] = useState<Status>('loading')
  const [message, setMessage] = useState('Confirming your email...')
  const hasRunRef = useRef(false)
  const mode: Mode =
    statusParam === 'success'
      ? 'forced-success'
      : statusParam === 'error'
        ? 'forced-error'
        : 'auto'

  const tokenCandidates = Array.from(
    new Set(
      [
        rawToken,
        (() => {
          try {
            return decodeURIComponent(rawToken)
          } catch {
            return rawToken
          }
        })(),
      ]
        .flatMap((t) => {
          const plusFixed = t.replace(/ /g, '+')
          const asBase64Url = plusFixed
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/g, '')
          return [t, plusFixed, asBase64Url]
        })
        .map((t) => t.trim())
        .filter(Boolean)
    )
  )

  useEffect(() => {
    if (hasRunRef.current) return
    hasRunRef.current = true
    if (mode === 'forced-success') {
      const msg = messageParam || 'Email confirmed. You can now sign in.'
      setStatus('success')
      setMessage(msg)
      toast.success(msg)
      return
    }

    if (mode === 'forced-error') {
      const msg = messageParam || 'Email confirmation failed.'
      setStatus('error')
      setMessage(msg)
      toast.error(msg)
      return
    }

    if (!userId || tokenCandidates.length === 0) {
      const msg = 'Invalid confirmation link.'
      setStatus('error')
      setMessage(msg)
      toast.error(msg)
      return
    }

    const run = async () => {
      let lastError: any = null
      for (const token of tokenCandidates) {
        try {
          await confirmEmail({ userId, token })
          const msg = 'Email confirmed. You can now sign in.'
          setStatus('success')
          setMessage(msg)
          toast.success(msg)
          return
        } catch (err: any) {
          lastError = err
        }
      }

      const msg = lastError?.message ?? 'Email confirmation failed.'
      setStatus('error')
      setMessage(msg)
      toast.error(msg)
    }

    void run()
  }, [confirmEmail, messageParam, mode, toast, tokenCandidates, userId])

  const title =
    status === 'success'
      ? 'Email Verified'
      : status === 'error'
        ? 'Verification Failed'
        : 'Verifying Your Email'
  const badgeLabel = status === 'success' ? 'Confirmed' : status === 'error' ? 'Action required' : 'Processing'
  const icon = status === 'success' ? '✓' : status === 'error' ? '!' : '...'
  const iconTone =
    status === 'success'
      ? 'from-emerald-400 to-cyan-400'
      : status === 'error'
        ? 'from-rose-400 to-orange-400'
        : 'from-sky-400 to-indigo-400'

  return (
    <div className="mx-auto max-w-3xl">
      <div className="relative overflow-hidden rounded-[28px] border border-border bg-panel/95 shadow-[0_30px_90px_rgba(15,23,42,0.18)]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 -top-24 h-60 w-60 rounded-full bg-[radial-gradient(circle_at_center,rgba(79,116,230,0.35),transparent_68%)] blur-2xl" />
          <div className="absolute -bottom-28 -right-20 h-72 w-72 rounded-full bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.3),transparent_66%)] blur-2xl" />
        </div>

        <div className="relative z-10 grid gap-7 p-7 md:grid-cols-[1.1fr_0.9fr] md:p-10">
          <div className="space-y-5">
            <p className="section-heading">Email verification</p>
            <h1 className="heading-1">{title}</h1>
            <p className="text-base text-muted">{message}</p>

            <div className="rounded-2xl border border-border bg-panel/70 p-4 text-sm text-muted">
              <div className="mb-2 text-xs uppercase tracking-[0.2em] text-muted">What happens next</div>
              {status === 'success' ? (
                <p>Your account is active now. Continue to login and start using the app.</p>
              ) : status === 'error' ? (
                <p>The link may be expired or already used. Request a fresh confirmation email from login.</p>
              ) : (
                <p>We are validating your confirmation token. This may take a couple of seconds.</p>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <Link to="/login" className="btn-primary">
                {status === 'success' ? 'Continue to login' : 'Go to login'}
              </Link>
              <Link to="/register" className="btn-ghost">Create new account</Link>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <div className="relative flex h-64 w-full max-w-[260px] flex-col items-center justify-center rounded-3xl border border-border bg-[linear-gradient(150deg,rgba(248,251,255,0.9),rgba(231,243,255,0.82))]">
              <div className={`grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br text-3xl font-bold text-white shadow-[0_18px_45px_rgba(15,23,42,0.22)] ${iconTone}`}>
                {status === 'loading' ? <span className="animate-pulse">...</span> : icon}
              </div>
              <div className="mt-4 text-xs uppercase tracking-[0.22em] text-muted">{badgeLabel}</div>
              <div className="mt-2 text-sm text-muted">
                {status === 'loading' ? 'Please wait' : status === 'success' ? 'All set' : 'Need retry'}
              </div>
              <div className="mt-4 h-1.5 w-36 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${iconTone} ${
                    status === 'loading' ? 'w-1/2 animate-pulse' : status === 'success' ? 'w-full' : 'w-1/3'
                  }`}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
