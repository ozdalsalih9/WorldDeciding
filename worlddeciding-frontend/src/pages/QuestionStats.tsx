import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '@/shared/api/client'
import type { Question, QuestionStats } from '@/entities/question/model/types'
const CountryGlobe = lazy(() => import('@/components/CountryGlobe'))

type CountryCompareOption = {
  optionId: string
  count: number
  percentage: number
}

type CountryCompareBucket = {
  countryCode: string
  total: number
  options: CountryCompareOption[]
  suppressed: boolean
}

type CountryCompareResponse = {
  questionId: string
  left: CountryCompareBucket
  right: CountryCompareBucket
  global: CountryCompareBucket
}

const COUNTRY_PAGE_SIZE = 8

function normalizeCompareBucket(input: any, fallbackCode: string): CountryCompareBucket {
  const rawOptions = input?.options ?? input?.Options ?? []
  return {
    countryCode:
      input?.countryCode ??
      input?.CountryCode ??
      input?.code ??
      fallbackCode,
    total:
      input?.totalCount ??
      input?.TotalCount ??
      input?.total ??
      input?.totalVotes ??
      input?.TotalVotes ??
      input?.count ??
      input?.Count ??
      0,
    options: Array.isArray(rawOptions)
      ? rawOptions.map((item: any) => ({
          optionId: String(item?.optionId ?? item?.OptionId ?? ''),
          count: item?.count ?? item?.Count ?? 0,
          percentage: Math.round(item?.percentage ?? item?.Percentage ?? 0),
        }))
      : [],
    suppressed: Boolean(
      input?.suppressed ??
      input?.isSuppressed ??
      input?.IsSuppressed ??
      false
    ),
  }
}

function normalizeCompareResponse(input: any, leftCode: string, rightCode: string): CountryCompareResponse {
  return {
    questionId: input?.questionId ?? input?.QuestionId ?? '',
    left: normalizeCompareBucket(input?.left ?? input?.Left ?? input?.leftBucket ?? input?.LeftBucket, leftCode),
    right: normalizeCompareBucket(input?.right ?? input?.Right ?? input?.rightBucket ?? input?.RightBucket, rightCode),
    global: normalizeCompareBucket(input?.global ?? input?.Global ?? input?.globalBucket ?? input?.GlobalBucket, 'GLOBAL'),
  }
}

