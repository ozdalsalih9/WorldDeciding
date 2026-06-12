import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
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
  { title: 'Question stream', href: '/questions', hint: 'Explore' },
  { title: 'Either / Or', href: '/binary', hint: 'Fast vote' },
  { title: 'Leaderboard', href: '/leaderboard', hint: 'Momentum' },
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
          params: { metric: 'votes', window: '7d', page: 1, take: 4 },
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

  const topCategories = useMemo(() => (categories.data ?? []).slice(0, 7), [categories.data])

  const topLeaderboard = useMemo(() => {
    const raw = leaderboard.data
    const items = Array.isArray(raw) ? raw : raw?.items ?? raw?.data ?? []
    return items.slice(0, 4)
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
        label: 'Questions',
        value: allTimeTotals.isLoading ? '--' : compactNumber.format(allTimeTotals.data?.totalQuestions ?? 0),
      },
      {
        label: 'Votes',
        value: allTimeTotals.isLoading ? '--' : compactNumber.format(allTimeTotals.data?.totalVotes ?? 0),
      },
      {
        label: 'Categories',
        value: categories.isLoading ? '--' : compactNumber.format(categories.data?.length ?? 0),
      },
    ],
    [allTimeTotals.data?.totalQuestions, allTimeTotals.data?.totalVotes, allTimeTotals.isLoading, categories.data?.length, categories.isLoading, compactNumber]
  )

  const getLeaderboardValue = (item: LeaderboardItem) =>
    item.votes ?? item.totalVotes ?? item.metricValue ?? item.value ?? item.score ?? 0

  const liveOptions = liveQuestion.data?.options ?? []

  return (
    <div className="home-cosmos container-page">
      <section className="home-cosmos-hero" aria-label="WorldDeciding live dashboard">
        <span className="home-cosmos-grid" aria-hidden />
        <span className="home-cosmos-glow one" aria-hidden />
        <span className="home-cosmos-glow two" aria-hidden />
        <span className="home-cosmos-glow three" aria-hidden />

        <div className="home-cosmos-copy">
          <p className="home-cosmos-kicker">
            <span aria-hidden />
            WorldDeciding signal room
          </p>
          <h1>Where opinions turn into a living map.</h1>
          <p>
            Step into live decisions, watch vote energy move, and jump between topics without breaking the flow.
          </p>
          <div className="home-cosmos-actions">
            <Link to="/binary" className="home-cosmos-primary">
              Start Either / Or
            </Link>
            <Link to="/questions" className="home-cosmos-secondary">
              Browse questions
            </Link>
          </div>
        </div>

        <div className="home-orbit-board" aria-label="Live decision orbit">
          <div className="home-orbit-rings" aria-hidden>
            <span />
            <span />
            <span />
          </div>
          <div className="home-orbit-core">
            <small>Live now</small>
            <strong>{liveQuestion.isLoading ? 'Loading signal...' : liveQuestion.data?.categoryName ?? 'Global pulse'}</strong>
            <span>{timeLeft}</span>
          </div>
          {quickLinks.map((link, index) => (
            <Link
              key={link.href}
              to={link.href}
              className={`home-orbit-chip chip-${index + 1}`}
            >
              <span>{link.hint}</span>
              {link.title}
            </Link>
          ))}
          <div className="home-orbit-question">
            <small>Current question</small>
            <p>{liveQuestion.data?.title ?? 'Live question stream is warming up.'}</p>
          </div>
        </div>
      </section>

      <section className="home-signal-strip" aria-label="Platform totals">
        {heroStats.map((item, index) => (
          <article key={item.label} style={{ '--delay': `${index * 90}ms` } as CSSProperties}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </article>
        ))}
      </section>

      <section className="home-command-grid">
        <article className="home-live-console">
          <div className="home-panel-head">
            <div>
              <p className="section-heading">Live console</p>
              <h2>{liveQuestion.data?.title ?? 'Live question loading'}</h2>
            </div>
            <span className="home-live-status">
              <span aria-hidden />
              {liveStats.isFetching ? 'Syncing' : 'Live'}
            </span>
          </div>

          <div className="home-live-meta">
            <span>{liveQuestion.data?.categoryName ?? 'Global'}</span>
            <span>{liveQuestion.data?.type ?? 'Decision'}</span>
            <span>Rotates in {timeLeft}</span>
          </div>

          <div className="home-option-stream">
            {liveOptions.map((option, index) => {
              const percent = getLivePercent(option.optionId)
              return (
                <div key={option.optionId} className="home-option-row">
                  <div>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <strong>{option.text}</strong>
                  </div>
                  <em>{percent}%</em>
                  <i aria-hidden style={{ width: `${percent}%` }} />
                </div>
              )
            })}
            {!liveOptions.length && !liveQuestion.isLoading ? (
              <p className="home-empty-line">No live options are available right now.</p>
            ) : null}
            {liveQuestion.isLoading ? <p className="home-empty-line">Loading live options...</p> : null}
          </div>

          {liveQuestion.data?.questionId ? (
            <Link to={`/questions/${liveQuestion.data.questionId}`} className="home-console-link">
              Open live vote <span aria-hidden>-&gt;</span>
            </Link>
          ) : (
            <Link to="/questions" className="home-console-link">
              Open question stream <span aria-hidden>-&gt;</span>
            </Link>
          )}
        </article>

        <article className="home-category-lab">
          <div className="home-panel-head compact">
            <div>
              <p className="section-heading">Topic portals</p>
              <h2>Choose a world</h2>
            </div>
            <Link to="/categories">All</Link>
          </div>
          <div className="home-topic-cloud">
            {categories.isLoading ? <span>Loading categories...</span> : null}
            {categories.isError ? <span>Could not load categories.</span> : null}
            {!categories.isLoading &&
              !categories.isError &&
              topCategories.map((category, index) => (
                <Link
                  key={category.id}
                  to={`/categories/${category.id}`}
                  style={{ '--delay': `${index * 70}ms` } as CSSProperties}
                >
                  <span aria-hidden>{String(index + 1).padStart(2, '0')}</span>
                  {category.name}
                </Link>
              ))}
          </div>
        </article>

        <article className="home-momentum-stack">
          <div className="home-panel-head compact">
            <div>
              <p className="section-heading">Momentum</p>
              <h2>Hot questions</h2>
            </div>
            <Link to="/leaderboard">Rankings</Link>
          </div>

          <div className="home-momentum-list">
            {leaderboard.isLoading ? <p className="home-empty-line">Loading leaderboard...</p> : null}
            {leaderboard.isError ? <p className="home-empty-line">Could not load leaderboard.</p> : null}
            {!leaderboard.isLoading && !leaderboard.isError && topLeaderboard.length === 0 ? (
              <p className="home-empty-line">No leaderboard entries yet.</p>
            ) : null}
            {topLeaderboard.map((item, index) => {
              const value = getLeaderboardValue(item)
              const topValue = getLeaderboardValue(topLeaderboard[0] ?? {})
              const width = topValue > 0 ? Math.max(18, Math.round((value / topValue) * 100)) : 18
              const targetId = item.questionId ?? item.id
              return (
                <Link
                  key={`${targetId ?? item.title ?? index}`}
                  to={targetId ? `/questions/${targetId}` : '/leaderboard'}
                  className="home-momentum-item"
                >
                  <span>#{index + 1}</span>
                  <div>
                    <strong>{item.title ?? 'Untitled question'}</strong>
                    <small>{item.categoryName ?? item.categorySlug ?? 'General'} - {value} votes</small>
                    <i aria-hidden>
                      <b style={{ width: `${width}%` }} />
                    </i>
                  </div>
                </Link>
              )
            })}
          </div>
        </article>
      </section>
    </div>
  )
}
