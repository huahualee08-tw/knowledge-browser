import { FileCard } from './FileCard'
import type { DriveFile } from '../types'

interface FileListProps {
  files: DriveFile[]
  selectedFileId: string | null
  onSelectFile: (file: DriveFile) => void
  isLoading: boolean
  searchQuery: string
}

export function FileList({
  files,
  selectedFileId,
  onSelectFile,
  isLoading,
  searchQuery,
}: FileListProps) {
  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col gap-3 p-4 overflow-y-auto">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    )
  }

  if (files.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-surface-700 flex items-center justify-center mb-4">
          <svg className="w-7 h-7 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="text-gray-400 text-sm font-medium">
          {searchQuery ? `找不到包含「${searchQuery}」的檔案` : '此分類暫無檔案'}
        </p>
        {searchQuery && (
          <p className="text-gray-600 text-xs mt-1">試試其他關鍵字</p>
        )}
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Count */}
      <div className="px-4 py-2.5 shrink-0 border-b border-surface-600">
        <p className="text-xs text-gray-500">
          共 <span className="text-gray-400 font-medium">{files.length}</span> 個檔案
        </p>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {files.map((file) => (
          <FileCard
            key={file.id}
            file={file}
            isSelected={file.id === selectedFileId}
            onClick={() => onSelectFile(file)}
            searchQuery={searchQuery}
          />
        ))}
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="p-4 rounded-xl bg-surface-700 border border-surface-600 animate-pulse">
      <div className="flex items-start gap-2.5 mb-3">
        <div className="w-5 h-5 rounded bg-surface-600 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 bg-surface-600 rounded w-3/4" />
          <div className="h-3 bg-surface-600 rounded w-1/2" />
        </div>
      </div>
      <div className="flex gap-2 ml-7">
        <div className="h-5 w-14 bg-surface-600 rounded-md" />
        <div className="h-5 w-24 bg-surface-600 rounded-md" />
      </div>
    </div>
  )
}
