import { useState, useCallback, useEffect } from 'react'
import type { User } from '../types'

interface AuthState {
  user: User | null
  isLoading: boolean
  error: string | null
}

interface UseAuthReturn extends AuthState {
  login: () => void
  logout: () => void
}

// 後端 OAuth 登入

export function useAuth(): UseAuthReturn {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    error: null,
  })

  // 檢查登入狀態
  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/status', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setState({
          user: data.user || null,
          isLoading: false,
          error: null,
        })
      } else {
        setState({ user: null, isLoading: false, error: null })
      }
    } catch {
      setState({ user: null, isLoading: false, error: null })
    }
  }, [])

  // 初始化時檢查登入狀態
  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  // 後端 OAuth 登入 - 跳轉到後端
  const login = useCallback(() => {
    window.location.href = '/api/auth/google'
  }, [])

  // 登出
  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })
    } finally {
      setState({ user: null, isLoading: false, error: null })
    }
  }, [])

  return { ...state, login, logout }
}
