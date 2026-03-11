import type { DriveFile, DriveFolder } from '../types'

// Known knowledge base folder names (from PRD)
const KB_FOLDERS = ['AI資訊', '程式開發', 'OpenClaw', 'YouTube_影片摘要', '個人成長', '投資理財', '其他']

interface FoldersResponse {
  folders: DriveFolder[]
  folderMap: Record<string, string>
}

export async function listFolders(): Promise<FoldersResponse> {
  const res = await fetch('/api/folders', { credentials: 'include' })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export async function listKnowledgeFiles(): Promise<DriveFile[]> {
  const res = await fetch('/api/files', { credentials: 'include' })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export async function getFileContent(fileId: string): Promise<string> {
  const res = await fetch(`/api/files/${fileId}/content`, { credentials: 'include' })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.text()
}

export { KB_FOLDERS }
