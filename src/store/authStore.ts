import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { User } from '../types'

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: User | null
  setAuth: (accessToken: string, refreshToken: string, user: User) => void
  setUser: (user: User) => void
  clearAuth: () => void
}

// 多标签页同步：登录/注销状态实时同步，避免一个标签页注销后其他标签页仍持有 token
let bc: BroadcastChannel | null = null
try { bc = new BroadcastChannel('webchat-auth-sync') } catch { /* Safari 旧版不支持，降级忽略 */ }

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setAuth: (accessToken, refreshToken, user) => {
        set({ accessToken, refreshToken, user })
        bc?.postMessage({ type: 'SET_AUTH', accessToken, refreshToken, user })
      },
      setUser: (user) => set({ user }),
      clearAuth: () => {
        sessionStorage.removeItem('webchat-auth')
        // 同时清理旧版 localStorage（兼容升级前的数据）
        localStorage.removeItem('webchat-auth')
        localStorage.removeItem('webchat-creds')
        set({ accessToken: null, refreshToken: null, user: null })
        bc?.postMessage({ type: 'CLEAR_AUTH' })
      },
    }),
    {
      name: 'webchat-auth',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
)

// 接收其他标签页的 auth 同步消息
if (bc) {
  bc.onmessage = ({ data }) => {
    if (data.type === 'SET_AUTH') {
      useAuthStore.setState({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: data.user,
      })
    } else if (data.type === 'CLEAR_AUTH') {
      sessionStorage.removeItem('webchat-auth')
      useAuthStore.setState({ accessToken: null, refreshToken: null, user: null })
    }
  }
}
