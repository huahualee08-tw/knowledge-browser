/**
 * Cloudflare Worker — Knowledge Browser Backend
 *
 * Endpoints:
 *   GET  /auth/google            → Redirect to Google OAuth consent screen
 *   GET  /auth/callback          → Handle OAuth callback, create session
 *   GET  /auth/status            → Return current user or { authenticated: false }
 *   POST /auth/logout            → Delete session and clear cookie
 *   GET  /api/files              → List knowledge-base files from Google Drive
 *   GET  /api/files/:id/content  → Return raw text content of a Drive file
 *
 * Required KV namespace binding:  SESSIONS
 * Required environment variables:
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URI, FRONTEND_URL
 */

export interface Env {
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  /** Full URL of /auth/callback on this Worker, e.g. https://kb-api.example.workers.dev/auth/callback */
  REDIRECT_URI: string
  /** Frontend origin, e.g. https://kb.example.pages.dev */
  FRONTEND_URL: string
  /** KV namespace for session storage */
  SESSIONS: KVNamespace
}

// ─── Constants ───────────────────────────────────────────────────────────────

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo'
const DRIVE_API = 'https://www.googleapis.com/drive/v3'

const DRIVE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive.readonly',
].join(' ')

const KB_FOLDERS = ['AI資訊', '程式開發', 'OpenClaw', 'YouTube_影片摘要', '個人成長', '投資理財', '其他']

const SESSION_TTL_SECS = 7 * 24 * 60 * 60  // 7 days
const STATE_TTL_SECS = 600                   // 10 minutes

// ─── Types ───────────────────────────────────────────────────────────────────

interface SessionData {
  userId: string
  email: string
  name: string
  picture?: string
  accessToken: string
  refreshToken?: string
  /** Unix ms */
  expiresAt: number
}

interface GoogleTokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
  id_token?: string
}

interface GoogleUserInfo {
  sub: string
  name: string
  email: string
  picture?: string
}

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

function json(data: unknown, status: number, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra },
  })
}

function getSessionId(request: Request): string | null {
  const cookie = request.headers.get('Cookie') ?? ''
  const match = cookie.match(/(?:^|;\s*)session=([^;]+)/)
  return match?.[1] ?? null
}

function sessionCookieHeader(sessionId: string, maxAge: number): string {
  return `session=${sessionId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`
}

async function readSession(env: Env, sessionId: string): Promise<SessionData | null> {
  return env.SESSIONS.get<SessionData>(sessionId, 'json')
}

/**
 * Return a valid access token, refreshing it transparently if it has expired.
 * The session in KV is updated in-place when a refresh occurs.
 */
