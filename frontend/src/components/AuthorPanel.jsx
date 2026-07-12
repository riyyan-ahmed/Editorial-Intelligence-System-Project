import React, { useState } from 'react'
import {
  Box, Typography, Autocomplete, TextField, Grid, Chip,
  CircularProgress, Divider, Alert, LinearProgress,
  Dialog, DialogTitle, DialogContent, IconButton,
} from '@mui/material'
import CloseIcon       from '@mui/icons-material/Close'
import ArticleIcon     from '@mui/icons-material/Article'
import CalendarIcon    from '@mui/icons-material/CalendarMonth'
import TextFieldsIcon  from '@mui/icons-material/TextFields'
import TrendingUpIcon  from '@mui/icons-material/TrendingUp'
import OpenInFullIcon  from '@mui/icons-material/OpenInFull'
import { getAuthorDetail } from '../api/index'

const ACCENT = '#2563eb'

// ── Small helpers ─────────────────────────────────────────────────────────────

function MiniStat({ icon: Icon, label, value }) {
  return (
    <Box sx={{ bgcolor: '#f0f7ff', border: '1px solid #bfdbfe', borderRadius: 2, p: 1.5, display: 'flex', alignItems: 'center', gap: 1.2 }}>
      <Icon sx={{ fontSize: 20, color: ACCENT }} />
      <Box>
        <Typography sx={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', lineHeight: 1 }}>{value}</Typography>
        <Typography variant="caption" sx={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</Typography>
      </Box>
    </Box>
  )
}

function ArticleCard({ article, onOpen }) {
  return (
    <Box
      onClick={() => onOpen(article)}
      sx={{
        bgcolor: '#fff', border: '1px solid #e2e8f0', borderRadius: 2, p: 2,
        borderLeft: `3px solid ${ACCENT}44`, cursor: 'pointer',
        transition: 'box-shadow 0.15s, border-color 0.15s',
        '&:hover': { boxShadow: '0 4px 16px rgba(37,99,235,0.10)', borderColor: ACCENT },
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5, gap: 1 }}>
        <Typography sx={{ fontWeight: 600, fontSize: '0.88rem', color: '#0f172a', lineHeight: 1.4, flex: 1 }}>
          {article.title || '(no title)'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.8, flexShrink: 0, alignItems: 'center' }}>
          <Chip label={`${article.word_count}w`} size="small"
            sx={{ fontSize: 10, bgcolor: '#f0f7ff', color: ACCENT, height: 20 }} />
          <OpenInFullIcon sx={{ fontSize: 14, color: '#94a3b8' }} />
        </Box>
      </Box>
      {article.published_at && (
        <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: 11 }}>{article.published_at}</Typography>
      )}
      {article.excerpt && (
        <Typography sx={{ mt: 0.8, fontSize: '0.82rem', color: '#475569', lineHeight: 1.6, bgcolor: '#f8fafc', p: 1.2, borderRadius: 1 }}>
          {article.excerpt}{article.excerpt.length >= 298 ? '…' : ''}
        </Typography>
      )}
      <Typography variant="caption" sx={{ color: ACCENT, fontSize: 11, mt: 0.5, display: 'block' }}>
        Click to read full article
      </Typography>
    </Box>
  )
}

function ArticleModal({ article, onClose }) {
  if (!article) return null
  return (
    <Dialog
      open={!!article}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      scroll="paper"
      PaperProps={{ sx: { borderRadius: 3, maxHeight: '85vh' } }}
    >
      <DialogTitle sx={{ pr: 6, pb: 1.5, borderBottom: '1px solid #e2e8f0' }}>
        <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a', lineHeight: 1.45, pr: 2 }}>
          {article.title || '(no title)'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
          {article.published_at && (
            <Chip label={article.published_at} size="small" sx={{ fontSize: 10, height: 20, bgcolor: '#f1f5f9', color: '#64748b' }} />
          )}
          <Chip label={`${article.word_count} words`} size="small" sx={{ fontSize: 10, height: 20, bgcolor: '#f0f7ff', color: ACCENT }} />
        </Box>
        <IconButton
          onClick={onClose}
          size="small"
          sx={{ position: 'absolute', top: 12, right: 12, color: '#94a3b8', '&:hover': { color: '#0f172a' } }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 2.5 }}>
        <Typography
          component="div"
          sx={{
            fontSize: '0.9rem', color: '#1e293b', lineHeight: 1.8,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}
        >
          {article.body || article.excerpt || '(no content available)'}
        </Typography>
      </DialogContent>
    </Dialog>
  )
}

// ── Metric bar ────────────────────────────────────────────────────────────────

function MetricBar({ label, value, max, unit = '', color = ACCENT }) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <Box sx={{ mb: 1.5 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.4 }}>
        <Typography sx={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 500 }}>{label}</Typography>
        <Typography sx={{ fontSize: '0.78rem', color: '#0f172a', fontWeight: 700 }}>{value}{unit}</Typography>
      </Box>
      <LinearProgress
        variant="determinate" value={pct}
        sx={{
          height: 6, borderRadius: 3, bgcolor: '#e2e8f0',
          '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 3 },
        }}
      />
    </Box>
  )
}

