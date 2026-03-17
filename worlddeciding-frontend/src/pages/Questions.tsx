import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { fetchQuestionsPage } from '@/entities/question/api/questions'

const PAGE_SIZE = 12

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

  const questions = useQuery({
    queryKey: ['questions-legacy', search, page, PAGE_SIZE],
    queryFn: () => fetchQuestionsPage({ page, take: PAGE_SIZE, search }),
    placeholderData: (previous) => previous,
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

  if (questions.isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-full max-w-lg animate-pulse rounded bg-[var(--surface-muted)]" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={`legacy-question-loading-${index}`} className="h-12 animate-pulse rounded border border-border bg-panel" />
          ))}
        </div>
      </div>
    )
  }
  if (questions.isError) return <p className="text-red-600">Failed to load questions.</p>

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Questions</h1>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <input
          className="input max-w-lg"
          placeholder="Search questions..."
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
        />
        <div className="text-xs text-muted">
          Page {currentPage} / {totalPages} | Total {questions.data?.total ?? 0}
        </div>
      </div>
      {questions.isFetching && !questions.isLoading && (
        <div className="rounded-xl border border-border bg-panel px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted animate-pulse">
          Loading next results...
        </div>
      )}
      <ul className="space-y-2">
        {questions.data?.items.map(q => (
          <li key={q.id} className="bg-white border rounded p-3 hover:shadow-sm">
            <Link to={`/questions/${q.id}`} className="text-blue-700 hover:underline">{q.title}</Link>
          </li>
        ))}
      </ul>
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
          onClick={() => setPage((prev) => prev + 1)}
        >
          {questions.isFetching ? 'Loading...' : 'Next'}
        </button>
      </div>
    </div>
  )
}
