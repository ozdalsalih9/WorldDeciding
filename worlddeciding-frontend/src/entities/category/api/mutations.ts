import api from '@/shared/api/client'
import type { Category } from '../model/types'

export async function createCategory(input: { slug: string; name: string }): Promise<Category> {
  const payload = {
    slug: input.slug,
    name: input.name,
    Slug: input.slug,
    Name: input.name,
  }
  const res = await api.post<Category>('/api/categories', payload)
  return res.data
}

export async function updateCategory(id: string, input: { slug: string; name: string }): Promise<Category> {
  const payload = {
    id,
    slug: input.slug,
    name: input.name,
    Id: id,
    Slug: input.slug,
    Name: input.name,
  }
  const res = await api.put<Category>(`/api/categories/${id}`, payload)
  return res.data
}

export async function deleteCategory(id: string): Promise<void> {
  await api.delete(`/api/categories/${id}`)
}
