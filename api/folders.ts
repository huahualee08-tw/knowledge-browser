/**
 * GET /api/folders — List root folders from Google Drive
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
    const foldersData = await driveGet<{ files: Array<{ id: string; name: string }> }>(token, '/files', {
      q: "mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false",
      fields: 'files(id,name)',
      pageSize: '100',
    })

    const folderMap = new Map(foldersData.files.map((f) => [f.id, f.name]))
    const kbFolders = foldersData.files.filter((f) => KB_FOLDERS.includes(f.name))

    return json({ folders: kbFolders, folderMap: Object.fromEntries(folderMap) }, 200, cors)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Drive API error:', err)
    return json({ error: 'Drive API error', details: message }, 502, cors)
  }
}
