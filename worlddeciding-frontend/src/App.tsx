import { Suspense, lazy, useEffect, useState } from 'react'
import { Routes, Route, Navigate, useLocation, Link } from 'react-router-dom'
import Navbar from '@/widgets/navbar'
import worldDecidingLogo from '@/shared/logo/worlddeciding.png'
import RoleRoute from '@/components/RoleRoute'
import { useCookieConsent } from '@/app/consent'
import { trackGoogleAnalyticsPageView } from '@/app/analytics'
import api, { authNoRefreshConfig } from '@/shared/api/client'

const Home = lazy(() => import('./pages/Home'))
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'))
const Questions = lazy(() => import('./pages/QuestionsImproved'))
const QuestionDetail = lazy(() => import('./pages/QuestionDetail'))
const CategoriesPage = lazy(() => import('./pages/Categories'))
const CategoryQuestionsPage = lazy(() => import('./pages/CategoryQuestions'))
const BinaryQuestions = lazy(() => import('./pages/BinaryQuestions'))
const Leaderboard = lazy(() => import('./pages/Leaderboard'))
const Profile = lazy(() => import('./pages/Profile'))
const PublicProfile = lazy(() => import('./pages/PublicProfile'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const AdminQuestions = lazy(() => import('./pages/AdminQuestions'))
const AdminQuestionImport = lazy(() => import('./pages/AdminQuestionImport'))
const AdminQuestionDetail = lazy(() => import('./pages/AdminQuestionDetail'))
const AdminCategories = lazy(() => import('./pages/AdminCategories'))
const AdminAnalytics = lazy(() => import('./pages/AdminAnalytics'))
const Forbidden = lazy(() => import('./pages/Forbidden'))
const Privacy = lazy(() => import('./pages/Privacy'))
const Cookies = lazy(() => import('./pages/Cookies'))
const QuestionStatsPage = lazy(() => import('./pages/QuestionStats'))

function RouteFallback() {
  return <div className="surface p-6 text-sm text-muted">Loading...</div>
}

type SiteAccessStatus = {
  allowed?: boolean
  countryCode?: string | null
  countryName?: string | null
  confidence?: number
  geoProvider?: string
  vpnBlocked?: boolean
  riskReason?: string | null
  vpnProvider?: string
  message?: string | null
}

export default function App() {
  const location = useLocation()
  const { consent } = useCookieConsent()
  const [siteAccess, setSiteAccess] = useState<SiteAccessStatus | null>(null)
  const [siteAccessError, setSiteAccessError] = useState(false)
  const isAuthPage =
    location.pathname === '/login' ||
    location.pathname === '/register' ||
    location.pathname === '/reset-password'
  const isHomePage = location.pathname === '/'
  const isQuestionDetailPage = /^\/questions\/[^/]+$/.test(location.pathname)
  const isProfilePage = location.pathname === '/profile' || /^\/profile\/[^/]+$/.test(location.pathname)
  const isFullBleedPage = isHomePage || isQuestionDetailPage
  const mainLayoutClass = isAuthPage
    ? 'py-10'
    : isFullBleedPage
      ? 'pt-0 pb-0'
      : isProfilePage
        ? 'pt-10 pb-8'
        : 'pt-10 pb-0'

  useEffect(() => {
    if (!consent.analytics) {
      return
    }

    const pagePath = `${location.pathname}${location.search}${location.hash}`
    trackGoogleAnalyticsPageView(pagePath)
  }, [consent.analytics, location.hash, location.pathname, location.search])

  useEffect(() => {
    let ignore = false

    const checkAccess = async () => {
      try {
        const res = await api.get<SiteAccessStatus>('/api/auth/access-status', authNoRefreshConfig)
        if (!ignore) {
          setSiteAccess(res.data ?? { allowed: true })
          setSiteAccessError(false)
        }
      } catch {
        if (!ignore) {
          setSiteAccess({ allowed: true })
          setSiteAccessError(true)
        }
      }
    }

    void checkAccess()

    return () => {
      ignore = true
    }
  }, [])

  const isAccessBlocked = siteAccess?.allowed === false || siteAccess?.vpnBlocked === true
  const estimatedCountry =
    siteAccess?.countryName && siteAccess?.countryCode
      ? `${siteAccess.countryName} (${siteAccess.countryCode})`
      : siteAccess?.countryCode ?? 'Unknown'

  if (siteAccess === null && !siteAccessError) {
    return (
      <div className="app-shell">
        <div className="app-backdrop">
          <span className="app-aurora one" />
          <span className="app-aurora two" />
          <span className="app-aurora three" />
          <span className="app-grid" />
        </div>
        <main className="access-status-shell">
          <section className="access-status-card">
            <p className="section-heading">Connection check</p>
            <h1>Checking access</h1>
            <p>Verifying connection security before loading WorldDeciding.</p>
          </section>
        </main>
      </div>
    )
  }

  if (isAccessBlocked) {
    return (
      <div className="app-shell">
        <div className="app-backdrop">
          <span className="app-aurora one" />
          <span className="app-aurora two" />
          <span className="app-aurora three" />
          <span className="app-grid" />
        </div>
        <main className="access-status-shell">
          <section className="access-status-card access-status-card-blocked">
            <p className="section-heading">Access blocked</p>
            <h1>VPN usage is not allowed</h1>
            <p>{siteAccess?.message ?? 'VPN, proxy, Tor, and hosting network access is not allowed on WorldDeciding.'}</p>
            <div className="access-status-meta">
              <span>Estimated country</span>
              <strong>{estimatedCountry}</strong>
            </div>
            {siteAccess?.riskReason ? (
              <div className="access-status-meta">
                <span>Risk signal</span>
                <strong>{siteAccess.riskReason}</strong>
              </div>
            ) : null}
          </section>
        </main>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <div className="app-backdrop">
        <span className="app-aurora one" />
        <span className="app-aurora two" />
        <span className="app-aurora three" />
        <span className="app-grid" />
      </div>

      {!isAuthPage ? <Navbar /> : null}

      <main className={`app-main ${mainLayoutClass}${isAuthPage ? '' : ' container-page'}`}>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/confirm-email" element={<VerifyEmail />} />
            <Route path="/email-confirmed" element={<VerifyEmail />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/categories/:categoryId" element={<CategoryQuestionsPage />} />
            <Route path="/binary" element={<BinaryQuestions />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/profile/:userId" element={<PublicProfile />} />
            <Route path="/questions" element={<Questions />} />
            <Route path="/questions/:id" element={<QuestionDetail />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/cookies" element={<Cookies />} />
            <Route path="/forbidden" element={<Forbidden />} />
            <Route element={<RoleRoute roles={['Admin']} />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/categories" element={<AdminCategories />} />
              <Route path="/admin/analytics" element={<AdminAnalytics />} />
              <Route path="/admin/questions" element={<AdminQuestions />} />
              <Route path="/admin/questions/import" element={<AdminQuestionImport />} />
              <Route path="/admin/questions/:id" element={<AdminQuestionDetail />} />
            </Route>
            <Route path="/questions/:id/stats" element={<QuestionStatsPage />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Suspense>
      </main>

      {!isAuthPage ? (
        <footer className="site-footer relative z-10">
          <div className="container-page py-6 sm:py-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-3">
                  <img src={worldDecidingLogo} alt="WorldDeciding logo" className="h-11 w-11 rounded-full object-cover" />
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-strong">WorldDeciding</p>
                    <p className="text-xs text-muted">A calmer way to see what the world thinks.</p>
                  </div>
                </div>
                <p className="text-xs text-muted">(c) {new Date().getFullYear()} WorldDeciding. All rights reserved.</p>
              </div>

              <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted lg:justify-end">
                <Link to="/" className="transition hover:text-strong">
                  Home
                </Link>
                <Link to="/questions" className="transition hover:text-strong">
                  Questions
                </Link>
                <Link to="/categories" className="transition hover:text-strong">
                  Categories
                </Link>
                <Link to="/leaderboard" className="transition hover:text-strong">
                  Leaderboard
                </Link>
                <Link to="/privacy" className="transition hover:text-strong">
                  Privacy
                </Link>
                <Link to="/cookies" className="transition hover:text-strong">
                  Cookies
                </Link>
              </div>
            </div>
          </div>
        </footer>
      ) : null}
    </div>
  )
}
