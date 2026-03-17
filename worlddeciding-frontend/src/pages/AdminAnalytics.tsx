import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getGoogleAnalyticsMeasurementId, trackGoogleAnalyticsPageView } from '@/app/analytics'
import { useCookieConsent } from '@/app/consent'

type AnalyticsSnapshot = {
  hasMeasurementId: boolean
  hasScript: boolean
  hasGtag: boolean
  queuedEvents: number
  recentEntries: string[]
}

function readAnalyticsSnapshot(): AnalyticsSnapshot {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return {
      hasMeasurementId: false,
      hasScript: false,
      hasGtag: false,
      queuedEvents: 0,
      recentEntries: [],
    }
  }

  const entries = Array.isArray(window.dataLayer) ? window.dataLayer : []
  const recentEntries = entries
    .slice(-5)
    .reverse()
    .map((entry) => {
      try {
        return JSON.stringify(entry)
      } catch {
        return '[unserializable entry]'
      }
    })

  return {
    hasMeasurementId: Boolean(getGoogleAnalyticsMeasurementId()),
    hasScript: Boolean(document.getElementById('worlddeciding-ga4')),
    hasGtag: typeof window.gtag === 'function',
    queuedEvents: entries.length,
    recentEntries,
  }
}

export default function AdminAnalytics() {
  const { consent } = useCookieConsent()
  const [snapshot, setSnapshot] = useState<AnalyticsSnapshot>(() => readAnalyticsSnapshot())
  const measurementId = getGoogleAnalyticsMeasurementId()

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSnapshot(readAnalyticsSnapshot())
    }, 1500)

    return () => window.clearInterval(timer)
  }, [])

  const consentLabel = useMemo(() => {
    if (consent.status === 'pending') return 'Pending'
    return consent.analytics ? 'Analytics allowed' : 'Necessary only'
  }, [consent.analytics, consent.status])

  const lastUpdated = useMemo(() => {
    if (!consent.updatedAt) return 'No saved timestamp'

    return new Intl.DateTimeFormat('en', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(consent.updatedAt))
  }, [consent.updatedAt])

  const sendTestPageView = () => {
    trackGoogleAnalyticsPageView('/admin/analytics/manual-test')
    setSnapshot(readAnalyticsSnapshot())
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-body space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <h1 className="heading-1">GA4 Analytics</h1>
              <p className="text-sm text-muted">
                This is a simple GA4 diagnostics page for the frontend. It shows whether tracking is configured and whether this browser is currently allowed to send analytics.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setSnapshot(readAnalyticsSnapshot())}
              >
                Refresh diagnostics
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={!measurementId || !consent.analytics}
                onClick={sendTestPageView}
              >
                Send test page_view
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="card">
          <div className="card-body space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Measurement ID</p>
            <p className="text-lg font-semibold text-strong">{measurementId || 'Missing'}</p>
          </div>
        </div>

        <div className="card">
          <div className="card-body space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Consent</p>
            <p className="text-lg font-semibold text-strong">{consentLabel}</p>
            <p className="text-xs text-muted">{lastUpdated}</p>
          </div>
        </div>

        <div className="card">
          <div className="card-body space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">GA Script</p>
            <p className="text-lg font-semibold text-strong">{snapshot.hasScript ? 'Loaded' : 'Not loaded'}</p>
            <p className="text-xs text-muted">gtag: {snapshot.hasGtag ? 'Ready' : 'Unavailable'}</p>
          </div>
        </div>

        <div className="card">
          <div className="card-body space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Queued events</p>
            <p className="text-lg font-semibold text-strong">{snapshot.queuedEvents}</p>
            <p className="text-xs text-muted">Local dataLayer length</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="card">
          <div className="card-body space-y-3">
            <h2 className="heading-2">Recent dataLayer entries</h2>
            {snapshot.recentEntries.length === 0 ? (
              <p className="text-sm text-muted">No dataLayer entries have been queued in this browser yet.</p>
            ) : (
              <div className="space-y-2">
                {snapshot.recentEntries.map((entry, index) => (
                  <pre
                    key={`ga-entry-${index}`}
                    className="overflow-x-auto rounded-2xl border border-border bg-[rgba(248,251,255,0.75)] p-3 text-xs text-muted"
                  >
                    {entry}
                  </pre>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-body space-y-3">
            <h2 className="heading-2">Quick checks</h2>
            <ul className="space-y-2 text-sm text-muted">
              <li>Analytics only sends when the browser consent is enabled.</li>
              <li>`Send test page_view` pushes a manual page view into GA4 from this screen.</li>
              <li>If the measurement ID is missing, no GA4 script will load.</li>
            </ul>

            <div className="pt-2">
              <Link to="/cookies" className="btn-ghost">
                Open cookie settings
              </Link>
            </div>

            <a
              href="https://analytics.google.com/analytics/web/"
              target="_blank"
              rel="noreferrer"
              className="btn-link text-sm"
            >
              Open Google Analytics dashboard
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
