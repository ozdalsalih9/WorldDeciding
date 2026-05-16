import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { InfiniteData } from '@tanstack/react-query'
import { createPortal } from 'react-dom'
import api from '@/shared/api/client'
import type { Question, QuestionStats } from '@/entities/question/model/types'
import useAuth from '@/features/auth'
import useToast from '@/shared/ui/toast/useToast'
import { voteOnQuestion } from '@/features/vote/api/vote'
import { fetchCategoryQuestions } from '@/entities/category/api/categories'
import { fetchQuestionSummary, fetchQuestionsPage } from '@/entities/question/api/questions'

type CommentDto = {
  id: string
  questionId: string
  author?: {
    userId: string
    displayName?: string | null
    avatarUrl?: string | null
    stars?: number | null
    rank?: string | null
  } | null
  userId?: string
  displayName?: string | null
  avatarUrl?: string | null
  stars?: number | null
  rank?: string | null
  parentId: string | null
  text: string
  createdAt: string
  likeCount: number
  likedByMe: boolean
  replyCount?: number
}

type PagedResult<T> = {
  items: T[]
  page: number
  take: number
  hasMore: boolean
}

const COMMENT_TAKE = 20
const COMMENT_MAX_LENGTH = 2000
const PERCENTAGE_ANIMATION_DURATION_MS = 650
const PERCENTAGE_ANIMATION_FRAME_MS = 80

const SUMMARY_REFRESH_MESSAGE = 'Summary is refreshing, please wait a moment.'

const arePercentagesEqual = (left: Record<string, number>, right: Record<string, number>) => {
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  if (leftKeys.length !== rightKeys.length) return false
  return leftKeys.every(key => left[key] === right[key])
}

const formatCommentTimestamp = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString()
}

const normalizeSummaryLines = (summary: string) =>
  summary
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => line.replace(/^[\u2022\-*]\s*/, ''))

const formatCommentAuthor = (userId: string | null | undefined, displayName?: string | null) => {
  if (displayName?.trim()) return displayName
  const safeId = userId?.trim() || 'member'
  return `Member ${safeId.slice(0, 6)}`
}

const getCommentInitials = (value: string) => {
  const clean = value.trim()
  if (!clean) return 'WD'
  const parts = clean.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
}

type CommentAuthorProps = {
  userId?: string | null
  displayName?: string | null
  avatarUrl?: string | null
  stars?: number | null
  rank?: string | null
  createdAt: string
}

function CommentAuthor({ userId, displayName, avatarUrl, stars, rank, createdAt }: CommentAuthorProps) {
  const [avatarFailed, setAvatarFailed] = useState(false)
  const resolvedUserId = userId?.trim() || ''
  const authorName = formatCommentAuthor(resolvedUserId, displayName)
  const resolvedAvatar = avatarFailed ? null : (avatarUrl ?? null)
  const normalizedRank = rank?.trim() || 'Unranked'
  const normalizedStars = Math.max(0, Math.min(5, Number.isFinite(stars) ? Number(stars) : 0))

  return (
    <div className="comment-meta">
      {resolvedUserId ? (
        <Link to={`/profile/${encodeURIComponent(resolvedUserId)}`} className="comment-author-link">
          <span className="comment-avatar" aria-hidden>
            {resolvedAvatar ? (
              <img src={resolvedAvatar} alt={`${authorName} avatar`} onError={() => setAvatarFailed(true)} />
            ) : (
              <span>{getCommentInitials(authorName)}</span>
            )}
          </span>
          <span className="comment-author-main">
            <span className="comment-author">{authorName}</span>
            <span className="comment-author-badges">
              <span className="comment-author-pill">{normalizedRank}</span>
              <span className="comment-author-pill">Stars {normalizedStars}/5</span>
            </span>
          </span>
        </Link>
      ) : (
        <span className="comment-author-link">
          <span className="comment-avatar" aria-hidden>
            {resolvedAvatar ? (
              <img src={resolvedAvatar} alt={`${authorName} avatar`} onError={() => setAvatarFailed(true)} />
            ) : (
              <span>{getCommentInitials(authorName)}</span>
            )}
          </span>
          <span className="comment-author-main">
            <span className="comment-author">{authorName}</span>
            <span className="comment-author-badges">
              <span className="comment-author-pill">{normalizedRank}</span>
              <span className="comment-author-pill">Stars {normalizedStars}/5</span>
            </span>
          </span>
        </span>
      )}
      <span className="comment-time">{formatCommentTimestamp(createdAt)}</span>
    </div>
  )
}

const getCommentAuthor = (comment: CommentDto) => ({
  userId: comment.author?.userId ?? comment.userId ?? '',
  displayName: comment.author?.displayName ?? comment.displayName,
  avatarUrl: comment.author?.avatarUrl ?? comment.avatarUrl,
  stars: comment.author?.stars ?? comment.stars ?? 0,
  rank: comment.author?.rank ?? comment.rank ?? 'Unranked',
})

const updateCommentInInfinite = (
  data: InfiniteData<PagedResult<CommentDto>> | undefined,
  commentId: string,
  updater: (comment: CommentDto) => CommentDto
) => {
  if (!data) return data
  return {
    ...data,
    pages: data.pages.map(page => ({
      ...page,
      items: page.items.map(item => (item.id === commentId ? updater(item) : item)),
    })),
  }
}

const prependCommentToInfinite = (
  data: InfiniteData<PagedResult<CommentDto>> | undefined,
  comment: CommentDto
) => {
  if (!data) {
    return {
      pageParams: [1],
      pages: [{ items: [comment], page: 1, take: COMMENT_TAKE, hasMore: false }],
    }
  }
  if (!data.pages.length) {
    return {
      ...data,
      pages: [{ items: [comment], page: 1, take: COMMENT_TAKE, hasMore: false }],
    }
  }
  return {
    ...data,
    pages: [
      {
        ...data.pages[0],
        items: [comment, ...data.pages[0].items],
      },
      ...data.pages.slice(1),
    ],
  }
}

