import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { fetchCategories } from '@/entities/category/api/categories'
import type { Category } from '@/entities/category/model/types'
import TiltedCard from '@/components/TiltedCard'

type CategoryPalette = {
  a: string
  b: string
  c: string
  d: string
  emoji: string
}

const CATEGORY_PALETTES: Record<string, CategoryPalette> = {
  cars: { a: '#0ea5e9', b: '#38bdf8', c: '#f8fafc', d: '#0f172a', emoji: '\u{1F697}' },
  lifestyle: { a: '#8b5cf6', b: '#ec4899', c: '#fef3c7', d: '#1f2937', emoji: '\u{1F4AB}' },
  politics: { a: '#0f172a', b: '#2563eb', c: '#e2e8f0', d: '#0b1324', emoji: '\u{1F3DB}\u{FE0F}' },
  sports: { a: '#10b981', b: '#22d3ee', c: '#f0fdfa', d: '#052e2b', emoji: '\u{26BD}' },
  technology: { a: '#111827', b: '#38bdf8', c: '#e0f2fe', d: '#0f172a', emoji: '\u{1F9E0}' },
}

function getCategoryPalette(category: Category, index: number): CategoryPalette {
  const key = category.slug?.toLowerCase() || category.name?.toLowerCase()
  if (key && CATEGORY_PALETTES[key]) return CATEGORY_PALETTES[key]
  const fallback: CategoryPalette[] = [
    { a: '#0ea5e9', b: '#6366f1', c: '#f1f5f9', d: '#0f172a', emoji: '\u{2728}' },
    { a: '#22d3ee', b: '#14b8a6', c: '#ecfeff', d: '#0f172a', emoji: '\u{1F30A}' },
    { a: '#f97316', b: '#facc15', c: '#fff7ed', d: '#1f2937', emoji: '\u{1F525}' },
    { a: '#a855f7', b: '#ec4899', c: '#fdf2f8', d: '#1f2937', emoji: '\u{1F48E}' },
  ]
  return fallback[index % fallback.length]
}

function wrapIndex(index: number, length: number) {
  if (length <= 0) return 0
  return ((index % length) + length) % length
}

function getCircularOffset(index: number, activeIndex: number, length: number) {
  if (length <= 1) return 0

  const rawOffset = index - activeIndex
  const half = length / 2

  if (rawOffset > half) return rawOffset - length
  if (rawOffset < -half) return rawOffset + length
  return rawOffset
}

