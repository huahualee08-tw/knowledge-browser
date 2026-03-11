import { google } from 'googleapis'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// Environment variables
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || ''
const REDIRECT_URI = process.env.REDIRECT_URI || ''
const FRONTEND_URL = process.env.FRONTEND_URL || ''
const SESSION_SECRET = process.env.SESSION_SECRET || 'default-secret-change-me'

const oauth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  REDIRECT_URI
)

// Simple in-memory session store (for Vercel serverless)
// Note: This resets on each function invocation in serverless
const sessionStore = new Map<string, { accessToken: string; refreshToken: string; email: string }>()

function getSessionId(req: VercelRequest): string | undefined {
  const cookie = req.headers.cookie
  if (!cookie) return undefined
  
  const match = cookie.match(/session=([^;]+)/)
  return match ? match[1] : undefined
}

function setSessionCookie(res: VercelResponse, sessionId: string) {
  res.setHeader('Set-Cookie', `session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`)
}

function clearSessionCookie(res: VercelResponse) {
  res.setHeader('Set-Cookie', 'session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0')
}

function generateSessionId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const path = req.url?.replace(/^\/api\//, '') || ''
  
  // Auth routes
  if (path === 'auth/google' || req.url === '/auth/google') {
    const scopes = [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ]
    
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    })
    
    res.redirect(url)
    return
  }
  
  if (path.startsWith('auth/callback') || req.url?.startsWith('/auth/callback')) {
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
      
      setSessionCookie(res, sessionId)
      res.redirect(FRONTEND_URL)
    } catch (error) {
      console.error('Auth callback error:', error)
      res.status(500).json({ error: 'Authentication failed' })
    }
    return
  }
  
  if (path === 'auth/status' || req.url === '/auth/status') {
    const sessionId = getSessionId(req)
    
    if (!sessionId || !sessionStore.has(sessionId)) {
      res.status(401).json({ authenticated: false })
      return
    }
    
    const session = sessionStore.get(sessionId)!
    res.json({ authenticated: true, email: session.email })
    return
  }
  
  if (path === 'auth/logout' || req.url === '/auth/logout') {
    const sessionId = getSessionId(req)
    
    if (sessionId) {
      sessionStore.delete(sessionId)
    }
    
    clearSessionCookie(res)
    res.json({ success: true })
    return
  }
  
  // API routes
  if (path.startsWith('files') || req.url?.startsWith('/api/files')) {
    const sessionId = getSessionId(req)
    
    if (!sessionId || !sessionStore.has(sessionId)) {
      res.status(401).json({ error: 'Not authenticated' })
      return
    }
    
    const session = sessionStore.get(sessionId)!
    oauth2Client.setCredentials({
      access_token: session.accessToken,
      refresh_token: session.refreshToken
    })
    
    const drive = google.drive({ version: 'v3', auth: oauth2Client })
    
    try {
      // List files from knowledge base folders
      const response = await drive.files.list({
        q: "name contains '知識庫' or name contains 'Knowledge' or name contains 'KB' or mimeType = 'application/vnd.google-apps.folder'",
        fields: 'files(id, name, mimeType, modifiedTime, parents)',
        pageSize: 50
      })
      
      res.json({ files: response.data.files || [] })
    } catch (error) {
      console.error('Drive API error:', error)
      res.status(500).json({ error: 'Failed to fetch files' })
    }
    return
  }
  
  if (path.startsWith('files/') && path.includes('/content')) {
    const sessionId = getSessionId(req)
    
    if (!sessionId || !sessionStore.has(sessionId)) {
      res.status(401).json({ error: 'Not authenticated' })
      return
    }
    
    const session = sessionStore.get(sessionId)!
    oauth2Client.setCredentials({
      access_token: session.accessToken,
      refresh_token: session.refreshToken
    })
    
    const drive = google.drive({ version: 'v3', auth: oauth2Client })
    
    // Extract file ID from path like files/abc123/content
    const fileId = path.split('/')[1]
    
    try {
      // Get file content
      const file = await drive.files.get({
        fileId,
        fields: 'mimeType, name'
      })
      
      let content = ''
      
      if (file.data.mimeType === 'application/vnd.google-apps.document') {
        // Google Doc - export as markdown
        const doc = await drive.files.export({
          fileId,
          mimeType: 'text/markdown'
        }, { responseType: 'text' })
        content = doc.data as string
      } else if (file.data.mimeType === 'application/vnd.google-apps.text') {
        const doc = await drive.files.get({
          fileId,
          alt: 'media'
        }, { responseType: 'text' })
        content = doc.data as string
      } else {
        content = `[File: ${file.data.name}] - Binary content not displayed`
      }
      
      res.json({ content, name: file.data.name })
    } catch (error) {
      console.error('File content error:', error)
      res.status(500).json({ error: 'Failed to fetch file content' })
    }
    return
  }
  
  // 404 for unknown routes
  res.status(404).json({ error: 'Not found' })
}
