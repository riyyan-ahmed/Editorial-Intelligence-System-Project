import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider, CssBaseline } from '@mui/material'
import theme from './theme'
import Landing from './pages/Landing'
import Login   from './pages/Login'
import Signup  from './pages/Signup'
import Admin   from './pages/Admin'
import User    from './pages/User'
import UnifiedApp from './pages/UnifiedApp'
import { getSession } from './api/auth'

function ProtectedAdmin({ children }) {
  const s = getSession()
  if (!s) return <Navigate to="/login" replace />
  if (s.role !== 'admin') return <Navigate to="/user" replace />
  return children
}

function ProtectedUser({ children }) {
  const s = getSession()
  if (!s) return <Navigate to="/login" replace />
  if (s.role === 'admin') return <Navigate to="/admin" replace />
  return children
}

function ProtectedApp({ children }) {
  const s = getSession()
  if (!s) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          <Route path="/"       element={<Landing />} />
          <Route path="/login"  element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/app"    element={<ProtectedApp><UnifiedApp /></ProtectedApp>} />
          <Route path="/admin"  element={<ProtectedAdmin><Admin /></ProtectedAdmin>} />
          <Route path="/user"   element={<ProtectedUser><User /></ProtectedUser>} />
          <Route path="*"       element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}
