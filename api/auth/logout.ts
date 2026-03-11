/**
 * POST /api/auth/logout — Delete session and clear cookie
 */
import {
  corsHeaders,
  getSessionCookie,
  deleteSession,
  json,
  clearSessionCookie,
  FRONTEND_URL,
} from '../_shared'

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const origin = url.origin
  const cors = corsHeaders(origin || FRONTEND_URL || '*')

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors })
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, cors)
  }

  const sessionId = getSessionCookie(request)
  if (sessionId) {
    await deleteSession(sessionId)
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': clearSessionCookie(),
      ...cors,
    },
  })
}
