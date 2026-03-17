import { Navigate, Outlet, useLocation } from 'react-router-dom'
import useAuth from '@/features/auth'

export default function ProtectedRoute() {
  const { isAuthenticated, isAuthHydrated } = useAuth()
  const loc = useLocation()
  if (!isAuthHydrated) return null
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: loc }} />
  return <Outlet />
}
