import type { CSSProperties } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { fetchCategories } from '@/entities/category/api/categories'
import type { Category } from '@/entities/category/model/types'

type CategoryPalette = {
  accent: string
  soft: string
  ink: string
  emoji: string
}

const CATEGORY_PALETTES: Record<string, CategoryPalette> = {
  cars: { accent: '#ff7657', soft: '#ffe2d8', ink: '#552113', emoji: '\u{1F697}' },
  lifestyle: { accent: '#9d78ff', soft: '#eae2ff', ink: '#2f1b63', emoji: '\u{1F4AB}' },
  politics: { accent: '#f5b942', soft: '#fff0c8', ink: '#4b3300', emoji: '\u{1F3DB}\u{FE0F}' },
  sports: { accent: '#55c98a', soft: '#d9f5e5', ink: '#143c28', emoji: '\u{26BD}' },
  technology: { accent: '#35b8aa', soft: '#d7f3ee', ink: '#103c37', emoji: '\u{1F9E0}' },
  food: { accent: '#ff8a45', soft: '#ffe7d3', ink: '#51250c', emoji: '\u{1F35C}' },
}

const FALLBACK_PALETTES: CategoryPalette[] = [
  { accent: '#35b8aa', soft: '#d7f3ee', ink: '#103c37', emoji: '\u{2726}' },
  { accent: '#ff7657', soft: '#ffe2d8', ink: '#552113', emoji: '\u{25CE}' },
  { accent: '#9d78ff', soft: '#eae2ff', ink: '#2f1b63', emoji: '\u{25C7}' },
  { accent: '#f5b942', soft: '#fff0c8', ink: '#4b3300', emoji: '\u{25B3}' },
]

function getCategoryPalette(category: Category, index: number) {
  const key = category.slug?.toLowerCase() || category.name?.toLowerCase()
  return (key && CATEGORY_PALETTES[key]) || FALLBACK_PALETTES[index % FALLBACK_PALETTES.length]
}

export default function CategoriesPage() {
  const categories = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  })

  const categoryItems = categories.data ?? []

  return (
    <div className="category-index">
      <section className="category-index-hero">
        <div>
          <p className="section-heading">Explore by category</p>
          <h1>Pick a lane. Change your mind later.</h1>
          <p>
            Jump into a topic, scan the active questions, and follow the vote without losing your place.
          </p>
        </div>
        <div className="category-index-summary" aria-label="Category summary">
          <span>{categories.isLoading ? '--' : categoryItems.length}</span>
          <small>active worlds</small>
          <Link to="/questions">See every question <span aria-hidden>-&gt;</span></Link>
        </div>
      </section>

      {categories.isError ? (
        <section className="category-index-state">
          <p>Categories could not be loaded.</p>
          <button type="button" className="btn-primary" onClick={() => void categories.refetch()}>
            Try again
          </button>
        </section>
      ) : null}

      <section className="category-index-grid" aria-label="Categories">
        {categories.isLoading
          ? Array.from({ length: 6 }).map((_, index) => (
              <div key={`category-loading-${index}`} className="category-index-card is-loading" />
            ))
          : categoryItems.map((category, index) => {
              const palette = getCategoryPalette(category, index)
              return (
                <Link
                  key={category.id}
                  to={`/categories/${category.id}`}
                  className="category-index-card"
                  style={
                    {
                      '--category-accent': palette.accent,
                      '--category-soft': palette.soft,
                      '--category-ink': palette.ink,
                    } as CSSProperties
                  }
                >
                  <span className="category-index-card-number">{String(index + 1).padStart(2, '0')}</span>
                  <span className="category-index-card-icon" aria-hidden>{palette.emoji}</span>
                  <span className="category-index-card-copy">
                    <strong>{category.name}</strong>
                    <small>{category.slug || 'Open topic'}</small>
                  </span>
                  <span className="category-index-card-action">
                    Open <span aria-hidden>-&gt;</span>
                  </span>
                </Link>
              )
            })}
      </section>

      {!categories.isLoading && !categories.isError && categoryItems.length === 0 ? (
        <section className="category-index-state">
          <p>No categories are available yet.</p>
          <Link to="/questions" className="btn-ghost">Browse questions</Link>
        </section>
      ) : null}
    </div>
  )
}
