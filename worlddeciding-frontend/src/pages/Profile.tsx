import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/shared/api/client'
import useAuth from '@/features/auth'
import { useToast } from '@/shared/ui/toast'

type MyProfileBadge = string | { key?: string | null; code?: string | null; name?: string | null; label?: string | null }
type PublicProfileDto = {
  userId: string
  displayName?: string | null
  bio?: string | null
  avatarUrl?: string | null
  createdAt?: string | null
  score?: number
  stars?: number
  rank?: string | null
  profileCompletionPercent?: number
  totalVotes?: number
  totalComments?: number
  likesReceived?: number
}

type MyProfileDto = {
  userId: string
  email: string
  displayName: string | null
  bio: string | null
  avatarUrl: string | null
  countryCode: string | null
  birthDate: string | null
  gender: number
  score?: number
  stars?: number
  rank?: string | null
  profileCompletionPercent?: number
  totalVotes?: number
  totalComments?: number
  likesReceived?: number
  badges?: MyProfileBadge[] | null
}

type ProfileUpdatePayload = {
  displayName: string | null
  bio: string | null
  avatarUrl: string | null
  countryCode: string | null
  birthDate: string | null
  gender: number
}

type ProfileFormState = {
  displayName: string
  bio: string
  avatarUrl: string
  countryCode: string
  birthDate: string
  gender: number
}

type ProfileFieldErrors = Partial<Record<keyof ProfileFormState, string>>

const DISPLAY_NAME_MAX = 40
const BIO_MAX = 160
const AVATAR_URL_MAX = 300
const COUNTRY_CODE_REGEX = /^[a-z]{2}$/i
const BIRTH_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

const EMPTY_FORM: ProfileFormState = {
  displayName: '',
  bio: '',
  avatarUrl: '',
  countryCode: '',
  birthDate: '',
  gender: 0,
}

const genderOptions = [
  { value: 0, label: 'Prefer not to say' },
  { value: 1, label: 'Female' },
  { value: 2, label: 'Male' },
]

