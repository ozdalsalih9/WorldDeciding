import { createContext, useCallback, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

type ToastVariant = 'success' | 'error' | 'info'

type Toast = {
  id: string
  message: string
  variant: ToastVariant
}

type ToastInput = {
  message: string
  variant?: ToastVariant
  durationMs?: number
}

type ToastContextValue = {
  notify: (input: ToastInput) => void
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

type Props = {
  children: ReactNode
}

const DEFAULT_DURATION = 3500

export default function ToastProvider({ children }: Props) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
    setToasts(prev => prev.filter(item => item.id !== id))
  }, [])

  const notify = useCallback(({ message, variant = 'info', durationMs }: ToastInput) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setToasts(prev => [...prev, { id, message, variant }])
    const timeout = setTimeout(() => dismiss(id), durationMs ?? DEFAULT_DURATION)
    timers.current.set(id, timeout)
  }, [dismiss])

  const value = useMemo(() => ({ notify, dismiss }), [dismiss, notify])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-viewport" role="status" aria-live="polite">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast toast-${toast.variant}`}>
            <div className="toast-icon" aria-hidden>
              {toast.variant === 'success' ? 'OK' : toast.variant === 'error' ? '!' : 'i'}
            </div>
            <div className="toast-message">{toast.message}</div>
            <button type="button" className="toast-close" onClick={() => dismiss(toast.id)}>
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export { ToastContext }
