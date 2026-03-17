export type Option = { id: string; text: string }
export type Question = {
  id: string
  title: string
  options: Option[]
  categoryId?: string
  category?: { id?: string; slug?: string; name?: string }
  views?: number
  viewCount?: number
}
export type QuestionListItem = { id: string; title: string; type?: number | string }
export type QuestionListPage = {
  items: QuestionListItem[]
  total: number
  page: number
  take: number
  hasMore: boolean
}

export type QuestionStatOption = {
  optionId: string
  optionText?: string
  text?: string
  count: number
  ratio?: number
  percentage?: number
}

export type QuestionStatCountry = {
  countryCode: string
  count: number
  percentage: number
}

export type QuestionStatGender = {
  gender: string | number | null
  count: number
  percentage?: number
}

export type QuestionStatAge = {
  ageGroup?: string
  band?: string
  range?: string
  bucket?: string
  label?: string
  minAge?: number
  maxAge?: number
  count: number
  percentage?: number
}

export type QuestionStats = {
  questionId: string
  totalVotes: number
  options: QuestionStatOption[]
  byCountry?: QuestionStatCountry[]
  byGender?: QuestionStatGender[]
  byAge?: QuestionStatAge[]
  byAgeBands?: QuestionStatAge[]
  views?: number
  viewCount?: number
}
