import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import useAuth from '@/features/auth'
import { useToast } from '@/shared/ui/toast'
import worldDecidingLogo from '@/shared/logo/worlddeciding.png'

const worldDecidingWordmark = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="230" height="42" viewBox="0 0 230 42" fill="none">
  <rect width="230" height="42" rx="21" fill="rgba(255,255,255,0.01)"/>
  <text x="0" y="29" fill="#0B1726" font-family="Space Grotesk, Arial, sans-serif" font-size="24" font-weight="700" letter-spacing="0.2">WorldDeciding</text>
</svg>
`)}`

export default function Navbar() {
  const { isAuthenticated, isAdmin, isAuthHydrated, logout } = useAuth()
  const toast = useToast()
  const location = useLocation()
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    setIsOpen(false)
  }, [location.pathname])

  return (
    <nav className="global-nav sticky top-0 z-[70] pt-2 sm:pt-3">
      <div className="container-page">
        <div className="global-nav-shell">
          <span className="global-nav-strike" aria-hidden />
          <div className="global-nav-main">
            <Link to="/" className="global-brand">
              <img src={worldDecidingLogo} alt="WorldDeciding logo" className="global-brand-logo" />
              <img
                src={worldDecidingWordmark}
                alt="WorldDeciding"
                className="global-brand-wordmark"
                draggable="false"
              />
            </Link>

            <div className="global-nav-links hidden md:flex">
              <NavLink to="/" className={({ isActive }) => `nav-link-slim ${isActive ? 'nav-link-slim-active' : ''}`}>Home</NavLink>
              <NavLink to="/questions" className={({ isActive }) => `nav-link-slim ${isActive ? 'nav-link-slim-active' : ''}`}>Questions</NavLink>
              <NavLink to="/leaderboard" className={({ isActive }) => `nav-link-slim ${isActive ? 'nav-link-slim-active' : ''}`}>Leaderboard</NavLink>
              <NavLink to="/categories" className={({ isActive }) => `nav-link-slim ${isActive ? 'nav-link-slim-active' : ''}`}>Categories</NavLink>
              <NavLink to="/binary" className={({ isActive }) => `nav-link-slim ${isActive ? 'nav-link-slim-active' : ''}`}>Either / Or</NavLink>
              {isAdmin ? (
                <NavLink to="/admin" className={({ isActive }) => `nav-link-slim ${isActive ? 'nav-link-slim-active' : ''}`}>Admin</NavLink>
              ) : null}
            </div>

            <div className="global-nav-actions hidden md:flex">
              {!isAuthHydrated ? null : isAuthenticated ? (
                <>
                  <Link to="/profile" className="global-nav-cta">Profile</Link>
                  <button
                    onClick={() => {
                      void logout()
                      toast.info('Signed out.')
                    }}
                    className="global-nav-cta global-nav-cta-strong"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" className="global-nav-cta">Login</Link>
                  <Link to="/register" className="global-nav-cta global-nav-cta-strong">Register</Link>
                </>
              )}
            </div>

            <button
              type="button"
              aria-label="Toggle navigation"
              aria-expanded={isOpen}
              onClick={() => setIsOpen((prev) => !prev)}
              className={`global-nav-toggle md:hidden ${isOpen ? 'is-open' : ''}`}
            >
              <span className="sr-only">Toggle menu</span>
              <span className="flex h-4 w-5 flex-col justify-between">
                <span className={`h-0.5 w-full rounded-full bg-[var(--text-strong)] transition ${isOpen ? 'translate-y-[6px] rotate-45' : ''}`} />
                <span className={`h-0.5 w-full rounded-full bg-[var(--text-strong)] transition ${isOpen ? 'opacity-0' : ''}`} />
                <span className={`h-0.5 w-full rounded-full bg-[var(--text-strong)] transition ${isOpen ? '-translate-y-[6px] -rotate-45' : ''}`} />
              </span>
            </button>
          </div>

          <div className={`global-nav-mobile md:hidden ${isOpen ? 'is-open' : ''}`}>
            <div className="global-nav-mobile-inner">
              <div className="global-nav-mobile-grid">
                <NavLink to="/" className={({ isActive }) => `nav-link-slim ${isActive ? 'nav-link-slim-active' : ''}`} onClick={() => setIsOpen(false)}>Home</NavLink>
                <NavLink to="/questions" className={({ isActive }) => `nav-link-slim ${isActive ? 'nav-link-slim-active' : ''}`} onClick={() => setIsOpen(false)}>Questions</NavLink>
                <NavLink to="/leaderboard" className={({ isActive }) => `nav-link-slim ${isActive ? 'nav-link-slim-active' : ''}`} onClick={() => setIsOpen(false)}>Leaderboard</NavLink>
                <NavLink to="/categories" className={({ isActive }) => `nav-link-slim ${isActive ? 'nav-link-slim-active' : ''}`} onClick={() => setIsOpen(false)}>Categories</NavLink>
                <NavLink to="/binary" className={({ isActive }) => `nav-link-slim ${isActive ? 'nav-link-slim-active' : ''}`} onClick={() => setIsOpen(false)}>Either / Or</NavLink>
                {isAdmin ? (
                  <NavLink to="/admin" className={({ isActive }) => `nav-link-slim ${isActive ? 'nav-link-slim-active' : ''}`} onClick={() => setIsOpen(false)}>Admin</NavLink>
                ) : null}
              </div>

              <div className="global-nav-mobile-actions">
                {!isAuthHydrated ? null : isAuthenticated ? (
                  <>
                    <Link to="/profile" className="global-nav-cta" onClick={() => setIsOpen(false)}>Profile</Link>
                    <button
                      onClick={() => {
                        void logout()
                        toast.info('Signed out.')
                        setIsOpen(false)
                      }}
                      className="global-nav-cta global-nav-cta-strong"
                    >
                      Logout
                    </button>
                  </>
                ) : (
                  <>
                    <Link to="/login" className="global-nav-cta" onClick={() => setIsOpen(false)}>Login</Link>
                    <Link to="/register" className="global-nav-cta global-nav-cta-strong" onClick={() => setIsOpen(false)}>Register</Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}
