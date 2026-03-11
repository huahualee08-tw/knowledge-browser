/**
 * GET /api/auth/status — Return current user or { authenticated: false }
 */
import {
  corsHeaders,
  getSessionCookie,
  getSession,
  json,
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

  if (request.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405, cors)
  }

  const sessionId = getSessionCookie(request)
  if (!sessionId) {
    return json({ authenticated: false }, 200, cors)
  }

  const session = await getSession(sessionId)
  if (!session) {
    return json({ authenticated: false }, 200, cors)
  }

  return json({
    authenticated: true,
    user: {
      name: session.name,
      email: session.email,
      picture: session.picture,
    },
  }, 200, cors)
}
