import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import MainLayout from './components/common/MainLayout'
import ChatListPage from './pages/chat/ChatListPage'
import ChatPage from './pages/chat/ChatPage'
import FriendPage from './pages/friend/FriendPage'
import GroupPage from './pages/group/GroupPage'
import ProfilePage from './pages/profile/ProfilePage'
import AboutPage from './pages/about/AboutPage'
import type React from 'react'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = useAuthStore(s => s.user)
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <MainLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/chat" replace />} />
          <Route path="chat" element={<ChatListPage />} />
          <Route path="chat/:convId" element={<ChatPage />} />
          <Route path="friends" element={<FriendPage />} />
          <Route path="groups" element={<GroupPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="about" element={<AboutPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/chat" replace />} />
      </Routes>
    </BrowserRouter>
  )
}