/**
 * GET /api/auth/google — Redirect to Google OAuth consent screen
 */
import { GOOGLE_CLIENT_ID, REDIRECT_URI, DRIVE_SCOPES, corsHeaders, FRONTEND_URL } from '../_shared'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const origin = url.origin
  const cors = corsHeaders(origin || FRONTEND_URL || '*')

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors })
  }

  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: cors })
  }

  // Generate state for CSRF protection
  const state = crypto.randomUUID()
  
  // Store state in a cookie temporarily (will be validated on callback)
  const stateCookie = `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: DRIVE_SCOPES,
    state,
    access_type: 'offline',
    prompt: 'consent',
  })

  return new Response(null, {
    status: 302,
    headers: {
      Location: `${GOOGLE_AUTH_URL}?${params}`,
      'Set-Cookie': stateCookie,
      ...cors,
    },
  })
}