const appendCommentToInfinite = (
  data: InfiniteData<PagedResult<CommentDto>> | undefined,
  comment: CommentDto
) => {
  if (!data) {
    return {
      pageParams: [1],
      pages: [{ items: [comment], page: 1, take: COMMENT_TAKE, hasMore: false }],
    }
  }
  if (!data.pages.length) {
    return {
      ...data,
      pages: [{ items: [comment], page: 1, take: COMMENT_TAKE, hasMore: false }],
    }
  }
  const lastIndex = data.pages.length - 1
  return {
    ...data,
    pages: data.pages.map((page, index) =>
      index === lastIndex
        ? {
            ...page,
            items: [...page.items, comment],
          }
        : page
    ),
  }
}

type CommentRepliesProps = {
  parentId: string
  isExpanded: boolean
  pendingLikeIds: Set<string>
  onLike: (commentId: string) => void
}

function CommentReplies({ parentId, isExpanded, pendingLikeIds, onLike }: CommentRepliesProps) {
  const replies = useInfiniteQuery<PagedResult<CommentDto>, Error>({
    queryKey: ['comment-replies', parentId],
    queryFn: async ({ pageParam }) =>
      (
        await api.get<PagedResult<CommentDto>>(`/api/comments/${parentId}/replies`, {
          params: { page: pageParam, take: COMMENT_TAKE },
        })
      ).data,
    enabled: isExpanded,
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
  })

  const replyItems = useMemo(
    () => replies.data?.pages.flatMap(page => page.items) ?? [],
    [replies.data]
  )

  if (!isExpanded) return null

  return (
    <div className="comment-replies">
      {replies.isLoading ? (
        <p className="comment-empty">Loading replies...</p>
      ) : replies.isError ? (
        <p className="comment-empty text-rose-600">Replies could not be loaded.</p>
      ) : replyItems.length === 0 ? (
        <p className="comment-empty">No replies yet.</p>
      ) : (
        replyItems.map(reply => {
          const author = getCommentAuthor(reply)
          return (
            <div key={reply.id} className="comment-reply-card">
              <CommentAuthor
                userId={author.userId}
                displayName={author.displayName}
                avatarUrl={author.avatarUrl}
                stars={author.stars}
                rank={author.rank}
                createdAt={reply.createdAt}
              />
              <p className="comment-body">{reply.text}</p>
              <div className="comment-actions">
                <button
                  type="button"
                  onClick={() => onLike(reply.id)}
                  disabled={pendingLikeIds.has(reply.id)}
                  className={`comment-like ${reply.likedByMe ? 'is-liked' : ''}`}
                >
                  {reply.likedByMe ? 'Liked' : 'Like'} - {reply.likeCount}
                </button>
              </div>
            </div>
          )
        })
      )}
      {replies.hasNextPage && (
        <button
          type="button"
          onClick={() => replies.fetchNextPage()}
          disabled={replies.isFetchingNextPage}
          className="comment-load-more"
        >
          {replies.isFetchingNextPage ? 'Loading replies...' : 'Load more replies'}
        </button>
      )}
    </div>
  )
}

