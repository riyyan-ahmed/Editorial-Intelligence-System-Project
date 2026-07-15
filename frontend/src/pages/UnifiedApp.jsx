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
import LogoutIcon from '@mui/icons-material/Logout'
import RefreshIcon from '@mui/icons-material/Refresh'
import ArticleIcon from '@mui/icons-material/Article'
import SourceIcon from '@mui/icons-material/Source'
import TopicIcon from '@mui/icons-material/Topic'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import { clearSession, getSession } from '../api/auth'
import { getClusters, getClusterStats } from '../api/clusters'

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

function ClusterCard({ cluster }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderColor: cluster.pinned ? '#bfdbfe' : '#e2e8f0',
        bgcolor: cluster.pinned ? '#f8fbff' : '#fff',
        borderRadius: 2,
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
    </Paper>
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
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' },
            gap: 2,
          }}>
            {clusters.map(cluster => (
              <ClusterCard key={cluster.id} cluster={cluster} />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  )
}
