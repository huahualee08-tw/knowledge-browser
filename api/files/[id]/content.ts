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
  
  // Get file ID from query param
  const fileId = req.query.id as string
  
  if (!fileId) {
    res.status(400).json({ error: 'No file ID provided' })
    return
  }
  
  try {
    // Get file metadata
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
}
