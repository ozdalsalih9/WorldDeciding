import { useMemo } from 'react'
import { useCookieConsent } from '@/app/consent'

const cookieTypes = [
  {
    title: 'Essential Cookies',
    body:
      'These are used for sign-in state, session continuity, security checks, and core application behavior. Without them, core parts of the site may not function correctly.',
  },
  {
    title: 'Preference Cookies',
    body:
      'These can store interface choices such as remembered settings or similar convenience preferences so the experience stays consistent between visits.',
  },
  {
    title: 'Analytics Signals',
    body:
      'Basic analytics storage may be used to understand traffic patterns, diagnose performance issues, and improve feature quality. This data is typically reviewed in aggregate rather than to profile individual users.',
  },
]

export default function Cookies() {
  const { consent, isReady, isSaving, error, acceptAnalytics, declineAnalytics } = useCookieConsent()

  const consentLabel = useMemo(() => {
    if (!isReady || consent.status === 'pending') return 'Not set yet'
    return consent.analytics ? 'Analytics enabled' : 'Necessary cookies only'
  }, [consent.analytics, consent.status, isReady])

  const lastUpdatedLabel = useMemo(() => {
    if (!consent.updatedAt) return 'No saved preference yet'

    return new Intl.DateTimeFormat('en', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(consent.updatedAt))
  }, [consent.updatedAt])

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <div className="surface p-6 sm:p-8">
        <div className="space-y-4">
          <span className="pill">Cookies Policy</span>
          <div className="space-y-3">
            <h1 className="heading-1">How Cookies Are Used</h1>
            <p className="text-sm text-muted">
              WorldDeciding uses small browser storage mechanisms such as cookies and similar local storage entries to keep the application stable, secure, and easier to use.
            </p>
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Last updated: March 1, 2026</p>
          </div>
        </div>
      </div>

      <div className="surface p-6 sm:p-7">
        <div className="space-y-5">
          <div className="space-y-2">
            <h2 className="heading-2">Manage your cookie preferences</h2>
            <p className="text-sm leading-7 text-muted">
              You can update your choice here at any time. This page updates the backend consent cookie used by the site.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-panel p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Current setting</p>
              <p className="mt-2 text-base font-semibold text-strong">{consentLabel}</p>
            </div>
            <div className="rounded-2xl border border-border bg-panel p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Last updated</p>
              <p className="mt-2 text-base font-semibold text-strong">{lastUpdatedLabel}</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              className="btn-ghost"
              disabled={!isReady || isSaving}
              onClick={() => void declineAnalytics()}
            >
              {isSaving && !consent.analytics ? 'Saving...' : 'Use necessary only'}
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={!isReady || isSaving}
              onClick={() => void acceptAnalytics()}
            >
              {isSaving && consent.analytics ? 'Saving...' : 'Enable analytics'}
            </button>
          </div>

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          {!isReady ? <p className="text-sm text-muted">Loading your saved preference...</p> : null}
        </div>
      </div>

      <div className="grid gap-4">
        {cookieTypes.map((cookieType) => (
          <article key={cookieType.title} className="surface p-6 sm:p-7">
            <div className="space-y-3">
              <h2 className="heading-2">{cookieType.title}</h2>
              <p className="text-sm leading-7 text-muted">{cookieType.body}</p>
            </div>
          </article>
        ))}
      </div>

      <div className="surface p-6 sm:p-7">
        <div className="space-y-3">
          <h2 className="heading-2">Managing Cookies</h2>
          <p className="text-sm leading-7 text-muted">
            You can clear or block cookies from your browser settings. If you do, sign-in persistence and other convenience features may reset or stop working until the required storage is available again.
          </p>
        </div>
      </div>
    </section>
  )
}
