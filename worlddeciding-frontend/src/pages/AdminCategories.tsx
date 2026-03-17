import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchCategories } from '@/entities/category/api/categories'
import { createCategory, updateCategory, deleteCategory } from '@/entities/category/api/mutations'
import type { Category } from '@/entities/category/model/types'

export default function AdminCategories() {
  const qc = useQueryClient()
  const [newSlug, setNewSlug] = useState('')
  const [newName, setNewName] = useState('')
  const [editing, setEditing] = useState<Record<string, { slug: string; name: string }>>({})

  const list = useQuery<Category[]>({ queryKey: ['categories'], queryFn: fetchCategories })

  const mCreate = useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      setNewSlug('')
      setNewName('')
      qc.invalidateQueries({ queryKey: ['categories'] })
    }
  })

  const mUpdate = useMutation({
    mutationFn: ({ id, slug, name }: { id: string; slug: string; name: string }) => updateCategory(id, { slug, name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] })
  })

  const mDelete = useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] })
  })

  const startEdit = (c: Category) => setEditing((e) => ({ ...e, [c.id]: { slug: c.slug, name: c.name } }))
  const cancelEdit = (id: string) => setEditing((e) => { const n = { ...e }; delete n[id]; return n })
  const applyEdit = (id: string) => {
    const e = editing[id]
    if (!e) return
    mUpdate.mutate({ id, slug: e.slug.trim(), name: e.name.trim() })
  }

  return (
    <div className="space-y-6">
      <h1 className="heading-1">Categories</h1>

      <div className="card">
        <div className="card-body space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label className="label">Slug</label>
              <input className="input" value={newSlug} onChange={e=>setNewSlug(e.target.value)} placeholder="technology" />
            </div>
            <div>
              <label className="label">Name</label>
              <input className="input" value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Technology" />
            </div>
            <div className="flex items-end">
              <button
                className="btn-primary"
                disabled={!newSlug.trim() || !newName.trim() || mCreate.isPending}
                onClick={() => mCreate.mutate({ slug: newSlug.trim(), name: newName.trim() })}
              >
                {mCreate.isPending ? 'Creating...' : 'Create Category'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          {list.isLoading ? (
            <p>Loading...</p>
          ) : list.isError ? (
            <p className="text-red-600">Failed to load categories.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[720px] w-full text-sm">
                <thead>
                  <tr className="text-left text-muted">
                    <th className="py-2 pr-3">Id</th>
                    <th className="py-2 pr-3">Slug</th>
                    <th className="py-2 pr-3">Name</th>
                    <th className="w-40 py-2 pr-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(list.data ?? []).map(c => {
                    const e = editing[c.id]
                    return (
                      <tr key={c.id} className="border-t border-border">
                        <td className="py-2 pr-3 align-top">
                          <code className="block max-w-[220px] overflow-hidden text-ellipsis whitespace-nowrap text-xs" title={c.id}>
                            {c.id}
                          </code>
                        </td>
                        <td className="py-2 pr-3">
                          {e ? (
                            <input className="input" value={e.slug} onChange={ev=>setEditing(ed=>({ ...ed, [c.id]: { ...ed[c.id], slug: ev.target.value } }))} />
                          ) : (
                            <span>{c.slug}</span>
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          {e ? (
                            <input className="input" value={e.name} onChange={ev=>setEditing(ed=>({ ...ed, [c.id]: { ...ed[c.id], name: ev.target.value } }))} />
                          ) : (
                            <span>{c.name}</span>
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          {e ? (
                            <div className="flex gap-2">
                              <button className="btn-ghost" onClick={() => applyEdit(c.id)} disabled={mUpdate.isPending}>{mUpdate.isPending ? 'Saving...' : 'Save'}</button>
                              <button className="btn-ghost" onClick={() => cancelEdit(c.id)}>Cancel</button>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <button className="btn-ghost" onClick={() => startEdit(c)}>Edit</button>
                              <button className="btn-ghost text-red-600" onClick={() => mDelete.mutate(c.id)} disabled={mDelete.isPending}>{mDelete.isPending ? 'Deleting...' : 'Delete'}</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
