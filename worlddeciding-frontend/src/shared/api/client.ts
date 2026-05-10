import Axios from 'axios'
import type { AxiosRequestConfig } from 'axios'

let accessTokenMemory: string | null = null

type RefreshAwareRequestConfig = AxiosRequestConfig & {
  skipAuthRefresh?: boolean
  _retry?: boolean
}

const AUTH_REFRESH_EXCLUDED_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/confirm-email',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/resend-confirmation',
  '/api/auth/access-status',
  '/api/auth/register-country',
])

export function setAccessToken(token: string | null) {
  if (!token || token === 'undefined' || token === 'null') {
    accessTokenMemory = null
    return
  }
  accessTokenMemory = token
}

export function getAccessToken() {
  return accessTokenMemory
}

function extractRequestPath(url: string | undefined) {
  if (!url) return ''

  try {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return new URL(url).pathname
    }
  } catch {
    return url
  }

  return url.startsWith('/') ? url : `/${url}`
}

function shouldSkipRefresh(config: RefreshAwareRequestConfig | undefined) {
  if (!config) return true
  if (config.skipAuthRefresh === true) return true

  const requestPath = extractRequestPath(config.url)
  if (AUTH_REFRESH_EXCLUDED_PATHS.has(requestPath)) return true
  if (requestPath === '/api/auth/refresh') return true
  if (!getAccessToken()) return true

  return false
}

// Behind Caddy in production, the frontend should call the same origin by default.
// `VITE_API_BASE` remains available for deployments that need an explicit API host.
const api = Axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '',
  withCredentials: true,
})

api.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

const refreshClient = Axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '',
  withCredentials: true,
})

let isRefreshing = false
let refreshQueue: Array<(token: string | null) => void> = []

function resolveRefreshQueue(token: string | null) {
  refreshQueue.forEach((cb) => cb(token))
  refreshQueue = []
}

api.interceptors.response.use(
  (response) => {
    const url = response?.config?.url ?? ''
    const isApiRequest = url.includes('/api/')
    if (!isApiRequest) return response

    const contentTypeHeader = response?.headers?.['content-type']
    const contentType = Array.isArray(contentTypeHeader)
      ? contentTypeHeader.join(';')
      : String(contentTypeHeader ?? '')
    const body = typeof response?.data === 'string' ? response.data.trimStart().toLowerCase() : ''
    const looksLikeHtml =
      typeof response?.data === 'string' &&
      (contentType.includes('text/html') || body.startsWith('<!doctype html') || body.startsWith('<html'))

    if (looksLikeHtml) {
      throw new Error('Invalid API response: received HTML instead of JSON. Check API proxy/base URL.')
    }

    return response
  },
  async (error) => {
    const originalRequest = error?.config as RefreshAwareRequestConfig | undefined
    const status = error?.response?.status

    if (status !== 401 || !originalRequest || shouldSkipRefresh(originalRequest)) {
      return Promise.reject(error)
    }

    const retryFlag = originalRequest._retry
    if (retryFlag) {
      return Promise.reject(error)
    }
    originalRequest._retry = true

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshQueue.push((token) => {
          if (!token) {
            reject(error)
            return
          }
          originalRequest.headers = originalRequest.headers ?? {}
          originalRequest.headers.Authorization = `Bearer ${token}`
          resolve(api(originalRequest))
        })
      })
    }

    isRefreshing = true
    try {
      const refreshRes = await refreshClient.post('/api/auth/refresh', undefined, {
        withCredentials: true,
      })
      const newAccessToken = refreshRes?.data?.accessToken
      if (!newAccessToken) {
        throw new Error('Refresh response missing access token')
      }

      setAccessToken(newAccessToken)
      resolveRefreshQueue(newAccessToken)

      originalRequest.headers = originalRequest.headers ?? {}
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
      return api(originalRequest)
    } catch (refreshError) {
      setAccessToken(null)
      resolveRefreshQueue(null)
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  }
)

export const authNoRefreshConfig: RefreshAwareRequestConfig = {
  skipAuthRefresh: true,
}

export default api
