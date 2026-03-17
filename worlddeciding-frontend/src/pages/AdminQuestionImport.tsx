import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import {
  bulkImportAdminQuestions,
  type AdminBulkImportItem,
  type AdminBulkImportResponse,
} from '@/features/admin/api'
import { useToast } from '@/shared/ui/toast'

type ImportDraftItem = {
  questionText?: unknown
  categorySlug?: unknown
  type?: unknown
  options?: unknown
  language?: unknown
  tags?: unknown
  notes?: unknown
  source?: unknown
}

function getErrorMessage(error: unknown) {
  const message = (error as any)?.response?.data?.message || (error as any)?.message
  return typeof message === 'string' && message.trim() ? message : 'Import request failed.'
}

function normalizeImportItems(rawItems: ImportDraftItem[]) {
  const normalized: AdminBulkImportItem[] = []
  const errors: string[] = []

  rawItems.forEach((item, index) => {
    const questionText = typeof item.questionText === 'string' ? item.questionText.trim() : ''
    const categorySlug = typeof item.categorySlug === 'string' ? item.categorySlug.trim() : ''
    const rawOptions = Array.isArray(item.options) ? item.options : []
    const options = rawOptions
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .filter((value) => value.length > 0)

    if (!questionText) {
      errors.push(`Item #${index}: questionText is required.`)
      return
    }

    if (!categorySlug) {
      errors.push(`Item #${index}: categorySlug is required.`)
      return
    }

    if (options.length < 2) {
      errors.push(`Item #${index}: options must include at least 2 values.`)
      return
    }

    const type = item.type === 'Binary' ? 'Binary' : 'Multi'
    const language = typeof item.language === 'string' && item.language.trim() ? item.language.trim() : 'en'
    const tags = Array.isArray(item.tags)
      ? item.tags.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      : undefined
    const notes = typeof item.notes === 'string' && item.notes.trim() ? item.notes.trim() : undefined
    const source = typeof item.source === 'string' && item.source.trim() ? item.source.trim() : 'admin'

    normalized.push({
      questionText,
      categorySlug,
      type,
      options,
      language,
      tags,
      notes,
      source,
    })
  })

  return { normalized, errors }
}

export default function AdminQuestionImport() {
  const toast = useToast()
  const [rawJson, setRawJson] = useState('')
  const [parseError, setParseError] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [parsedItems, setParsedItems] = useState<ImportDraftItem[]>([])
  const [result, setResult] = useState<AdminBulkImportResponse | null>(null)

  const previewItems = useMemo(() => parsedItems.slice(0, 3), [parsedItems])

  const importMutation = useMutation({
    mutationFn: bulkImportAdminQuestions,
    onSuccess: (response) => {
      setResult(response)
      toast.success(`Import completed. Inserted ${response.inserted}, failed ${response.failed}.`)
    },
    onError: (error) => {
      toast.error(getErrorMessage(error))
    },
  })

  async function onFilePick(file: File) {
    const text = await file.text()
    setRawJson(text)
    parseAndValidate(text)
  }

  function parseAndValidate(text: string) {
    setResult(null)
    setParseError(null)
    setValidationErrors([])

    try {
      const parsed = JSON.parse(text)
      if (!Array.isArray(parsed)) {
        setParsedItems([])
        setParseError('JSON root must be an array.')
        return
      }

      const rawItems = parsed as ImportDraftItem[]
      setParsedItems(rawItems)
      const { errors } = normalizeImportItems(rawItems)
      setValidationErrors(errors)
    } catch {
      setParsedItems([])
      setParseError('Invalid JSON format.')
    }
  }

  function onImport() {
    const { normalized, errors } = normalizeImportItems(parsedItems)
    setValidationErrors(errors)
    if (errors.length > 0) {
      toast.error('Validation failed. Fix items and try again.')
      return
    }
    importMutation.mutate(normalized)
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-body space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="heading-1">Bulk Import</h1>
            <Link className="btn-ghost" to="/admin/questions">
              Back to Questions
            </Link>
          </div>
          <p className="text-sm text-muted">
            Upload a JSON array. `categorySlug` is required, default language is en when omitted.
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-body space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="label">JSON file</label>
              <input
                className="input"
                type="file"
                accept="application/json,.json"
                onChange={async (event) => {
                  const file = event.target.files?.[0]
                  if (!file) return
                  await onFilePick(file)
                }}
              />
            </div>
            <div className="flex items-end gap-2">
              <button className="btn-primary" onClick={() => parseAndValidate(rawJson)} type="button">
                Parse & Validate
              </button>
              <button
                className="btn-ghost"
                onClick={onImport}
                type="button"
                disabled={importMutation.isPending || parsedItems.length === 0 || !!parseError || validationErrors.length > 0}
              >
                {importMutation.isPending ? 'Importing...' : 'Import'}
              </button>
            </div>
          </div>

          <div>
            <label className="label">Raw JSON</label>
            <textarea
              className="input min-h-60"
              value={rawJson}
              onChange={(event) => setRawJson(event.target.value)}
              placeholder='[{"questionText":"...","categorySlug":"work","type":"Multi","options":["Yes","No"],"language":"en"}]'
            />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body space-y-3">
          <h2 className="heading-2">Preview</h2>
          <p className="text-sm text-muted">
            Parsed items: {parsedItems.length}
          </p>

          {parseError ? <p className="text-sm text-red-600">{parseError}</p> : null}

          {validationErrors.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-red-600">Validation errors</p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-red-600">
                {validationErrors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {previewItems.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold">First 3 items</p>
              <pre className="overflow-auto rounded-xl border border-border bg-panel p-3 text-xs">
                {JSON.stringify(previewItems, null, 2)}
              </pre>
            </div>
          ) : (
            <p className="text-sm text-muted">No preview yet.</p>
          )}
        </div>
      </div>

      {result ? (
        <div className="card">
          <div className="card-body space-y-3">
            <h2 className="heading-2">Import Result</h2>
            <p className="text-sm">
              Total: {result.total} | Inserted: {result.inserted} | Failed: {result.failed}
            </p>
            {result.errors.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-red-600">Backend errors</p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-red-600">
                  {result.errors.map((error) => (
                    <li key={`${error.index}-${error.message}`}>
                      Index {error.index}: {error.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-muted">No backend error returned.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
