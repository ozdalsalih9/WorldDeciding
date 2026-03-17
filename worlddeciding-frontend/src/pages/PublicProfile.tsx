import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '@/shared/api/client'

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

function getInitials(value: string): string {
  const clean = value.trim()
  if (!clean) return 'WD'
  const parts = clean.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

export default function PublicProfile() {
  const params = useParams()
  const userId = params.userId ? decodeURIComponent(params.userId) : ''

  const profileQuery = useQuery({
    queryKey: ['public-profile', userId],
    queryFn: async () => (await api.get<PublicProfileDto>(`/api/profile/${userId}`)).data,
    enabled: !!userId,
    retry: false,
    staleTime: 120_000,
    refetchOnWindowFocus: false,
  })

  if (!userId) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="surface p-6 sm:p-8">
          <h1 className="text-2xl font-semibold text-strong">Profile not found</h1>
          <p className="mt-2 text-sm text-muted">Invalid user id.</p>
          <Link to="/" className="btn-ghost mt-6">Return home</Link>
        </div>
      </div>
    )
  }

  if (profileQuery.isLoading) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="surface p-6 sm:p-8">
          <p className="text-sm uppercase tracking-[0.26em] text-muted">Profile</p>
          <p className="mt-3 text-base text-muted">Loading user profile...</p>
        </div>
      </div>
    )
  }

  if (profileQuery.isError || !profileQuery.data) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="surface p-6 sm:p-8 space-y-4">
          <p className="text-sm uppercase tracking-[0.26em] text-muted">Profile</p>
          <h1 className="text-2xl font-semibold text-strong">This profile is unavailable</h1>
          <p className="text-sm text-muted">User: {userId}</p>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn-primary" onClick={() => profileQuery.refetch()}>Retry</button>
            <Link to="/questions" className="btn-ghost">Back to questions</Link>
          </div>
        </div>
      </div>
    )
  }

  const profile = profileQuery.data
  const displayName = profile.displayName?.trim() || `Member ${userId.slice(0, 5)}`
  const initials = getInitials(displayName)
  const joinedAt = profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'Not set'
  const profileScore = typeof profile.score === 'number' ? profile.score : 0
  const profileStars = Math.max(0, Math.min(5, typeof profile.stars === 'number' ? profile.stars : 0))
  const profileRank = profile.rank?.trim() || 'Unranked'
  const completion = clampPercent(typeof profile.profileCompletionPercent === 'number' ? profile.profileCompletionPercent : 0)
  const starsVisual = `${'*'.repeat(profileStars)}${'-'.repeat(Math.max(0, 5 - profileStars))}`

  return (
    <div className="mx-auto max-w-2xl">
      <section className="surface p-6 sm:p-8">
        <p className="text-sm uppercase tracking-[0.26em] text-muted">Public profile</p>
        <div className="mt-4 flex items-center gap-4">
          <div className="h-16 w-16 overflow-hidden rounded-full border border-border bg-[var(--surface-soft)]">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt={`${displayName} avatar`} className="h-full w-full object-cover" />
            ) : (
              <span className="grid h-full w-full place-items-center text-sm font-semibold text-strong">{initials}</span>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-strong">{displayName}</h1>
            <p className="text-xs uppercase tracking-[0.2em] text-muted">ID: {profile.userId || userId}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 text-sm">
          <div className="profile-rank-card">
            <p className="profile-rank-title">Rank Progress</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="profile-rank-chip">{profileRank}</span>
              <span className="profile-stars">Stars: {starsVisual}</span>
            </div>
            <p className="profile-score mt-2">Score: {profileScore}</p>
          </div>

          <div className="rounded-xl border border-border bg-panel px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.18em] text-muted">Profile completion</p>
              <strong className="text-sm text-strong">{completion}%</strong>
            </div>
            <div className="profile-completion-track mt-2" aria-hidden>
              <span style={{ width: `${completion}%` }} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
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

          <div className="rounded-xl border border-border bg-panel px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-muted">Bio</p>
            <p className="mt-1 text-strong">{profile.bio?.trim() || 'No bio yet.'}</p>
          </div>
          <div className="rounded-xl border border-border bg-panel px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-muted">Joined</p>
            <p className="mt-1 text-strong">{joinedAt}</p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/questions" className="btn-primary">Questions</Link>
          <Link to="/" className="btn-ghost">Home</Link>
        </div>
      </section>
    </div>
  )
}
