import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '@/shared/api/client'

type LeaderboardItem = {
  questionId?: string
  id?: string
  title?: string
  categoryName?: string
  categorySlug?: string
  type?: string | number
  metricValue?: number
  value?: number
  score?: number
  views?: number
  viewCount?: number
  votes?: number
  totalVotes?: number
  rank?: number
  delta?: number
  createdAt?: string
}

type LeaderboardResponse =
  | LeaderboardItem[]
  | {
      items?: LeaderboardItem[]
      data?: LeaderboardItem[]
      total?: number
      totalCount?: number
      count?: number
      page?: number
      take?: number
    }

const metricOptions = [
  { value: 'views', label: 'Views' },
  { value: 'votes', label: 'Votes' },
]

const windowOptions = [
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'all', label: 'All time' },
]

export default function Leaderboard() {
  const [metric, setMetric] = useState('views')
  const [timeWindow, setTimeWindow] = useState('7d')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [take, setTake] = useState(20)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [metric, timeWindow, debouncedSearch, take])

  const leaderboard = useQuery({
    queryKey: ['leaderboard', metric, timeWindow, debouncedSearch, page, take],
    queryFn: async () =>
      (
        await api.get<LeaderboardResponse>('/api/leaderboard', {
          params: {
            metric,
            window: timeWindow,
            q: debouncedSearch || undefined,
            page,
            take,
          },
        })
      ).data,
  })

  const normalized = useMemo(() => {
    const raw = leaderboard.data
    const items = Array.isArray(raw) ? raw : raw?.items ?? raw?.data ?? []
    const total =
      (Array.isArray(raw) ? undefined : raw?.total ?? raw?.totalCount ?? raw?.count) ??
      items.length
    const resolvedPage = Array.isArray(raw) ? page : raw?.page ?? page
    const resolvedTake = Array.isArray(raw) ? take : raw?.take ?? take
    return { items, total, page: resolvedPage, take: resolvedTake }
  }, [leaderboard.data, page, take])

  const metricLabel = metric === 'votes' ? 'Votes' : 'Views'
  const showNext = normalized.items.length === normalized.take

  return (
    <div className="space-y-10 leaderboard-page">
      <section className="leaderboard-hero surface px-6 py-10 lg:px-10 lg:py-12">
        <div className="leaderboard-backdrop">
          <span className="leaderboard-orb one" />
          <span className="leaderboard-orb two" />
          <span className="leaderboard-orb three" />
          <span className="leaderboard-grid" />
        </div>
        <div className="relative z-10 grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div className="space-y-4">
            <span className="section-heading">Leaderboard</span>
            <h1 className="text-4xl font-semibold leading-tight text-strong md:text-5xl">
              Track the hottest questions right now.
            </h1>
            <p className="max-w-2xl text-lg text-muted">
              Switch between views and votes, slice by time, and see which topics are shaping the room.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link to="/questions" className="btn-primary">
                Explore questions
              </Link>
              <Link to="/categories" className="btn-ghost">
                Browse categories
              </Link>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-2xl border border-border bg-panel p-6 shadow-[0_20px_60px_rgba(15,23,42,0.12)]">
            <div className="absolute inset-0 bg-[var(--accent-muted)] opacity-40" />
            <div className="relative space-y-4">
              <div className="flex items-center justify-between text-xs text-muted">
                <span className="pill">Live signal</span>
                <span className="inline-flex items-center gap-2 rounded-full bg-[var(--surface-muted)] px-3 py-1 text-[11px] text-muted">
                  <span className="h-2 w-2 rounded-full bg-[var(--accent)] shadow-[0_0_0_6px_rgba(34,211,238,0.18)]" />
                  {leaderboard.isFetching ? 'Updating' : 'Fresh'}
                </span>
              </div>
              <div className="grid gap-3 text-sm text-muted">
                <div className="flex items-center justify-between rounded-xl border border-border bg-panel px-4 py-3">
                  <span>Metric</span>
                  <span className="font-semibold text-strong">{metricLabel}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-border bg-panel px-4 py-3">
                  <span>Window</span>
                  <span className="font-semibold text-strong">
                    {windowOptions.find(option => option.value === timeWindow)?.label ?? 'Last 7 days'}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-border bg-panel px-4 py-3">
                  <span>Entries</span>
                  <span className="font-semibold text-strong">{normalized.total}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="surface p-6 sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <span className="section-heading">Filters</span>
            <h2 className="text-2xl font-semibold text-strong">Tuned for momentum</h2>
            <p className="text-sm text-muted">Dial the leaderboard to the window and metric you want to study.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setMetric('views')
                setTimeWindow('7d')
                setSearch('')
                setTake(20)
              }}
            >
              Reset
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[0.75fr_0.75fr_1.6fr_0.6fr]">
          <label className="space-y-2 text-sm text-muted">
            <span>Metric</span>
            <select
              className="w-full rounded-xl border border-border bg-panel px-4 py-3 text-sm text-strong focus:outline-none"
              value={metric}
              onChange={(event) => setMetric(event.target.value)}
            >
              {metricOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm text-muted">
            <span>Time window</span>
            <select
              className="w-full rounded-xl border border-border bg-panel px-4 py-3 text-sm text-strong focus:outline-none"
              value={timeWindow}
              onChange={(event) => setTimeWindow(event.target.value)}
            >
              {windowOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm text-muted">
            <span>Search</span>
            <input
              className="w-full rounded-xl border border-border bg-panel px-4 py-3 text-sm text-strong placeholder:text-muted focus:outline-none"
              placeholder="Search by title, category, keyword"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          <label className="space-y-2 text-sm text-muted">
            <span>Per page</span>
            <select
              className="w-full rounded-xl border border-border bg-panel px-4 py-3 text-sm text-strong focus:outline-none"
              value={take}
              onChange={(event) => setTake(Number(event.target.value))}
            >
              {[10, 20, 30, 50].map(size => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <span className="section-heading">Ranking</span>
            <h2 className="text-2xl font-semibold text-strong">Top performers</h2>
          </div>
          <div className="text-sm text-muted">
            Page {normalized.page} - Showing {normalized.items.length} of {normalized.total}
          </div>
        </div>

        {leaderboard.isLoading && (
          <div className="grid gap-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="rounded-2xl border border-border bg-panel p-6">
                <div className="h-4 w-24 rounded-full bg-[var(--surface-muted)]" />
                <div className="mt-4 h-6 w-2/3 rounded-full bg-[var(--surface-muted)]" />
                <div className="mt-3 h-4 w-1/3 rounded-full bg-[var(--surface-muted)]" />
              </div>
            ))}
          </div>
        )}

        {!leaderboard.isLoading && leaderboard.isError && (
          <div className="surface p-6 text-sm text-rose-500">
            Could not load the leaderboard. Please try again.
          </div>
        )}

        {!leaderboard.isLoading && !leaderboard.isError && normalized.items.length === 0 && (
          <div className="surface p-6 text-sm text-muted">
            No leaderboard entries found for this filter set.
          </div>
        )}

        {!leaderboard.isLoading && !leaderboard.isError && normalized.items.length > 0 && (
          <div className="grid gap-4">
            {normalized.items.map((item, index) => {
              const rank = item.rank ?? (normalized.page - 1) * normalized.take + index + 1
              const isPodium = rank <= 3
              const isKing = rank === 1
              const questionId = item.questionId ?? item.id ?? ''
              const displayValue =
                item.metricValue ??
                item.value ??
                (metric === 'votes'
                  ? item.votes ?? item.totalVotes ?? item.score
                  : item.views ?? item.viewCount ?? item.score) ??
                0
              const delta = item.delta ?? 0
              const deltaLabel = delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : '0'
              return (
                <div
                  key={`${questionId}-${rank}`}
                  className={`group relative overflow-hidden rounded-2xl border border-border bg-panel p-6 transition hover:-translate-y-1 hover:border-[rgba(34,211,238,0.3)] leaderboard-card ${isPodium ? 'is-podium' : ''} ${isKing ? 'is-king' : ''}`}
                >
                  <div className="absolute inset-0 bg-[var(--accent-muted)] opacity-0 transition duration-300 group-hover:opacity-100" />
                  <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                        <span className={`leaderboard-rank ${isPodium ? 'is-podium' : ''} ${isKing ? 'is-king' : ''}`}>
                          <span className="leaderboard-rank-number">#{rank}</span>
                          {isKing ? (
                            <span className="leaderboard-rank-emoji" role="img" aria-label="Leader">
                              👑
                            </span>
                          ) : null}
                        </span>
                        <span className="rounded-full border border-border bg-panel px-3 py-1 uppercase tracking-[0.16em] text-[10px] text-muted">
                          {metricLabel}
                        </span>
                        {item.type !== undefined && (
                          <span className="rounded-full border border-border bg-panel px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-muted">
                            {String(item.type)}
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-semibold text-strong">
                        {item.title ?? 'Untitled question'}
                      </h3>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
                        <span>
                          Category: {item.categoryName ?? item.categorySlug ?? 'General'}
                        </span>
                        <span className="h-1 w-1 rounded-full bg-[var(--border)]" />
                        <span>Delta: {deltaLabel}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-xs uppercase tracking-[0.2em] text-muted">{metricLabel}</div>
                        <div className="mt-1 text-3xl font-semibold text-strong leaderboard-score">{displayValue}</div>
                      </div>
                      {questionId ? (
                        <Link to={`/questions/${questionId}`} className="btn-ghost">
                          Open
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-muted">
            Page {normalized.page} - {normalized.total} total
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setPage(prev => Math.max(1, prev - 1))}
              disabled={normalized.page <= 1}
            >
              Previous
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => setPage(prev => prev + 1)}
              disabled={!showNext}
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
