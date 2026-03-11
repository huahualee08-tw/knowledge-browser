import type { DriveFile } from '../types'

interface FileCardProps {
  file: DriveFile
  isSelected: boolean
  onClick: () => void
  searchQuery: string
}

export function FileCard({ file, isSelected, onClick, searchQuery }: FileCardProps) {
  const displayName = file.name.replace(/\.(md|txt)$/i, '')
  const date = new Date(file.modifiedTime).toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const isMarkdown = file.name.toLowerCase().endsWith('.md')

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-xl border transition-all group ${
        isSelected
          ? 'bg-blue-600/10 border-blue-500/40 shadow-sm'
          : 'bg-surface-700 border-surface-600 hover:bg-surface-600 hover:border-surface-500 hover:-translate-y-0.5 hover:shadow-md'
      }`}
    >
      {/* Title */}
      <div className="flex items-start gap-2.5 mb-2">
        <span className="mt-0.5 shrink-0 text-base">{isMarkdown ? '📄' : '📝'}</span>
        <p
          className={`text-sm font-medium leading-snug ${
            isSelected ? 'text-blue-200' : 'text-gray-200 group-hover:text-white'
          }`}
        >
          {highlightText(displayName, searchQuery)}
        </p>
      </div>

      {/* Meta */}
      <div className="flex items-center gap-3 ml-7 text-xs text-gray-500">
        <span className="px-2 py-0.5 rounded-md bg-surface-600 text-gray-400">
          {file.category}
        </span>
        <span className="flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {date}
        </span>
      </div>
    </button>
  )
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text
  const regex = new RegExp(`(${escapeRegex(query)})`, 'gi')
  const parts = text.split(regex)
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-yellow-500/30 text-yellow-200 rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    ),
  )
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
