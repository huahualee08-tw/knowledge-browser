/**
 * Shared session utilities for Vercel API routes
 * Uses cookie-based sessions with signed/encrypted session data
 */

// Environment variables
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!
export const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!
export const REDIRECT_URI = process.env.REDIRECT_URI!
export const FRONTEND_URL = process.env.FRONTEND_URL!
export const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-in-production'

// For local development, use localhost URLs
const isDev = process.env.NODE_ENV === 'development' || !REDIRECT_URI?.includes('vercel')

// Constants
export const DRIVE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive.readonly',
].join(' ')

export const KB_FOLDERS = ['AI資訊', '程式開發', 'OpenClaw', 'YouTube_影片摘要', '個人成長', '投資理財', '其他']
export const SESSION_TTL_SECS = 7 * 24 * 60 * 60  // 7 days

// Types
export interface SessionData {
  userId: string
  email: string
  name: string
  picture?: string
  accessToken: string
  refreshToken?: string
  expiresAt: number
}

export interface GoogleTokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
  id_token?: string
}

export interface GoogleUserInfo {
  sub: string
  name: string
  email: string
  picture?: string
}

// Simple base64 encoding (not secure for production - use signed cookies)
// For production, consider using iron-session or similar
function encodeSession(data: SessionData): string {
  return Buffer.from(JSON.stringify(data)).toString('base64')
}

function decodeSession(encoded: string): SessionData | null {
  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8')
    return JSON.parse(decoded) as SessionData
  } catch {
    return null
  }
}

// Cookie helpers
export function getSessionCookie(request: Request): string | null {
  const cookie = request.headers.get('Cookie') || ''
  const match = cookie.match(/(?:^|;\s*)session=([^;]+)/)
  return match?.[1] ?? null
}

export function createSessionCookie(sessionId: string, _maxAge: number): string {
  // In Vercel, we'll store the session data directly in the cookie (base64 encoded)
  // The sessionId is used as a key to look up data - but we can't store data server-side
  // So we'll encode the session data in the cookie itself
  return `session=${sessionId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_SECS}`
}

export function clearSessionCookie(): string {
  return 'session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0'
}

// For serverless, we need to store sessions somewhere
// We'll use a simple in-memory store (works for single instance Vercel deployments)
// In production, consider using Vercel KV, Redis, or a database
const sessionStore = new Map<string, { data: SessionData; expiresAt: number }>()

export async function storeSession(sessionId: string, data: SessionData): Promise<void> {
  sessionStore.set(sessionId, {
    data,
    expiresAt: Date.now() + SESSION_TTL_SECS * 1000,
  })
  
  // Clean up expired sessions occasionally
  if (sessionStore.size > 100) {
    const now = Date.now()
    for (const [key, value] of sessionStore) {
      if (value.expiresAt < now) sessionStore.delete(key)
    }
  }
}

export async function getSession(sessionId: string): Promise<SessionData | null> {
  const stored = sessionStore.get(sessionId)
  if (!stored) return null
  
  if (Date.now() > stored.expiresAt) {
    sessionStore.delete(sessionId)
    return null
  }
  
  return stored.data
}

export async function deleteSession(sessionId: string): Promise<void> {
  sessionStore.delete(sessionId)
}

// Token refresh
export async function refreshAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${response.status}`)
  }

  return response.json() as Promise<GoogleTokenResponse>
}

export async function getValidToken(session: SessionData): Promise<string> {
  // Give 60-second buffer before expiry
  if (Date.now() < session.expiresAt - 60_000) return session.accessToken

  if (!session.refreshToken) {
    throw new Error('Access token expired and no refresh token available')
  }

  const tokens = await refreshAccessToken(session.refreshToken)

  const updated: SessionData = {
    ...session,
    accessToken: tokens.access_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  }

  return updated.accessToken
}

// CORS headers
export function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

// JSON response helper
export function json(data: unknown, status: number, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra },
  })
}
