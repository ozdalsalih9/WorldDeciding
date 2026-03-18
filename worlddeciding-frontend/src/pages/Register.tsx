import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import useAuth from '@/features/auth'
import api, { authNoRefreshConfig } from '@/shared/api/client'
import { useToast } from '@/shared/ui/toast'
import worldDecidingLogo from '@/shared/logo/worlddeciding.png'

const genderOptions = [
  { value: 0, label: 'Prefer not to say' },
  { value: 1, label: 'Female' },
  { value: 2, label: 'Male' },
]

const passwordRules = [
  'At least 10 characters',
  'At least 1 digit',
  'At least 1 uppercase letter',
  'At least 1 lowercase letter',
  'At least 1 symbol (e.g. !@#$%)',
]

type CountryOption = {
  code: string
  label: string
}

type RegisterCountryResponse = {
  countryCode?: string | null
  enforceCountryMatch?: boolean
  canRegister?: boolean
  confidence?: number
  provider?: string
  message?: string | null
}

const countryVerificationUnavailableMessage =
  'We could not verify your country from your connection. Refresh the page and try again. If you are using a VPN or proxy, disable it first.'

export default function Register() {
  const { register } = useAuth()
  const nav = useNavigate()
  const toast = useToast()

  const regionDisplayNames = useMemo(() => {
    try {
      return new Intl.DisplayNames(['en'], { type: 'region' })
    } catch {
      return null
    }
  }, [])

  const countryOptions = useMemo<CountryOption[]>(() => {
    const fallback: CountryOption[] = [
      { code: 'TR', label: 'Turkey (TR)' },
      { code: 'US', label: 'United States (US)' },
      { code: 'GB', label: 'United Kingdom (GB)' },
      { code: 'DE', label: 'Germany (DE)' },
      { code: 'FR', label: 'France (FR)' },
    ]

    if (!regionDisplayNames) {
      return fallback
    }

    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const options: CountryOption[] = []

    for (const first of letters) {
      for (const second of letters) {
        const code = `${first}${second}`
        const name = regionDisplayNames.of(code)
        if (!name || name === code || name.toLowerCase() === 'unknown region') continue
        options.push({ code, label: `${name} (${code})` })
      }
    }

    if (!options.length) return fallback

    return options.sort((a, b) => a.label.localeCompare(b.label))
  }, [regionDisplayNames])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [countryCode, setCountryCode] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [gender, setGender] = useState(0)
  const [detectedCountryCode, setDetectedCountryCode] = useState<string | null>(null)
  const [isCountryMatchRequired, setIsCountryMatchRequired] = useState(false)
  const [canRegisterByCountryCheck, setCanRegisterByCountryCheck] = useState(false)
  const [isResolvingCountry, setIsResolvingCountry] = useState(true)
  const [suggestedCountryCode, setSuggestedCountryCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setSubmitting] = useState(false)

  useEffect(() => {
    let ignore = false

    const loadRegisterCountry = async () => {
      setIsResolvingCountry(true)
      try {
        const res = await api.get('/api/auth/register-country', authNoRefreshConfig)

        if (ignore) return

        const responseData = (res.data ?? {}) as RegisterCountryResponse
        const detected = responseData.countryCode?.trim().toUpperCase() || null
        const enforce = Boolean(responseData.enforceCountryMatch)
        const canRegister = responseData.canRegister !== false
        const responseMessage =
          typeof responseData.message === 'string' && responseData.message.trim()
            ? responseData.message.trim()
            : null

        setDetectedCountryCode(detected)
        setIsCountryMatchRequired(enforce)
        setCanRegisterByCountryCheck(canRegister)

        if (detected) {
          setCountryCode(detected)
          setSuggestedCountryCode(detected)
          setError(null)
        }

        if (!detected) {
          setSuggestedCountryCode(null)
        }

        if (!canRegister) {
          setError(responseMessage ?? countryVerificationUnavailableMessage)
        } else if (!detected && enforce) {
          setError(null)
        } else {
          setError(null)
        }
      } catch {
        if (!ignore) {
          setDetectedCountryCode(null)
          setIsCountryMatchRequired(true)
          setCanRegisterByCountryCheck(true)
          setSuggestedCountryCode(null)
          setError(null)
        }
      } finally {
        if (!ignore) {
          setIsResolvingCountry(false)
        }
      }
    }

    void loadRegisterCountry()

    return () => {
      ignore = true
    }
  }, [])

  const hasCountryMismatch =
    isCountryMatchRequired &&
    !!detectedCountryCode &&
    countryCode.trim().toUpperCase() !== detectedCountryCode

  const isCountryVerificationBlocked =
    isCountryMatchRequired &&
    !isResolvingCountry &&
    !canRegisterByCountryCheck

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (hasCountryMismatch && detectedCountryCode) {
      const mismatchMessage = `Country must match your detected location: ${detectedCountryCode}.`
      setSuggestedCountryCode(detectedCountryCode)
      setError(mismatchMessage)
      toast.error(mismatchMessage)
      return
    }

    setSubmitting(true)
    try {
      await register({
        email,
        password,
        countryCode,
        birthDate,
        gender,
      })
      const verifyMessage = 'Registration successful. Please verify your email before signing in.'
      nav('/login', { replace: true, state: { message: verifyMessage } })
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Sign up failed'
      const nextSuggestedCountryCode = err?.suggestedCountryCode
      if (typeof nextSuggestedCountryCode === 'string' && nextSuggestedCountryCode.length === 2) {
        setCountryCode(nextSuggestedCountryCode)
        setSuggestedCountryCode(nextSuggestedCountryCode)
        setDetectedCountryCode(nextSuggestedCountryCode)
      }
      setError(msg)
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="auth-stage">
      <div className="auth-stage-backdrop">
        <span className="auth-orb auth-orb-a" />
        <span className="auth-orb auth-orb-b" />
        <span className="auth-grid" />
      </div>

      <div className="auth-shell auth-shell-wide">
        <div className="auth-panel">
          <div className="auth-brand">
            <img src={worldDecidingLogo} alt="WorldDeciding logo" className="auth-brand-logo" />
            <span>WorldDeciding</span>
          </div>
          <p className="auth-kicker">Create account</p>
          <h1 className="auth-title">Start your voting profile</h1>
          <p className="auth-subtitle">
            Choose your country carefully during registration. It cannot be changed later from your profile.
          </p>

          <form className="auth-form-grid" onSubmit={handleSubmit}>
            <div className="auth-col-span-2">
              <label className="label">Email</label>
              <input
                required
                type="email"
                className="input auth-input"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="label">Password</label>
              <input
                required
                type="password"
                className="input auth-input"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              <div className="auth-rules">
                <p className="auth-rules-title">Password rules</p>
                <ul className="auth-rules-list">
                  {passwordRules.map(rule => (
                    <li key={rule}>- {rule}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div>
              <label className="label">Country</label>
              <select
                required
                size={10}
                className="input auth-input auth-country-list"
                value={countryCode}
                onChange={e => {
                  setCountryCode(e.target.value)
                  setError(null)
                }}
              >
                <option value="" disabled>Select your country</option>
                {countryOptions.map(opt => (
                  <option key={opt.code} value={opt.code}>{opt.label}</option>
                ))}
              </select>
              <p className="mt-2 text-xs text-muted">Selected country code: <strong>{countryCode}</strong></p>
              {isResolvingCountry ? (
                <p className="mt-1 text-xs text-muted">Detecting your country...</p>
              ) : detectedCountryCode ? (
                <p className="mt-1 text-xs text-muted">Detected country: <strong>{detectedCountryCode}</strong></p>
              ) : null}
              {suggestedCountryCode ? (
                <p className="mt-1 text-xs font-semibold text-[var(--accent-strong)]">
                  Suggested country: {suggestedCountryCode}
                </p>
              ) : null}
              {hasCountryMismatch && detectedCountryCode ? (
                <p className="mt-1 text-xs font-semibold text-rose-600">
                  You can only register with your detected country: {detectedCountryCode}.
                </p>
              ) : null}
              {isCountryVerificationBlocked ? (
                <p className="mt-1 text-xs font-semibold text-rose-600">
                  Country verification is required before registration can continue.
                </p>
              ) : null}
              <p className="mt-1 text-xs text-muted">This country selection is permanent after account creation.</p>
            </div>

            <div>
              <label className="label">Birth date</label>
              <input
                required
                type="date"
                className="input auth-input"
                value={birthDate}
                onChange={e => setBirthDate(e.target.value)}
              />
            </div>

            <div>
              <label className="label">Gender</label>
              <select
                className="input auth-input"
                value={gender}
                onChange={e => setGender(Number(e.target.value))}
              >
                {genderOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {error && (
              <div className="auth-col-span-2 auth-error">
                {error}
              </div>
            )}

            <div className="auth-col-span-2 auth-actions">
              <button
                type="submit"
                disabled={isSubmitting || isResolvingCountry || hasCountryMismatch || isCountryVerificationBlocked}
                className="btn-primary w-full sm:w-auto"
              >
                {isSubmitting ? 'Signing up...' : 'Sign up'}
              </button>
              <div className="text-sm text-muted">
                Already have an account?{' '}
                <Link to="/login" className="btn-link">Sign in</Link>
              </div>
            </div>
          </form>
        </div>
      </div>
    </section>
  )
}
