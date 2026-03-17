import api from '@/shared/api/client'
import type { Category } from '../model/types'
import type { QuestionListItem, QuestionListPage } from '@/entities/question/model/types'

export async function fetchCategories(): Promise<Category[]> {
  const res = await api.get<Category[]>('/api/categories')
  return res.data
}

export async function fetchCategoryById(categoryId: string): Promise<Category> {
  const res = await api.get<Category>(`/api/categories/${categoryId}`)
  return res.data
}

export async function fetchCategoryQuestions(categoryId: string): Promise<QuestionListItem[]> {
  const res = await api.get<QuestionListItem[]>(`/api/categories/${categoryId}/questions`)
  return Array.isArray(res.data) ? res.data : []
}

export async function fetchCategoryQuestionsPage(params: {
  categoryId: string
  page?: number
  take?: number
  search?: string
}): Promise<QuestionListPage> {
  const page = Math.max(1, params.page ?? 1)
  const take = Math.max(1, params.take ?? 12)
  const search = params.search?.trim() ?? ''
  const skip = (page - 1) * take

  const res = await api.get<
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
  >(`/api/categories/${params.categoryId}/questions`, {
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
    },
  })

  if (Array.isArray(res.data)) {
    const items = search
      ? res.data.filter((item) => item.title?.toLowerCase().includes(search.toLowerCase()))
      : res.data
    const total =
      items.length < take
        ? (page - 1) * take + items.length
        : page * take + 1
    return {
      items,
      total,
      page,
      take,
      hasMore: items.length === take,
    }
  }

  const items = res.data.items ?? res.data.data ?? []
  const resolvedPage = page
  const resolvedTake = res.data.take ?? res.data.pageSize ?? take
  const total =
    typeof res.data.total === 'number'
      ? res.data.total
      : resolvedPage * resolvedTake + (items.length === resolvedTake ? 1 : 0)
  const hasMore =
    typeof res.data.total === 'number'
      ? resolvedPage * resolvedTake < total
      : (typeof res.data.hasMore === 'boolean' ? res.data.hasMore : resolvedPage * resolvedTake < total)

  return { items, total, page: resolvedPage, take: resolvedTake, hasMore }
}
