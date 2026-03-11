import { google } from 'googleapis'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || ''
const FRONTEND_URL = process.env.FRONTEND_URL || ''

// The OAuth callback URL - must match what's configured in Google Cloud Console
const CALLBACK_URL = 'https://knowledge-browser.vercel.app/api/auth/callback'

const oauth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  CALLBACK_URL
)

// In-memory session store (note: resets on serverless cold start)
const sessionStore = new Map<string, { accessToken: string; refreshToken: string; email: string }>()

function generateSessionId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const code = req.query.code as string
  
  if (!code) {
    res.status(400).json({ error: 'No code provided' })
    return
  }
  
  try {
    const { tokens } = await oauth2Client.getToken(code)
    
    if (!tokens.access_token) {
      res.status(400).json({ error: 'No access token received' })
      return
    }
    
    // Get user email
    oauth2Client.setCredentials(tokens)
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
    const userInfo = await oauth2.userinfo.get()
    
    const sessionId = generateSessionId()
    sessionStore.set(sessionId, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || '',
      email: userInfo.data.email || ''
    })
    
    // Set cookie
    res.setHeader('Set-Cookie', `session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`)
    res.redirect(FRONTEND_URL)
  } catch (error) {
    console.error('Auth callback error:', error)
    res.status(500).json({ error: 'Authentication failed' })
  }
}
