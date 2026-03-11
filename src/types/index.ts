export interface DriveFile {
  id: string
  name: string
  mimeType: string
  modifiedTime: string
  size?: string
  parents?: string[]
  category: string
  webViewLink?: string
}

export interface DriveFolder {
  id: string
  name: string
}

export interface User {
  name: string
  email: string
  picture?: string
}

export type Category = string | 'all'