function normalizeOptional(value: string): string | null {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function normalizeCountryCode(value: string): string | null {
  const trimmed = value.trim()
  return trimmed ? trimmed.toUpperCase() : null
}

function mapDtoToForm(profile: MyProfileDto): ProfileFormState {
  return {
    displayName: profile.displayName ?? '',
    bio: profile.bio ?? '',
    avatarUrl: profile.avatarUrl ?? '',
    countryCode: profile.countryCode ?? '',
    birthDate: profile.birthDate ?? '',
    gender: typeof profile.gender === 'number' ? profile.gender : 0,
  }
}

function mapFormToPayload(form: ProfileFormState): ProfileUpdatePayload {
  return {
    displayName: normalizeOptional(form.displayName),
    bio: normalizeOptional(form.bio),
    avatarUrl: normalizeOptional(form.avatarUrl),
    countryCode: normalizeCountryCode(form.countryCode),
    birthDate: normalizeOptional(form.birthDate),
    gender: Number.isFinite(form.gender) ? form.gender : 0,
  }
}

function extractApiErrorMessage(error: any): string {
  const data = error?.response?.data
  if (!data) return error?.message ?? 'Profile request failed.'
  if (typeof data === 'string') return data

  const directMessage = data?.message || data?.title || data?.detail || data?.error
  if (typeof directMessage === 'string' && directMessage.trim()) return directMessage

  const errors = data?.errors
  if (errors && typeof errors === 'object') {
    const allMessages = Object.values(errors)
      .flatMap((value: any) => (Array.isArray(value) ? value : [value]))
      .filter((value: any) => typeof value === 'string' && value.trim())
    if (allMessages.length) return allMessages.join(' ')
  }
  return error?.message ?? 'Profile request failed.'
}

function isUnauthorizedError(error: any): boolean {
  return error?.response?.status === 401
}

function getInitials(source: string): string {
  const clean = source.trim()
  if (!clean) return 'WD'
  const parts = clean.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function calculateCompletion(profile: MyProfileDto): number {
  const fields = [
    !!profile.displayName?.trim(),
    !!profile.bio?.trim(),
    !!profile.avatarUrl?.trim(),
    !!profile.countryCode?.trim(),
    !!profile.birthDate?.trim(),
  ]
  const completed = fields.filter(Boolean).length
  return clampPercent((completed / 5) * 100)
}

function normalizeBadgeLabel(badge: MyProfileBadge): string {
  if (typeof badge === 'string') return badge.trim()
  return (badge?.label ?? badge?.name ?? badge?.code ?? badge?.key ?? '').trim()
}

function buildValidationErrors(form: ProfileFormState): ProfileFieldErrors {
  const errors: ProfileFieldErrors = {}
  if (form.displayName.length > DISPLAY_NAME_MAX) {
    errors.displayName = `Display name can be at most ${DISPLAY_NAME_MAX} characters.`
  }
  if (form.bio.length > BIO_MAX) {
    errors.bio = `Bio can be at most ${BIO_MAX} characters.`
  }
  if (form.avatarUrl.length > AVATAR_URL_MAX) {
    errors.avatarUrl = `Avatar URL can be at most ${AVATAR_URL_MAX} characters.`
  }
  const birthDate = form.birthDate.trim()
  if (birthDate && !BIRTH_DATE_REGEX.test(birthDate)) {
    errors.birthDate = 'Birth date must be in YYYY-MM-DD format.'
  }
  const countryCode = form.countryCode.trim()
  if (countryCode && !COUNTRY_CODE_REGEX.test(countryCode)) {
    errors.countryCode = 'Country code must be a 2-letter ISO code (e.g. TR, US).'
  }
  if (!Number.isInteger(form.gender) || form.gender < 0) {
    errors.gender = 'Gender value is invalid.'
  }
  return errors
}

function decodeJwtPayload(token: string | null): Record<string, any> | null {
  if (!token) return null
  try {
    const part = token.split('.')[1]
    if (!part) return null
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    const json = typeof atob !== 'undefined' ? atob(padded) : Buffer.from(padded, 'base64').toString('utf-8')
    return JSON.parse(json)
  } catch {
    return null
  }
}

function decodeUserIdFromJwt(token: string | null): string {
  const payload = decodeJwtPayload(token)
  const candidates = [
    payload?.sub,
    payload?.nameid,
    payload?.userId,
    payload?.['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'],
    payload?.['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'],
  ]
  const match = candidates.find((value) => typeof value === 'string' && value.trim())
  return typeof match === 'string' ? match.trim() : ''
}

export default function Profile() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const { isAuthenticated, token } = useAuth()

  const [form, setForm] = useState<ProfileFormState>(EMPTY_FORM)
  const [fieldErrors, setFieldErrors] = useState<ProfileFieldErrors>({})
  const [avatarBroken, setAvatarBroken] = useState(false)
  const unauthorizedHandledRef = useRef(false)
  const fallbackUserId = useMemo(() => decodeUserIdFromJwt(token), [token])

  const handleUnauthorized = () => {
    if (unauthorizedHandledRef.current) return
    unauthorizedHandledRef.current = true
    toast.error('Your profile could not be loaded right now.')
  }

  const profileQuery = useQuery({
    queryKey: ['my-profile'],
    queryFn: async () => (await api.get<MyProfileDto>('/api/profile/me')).data,
    enabled: isAuthenticated,
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })

  const fallbackProfileQuery = useQuery({
    queryKey: ['public-profile-fallback', fallbackUserId],
    queryFn: async () => (await api.get<PublicProfileDto>(`/api/profile/${encodeURIComponent(fallbackUserId)}`)).data,
    enabled: isAuthenticated && !!fallbackUserId && profileQuery.isError,
    retry: false,
    staleTime: 120_000,
    refetchOnWindowFocus: false,
  })

  useEffect(() => {
    if (!profileQuery.data) return
    setForm(mapDtoToForm(profileQuery.data))
    setFieldErrors({})
  }, [profileQuery.data])

  useEffect(() => {
    if (!profileQuery.error) return
    if (isUnauthorizedError(profileQuery.error)) handleUnauthorized()
  }, [profileQuery.error])

  useEffect(() => {
    setAvatarBroken(false)
  }, [form.avatarUrl])

  const saveMutation = useMutation({
    mutationFn: async (payload: ProfileUpdatePayload) =>
      (await api.put<MyProfileDto>('/api/profile/me', payload)).data,
    onSuccess: (data) => {
      queryClient.setQueryData(['my-profile'], data)
      setForm(mapDtoToForm(data))
      setFieldErrors({})
      toast.success('Profile updated successfully.')
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) {
        handleUnauthorized()
        return
      }
      toast.error(extractApiErrorMessage(error))
    },
  })

  const payload = useMemo(() => mapFormToPayload(form), [form])

  const isDirty = useMemo(() => {
    if (!profileQuery.data) return false
    const base = mapFormToPayload(mapDtoToForm(profileQuery.data))
    return JSON.stringify(base) !== JSON.stringify(payload)
  }, [payload, profileQuery.data])

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const errors = buildValidationErrors(form)
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) {
      toast.error('Please fix highlighted fields before saving.')
      return
    }
    saveMutation.mutate(payload)
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (profileQuery.isLoading) {
    return (
      <div className="profile-page">
        <div className="profile-shell">
          <div className="profile-shell-grid" />
          <div className="profile-loading">Syncing your profile stream...</div>
        </div>
      </div>
    )
  }

  if (profileQuery.isError || !profileQuery.data) {
    if (fallbackProfileQuery.isLoading) {
      return (
        <div className="profile-page">
          <div className="profile-shell">
            <div className="profile-shell-grid" />
            <div className="profile-loading">Loading your public profile...</div>
          </div>
        </div>
      )
    }

    if (fallbackProfileQuery.data) {
      const profile = fallbackProfileQuery.data
      const displayName = profile.displayName?.trim() || `Member ${profile.userId.slice(0, 6)}`
      const initials = getInitials(displayName)
      const joinedAt = profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'Not set'
      const profileScore = typeof profile.score === 'number' ? profile.score : 0
      const profileStars = Math.max(0, Math.min(5, typeof profile.stars === 'number' ? profile.stars : 0))
      const profileRank = profile.rank?.trim() || 'Unranked'
      const completion = clampPercent(typeof profile.profileCompletionPercent === 'number' ? profile.profileCompletionPercent : 0)
      const starsVisual = `${'*'.repeat(profileStars)}${'-'.repeat(Math.max(0, 5 - profileStars))}`

      return (
        <div className="profile-page">
          <section className="profile-shell">
            <div className="profile-shell-orb one" />
            <div className="profile-shell-orb two" />
            <div className="profile-shell-grid" />

            <div className="relative z-10 grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
              <div className="profile-preview-panel">
                <p className="section-heading">My Profile</p>
                <h1 className="mt-4 text-3xl font-semibold leading-tight text-strong sm:text-4xl">{displayName}</h1>
                <p className="mt-3 text-sm text-muted">Your public profile is shown because the private profile endpoint is currently rejecting authenticated requests.</p>

                <div className="profile-avatar-ring mt-6">
                  {profile.avatarUrl && !avatarBroken ? (
                    <img
                      src={profile.avatarUrl}
                      alt="Profile avatar"
                      className="h-full w-full object-cover"
                      onError={() => setAvatarBroken(true)}
                    />
                  ) : (
                    <span>{initials}</span>
                  )}
                </div>

                <div className="mt-5 space-y-3 text-sm">
                  <div className="profile-rank-card">
                    <p className="profile-rank-title">Rank Progress</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="profile-rank-chip">{profileRank}</span>
                      <span className="profile-stars">Stars: {starsVisual}</span>
                    </div>
                    <p className="profile-score mt-2">Score: {profileScore}</p>
                  </div>

                  <div className="profile-meta-item">
                    <span>User ID</span>
                    <strong>{profile.userId}</strong>
                  </div>
                  <div className="profile-meta-item">
                    <span>Joined</span>
                    <strong>{joinedAt}</strong>
                  </div>
                </div>

                <div className="profile-completion mt-5">
                  <div className="profile-completion-head">
                    <span>Profile completion</span>
                    <strong>{completion}%</strong>
                  </div>
                  <div className="profile-completion-track" aria-hidden>
                    <span style={{ width: `${completion}%` }} />
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2">
                  <div className="profile-stat-mini">
                    <span>TotalVotes</span>
                    <strong>{profile.totalVotes ?? 0}</strong>
                  </div>
                  <div className="profile-stat-mini">
                    <span>TotalComments</span>
                    <strong>{profile.totalComments ?? 0}</strong>
                  </div>
                  <div className="profile-stat-mini">
                    <span>LikesReceived</span>
                    <strong>{profile.likesReceived ?? 0}</strong>
                  </div>
                </div>
              </div>

              <div className="profile-form-panel">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="section-heading">Edit profile</p>
                    <h2 className="mt-3 text-2xl font-semibold text-strong">Temporarily unavailable</h2>
                  </div>
                  <span className="pill">Read only</span>
                </div>

                <div className="mt-6 space-y-4 text-sm text-muted">
                  <p>
                    The backend is rejecting bearer-authenticated profile requests, so the private `/api/profile/me`
                    endpoint cannot be loaded right now.
                  </p>
                  <p>
                    You can still see the public version of your profile above. Editing will work again after the API
                    token audience configuration is fixed.
                  </p>
                  <div className="rounded-2xl border border-border bg-panel px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted">Bio</p>
                    <p className="mt-2 text-sm text-strong">{profile.bio?.trim() || 'No bio yet.'}</p>
                  </div>
                  <div className="flex flex-wrap gap-3 pt-2">
                    <button type="button" onClick={() => profileQuery.refetch()} className="btn-primary">
                      Retry private profile
                    </button>
                    <Link to={`/profile/${encodeURIComponent(profile.userId)}`} className="btn-ghost">
                      Open public profile page
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      )
    }

    return (
      <div className="profile-page">
        <div className="surface p-6 sm:p-8">
          <p className="section-heading">Profile</p>
          <h1 className="mt-3 text-2xl font-semibold text-strong">Profile unavailable</h1>
          <p className="mt-2 text-sm text-muted">We could not load your profile right now.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" onClick={() => profileQuery.refetch()} className="btn-primary">Retry</button>
            <Link to="/" className="btn-ghost">Return home</Link>
          </div>
        </div>
      </div>
    )
  }

  const profile = profileQuery.data
  const displayNameFallback = profile.displayName || profile.email
  const avatarPreview = form.avatarUrl.trim()
  const genderLabel = genderOptions.find(item => item.value === form.gender)?.label ?? 'Unknown'
  const profileScore = typeof profile.score === 'number' ? profile.score : 0
  const profileStars = Math.max(0, Math.min(5, typeof profile.stars === 'number' ? profile.stars : 0))
  const profileRank = profile.rank?.trim() || 'Unranked'
  const starsVisual = `${'*'.repeat(profileStars)}${'-'.repeat(Math.max(0, 5 - profileStars))}`
  const completion = clampPercent(
    typeof profile.profileCompletionPercent === 'number'
      ? profile.profileCompletionPercent
      : calculateCompletion(profile)
  )
  const totalVotes = profile.totalVotes ?? 0
  const totalComments = profile.totalComments ?? 0
  const likesReceived = profile.likesReceived ?? 0
  const badgeLabels = (profile.badges ?? [])
    .map(normalizeBadgeLabel)
    .filter(Boolean)

  return (
    <div className="profile-page">
      <section className="profile-shell">
        <div className="profile-shell-orb one" />
        <div className="profile-shell-orb two" />
        <div className="profile-shell-grid" />

        <div className="relative z-10 grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="profile-preview-panel">
            <p className="section-heading">My Profile</p>
            <h1 className="mt-4 text-3xl font-semibold leading-tight text-strong sm:text-4xl">Your profile cockpit</h1>
            <p className="mt-3 text-sm text-muted">Identity, gamification stats, and engagement metrics.</p>

            <div className="profile-avatar-ring mt-6">
              {avatarPreview && !avatarBroken ? (
                <img
                  src={avatarPreview}
                  alt="Profile avatar"
                  className="h-full w-full object-cover"
                  onError={() => setAvatarBroken(true)}
                />
              ) : (
                <span>{getInitials(displayNameFallback)}</span>
              )}
            </div>

            <div className="mt-5 space-y-3 text-sm">
              <div className="profile-rank-card">
                <p className="profile-rank-title">Rank Progress</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="profile-rank-chip">{profileRank}</span>
                  <span className="profile-stars">Stars: {starsVisual}</span>
                </div>
                <p className="profile-score mt-2">Score: {profileScore}</p>
              </div>

              <div className="profile-meta-item">
                <span>Email</span>
                <strong>{profile.email}</strong>
              </div>
              <div className="profile-meta-item">
                <span>Gender</span>
                <strong>{genderLabel}</strong>
              </div>
              <div className="profile-meta-item">
                <span>Birth date</span>
                <strong>{form.birthDate || 'Not set'}</strong>
              </div>
            </div>

            <div className="profile-completion mt-5">
              <div className="profile-completion-head">
                <span>Profile completion</span>
                <strong>{completion}%</strong>
              </div>
              <div className="profile-completion-track" aria-hidden>
                <span style={{ width: `${completion}%` }} />
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              <div className="profile-stat-mini">
                <span>TotalVotes</span>
                <strong>{totalVotes}</strong>
              </div>
              <div className="profile-stat-mini">
                <span>TotalComments</span>
                <strong>{totalComments}</strong>
              </div>
              <div className="profile-stat-mini">
                <span>LikesReceived</span>
                <strong>{likesReceived}</strong>
              </div>
            </div>

            <div className="mt-5">
              <p className="profile-rank-title">Badges</p>
              {badgeLabels.length > 0 ? (
                <div className="profile-badge-cloud mt-2">
                  {badgeLabels.map((badge) => (
                    <span key={badge} className="profile-badge-chip">{badge}</span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted mt-2">No badges yet. Engage more to unlock them.</p>
              )}
            </div>
          </div>

          <form className="profile-form-panel" onSubmit={onSubmit}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-heading">Edit profile</p>
                <h2 className="mt-3 text-2xl font-semibold text-strong">Public details</h2>
              </div>
              <span className="pill">{saveMutation.isPending ? 'Saving...' : 'Ready'}</span>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label">Email (read-only)</label>
                <input className="input opacity-80" value={profile.email} readOnly />
              </div>

              <div className="sm:col-span-2">
                <div className="flex items-center justify-between">
                  <label className="label">Display name</label>
                  <span className="text-xs text-muted">{form.displayName.length}/{DISPLAY_NAME_MAX}</span>
                </div>
                <input
                  className={`input ${fieldErrors.displayName ? 'border-rose-400' : ''}`}
                  placeholder="How should people see you?"
                  maxLength={DISPLAY_NAME_MAX}
                  value={form.displayName}
                  onChange={(event) => {
                    setFieldErrors(prev => ({ ...prev, displayName: undefined }))
                    setForm(prev => ({ ...prev, displayName: event.target.value }))
                  }}
                />
                {fieldErrors.displayName ? <p className="profile-error-text">{fieldErrors.displayName}</p> : null}
              </div>

              <div className="sm:col-span-2">
                <div className="flex items-center justify-between">
                  <label className="label">Bio</label>
                  <span className="text-xs text-muted">{form.bio.length}/{BIO_MAX}</span>
                </div>
                <textarea
                  className={`input min-h-[110px] resize-y py-3 ${fieldErrors.bio ? 'border-rose-400' : ''}`}
                  placeholder="Short status about yourself."
                  maxLength={BIO_MAX}
                  value={form.bio}
                  onChange={(event) => {
                    setFieldErrors(prev => ({ ...prev, bio: undefined }))
                    setForm(prev => ({ ...prev, bio: event.target.value }))
                  }}
                />
                {fieldErrors.bio ? <p className="profile-error-text">{fieldErrors.bio}</p> : null}
              </div>

              <div className="sm:col-span-2">
                <div className="flex items-center justify-between">
                  <label className="label">Avatar URL</label>
                  <span className="text-xs text-muted">{form.avatarUrl.length}/{AVATAR_URL_MAX}</span>
                </div>
                <input
                  className={`input ${fieldErrors.avatarUrl ? 'border-rose-400' : ''}`}
                  type="url"
                  placeholder="https://..."
                  maxLength={AVATAR_URL_MAX}
                  value={form.avatarUrl}
                  onChange={(event) => {
                    setFieldErrors(prev => ({ ...prev, avatarUrl: undefined }))
                    setForm(prev => ({ ...prev, avatarUrl: event.target.value }))
                  }}
                />
                {fieldErrors.avatarUrl ? <p className="profile-error-text">{fieldErrors.avatarUrl}</p> : null}
              </div>

              <div>
                <label className="label">Country code</label>
                <input
                  className="input opacity-80"
                  value={form.countryCode}
                  readOnly
                  disabled
                />
                <p className="profile-error-text">Country is locked after registration and cannot be changed here.</p>
              </div>

              <div>
                <label className="label">Birth date</label>
                <input
                  className={`input ${fieldErrors.birthDate ? 'border-rose-400' : ''}`}
                  type="date"
                  value={form.birthDate}
                  onChange={(event) => {
                    setFieldErrors(prev => ({ ...prev, birthDate: undefined }))
                    setForm(prev => ({ ...prev, birthDate: event.target.value }))
                  }}
                />
                {fieldErrors.birthDate ? <p className="profile-error-text">{fieldErrors.birthDate}</p> : null}
              </div>

              <div className="sm:col-span-2">
                <label className="label">Gender</label>
                <select
                  className={`input ${fieldErrors.gender ? 'border-rose-400' : ''}`}
                  value={form.gender}
                  onChange={(event) => {
                    setFieldErrors(prev => ({ ...prev, gender: undefined }))
                    setForm(prev => ({ ...prev, gender: Number(event.target.value) }))
                  }}
                >
                  {genderOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                {fieldErrors.gender ? <p className="profile-error-text">{fieldErrors.gender}</p> : null}
              </div>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button type="submit" className="btn-primary" disabled={!isDirty || saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving profile...' : 'Save changes'}
              </button>
              <button
                type="button"
                className="btn-ghost"
                disabled={saveMutation.isPending || !isDirty}
                onClick={() => {
                  setFieldErrors({})
                  setForm(mapDtoToForm(profile))
                  toast.info('Changes reverted.')
                }}
              >
                Reset
              </button>
              <span className="text-xs uppercase tracking-[0.22em] text-muted">
                {isDirty ? 'Unsaved changes' : 'All changes saved'}
              </span>
            </div>
          </form>
        </div>
      </section>
    </div>
  )
}
