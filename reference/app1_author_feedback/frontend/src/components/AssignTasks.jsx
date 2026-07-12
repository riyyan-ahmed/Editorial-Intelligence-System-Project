import React, { useState, useEffect } from 'react'
import {
  Box, Typography, TextField, Chip, CircularProgress,
  InputAdornment, Alert, Tooltip,
} from '@mui/material'
import PersonIcon    from '@mui/icons-material/Person'
import SearchIcon    from '@mui/icons-material/Search'
import CheckIcon     from '@mui/icons-material/Check'
import AddIcon       from '@mui/icons-material/Add'
import RemoveIcon    from '@mui/icons-material/Remove'
import { getUsers, getAssignments, addAssignment, removeAssignment } from '../api/auth'
import { getAuthors } from '../api/index'

const LANG_COLORS = {
  en: { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8', label: 'EN' },
  el: { bg: '#fdf4ff', border: '#e9d5ff', text: '#7c3aed', label: 'EL' },
}

function UserCard({ user, selected, onClick }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        p: 2, borderRadius: 2, cursor: 'pointer', mb: 1.5,
        border: selected ? '2px solid #2563eb' : '2px solid #e2e8f0',
        bgcolor: selected ? '#eff6ff' : '#fff',
        transition: 'all 0.15s',
        '&:hover': { borderColor: '#2563eb', bgcolor: '#f8fafc' },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box sx={{
          width: 36, height: 36, borderRadius: '50%',
          bgcolor: selected ? '#2563eb' : '#e2e8f0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <PersonIcon sx={{ fontSize: 18, color: selected ? '#fff' : '#64748b' }} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.92rem', color: '#0f172a' }}>
            {user.username}
          </Typography>
          <Typography sx={{ fontSize: '0.78rem', color: '#64748b' }}>
            {user.assignment_count} author{user.assignment_count !== 1 ? 's' : ''} assigned
          </Typography>
        </Box>
        {selected && <CheckIcon sx={{ fontSize: 16, color: '#2563eb' }} />}
      </Box>
    </Box>
  )
}

function AuthorRow({ author, assigned, onToggle, busy }) {
  const lc = LANG_COLORS[author.lang] || LANG_COLORS.en
  return (
    <Box
      sx={{
        display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1,
        borderRadius: 1.5, bgcolor: assigned ? '#f0fdf4' : '#fff',
        border: `1px solid ${assigned ? '#bbf7d0' : '#e2e8f0'}`,
        transition: 'all 0.12s',
        '&:hover': { borderColor: assigned ? '#86efac' : '#94a3b8', bgcolor: assigned ? '#dcfce7' : '#f8fafc' },
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 600, fontSize: '0.87rem', color: '#0f172a', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {author.author_name}
        </Typography>
        <Typography sx={{ fontSize: '0.74rem', color: '#94a3b8' }}>
          {(author.article_count || 0).toLocaleString()} articles
        </Typography>
      </Box>
      <Chip
        label={lc.label}
        size="small"
        sx={{ height: 20, fontSize: '0.7rem', fontWeight: 700, bgcolor: lc.bg, color: lc.text, border: `1px solid ${lc.border}`, flexShrink: 0 }}
      />
      <Tooltip title={assigned ? 'Remove access' : 'Grant access'} placement="left">
        <Box
          onClick={busy ? undefined : onToggle}
          sx={{
            width: 28, height: 28, borderRadius: 1, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            bgcolor: assigned ? '#dcfce7' : '#f1f5f9',
            border: `1px solid ${assigned ? '#86efac' : '#cbd5e1'}`,
            cursor: busy ? 'not-allowed' : 'pointer',
            transition: 'all 0.12s',
            '&:hover': busy ? {} : {
              bgcolor: assigned ? '#fef2f2' : '#dbeafe',
              borderColor: assigned ? '#fca5a5' : '#93c5fd',
            },
          }}
        >
          {busy
            ? <CircularProgress size={12} />
            : assigned
              ? <RemoveIcon sx={{ fontSize: 14, color: '#16a34a' }} />
              : <AddIcon    sx={{ fontSize: 14, color: '#64748b' }} />
          }
        </Box>
      </Tooltip>
    </Box>
  )
}

export default function AssignTasks() {
  const [users,        setUsers]        = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [assignments,  setAssignments]  = useState([])   // for selected user
  const [allAuthors,   setAllAuthors]   = useState([])   // all EN+EL authors
  const [search,       setSearch]       = useState('')
  const [langFilter,   setLangFilter]   = useState('all')
  const [loadingInit,  setLoadingInit]  = useState(true)
  const [loadingUser,  setLoadingUser]  = useState(false)
  const [busyId,       setBusyId]       = useState(null)  // author_id being toggled
  const [error,        setError]        = useState('')

  useEffect(() => {
    setLoadingInit(true)
    Promise.all([
      getUsers(),
      getAuthors('en'),
      getAuthors('el'),
    ])
      .then(([users, enAuthors, elAuthors]) => {
        setUsers(users)
        setAllAuthors([
          ...(Array.isArray(enAuthors) ? enAuthors : []).map(a => ({ ...a, lang: 'en' })),
          ...(Array.isArray(elAuthors) ? elAuthors : []).map(a => ({ ...a, lang: 'el' })),
        ])
      })
      .catch(e => setError(e.message))
      .finally(() => setLoadingInit(false))
  }, [])

  const selectUser = (user) => {
    setSelectedUser(user)
    setAssignments([])
    setSearch('')
    setLoadingUser(true)
    getAssignments(user.id)
      .then(setAssignments)
      .catch(e => setError(e.message))
      .finally(() => setLoadingUser(false))
  }

  const isAssigned = (lang, author_id) =>
    assignments.some(a => a.lang === lang && a.author_id === author_id)

  const toggle = async (author) => {
    if (!selectedUser || busyId) return
    const key = `${author.lang}:${author.author_id}`
    setBusyId(key)
    try {
      if (isAssigned(author.lang, author.author_id)) {
        await removeAssignment(selectedUser.id, author.lang, author.author_id)
        setAssignments(prev => prev.filter(a => !(a.lang === author.lang && a.author_id === author.author_id)))
        setUsers(prev => prev.map(u =>
          u.id === selectedUser.id ? { ...u, assignment_count: u.assignment_count - 1 } : u
        ))
        setSelectedUser(prev => ({ ...prev, assignment_count: prev.assignment_count - 1 }))
      } else {
        await addAssignment(selectedUser.id, author.lang, author.author_id, author.author_name)
        setAssignments(prev => [...prev, { lang: author.lang, author_id: author.author_id, author_name: author.author_name }])
        setUsers(prev => prev.map(u =>
          u.id === selectedUser.id ? { ...u, assignment_count: u.assignment_count + 1 } : u
        ))
        setSelectedUser(prev => ({ ...prev, assignment_count: prev.assignment_count + 1 }))
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setBusyId(null)
    }
  }

  // Build display list
  const assignedSet   = new Set(assignments.map(a => `${a.lang}:${a.author_id}`))
  const assignedAuthors = allAuthors.filter(a => assignedSet.has(`${a.lang}:${a.author_id}`))
  const q = search.trim().toLowerCase()
  const searchResults = q.length >= 2
    ? allAuthors.filter(a => {
        if (langFilter !== 'all' && a.lang !== langFilter) return false
        return a.author_name.toLowerCase().includes(q) && !assignedSet.has(`${a.lang}:${a.author_id}`)
      }).slice(0, 20)
    : []

  const filteredAssigned = langFilter === 'all'
    ? assignedAuthors
    : assignedAuthors.filter(a => a.lang === langFilter)

  if (loadingInit) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <CircularProgress size={28} />
        <Typography sx={{ ml: 2, color: '#64748b' }}>Loading users and authors…</Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ px: { xs: 2, md: 5 }, py: 4, maxWidth: 1100, mx: 'auto' }}>

      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#0f172a', mb: 0.5 }}>
          Assign Tasks
        </Typography>
        <Typography sx={{ color: '#64748b', fontSize: '0.9rem' }}>
          Control which authors each user can learn from and generate content for.
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>{error}</Alert>}

      <Box sx={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 3, alignItems: 'start' }}>

        {/* ── Left: user list ── */}
        <Box>
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, mb: 1.5 }}>
            Users
          </Typography>
          {users.map(u => (
            <UserCard
              key={u.id}
              user={u}
              selected={selectedUser?.id === u.id}
              onClick={() => selectUser(u)}
            />
          ))}
          {users.length === 0 && (
            <Typography sx={{ color: '#94a3b8', fontSize: '0.85rem' }}>No users found.</Typography>
          )}
        </Box>

        {/* ── Right: assignment panel ── */}
        <Box>
          {!selectedUser ? (
            <Box sx={{
              bgcolor: '#f8fafc', border: '2px dashed #e2e8f0', borderRadius: 2,
              p: 5, textAlign: 'center',
            }}>
              <PersonIcon sx={{ fontSize: 40, color: '#cbd5e1', mb: 1.5 }} />
              <Typography sx={{ color: '#94a3b8', fontSize: '0.9rem' }}>
                Select a user on the left to manage their author access.
              </Typography>
            </Box>
          ) : (
            <Box>
              {/* Panel header */}
              <Box sx={{
                bgcolor: '#0f172a', borderRadius: 2, p: 2.5, mb: 2.5,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <Box>
                  <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: '#fff' }}>
                    {selectedUser.username}
                  </Typography>
                  <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)' }}>
                    {assignments.length} author{assignments.length !== 1 ? 's' : ''} assigned · click + / − to toggle access
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {['all', 'en', 'el'].map(l => (
                    <Chip
                      key={l}
                      label={l === 'all' ? 'All' : l.toUpperCase()}
                      size="small"
                      onClick={() => setLangFilter(l)}
                      sx={{
                        height: 24, fontSize: '0.74rem', fontWeight: 700,
                        cursor: 'pointer',
                        bgcolor: langFilter === l ? '#2563eb' : 'rgba(255,255,255,0.12)',
                        color: langFilter === l ? '#fff' : 'rgba(255,255,255,0.65)',
                        '&:hover': { bgcolor: langFilter === l ? '#1d4ed8' : 'rgba(255,255,255,0.2)' },
                      }}
                    />
                  ))}
                </Box>
              </Box>

              {/* Search */}
              <TextField
                fullWidth
                size="small"
                placeholder="Search authors by name (type 2+ characters)…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                sx={{ mb: 2, bgcolor: '#fff' }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ fontSize: 18, color: '#94a3b8' }} />
                    </InputAdornment>
                  ),
                }}
              />

              {loadingUser ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 2 }}>
                  <CircularProgress size={16} />
                  <Typography sx={{ color: '#64748b', fontSize: '0.85rem' }}>Loading assignments…</Typography>
                </Box>
              ) : (
                <Box>
                  {/* Assigned authors */}
                  {filteredAssigned.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: 0.8, mb: 1 }}>
                        Assigned ({filteredAssigned.length})
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
                        {filteredAssigned.map(a => (
                          <AuthorRow
                            key={`${a.lang}:${a.author_id}`}
                            author={a}
                            assigned
                            onToggle={() => toggle(a)}
                            busy={busyId === `${a.lang}:${a.author_id}`}
                          />
                        ))}
                      </Box>
                    </Box>
                  )}

                  {filteredAssigned.length === 0 && !q && (
                    <Box sx={{ py: 2, textAlign: 'center' }}>
                      <Typography sx={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                        No authors assigned yet. Search above to find and assign authors.
                      </Typography>
                    </Box>
                  )}

                  {/* Search results */}
                  {searchResults.length > 0 && (
                    <Box>
                      <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8, mb: 1 }}>
                        Search Results
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
                        {searchResults.map(a => (
                          <AuthorRow
                            key={`${a.lang}:${a.author_id}`}
                            author={a}
                            assigned={false}
                            onToggle={() => toggle(a)}
                            busy={busyId === `${a.lang}:${a.author_id}`}
                          />
                        ))}
                      </Box>
                    </Box>
                  )}

                  {q.length >= 2 && searchResults.length === 0 && (
                    <Typography sx={{ color: '#94a3b8', fontSize: '0.85rem', py: 1 }}>
                      No unassigned authors match "{q}".
                    </Typography>
                  )}
                </Box>
              )}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  )
}
