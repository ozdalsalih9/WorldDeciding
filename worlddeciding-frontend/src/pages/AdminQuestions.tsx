import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  archiveAdminQuestion,
  adminStatusLabel,
  adminTypeLabel,
  getAdminQuestions,
  publishAdminQuestion,
  type AdminQuestionStatusFilter,
} from '@/features/admin/api'
import { useToast } from '@/shared/ui/toast'

function formatDate(dateLike: string) {
  const date = new Date(dateLike)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString()
}

function getErrorMessage(error: unknown) {
  const message = (error as any)?.response?.data?.message || (error as any)?.message
  return typeof message === 'string' && message.trim() ? message : 'Request failed.'
}

export default function AdminQuestions() {
  const toast = useToast()
  const queryClient = useQueryClient()

  const [status, setStatus] = useState<AdminQuestionStatusFilter>('Draft')
  const [language, setLanguage] = useState('en')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 20

  const queryKey = useMemo(
    () => ['admin-questions', { status, language, search, page, pageSize }] as const,
    [status, language, search, page]
  )

  const listQuery = useQuery({
    queryKey,
    queryFn: () => getAdminQuestions({ status, language: language.trim() || 'en', search, page, pageSize }),
  })

  const publishMutation = useMutation({
    mutationFn: publishAdminQuestion,
    onSuccess: () => {
      toast.success('Question published.')
      queryClient.invalidateQueries({ queryKey: ['admin-questions'] })
    },
    onError: (error) => {
      toast.error(getErrorMessage(error))
    },
  })

  const archiveMutation = useMutation({
    mutationFn: archiveAdminQuestion,
    onSuccess: () => {
      toast.success('Question archived.')
      queryClient.invalidateQueries({ queryKey: ['admin-questions'] })
    },
    onError: (error) => {
      toast.error(getErrorMessage(error))
    },
  })

  const totalPages = Math.max(1, Math.ceil((listQuery.data?.total ?? 0) / pageSize))

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-body space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="heading-1">Admin Questions</h1>
            <Link className="btn-ghost" to="/admin/questions/import">
              Go to Import
            </Link>
          </div>
          <p className="text-sm text-muted">
            Default filters: status Draft, language en.
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <form
            className="grid grid-cols-1 gap-3 md:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault()
              setPage(1)
              setSearch(searchInput.trim())
            }}
          >
            <div>
              <label className="label">Status</label>
              <select
                className="input"
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as AdminQuestionStatusFilter)
                  setPage(1)
                }}
              >
                <option value="Draft">Draft</option>
                <option value="Published">Published</option>
                <option value="Archived">Archived</option>
              </select>
            </div>

            <div>
              <label className="label">Language</label>
              <input
                className="input"
                value={language}
                onChange={(event) => {
                  setLanguage(event.target.value)
                  setPage(1)
                }}
                placeholder="en"
              />
            </div>

            <div>
              <label className="label">Search</label>
              <input
                className="input"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Contains title..."
              />
            </div>

            <div className="flex items-end gap-2">
              <button className="btn-primary" type="submit">
                Apply
              </button>
              <button
                className="btn-ghost"
                type="button"
                onClick={() => {
                  setStatus('Draft')
                  setLanguage('en')
                  setSearchInput('')
                  setSearch('')
                  setPage(1)
                }}
              >
                Reset
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="card-body space-y-4">
          {listQuery.isLoading ? <p>Loading questions...</p> : null}
          {listQuery.isError ? <p className="text-red-600">{getErrorMessage(listQuery.error)}</p> : null}

          {listQuery.data ? (
            <>
              <div className="text-sm text-muted">
                Total: {listQuery.data.total} | Page {listQuery.data.page} / {totalPages}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted">
                      <th className="py-2 pr-3">Title</th>
                      <th className="py-2 pr-3">Type</th>
                      <th className="py-2 pr-3">Category</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-3">Language</th>
                      <th className="py-2 pr-3">Created</th>
                      <th className="py-2 pr-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listQuery.data.items.map((item) => (
                      <tr key={item.id} className="border-t border-border">
                        <td className="py-2 pr-3 align-top">
                          <Link to={`/admin/questions/${item.id}`} className="btn-link">
                            {item.title}
                          </Link>
                        </td>
                        <td className="py-2 pr-3 align-top">{adminTypeLabel(item.type)}</td>
                        <td className="py-2 pr-3 align-top">{item.categorySlug || '-'}</td>
                        <td className="py-2 pr-3 align-top">{adminStatusLabel(item.status)}</td>
                        <td className="py-2 pr-3 align-top">{item.language}</td>
                        <td className="py-2 pr-3 align-top">{formatDate(item.createdAt)}</td>
                        <td className="py-2 pr-3 align-top">
                          <div className="flex flex-wrap gap-2">
                            {item.status === 0 ? (
                              <button
                                className="btn-ghost"
                                disabled={publishMutation.isPending || archiveMutation.isPending}
                                onClick={() => publishMutation.mutate(item.id)}
                              >
                                {publishMutation.isPending ? 'Publishing...' : 'Publish'}
                              </button>
                            ) : null}
                            {item.status !== 2 ? (
                              <button
                                className="btn-ghost"
                                disabled={archiveMutation.isPending || publishMutation.isPending}
                                onClick={() => archiveMutation.mutate(item.id)}
                              >
                                {archiveMutation.isPending ? 'Archiving...' : 'Archive'}
                              </button>
                            ) : null}
                            {item.status === 2 ? <span className="text-muted">-</span> : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {listQuery.data.items.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-5 text-center text-muted">
                          No questions found for current filters.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center gap-2">
                <button
                  className="btn-ghost"
                  disabled={page <= 1}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                >
                  Previous
                </button>
                <button
                  className="btn-ghost"
                  disabled={page >= totalPages}
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                >
                  Next
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
