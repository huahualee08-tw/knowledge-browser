import type { VercelRequest, VercelResponse } from '@vercel/node'

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
    res.status(200).json({ authenticated: false })
    return
  }
  
  const session = sessionStore.get(sessionId)!
  res.status(200).json({ authenticated: true, email: session.email })
}
