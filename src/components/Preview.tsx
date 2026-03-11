import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { DriveFile } from '../types'
import { getFileContent } from '../lib/api'

interface PreviewProps {
  file: DriveFile | null
}

export function Preview({ file }: PreviewProps) {
  const [content, setContent] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!file) {
      setContent(null)
      return
    }
    let cancelled = false
    setIsLoading(true)
    setError(null)
    setContent(null)

    getFileContent(file.id)
      .then((text) => {
        if (!cancelled) setContent(text)
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [file])

  if (!file) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-surface-900">
        <div className="w-14 h-14 rounded-2xl bg-surface-700 flex items-center justify-center mb-4 border border-surface-600">
          <svg className="w-7 h-7 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="text-gray-500 text-sm">選擇一個檔案來預覽內容</p>
      </div>
    )
  }

  const displayName = file.name.replace(/\.(md|txt)$/i, '')
  const date = new Date(file.modifiedTime).toLocaleDateString('zh-TW', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-surface-900">
      {/* Header */}
      <div className="px-6 py-4 border-b border-surface-600 shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-100 leading-snug">{displayName}</h2>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
              <span className="px-2 py-0.5 rounded bg-surface-700 text-gray-400">{file.category}</span>
              <span>{date}</span>
            </div>
          </div>
          {file.webViewLink && (
            <a
              href={file.webViewLink}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-700 border border-surface-600 text-xs text-gray-400 hover:text-gray-200 hover:border-surface-500 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              在 Drive 開啟
            </a>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <svg className="w-6 h-6 animate-spin text-blue-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : error ? (
          <div className="p-6">
            <div className="px-4 py-3 rounded-lg bg-red-900/20 border border-red-700/40 text-red-400 text-sm">
              讀取失敗：{error}
            </div>
          </div>
        ) : content !== null ? (
          file.name.toLowerCase().endsWith('.md') ? (
            <div className="px-6 py-5 prose prose-invert prose-sm max-w-none
              prose-headings:text-gray-100 prose-headings:font-semibold
              prose-p:text-gray-300 prose-p:leading-relaxed
              prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline
              prose-code:text-green-300 prose-code:bg-surface-700 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:before:content-none prose-code:after:content-none
              prose-pre:bg-surface-700 prose-pre:border prose-pre:border-surface-600
              prose-blockquote:border-blue-500/50 prose-blockquote:text-gray-400
              prose-hr:border-surface-600
              prose-th:text-gray-300 prose-td:text-gray-400
              prose-li:text-gray-300
              prose-strong:text-gray-200
            ">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </div>
          ) : (
            <pre className="px-6 py-5 font-mono text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">
              {content}
            </pre>
          )
        ) : null}
      </div>
    </div>
  )
}
