import { create } from 'zustand'
import api, { authNoRefreshConfig, setAccessToken } from '@/shared/api/client'

type AuthClientError = Error & {
  responseData?: Record<string, unknown>
  suggestedCountryCode?: string
}

type AuthState = {
  token: string | null
  roles: string[]
  isAuthenticated: boolean
  isAdmin: boolean
  isAuthHydrated: boolean
  hydrateSession: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  confirmEmail: (payload: { userId: string; token: string }) => Promise<void>
  resendConfirmationEmail: (email: string) => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
  resetPassword: (payload: {
    email: string
    token: string
    newPassword: string
    confirmNewPassword: string
  }) => Promise<void>
  logout: () => Promise<void>
  register: (payload: {
    email: string
    password: string
    countryCode: string
    birthDate: string
    gender: number
  }) => Promise<void>
}

function decodeRolesFromJwt(token: string | null): string[] {
  if (!token) return []
  try {
    const part = token.split('.')[1]
    if (!part) return []
    // base64url -> base64
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    const json = typeof atob !== 'undefined' ? atob(padded) : Buffer.from(padded, 'base64').toString('utf-8')
    const payload = JSON.parse(json)
    const result = new Set<string>()
    const keys = [
      'role',
      'roles',
      'http://schemas.microsoft.com/ws/2008/06/identity/claims/role',
    ]
    for (const k of keys) {
      const val = payload?.[k]
      if (!val) continue
      if (Array.isArray(val)) val.forEach((r: any) => typeof r === 'string' && result.add(r))
      else if (typeof val === 'string') result.add(val)
    }
    return Array.from(result)
  } catch {
    return []
  }
}

function extractApiErrorMessage(error: any): string | null {
  const data = error?.response?.data
  if (!data) return error?.message ?? null
  if (typeof data === 'string') return data
  const directMessage =
    data?.message ||
    data?.title ||
    data?.error ||
    data?.detail ||
    null
  if (typeof directMessage === 'string' && directMessage.trim()) {
    return directMessage
  }
  const errors = data?.errors
  if (errors && typeof errors === 'object') {
    const collected = Object.values(errors)
      .flatMap((value: any) => (Array.isArray(value) ? value : [value]))
      .filter((value: any) => typeof value === 'string' && value.trim())
    if (collected.length) {
      return collected.join(' ')
    }
  }
  return error?.message ?? null
}

function mapLoginError(error: any): string {
  const raw = extractApiErrorMessage(error) || 'Login failed.'
  return raw.trim() || 'Login failed.'
}

let hydrateSessionPromise: Promise<void> | null = null

function createSignedOutState(): Pick<AuthState, 'token' | 'roles' | 'isAuthenticated' | 'isAdmin' | 'isAuthHydrated'> {
  setAccessToken(null)
  return {
    token: null,
    roles: [],
    isAuthenticated: false,
    isAdmin: false,
    isAuthHydrated: true,
  }
}

function clearAuthState(set: (partial: Partial<AuthState>) => void) {
  set(createSignedOutState())
}

const useAuth = create<AuthState>((set, get) => ({
  token: null,
  roles: [],
  isAuthenticated: false,
  isAdmin: false,
  isAuthHydrated: false,

  hydrateSession: async () => {
    if (get().isAuthHydrated) return
    if (hydrateSessionPromise) return hydrateSessionPromise
    hydrateSessionPromise = (async () => {
      try {
        const res = await api.post('/api/auth/refresh', undefined, { withCredentials: true })
        const accessToken = (res as any)?.data?.accessToken ?? null
        if (!accessToken) {
          throw new Error('Refresh response missing access token')
        }
        const roles = decodeRolesFromJwt(accessToken)
        setAccessToken(accessToken)
        set({
          token: accessToken,
          roles,
          isAuthenticated: true,
          isAdmin: roles.includes('Admin'),
          isAuthHydrated: true,
        })
      } catch {
        set(createSignedOutState())
      } finally {
        hydrateSessionPromise = null
      }
    })()
    await hydrateSessionPromise
  },

  login: async (email, password) => {
    try {
      const res = await api.post('/api/auth/login', { email, password }, authNoRefreshConfig)
      const accessToken = (res as any)?.data?.accessToken ?? (res as any)?.data?.token
      if (!accessToken) throw new Error('Token not found in response')
      const roles = decodeRolesFromJwt(accessToken)
      setAccessToken(accessToken)
      set({
        token: accessToken,
        roles,
        isAuthenticated: true,
        isAdmin: roles.includes('Admin'),
        isAuthHydrated: true,
      })
    } catch (error: any) {
      throw new Error(mapLoginError(error))
    }
  },

  register: async (payload) => {
    try {
      await api.post('/api/auth/register', payload, authNoRefreshConfig)
    } catch (error: any) {
      const message = extractApiErrorMessage(error)
      const authError = new Error(message || 'Sign up failed.') as AuthClientError
      const responseData = error?.response?.data
      if (responseData && typeof responseData === 'object') {
        authError.responseData = responseData
        if (typeof responseData.suggestedCountryCode === 'string') {
          authError.suggestedCountryCode = responseData.suggestedCountryCode.trim().toUpperCase()
        }
      }
      throw authError
    }
  },

  confirmEmail: async ({ userId, token }) => {
    try {
      await api.post('/api/auth/confirm-email', { userId, token }, authNoRefreshConfig)
    } catch (error: any) {
      const message = extractApiErrorMessage(error)
      throw new Error(message || 'Email confirmation failed.')
    }
  },

  resendConfirmationEmail: async (email) => {
    try {
      await api.post('/api/auth/resend-confirmation', { email }, authNoRefreshConfig)
    } catch (error: any) {
      const message = extractApiErrorMessage(error)
      throw new Error(message || 'Could not resend confirmation email.')
    }
  },

  requestPasswordReset: async (email) => {
    try {
      await api.post('/api/auth/forgot-password', { email }, authNoRefreshConfig)
    } catch (error: any) {
      const message = extractApiErrorMessage(error)
      throw new Error(message || 'Could not send reset email.')
    }
  },

  resetPassword: async ({ email, token, newPassword, confirmNewPassword }) => {
    try {
      await api.post('/api/auth/reset-password', {
        email,
        token,
        newPassword,
        confirmNewPassword,
      }, authNoRefreshConfig)
    } catch (error: any) {
      const message = extractApiErrorMessage(error)
      throw new Error(message || 'Password reset failed.')
    }
  },

  logout: async () => {
    try {
      await api.post('/api/auth/logout', undefined, { withCredentials: true })
    } finally {
      clearAuthState(set)
    }
  },
}))

export default useAuth
