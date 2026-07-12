import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

export const getOverview     = (lang) => api.get(`/exploration/${lang}/overview`).then(r => r.data)
export const getAuthors      = (lang) => api.get(`/exploration/${lang}/authors`).then(r => r.data)
export const getAuthorDetail = (lang, authorId) =>
  api.get(`/exploration/${lang}/author`, { params: { author_id: authorId } }).then(r => r.data)

export const getAuthorTopics = (lang, authorId) =>
  api.get(`/exploration/${lang}/author-topics`, { params: { author_id: authorId } }).then(r => r.data)

export const generateContent = (payload) =>
  api.post('/generation/generate', payload, { timeout: 120_000 }).then(r => r.data)
