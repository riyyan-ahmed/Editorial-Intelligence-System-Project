import React, { useState } from 'react'
import { useNavigate, Link as RLink } from 'react-router-dom'
import {
  Box, Button, TextField, Typography, Link, Alert, CircularProgress, InputAdornment, IconButton,
} from '@mui/material'
// Sign-up is disabled — accounts are pre-created by admin
import VisibilityIcon     from '@mui/icons-material/Visibility'
import VisibilityOffIcon  from '@mui/icons-material/VisibilityOff'
import { login, saveSession } from '../api/auth'

export default function Login() {
  const nav = useNavigate()
  const [form,     setForm]     = useState({ username: '', password: '' })
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  const handle = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.username || !form.password) { setError('Please fill in all fields'); return }
    setLoading(true); setError('')
    try {
      const data = await login(form.username, form.password)
      saveSession(data)
      nav('/app')
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex' }}>
      {/* Left panel */}
      <Box sx={{
        display: { xs: 'none', md: 'flex' },
        flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start',
        width: '45%', flexShrink: 0,
        background: 'linear-gradient(160deg, #0f172a 0%, #1e1b4b 60%, #0f172a 100%)',
        px: 8, color: '#fff',
      }}>
        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#3b82f6', mb: 4 }} />
        <Typography variant="h3" sx={{ fontWeight: 800, mb: 2, lineHeight: 1.2 }}>
          Editorial<br />Intelligence<br />System
        </Typography>
        <Typography sx={{ opacity: 0.6, fontSize: '0.95rem', lineHeight: 1.7, maxWidth: 340 }}>
          AI-powered multilingual content generation and editorial analysis for digital publishers.
        </Typography>
        <Box sx={{ mt: 6, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {['232k+ Embedded Articles', '3 Languages · Greek, English, French', 'Qwen 2.5-7B · bge-m3 Embeddings'].map(t => (
            <Box key={t} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: '#3b82f6', flexShrink: 0 }} />
              <Typography sx={{ opacity: 0.7, fontSize: '0.85rem' }}>{t}</Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Right panel */}
      <Box sx={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        bgcolor: '#f8fafc', px: { xs: 3, md: 6 },
      }}>
        <Box sx={{ width: '100%', maxWidth: 400 }}>
          <Box sx={{ mb: 4 }}>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#0f172a', mb: 0.5 }}>
              Welcome back
            </Typography>
            <Typography sx={{ color: '#64748b', fontSize: '0.92rem' }}>
              Sign in to your account to continue
            </Typography>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }}>{error}</Alert>}

          <Box component="form" onSubmit={submit} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <TextField
              label="Username or Email"
              value={form.username}
              onChange={handle('username')}
              fullWidth
              autoFocus
              sx={{ bgcolor: '#fff' }}
            />
            <TextField
              label="Password"
              type={showPw ? 'text' : 'password'}
              value={form.password}
              onChange={handle('password')}
              fullWidth
              sx={{ bgcolor: '#fff' }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setShowPw(p => !p)}>
                      {showPw ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <Button
              type="submit" variant="contained" fullWidth size="large"
              disabled={loading}
              sx={{ py: 1.4, fontSize: '1rem', mt: 0.5 }}
            >
              {loading ? <CircularProgress size={22} sx={{ color: '#fff' }} /> : 'Sign In'}
            </Button>
          </Box>

          <Typography sx={{ mt: 3, textAlign: 'center', color: '#64748b', fontSize: '0.9rem' }}>
            New editor?{' '}
            <Link component={RLink} to="/signup" sx={{ color: '#2563eb', fontWeight: 600 }}>
              Create account
            </Link>
          </Typography>
          <Typography sx={{ mt: 1.5, textAlign: 'center' }}>
            <Link component={RLink} to="/" sx={{ color: '#94a3b8', fontSize: '0.85rem' }}>
              ← Back to Home
            </Link>
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}
