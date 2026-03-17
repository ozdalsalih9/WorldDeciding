import { useContext } from 'react'
import { ToastContext } from './ToastProvider'

export default function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }

  const { notify, dismiss } = context

  return {
    notify,
    dismiss,
    success: (message: string, durationMs?: number) =>
      notify({ message, variant: 'success', durationMs }),
    error: (message: string, durationMs?: number) =>
      notify({ message, variant: 'error', durationMs }),
    info: (message: string, durationMs?: number) =>
      notify({ message, variant: 'info', durationMs }),
  }
}
