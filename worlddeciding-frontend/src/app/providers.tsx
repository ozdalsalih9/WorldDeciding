import React, { useEffect } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from '@/shared/ui/toast'
import { CookieConsentProvider } from '@/app/consent'
import CookieBanner from '@/components/CookieBanner'
import useAuth from '@/features/auth'

const queryClient = new QueryClient()

type Props = { children: React.ReactNode }

function AuthBootstrap() {
  const hydrateSession = useAuth(state => state.hydrateSession)

  useEffect(() => {
    void hydrateSession()
  }, [hydrateSession])

  return null
}

export default function AppProviders({ children }: Props) {
  return (
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthBootstrap />
          <ToastProvider>
            <CookieConsentProvider>
              {children}
              <CookieBanner />
            </CookieConsentProvider>
          </ToastProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </React.StrictMode>
  )
}
