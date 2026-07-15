import { authApi } from './auth'

export const getClusterStats = () =>
  authApi.get('/clusters/stats').then(r => r.data)

export const getClusters = (params = {}) =>
  authApi.get('/clusters', { params }).then(r => r.data)

export const getClusterDetail = (clusterId) =>
  authApi.get(`/clusters/${clusterId}`).then(r => r.data)

export const getClusterSources = (clusterId, limit = 25) =>
  authApi.get(`/clusters/${clusterId}/sources`, { params: { limit } }).then(r => r.data)

export const getClusterArticles = (clusterId, limit = 25) =>
  authApi.get(`/clusters/${clusterId}/articles`, { params: { limit } }).then(r => r.data)

export const getClusterRagContext = (clusterId, limit = 5) =>
  authApi.get(`/clusters/${clusterId}/rag-context`, { params: { limit } }).then(r => r.data)

export const generateClusterDraft = (payload) =>
  authApi.post('/generation/cluster-generate', payload, { timeout: 180_000 }).then(r => r.data)
