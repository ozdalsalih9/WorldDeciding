import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { fetchQuestionsPage } from '@/entities/question/api/questions'
import type { QuestionListPage, QuestionListItem } from '@/entities/question/model/types'

const PAGE_SIZE = 12
const SEARCH_FETCH_TAKE = 100
const SEARCH_FETCH_MAX_PAGES = 200

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
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <span className="section-heading">Questions</span>
          <h1 className="heading-1">Latest questions</h1>
          <p className="text-sm text-muted">Search, paginate, and open details without loading the entire dataset.</p>
        </div>
        <Link to="/categories" className="btn-primary">Browse categories</Link>
      </div>

      <div className="card">
        <div className="card-body flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex w-full max-w-lg gap-2">
            <input
              className="input"
              placeholder="Search questions..."
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </div>
          <div className="text-xs text-muted">
            Page {currentPage} / {totalPages} | Total {questions.data?.total ?? 0}
          </div>
        </div>
      </div>

      {questions.isFetching && !questions.isLoading && (
        <div className="card">
          <div className="card-body py-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted animate-pulse">
            Loading next results...
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {questions.data?.items.map(q => (
          <Link
            key={q.id}
            to={`/questions/${q.id}`}
            className="group relative overflow-hidden rounded-2xl border border-border bg-panel p-5 shadow-[0_18px_50px_rgba(15,23,42,0.12)] transition hover:-translate-y-1 hover:border-[rgba(34,211,238,0.3)]"
          >
            <div className="absolute inset-0 bg-[var(--accent-muted)] opacity-0 transition duration-300 group-hover:opacity-100" />
            <div className="relative flex items-center justify-between gap-3">
              <span className="rounded-full border border-border bg-panel px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-muted">Question</span>
              <span className="text-xs text-[var(--accent-strong)] transition group-hover:text-[var(--accent)]">Details -</span>
            </div>
            <div className="relative mt-3 text-lg font-semibold leading-snug text-strong">{q.title}</div>
            <div className="relative mt-4 flex items-center gap-2 text-xs text-muted">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--accent)]" />
              <span>Live vote tracking</span>
            </div>
          </Link>
        ))}
      </div>

      {(questions.data?.items.length ?? 0) === 0 && (
        <div className="card">
          <div className="card-body text-center text-muted">No questions found for current filters.</div>
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
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
