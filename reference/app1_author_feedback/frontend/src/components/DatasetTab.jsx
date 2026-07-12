import React, { useEffect, useState } from 'react'
import { Box, Grid, Paper, Typography, Skeleton, Alert } from '@mui/material'
import ArticleIcon   from '@mui/icons-material/Article'
import PersonIcon    from '@mui/icons-material/Person'
import BusinessIcon  from '@mui/icons-material/Business'
import SpeedIcon     from '@mui/icons-material/Speed'
import { getOverview, getAuthors } from '../api/index'
import { TopAuthorsChart, WordDistChart, PublisherChart, YearlyChart } from './Charts'
import AuthorPanel from './AuthorPanel'

const ACCENT = '#2563eb'

function StatCard({ icon: Icon, value, label, color = ACCENT }) {
  return (
    <Paper sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 2, border: '1px solid #e2e8f0' }}>
      <Box sx={{ bgcolor: `${color}12`, color, borderRadius: 2, p: 1.2, display: 'flex', alignItems: 'center' }}>
        <Icon sx={{ fontSize: 26 }} />
      </Box>
      <Box>
        <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, lineHeight: 1.1, color: '#0f172a' }}>
          {value}
        </Typography>
        <Typography variant="caption" sx={{ color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600, fontSize: 10 }}>
          {label}
        </Typography>
      </Box>
    </Paper>
  )
}

function SectionTitle({ children }) {
  return (
    <Typography sx={{
      fontSize: '0.75rem', fontWeight: 700, color: '#64748b',
      textTransform: 'uppercase', letterSpacing: 1.2,
      pb: 1.5, mb: 2.5, borderBottom: '1px solid #e2e8f0',
    }}>
      {children}
    </Typography>
  )
}

function ChartCard({ title, loading, height = 140, children }) {
  return (
    <Paper sx={{ p: 3, border: '1px solid #e2e8f0', height: '100%' }}>
      <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 0.8, color: '#94a3b8', fontWeight: 700 }}>
        {title}
      </Typography>
      {loading
        ? <Skeleton variant="rectangular" height={height} sx={{ mt: 1.5, borderRadius: 1 }} />
        : children}
    </Paper>
  )
}

