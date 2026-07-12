import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Button, Typography, Container, Grid, Chip, Skeleton,
} from '@mui/material'
import BarChartIcon       from '@mui/icons-material/BarChart'
import AutoAwesomeIcon    from '@mui/icons-material/AutoAwesome'
import AssignmentIcon     from '@mui/icons-material/Assignment'
import MonitorHeartIcon   from '@mui/icons-material/MonitorHeart'
import ArrowForwardIcon   from '@mui/icons-material/ArrowForward'
import axios from 'axios'

const FALLBACK_STATS = {
  total_articles:   232000,
  total_authors:    1290,
  total_publishers: 4,
  total_languages:  2,
  vector_dims:      1024,
}

function fmtStat(n) {
  if (!n) return '—'
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M+`
  if (n >= 10000)   return `${Math.round(n / 1000)}k+`
  return n.toLocaleString()
}

const MODULES = [
  {
    icon:    <BarChartIcon sx={{ fontSize: 32 }} />,
    title:   'Dataset Exploration',
    desc:    'Explore 232k+ embedded articles across Greek and English corpora. Analyse per-author writing profiles, vocabulary signatures, word-count distributions, and publisher breakdowns.',
    badge:   'Live',
    live:    true,
    color:   '#2563eb',
  },
  {
    icon:    <AutoAwesomeIcon sx={{ fontSize: 32 }} />,
    title:   'Content Generation',
    desc:    'Generate publisher-style drafts from raw facts using Qwen 2.5-7B + Stream A/B RAG retrieval. Web-grounded, style-matched, and ready for editorial review.',
    badge:   'Live',
    live:    true,
    color:   '#7c3aed',
  },
  {
    icon:    <AssignmentIcon sx={{ fontSize: 32 }} />,
    title:   'Task Assignment',
    desc:    'Assign authors to editors so each team member sees only their relevant voices. Editors learn author styles and generate content — with a personal evaluation flow.',
    badge:   'Live',
    live:    true,
    color:   '#0891b2',
  },
  {
    icon:    <MonitorHeartIcon sx={{ fontSize: 32 }} />,
    title:   'System Monitor',
    desc:    'Track pipeline health, model serving metrics, pgvector index status, and embedding throughput across both EC2 and MareNostrum deployments.',
    badge:   'Coming Soon',
    live:    false,
    color:   '#059669',
  },
]

export default function Landing() {
  const nav = useNavigate()
  const [stats,        setStats]        = useState(null)
  const [statsLoading, setStatsLoading] = useState(true)

  useEffect(() => {
    axios.get('/api/exploration/corpus-stats')
      .then(r => setStats(r.data))
      .catch(() => setStats(FALLBACK_STATS))
      .finally(() => setStatsLoading(false))
  }, [])

  const s = stats || FALLBACK_STATS

  const STATS = [
    { value: fmtStat(s.total_articles),   label: 'Embedded Articles' },
    { value: String(s.total_languages),   label: 'Languages' },
    { value: fmtStat(s.total_authors),    label: 'Author Voices' },
    { value: String(s.vector_dims),       label: 'Vector Dimensions' },
  ]

  return (
    <Box sx={{ bgcolor: '#f8fafc', minHeight: '100vh' }}>

      {/* ── Navbar ────────────────────────────────────────────────────────── */}
      <Box sx={{
        position: 'sticky', top: 0, zIndex: 100,
        bgcolor: '#fff', borderBottom: '1px solid #e2e8f0',
        px: { xs: 3, md: 6 }, py: 1.5,
        display: 'flex', alignItems: 'center',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#2563eb' }} />
          <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a', letterSpacing: -0.3 }}>
            Editorial Intelligence
          </Typography>
        </Box>
        <Box sx={{ ml: 'auto' }}>
          <Button variant="contained" size="small" onClick={() => nav('/login')}
            sx={{ px: 2.5 }}>
            Log In
          </Button>
        </Box>
      </Box>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <Box sx={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
        color: '#fff',
        pt: { xs: 8, md: 12 },
        pb: { xs: 8, md: 14 },
        px: { xs: 3, md: 6 },
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* subtle background blobs */}
        <Box sx={{ position: 'absolute', top: -100, left: -100, width: 400, height: 400, borderRadius: '50%', background: 'rgba(37,99,235,0.08)', pointerEvents: 'none' }} />
        <Box sx={{ position: 'absolute', bottom: -80, right: -80, width: 350, height: 350, borderRadius: '50%', background: 'rgba(124,58,237,0.08)', pointerEvents: 'none' }} />

        <Box sx={{ position: 'relative', maxWidth: 800, mx: 'auto' }}>
          <Chip
            label="Qwen 2.5-7B · bge-m3 · LoRA · pgvector"
            size="small"
            sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)', mb: 3, fontSize: 12, fontWeight: 500 }}
          />
          <Typography variant="h2" sx={{ fontWeight: 800, mb: 2.5, fontSize: { xs: '2rem', md: '3rem' }, lineHeight: 1.15, letterSpacing: -1 }}>
            AI-Powered Editorial<br />Intelligence for Publishers
          </Typography>
          <Typography sx={{ fontSize: '1.1rem', opacity: 0.75, mb: 5, lineHeight: 1.7, maxWidth: 620, mx: 'auto' }}>
            Learn any publisher's editorial voice directly from their CMS history.
            Generate, evaluate, and refine multilingual content — from day one.
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              size="large"
              endIcon={<ArrowForwardIcon />}
              onClick={() => nav('/login')}
              sx={{ bgcolor: '#2563eb', px: 4, py: 1.5, fontSize: '1rem', '&:hover': { bgcolor: '#1d4ed8' } }}
            >
              Log In to Dashboard
            </Button>
          </Box>
        </Box>
      </Box>

      {/* ── Stats bar ────────────────────────────────────────────────────── */}
      <Box sx={{ bgcolor: '#fff', borderBottom: '1px solid #e2e8f0', py: 3, px: { xs: 3, md: 6 } }}>
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: 3 }}>
            {STATS.map(st => (
              <Box key={st.label} sx={{ textAlign: 'center', minWidth: 100 }}>
                {statsLoading
                  ? <Skeleton width={70} height={36} sx={{ mx: 'auto' }} />
                  : <Typography sx={{ fontSize: '1.8rem', fontWeight: 800, color: '#2563eb', lineHeight: 1 }}>{st.value}</Typography>
                }
                <Typography variant="caption" sx={{ color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 600, fontSize: 11 }}>
                  {st.label}
                </Typography>
              </Box>
            ))}
          </Box>
        </Container>
      </Box>

      {/* ── Modules ──────────────────────────────────────────────────────── */}
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 }, px: { xs: 3, md: 4 } }}>
        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <Typography variant="caption" sx={{ color: '#2563eb', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, display: 'block', mb: 1 }}>
            System Modules
          </Typography>
          <Typography variant="h3" sx={{ fontWeight: 700, color: '#0f172a', mb: 1.5 }}>
            Everything in one platform
          </Typography>
          <Typography sx={{ color: '#64748b', maxWidth: 520, mx: 'auto' }}>
            A unified multilingual editorial intelligence system built for digital publishers at any scale.
          </Typography>
        </Box>

        <Grid container spacing={3}>
          {MODULES.map(m => (
            <Grid item xs={12} sm={6} key={m.title}>
              <Box
                sx={{
                  bgcolor: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 3,
                  p: 3.5,
                  height: '100%',
                  transition: 'box-shadow 0.2s, border-color 0.2s',
                  '&:hover': { boxShadow: '0 8px 24px rgba(0,0,0,0.09)', borderColor: '#cbd5e1' },
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <Box sx={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                  bgcolor: m.live ? m.color : '#e2e8f0',
                }} />
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                  <Box sx={{ color: m.live ? m.color : '#94a3b8', mt: 0.3, flexShrink: 0 }}>
                    {m.icon}
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: '1.05rem', color: '#0f172a' }}>
                        {m.title}
                      </Typography>
                      <Chip
                        label={m.badge}
                        size="small"
                        sx={{
                          bgcolor: m.live ? '#dcfce7' : '#f1f5f9',
                          color:   m.live ? '#16a34a' : '#94a3b8',
                          fontWeight: 700, fontSize: 10,
                          height: 20,
                        }}
                      />
                    </Box>
                    <Typography sx={{ color: '#64748b', fontSize: '0.88rem', lineHeight: 1.65 }}>
                      {m.desc}
                    </Typography>
                    {m.live && (
                      <Button
                        size="small"
                        endIcon={<ArrowForwardIcon />}
                        onClick={() => nav('/login')}
                        sx={{ mt: 2, color: m.color, fontWeight: 600, p: 0, fontSize: '0.82rem', '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' } }}
                      >
                        Explore now
                      </Button>
                    )}
                  </Box>
                </Box>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <Box sx={{ bgcolor: '#0f172a', color: 'rgba(255,255,255,0.5)', py: 4, px: 6, textAlign: 'center' }}>
        <Typography variant="body2">
          Editorial Intelligence System · Brainfood × Mubi · Phase 1
        </Typography>
      </Box>
    </Box>
  )
}
