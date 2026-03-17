import api from '@/shared/api/client'

export async function voteOnQuestion(params: {
  questionId: string
  optionId: string
}) {
  const { questionId, optionId } = params
  return (await api.post('/api/votes', { questionId, optionId })).data
}
