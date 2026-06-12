import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchQuestionsPage } from '@/entities/question/api/questions'

const isBinary = (value?: number | string) => {
  if (typeof value === 'number') return value === 0
  if (typeof value === 'string') return value.toLowerCase() === 'binary' || value === '0'
  return false
}

const RANDOM_PAGE_TAKE = 100

const pickRandomId = (items: Array<{ id: string }>) => {
  if (!items.length) return null
  return items[Math.floor(Math.random() * items.length)]?.id ?? null
}

async function fetchRandomQuestionIdByType(type: string | number) {
  const firstPage = await fetchQuestionsPage({ page: 1, take: RANDOM_PAGE_TAKE, type })
  if (!firstPage.items.length) return null

  const total = Math.max(firstPage.total, firstPage.items.length)
  const randomIndex = Math.floor(Math.random() * total)
  const targetPage = Math.floor(randomIndex / RANDOM_PAGE_TAKE) + 1

  if (targetPage === firstPage.page) {
    return firstPage.items[randomIndex % RANDOM_PAGE_TAKE]?.id ?? pickRandomId(firstPage.items)
  }

  const targetPageData = await fetchQuestionsPage({ page: targetPage, take: RANDOM_PAGE_TAKE, type })
  return (
    targetPageData.items[randomIndex % RANDOM_PAGE_TAKE]?.id ??
    pickRandomId(targetPageData.items) ??
    pickRandomId(firstPage.items)
  )
}

export default function BinaryQuestions() {
  const navigate = useNavigate()
  const [querySeed] = useState(() => Math.random().toString(36).slice(2))

  const { data: firstQuestionId, isLoading, isError } = useQuery({
    queryKey: ['questions', 'binary', 'random-start', querySeed],
    queryFn: async () => {
      const byText = await fetchRandomQuestionIdByType('Binary')
      if (byText) return byText

      const byNumeric = await fetchRandomQuestionIdByType(0)
      if (byNumeric) return byNumeric

      const generic = await fetchQuestionsPage({ page: 1, take: RANDOM_PAGE_TAKE })
      return pickRandomId(generic.items.filter(item => isBinary(item.type)))
    },
    gcTime: 0,
  })

  useEffect(() => {
    if (!isLoading && !isError && firstQuestionId) {
      navigate(`/questions/${firstQuestionId}`)
    }
  }, [firstQuestionId, isError, isLoading, navigate])

  if (isLoading) {
    return (
      <section className="binary-launchpad" aria-live="polite">
        <span className="binary-launchpad-grid" aria-hidden />
        <div className="binary-launchpad-loader" aria-hidden>
          <span />
          <strong>VS</strong>
          <span />
        </div>
        <p>Finding a live Either / Or matchup...</p>
      </section>
    )
  }

  if (isError) {
    return (
      <section className="binary-launchpad binary-launchpad-error">
        <p>Could not load Either / Or questions.</p>
      </section>
    )
  }

  if (!firstQuestionId) {
    return (
      <section className="binary-launchpad">
        <p>No Either / Or questions are available yet.</p>
      </section>
    )
  }

  return (
    <section className="binary-launchpad" aria-live="polite">
      <div className="binary-launchpad-loader" aria-hidden>
        <span />
        <strong>VS</strong>
        <span />
      </div>
      <p>Opening matchup...</p>
    </section>
  )
}