export default function QuestionStatsPage() {
  const { id } = useParams()
  const [selectedCountries, setSelectedCountries] = useState<string[]>([])
  const [showCompareModal, setShowCompareModal] = useState(false)
  const [countryPage, setCountryPage] = useState(1)

  const question = useQuery({
    queryKey: ['question', id],
    queryFn: async () => (await api.get<Question>(`/api/questions/${id}`)).data,
    enabled: !!id,
  })

  const stats = useQuery({
    queryKey: ['question-stats', id],
    queryFn: async () => (await api.get<QuestionStats>(`/api/questions/${id}/stats`)).data,
    enabled: !!id,
  })

  const viewCount =
    stats.data?.views ??
    stats.data?.viewCount ??
    question.data?.views ??
    question.data?.viewCount

  const totalVotes = useMemo(() => {
    if (!stats.data) return 0
    if (typeof stats.data.totalVotes === 'number') return stats.data.totalVotes
    return stats.data.options.reduce((sum, item) => sum + (item.count ?? 0), 0)
  }, [stats.data])

  const normalizedOptions = useMemo(() => {
    if (!stats.data) return []
    const questionOptions = question.data?.options ?? []
    return stats.data.options.map((option, index) => {
      const label =
        option.optionText ||
        option.text ||
        questionOptions.find(o => o.id === option.optionId)?.text ||
        `Option ${index + 1}`
      const percentage = (() => {
        if (typeof option.percentage === 'number') return option.percentage
        if (typeof option.ratio === 'number') return option.ratio * 100
        return totalVotes ? (option.count / totalVotes) * 100 : 0
      })()

      return {
        id: option.optionId,
        label,
        count: option.count,
        percentage: Math.round(percentage),
        hue: 200 + index * 22,
      }
    })
  }, [question.data?.options, stats.data, totalVotes])

  const countryStats = useMemo(() => {
    if (!stats.data?.byCountry) return []
    const totalCountryVotes =
      stats.data.byCountry.reduce((sum, item) => sum + (item.count ?? 0), 0) || totalVotes
    return [...stats.data.byCountry]
      .map(item => ({
        countryCode: item.countryCode,
        count: item.count,
        percentage:
          typeof item.percentage === 'number'
            ? Math.round(item.percentage)
            : totalCountryVotes
              ? Math.round((item.count / totalCountryVotes) * 100)
            : 0,
      }))
      .sort((a, b) => b.count - a.count)
  }, [stats.data?.byCountry, totalVotes])

  const totalCountryPages = Math.max(1, Math.ceil(countryStats.length / COUNTRY_PAGE_SIZE))

  useEffect(() => {
    setCountryPage(prev => Math.min(prev, totalCountryPages))
  }, [totalCountryPages])

  const paginatedCountryStats = useMemo(() => {
    const start = (countryPage - 1) * COUNTRY_PAGE_SIZE
    return countryStats.slice(start, start + COUNTRY_PAGE_SIZE)
  }, [countryPage, countryStats])

  const countryRangeStart = countryStats.length === 0 ? 0 : (countryPage - 1) * COUNTRY_PAGE_SIZE + 1
  const countryRangeEnd = Math.min(countryPage * COUNTRY_PAGE_SIZE, countryStats.length)

  const genderStats = useMemo(() => {
    if (!stats.data?.byGender) return []
    const totalGenderVotes =
      stats.data.byGender.reduce((sum, item) => sum + (item.count ?? 0), 0) || totalVotes
    const formatGender = (g?: string | number | null) => {
      const num = typeof g === 'number' ? g : undefined
      const key = typeof g === 'string' ? g.toLowerCase() : ''
      if (num === 1 || ['male', 'm'].includes(key)) return 'Male'
      if (num === 2 || ['female', 'f'].includes(key)) return 'Female'
      if (num === 3 || ['nonbinary', 'non-binary', 'nb'].includes(key)) return 'Non-binary'
      if (key) return key.charAt(0).toUpperCase() + key.slice(1)
      return 'Unspecified'
    }
    return stats.data.byGender
      .map(item => {
        const percentage =
          typeof item.percentage === 'number'
            ? Math.round(item.percentage)
            : totalGenderVotes
              ? Math.round((item.count / totalGenderVotes) * 100)
              : 0
        return { label: formatGender(item.gender), count: item.count, percentage }
      })
      .sort((a, b) => b.count - a.count)
  }, [stats.data?.byGender, totalVotes])

  const ageStats = useMemo(() => {
    const ageSource = stats.data?.byAge ?? stats.data?.byAgeBands ?? []
    if (ageSource.length === 0) return []
    const totalAgeVotes = ageSource.reduce((sum, item) => sum + (item.count ?? 0), 0) || totalVotes
    const labelFor = (item: {
      ageGroup?: string
      band?: string
      range?: string
      bucket?: string
      label?: string
      minAge?: number
      maxAge?: number
    }) => {
      if (item.label) return item.label
      if (item.band) return item.band
      if (item.ageGroup) return item.ageGroup
      if (item.range) return item.range
      if (item.bucket) return item.bucket
      if (typeof item.minAge === 'number' || typeof item.maxAge === 'number') {
        const min = typeof item.minAge === 'number' ? item.minAge : 0
        const max = typeof item.maxAge === 'number' ? item.maxAge : null
        return max ? `${min}-${max}` : `${min}+`
      }
      return 'Age'
    }
    return ageSource
      .map(item => {
        const percentage =
          typeof item.percentage === 'number'
            ? Math.round(item.percentage)
            : totalAgeVotes
              ? Math.round((item.count / totalAgeVotes) * 100)
              : 0
        return { label: labelFor(item), count: item.count, percentage }
      })
      .sort((a, b) => b.count - a.count)
  }, [stats.data?.byAge, stats.data?.byAgeBands, totalVotes])

  const compareQuery = useQuery({
    queryKey: ['question-country-compare', id, selectedCountries[0], selectedCountries[1]],
    queryFn: async () => {
      const response = await api.get(`/api/questions/${id}/country-compare`, {
        params: {
          left: selectedCountries[0],
          right: selectedCountries[1],
        },
      })
      return normalizeCompareResponse(response.data, selectedCountries[0], selectedCountries[1])
    },
    enabled: !!id && showCompareModal && selectedCountries.length === 2,
  })

  if (question.isLoading || stats.isLoading) {
    return (
      <div className="question-full-bleed">
        <div className="min-h-screen grid place-items-center bg-[var(--bg-base)] text-strong">
          <p className="text-lg tracking-wide animate-pulse">Preparing statistics...</p>
        </div>
      </div>
    )
  }

  if (question.isError || stats.isError || !question.data || !stats.data) {
    return (
      <div className="min-h-screen grid place-items-center bg-[var(--bg-base)] text-strong">
        <div className="card max-w-md text-center">
          <div className="card-body space-y-3">
            <p className="text-xl font-semibold text-strong">Statistics unavailable</p>
            <p className="text-sm text-muted">There was a problem while loading the question or stats data.</p>
            <Link to="/" className="btn-primary w-full justify-center">Return home</Link>
          </div>
        </div>
      </div>
    )
  }

  const optionLabelLookup = normalizedOptions.reduce<Record<string, string>>((acc, option) => {
    acc[option.id] = option.label
    return acc
  }, {})

  const closeCompareModal = () => {
    setShowCompareModal(false)
    setSelectedCountries([])
  }

  const handleCountrySelect = (countryCode: string) => {
    if (selectedCountries.includes(countryCode)) {
      const next = selectedCountries.filter(code => code !== countryCode)
      setSelectedCountries(next)
      if (next.length < 2) setShowCompareModal(false)
      return
    }

    if (selectedCountries.length === 0) {
      setSelectedCountries([countryCode])
      setShowCompareModal(false)
      return
    }

    if (selectedCountries.length === 1) {
      setSelectedCountries([selectedCountries[0], countryCode])
      setShowCompareModal(true)
      return
    }

    setSelectedCountries([countryCode])
    setShowCompareModal(false)
  }

  const getOptionShareLookup = (bucket: CountryCompareBucket) => {
    return bucket.options.reduce<Record<string, CountryCompareOption>>((acc, option) => {
      acc[option.optionId] = option
      return acc
    }, {})
  }

  const resolveTopOptionText = (bucket: CountryCompareBucket) => {
    const top = bucket.options[0]
    if (!top) return 'No option split'
    const label = optionLabelLookup[top.optionId] ?? 'Option'
    return `${label} (${top.percentage}%)`
  }

  const renderCompareInsights = (data: CountryCompareResponse) => {
    const pairTotal = data.left.total + data.right.total
    const leftShare = pairTotal ? Math.round((data.left.total / pairTotal) * 100) : 0
    const rightShare = pairTotal ? Math.round((data.right.total / pairTotal) * 100) : 0

    const leftLookup = getOptionShareLookup(data.left)
    const rightLookup = getOptionShareLookup(data.right)
    const globalLookup = getOptionShareLookup(data.global)

    const allOptionIds = new Set<string>(normalizedOptions.map(option => option.id))
    data.left.options.forEach(option => allOptionIds.add(option.optionId))
    data.right.options.forEach(option => allOptionIds.add(option.optionId))
    data.global.options.forEach(option => allOptionIds.add(option.optionId))

    const normalizedOptionIds = normalizedOptions.map(option => option.id)
    const normalizedIdSet = new Set(normalizedOptionIds)
    const extraOptionIds = Array.from(allOptionIds)
      .filter(optionId => !normalizedIdSet.has(optionId))
      .sort()
    const orderedOptionIds = [...normalizedOptionIds, ...extraOptionIds]

    const duelRows = orderedOptionIds.map((optionId, index) => {
      const leftPercentage = leftLookup[optionId]?.percentage ?? 0
      const rightPercentage = rightLookup[optionId]?.percentage ?? 0
      const globalPercentage = globalLookup[optionId]?.percentage ?? 0
      const swing = leftPercentage - rightPercentage

      return {
        optionId,
        label: optionLabelLookup[optionId] ?? `Option ${index + 1}`,
        leftPercentage,
        rightPercentage,
        globalPercentage,
        swing,
      }
    })

    const strongestShift = duelRows.reduce<{ label: string; swing: number } | null>((best, row) => {
      if (!best || Math.abs(row.swing) > Math.abs(best.swing)) {
        return { label: row.label, swing: row.swing }
      }
      return best
    }, null)

    return (
      <>
        <div className="country-compare-insights">
          <article className="country-compare-insight left">
            <p className="country-compare-insight-kicker">{data.left.countryCode}</p>
            <p className="country-compare-insight-value">{data.left.total}</p>
            <p className="country-compare-insight-meta">{leftShare}% of selected sample</p>
            <p className="country-compare-insight-note">Top: {resolveTopOptionText(data.left)}</p>
          </article>

          <article className="country-compare-insight right">
            <p className="country-compare-insight-kicker">{data.right.countryCode}</p>
            <p className="country-compare-insight-value">{data.right.total}</p>
            <p className="country-compare-insight-meta">{rightShare}% of selected sample</p>
            <p className="country-compare-insight-note">Top: {resolveTopOptionText(data.right)}</p>
          </article>

          <article className="country-compare-insight neutral">
            <p className="country-compare-insight-kicker">Most polarized option</p>
            <p className="country-compare-insight-value">
              {strongestShift ? `${Math.abs(strongestShift.swing)} pts` : '0 pts'}
            </p>
            <p className="country-compare-insight-meta">{strongestShift?.label ?? 'No option data yet'}</p>
            <p className="country-compare-insight-note">Global total: {data.global.total} votes</p>
          </article>
        </div>

        <section className="country-duel-board" aria-label="Option by option comparison">
          <div className="country-duel-head">
            <p className="country-duel-title">Option duel</p>
            <p className="country-duel-subtitle">
              Left vs right spread with global baseline for each option.
            </p>
          </div>

          {duelRows.length === 0 ? (
            <p className="country-compare-state">No option split data available for this comparison.</p>
          ) : (
            <div className="country-duel-list">
              {duelRows.map(row => (
                <div key={row.optionId} className="country-duel-row">
                  <div className="country-duel-side">
                    <span className="country-duel-value">{row.leftPercentage}%</span>
                    <div className="country-duel-meter left" aria-hidden>
                      <span style={{ width: `${row.leftPercentage}%` }} />
                    </div>
                  </div>

                  <div className="country-duel-center">
                    <p className="country-duel-option">{row.label}</p>
                    <p className="country-duel-global">Global {row.globalPercentage}%</p>
                    <p
                      className={`country-duel-gap ${
                        row.swing > 0 ? 'positive' : row.swing < 0 ? 'negative' : 'neutral'
                      }`}
                    >
                      {row.swing === 0
                        ? 'Even split'
                        : row.swing > 0
                          ? `${data.left.countryCode} +${Math.abs(row.swing)} pts`
                          : `${data.right.countryCode} +${Math.abs(row.swing)} pts`}
                    </p>
                  </div>

                  <div className="country-duel-side align-right">
                    <div className="country-duel-meter right" aria-hidden>
                      <span style={{ width: `${row.rightPercentage}%` }} />
                    </div>
                    <span className="country-duel-value">{row.rightPercentage}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </>
    )
  }

  const renderCompareBucket = (bucket: CountryCompareBucket, variant: 'left' | 'right' | 'global') => {
    if (bucket.total === 0) {
      return (
        <div className={`country-compare-card ${variant}`}>
          <div className="country-compare-card-header">
            <div>
              <p className="country-compare-kicker">{bucket.countryCode}</p>
              <h3 className="country-compare-title">No votes yet</h3>
            </div>
            <span className="country-compare-total">0</span>
          </div>
          <p className="country-compare-note">There is no vote data for this country on this question yet.</p>
        </div>
      )
    }

    if (bucket.suppressed) {
      return (
        <div className={`country-compare-card ${variant}`}>
          <div className="country-compare-card-header">
            <div>
              <p className="country-compare-kicker">{bucket.countryCode}</p>
              <h3 className="country-compare-title">Protected sample</h3>
            </div>
            <span className="country-compare-total">{bucket.total}</span>
          </div>
          <p className="country-compare-note">
            There are votes recorded, but the sample is too small to show option-level details.
          </p>
        </div>
      )
    }

    return (
      <div className={`country-compare-card ${variant}`}>
        <div className="country-compare-card-header">
          <div>
            <p className="country-compare-kicker">{bucket.countryCode}</p>
            <h3 className="country-compare-title">
              {variant === 'global' ? 'Global baseline' : 'Country split'}
            </h3>
          </div>
          <span className="country-compare-total">{bucket.total}</span>
        </div>
        <div className="country-compare-list">
          {bucket.options.map(option => (
            <div key={`${bucket.countryCode}-${option.optionId}`} className="country-compare-row">
              <div className="country-compare-row-top">
                <span className="country-compare-option">
                  {optionLabelLookup[option.optionId] ?? 'Option'}
                </span>
                <span className="country-compare-percent">{option.percentage}%</span>
              </div>
              <div className="country-compare-bar" aria-hidden>
                <span style={{ width: `${option.percentage}%` }} />
              </div>
              <span className="country-compare-count">{option.count} votes</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="question-full-bleed">
      <div className="relative min-h-screen overflow-hidden bg-[var(--bg-base)] text-strong">
        <div className="stats-hero">
          <span className="stats-orb one" />
          <span className="stats-orb two" />
          <span className="stats-orb three" />
          <span className="stats-grid" />
        </div>

        <div className="container-page relative z-10 py-12">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.38em] text-muted">Stats lab</p>
              <h1 className="text-3xl font-semibold leading-tight text-strong sm:text-4xl">
                {question.data.title}
              </h1>
              <p className="max-w-2xl text-sm text-muted">
                Watch real-time data in a 3D scene. Aurora grid, depth, vote bubbles, and country distribution come together.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <span className="pill border-[rgba(34,211,238,0.3)] bg-[var(--accent-muted)] text-[var(--accent-strong)]">
                  Total votes: {totalVotes}
                </span>
                <span className="pill">Options: {normalizedOptions.length}</span>
                {typeof viewCount === 'number' ? <span className="pill">Views: {viewCount}</span> : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                to={`/questions/${question.data.id}`}
                className="btn-ghost"
              >
                View question
              </Link>
              <Link
                to="/questions"
                className="btn-primary"
              >
                All questions
              </Link>
            </div>
          </div>

          <div className="mt-10 space-y-8">
            <div className="globe-hero">
              <div className="globe-hero-inner">
                {countryStats.length > 0 ? (
                  <Suspense fallback={<div className="text-sm text-muted">Loading 3D globe...</div>}>
                    <CountryGlobe data={countryStats} />
                  </Suspense>
                ) : (
                  <div className="text-sm text-muted">No country votes yet to display on the globe.</div>
                )}
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
              <div className="stats-panel">
                <div className="stats-panel-header">
                  <div>
                    <p className="text-xs uppercase tracking-[0.32em] text-muted">Vote breakdown</p>
                    <h2 className="text-xl font-semibold text-strong">Option breakdown, gender, age</h2>
                  </div>
                  <span className="text-xs text-muted">{stats.isFetching ? 'Updating...' : 'Live'}</span>
                </div>

                <div className={`vote-board ${normalizedOptions.length <= 3 ? 'is-compact-options' : ''}`}>
                  <div className="vote-option-list">
                    <div className="vote-option-list-head">
                      <p className="vote-option-list-title">Options</p>
                      <p className="vote-option-list-subtitle">Ranked by vote count</p>
                    </div>

                    <div className="vote-option-items">
                      {normalizedOptions.map((option, index) => (
                        <article key={option.id} className="vote-option-item">
                          <div className="vote-option-item-top">
                            <div className="vote-option-item-main">
                              <span className="vote-option-rank">#{index + 1}</span>
                              <div>
                                <p className="vote-option-label">{option.label}</p>
                                <p className="vote-option-votes">{option.count} votes</p>
                              </div>
                            </div>
                            <span className="vote-option-percent">{option.percentage}%</span>
                          </div>
                          <div className="vote-option-track" aria-hidden>
                            <span
                              style={
                                {
                                  width: `${option.percentage}%`,
                                  '--bar-hue': option.hue,
                                  '--bar-delay': `${index * 0.06}s`,
                                } as CSSProperties
                              }
                            />
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>

                  <div className="vote-side">
                    <div className="vote-side-card">
                      <div className="vote-side-headline">
                        <p className="vote-side-title">Gender split</p>
                        <span className="vote-side-live">{genderStats.length ? 'Live' : '-'}</span>
                      </div>
                      {genderStats.length === 0 ? (
                        <p className="text-sm text-muted">No gender data yet.</p>
                      ) : (
                        <div className="gender-grid">
                          {genderStats.map(item => (
                            <div key={item.label} className="gender-card">
                              <div className="split-row">
                                <p className="split-label">{item.label}</p>
                                <span className="split-count">{item.count} votes</span>
                              </div>
                              <div className="gender-meter">
                                <span style={{ width: `${item.percentage}%` }} />
                              </div>
                              <p className="split-value">{item.percentage}%</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="vote-side-card">
                      <div className="vote-side-headline">
                        <p className="vote-side-title">Age bands</p>
                        <span className="vote-side-live">{ageStats.length ? 'Live' : '-'}</span>
                      </div>
                      {ageStats.length === 0 ? (
                        <p className="text-sm text-muted">No age data yet.</p>
                      ) : (
                        <div className="age-grid">
                          {ageStats.map(item => (
                            <div key={item.label} className="age-chip">
                              <div className="split-row">
                                <p className="split-label">{item.label}</p>
                                <span className="split-count">{item.count} votes</span>
                              </div>
                              <div className="age-meter">
                                <span style={{ width: `${item.percentage}%` }} />
                              </div>
                              <p className="split-value">{item.percentage}%</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="stats-panel space-y-6">
                <div className="stats-panel-header">
                  <div>
                    <p className="text-xs uppercase tracking-[0.32em] text-muted">By country</p>
                    <h2 className="text-xl font-semibold text-strong">Geographic distribution</h2>
                  </div>
                  <span className="text-xs text-muted">{stats.isFetching ? 'Updating...' : 'Live'}</span>
                </div>
                <p className="stats-compare-hint">
                  Select two countries to compare their option split.
                </p>

                {countryStats.length === 0 ? (
                  <p className="text-sm text-muted">No country data yet.</p>
                ) : (
                  <>
                    <div className="stats-country-grid">
                      {paginatedCountryStats.map((item, index) => {
                        const globalRank = (countryPage - 1) * COUNTRY_PAGE_SIZE + index + 1
                        return (
                          <button
                            key={item.countryCode}
                            type="button"
                            onClick={() => handleCountrySelect(item.countryCode)}
                            className={`stats-chip stats-chip-button ${
                              selectedCountries.includes(item.countryCode) ? 'is-selected' : ''
                            }`}
                          >
                            <div className="stats-chip-accent" aria-hidden />
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-xs uppercase tracking-[0.32em] text-muted">
                                {item.countryCode}
                              </span>
                              <span className="text-xs text-muted">#{globalRank}</span>
                            </div>
                            <div className="mt-1 flex items-end justify-between">
                              <div>
                                <p className="text-lg font-semibold text-strong">{item.percentage}%</p>
                                <p className="text-xs text-muted">{item.count} votes</p>
                              </div>
                              <div className="stats-chip-meter" aria-hidden>
                                <span style={{ width: `${item.percentage}%` }} />
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>

                    <div className="stats-country-pagination-wrap">
                      <p className="stats-country-pagination-meta">
                        Showing {countryRangeStart}-{countryRangeEnd} of {countryStats.length} countries
                      </p>
                      <div className="stats-country-pagination">
                        <button
                          type="button"
                          className="stats-country-page-btn"
                          onClick={() => setCountryPage(prev => Math.max(1, prev - 1))}
                          disabled={countryPage === 1}
                        >
                          Prev
                        </button>
                        <span className="stats-country-page-indicator">
                          Page {countryPage}/{totalCountryPages}
                        </span>
                        <button
                          type="button"
                          className="stats-country-page-btn"
                          onClick={() => setCountryPage(prev => Math.min(totalCountryPages, prev + 1))}
                          disabled={countryPage === totalCountryPages}
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </>
                )}

                <div className="stats-mini">
                  <div className="stats-mini-card">
                    <p className="text-xs uppercase tracking-[0.3em] text-muted">Top option</p>
                    <p className="text-lg font-semibold text-strong">
                      {normalizedOptions[0]?.label ?? '-'}
                    </p>
                    <p className="text-sm text-muted">
                      {normalizedOptions[0]?.percentage ?? 0}% - {normalizedOptions[0]?.count ?? 0} votes
                    </p>
                  </div>
                  <div className="stats-mini-card">
                    <p className="text-xs uppercase tracking-[0.3em] text-muted">Distinct countries</p>
                    <p className="text-lg font-semibold text-strong">{countryStats.length}</p>
                    <p className="text-sm text-muted">Participating countries</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {showCompareModal && (
          <div className="country-compare-overlay" role="dialog" aria-modal="true" aria-label="Country comparison">
            <button
              type="button"
              className="country-compare-backdrop"
              aria-label="Close country comparison"
              onClick={closeCompareModal}
            />
            <div className="country-compare-modal">
              <div className="country-compare-modal-head">
                <div>
                  <p className="country-compare-modal-kicker">Country compare</p>
                  <h2 className="country-compare-modal-title">
                    {selectedCountries[0]} vs {selectedCountries[1]}
                  </h2>
                  <p className="country-compare-modal-note">
                    Compare how these countries distributed votes across the same question.
                  </p>
                </div>
                <button type="button" onClick={closeCompareModal} className="country-compare-close" aria-label="Close comparison">
                  X
                </button>
              </div>

              {compareQuery.isLoading ? (
                <p className="country-compare-state">Loading comparison...</p>
              ) : compareQuery.isError || !compareQuery.data ? (
                <p className="country-compare-state">Comparison data could not be loaded.</p>
              ) : (
                <>
                  {renderCompareInsights(compareQuery.data)}
                  <div className="country-compare-grid">
                    {renderCompareBucket(compareQuery.data.left, 'left')}
                    {renderCompareBucket(compareQuery.data.right, 'right')}
                    {renderCompareBucket(compareQuery.data.global, 'global')}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}