function buildCardSvg(palette: CategoryPalette) {
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 640" preserveAspectRatio="none">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${palette.a}" />
        <stop offset="100%" stop-color="${palette.b}" />
      </linearGradient>
    </defs>
    <rect width="480" height="640" fill="url(#g)" />
    <circle cx="100" cy="120" r="120" fill="${palette.c}" fill-opacity="0.45" />
    <circle cx="370" cy="430" r="110" fill="${palette.d}" fill-opacity="0.20" />
    <circle cx="140" cy="270" r="56" fill="#ffffff" fill-opacity="0.20" />
  </svg>
  `.trim()
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

export default function CategoriesPage() {
  const navigate = useNavigate()
  const categories = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  })

  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const wheelLockRef = useRef(false)
  const touchStartXRef = useRef<number | null>(null)

  useEffect(() => {
    if (!activeId && categories.data?.length) {
      setActiveId(categories.data[0].id)
      setActiveIndex(0)
    }
  }, [activeId, categories.data])

  useEffect(() => {
    if (!categories.data?.length || !activeId) return
    const idx = categories.data.findIndex((c) => c.id === activeId)
    if (idx >= 0) setActiveIndex(idx)
  }, [activeId, categories.data])

  const categoryCount = categories.data?.length ?? 0
  const canNavigate = categoryCount > 1
  const resolvedActiveIndex = wrapIndex(activeIndex, categoryCount)
  const activeCategory = categories.data?.[resolvedActiveIndex] ?? null
  const activePalette = activeCategory ? getCategoryPalette(activeCategory, resolvedActiveIndex) : null

  const goToIndex = useCallback(
    (nextIndex: number) => {
      const data = categories.data
      if (!data?.length) return
      const wrapped = wrapIndex(nextIndex, data.length)
      const category = data[wrapped]
      if (!category) return
      setActiveId(category.id)
      setActiveIndex(wrapped)
    },
    [categories.data]
  )

  const handleSelect = useCallback(
    (categoryId: string, index: number) => {
      if (index === activeIndex && categoryId === activeId) {
        navigate(`/categories/${categoryId}`)
        return
      }
      setActiveId(categoryId)
      setActiveIndex(index)
    },
    [activeId, activeIndex, navigate]
  )

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') {
        goToIndex(activeIndex + 1)
      } else if (event.key === 'ArrowLeft') {
        goToIndex(activeIndex - 1)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [activeIndex, goToIndex])

  return (
    <div className="space-y-10">
      <section className="category-reel-hero question-full-bleed">
        <div className="category-reel-backdrop">
          <div className="category-reel-orb one" />
          <div className="category-reel-orb two" />
          <div className="category-reel-orb three" />
          <div className="category-reel-grid" />
        </div>

        <div className="category-reel-content container-page">
          <div className="category-reel-header">
            <div className="space-y-3">
              <p className="section-heading">Categories</p>
              <h1 className="heading-1">Slide through the worlds</h1>
              <p className="text-sm text-muted">
                Use arrow keys or scroll to drift across categories. Tap a frame to open that category's questions.
              </p>
              {categories.isLoading && <p className="text-xs text-muted">Loading categories...</p>}
              {categories.isError && <p className="text-xs text-rose-500">Could not load categories.</p>}
            </div>
            <Link to="/questions" className="btn-primary whitespace-nowrap">
              Browse questions
            </Link>
          </div>

          <div
            className="category-reel-stage"
            onWheel={(event) => {
              if (wheelLockRef.current) return
              wheelLockRef.current = true
              const direction = Math.sign(event.deltaY)
              if (direction > 0) goToIndex(activeIndex + 1)
              if (direction < 0) goToIndex(activeIndex - 1)
              window.setTimeout(() => {
                wheelLockRef.current = false
              }, 420)
            }}
            onTouchStart={(event) => {
              touchStartXRef.current = event.touches[0]?.clientX ?? null
            }}
            onTouchEnd={(event) => {
              const startX = touchStartXRef.current
              const endX = event.changedTouches[0]?.clientX ?? startX
              touchStartXRef.current = null
              if (startX === null || endX === null) return
              const delta = startX - endX
              if (Math.abs(delta) < 40) return
              if (delta > 0) goToIndex(activeIndex + 1)
              else goToIndex(activeIndex - 1)
            }}
          >
            <div
              className="category-reel-track"
              style={{ '--active-index': activeIndex } as React.CSSProperties}
            >
              {(categories.data ?? []).map((category, index) => {
                const palette = getCategoryPalette(category, index)
                const offset = getCircularOffset(index, activeIndex, categoryCount)
                const distance = Math.abs(offset)
                const isActive = distance === 0
                const isVisible = distance <= 2
                const depth = isActive ? 1 : Math.max(0.5, 0.9 - distance * 0.18)
                const cardHeight = isActive
                  ? 'var(--card-height-active)'
                  : distance === 1
                    ? 'var(--card-height-near)'
                    : 'var(--card-height-far)'
                const imageSrc = buildCardSvg(palette)
                const scale = isActive ? 1 : distance === 1 ? 0.84 : 0.66
                const opacity = isActive ? 1 : distance === 1 ? 0.82 : 0.5
                const horizontalShift = `calc(-50% + (${offset} * var(--card-step) * ${distance === 2 ? '0.88' : '0.78'}))`
                const verticalShift = isActive ? '-50%' : distance === 1 ? 'calc(-50% + 4px)' : 'calc(-50% + 12px)'
                const zIndex = 220 - distance * 40

                return (
                  <button
                    key={category.id}
                    className={`category-reel-card ${isActive ? 'is-active' : ''}`}
                    onClick={() => handleSelect(category.id, index)}
                    style={
                      {
                        '--offset': offset,
                        '--accent-a': palette.a,
                        '--accent-b': palette.b,
                        '--accent-c': palette.c,
                        '--accent-d': palette.d,
                        '--delay': `${index * 90}ms`,
                        '--depth': depth.toFixed(2),
                        transform: `translate(${horizontalShift}, ${verticalShift}) scale(${scale})`,
                        opacity,
                        height: cardHeight,
                        zIndex,
                        pointerEvents: isVisible ? 'auto' : 'none',
                        visibility: isVisible ? 'visible' : 'hidden',
                      } as React.CSSProperties
                    }
                  >
                    <div className="category-reel-tilted-shell">
                      <TiltedCard
                        imageSrc={imageSrc}
                        altText={`${category.name} category card`}
                        captionText={category.name}
                        containerHeight="100%"
                        containerWidth="100%"
                        imageHeight="100%"
                        imageWidth="100%"
                        scaleOnHover={index === activeIndex ? 1.07 : 1.04}
                        rotateAmplitude={index === activeIndex ? 14 : 10}
                        showMobileWarning={false}
                        showTooltip={false}
                        displayOverlayContent
                        overlayContent={
                          <div className="category-reel-overlay">
                            <span className="category-reel-noise" />
                            <span className="category-reel-sheen" />
                            <span className="category-reel-scan" />
                            <span className="category-reel-shape one" />
                            <span className="category-reel-shape two" />
                            <span className="category-reel-shape three" />
                            <span className="category-reel-rim" />
                            <div className="category-reel-meta">
                              <span className="category-reel-emoji">{palette.emoji}</span>
                              <div className="category-reel-title">{category.name}</div>
                              <div className="category-reel-subtitle">{category.slug}</div>
                            </div>
                          </div>
                        }
                      />
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
          <div className="category-reel-nav-row">
            <button
              type="button"
              className="category-reel-nav"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                goToIndex(activeIndex - 1)
              }}
              disabled={!canNavigate}
              aria-label="Previous category"
            >
              <span aria-hidden>&lt;</span>
            </button>
            <button
              type="button"
              className="category-reel-nav"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                goToIndex(activeIndex + 1)
              }}
              disabled={!canNavigate}
              aria-label="Next category"
            >
              <span aria-hidden>&gt;</span>
            </button>
          </div>

          {activeCategory ? (
            <div
              className="category-reel-mobile-panel"
              style={
                activePalette
                  ? {
                      background: `linear-gradient(145deg, ${activePalette.c}, rgba(255,255,255,0.96)), linear-gradient(135deg, ${activePalette.a}22, ${activePalette.b}24)`,
                      borderColor: `${activePalette.a}33`,
                    }
                  : undefined
              }
            >
              <div className="category-reel-mobile-copy">
                <span className="category-reel-mobile-kicker">
                  {resolvedActiveIndex + 1} / {categoryCount}
                </span>
                <h2 className="category-reel-mobile-title">{activeCategory.name}</h2>
                <p className="category-reel-mobile-slug">{activeCategory.slug ?? 'Category'}</p>
                <p className="category-reel-mobile-note">
                  Swipe the deck or use the arrows, then open this category directly.
                </p>
              </div>
              <div className="category-reel-mobile-actions">
                <Link to={`/categories/${activeCategory.id}`} className="btn-primary">
                  Open category
                </Link>
                <Link to="/questions" className="btn-ghost">
                  All questions
                </Link>
              </div>
            </div>
          ) : null}

          {!categories.isLoading && !categories.isError && (categories.data?.length ?? 0) === 0 && (
            <p className="text-muted">No categories available yet.</p>
          )}
        </div>
      </section>
    </div>
  )
}