export default function DatasetTab({ lang, meta }) {
  const [overview, setOverview] = useState(null)
  const [authors,  setAuthors]  = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

  useEffect(() => {
    setLoading(true); setError(null)
    Promise.all([getOverview(lang), getAuthors(lang)])
      .then(([ov, au]) => { setOverview(ov); setAuthors(au) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [lang])

  if (error) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">
          Backend connection failed: {error}. Make sure the SSH tunnel and FastAPI server are running.
        </Alert>
      </Box>
    )
  }

  const s   = overview?.stats || {}
  const fmt = (n) => n >= 1000 ? `${(n / 1000).toFixed(0)}k` : String(n ?? '—')

  return (
    <Box sx={{ px: { xs: 2, md: 5 }, py: 4, maxWidth: 1280, mx: 'auto' }}>

      {/* Dataset description */}
      <Box sx={{ mb: 3.5, p: 2.5, bgcolor: '#f0f7ff', border: '1px solid #bfdbfe', borderRadius: 2 }}>
        <Typography sx={{ fontSize: '0.88rem', color: '#1d4ed8' }}>
          <strong>{meta.label}</strong> · {meta.pubs} · bge-m3 1024-dim embeddings · Stream B publisher style corpus
        </Typography>
      </Box>

      {/* Stats row */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {[
          { icon: ArticleIcon,  value: loading ? '—' : fmt(s.total_articles),  label: 'Total Articles',  color: '#2563eb' },
          { icon: PersonIcon,   value: loading ? '—' : fmt(s.total_authors),   label: 'Unique Authors',  color: '#7c3aed' },
          { icon: BusinessIcon, value: loading ? '—' : s.total_publishers ?? '—', label: 'Publishers',   color: '#0891b2' },
          { icon: SpeedIcon,    value: loading ? '—' : fmt(s.avg_word_count),  label: 'Avg Word Count',  color: '#059669' },
        ].map(c => (
          <Grid item xs={6} md={3} key={c.label}>
            {loading ? <Skeleton variant="rounded" height={82} /> : <StatCard {...c} />}
          </Grid>
        ))}
      </Grid>

      {/* Charts */}
      <Box sx={{ mb: 4 }}>
        <SectionTitle>Corpus Overview</SectionTitle>
        <Grid container spacing={2.5}>
          <Grid item xs={12} md={7}>
            <ChartCard title="Top 10 Authors by Article Count" loading={loading} height={260}>
              <TopAuthorsChart data={overview?.top_authors} />
            </ChartCard>
          </Grid>
          <Grid item xs={12} md={5}>
            <Grid container spacing={2.5} direction="column">
              <Grid item>
                <ChartCard title="Publisher Breakdown" loading={loading} height={110}>
                  <PublisherChart data={overview?.publisher_breakdown} />
                </ChartCard>
              </Grid>
              <Grid item>
                <ChartCard title="Word Count Distribution" loading={loading} height={110}>
                  <WordDistChart data={overview?.word_distribution} />
                </ChartCard>
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </Box>

      {/* Timeline */}
      {!loading && overview?.yearly_articles?.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <SectionTitle>Publication Timeline</SectionTitle>
          <Paper sx={{ p: 3, border: '1px solid #e2e8f0' }}>
            <YearlyChart data={overview.yearly_articles} />
          </Paper>
        </Box>
      )}

      {/* Author deep dive */}
      <Box sx={{ mb: 4 }}>
        <SectionTitle>Author Deep Dive</SectionTitle>
        {loading
          ? <Skeleton variant="rectangular" height={160} sx={{ borderRadius: 2 }} />
          : <AuthorPanel lang={lang} authors={authors || []} />}
      </Box>

      {/* Key insights */}
      {!loading && <KeyInsights lang={lang} stats={s} topAuthors={overview?.top_authors || []} publishers={overview?.publisher_breakdown || []} />}
    </Box>
  )
}

function KeyInsights({ lang, stats, topAuthors, publishers }) {
  const top    = topAuthors[0]
  const topPub = publishers[0]

  const bullets = [
    `${(stats.total_articles || 0).toLocaleString()} articles · ${stats.total_authors?.toLocaleString()} authors · ${stats.total_publishers} publishers`,
    top ? `Most prolific: ${top.author_name} — ${(top.article_count || 0).toLocaleString()} articles, avg ${top.avg_word_count} words` : null,
    `Average article length: ${stats.avg_word_count} words (median: ${stats.median_word_count})`,
    topPub ? `Largest source: ${topPub.publisher_id} — ${((topPub.article_count / stats.total_articles) * 100).toFixed(0)}% of corpus` : null,
    lang === 'el'
      ? 'Greek text: HTML-stripped, accent-normalised, filtered for ≥ 50 words with confirmed Greek characters'
      : 'Guardian articles: deduplicated, bylines resolved to canonical tag names, filtered to ≥ 200 words',
    'All articles stored with 1024-dim bge-m3 embeddings — ready for cosine similarity retrieval in Stream B (style RAG)',
  ].filter(Boolean)

  return (
    <Box sx={{ bgcolor: '#0f172a', color: '#fff', borderRadius: 3, p: 4 }}>
      <Typography sx={{ fontWeight: 700, fontSize: '1rem', mb: 2, color: '#f8fafc' }}>
        Key Insights — {lang === 'el' ? 'Greek' : 'English'} Corpus
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {bullets.map((b, i) => (
          <Box key={i} sx={{ display: 'flex', gap: 1.5, fontSize: '0.88rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.6 }}>
            <span style={{ color: '#3b82f6', fontWeight: 700, flexShrink: 0 }}>→</span> {b}
          </Box>
        ))}
      </Box>
    </Box>
  )
}
