import api from '@/shared/api/client'
import type { QuestionListItem, QuestionListPage } from '@/entities/question/model/types'

type RawQuestionListResponse =
  | QuestionListItem[]
  | {
      items?: QuestionListItem[]
      data?: QuestionListItem[]
      total?: number
      page?: number
      take?: number
      pageSize?: number
      hasMore?: boolean
    }

type FetchQuestionsPageParams = {
  page?: number
  take?: number
  search?: string
  categoryId?: string
  type?: string | number
}

export type QuestionSummary = {
  questionId: string
  summary: string
  generatedAt: string
}

function normalizeQuestionPage(
  raw: RawQuestionListResponse,
  requestedPage: number,
  requestedTake: number
): QuestionListPage {
  if (Array.isArray(raw)) {
    const items = raw
    const total =
      raw.length < requestedTake
        ? (requestedPage - 1) * requestedTake + raw.length
        : requestedPage * requestedTake + 1
    return {
      items,
      total,
      page: requestedPage,
      take: requestedTake,
      hasMore: raw.length === requestedTake,
    }
  }

  const items = raw.items ?? raw.data ?? []
  const page = requestedPage
  const take = raw.take ?? raw.pageSize ?? requestedTake
  const total = typeof raw.total === 'number' ? raw.total : page * take + (items.length === take ? 1 : 0)
  const hasMore =
    typeof raw.total === 'number'
      ? page * take < total
      : (typeof raw.hasMore === 'boolean' ? raw.hasMore : page * take < total)

  return { items, total, page, take, hasMore }
}

export async function fetchQuestionsPage(params: FetchQuestionsPageParams = {}): Promise<QuestionListPage> {
  const page = Math.max(1, params.page ?? 1)
  const take = Math.max(1, params.take ?? 12)
  const search = params.search?.trim() ?? ''
  const skip = (page - 1) * take

  const response = await api.get<RawQuestionListResponse>('/api/questions', {
    params: {
      page,
      pageNumber: page,
      pageIndex: page - 1,
      take,
      limit: take,
      size: take,
      pageSize: take,
      skip,
      offset: skip,
      search: search || undefined,
      q: search || undefined,
      categoryId: params.categoryId || undefined,
      type: params.type ?? undefined,
    },
  })

  return normalizeQuestionPage(response.data, page, take)
}

export async function fetchQuestionSummary(questionId: string): Promise<QuestionSummary> {
  const response = await api.get<QuestionSummary>(`/api/questions/${questionId}/summary`)
  return response.data
}
