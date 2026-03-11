import { google } from 'googleapis'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || ''
const REDIRECT_URI = process.env.REDIRECT_URI || ''

const oauth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  REDIRECT_URI
)

// In-memory session store (note: resets on serverless cold start)
const sessionStore = new Map<string, { accessToken: string; refreshToken: string; email: string }>()

function getSessionId(req: VercelRequest): string | undefined {
  const cookie = req.headers.cookie
  if (!cookie) return undefined
  
  const match = cookie.match(/session=([^;]+)/)
  return match ? match[1] : undefined
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
}
