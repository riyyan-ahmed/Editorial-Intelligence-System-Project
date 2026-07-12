import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

// Authenticated instance — attaches Bearer token automatically
const authApi = axios.create({ baseURL: '/api' })
authApi.interceptors.request.use(config => {
  const s = getSession()
  if (s?.token) config.headers.Authorization = `Bearer ${s.token}`
  return config
})

export const login    = (username, password) =>
  api.post('/auth/login',    { username, password }).then(r => r.data)

export const register = (username, email, password) =>
  api.post('/auth/register', { username, email, password }).then(r => r.data)

export const saveSession  = (data) => localStorage.setItem('auth', JSON.stringify(data))
export const getSession   = ()     => { try { return JSON.parse(localStorage.getItem('auth')) } catch { return null } }
export const clearSession = ()     => localStorage.removeItem('auth')

// ── User management ───────────────────────────────────────────────────────────

export const getUsers = () =>
  authApi.get('/auth/users').then(r => r.data)

export const getAssignments = (userId) =>
  authApi.get('/auth/assignments', { params: { user_id: userId } }).then(r => r.data)

export const addAssignment = (userId, lang, authorId, authorName) =>
  authApi.post('/auth/assignments', {
    user_id: userId, lang, author_id: authorId, author_name: authorName,
  }).then(r => r.data)

export const removeAssignment = (userId, lang, authorId) =>
  authApi.delete('/auth/assignments', {
    params: { user_id: userId, lang, author_id: authorId },
  }).then(r => r.data)

export const getMyAssignments = () =>
  authApi.get('/auth/my-assignments').then(r => r.data)

// ── Evaluations ───────────────────────────────────────────────────────────────

export const submitEvaluation = (payload) =>
  authApi.post('/evaluation/submit', payload).then(r => r.data)

export const listEvaluations = () =>
  authApi.get('/evaluation/list').then(r => r.data)

export const myEvaluations = () =>
  authApi.get('/evaluation/my').then(r => r.data)

export const getEvalStats = () =>
  authApi.get('/evaluation/stats').then(r => r.data)
