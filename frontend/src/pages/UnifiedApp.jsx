import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import LogoutIcon from '@mui/icons-material/Logout'
import RefreshIcon from '@mui/icons-material/Refresh'
import ArticleIcon from '@mui/icons-material/Article'
import SourceIcon from '@mui/icons-material/Source'
import TopicIcon from '@mui/icons-material/Topic'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import { clearSession, getSession } from '../api/auth'
import {
  getClusters,
  getClusterArticles,
  getClusterDetail,
  getClusterRagContext,
  getClusterSources,
  getClusterStats,
} from '../api/clusters'

const WORKFLOW = [
  'Clusters',
  'Detail',
  'Sources',
  'Style',
  'Generate',
  'Review',
  'Feedback',
  'History',
]

function statValue(stats, lang, key) {
  const row = stats.find(item => item.language === lang)
  return row?.[key] ?? 0
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString()
}

function ClusterCard({ cluster, selected, onSelect }) {
  return (
    <Paper
      variant="outlined"
      data-testid={`cluster-card-${cluster.id}`}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(cluster)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect(cluster)
        }
      }}
      sx={{
        p: 2,
        borderColor: selected ? '#2563eb' : cluster.pinned ? '#bfdbfe' : '#e2e8f0',
        bgcolor: cluster.pinned ? '#f8fbff' : '#fff',
        borderRadius: 2,
        cursor: 'pointer',
        transition: 'border-color 0.15s, box-shadow 0.15s, transform 0.15s',
        boxShadow: selected ? '0 0 0 1px rgba(37,99,235,0.18)' : 'none',
        '&:hover': {
          borderColor: '#2563eb',
          boxShadow: '0 8px 24px rgba(15,23,42,0.08)',
          transform: 'translateY(-1px)',
        },
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <Chip
          size="small"
          label={cluster.language?.toUpperCase()}
          sx={{ height: 22, fontSize: 11, bgcolor: '#e0f2fe', color: '#0369a1', fontWeight: 700 }}
        />
        {cluster.pinned && (
          <Chip size="small" label="Pinned" sx={{ height: 22, fontSize: 11, bgcolor: '#eff6ff', color: '#2563eb' }} />
        )}
        <Chip
          size="small"
          label={cluster.main_category || 'general'}
          sx={{ height: 22, fontSize: 11, bgcolor: '#f1f5f9', color: '#475569' }}
        />
      </Stack>
      <Typography sx={{ fontWeight: 700, color: '#0f172a', lineHeight: 1.35, mb: 0.75 }}>
        {cluster.title || `Cluster ${cluster.id}`}
      </Typography>
      <Typography sx={{ color: '#64748b', fontSize: '0.86rem', lineHeight: 1.55, mb: 1.5 }}>
        {cluster.summary || 'No summary available yet.'}
      </Typography>
      <Stack direction="row" spacing={2} sx={{ color: '#64748b', fontSize: '0.78rem' }}>
        <Box>{formatNumber(cluster.articles_count)} articles</Box>
        <Box>{formatNumber(cluster.sources_count)} sources</Box>
        <Box>Score {Number(cluster.final_score || 0).toFixed(2)}</Box>
      </Stack>
      <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          data-testid={`view-details-${cluster.id}`}
          size="small"
          variant={selected ? 'contained' : 'outlined'}
          onClick={(event) => {
            event.stopPropagation()
            onSelect(cluster)
          }}
        >
          View Details
        </Button>
      </Box>
    </Paper>
  )
}

function Metric({ label, value }) {
  return (
    <Box>
      <Typography sx={{ color: '#94a3b8', fontSize: '0.74rem' }}>{label}</Typography>
      <Typography sx={{ color: '#0f172a', fontWeight: 800, fontSize: '0.95rem' }}>{value}</Typography>
    </Box>
  )
}

function EmptyDetail() {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, borderColor: '#e2e8f0', p: 4, bgcolor: '#fff' }}>
      <Stack spacing={1.5} alignItems="center" sx={{ textAlign: 'center', py: 5 }}>
        <TopicIcon sx={{ fontSize: 42, color: '#cbd5e1' }} />
        <Typography sx={{ fontWeight: 800, color: '#0f172a' }}>Select a cluster</Typography>
        <Typography sx={{ color: '#64748b', fontSize: '0.9rem', maxWidth: 340 }}>
          Open a cluster to inspect its metadata, source distribution, member articles, and RAG-ready source context.
        </Typography>
      </Stack>
    </Paper>
  )
}

