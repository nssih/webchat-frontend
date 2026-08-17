import axios from 'axios'
import { useAuthStore } from '../store/authStore'

// 生产/staging 通过 VITE_API_URL 注入；开发时留空让请求走 Vite 代理（同源，绕过 CSP 限制）
const BASE_URL = import.meta.env.VITE_API_URL || ''

export const http = axios.create({
  baseURL: BASE_URL,
  timeout: 60000,
})

http.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let refreshPromise: Promise<string | null> | null = null

function isNetworkError(err: unknown): boolean {
  return axios.isAxiosError(err) && !err.response
}

http.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config

    if (isNetworkError(err) && !original._wakeRetry) {
      original._wakeRetry = true
      try {
        return await http(original)
      } catch (retryErr) {
        return Promise.reject(retryErr)
      }
    }

    const isAuthEndpoint = original.url?.includes('/api/auth/login') || original.url?.includes('/api/auth/register')
    if (err.response?.status === 401 && !original._retry && !isAuthEndpoint) {
      original._retry = true
      try {
        const refreshToken = useAuthStore.getState().refreshToken
        if (refreshToken) {
          if (!refreshPromise) {
            refreshPromise = axios
              .post(`${BASE_URL}/api/auth/refresh`, { refreshToken })
              .then((r) => {
                const { accessToken, refreshToken: newRefresh, user } = r.data.data
                useAuthStore.getState().setAuth(accessToken, newRefresh, user)
                return accessToken as string
              })
              .catch(() => null)
              .finally(() => { refreshPromise = null })
          }
          const newAccessToken = await refreshPromise
          if (newAccessToken) {
            original.headers.Authorization = `Bearer ${newAccessToken}`
            return http(original)
          }
        }
      } catch { }
      useAuthStore.getState().clearAuth()
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default http
