import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { fetchCategoryById, fetchCategoryQuestionsPage } from '@/entities/category/api/categories'
import type { Category } from '@/entities/category/model/types'
import type { QuestionListPage } from '@/entities/question/model/types'

const PAGE_SIZE = 12

export default function CategoryQuestionsPage() {
  const { categoryId = '' } = useParams<{ categoryId: string }>()
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

  useEffect(() => {
    setPage(1)
  }, [categoryId])

  const category = useQuery<Category>({
    queryKey: ['category', categoryId],
    queryFn: () => fetchCategoryById(categoryId),
    enabled: Boolean(categoryId),
  })

  const questions = useQuery<QuestionListPage>({
    queryKey: ['category-questions', categoryId, search, page, PAGE_SIZE],
    queryFn: () =>
      fetchCategoryQuestionsPage({
        categoryId,
        page,
        take: PAGE_SIZE,
        search,
      }),
    enabled: Boolean(categoryId),
    placeholderData: (previous) => previous,
  })

  const headingSlug = useMemo(() => category.data?.slug ?? 'Category', [category.data?.slug])
  const headingName = useMemo(() => category.data?.name ?? 'Questions', [category.data?.name])
  const totalPages = Math.max(1, Math.ceil((questions.data?.total ?? 0) / PAGE_SIZE))
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

  return (
    <section className="category-questions question-full-bleed">
      <div className="category-questions-inner container-page">
        <div className="category-questions-header">
          <div>
            <p className="section-heading">{headingSlug}</p>
            <h2 className="heading-2 mt-1">{headingName}</h2>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/categories" className="btn-ghost">All categories</Link>
            {questions.isFetching ? <span className="text-xs text-muted animate-pulse">Refreshing...</span> : null}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex w-full max-w-lg gap-2">
            <input
              className="input"
              placeholder="Search by question name..."
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </div>
          <div className="text-xs text-muted">
            Page {currentPage} / {totalPages} | Total {questions.data?.total ?? 0}
          </div>
        </div>

        {questions.isFetching && !questions.isLoading ? (
          <div className="mt-3 rounded-xl border border-border bg-panel px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted animate-pulse">
            Loading category questions...
          </div>
        ) : null}

        {questions.isLoading || category.isLoading ? (
          <div className="category-questions-grid">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={`category-loading-${index}`} className="question-card animate-pulse">
                <div className="question-card-content">
                  <div className="question-card-meta">
                    <span className="question-card-label">Question</span>
                  </div>
                  <div className="mt-3 h-5 w-4/5 rounded bg-[var(--surface-muted)]" />
                  <div className="mt-2 h-5 w-3/5 rounded bg-[var(--surface-muted)]" />
                </div>
              </div>
            ))}
          </div>
        ) : questions.isError || category.isError ? (
          <p className="text-rose-500 text-sm">Could not load this category or its questions.</p>
        ) : (questions.data?.items.length ?? 0) === 0 ? (
          <div className="text-muted">
            <p>No published questions found in this category yet.</p>
            <Link to="/questions" className="btn-link text-sm">Browse all questions</Link>
          </div>
        ) : (
          <div className="category-questions-grid">
            {questions.data?.items.map(question => (
              <Link
                key={question.id}
                to={`/questions/${question.id}`}
                className="question-card"
              >
                <div className="question-card-glow" />
                <div className="question-card-content">
                  <div className="question-card-meta">
                    <span className="question-card-label">Question</span>
                    <span className="question-card-action">View -&gt;</span>
                  </div>
                  <p className="question-card-title">{question.title}</p>
                </div>
              </Link>
            ))}
          </div>
        )}

        {!questions.isLoading && !questions.isError ? (
          <div className="mt-6 flex items-center justify-end gap-2">
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
        ) : null}
      </div>
    </section>
  )
}
