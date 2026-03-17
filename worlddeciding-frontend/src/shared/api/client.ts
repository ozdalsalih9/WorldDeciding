import Axios from 'axios'

let accessTokenMemory: string | null = null

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

// In dev: use Vite proxy via relative '/api' calls (baseURL empty).
// In prod: use explicit API base from env.
const api = Axios.create({
  baseURL: import.meta.env.DEV ? '' : (import.meta.env.VITE_API_BASE || ''),
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
  baseURL: import.meta.env.DEV ? '' : (import.meta.env.VITE_API_BASE || ''),
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
    const originalRequest = error?.config
    const status = error?.response?.status
    const isRefreshRequest = originalRequest?.url?.includes('/api/auth/refresh')

    if (status !== 401 || !originalRequest || isRefreshRequest) {
      return Promise.reject(error)
    }

    const retryFlag = (originalRequest as any)._retry
    if (retryFlag) {
      return Promise.reject(error)
    }
    ;(originalRequest as any)._retry = true

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

export default api
