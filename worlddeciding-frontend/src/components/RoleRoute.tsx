import { Navigate, Outlet, useLocation } from 'react-router-dom'
import useAuth from '@/features/auth'

type Props = { roles?: string[] }

export default function RoleRoute({ roles = [] }: Props) {
  const { isAuthenticated, isAuthHydrated, roles: userRoles } = useAuth()
  const loc = useLocation()

  if (!isAuthHydrated) return null
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: loc }} />
  if (roles.length > 0 && !roles.some(r => userRoles.includes(r))) {
    return <Navigate to="/forbidden" replace />
  }
  return <Outlet />
}