async function getValidToken(env: Env, sessionId: string, session: SessionData): Promise<string> {
  // Give 60-second buffer before expiry
  if (Date.now() < session.expiresAt - 60_000) return session.accessToken

  if (!session.refreshToken) {
    throw new Error('Access token expired and no refresh token available')
  }

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: session.refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`)

  const tokens = await res.json() as GoogleTokenResponse

  const updated: SessionData = {
    ...session,
    accessToken: tokens.access_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  }

  await env.SESSIONS.put(sessionId, JSON.stringify(updated), { expirationTtl: SESSION_TTL_SECS })

  return updated.accessToken
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

// ─── Route handlers ───────────────────────────────────────────────────────────

/** GET /auth/google — kick off server-side OAuth */
async function handleAuthGoogle(env: Env): Promise<Response> {
  const state = crypto.randomUUID()
  await env.SESSIONS.put(`state:${state}`, '1', { expirationTtl: STATE_TTL_SECS })

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: env.REDIRECT_URI,
    response_type: 'code',
    scope: DRIVE_SCOPES,
    state,
    access_type: 'offline',
    prompt: 'consent',
  })

  return Response.redirect(`${GOOGLE_AUTH_URL}?${params}`, 302)
}

/** GET /auth/callback — exchange code for tokens, create session */
async function handleAuthCallback(url: URL, env: Env): Promise<Response> {
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  const fail = (reason: string) =>
    Response.redirect(`${env.FRONTEND_URL}?error=${encodeURIComponent(reason)}`, 302)

  if (error) return fail(error)
  if (!code || !state) return fail('missing_params')

  // Validate CSRF state
  const storedState = await env.SESSIONS.get(`state:${state}`)
  if (!storedState) return fail('invalid_state')
  await env.SESSIONS.delete(`state:${state}`)

  // Exchange authorization code for tokens
  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: env.REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  })

  if (!tokenRes.ok) return fail('token_exchange_failed')

  const tokens = await tokenRes.json() as GoogleTokenResponse

  // Fetch user profile
  const userRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  if (!userRes.ok) return fail('userinfo_failed')

  const userInfo = await userRes.json() as GoogleUserInfo

  // Persist session
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

  await env.SESSIONS.put(sessionId, JSON.stringify(session), { expirationTtl: SESSION_TTL_SECS })

  return new Response(null, {
    status: 302,
    headers: {
      Location: env.FRONTEND_URL,
      'Set-Cookie': sessionCookieHeader(sessionId, SESSION_TTL_SECS),
    },
  })
}

/** GET /auth/status — return current user or { authenticated: false } */
async function handleAuthStatus(request: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  const sessionId = getSessionId(request)
  if (!sessionId) return json({ authenticated: false }, 200, cors)

  const session = await readSession(env, sessionId)
  if (!session) return json({ authenticated: false }, 200, cors)

  return json({
    authenticated: true,
    user: {
      name: session.name,
      email: session.email,
      picture: session.picture,
    },
  }, 200, cors)
}

/** POST /auth/logout — delete session and clear cookie */
async function handleAuthLogout(request: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  const sessionId = getSessionId(request)
  if (sessionId) await env.SESSIONS.delete(sessionId)

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': 'session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0',
      ...cors,
    },
  })
}

/** GET /api/folders — list root folders from Google Drive */
async function handleListFolders(request: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  const sessionId = getSessionId(request)
  if (!sessionId) return json({ error: 'Unauthorized' }, 401, cors)

  const session = await readSession(env, sessionId)
  if (!session) return json({ error: 'Unauthorized' }, 401, cors)

  let token: string
  try {
    token = await getValidToken(env, sessionId, session)
  } catch {
    return json({ error: 'Session expired, please log in again' }, 401, cors)
  }

  try {
    const foldersData = await driveGet<{ files: Array<{ id: string; name: string }> }>(
      token, '/files', {
        q: "mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false",
        fields: 'files(id,name)',
        pageSize: '100',
      }
    )

    const folderMap = new Map(foldersData.files.map((f) => [f.id, f.name]))
    const kbFolders = foldersData.files.filter((f) => KB_FOLDERS.includes(f.name))

    return json({ folders: kbFolders, folderMap: Object.fromEntries(folderMap) }, 200, cors)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Drive API error:', err)
    return json({ error: 'Drive API error', details: message }, 502, cors)
  }
}

/** GET /api/files — list all knowledge-base files from Google Drive */
async function handleListFiles(request: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  const sessionId = getSessionId(request)
  if (!sessionId) return json({ error: 'Unauthorized' }, 401, cors)

  const session = await readSession(env, sessionId)
  if (!session) return json({ error: 'Unauthorized' }, 401, cors)

  let token: string
  try {
    token = await getValidToken(env, sessionId, session)
  } catch {
    return json({ error: 'Session expired, please log in again' }, 401, cors)
  }

  try {
    // 1. Fetch root folders to build id→name map
    const foldersData = await driveGet<{ files: Array<{ id: string; name: string }> }>(
      token, '/files', {
        q: "mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false",
        fields: 'files(id,name)',
        pageSize: '100',
      }
    )

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

/** GET /api/files/:id/content — return raw text content of a Drive file */
async function handleFileContent(
  fileId: string,
  request: Request,
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
  const sessionId = getSessionId(request)
  if (!sessionId) return json({ error: 'Unauthorized' }, 401, cors)

  const session = await readSession(env, sessionId)
  if (!session) return json({ error: 'Unauthorized' }, 401, cors)

  let token: string
  try {
    token = await getValidToken(env, sessionId, session)
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

// ─── Main fetch handler ───────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const { pathname, method } = url as { pathname: string; method?: string } & URL
    const cors = corsHeaders(env.FRONTEND_URL)

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors })
    }

    // ── Auth routes ──────────────────────────────────────────────
    if (pathname === '/auth/google' && request.method === 'GET') {
      return handleAuthGoogle(env)
    }

    if (pathname === '/auth/callback' && request.method === 'GET') {
      return handleAuthCallback(url, env)
    }

    if (pathname === '/auth/status' && request.method === 'GET') {
      return handleAuthStatus(request, env, cors)
    }

    if (pathname === '/auth/logout' && request.method === 'POST') {
      return handleAuthLogout(request, env, cors)
    }

    // ── Drive proxy routes ───────────────────────────────────────
    if (pathname === '/api/folders' && request.method === 'GET') {
      return handleListFolders(request, env, cors)
    }

    if (pathname === '/api/files' && request.method === 'GET') {
      return handleListFiles(request, env, cors)
    }

    const contentMatch = pathname.match(/^\/api\/files\/([^/]+)\/content$/)
    if (contentMatch && request.method === 'GET') {
      return handleFileContent(contentMatch[1], request, env, cors)
    }

    return json({ error: 'Not found' }, 404, cors)
  },
}
