import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '@/shared/api/client'
import { fetchCategories } from '@/entities/category/api/categories'
import type { Category } from '@/entities/category/model/types'

export default function CreateQuestion() {
  const [title, setTitle] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [options, setOptions] = useState<string[]>(['',''])
  const [error, setError] = useState<string | null>(null)
  const nav = useNavigate()

  const categories = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  })

  const addOption = () => setOptions(o => [...o, ''])
  const updateOption = (i: number, val: string) => setOptions(o => o.map((x, idx) => idx===i?val:x))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const cleaned = options.map(o => o.trim()).filter(Boolean)
    const unique = Array.from(new Set(cleaned))
    if (unique.length < 2) {
      setError('Please provide at least two distinct options.')
      return
    }
    const body = {
      title: title.trim(),
      categoryId,
      type: 0, // SingleChoice
      // Backend expects: List<string> Options
      options: unique,
    }
    try {
      const res = await api.post('/api/questions', body)
      nav(`/questions/${res.data.id}`)
    } catch (err: any) {
      const msg = err?.response?.data?.title || err?.response?.data?.message || 'Create request failed'
      setError(msg)
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="card">
        <div className="card-body">
          <h1 className="heading-1 mb-4">Create Question</h1>
          <form className="space-y-4" onSubmit={submit}>
            <div>
              <label className="label">Title</label>
              <input className="input" value={title} onChange={e=>setTitle(e.target.value)} required />
            </div>
            <div>
              <label className="label">Category</label>
              {categories.isLoading ? (
                <div className="text-sm text-muted">Loading categories...</div>
              ) : categories.isError ? (
                <div className="text-sm text-red-600">Failed to load categories</div>
              ) : (
                <select
                  className="input"
                  value={categoryId}
                  onChange={e => setCategoryId(e.target.value)}
                  required
                >
                  <option value="" disabled>Select a category</option>
                  {categories.data?.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
            </div>
            <div className="space-y-2">
              <div className="label mb-0 font-medium">Options</div>
              {options.map((opt, i) => (
                <input key={i} className="input" value={opt} onChange={e=>updateOption(i, e.target.value)} required />
              ))}
              <button type="button" className="btn-link text-sm" onClick={addOption}>+ Add option</button>
            </div>
            <button className="btn-primary">Create</button>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </form>
        </div>
      </div>
    </div>
  )
}
