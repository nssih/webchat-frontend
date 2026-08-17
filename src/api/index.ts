import http from './http'
import type { ApiResponse, AuthResponse, User } from '../types'

export const authApi = {
  register: (data: { username: string; password: string; confirmPassword: string }) =>
    http.post<ApiResponse<AuthResponse>>('/api/auth/register', data).then(r => r.data),

  login: (data: { login: string; password: string; deviceName?: string; deviceId?: string }) =>
    http.post<ApiResponse<AuthResponse>>('/api/auth/login', data).then(r => r.data),

  refresh: (refreshToken: string) =>
    http.post<ApiResponse<AuthResponse>>('/api/auth/refresh', { refreshToken }).then(r => r.data),

  logout: (refreshToken: string) =>
    http.post<ApiResponse<void>>('/api/auth/logout', { refreshToken }).then(r => r.data),

  getWsTicket: () =>
    http.post<ApiResponse<{ ticket: string }>>('/api/auth/ws-ticket').then(r => r.data),
}

export const userApi = {
  me: () =>
    http.get<ApiResponse<User>>('/api/users/me').then(r => r.data),

  search: (keyword: string) =>
    http.get<ApiResponse<User[]>>('/api/users/search', { params: { keyword } }).then(r => r.data),

  online: () =>
    http.get<ApiResponse<User[]>>('/api/users/online').then(r => r.data),

  getUserByUsername: (username: string) =>
    http.get<ApiResponse<User>>(`/api/users/by-username/${username}`).then(r => r.data),

  updateProfile: (data: { nickname?: string; avatar?: string }) =>
    http.patch<ApiResponse<User>>('/api/users/me', data).then(r => r.data),

  uploadPublicKey: (publicKey: string) =>
    http.put<ApiResponse<void>>('/api/users/me/public-key', { publicKey }).then(r => r.data),

  deleteAccount: (password: string) =>
    http.delete<ApiResponse<void>>('/api/users/me', { data: { password } }).then(r => r.data),
}

export const groupApi = {
  create: (name: string) =>
    http.post<ApiResponse<import('../types').Group>>('/api/groups', { name }).then(r => r.data),

  list: () =>
    http.get<ApiResponse<import('../types').Group[]>>('/api/groups').then(r => r.data),

  get: (groupId: number) =>
    http.get<ApiResponse<import('../types').Group>>(`/api/groups/${groupId}`).then(r => r.data),

  invite: (groupId: number, userId: number) =>
    http.post<ApiResponse<import('../types').Group>>(`/api/groups/${groupId}/members/${userId}`).then(r => r.data),

  leave: (groupId: number) =>
    http.delete<ApiResponse<void>>(`/api/groups/${groupId}/members/me`).then(r => r.data),

  uploadGroupKey: (groupId: number, targetUsername: string, encryptedKey: string, wrappedBy: string) =>
    http.put<ApiResponse<void>>(`/api/groups/${groupId}/keys`, { targetUsername, encryptedKey, wrappedBy }).then(r => r.data),

  getMyGroupKey: (groupId: number, version?: number) =>
    http.get<ApiResponse<string | null>>(`/api/groups/${groupId}/keys/me${version != null ? `?version=${version}` : ''}`).then(r => r.data),
}