/**
 * GET /api/auth/callback — Handle OAuth callback, create session
 */
import {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  REDIRECT_URI,
  FRONTEND_URL,
  corsHeaders,
  storeSession,
  SessionData,
  GoogleTokenResponse,
  GoogleUserInfo,
  SESSION_TTL_SECS,
} from '../_shared'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo'

function getStateCookie(request: Request): string | null {
  const cookie = request.headers.get('Cookie') || ''
  const match = cookie.match(/(?:^|;\s*)oauth_state=([^;]+)/)
  return match?.[1] ?? null
}

function clearStateCookie(): string {
  return 'oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0'
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
    return new Response('Method not allowed', { status: 405, headers: cors })
  }

  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  const fail = (reason: string) =>
    Response.redirect(`${FRONTEND_URL}?error=${encodeURIComponent(reason)}`, 302)

  if (error) return fail(error)
  if (!code || !state) return fail('missing_params')

  // Validate CSRF state
  const storedState = getStateCookie(request)
  if (!storedState || storedState !== state) {
    return fail('invalid_state')
  }

  // Exchange authorization code for tokens
  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  })

  if (!tokenRes.ok) {
    console.error('Token exchange failed:', await tokenRes.text())
    return fail('token_exchange_failed')
  }

  const tokens = await tokenRes.json() as GoogleTokenResponse

  // Fetch user profile
  const userRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  if (!userRes.ok) {
    return fail('userinfo_failed')
  }

  const userInfo = await userRes.json() as GoogleUserInfo

  // Create session
  const sessionId = crypto.randomUUID()
  const session: SessionData = {
    userId: userInfo.sub,
    email: userInfo.email,
    name: userInfo.name,
    picture: userInfo.picture,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  }

  // Store session in memory
  await storeSession(sessionId, session)

  return new Response(null, {
    status: 302,
    headers: {
      Location: FRONTEND_URL,
      'Set-Cookie': [
        `session=${sessionId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_SECS}`,
        clearStateCookie(),
      ].join('; '),
    },
  })
}