export default function QuestionDetail() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { isAuthenticated } = useAuth()
  const toast = useToast()
  const [selected, setSelected] = useState<string | null>(null)
  const [celebrate, setCelebrate] = useState(false)
  const [showPostVotePrompt, setShowPostVotePrompt] = useState(false)
  const [showAuthPrompt, setShowAuthPrompt] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(6)
  const [voteError, setVoteError] = useState<string | null>(null)
  const [showVoteSuccessFeedback, setShowVoteSuccessFeedback] = useState(false)
  const [showVoteConfirm, setShowVoteConfirm] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [commentSort, setCommentSort] = useState<'top' | 'new'>('top')
  const [showSummary, setShowSummary] = useState(false)
  const [newCommentText, setNewCommentText] = useState('')
  const [commentError, setCommentError] = useState<string | null>(null)
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [replyError, setReplyError] = useState<string | null>(null)
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({})
  const [pendingLikeIds, setPendingLikeIds] = useState<Set<string>>(new Set())
  const [animatedPercentages, setAnimatedPercentages] = useState<Record<string, number>>({})
  const celebrationTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const voteSuccessTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const postVotePromptDelayTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const postVoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const postVoteInterval = useRef<ReturnType<typeof setInterval> | null>(null)
  const percentageAnimationFrame = useRef<number | null>(null)
  const percentageAnimationPending = useRef(false)
  const animatedPercentagesRef = useRef<Record<string, number>>({})

  useEffect(() => {
    return () => {
      if (celebrationTimer.current) clearTimeout(celebrationTimer.current)
      if (voteSuccessTimer.current) clearTimeout(voteSuccessTimer.current)
      if (postVotePromptDelayTimer.current) clearTimeout(postVotePromptDelayTimer.current)
      if (postVoteTimer.current) clearTimeout(postVoteTimer.current)
      if (postVoteInterval.current) clearInterval(postVoteInterval.current)
      if (typeof window !== 'undefined' && percentageAnimationFrame.current !== null) {
        window.cancelAnimationFrame(percentageAnimationFrame.current)
      }
    }
  }, [])

  const triggerCelebration = () => {
    setCelebrate(true)
    if (celebrationTimer.current) clearTimeout(celebrationTimer.current)
    celebrationTimer.current = setTimeout(() => setCelebrate(false), 1800)
  }

  const clearVoteSuccessFeedback = () => {
    if (voteSuccessTimer.current) clearTimeout(voteSuccessTimer.current)
    voteSuccessTimer.current = null
    setShowVoteSuccessFeedback(false)
  }

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

  const categoryId = question.data?.categoryId ?? question.data?.category?.id
  const categoryQuestions = useQuery({
    queryKey: ['category-questions', categoryId],
    queryFn: () => fetchCategoryQuestions(categoryId as string),
    enabled: !!categoryId,
  })

  const fallbackQuestions = useQuery({
    queryKey: ['questions', 'next-fallback', id],
    queryFn: () => fetchQuestionsPage({ page: 1, take: 100 }),
    enabled: !!id && !categoryId,
    staleTime: 30_000,
  })

  const questionId = id ?? ''

  const rootComments = useInfiniteQuery<PagedResult<CommentDto>, Error>({
    queryKey: ['comments', questionId, commentSort],
    queryFn: async ({ pageParam }) =>
      (
        await api.get<PagedResult<CommentDto>>(`/api/questions/${questionId}/comments`, {
          params: { sort: commentSort, page: pageParam, take: COMMENT_TAKE },
        })
      ).data,
    enabled: showComments && !!questionId,
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
  })

  const summaryQuery = useQuery({
    queryKey: ['question-summary', questionId],
    queryFn: () => fetchQuestionSummary(questionId),
    enabled: false,
    retry: false,
  })

  const rootCommentItems = useMemo(
    () => rootComments.data?.pages.flatMap(page => page.items) ?? [],
    [rootComments.data]
  )
  const rootCommentCount = rootComments.data ? rootCommentItems.length : null
  const summaryLines = useMemo(
    () => normalizeSummaryLines(summaryQuery.data?.summary ?? ''),
    [summaryQuery.data?.summary]
  )

  const resolveCommentError = (error: any, fallback: string) => {
    const status = error?.response?.status
    const data = error?.response?.data
    const message =
      typeof data === 'string'
        ? data
        : data?.message || data?.title || data?.error || null
    if (status === 401) return 'Please login to continue.'
    if (message) return message
    return fallback
  }

  const summaryErrorMessage = useMemo(() => {
    if (!summaryQuery.error) return null
    const status = (summaryQuery.error as any)?.response?.status
    if (status === 429) return SUMMARY_REFRESH_MESSAGE
    return resolveCommentError(summaryQuery.error, 'Discussion summary is unavailable right now.')
  }, [summaryQuery.error])
  const summaryToggleLabel = summaryQuery.isFetching
    ? 'AI analyzing'
    : showSummary
      ? 'Hide AI summary'
      : summaryQuery.data
        ? 'Show AI summary'
        : 'Generate AI summary'

  const postComment = async (payload: { text: string; parentId: string | null }) =>
    (
      await api.post<CommentDto>(`/api/questions/${questionId}/comments`, payload)
    ).data

  const createComment = useMutation({
    mutationFn: async (text: string) => postComment({ text, parentId: null }),
    onSuccess: (created) => {
      queryClient.setQueryData<InfiniteData<PagedResult<CommentDto>>>(
        ['comments', questionId, commentSort],
        (old) => prependCommentToInfinite(old, created)
      )
      setNewCommentText('')
      setCommentError(null)
    },
    onError: (error) => {
      setCommentError(resolveCommentError(error, 'Comment could not be posted.'))
    },
  })

  const createReply = useMutation({
    mutationFn: async (payload: { parentId: string; text: string }) =>
      postComment({ text: payload.text, parentId: payload.parentId }),
    onSuccess: (created, variables) => {
      queryClient.setQueryData<InfiniteData<PagedResult<CommentDto>>>(
        ['comment-replies', variables.parentId],
        (old) => appendCommentToInfinite(old, created)
      )
      queryClient.setQueriesData(
        { queryKey: ['comments', questionId] },
        (old) =>
          updateCommentInInfinite(
            old as InfiniteData<PagedResult<CommentDto>> | undefined,
            variables.parentId,
            (comment) => ({
              ...comment,
              replyCount: (comment.replyCount ?? 0) + 1,
            })
          )
      )
      setReplyText('')
      setReplyError(null)
      setActiveReplyId(null)
    },
    onError: (error) => {
      setReplyError(resolveCommentError(error, 'Reply failed. Please try again.'))
    },
  })

  const vote = useMutation({
    mutationFn: async (payload: { questionId: string; optionId: string }) => voteOnQuestion(payload),
    onMutate: () => {
      setVoteError(null)
      clearVoteSuccessFeedback()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['question-stats', id] })
      percentageAnimationPending.current = true
      triggerCelebration()
      setShowVoteSuccessFeedback(true)
      toast.success('Vote submitted.')
      if (voteSuccessTimer.current) clearTimeout(voteSuccessTimer.current)
      voteSuccessTimer.current = setTimeout(() => {
        setShowVoteSuccessFeedback(false)
        voteSuccessTimer.current = null
      }, 2600)
      clearPostVoteTimers()
      postVotePromptDelayTimer.current = setTimeout(() => {
        setShowPostVotePrompt(true)
        postVotePromptDelayTimer.current = null
      }, 2500)
    },
    onError: (error: any) => {
      const status = error?.response?.status
      const data = error?.response?.data
      const message =
        typeof data === 'string'
          ? data
          : data?.message || data?.title || data?.error || null
      if (status === 401) {
        setVoteError('Please login to vote.')
        return
      }
      if (status === 400 || status === 409) {
        setVoteError(message || 'Vote could not be accepted.')
        return
      }
      if (status && status >= 500 && message) {
        setVoteError(message)
        return
      }
      setVoteError('Something went wrong, please try again.')
    },
  })

  const statsLookup = useMemo(() => {
    if (!stats.data) return {}
    return stats.data.options.reduce<Record<string, QuestionStats['options'][number]>>((acc, item) => {
      acc[item.optionId] = item
      return acc
    }, {})
  }, [stats.data])

  const nextQuestionId = useMemo(() => {
    if (!id) return null

    const scopedQuestions = categoryQuestions.data?.length
      ? categoryQuestions.data
      : fallbackQuestions.data?.items ?? []

    if (scopedQuestions.length < 2) return null

    const currentIndex = scopedQuestions.findIndex(item => item.id === id)
    if (currentIndex === -1) {
      return scopedQuestions.find(item => item.id !== id)?.id ?? null
    }
    const next = scopedQuestions[(currentIndex + 1) % scopedQuestions.length]
    return next.id === id ? null : next.id
  }, [categoryQuestions.data, fallbackQuestions.data?.items, id])

  const isFindingNextQuestion = categoryQuestions.isLoading || fallbackQuestions.isLoading

  const clearPostVoteTimers = () => {
    if (postVotePromptDelayTimer.current) clearTimeout(postVotePromptDelayTimer.current)
    if (postVoteTimer.current) clearTimeout(postVoteTimer.current)
    if (postVoteInterval.current) clearInterval(postVoteInterval.current)
    postVotePromptDelayTimer.current = null
    postVoteTimer.current = null
    postVoteInterval.current = null
  }

  function getPercent(optionId: string) {
    const optionStats = statsLookup[optionId]
    if (!optionStats) return 0
    if (typeof optionStats.percentage === 'number') return Math.round(optionStats.percentage)
    if (typeof optionStats.ratio === 'number') return Math.round(optionStats.ratio * 100)
    const totalVotes =
      stats.data?.totalVotes ??
      stats.data?.options.reduce((sum, item) => sum + (item.count ?? 0), 0) ??
      0
    if (!totalVotes) return 0
    return Math.round(((optionStats.count ?? 0) / totalVotes) * 100)
  }

  useEffect(() => {
    const questionOptions = question.data?.options ?? []
    const targets = questionOptions.reduce<Record<string, number>>((acc, option) => {
      acc[option.id] = getPercent(option.id)
      return acc
    }, {})

    if (typeof window !== 'undefined' && percentageAnimationFrame.current !== null) {
      window.cancelAnimationFrame(percentageAnimationFrame.current)
      percentageAnimationFrame.current = null
    }

    if (!questionOptions.length) {
      if (!arePercentagesEqual(animatedPercentagesRef.current, {})) {
        animatedPercentagesRef.current = {}
        setAnimatedPercentages({})
      }
      percentageAnimationPending.current = false
      return
    }

    if (!percentageAnimationPending.current || stats.isLoading) {
      if (!arePercentagesEqual(animatedPercentagesRef.current, targets)) {
        animatedPercentagesRef.current = targets
        setAnimatedPercentages(targets)
      }
      return
    }

    percentageAnimationPending.current = false

    if (typeof window === 'undefined') {
      if (!arePercentagesEqual(animatedPercentagesRef.current, targets)) {
        animatedPercentagesRef.current = targets
        setAnimatedPercentages(targets)
      }
      return
    }

    const startValues = questionOptions.reduce<Record<string, number>>((acc, option) => {
      acc[option.id] = animatedPercentagesRef.current[option.id] ?? 0
      return acc
    }, {})

    const startedAt = window.performance.now()
    let lastPaintAt = startedAt - PERCENTAGE_ANIMATION_FRAME_MS

    const step = (now: number) => {
      const elapsed = now - startedAt
      const progress = Math.min(1, elapsed / PERCENTAGE_ANIMATION_DURATION_MS)
      const eased = 1 - Math.pow(1 - progress, 3)
      const nextValues = questionOptions.reduce<Record<string, number>>((acc, option) => {
        const startValue = startValues[option.id] ?? 0
        const targetValue = targets[option.id] ?? 0
        acc[option.id] = Math.round(startValue + (targetValue - startValue) * eased)
        return acc
      }, {})

      if (now - lastPaintAt >= PERCENTAGE_ANIMATION_FRAME_MS || progress >= 1) {
        lastPaintAt = now
        const valuesToPaint = progress >= 1 ? targets : nextValues
        if (!arePercentagesEqual(animatedPercentagesRef.current, valuesToPaint)) {
          animatedPercentagesRef.current = valuesToPaint
          setAnimatedPercentages(valuesToPaint)
        }
      }

      if (progress < 1) {
        percentageAnimationFrame.current = window.requestAnimationFrame(step)
      } else {
        percentageAnimationFrame.current = null
      }
    }

    percentageAnimationFrame.current = window.requestAnimationFrame(step)
  }, [question.data, stats.data, stats.isLoading, statsLookup])

  useEffect(() => {
    setSelected(null)
    setShowPostVotePrompt(false)
    setSecondsLeft(6)
    setVoteError(null)
    clearVoteSuccessFeedback()
    clearPostVoteTimers()
    setShowComments(false)
    setCommentSort('top')
    setShowSummary(false)
    setNewCommentText('')
    setCommentError(null)
    setActiveReplyId(null)
    setReplyText('')
    setReplyError(null)
    setExpandedReplies({})
    setPendingLikeIds(new Set())
    percentageAnimationPending.current = false
  }, [id])

  useEffect(() => {
    if (!question.data?.id) return
    void api.post(`/api/questions/${question.data.id}/view`).catch(() => {})
  }, [question.data?.id])

  useEffect(() => {
    if (!showPostVotePrompt) return
    setSecondsLeft(6)
    clearPostVoteTimers()
    if (!nextQuestionId) return
    postVoteInterval.current = setInterval(() => {
      setSecondsLeft(prev => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    postVoteTimer.current = setTimeout(() => {
      navigate(`/questions/${nextQuestionId}`)
    }, 6000)
    return clearPostVoteTimers
  }, [navigate, nextQuestionId, showPostVotePrompt])

  useEffect(() => {
    setShowAuthPrompt(!isAuthenticated)
  }, [id, isAuthenticated])

  if (question.isLoading) {
    return (
      <div className="min-h-screen grid place-items-center bg-[var(--bg-base)] text-strong">
        <p className="text-lg tracking-wide animate-pulse">Loading question...</p>
      </div>
    )
  }

  if (question.isError || !question.data) {
    return <p className="text-center text-red-500">Question could not be found.</p>
  }

  const options = question.data.options ?? []

  const submitVote = (optionId: string) => {
    if (!question.data || vote.isPending) return
    if (!isAuthenticated) {
      setVoteError('Please login to vote.')
      return
    }
    vote.mutate({ questionId: question.data.id, optionId })
  }

  const handleSendVote = () => {
    if (!selected || vote.isPending) return
    if (!isAuthenticated) {
      setVoteError('Please login to vote.')
      return
    }
    setShowVoteConfirm(true)
  }

  const handleConfirmVote = () => {
    if (!selected || vote.isPending) return
    setShowVoteConfirm(false)
    submitVote(selected)
  }

  const handleCancelVoteConfirm = () => {
    if (vote.isPending) return
    setShowVoteConfirm(false)
  }

  const handleSubmitComment = () => {
    if (!questionId || createComment.isPending) return
    const trimmed = newCommentText.trim()
    if (!trimmed) {
      setCommentError('Comment cannot be empty.')
      return
    }
    if (trimmed.length > COMMENT_MAX_LENGTH) {
      setCommentError(`Comment must be ${COMMENT_MAX_LENGTH} characters or less.`)
      return
    }
    if (!isAuthenticated) {
      setCommentError('Please login to comment.')
      return
    }
    createComment.mutate(trimmed)
  }

  const handleToggleSummary = () => {
    if (!questionId) return
    if (!isAuthenticated) {
      setShowAuthPrompt(true)
      toast.info('Sign in to use the AI summary.')
      return
    }
    if (showSummary) {
      setShowSummary(false)
      return
    }
    setShowSummary(true)
    if (!summaryQuery.data && !summaryQuery.isFetching) {
      void summaryQuery.refetch()
    }
  }

  const handleReplyToggle = (commentId: string) => {
    setExpandedReplies((prev) => ({
      ...prev,
      [commentId]: !prev[commentId],
    }))
  }

  const handleReplyStart = (commentId: string) => {
    setActiveReplyId(commentId)
    setReplyText('')
    setReplyError(null)
    setExpandedReplies((prev) => ({
      ...prev,
      [commentId]: true,
    }))
  }

  const handleReplyCancel = () => {
    setActiveReplyId(null)
    setReplyText('')
    setReplyError(null)
  }

  const handleSubmitReply = (parentId: string) => {
    if (!questionId || createReply.isPending) return
    const trimmed = replyText.trim()
    if (!trimmed) {
      setReplyError('Reply cannot be empty.')
      return
    }
    if (trimmed.length > COMMENT_MAX_LENGTH) {
      setReplyError(`Reply must be ${COMMENT_MAX_LENGTH} characters or less.`)
      return
    }
    if (!isAuthenticated) {
      setReplyError('Please login to reply.')
      return
    }
    createReply.mutate({ parentId, text: trimmed })
  }

  const handleToggleLike = async (commentId: string) => {
    if (pendingLikeIds.has(commentId)) return
    if (!isAuthenticated) {
      setCommentError('Please login to like comments.')
      return
    }
    setPendingLikeIds((prev) => {
      const next = new Set(prev)
      next.add(commentId)
      return next
    })
    try {
      const response = await api.post<{ likeCount: number; likedByMe: boolean }>(
        `/api/comments/${commentId}/like`
      )
      const { likeCount, likedByMe } = response.data
      const updater = (comment: CommentDto) => ({ ...comment, likeCount, likedByMe })
      queryClient.setQueriesData(
        { queryKey: ['comments', questionId] },
        (old) =>
          updateCommentInInfinite(
            old as InfiniteData<PagedResult<CommentDto>> | undefined,
            commentId,
            updater
          )
      )
      queryClient.setQueriesData(
        { queryKey: ['comment-replies'] },
        (old) =>
          updateCommentInInfinite(
            old as InfiniteData<PagedResult<CommentDto>> | undefined,
            commentId,
            updater
          )
      )
    } catch (error) {
      setCommentError(resolveCommentError(error, 'Like update failed.'))
    } finally {
      setPendingLikeIds((prev) => {
        const next = new Set(prev)
        next.delete(commentId)
        return next
      })
    }
  }

  const handleViewStats = () => {
    clearPostVoteTimers()
    if (!id) return
    navigate(`/questions/${id}/stats`)
  }

  const handleSkipToNext = () => {
    clearPostVoteTimers()
    if (!nextQuestionId) return
    navigate(`/questions/${nextQuestionId}`)
  }

  const handleShareQuestion = async () => {
    if (!question.data || typeof window === 'undefined') return
    const shareUrl = window.location.href
    const shareText = `Vote on this question: ${question.data.title}`

    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({
          title: question.data.title,
          text: shareText,
          url: shareUrl,
        })
        toast.success('Question shared.')
        return
      }

      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl)
        toast.success('Question link copied.')
        return
      }

      window.prompt('Copy this question link', shareUrl)
      toast.info('Question link is ready to copy.')
    } catch (error: any) {
      if (error?.name === 'AbortError') return
      toast.error('Could not share this question right now.')
    }
  }

  const viewCount =
    stats.data?.views ??
    stats.data?.viewCount ??
    question.data?.views ??
    question.data?.viewCount
  const totalVotes =
    stats.data?.totalVotes ??
    stats.data?.options.reduce((sum, item) => sum + (item.count ?? 0), 0) ??
    0

  const isTwoOptionLayout = options.length === 2

  return (
    <div className="question-full-bleed">
      <div className={`question-stage-shell relative min-h-screen overflow-hidden text-strong ${isTwoOptionLayout ? 'is-two-option' : ''}`}>
        <div className="question-ambient-backdrop absolute inset-0 -z-10">
          <div className="question-aurora question-aurora-one" />
          <div className="question-aurora question-aurora-two" />
          <div className="question-aurora question-aurora-three" />
          <div className="question-grid-overlay" />
        </div>

        {celebrate && (
          <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center">
            <span className="question-celebration-ring" />
            <span className="question-celebration-ring question-celebration-ring-second" />
          </div>
        )}

        {isTwoOptionLayout ? (
          <div className="two-split-stage">
            <div className="two-split-backdrop">
              <span className="two-split-orb one" />
              <span className="two-split-orb two" />
              <span className="two-split-orb three" />
              <span className="two-split-grid" />
            </div>

            <div className="two-split-shell">
              <div className="two-split-topbar">
                <span className="two-split-tag">Live matchup</span>
                <div className="two-split-top-actions">
                  {id ? (
                    <Link to={`/questions/${id}/stats`} className="two-split-mini-btn">
                      Stats
                    </Link>
                  ) : null}
                  <button type="button" onClick={handleShareQuestion} className="two-split-mini-btn">
                    Share
                  </button>
                  <button type="button" onClick={() => setShowComments(true)} className="two-split-mini-btn">
                    {typeof rootCommentCount === 'number' ? `Comments ${rootCommentCount}` : 'Comments'}
                  </button>
                </div>
              </div>

              <div className="two-split-header">
                <p className="two-split-subtitle">Pick one side and lock your vote.</p>
                <h1 className="two-split-question">{question.data.title}</h1>
              </div>

              <div
                role="radiogroup"
                aria-label="Question options"
                className={`two-split-panels ${selected ? 'has-selection' : ''}`}
              >
                <div className="two-split-center-badge" aria-hidden>
                  VS
                </div>
                {options.map((option, index) => {
                  const isSelected = selected === option.id
                  const percentage = getPercent(option.id)
                  const animatedPercentage = animatedPercentages[option.id] ?? percentage
                  const optionStats = statsLookup[option.id]
                  const sideClass = index === 0 ? 'split-left' : 'split-right'
                  const sideLabel = index === 0 ? 'Side A' : 'Side B'
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => {
                        if (vote.isPending) return
                        setSelected(option.id)
                      }}
                      disabled={vote.isPending}
                      className={`two-split-panel ${sideClass} ${isSelected ? 'is-selected' : ''}`}
                    >
                      <span className="two-split-panel-noise" aria-hidden />
                      <span className="two-split-panel-scan" aria-hidden />
                      <span className={`two-split-panel-marker ${isSelected ? 'is-selected' : ''}`}>
                        {isSelected ? 'Selected' : 'Choose'}
                      </span>
                      <div className="two-split-panel-inner">
                        <span className="two-split-side-badge">{sideLabel}</span>
                        <p className="two-split-option">{option.text}</p>
                        <div className="two-split-stat-stack">
                          <span className="two-split-percent">
                            {stats.isLoading ? '--' : `${animatedPercentage}%`}
                          </span>
                          <span className="two-split-vote-count">
                            {stats.isLoading
                              ? 'Loading live totals'
                              : optionStats
                                ? `${optionStats.count} votes`
                                : 'No votes yet'}
                          </span>
                        </div>
                        <div className="two-split-panel-footer">
                          <span>{isSelected ? 'Selected' : 'Tap to choose'}</span>
                          <span>{isSelected ? 'Vote ready' : sideLabel}</span>
                        </div>
                      </div>
                      <span className="two-split-glow" aria-hidden />
                    </button>
                  )
                })}
              </div>

              <div className="two-split-actions">
                <div className="flex flex-wrap justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleSendVote}
                    disabled={!selected || vote.isPending}
                    className="btn-primary px-10 py-3 text-base disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {vote.isPending ? 'Sending vote...' : 'Send my vote'}
                  </button>
                </div>
                {showVoteSuccessFeedback && (
                  <p className="vote-success-feedback" role="status" aria-live="polite">
                    Vote submitted.
                  </p>
                )}
                {voteError && <p className="text-sm text-rose-600">{voteError}</p>}
                {typeof viewCount === 'number' && (
                  <p className="text-xs uppercase tracking-[0.3em] text-muted">Views: {viewCount}</p>
                )}
                {stats.data && (
                  <div className="two-split-live-row">
                    <span className="two-split-live-pill">Total votes {totalVotes}</span>
                    <span className="two-split-live-pill">{selected ? 'Choice locked' : 'Select a side'}</span>
                    {typeof viewCount === 'number' ? <span className="two-split-live-pill">Views {viewCount}</span> : null}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="container-page relative z-10 flex min-h-screen flex-col items-center text-center py-16">
            <p className="text-sm uppercase tracking-[0.7em] text-muted">Question of the day</p>
            <h1 className="mt-4 max-w-4xl text-3xl font-semibold leading-tight text-strong sm:text-4xl lg:text-5xl">
              {question.data.title}
            </h1>
            <p className="mt-4 max-w-2xl text-base text-muted">
              Pick your side, feel the energy, and send the vote. Every choice paints the stage a bit brighter.
            </p>

            <div role="radiogroup" aria-label="Question options" className="mt-12 grid w-full max-w-3xl gap-6">
              {options.map(option => {
                const isSelected = selected === option.id
                const percentage = getPercent(option.id)
                const animatedPercentage = animatedPercentages[option.id] ?? percentage
                const optionStats = statsLookup[option.id]

                return (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => {
                      if (vote.isPending) return
                      setSelected(option.id)
                    }}
                    disabled={vote.isPending}
                    className={`reactbits-vote-card group relative overflow-hidden rounded-2xl border border-border bg-panel px-6 py-5 text-left transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(34,211,238,0.3)] ${
                      isSelected
                        ? 'scale-[1.02] border-[rgba(34,211,238,0.35)] ring-2 ring-[rgba(34,211,238,0.2)]'
                        : 'hover:-translate-y-1 hover:border-[rgba(34,211,238,0.25)]'
                    }`}
                  >
                    <span className="reactbits-vote-card-noise" aria-hidden />
                    <div
                      className={`absolute inset-0 -z-10 opacity-0 blur-3xl transition duration-300 ${
                        isSelected ? 'scale-110 opacity-60' : 'group-hover:opacity-25'
                      }`}
                      style={{
                        background: 'radial-gradient(circle at 20% 20%, rgba(79,116,230,0.22), transparent 60%)',
                      }}
                    />
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <span className="reactbits-vote-card-tag">Option</span>
                        <p className="text-lg font-semibold text-strong">{option.text}</p>
                        <div className="reactbits-vote-card-statline">
                          <span className="reactbits-vote-card-percentage">
                            {stats.isLoading ? '--' : `${animatedPercentage}%`}
                          </span>
                          <span className="reactbits-vote-card-count">
                            {stats.isLoading
                              ? 'Loading'
                              : optionStats
                                ? `${optionStats.count} votes`
                                : 'No votes'}
                          </span>
                        </div>
                      </div>
                      <div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-border">
                        <span
                            className={`h-9 w-9 rounded-full transition-all duration-500 ${
                              isSelected
                              ? 'scale-100 bg-[var(--accent)] shadow-lg shadow-[rgba(34,211,238,0.35)]'
                              : 'scale-75 bg-[var(--accent-muted)] group-hover:scale-90'
                          }`}
                        />
                        <span className="pointer-events-none absolute inset-0 animate-ping rounded-full opacity-10 group-hover:opacity-30" />
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="mt-10 flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={handleSendVote}
                disabled={!selected || vote.isPending}
                className="btn-primary px-10 py-3 text-base disabled:cursor-not-allowed disabled:opacity-60"
              >
                {vote.isPending ? 'Sending vote...' : 'Send my vote'}
              </button>
              {showVoteSuccessFeedback && (
                <p className="vote-success-feedback" role="status" aria-live="polite">
                  Vote submitted.
                </p>
              )}
              {voteError && <p className="text-sm text-rose-600">{voteError}</p>}
              {typeof viewCount === 'number' && (
                <p className="text-xs uppercase tracking-[0.3em] text-muted">Views: {viewCount}</p>
              )}
            </div>

            <section className="mt-16 w-full max-w-4xl rounded-3xl border border-border bg-panel p-8 text-left shadow-[0_24px_60px_rgba(15,23,42,0.12)] backdrop-blur-2xl">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.5em] text-muted">Live statistics</p>
                  <h2 className="mt-2 text-2xl font-semibold text-strong">Real-time vote distribution</h2>
                </div>
                <div className="flex flex-col items-start gap-2 text-sm text-muted sm:items-end sm:text-right">
                  <div>
                    {stats.isLoading ? 'Loading...' : stats.isFetching ? 'Updating...' : 'Fresh'}
                  </div>
                  {typeof viewCount === 'number' ? <div>Views: {viewCount}</div> : null}
                  {id ? (
                    <Link
                      to={`/questions/${id}/stats`}
                      className="inline-flex items-center gap-2 rounded-full border border-border bg-panel px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-strong transition hover:-translate-y-[2px] hover:border-[rgba(34,211,238,0.3)]"
                    >
                      View stats
                      <span aria-hidden className="text-muted">-&gt;</span>
                    </Link>
                  ) : null}
                </div>
              </div>
              {stats.isError ? (
                <p className="mt-6 text-sm text-rose-600">Could not fetch statistics.</p>
              ) : (
                <div className="mt-8 space-y-6">
                  {options.map(option => {
                    const percent = getPercent(option.id)
                    const animatedPercent = animatedPercentages[option.id] ?? percent
                    const optionStats = statsLookup[option.id]
                    return (
                      <div key={option.id} className="space-y-2">
                        <div className="flex items-center justify-between text-sm text-muted">
                          <span className="font-medium">{option.text}</span>
                          <span className="font-semibold tabular-nums text-strong">
                            {stats.isLoading ? '--' : `${animatedPercent}%`}
                            {optionStats ? <span className="ml-2 text-xs text-muted">({optionStats.count} votes)</span> : null}
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
                          <div
                            className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-700 ease-out"
                            style={{ width: stats.isLoading ? '0%' : `${animatedPercent}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        {!isTwoOptionLayout && (
          <>
            {id ? (
              <Link to={`/questions/${id}/stats`} className="stats-fab">
                <span className="stats-fab-label">Statistics</span>
              </Link>
            ) : null}

            <button
              type="button"
              onClick={handleShareQuestion}
              className="share-fab"
            >
              <span className="share-fab-label">Share</span>
            </button>

            <button
              type="button"
              onClick={() => setShowComments((prev) => !prev)}
              aria-expanded={showComments}
              aria-controls="comment-drawer"
              className={`comment-fab ${showComments ? 'is-open' : ''}`}
            >
              <span className="comment-fab-label">{showComments ? 'Close' : 'Comments'}</span>
              {typeof rootCommentCount === 'number' && (
                <span className="comment-fab-count">{rootCommentCount}</span>
              )}
            </button>
          </>
        )}

        <button
          type="button"
          onClick={handleSkipToNext}
          disabled={!nextQuestionId || isFindingNextQuestion}
          className="next-question-fab"
        >
          <span className="next-question-fab-kicker">
            {isFindingNextQuestion ? 'Finding next' : nextQuestionId ? 'Continue' : 'End of list'}
          </span>
          <span className="next-question-fab-label">
            {isFindingNextQuestion ? 'Loading...' : nextQuestionId ? 'Next question' : 'No next question'}
          </span>
        </button>

        {typeof document !== 'undefined'
          ? createPortal(
            <div id="comment-drawer" className={`comment-drawer ${showComments ? 'is-open' : ''}`}>
          <button
            type="button"
            className="comment-drawer-backdrop"
            aria-label="Close comments"
            onClick={() => setShowComments(false)}
          />
          <aside className="comment-panel" role="dialog" aria-label="Comments panel">
            <div className="comment-panel-header">
              <div>
                <p className="comment-panel-title">Comments</p>
                <p className="comment-panel-subtitle">Share your take on this question.</p>
              </div>
              <button type="button" className="comment-close" onClick={() => setShowComments(false)}>
                Close
              </button>
            </div>

            <div className="comment-panel-body">
              <div className="comment-compose">
                <textarea
                  value={newCommentText}
                  onChange={(event) => setNewCommentText(event.target.value)}
                  placeholder="Add a comment..."
                  rows={4}
                  className="comment-textarea"
                />
                <div className="comment-compose-footer">
                  <span className="comment-length">
                    {newCommentText.trim().length}/{COMMENT_MAX_LENGTH}
                  </span>
                  <button
                    type="button"
                    onClick={handleSubmitComment}
                    disabled={createComment.isPending}
                    className="comment-submit"
                  >
                    {createComment.isPending ? 'Posting...' : 'Post comment'}
                  </button>
                </div>
                {commentError && <p className="comment-error">{commentError}</p>}
              </div>

              <div className="comment-summary">
                <div className="comment-summary-header">
                  <div>
                    <p className="comment-summary-title">Discussion summary</p>
                    <p className="comment-summary-note">AI generated</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleSummary}
                    disabled={summaryQuery.isFetching}
                    className={`comment-summary-toggle ${summaryQuery.isFetching ? 'is-loading' : ''}`}
                  >
                    <span className="comment-summary-toggle-core" aria-hidden>
                      <span className="comment-summary-toggle-pulse" />
                      <span className="comment-summary-toggle-dots">
                        <span />
                        <span />
                        <span />
                      </span>
                    </span>
                    <span className="comment-summary-toggle-text">{summaryToggleLabel}</span>
                  </button>
                </div>

                {showSummary && (
                  <div className="comment-summary-card">
                    {summaryQuery.isFetching && !summaryQuery.data ? (
                      <div className="comment-summary-skeleton" aria-hidden>
                        <span />
                        <span />
                        <span />
                      </div>
                    ) : summaryQuery.data ? (
                      <>
                        {summaryLines.length > 0 ? (
                          <ul className="comment-summary-list">
                            {summaryLines.map((line, index) => (
                              <li key={`${index}-${line}`}>{line}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="comment-empty">No summary available yet.</p>
                        )}
                        {!!summaryQuery.data.generatedAt && (
                          <p className="comment-summary-generated">
                            Updated {formatCommentTimestamp(summaryQuery.data.generatedAt)}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="comment-empty">{summaryErrorMessage || 'Discussion summary is unavailable right now.'}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="comment-toolbar">
                <div className="comment-sort">
                  <button
                    type="button"
                    onClick={() => setCommentSort('top')}
                    className={`comment-sort-btn ${commentSort === 'top' ? 'is-active' : ''}`}
                  >
                    Top
                  </button>
                  <button
                    type="button"
                    onClick={() => setCommentSort('new')}
                    className={`comment-sort-btn ${commentSort === 'new' ? 'is-active' : ''}`}
                  >
                    New
                  </button>
                </div>
                <span className="comment-count">
                  {rootComments.isLoading ? 'Loading...' : `${rootCommentItems.length} comments`}
                </span>
              </div>

              <div className="comment-list">
                {rootComments.isLoading ? (
                  <p className="comment-empty">Loading comments...</p>
                ) : rootComments.isError ? (
                  <p className="comment-empty text-rose-600">Comments could not be loaded.</p>
                ) : rootCommentItems.length === 0 ? (
                  <p className="comment-empty">Be the first to comment.</p>
                ) : (
                  rootCommentItems.map(comment => {
                    const isExpanded = !!expandedReplies[comment.id]
                    const isReplying = activeReplyId === comment.id
                    const replyCount = comment.replyCount ?? 0
                    const showRepliesToggle = replyCount > 0 || isExpanded
                    const author = getCommentAuthor(comment)
                    return (
                      <div key={comment.id} className="comment-card">
                        <CommentAuthor
                          userId={author.userId}
                          displayName={author.displayName}
                          avatarUrl={author.avatarUrl}
                          stars={author.stars}
                          rank={author.rank}
                          createdAt={comment.createdAt}
                        />
                        <p className="comment-body">{comment.text}</p>
                        <div className="comment-actions">
                          <button
                            type="button"
                            onClick={() => handleToggleLike(comment.id)}
                            disabled={pendingLikeIds.has(comment.id)}
                            className={`comment-like ${comment.likedByMe ? 'is-liked' : ''}`}
                          >
                            {comment.likedByMe ? 'Liked' : 'Like'} - {comment.likeCount}
                          </button>
                          <button type="button" className="comment-reply-toggle" onClick={() => handleReplyStart(comment.id)}>
                            Reply
                          </button>
                          {showRepliesToggle && (
                            <button
                              type="button"
                              className="comment-replies-toggle"
                              onClick={() => handleReplyToggle(comment.id)}
                            >
                              {isExpanded ? 'Hide replies' : `Replies (${replyCount})`}
                            </button>
                          )}
                        </div>

                        {isReplying && (
                          <div className="comment-reply-box">
                            <textarea
                              value={replyText}
                              onChange={(event) => setReplyText(event.target.value)}
                              placeholder="Write a reply..."
                              rows={3}
                              className="comment-textarea"
                            />
                            <div className="comment-reply-actions">
                              <button
                                type="button"
                                onClick={() => handleSubmitReply(comment.id)}
                                disabled={createReply.isPending}
                                className="comment-submit"
                              >
                                {createReply.isPending ? 'Posting...' : 'Reply'}
                              </button>
                              <button type="button" onClick={handleReplyCancel} className="comment-cancel">
                                Cancel
                              </button>
                            </div>
                            {replyError && <p className="comment-error">{replyError}</p>}
                          </div>
                        )}

                        <CommentReplies
                          parentId={comment.id}
                          isExpanded={isExpanded}
                          pendingLikeIds={pendingLikeIds}
                          onLike={handleToggleLike}
                        />
                      </div>
                    )
                  })
                )}
                {rootComments.hasNextPage && (
                  <button
                    type="button"
                    onClick={() => rootComments.fetchNextPage()}
                    disabled={rootComments.isFetchingNextPage}
                    className="comment-load-more"
                  >
                    {rootComments.isFetchingNextPage ? 'Loading more...' : 'Load more'}
                  </button>
                )}
              </div>
            </div>
          </aside>
            </div>,
            document.body
          )
          : null}

        {showPostVotePrompt && (
          <div className="post-vote-overlay">
            <div className="post-vote-card">
              <p className="post-vote-title">What would you like to do next?</p>
              {nextQuestionId ? (
                <>
                  <p className="post-vote-subtitle">Going to the next question...</p>
                  <div className="post-vote-choice-row" role="group" aria-label="Post vote actions">
                    <button type="button" onClick={handleSkipToNext} className="post-vote-next">
                      Next question
                    </button>
                    <div className="post-vote-countdown" aria-live="polite" aria-atomic="true">
                      <span className="post-vote-countdown-value">{secondsLeft}</span>
                      <span className="post-vote-countdown-label">seconds</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        clearPostVoteTimers()
                        setShowPostVotePrompt(false)
                      }}
                      className="post-vote-ghost"
                    >
                      Stay here
                    </button>
                  </div>
                  <div className="post-vote-actions">
                    <button type="button" onClick={handleViewStats} className="post-vote-primary">
                      See statistics
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="post-vote-subtitle">No more questions were found in this category.</p>
                  <div className="post-vote-actions">
                    <button type="button" onClick={handleViewStats} className="post-vote-primary">
                      See statistics
                    </button>
                    <button type="button" onClick={() => setShowPostVotePrompt(false)} className="post-vote-ghost">
                      Close
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {showVoteConfirm && (
          <div className="vote-confirm-overlay" role="dialog" aria-modal="true" aria-label="Confirm your vote">
            <div className="vote-confirm-card">
              <p className="vote-confirm-kicker">Confirm vote</p>
              <h2 className="vote-confirm-title">Submit this choice?</h2>
              <p className="vote-confirm-copy">
                After you submit, you cannot change your vote immediately. You can vote again after 1 day, and it will update your existing vote instead of creating a new one.
              </p>
              <div className="vote-confirm-actions">
                <button
                  type="button"
                  onClick={handleConfirmVote}
                  disabled={vote.isPending}
                  className="vote-confirm-primary"
                >
                  {vote.isPending ? 'Sending vote...' : 'Yes, submit vote'}
                </button>
                <button
                  type="button"
                  onClick={handleCancelVoteConfirm}
                  disabled={vote.isPending}
                  className="vote-confirm-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {showAuthPrompt && !isAuthenticated && (
          <div className="question-auth-overlay" role="dialog" aria-modal="true" aria-label="Sign in to vote">
            <div className="question-auth-card">
              <button
                type="button"
                className="question-auth-dismiss"
                aria-label="Dismiss sign in prompt"
                onClick={() => setShowAuthPrompt(false)}
              >
                Later
              </button>
              <p className="question-auth-kicker">Voting unlocked</p>
              <h2 className="question-auth-title">Create an account to vote</h2>
              <p className="question-auth-copy">
                Sign up or log in to cast your vote, join the discussion, and track your activity on this question.
              </p>
              <div className="question-auth-actions">
                <Link to="/register" state={{ from: location }} className="question-auth-primary">
                  Register
                </Link>
                <Link to="/login" state={{ from: location }} className="question-auth-secondary">
                  Sign in
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

