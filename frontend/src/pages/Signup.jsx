import React, { useState } from 'react'
import { useNavigate, Link as RLink } from 'react-router-dom'
import {
  Box, Button, TextField, Typography, Link, Alert, CircularProgress,
  InputAdornment, IconButton,
} from '@mui/material'
import VisibilityIcon    from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import InfoOutlinedIcon  from '@mui/icons-material/InfoOutlined'
import { register, saveSession } from '../api/auth'

export default function Signup() {
  const nav = useNavigate()
  const [form,    setForm]    = useState({ username: '', email: '', password: '', confirm: '' })
  const [showPw,  setShowPw]  = useState(false)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const handle = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.username || !form.email || !form.password) { setError('Please fill in all fields'); return }
    if (form.password !== form.confirm) { setError('Passwords do not match'); return }
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return }
    setLoading(true); setError('')
    try {
      const data = await register(form.username, form.email, form.password)
      saveSession(data)
      nav('/user')
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed')
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
          Join as an<br />Editor
        </Typography>
        <Typography sx={{ opacity: 0.6, fontSize: '0.95rem', lineHeight: 1.7, maxWidth: 340 }}>
          Create your editor account. Once registered, an admin will assign
          authors to you — you can then learn their styles and generate content.
        </Typography>
        <Box sx={{ mt: 6, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {['Learn author writing styles', 'Generate style-matched articles', 'Submit V1→V2 evaluation pairs'].map(t => (
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
        <Box sx={{ width: '100%', maxWidth: 420 }}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#0f172a', mb: 0.5 }}>
              Create editor account
            </Typography>
            <Typography sx={{ color: '#64748b', fontSize: '0.92rem' }}>
              Sign up to access the editorial platform
            </Typography>
          </Box>

          {/* Info callout */}
          <Box sx={{
            display: 'flex', gap: 1.2, bgcolor: '#eff6ff', border: '1px solid #bfdbfe',
            borderRadius: 2, p: 1.8, mb: 2.5,
          }}>
            <InfoOutlinedIcon sx={{ fontSize: 18, color: '#2563eb', flexShrink: 0, mt: 0.1 }} />
            <Typography sx={{ fontSize: '0.82rem', color: '#1d4ed8', lineHeight: 1.6 }}>
              After signing up, an admin will assign specific authors to your account.
              You'll see them in your dashboard once assigned.
            </Typography>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }}>{error}</Alert>}

          <Box component="form" onSubmit={submit} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <TextField
              label="Username" value={form.username} onChange={handle('username')}
              fullWidth autoFocus sx={{ bgcolor: '#fff' }}
            />
            <TextField
              label="Email Address" value={form.email} onChange={handle('email')}
              fullWidth type="email" sx={{ bgcolor: '#fff' }}
            />
            <TextField
              label="Password" type={showPw ? 'text' : 'password'}
              value={form.password} onChange={handle('password')}
              fullWidth sx={{ bgcolor: '#fff' }}
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
            <TextField
              label="Confirm Password" type={showPw ? 'text' : 'password'}
              value={form.confirm} onChange={handle('confirm')}
              fullWidth sx={{ bgcolor: '#fff' }}
            />
            <Button type="submit" variant="contained" fullWidth size="large"
              disabled={loading} sx={{ py: 1.4, fontSize: '1rem', mt: 0.5 }}>
              {loading ? <CircularProgress size={22} sx={{ color: '#fff' }} /> : 'Create Account'}
            </Button>
          </Box>

          <Typography sx={{ mt: 3, textAlign: 'center', color: '#64748b', fontSize: '0.9rem' }}>
            Already have an account?{' '}
            <Link component={RLink} to="/login" sx={{ color: '#2563eb', fontWeight: 600 }}>Sign In</Link>
          </Typography>
          <Typography sx={{ mt: 1.5, textAlign: 'center' }}>
            <Link component={RLink} to="/" sx={{ color: '#94a3b8', fontSize: '0.85rem' }}>← Back to Home</Link>
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}
