/**
 * GET /api/files — List all knowledge-base files from Google Drive
 */
import {
  corsHeaders,
  getSessionCookie,
  getSession,
  getValidToken,
  json,
  DRIVE_API,
  KB_FOLDERS,
  FRONTEND_URL,
} from '../_shared'

interface DriveFileItem {
  id: string
  name: string
  mimeType: string
  modifiedTime: string
  size?: string
  parents?: string[]
  webViewLink?: string
}

interface DriveListResponse {
  files: DriveFileItem[]
  nextPageToken?: string
}

async function driveGet<T>(token: string, path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${DRIVE_API}${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Drive API ${res.status}: ${body}`)
  }

  return res.json() as Promise<T>
}

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const origin = url.origin
  const cors = corsHeaders(origin || FRONTEND_URL || '*')

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors })
  }

  if (request.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405, cors)
  }

  const sessionId = getSessionCookie(request)
  if (!sessionId) {
    return json({ error: 'Unauthorized' }, 401, cors)
  }

  const session = await getSession(sessionId)
  if (!session) {
    return json({ error: 'Unauthorized' }, 401, cors)
  }

  let token: string
  try {
    token = await getValidToken(session)
  } catch {
    return json({ error: 'Session expired, please log in again' }, 401, cors)
  }

  try {
    // 1. Fetch root folders to build id→name map
    const foldersData = await driveGet<{ files: Array<{ id: string; name: string }> }>(token, '/files', {
      q: "mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false",
      fields: 'files(id,name)',
      pageSize: '100',
    })

    const folderMap = new Map(foldersData.files.map((f) => [f.id, f.name]))

    // 2. Keep only known KB category folders
    const kbFolderIds = [...folderMap.entries()]
      .filter(([, name]) => KB_FOLDERS.includes(name))
      .map(([id]) => id)

    const parentClause = kbFolderIds.map((id) => `'${id}' in parents`).join(' or ')
    const baseQuery = kbFolderIds.length > 0
      ? `(${parentClause}) and (name contains '.md' or name contains '.txt') and trashed=false`
      : `(name contains '.md' or name contains '.txt') and trashed=false`

    // 3. Paginate through all matching files
    type MappedFile = DriveFileItem & { category: string }
    const allFiles: MappedFile[] = []
    let pageToken: string | undefined

    do {
      const params: Record<string, string> = {
        q: baseQuery,
        fields: 'nextPageToken,files(id,name,mimeType,modifiedTime,size,parents,webViewLink)',
        pageSize: '100',
        orderBy: 'modifiedTime desc',
      }
      if (pageToken) params.pageToken = pageToken

      const data = await driveGet<DriveListResponse>(token, '/files', params)

      for (const f of data.files) {
        const parentId = f.parents?.[0] ?? ''
        allFiles.push({
          ...f,
          category: folderMap.get(parentId) ?? '其他',
        })
      }

      pageToken = data.nextPageToken
    } while (pageToken)

    return json({ files: allFiles }, 200, cors)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return json({ error: message }, 502, cors)
  }
}