function DetailSection({ title, children, action }) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, borderColor: '#e2e8f0', bgcolor: '#fff', overflow: 'hidden' }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ px: 2, py: 1.5, borderBottom: '1px solid #e2e8f0', bgcolor: '#fbfdff' }}
      >
        <Typography sx={{ fontWeight: 800, color: '#0f172a', fontSize: '0.92rem' }}>{title}</Typography>
        {action}
      </Stack>
      <Box sx={{ p: 2 }}>{children}</Box>
    </Paper>
  )
}

function ClusterDetailPanel({ selectedCluster, detailState, onContinue }) {
  if (!selectedCluster) return <EmptyDetail />

  const { loading, error, detail, sources, articles, ragContext } = detailState
  const ragArticles = ragContext?.articles || []

  return (
    <Stack spacing={2}>
      <Paper data-testid="cluster-detail-panel" variant="outlined" sx={{ borderRadius: 2, borderColor: '#e2e8f0', bgcolor: '#fff', overflow: 'hidden' }}>
        <Box sx={{ p: 2.25 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <Chip size="small" label={selectedCluster.language?.toUpperCase()} sx={{ height: 22, bgcolor: '#e0f2fe', color: '#0369a1', fontWeight: 700 }} />
            <Chip size="small" label={selectedCluster.main_category || 'general'} sx={{ height: 22, bgcolor: '#f1f5f9', color: '#475569' }} />
            <Chip size="small" label={`Cluster ${selectedCluster.id}`} sx={{ height: 22, bgcolor: '#f8fafc', color: '#64748b' }} />
          </Stack>
          <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', lineHeight: 1.35, mb: 1 }}>
            {detail?.title || selectedCluster.title || `Cluster ${selectedCluster.id}`}
          </Typography>
          <Typography sx={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.65 }}>
            {detail?.summary || selectedCluster.summary || 'No cluster summary available.'}
          </Typography>
        </Box>

        <Divider />

        <Box sx={{ p: 2.25 }}>
          {loading ? (
            <Stack direction="row" spacing={1.5} alignItems="center">
              <CircularProgress size={18} />
              <Typography sx={{ color: '#64748b', fontSize: '0.9rem' }}>Loading cluster detail...</Typography>
            </Stack>
          ) : error ? (
            <Alert severity="error">{error}</Alert>
          ) : (
            <Stack direction="row" spacing={3} useFlexGap flexWrap="wrap">
              <Metric label="Articles" value={formatNumber(detail?.articles_count || selectedCluster.articles_count)} />
              <Metric label="Sources" value={formatNumber(detail?.sources_count || selectedCluster.sources_count)} />
              <Metric label="Final Score" value={Number(detail?.score_final || detail?.final_score || selectedCluster.final_score || 0).toFixed(2)} />
              <Metric label="First Seen" value={detail?.first_seen_at || selectedCluster.first_seen || '-'} />
              <Metric label="Last Seen" value={detail?.last_seen_at || selectedCluster.last_seen || '-'} />
            </Stack>
          )}
        </Box>
      </Paper>

      {!loading && !error && (
        <>
          <DetailSection title="Best Sources / RAG Context" action={<Chip size="small" label={ragContext?.selection_method || 'MMR'} />}>
            <Box data-testid="rag-source-list">
            <Stack spacing={1.5}>
              {ragArticles.map((article, index) => (
                <Box key={article.article_id || `${article.title}-${index}`} sx={{ borderBottom: index < ragArticles.length - 1 ? '1px solid #eef2f7' : 'none', pb: 1.5 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                    <Chip size="small" label={`#${article.mmr_rank || index + 1}`} sx={{ height: 20, bgcolor: '#eff6ff', color: '#2563eb', fontWeight: 800 }} />
                    <Typography sx={{ color: '#64748b', fontSize: '0.76rem' }}>
                      {article.source_domain || 'unknown source'} · {article.published_at || '-'}
                    </Typography>
                  </Stack>
                  <Typography sx={{ color: '#0f172a', fontWeight: 700, fontSize: '0.9rem', lineHeight: 1.35, mb: 0.5 }}>
                    {article.title || 'Untitled article'}
                  </Typography>
                  <Typography sx={{ color: '#64748b', fontSize: '0.82rem', lineHeight: 1.55 }}>
                    {article.preview || 'No preview available.'}
                  </Typography>
                </Box>
              ))}
              {ragArticles.length === 0 && (
                <Typography sx={{ color: '#94a3b8', fontSize: '0.88rem' }}>No RAG source articles returned for this cluster.</Typography>
              )}
            </Stack>
            </Box>
          </DetailSection>

          <DetailSection title="Source Domains">
            <Stack spacing={1}>
              {sources.map((source, index) => (
                <Stack key={`${source.source_domain}-${index}`} direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 0.5 }}>
                  <Box>
                    <Typography sx={{ color: '#0f172a', fontWeight: 700, fontSize: '0.86rem' }}>
                      {source.source_domain || source.source_name || 'Unknown source'}
                    </Typography>
                    <Typography sx={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                      Freshness {source.freshness || '-'}
                    </Typography>
                  </Box>
                  <Chip size="small" label={`${source.article_count || 0} articles`} sx={{ bgcolor: '#f8fafc', color: '#475569' }} />
                </Stack>
              ))}
              {sources.length === 0 && (
                <Typography sx={{ color: '#94a3b8', fontSize: '0.88rem' }}>No source distribution returned.</Typography>
              )}
            </Stack>
          </DetailSection>

          <DetailSection title="Cluster Articles">
            <Stack spacing={1.5}>
              {articles.slice(0, 8).map((article, index) => (
                <Box key={article.article_id || `${article.title}-${index}`} sx={{ borderBottom: index < Math.min(articles.length, 8) - 1 ? '1px solid #eef2f7' : 'none', pb: 1.25 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                    {article.is_primary && <Chip size="small" label="Primary" sx={{ height: 20, bgcolor: '#ecfdf5', color: '#047857' }} />}
                    <Typography sx={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                      {article.source_domain || 'unknown'} · {article.pub_date || '-'}
                    </Typography>
                  </Stack>
                  <Typography sx={{ color: '#0f172a', fontWeight: 700, fontSize: '0.88rem', lineHeight: 1.35 }}>
                    {article.title || 'Untitled article'}
                  </Typography>
                </Box>
              ))}
              {articles.length === 0 && (
                <Typography sx={{ color: '#94a3b8', fontSize: '0.88rem' }}>No cluster articles returned.</Typography>
              )}
            </Stack>
          </DetailSection>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="contained" endIcon={<OpenInNewIcon />} onClick={onContinue}>
              Continue to Style Selection
            </Button>
          </Box>
        </>
      )}
    </Stack>
  )
}

export default function UnifiedApp() {
  const nav = useNavigate()
  const session = getSession()
  const [lang, setLang] = useState('el')
  const [stats, setStats] = useState([])
  const [clusters, setClusters] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedCluster, setSelectedCluster] = useState(null)
  const [detailState, setDetailState] = useState({
    loading: false,
    error: '',
    detail: null,
    sources: [],
    articles: [],
    ragContext: null,
  })

  const currentStats = useMemo(() => ({
    articles: statValue(stats, lang, 'articles'),
    clusters: statValue(stats, lang, 'clusters'),
    multiArticleClusters: statValue(stats, lang, 'multi_article_clusters'),
  }), [stats, lang])

  const logout = () => {
    clearSession()
    nav('/login', { replace: true })
  }

  const loadData = async (selectedLang = lang) => {
    setLoading(true)
    setError('')
    try {
      const [statsData, clustersData] = await Promise.all([
        getClusterStats(),
        getClusters({ lang: selectedLang, sort: 'score', min_articles: 2, limit: 12, offset: 0 }),
      ])
      setStats(statsData || [])
      setClusters(clustersData?.items || [])
      setSelectedCluster(null)
      setDetailState({ loading: false, error: '', detail: null, sources: [], articles: [], ragContext: null })
    } catch (err) {
      if (err.response?.status === 401) {
        nav('/login', { replace: true })
        return
      }
      setError(err.response?.data?.detail || err.message || 'Could not load unified workspace.')
    } finally {
      setLoading(false)
    }
  }

  const loadClusterDetail = async (cluster) => {
    setSelectedCluster(cluster)
    setDetailState({ loading: true, error: '', detail: null, sources: [], articles: [], ragContext: null })
    try {
      const [detail, sources, articles, ragContext] = await Promise.all([
        getClusterDetail(cluster.id),
        getClusterSources(cluster.id, 25),
        getClusterArticles(cluster.id, 25),
        getClusterRagContext(cluster.id, 5),
      ])
      setDetailState({
        loading: false,
        error: '',
        detail,
        sources: sources || [],
        articles: articles || [],
        ragContext,
      })
    } catch (err) {
      if (err.response?.status === 401) {
        nav('/login', { replace: true })
        return
      }
      setDetailState({
        loading: false,
        error: err.response?.data?.detail || err.message || 'Could not load cluster detail.',
        detail: null,
        sources: [],
        articles: [],
        ragContext: null,
      })
    }
  }

  useEffect(() => {
    loadData(lang)
  }, [])

  const handleLang = (_event, value) => {
    if (!value || value === lang) return
    setLang(value)
    loadData(value)
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f8fafc' }}>
      <Box
        sx={{
          bgcolor: '#fff',
          borderBottom: '1px solid #e2e8f0',
          px: { xs: 2, md: 4 },
          py: 1.5,
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }}>
          <Box>
            <Typography sx={{ fontWeight: 800, color: '#0f172a', fontSize: '1rem' }}>
              MediaSync 2.1
            </Typography>
            <Typography sx={{ color: '#64748b', fontSize: '0.82rem' }}>
              Unified editorial workflow
            </Typography>
          </Box>
          <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
            <Typography sx={{ color: '#64748b', fontSize: '0.84rem' }}>
              {session?.username || 'User'} · {session?.role || 'editor'}
            </Typography>
            <Button size="small" startIcon={<LogoutIcon />} onClick={logout} sx={{ color: '#64748b' }}>
              Logout
            </Button>
          </Stack>
        </Stack>
      </Box>

      <Box sx={{ px: { xs: 2, md: 4 }, py: 3 }}>
        <Paper variant="outlined" sx={{ borderRadius: 2, borderColor: '#e2e8f0', overflow: 'hidden', mb: 3 }}>
          <Box sx={{ p: 2.5, bgcolor: '#fff' }}>
            <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'stretch', lg: 'center' }}>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', mb: 0.5 }}>
                  Cluster Dashboard
                </Typography>
                <Typography sx={{ color: '#64748b', fontSize: '0.9rem' }}>
                  First unified screen after login. Data is loaded from the authenticated cluster backend.
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <ToggleButtonGroup exclusive size="small" value={lang} onChange={handleLang}>
                  <ToggleButton value="el">Greek</ToggleButton>
                  <ToggleButton value="en">English</ToggleButton>
                </ToggleButtonGroup>
                <Button size="small" startIcon={<RefreshIcon />} onClick={() => loadData(lang)} disabled={loading}>
                  Refresh
                </Button>
              </Stack>
            </Stack>
          </Box>

          <Divider />

          <Box sx={{ p: 2.5, bgcolor: '#fbfdff' }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
              <Paper variant="outlined" sx={{ p: 2, flex: 1, borderColor: '#e2e8f0', borderRadius: 2 }}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <ArticleIcon sx={{ color: '#2563eb' }} />
                  <Box>
                    <Typography sx={{ color: '#64748b', fontSize: '0.78rem' }}>Articles</Typography>
                    <Typography sx={{ color: '#0f172a', fontWeight: 800 }}>{formatNumber(currentStats.articles)}</Typography>
                  </Box>
                </Stack>
              </Paper>
              <Paper variant="outlined" sx={{ p: 2, flex: 1, borderColor: '#e2e8f0', borderRadius: 2 }}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <TopicIcon sx={{ color: '#0891b2' }} />
                  <Box>
                    <Typography sx={{ color: '#64748b', fontSize: '0.78rem' }}>Active Clusters</Typography>
                    <Typography sx={{ color: '#0f172a', fontWeight: 800 }}>{formatNumber(currentStats.clusters)}</Typography>
                  </Box>
                </Stack>
              </Paper>
              <Paper variant="outlined" sx={{ p: 2, flex: 1, borderColor: '#e2e8f0', borderRadius: 2 }}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <SourceIcon sx={{ color: '#7c3aed' }} />
                  <Box>
                    <Typography sx={{ color: '#64748b', fontSize: '0.78rem' }}>Multi-Article Clusters</Typography>
                    <Typography sx={{ color: '#0f172a', fontWeight: 800 }}>{formatNumber(currentStats.multiArticleClusters)}</Typography>
                  </Box>
                </Stack>
              </Paper>
            </Stack>
          </Box>
        </Paper>

        <Paper variant="outlined" sx={{ borderRadius: 2, borderColor: '#e2e8f0', mb: 3 }}>
          <Box sx={{ p: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
              {WORKFLOW.map((step, index) => (
                <Chip
                  key={step}
                  icon={index === 4 ? <AutoAwesomeIcon /> : undefined}
                  label={step}
                  size="small"
                  sx={{
                    bgcolor: index === 0 ? '#eff6ff' : '#f8fafc',
                    color: index === 0 ? '#2563eb' : '#64748b',
                    fontWeight: index === 0 ? 700 : 500,
                  }}
                />
              ))}
            </Stack>
          </Box>
        </Paper>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {loading ? (
          <Box sx={{ minHeight: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 0.95fr) minmax(420px, 1.05fr)' }, gap: 2.5, alignItems: 'start' }}>
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', lg: '1fr' },
              gap: 2,
            }}>
              {clusters.map(cluster => (
                <ClusterCard
                  key={cluster.id}
                  cluster={cluster}
                  selected={selectedCluster?.id === cluster.id}
                  onSelect={loadClusterDetail}
                />
              ))}
            </Box>

            <ClusterDetailPanel
              selectedCluster={selectedCluster}
              detailState={detailState}
              onContinue={() => {}}
            />
          </Box>
        )}
      </Box>
    </Box>
  )
}
