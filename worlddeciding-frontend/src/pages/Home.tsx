import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '@/shared/api/client'
import type { QuestionStats } from '@/entities/question/model/types'
import type { Category } from '@/entities/category/model/types'
import { fetchCategories } from '@/entities/category/api/categories'

type LiveQuestionDto = {
  questionId: string
  title: string
  categorySlug: string
  categoryName: string
  type: string
  rotatesAtUtc: string
  options: Array<{ optionId: string; text: string }>
}

const quickLinks = [
  { title: 'Trending questions', href: '/questions', hint: 'Live list' },
  { title: 'Browse categories', href: '/categories', hint: 'Explore' },
  { title: 'Weekly leaderboard', href: '/leaderboard', hint: 'Momentum' },
]

type LeaderboardItem = {
  questionId?: string
  id?: string
  title?: string
  categoryName?: string
  categorySlug?: string
  metricValue?: number
  value?: number
  score?: number
  votes?: number
  totalVotes?: number
}

type LeaderboardResponse =
  | LeaderboardItem[]
  | {
      items?: LeaderboardItem[]
      data?: LeaderboardItem[]
    }

type QuestionTotalsResponse = {
  totalQuestions: number
  totalVotes: number
}

export default function Home() {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const liveQuestion = useQuery({
    queryKey: ['live-question'],
    queryFn: async () => (await api.get<LiveQuestionDto>('/api/live')).data,
    refetchInterval: 15_000,
    refetchOnWindowFocus: false,
  })

  const liveStats = useQuery({
    queryKey: ['live-question', 'stats'],
    queryFn: async () => (await api.get<QuestionStats>('/api/live/stats')).data,
    enabled: !!liveQuestion.data?.questionId,
    refetchInterval: 10_000,
    refetchOnWindowFocus: false,
  })

  const categories = useQuery<Category[]>({
    queryKey: ['home-categories'],
    queryFn: fetchCategories,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })

  const allTimeTotals = useQuery({
    queryKey: ['home-all-time-totals'],
    queryFn: async () => (await api.get<QuestionTotalsResponse>('/api/questions/totals')).data,
    refetchInterval: 120_000,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })

  const leaderboard = useQuery({
    queryKey: ['home-leaderboard'],
    queryFn: async () =>
      (
        await api.get<LeaderboardResponse>('/api/leaderboard', {
          params: { metric: 'votes', window: '7d', page: 1, take: 3 },
        })
      ).data,
    refetchInterval: 45_000,
    refetchOnWindowFocus: false,
  })

  useEffect(() => {
    const questionId = liveQuestion.data?.questionId
    if (!questionId) return
    void api.post(`/api/questions/${questionId}/view`).catch(() => {})
  }, [liveQuestion.data?.questionId])

  const timeLeft = useMemo(() => {
    if (!liveQuestion.data?.rotatesAtUtc) return '--:--'
    const diff = new Date(liveQuestion.data.rotatesAtUtc).getTime() - now
    if (diff <= 0) return '00:00'
    const totalSeconds = Math.floor(diff / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }, [liveQuestion.data?.rotatesAtUtc, now])

  const optionPercent = useMemo(() => {
    if (!liveQuestion.data?.options?.length) return 0
    return Math.round(100 / liveQuestion.data.options.length)
  }, [liveQuestion.data?.options])

  const statsLookup = useMemo(() => {
    if (!liveStats.data?.options?.length) return {}
    return liveStats.data.options.reduce<Record<string, QuestionStats['options'][number]>>((acc, item) => {
      acc[item.optionId] = item
      return acc
    }, {})
  }, [liveStats.data?.options])

  const getLivePercent = (optionId: string) => {
    const item = statsLookup[optionId]
    if (!item) return optionPercent
    if (typeof item.percentage === 'number') return Math.round(item.percentage)
    if (typeof item.ratio === 'number') return Math.round(item.ratio * 100)
    const totalVotes =
      liveStats.data?.totalVotes ??
      liveStats.data?.options.reduce((sum, opt) => sum + (opt.count ?? 0), 0) ??
      0
    if (!totalVotes) return optionPercent
    return Math.round(((item.count ?? 0) / totalVotes) * 100)
  }

  const topCategories = useMemo(() => (categories.data ?? []).slice(0, 8), [categories.data])

  const topLeaderboard = useMemo(() => {
    const raw = leaderboard.data
    const items = Array.isArray(raw) ? raw : raw?.items ?? raw?.data ?? []
    return items.slice(0, 3)
  }, [leaderboard.data])

  const compactNumber = useMemo(
    () =>
      new Intl.NumberFormat('en', {
        notation: 'compact',
        maximumFractionDigits: 1,
      }),
    []
  )

  const heroStats = useMemo(
    () => [
      {
        label: 'Total Questions',
        value: allTimeTotals.isLoading ? '--' : compactNumber.format(allTimeTotals.data?.totalQuestions ?? 0),
      },
      {
        label: 'Total Votes Used',
        value: allTimeTotals.isLoading ? '--' : compactNumber.format(allTimeTotals.data?.totalVotes ?? 0),
      },
      {
        label: 'Active Categories',
        value: categories.isLoading ? '--' : compactNumber.format(categories.data?.length ?? 0),
      },
    ],
    [allTimeTotals.data?.totalQuestions, allTimeTotals.data?.totalVotes, allTimeTotals.isLoading, categories.data?.length, categories.isLoading, compactNumber]
  )

  const getLeaderboardValue = (item: LeaderboardItem) =>
    item.votes ?? item.totalVotes ?? item.metricValue ?? item.value ?? item.score ?? 0

  return (
    <div className="container-page home-shell space-y-8 pt-6 pb-2 lg:space-y-10 lg:pt-8">
      <section className="home-wow-hero home-wow-hero-refined">
        <div className="home-wow-grid">
          <div className="home-wow-copy">
            <span className="pill">WorldDeciding Live</span>
            <h1 className="heading-1 max-w-2xl text-4xl leading-tight sm:text-5xl">
              Vote on the questions moving right now.
            </h1>
            <p className="max-w-2xl text-base text-muted">
              Follow live splits, compare momentum, and move from one decision to the next without losing context.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/questions" className="btn-primary">Explore Questions</Link>
              <Link to="/binary" className="btn-ghost">Start Either / Or</Link>
            </div>

            <div className="home-wow-link-row">
              {quickLinks.map(link => (
                <Link key={`${link.href}-${link.title}`} to={link.href} className="home-wow-link">
                  <span>{link.title}</span>
                  <small>{link.hint}</small>
                </Link>
              ))}
            </div>
          </div>

          <div className="home-wow-metrics">
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {heroStats.map(item => (
                <div key={item.label} className="home-stat-tile rounded-xl border border-border bg-panel px-4 py-3 text-sm text-muted">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-muted">{item.label}</div>
                  <div className="mt-1 text-2xl font-semibold text-strong">{item.value}</div>
                  <div className="home-sparkline mt-3" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="home-live" className="home-live-stage home-live-shell surface">
        <div className="grid gap-6 lg:grid-cols-[1.03fr_0.97fr] lg:items-start">
          <div className="home-live-info">
            <div className="home-live-radar-card">
              <span className="section-heading">Live Radar</span>
              <h2 className="mt-3 text-2xl font-semibold text-strong">Real-time pulse, minimal load</h2>
              <p className="mt-2 text-sm text-muted">
                This panel is streamlined to surface the live feed, momentum shifts, and vote dynamics at a glance.
              </p>
            </div>

            <div className="home-live-links">
              {quickLinks.map(link => (
                <Link
                  key={`${link.href}-${link.title}`}
                  to={link.href}
                  className="home-quick-link group text-sm text-muted transition hover:-translate-y-1 hover:border-[rgba(34,211,238,0.3)]"
                >
                  <div className="flex items-center justify-between text-xs uppercase tracking-[0.14em] text-muted">
                    <span>{link.hint}</span>
                    <span className="text-[var(--accent-strong)] transition group-hover:text-[var(--accent)]">-&gt;</span>
                  </div>
                  <div className="mt-2 text-base font-semibold text-strong">{link.title}</div>
                </Link>
              ))}
            </div>

            <div className="home-live-side-fill">
              <div className="home-live-side-header">
                <span className="section-heading">Trending now</span>
                <Link to="/leaderboard" className="btn-link text-xs">Full ranking</Link>
              </div>
              <div className="home-live-side-list">
                {topLeaderboard.length === 0 && !leaderboard.isLoading ? (
                  <p className="text-sm text-muted">No trending questions yet.</p>
                ) : (
                  topLeaderboard.slice(0, 3).map((item, index) => {
                    const value = getLeaderboardValue(item)
                    const targetId = item.questionId ?? item.id
                    return (
                      <Link
                        key={`live-trending-${targetId ?? index}`}
                        to={targetId ? `/questions/${targetId}` : '/leaderboard'}
                        className="home-live-side-item"
                      >
                        <span className="home-live-side-rank">#{index + 1}</span>
                        <span className="home-live-side-title">{item.title ?? 'Untitled question'}</span>
                        <span className="home-live-side-value">{value}</span>
                      </Link>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          <div className="home-live-card home-live-card-shell relative overflow-hidden shadow-[0_20px_60px_rgba(15,23,42,0.12)]">
            <span className="home-live-card-noise" aria-hidden />
            <span className="home-live-card-scan" aria-hidden />
            <div className="absolute inset-0 bg-[var(--accent-muted)] opacity-35" />
            <div className="relative flex items-center justify-between text-xs text-muted">
              <span className="pill">Live question</span>
              <span className="inline-flex items-center gap-2 rounded-full bg-[var(--surface-muted)] px-3 py-1 text-[11px] text-muted">
                <span className="h-2 w-2 rounded-full bg-[var(--accent)] shadow-[0_0_0_6px_rgba(34,211,238,0.18)]" />
                Live monitor
              </span>
            </div>
            <h3 className="mt-5 text-2xl font-semibold text-strong">
              {liveQuestion.isLoading ? 'Loading live question...' : liveQuestion.data?.title ?? 'No live question'}
            </h3>
            <p className="mt-2 text-sm text-muted">
              {liveQuestion.data?.categoryName ? `Category: ${liveQuestion.data.categoryName}` : 'Live question stream.'}
            </p>
            <div className="home-wow-pulse home-live-pulse">
              <div className="home-wow-pulse-label">
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent)] shadow-[0_0_0_8px_rgba(34,211,238,0.15)]" />
                Global pulse
              </div>
              <div className="home-wow-pulse-grid">
                <div>
                  <small>Time left</small>
                  <strong>{timeLeft}</strong>
                </div>
                <div>
                  <small>Vote flow</small>
                  <strong>Live</strong>
                </div>
                <div>
                  <small>Trend</small>
                  <strong>{liveQuestion.data?.type ?? 'Live'}</strong>
                </div>
              </div>
            </div>
            <div className="mt-6 space-y-3">
              {(liveQuestion.data?.options ?? []).map(option => {
                const percent = getLivePercent(option.optionId)
                return (
                  <div key={option.optionId} className="space-y-2">
                    <div className="flex items-center justify-between text-sm text-muted">
                      <span>{option.text}</span>
                      <span className="font-semibold text-strong">{percent}%</span>
                    </div>
                    <div className="home-live-meter h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                      <div
                        className="h-full rounded-full bg-[var(--accent)] shadow-[0_10px_30px_rgba(34,211,238,0.25)]"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                )
              })}
              {!liveQuestion.data?.options?.length && !liveQuestion.isLoading && (
                <p className="text-sm text-muted">No options available right now.</p>
              )}
            </div>
            {liveQuestion.data?.questionId && (
              <div className="mt-6">
                <Link to={`/questions/${liveQuestion.data.questionId}`} className="btn-ghost">
                  Open live question
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_0.92fr]">
        <div className="home-insight-panel surface p-6 sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <span className="section-heading">Discover</span>
              <h2 className="mt-3 text-2xl font-semibold text-strong">Find your next category in one tap</h2>
            </div>
            <Link to="/categories" className="btn-ghost">All categories</Link>
          </div>
          <p className="mt-3 text-sm text-muted">
            Jump straight into active topics, then move to relevant questions without digging through menus.
          </p>

          <div className="home-category-cloud mt-6">
            {categories.isLoading && <p className="text-sm text-muted">Loading categories...</p>}
            {categories.isError && <p className="text-sm text-rose-600">Could not load categories.</p>}
            {!categories.isLoading &&
              !categories.isError &&
              topCategories.map((category, index) => (
                <Link
                  key={category.id}
                  to={`/categories/${category.id}`}
                  className="home-category-chip"
                  style={{ animationDelay: `${index * 70}ms` }}
                >
                  <span className="home-category-chip-dot" aria-hidden />
                  {category.name}
                </Link>
              ))}
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Link to="/categories" className="home-route-card">
              <p className="home-route-kicker">Category flow</p>
              <h3>Explore category reel</h3>
              <p>Swipe, tap, and open the newest category threads.</p>
            </Link>
            <Link to="/leaderboard" className="home-route-card">
              <p className="home-route-kicker">Competition</p>
              <h3>Open leaderboard</h3>
              <p>Track which questions are getting the most votes this week.</p>
            </Link>
          </div>
        </div>

        <div className="home-insight-panel surface p-6 sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <span className="section-heading">Leaderboard</span>
              <h2 className="mt-3 text-2xl font-semibold text-strong">What is trending right now</h2>
            </div>
            <Link to="/leaderboard" className="btn-primary">View leaderboard</Link>
          </div>
          <p className="mt-3 text-sm text-muted">
            Live-ranked by vote momentum. Use this list to jump into the most active discussions.
          </p>
          <div className="mt-6 space-y-3">
            {leaderboard.isLoading && <p className="text-sm text-muted">Loading leaderboard...</p>}
            {leaderboard.isError && <p className="text-sm text-rose-600">Could not load leaderboard data.</p>}
            {!leaderboard.isLoading && !leaderboard.isError && topLeaderboard.length === 0 && (
              <p className="text-sm text-muted">No leaderboard entries yet.</p>
            )}
            {topLeaderboard.map((item, index) => {
              const value = getLeaderboardValue(item)
              const topValue = getLeaderboardValue(topLeaderboard[0] ?? {})
              const width = topValue > 0 ? Math.max(18, Math.round((value / topValue) * 100)) : 18
              const targetId = item.questionId ?? item.id
              return (
                <Link
                  key={`${targetId ?? item.title ?? index}`}
                  to={targetId ? `/questions/${targetId}` : '/leaderboard'}
                  className="home-rank-item"
                >
                  <span className="home-rank-pos">#{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-strong">{item.title ?? 'Untitled question'}</p>
                    <p className="mt-1 text-xs text-muted">
                      {(item.categoryName ?? item.categorySlug ?? 'General')} - {value} votes
                    </p>
                    <span className="home-rank-meter" aria-hidden>
                      <span style={{ width: `${width}%` }} />
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}
