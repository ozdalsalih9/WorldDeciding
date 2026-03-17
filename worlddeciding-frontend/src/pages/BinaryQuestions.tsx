import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchQuestionsPage } from '@/entities/question/api/questions'

const isBinary = (value?: number | string) => {
  if (typeof value === 'number') return value === 0
  if (typeof value === 'string') return value.toLowerCase() === 'binary' || value === '0'
  return false
}

export default function BinaryQuestions() {
  const navigate = useNavigate()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['questions', 'binary'],
    queryFn: async () => {
      const byText = await fetchQuestionsPage({ page: 1, take: 1, type: 'Binary' })
      if (byText.items.length) return byText.items

      const byNumeric = await fetchQuestionsPage({ page: 1, take: 1, type: 0 })
      if (byNumeric.items.length) return byNumeric.items

      const generic = await fetchQuestionsPage({ page: 1, take: 30 })
      return generic.items.filter(item => isBinary(item.type))
    },
  })

  const firstQuestionId = useMemo(() => data?.[0]?.id ?? null, [data])

  useEffect(() => {
    if (!isLoading && !isError && firstQuestionId) {
      navigate(`/questions/${firstQuestionId}`)
    }
  }, [firstQuestionId, isError, isLoading, navigate])

  if (isLoading) {
    return (
      <div className="card">
        <div className="card-body text-center text-muted">Loading O mu bu mu...</div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="card">
        <div className="card-body text-center text-rose-500">Could not load O mu bu mu questions.</div>
      </div>
    )
  }

  if (!firstQuestionId) {
    return (
      <div className="card">
        <div className="card-body text-center text-muted">No binary questions available yet.</div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="card-body text-center text-muted">Starting O mu bu mu...</div>
    </div>
  )
}
