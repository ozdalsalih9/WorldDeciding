import Axios from 'axios'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { syncGoogleAnalyticsConsent } from '@/app/analytics'
import api from '@/shared/api/client'

type ConsentStatus = 'pending' | 'accepted' | 'rejected'

type PrivacyConsentResponse = {
  necessary?: boolean
  analytics?: boolean
  marketing?: boolean
  ts?: number
}

export type CookieConsent = {
  analytics: boolean
  marketing: boolean
  necessary: true
  status: ConsentStatus
  updatedAt: string | null
}

type CookieConsentContextValue = {
  consent: CookieConsent
  acceptAnalytics: () => Promise<void>
  declineAnalytics: () => Promise<void>
  isPending: boolean
  isReady: boolean
  isSaving: boolean
  error: string | null
}

const defaultConsent: CookieConsent = {
  analytics: false,
  marketing: false,
  necessary: true,
  status: 'pending',
  updatedAt: null,
}

const CookieConsentContext = createContext<CookieConsentContextValue | null>(null)

function toCookieConsent(payload: PrivacyConsentResponse | null | undefined): CookieConsent {
  if (!payload) {
    return defaultConsent
  }

  const analytics = payload.analytics === true
  const marketing = payload.marketing === true
  const hasOptionalConsent = analytics || marketing

  return {
    analytics,
    marketing,
    necessary: true,
    status: hasOptionalConsent ? 'accepted' : 'rejected',
    updatedAt: typeof payload.ts === 'number' ? new Date(payload.ts * 1000).toISOString() : null,
  }
}

async function fetchConsentFromServer() {
  try {
    const response = await api.get<PrivacyConsentResponse>('/api/privacy/consent', {
      withCredentials: true,
    })

    return toCookieConsent(response.data)
  } catch (error) {
    if (Axios.isAxiosError(error) && error.response?.status === 404) {
      return defaultConsent
    }

    throw error
  }
}

async function pushConsentToServer(analytics: boolean, marketing: boolean) {
  const response = await api.post<PrivacyConsentResponse>(
    '/api/privacy/consent',
    {
      Analytics: analytics,
      Marketing: marketing,
    },
    {
      withCredentials: true,
    }
  )

  return toCookieConsent(response.data)
}

type Props = {
  children: ReactNode
}

export function CookieConsentProvider({ children }: Props) {
  const [consent, setConsent] = useState<CookieConsent>(defaultConsent)
  const [isReady, setIsReady] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    syncGoogleAnalyticsConsent(consent.analytics)
  }, [consent.analytics])

  useEffect(() => {
    let isMounted = true

    const hydrateConsent = async () => {
      try {
        const nextConsent = await fetchConsentFromServer()

        if (!isMounted) {
          return
        }

        setConsent(nextConsent)
        setError(null)
      } catch {
        if (!isMounted) {
          return
        }

        setError('Cookie preferences could not be loaded.')
      } finally {
        if (isMounted) {
          setIsReady(true)
        }
      }
    }

    void hydrateConsent()

    return () => {
      isMounted = false
    }
  }, [])

  const saveConsent = async (analytics: boolean, marketing: boolean) => {
    setIsSaving(true)
    setError(null)

    try {
      const nextConsent = await pushConsentToServer(analytics, marketing)
      setConsent(nextConsent)
    } catch {
      setError('Cookie preferences could not be saved. Check CORS/credentials if API is on another origin.')
    } finally {
      setIsSaving(false)
      setIsReady(true)
    }
  }

  return (
    <CookieConsentContext.Provider
      value={{
        consent,
        acceptAnalytics: () => saveConsent(true, false),
        declineAnalytics: () => saveConsent(false, false),
        isPending: consent.status === 'pending',
        isReady,
        isSaving,
        error,
      }}
    >
      {children}
    </CookieConsentContext.Provider>
  )
}

export function useCookieConsent() {
  const context = useContext(CookieConsentContext)

  if (!context) {
    throw new Error('useCookieConsent must be used within a CookieConsentProvider')
  }

  return context
}
