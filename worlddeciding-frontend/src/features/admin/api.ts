import api from '@/shared/api/client'

export type AdminQuestionStatusInt = 0 | 1 | 2
export type AdminQuestionTypeInt = 0 | 1

export type AdminQuestionStatusFilter = 'Draft' | 'Published' | 'Archived'

export type AdminQuestionListItem = {
  id: string
  title: string
  categorySlug?: string | null
  status: AdminQuestionStatusInt
  language: string
  createdAt: string
  publishedAt: string | null
  type: AdminQuestionTypeInt
}

export type AdminQuestionListResponse = {
  items: AdminQuestionListItem[]
  total: number
  page: number
  pageSize: number
}

export type AdminQuestionDetail = {
  id: string
  title: string
  categorySlug?: string | null
  status: AdminQuestionStatusInt
  language: string
  tagsJson: string | null
  notes: string | null
  source: string | null
  createdAt: string
  publishedAt: string | null
  type: AdminQuestionTypeInt
  options: Array<{ text: string }>
}

export type AdminBulkImportItem = {
  questionText: string
  categorySlug: string
  type: 'Binary' | 'Multi'
  options: string[]
  language: string
  tags?: string[]
  notes?: string
  source?: string
}

export type AdminBulkImportError = {
  index: number
  message: string
}

export type AdminBulkImportResponse = {
  total: number
  inserted: number
  failed: number
  errors: AdminBulkImportError[]
}

type GetAdminQuestionsParams = {
  status?: AdminQuestionStatusFilter
  language?: string
  search?: string
  page?: number
  pageSize?: number
}

export async function getAdminQuestions(params: GetAdminQuestionsParams) {
  const response = await api.get<AdminQuestionListResponse>('/api/admin/questions', { params })
  return response.data
}

export async function getAdminQuestionById(id: string) {
  const response = await api.get<AdminQuestionDetail>(`/api/admin/questions/${id}`)
  return response.data
}

export async function bulkImportAdminQuestions(items: AdminBulkImportItem[]) {
  const response = await api.post<AdminBulkImportResponse>('/api/admin/questions/bulk-import', items)
  return response.data
}

export async function publishAdminQuestion(id: string) {
  await api.post(`/api/admin/questions/${id}/publish`)
}

export async function archiveAdminQuestion(id: string) {
  await api.post(`/api/admin/questions/${id}/archive`)
}

export function adminStatusLabel(status: AdminQuestionStatusInt) {
  if (status === 0) return 'Draft'
  if (status === 1) return 'Published'
  return 'Archived'
}

export function adminTypeLabel(type: AdminQuestionTypeInt) {
  if (type === 0) return 'Binary'
  return 'Multi'
}
