import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  archiveAdminQuestion,
  adminStatusLabel,
  adminTypeLabel,
  getAdminQuestionById,
  publishAdminQuestion,
} from '@/features/admin/api'
import { useToast } from '@/shared/ui/toast'

function formatDate(dateLike: string | null) {
  if (!dateLike) return '-'
  const date = new Date(dateLike)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString()
}

function getErrorMessage(error: unknown) {
  const message = (error as any)?.response?.data?.message || (error as any)?.message
  return typeof message === 'string' && message.trim() ? message : 'Request failed.'
}

function parseTags(tagsJson: string | null) {
  if (!tagsJson) return []
  try {
    const parsed = JSON.parse(tagsJson)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
  } catch {
    return []
  }
}

export default function AdminQuestionDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()

  const detailQuery = useQuery({
    queryKey: ['admin-question', id],
    queryFn: () => getAdminQuestionById(id || ''),
    enabled: !!id,
  })

  const publishMutation = useMutation({
    mutationFn: publishAdminQuestion,
    onSuccess: () => {
      toast.success('Question published.')
      queryClient.invalidateQueries({ queryKey: ['admin-question', id] })
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
      queryClient.invalidateQueries({ queryKey: ['admin-question', id] })
      queryClient.invalidateQueries({ queryKey: ['admin-questions'] })
    },
    onError: (error) => {
      toast.error(getErrorMessage(error))
    },
  })

  const tags = useMemo(() => parseTags(detailQuery.data?.tagsJson ?? null), [detailQuery.data?.tagsJson])

  if (!id) {
    return <div className="card"><div className="card-body">Invalid question id.</div></div>
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-body space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="heading-1">Question Detail</h1>
            <div className="flex gap-2">
              <button className="btn-ghost" onClick={() => navigate(-1)}>
                Back
              </button>
              <Link className="btn-ghost" to="/admin/questions">
                Questions
              </Link>
            </div>
          </div>
          <p className="text-sm text-muted">
            ID: <code>{id}</code>
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-body space-y-4">
          {detailQuery.isLoading ? <p>Loading question...</p> : null}
          {detailQuery.isError ? <p className="text-red-600">{getErrorMessage(detailQuery.error)}</p> : null}

          {detailQuery.data ? (
            <>
              <div className="space-y-2">
                <h2 className="heading-2">{detailQuery.data.title}</h2>
                <div className="grid gap-2 text-sm md:grid-cols-2">
                  <p>
                    <strong>Status:</strong> {adminStatusLabel(detailQuery.data.status)}
                  </p>
                  <p>
                    <strong>Type:</strong> {adminTypeLabel(detailQuery.data.type)}
                  </p>
                  <p>
                    <strong>Category:</strong> {detailQuery.data.categorySlug || '-'}
                  </p>
                  <p>
                    <strong>Language:</strong> {detailQuery.data.language}
                  </p>
                  <p>
                    <strong>Source:</strong> {detailQuery.data.source || '-'}
                  </p>
                  <p>
                    <strong>Created:</strong> {formatDate(detailQuery.data.createdAt)}
                  </p>
                  <p>
                    <strong>Published:</strong> {formatDate(detailQuery.data.publishedAt)}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold">Options</h3>
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {detailQuery.data.options.map((option, index) => (
                    <li key={`${option.text}-${index}`}>{option.text}</li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold">Tags</h3>
                {tags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex rounded-full border border-border bg-panel px-3 py-1 text-xs text-muted"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted">No tags.</p>
                )}
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold">Notes</h3>
                <p className="text-sm text-muted">{detailQuery.data.notes || '-'}</p>
              </div>

              {detailQuery.data.status !== 2 ? (
                <div className="flex flex-wrap gap-2">
                  {detailQuery.data.status === 0 ? (
                    <button
                      className="btn-primary"
                      disabled={publishMutation.isPending || archiveMutation.isPending}
                      onClick={() => publishMutation.mutate(detailQuery.data!.id)}
                    >
                      {publishMutation.isPending ? 'Publishing...' : 'Publish Draft'}
                    </button>
                  ) : null}
                  <button
                    className="btn-ghost"
                    disabled={archiveMutation.isPending || publishMutation.isPending}
                    onClick={() => archiveMutation.mutate(detailQuery.data!.id)}
                  >
                    {archiveMutation.isPending ? 'Archiving...' : 'Archive'}
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