// ── Style traits table ────────────────────────────────────────────────────────

function TraitsTable({ traits }) {
  if (!traits) return null

  const rows = [
    { label: 'Opening Sentence',   value: traits.opening_sentence },
    { label: 'Sentence Length',    value: traits.sentence_length },
    { label: 'Attribution Style',  value: traits.attribution },
    { label: 'Editorialising',     value: traits.editorialising },
    { label: 'Vocabulary',         value: traits.vocabulary },
    { label: 'Article Structure',  value: traits.structure },
    { label: 'Language Style',     value: traits.language_style },
    { label: 'Closing Paragraph',  value: traits.closing_paragraph },
    { label: 'Voice',              value: traits.voice },
  ].filter(r => r.value)

  return (
    <Box sx={{ border: '1px solid #e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
      {rows.map((row, i) => (
        <Box
          key={row.label}
          sx={{
            display: 'grid', gridTemplateColumns: '160px 1fr',
            bgcolor: i % 2 === 0 ? '#f8fafc' : '#fff',
            borderBottom: i < rows.length - 1 ? '1px solid #e2e8f0' : 'none',
          }}
        >
          <Box sx={{ p: 1.5, borderRight: '1px solid #e2e8f0' }}>
            <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.4 }}>
              {row.label}
            </Typography>
          </Box>
          <Box sx={{ p: 1.5 }}>
            <Typography sx={{ fontSize: '0.85rem', color: '#1e293b', lineHeight: 1.5 }}>
              {row.value}
            </Typography>
          </Box>
        </Box>
      ))}
    </Box>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AuthorPanel({ lang, authors }) {
  const [selected,     setSelected]     = useState(null)
  const [detail,       setDetail]       = useState(null)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState(null)
  const [openArticle,  setOpenArticle]  = useState(null)

  const handleSelect = (_, opt) => {
    setSelected(opt); setDetail(null)
    if (!opt) return
    setLoading(true); setError(null)
    getAuthorDetail(lang, opt.author_id)
      .then(setDetail)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  const m      = detail?.style?.metrics       || {}
  const t      = detail?.style?.traits        || {}
  const source = detail?.style?.traits_source || 'computed'

  return (
    <Box>
      {/* Dropdown */}
      <Autocomplete
        options={authors}
        getOptionLabel={o => o.article_count != null ? `${o.author_name}  (${o.article_count} articles)` : o.author_name}
        onChange={handleSelect}
        renderInput={params => (
          <TextField {...params} label="Search and select an author"
            placeholder="Type to filter…" variant="outlined" sx={{ bgcolor: '#fff' }} />
        )}
        sx={{ maxWidth: 520, mb: 3 }}
        noOptionsText="No authors found"
      />

      {loading && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2 }}>
          <CircularProgress size={18} sx={{ color: ACCENT }} />
          <Typography variant="body2" color="text.secondary">
            Analysing writing style — computing traits from {`up to 30 articles`}…
          </Typography>
        </Box>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {detail && !loading && (
        <Box>
          {/* Author header */}
          <Box sx={{ bgcolor: '#0f172a', color: '#fff', borderRadius: 2.5, p: 3, mb: detail.keywords?.length > 0 ? 1.5 : 3 }}>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
              {detail.stats.author_name}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {detail.stats.publishers?.map(p => (
                <Chip key={p} label={p} size="small"
                  sx={{ bgcolor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)', fontSize: 11 }} />
              ))}
              <Chip label={detail.stats.style_label} size="small"
                sx={{ bgcolor: '#1d4ed8', color: '#fff', fontSize: 11, fontWeight: 600 }} />
            </Box>
          </Box>

          {/* Topic signatures — prominent dedicated section */}
          {detail.keywords?.length > 0 && (
            <Box sx={{
              bgcolor: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 2,
              px: 2.5, py: 2, mb: 3, display: 'flex', alignItems: 'flex-start', gap: 1.5,
            }}>
              <Box sx={{ flexShrink: 0, mt: 0.2 }}>
                <TrendingUpIcon sx={{ fontSize: 18, color: '#7c3aed' }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#6d28d9',
                  textTransform: 'uppercase', letterSpacing: 0.6, mb: 1 }}>
                  Frequent Topics · from {Math.min(detail.stats.article_count, 30)} article titles
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.7, flexWrap: 'wrap' }}>
                  {detail.keywords.map((k, i) => (
                    <Chip key={k} label={k} size="small" sx={{
                      height: 24, fontSize: '0.78rem', fontWeight: 600,
                      bgcolor: ['#ede9fe','#ddd6fe','#c4b5fd','#a78bfa','#8b5cf6',
                                '#f3e8ff','#e9d5ff'][i % 7],
                      color: '#4c1d95',
                    }} />
                  ))}
                </Box>
                <Typography variant="caption" sx={{ color: '#9ca3af', fontSize: 10, mt: 0.8, display: 'block' }}>
                  When generating content, queries matching these topics will yield the strongest style transfer
                </Typography>
              </Box>
            </Box>
          )}

          {/* Mini stats row */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {[
              { icon: ArticleIcon,    label: 'Articles',     value: (detail.stats.article_count || 0).toLocaleString() },
              { icon: TextFieldsIcon, label: 'Avg Words',    value: (detail.stats.avg_word_count || 0).toLocaleString() },
              { icon: CalendarIcon,   label: 'Years Active', value: detail.stats.years_active ? `${detail.stats.years_active}y` : '—' },
              { icon: TrendingUpIcon, label: 'Avg Sentence', value: m.avg_sentence_length ? `${m.avg_sentence_length} words` : '—' },
            ].map(c => (
              <Grid item xs={6} sm={3} key={c.label}><MiniStat {...c} /></Grid>
            ))}
          </Grid>

          {(detail.stats.first_article || detail.stats.last_article) && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3, fontSize: '0.82rem' }}>
              Active: {detail.stats.first_article || '?'} → {detail.stats.last_article || 'present'}
              {detail.stats.min_word_count ? `  ·  Word range: ${detail.stats.min_word_count}–${detail.stats.max_word_count} words` : ''}
            </Typography>
          )}

          <Divider sx={{ mb: 3 }} />

          {/* ── Section 1: Math-based linguistic metrics (always shown) ── */}
          {Object.keys(m).length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.78rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>
                  Linguistic Metrics
                </Typography>
                <Chip label="📐 Formula-based" size="small"
                  sx={{ fontSize: 10, height: 20, fontWeight: 600, bgcolor: '#f1f5f9', color: '#475569' }} />
                <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  computed from {Math.min(detail.stats.article_count, 30)} articles
                </Typography>
              </Box>
              <Box sx={{ bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 2, p: 2.5 }}>
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}>
                    <MetricBar label="Avg sentence length" value={m.avg_sentence_length} max={40} unit=" words" />
                    <MetricBar label="Quote / attribution density" value={m.quote_density_pct} max={100} unit="%" color="#7c3aed" />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <MetricBar label="Vocabulary richness" value={Math.round((m.vocabulary_richness || 0) * 100)} max={100} unit="%" color="#059669" />
                  </Grid>
                </Grid>
                <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #e2e8f0', display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                  <Box sx={{ fontSize: '0.78rem', color: '#64748b' }}>
                    <strong style={{ color: '#0f172a' }}>Sentence length:</strong>{' '}
                    {(m.avg_sentence_length || 0) < 14 ? 'Short (< 14 words) — wire-service style'
                      : (m.avg_sentence_length || 0) < 22 ? 'Medium (14–22 words) — balanced'
                      : 'Long (> 22 words) — analytical / broadsheet'}
                  </Box>
                  <Box sx={{ fontSize: '0.78rem', color: '#64748b' }}>
                    <strong style={{ color: '#0f172a' }}>Quote density:</strong>{' '}
                    {(m.quote_density_pct || 0) > 35 ? 'Heavy — frequent direct quotes'
                      : (m.quote_density_pct || 0) > 15 ? 'Moderate — mix of quotes and paraphrase'
                      : 'Low — writer\'s own voice dominates'}
                  </Box>
                </Box>
              </Box>
            </Box>
          )}

          {/* ── Section 2: LLM qualitative traits (Qwen or rule-based) ── */}
          {Object.keys(t).length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.78rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>
                  Writing Style Analysis
                </Typography>
                <Chip
                  label={source === 'qwen' ? '⚡ Qwen 2.5' : '📐 Rule-based fallback'}
                  size="small"
                  sx={{
                    fontSize: 10, height: 20, fontWeight: 600,
                    bgcolor: source === 'qwen' ? '#dcfce7' : '#fff7ed',
                    color:   source === 'qwen' ? '#16a34a' : '#c2410c',
                  }}
                />
                {source !== 'qwen' && (
                  <Typography sx={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                    (open Qwen tunnel for AI analysis)
                  </Typography>
                )}
              </Box>
              <TraitsTable traits={t} />
            </Box>
          )}

          <Divider sx={{ mb: 2.5 }} />

          {/* Sample articles */}
          <Typography sx={{ fontWeight: 700, fontSize: '0.78rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, mb: 1.5 }}>
            5 Most Recent Articles · <span style={{ color: '#94a3b8', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>click any card to read in full</span>
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {detail.sample_articles.map(a => (
              <ArticleCard key={a.article_id} article={a} onOpen={setOpenArticle} />
            ))}
          </Box>
        </Box>
      )}

      {!selected && !loading && (
        <Box sx={{ bgcolor: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 2, p: 3, textAlign: 'center' }}>
          <Typography color="text.secondary" sx={{ fontSize: '0.88rem' }}>
            Select an author above to explore their writing profile, style traits, and sample articles.
          </Typography>
        </Box>
      )}

      {/* Article full-content modal */}
      <ArticleModal article={openArticle} onClose={() => setOpenArticle(null)} />
    </Box>
  )
}
