import { useEffect, useMemo, useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { listFolders, listKnowledgeFiles } from './lib/api'
import { LoginPage } from './components/LoginPage'
import { SearchBar } from './components/SearchBar'
import { Sidebar } from './components/Sidebar'
import { FileList } from './components/FileList'
import { Preview } from './components/Preview'
import type { Category, DriveFile } from './types'

export default function App() {
  const { user, isLoading: authLoading, error: authError, login, logout } = useAuth()

  const [files, setFiles] = useState<DriveFile[]>([])
  const [isFilesLoading, setIsFilesLoading] = useState(false)
  const [filesError, setFilesError] = useState<string | null>(null)

  const [selectedCategory, setSelectedCategory] = useState<Category>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFile, setSelectedFile] = useState<DriveFile | null>(null)

  // Fetch files after login (backend OAuth: user is logged in means we have session)
  useEffect(() => {
    if (!user) return
    let cancelled = false

    async function load() {
      setIsFilesLoading(true)
      setFilesError(null)
      try {
        // 從後端 API 獲取資料（session cookie 會自動帶上）
        await listFolders()
        const driveFiles = await listKnowledgeFiles()
        if (!cancelled) setFiles(driveFiles)
      } catch (err) {
        if (!cancelled) setFilesError(err instanceof Error ? err.message : '讀取檔案失敗')
      } finally {
        if (!cancelled) setIsFilesLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [user])

  // Derived categories
  const categories = useMemo(() => {
    const cats = new Set(files.map((f) => f.category))
    return [...cats].sort()
  }, [files])

  const fileCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const f of files) counts[f.category] = (counts[f.category] ?? 0) + 1
    return counts
  }, [files])

  // Filtered files
  const filteredFiles = useMemo(() => {
    return files.filter((f) => {
      const matchCat = selectedCategory === 'all' || f.category === selectedCategory
      const q = searchQuery.trim().toLowerCase()
      const matchSearch = !q || f.name.toLowerCase().includes(q)
      return matchCat && matchSearch
    })
  }, [files, selectedCategory, searchQuery])

  // Clear selection when filter changes
  useEffect(() => {
    setSelectedFile(null)
  }, [selectedCategory, searchQuery])

  // Show login page
  if (!user) {
    return <LoginPage onLogin={login} isLoading={authLoading} error={authError} />
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Top bar */}
      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        user={user}
        onLogout={logout}
      />

      <div className="flex flex-1 min-h-0">
        {/* Left sidebar */}
        <Sidebar
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          fileCounts={fileCounts}
          totalCount={files.length}
        />

        {/* Middle: file list */}
        <main className="flex flex-col w-80 min-w-[20rem] bg-surface-800 border-r border-surface-600 overflow-hidden">
          {filesError ? (
            <div className="p-4">
              <div className="px-4 py-3 rounded-lg bg-red-900/20 border border-red-700/40 text-red-400 text-sm">
                {filesError}
              </div>
            </div>
          ) : (
            <FileList
              files={filteredFiles}
              selectedFileId={selectedFile?.id ?? null}
              onSelectFile={setSelectedFile}
              isLoading={isFilesLoading}
              searchQuery={searchQuery}
            />
          )}
        </main>

        {/* Right: preview */}
        <section className="flex-1 flex flex-col overflow-hidden">
          <Preview file={selectedFile} />
        </section>
      </div>
    </div>
  )
}
