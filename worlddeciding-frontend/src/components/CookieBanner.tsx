import { Link } from 'react-router-dom'
import { useCookieConsent } from '@/app/consent'

export default function CookieBanner() {
  const { isPending, isReady, isSaving, error, acceptAnalytics, declineAnalytics } = useCookieConsent()

  if (!isReady || !isPending) {
    return null
  }

  return (
    <div className="cookie-banner pointer-events-none fixed inset-x-0 bottom-4 z-[90] px-4">
      <div className="cookie-banner-inner container-page">
        <section className="cookie-banner-card surface pointer-events-auto mx-auto max-w-4xl p-5 sm:p-6">
          <div className="cookie-banner-layout flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="cookie-banner-copy space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">Cookies</p>
              <h2 className="heading-2">We use essential cookies and optional analytics.</h2>
              <p className="max-w-2xl text-sm leading-7 text-muted">
                Essential storage keeps sign-in and core app features working. Analytics is only enabled if you allow it.
                Your choice is saved through the backend `wd_consent` cookie. You can review the details on the{' '}
                <Link to="/privacy" className="font-semibold text-strong underline underline-offset-2">
                  privacy
                </Link>{' '}
                and{' '}
                <Link to="/cookies" className="font-semibold text-strong underline underline-offset-2">
                  cookies
                </Link>{' '}
                pages.
              </p>
              {error ? <p className="text-sm text-rose-500">{error}</p> : null}
            </div>

            <div className="cookie-banner-actions flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={() => void declineAnalytics()} className="btn-ghost" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Only necessary'}
              </button>
              <button type="button" onClick={() => void acceptAnalytics()} className="btn-primary" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Accept analytics'}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
