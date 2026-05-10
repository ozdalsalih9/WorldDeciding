import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { fetchQuestionsPage } from '@/entities/question/api/questions'
import type { QuestionListPage, QuestionListItem } from '@/entities/question/model/types'

const PAGE_SIZE = 12
const SEARCH_FETCH_TAKE = 100
const SEARCH_FETCH_MAX_PAGES = 200

const getQuestionTypeLabel = (type?: number | string) => {
  if (typeof type === 'number') {
    return type === 0 ? 'Either / Or' : `Type ${type}`
  }

  if (!type) return 'Question'
  if (type === '0') return 'Either / Or'
  return type
}

async function fetchQuestionsByClientSearch(search: string, page: number, take: number): Promise<QuestionListPage> {
  const normalizedSearch = search.trim().toLocaleLowerCase()
  const allItems: QuestionListItem[] = []
  let currentPage = 1

  while (currentPage <= SEARCH_FETCH_MAX_PAGES) {
    const response = await fetchQuestionsPage({
      page: currentPage,
      take: SEARCH_FETCH_TAKE,
    })
    allItems.push(...response.items)

    if (!response.hasMore || response.items.length === 0) break
    currentPage += 1
  }

  const deduped = Array.from(new Map(allItems.map(item => [item.id, item])).values())
  const filtered = deduped.filter(item => item.title.toLocaleLowerCase().includes(normalizedSearch))
  const start = (page - 1) * take
  const items = filtered.slice(start, start + take)

  return {
    items,
    total: filtered.length,
    page,
    take,
    hasMore: start + items.length < filtered.length,
  }
}

export default function Questions() {
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = searchInput.trim()
      setSearch((prev) => (prev === next ? prev : next))
      setPage(1)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const loadQuestionsPage = (targetPage: number) =>
    search
      ? fetchQuestionsByClientSearch(search, targetPage, PAGE_SIZE)
      : fetchQuestionsPage({ page: targetPage, take: PAGE_SIZE })

  const questions = useQuery({
    queryKey: ['questions', 'paged', search, page, PAGE_SIZE],
    queryFn: () => loadQuestionsPage(page),
    placeholderData: (previous) => previous,
    staleTime: 20_000,
  })

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((questions.data?.total ?? 0) / PAGE_SIZE)),
    [questions.data?.total]
  )
  const currentPage = page
  const canGoPrev = currentPage > 1
  const canGoNext =
    questions.isFetching
      ? false
      : ((questions.data?.items.length ?? 0) === PAGE_SIZE ||
        currentPage < totalPages ||
        questions.data?.hasMore === true)

  const handleNext = () => {
    if (!canGoNext || questions.isFetching) return
    setPage((prev) => prev + 1)
  }

  if (questions.isLoading) {
    return (
      <div className="space-y-6">
        <div className="card">
          <div className="card-body flex items-center justify-between">
            <div className="h-10 w-full max-w-lg animate-pulse rounded-full bg-[var(--surface-muted)]" />
            <div className="h-4 w-28 animate-pulse rounded bg-[var(--surface-muted)]" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={`question-loading-${index}`} className="rounded-2xl border border-border bg-panel p-5 animate-pulse">
              <div className="h-5 w-24 rounded bg-[var(--surface-muted)]" />
              <div className="mt-4 h-6 w-4/5 rounded bg-[var(--surface-muted)]" />
              <div className="mt-2 h-6 w-2/3 rounded bg-[var(--surface-muted)]" />
              <div className="mt-6 h-4 w-32 rounded bg-[var(--surface-muted)]" />
            </div>
          ))}
        </div>
      </div>
    )
  }
  if (questions.isError) return <div className="card"><div className="card-body text-center text-rose-500">Could not load questions.</div></div>

  return (
    <div className="questions-flow space-y-8">
      <div className="questions-flow-hero">
        <div className="space-y-2">
          <span className="section-heading">Questions</span>
          <h1 className="heading-1">Latest questions</h1>
          <p className="max-w-2xl text-sm text-muted">Scan the newest decisions, filter by title, and open the live vote surface in one step.</p>
        </div>
        <div className="questions-flow-hero-actions">
          <Link to="/binary" className="btn-ghost">Either / Or</Link>
          <Link to="/categories" className="btn-primary">Browse categories</Link>
        </div>
      </div>

      <div className="questions-toolbar">
        <div className="questions-toolbar-main">
          <div className="questions-search-wrap">
            <input
              className="input questions-search"
              placeholder="Search questions..."
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </div>
          <div className="questions-toolbar-meta">
            <span>Page {currentPage} / {totalPages}</span>
            <span>{questions.data?.total ?? 0} total</span>
            {search ? <span>Filtered</span> : <span>Newest first</span>}
          </div>
        </div>
      </div>

      {questions.isFetching && !questions.isLoading && (
        <div className="questions-refresh-strip">
          Loading next results...
        </div>
      )}

      <div className="questions-grid">
        {questions.data?.items.map(q => (
          <Link
            key={q.id}
            to={`/questions/${q.id}`}
            className="questions-list-card group"
          >
            <span className="questions-list-card-glow" aria-hidden />
            <div className="questions-list-card-top">
              <span className="questions-type-pill">{getQuestionTypeLabel(q.type)}</span>
              <span className="questions-open-link">Open</span>
            </div>
            <div className="questions-list-title">{q.title}</div>
            <div className="questions-list-foot">
              <span className="questions-live-dot" aria-hidden />
              <span>Live vote tracking</span>
            </div>
          </Link>
        ))}
      </div>

      {(questions.data?.items.length ?? 0) === 0 && (
        <div className="questions-empty">
          <p>No questions found for current filters.</p>
          <button type="button" className="btn-ghost" onClick={() => setSearchInput('')}>
            Clear search
          </button>
        </div>
      )}

      <div className="questions-pager">
        <button
          type="button"
          className="btn-ghost"
          disabled={!canGoPrev || questions.isFetching}
          onClick={() => setPage((prev) => Math.max(1, prev - 1))}
        >
          Previous
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={!canGoNext || questions.isFetching}
          onClick={handleNext}
        >
          {questions.isFetching ? 'Loading...' : 'Next'}
        </button>
      </div>
    </div>
  )
}
