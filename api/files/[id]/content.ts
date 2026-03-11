/**
 * GET /api/files/[id]/content — Return raw text content of a Drive file
 */
import {
  corsHeaders,
  getSessionCookie,
  getSession,
  getValidToken,
  json,
  DRIVE_API,
  FRONTEND_URL,
} from '../../_shared'

export default async function handler(request: Request, { params }: { params: { id: string } }): Promise<Response> {
  const url = new URL(request.url)
  const origin = url.origin
  const cors = corsHeaders(origin || FRONTEND_URL || '*')
  const fileId = params?.id

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors })
  }

  if (request.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405, cors)
  }

  if (!fileId) {
    return json({ error: 'File ID required' }, 400, cors)
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

  const res = await fetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    return json({ error: `Drive API error: ${res.status}` }, res.status, cors)
  }

  const content = await res.text()
  return new Response(content, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      ...cors,
    },
  })
}
