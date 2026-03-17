declare global {
  interface Window {
    dataLayer?: unknown[][]
    gtag?: (...args: unknown[]) => void
  }
}

const SCRIPT_ID = 'worlddeciding-ga4'
const DEFAULT_MEASUREMENT_ID = 'G-FJG7D6KTKY'
let isConfigured = false

export function getGoogleAnalyticsMeasurementId() {
  return import.meta.env.VITE_GA_MEASUREMENT_ID?.trim() || DEFAULT_MEASUREMENT_ID
}

function getDisableKey(measurementId: string) {
  return `ga-disable-${measurementId}`
}

function setDisabledState(measurementId: string, disabled: boolean) {
  ;(window as unknown as Record<string, boolean | undefined>)[getDisableKey(measurementId)] = disabled
}

function isDisabled(measurementId: string) {
  return (window as unknown as Record<string, boolean | undefined>)[getDisableKey(measurementId)] === true
}

function ensureGtag() {
  if (typeof window === 'undefined') return

  window.dataLayer = window.dataLayer || []

  if (!window.gtag) {
    window.gtag = (...args: unknown[]) => {
      window.dataLayer?.push(args)
    }
  }
}

function injectScript(measurementId: string) {
  if (typeof document === 'undefined') return
  if (document.getElementById(SCRIPT_ID)) return

  const script = document.createElement('script')
  script.id = SCRIPT_ID
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`
  document.head.appendChild(script)
}

export function syncGoogleAnalyticsConsent(enabled: boolean) {
  const measurementId = getGoogleAnalyticsMeasurementId()

  if (!measurementId || typeof window === 'undefined') {
    return false
  }

  setDisabledState(measurementId, !enabled)

  if (!enabled) {
    if (window.gtag) {
      window.gtag('consent', 'update', {
        analytics_storage: 'denied',
      })
    }

    return false
  }

  ensureGtag()
  injectScript(measurementId)

  if (!isConfigured) {
    window.gtag?.('js', new Date())
    window.gtag?.('consent', 'default', {
      analytics_storage: 'granted',
    })
    window.gtag?.('config', measurementId, {
      anonymize_ip: true,
      send_page_view: false,
    })
    isConfigured = true
  } else {
    window.gtag?.('consent', 'update', {
      analytics_storage: 'granted',
    })
  }

  return true
}

export function trackGoogleAnalyticsPageView(path: string) {
  const measurementId = getGoogleAnalyticsMeasurementId()

  if (!measurementId || typeof window === 'undefined' || !window.gtag) {
    return
  }

  if (isDisabled(measurementId)) {
    return
  }

  window.gtag('event', 'page_view', {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
    send_to: measurementId,
  })
}
