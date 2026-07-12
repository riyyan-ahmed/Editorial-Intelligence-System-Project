import React, { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import {
  Box, Typography, Chip, Button, TextField, Autocomplete,
  CircularProgress, Alert, Accordion, AccordionSummary, AccordionDetails,
  Divider, IconButton, Tooltip, Dialog, DialogTitle, DialogContent,
} from '@mui/material'
import ExpandMoreIcon       from '@mui/icons-material/ExpandMore'
import ArrowBackIcon        from '@mui/icons-material/ArrowBack'
import AutoAwesomeIcon      from '@mui/icons-material/AutoAwesome'
import SearchIcon           from '@mui/icons-material/Search'
import StyleIcon            from '@mui/icons-material/Style'
import CodeIcon             from '@mui/icons-material/Code'
import ArticleIcon          from '@mui/icons-material/Article'
import CheckCircleIcon      from '@mui/icons-material/CheckCircle'
import ContentCopyIcon      from '@mui/icons-material/ContentCopy'
import RefreshIcon          from '@mui/icons-material/Refresh'
import PublicIcon           from '@mui/icons-material/Public'
import OpenInNewIcon        from '@mui/icons-material/OpenInNew'
import OpenInFullIcon       from '@mui/icons-material/OpenInFull'
import CloseIcon            from '@mui/icons-material/Close'
import TokenIcon            from '@mui/icons-material/Token'
import { getAuthors, generateContent, getAuthorTopics, getOverview } from '../api/index'

const ACCENT = '#2563eb'

const LANGS = [
  { id: 'en', flag: '🇬🇧', label: 'English', color: '#2563eb', bg: '#eff6ff' },
  { id: 'el', flag: '🇬🇷', label: 'Greek',   color: '#0891b2', bg: '#ecfeff' },
]

const STEPS = [
  { key: 'rewrite', icon: <AutoAwesomeIcon sx={{ fontSize: 17 }} />, label: 'Rewriting query',         sublabel: 'Qwen 2.5 LLM' },
  { key: 'web',     icon: <SearchIcon      sx={{ fontSize: 17 }} />, label: 'Searching + fetching web', sublabel: 'DuckDuckGo + URL fetch' },
  { key: 'style',   icon: <StyleIcon       sx={{ fontSize: 17 }} />, label: 'Extracting author style',  sublabel: 'bge-m3 + pgvector' },
  { key: 'gen',     icon: <AutoAwesomeIcon sx={{ fontSize: 17 }} />, label: 'Generating article',      sublabel: 'Qwen 2.5 LLM' },
]

// ── Content modal (shared for web sources and style articles) ────────────────

function ContentModal({ open, onClose, title, subtitle, content, url }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth scroll="paper"
      PaperProps={{ sx: { borderRadius: 3, maxHeight: '82vh' } }}>
      <DialogTitle sx={{ pr: 6, pb: 1.5, borderBottom: '1px solid #e2e8f0' }}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.97rem', color: '#0f172a', lineHeight: 1.4, pr: 2 }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: 11 }}>{subtitle}</Typography>
        )}
        {url && (
          <Box sx={{ mt: 0.5 }}>
            <a href={url} target="_blank" rel="noreferrer"
              style={{ fontSize: 11, color: ACCENT, wordBreak: 'break-all' }}>
              {url}
            </a>
          </Box>
        )}
        <IconButton onClick={onClose} size="small"
          sx={{ position: 'absolute', top: 12, right: 12, color: '#94a3b8' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 2.5 }}>
        <Box sx={{
          fontSize: '0.88rem', color: '#1e293b', lineHeight: 1.8, wordBreak: 'break-word',
          '& p': { mt: 0, mb: 1.4 },
          '& strong': { fontWeight: 700 },
          '& em': { fontStyle: 'italic' },
        }}>
          <ReactMarkdown>{content || '(no content available)'}</ReactMarkdown>
        </Box>
      </DialogContent>
    </Dialog>
  )
}

// ── Pipeline progress ─────────────────────────────────────────────────────────

function PipelineProgress({ active }) {
  const [completed, setCurrent_] = useState([])
  const [current,   setCurrent]  = useState(0)

  useEffect(() => {
    if (!active) { setCurrent_([]); setCurrent(0); return }
    setCurrent_([]); setCurrent(0)
    const timings = [5000, 12000, 17000]
    const timeouts = timings.map((ms, i) =>
      setTimeout(() => {
        setCurrent_(prev => [...prev, STEPS[i].key])
        setCurrent(i + 1)
      }, ms)
    )
    return () => timeouts.forEach(clearTimeout)
  }, [active])

  return (
    <Box sx={{ bgcolor: '#fff', border: '1px solid #e2e8f0', borderRadius: 3, p: 3, mb: 3 }}>
      <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b',
        textTransform: 'uppercase', letterSpacing: 1, mb: 2 }}>
        Pipeline Running
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {STEPS.map((step, i) => {
          const done    = completed.includes(step.key)
          const running = !done && i === current
          return (
            <Box key={step.key} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                bgcolor: done ? '#dcfce7' : running ? '#eff6ff' : '#f8fafc',
                color:   done ? '#16a34a' : running ? ACCENT    : '#cbd5e1',
                border:  `1px solid ${done ? '#bbf7d0' : running ? '#bfdbfe' : '#e2e8f0'}`,
              }}>
                {done
                  ? <CheckCircleIcon sx={{ fontSize: 18, color: '#16a34a' }} />
                  : running
                    ? <CircularProgress size={14} sx={{ color: ACCENT }} />
                    : step.icon}
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: '0.88rem', fontWeight: done || running ? 600 : 400,
                  color: done ? '#16a34a' : running ? '#0f172a' : '#94a3b8' }}>
                  {step.label}
                </Typography>
                <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: 11 }}>{step.sublabel}</Typography>
              </Box>
              {done    && <Chip label="Done"      size="small" sx={{ height: 18, fontSize: 10, bgcolor: '#dcfce7', color: '#16a34a' }} />}
              {running && <Chip label="Running…"  size="small" sx={{ height: 18, fontSize: 10, bgcolor: '#eff6ff', color: ACCENT }} />}
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}

// ── Result accordion ──────────────────────────────────────────────────────────

function ResultAccordion({ icon, title, badge, defaultOpen = false, children }) {
  return (
    <Accordion defaultExpanded={defaultOpen} disableGutters sx={{
      border: '1px solid #e2e8f0', borderRadius: '12px !important', mb: 1.5,
      '&:before': { display: 'none' }, boxShadow: 'none',
      '&.Mui-expanded': { boxShadow: '0 4px 16px rgba(0,0,0,0.06)' },
    }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2.5, py: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ color: ACCENT }}>{icon}</Box>
          <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', color: '#0f172a' }}>{title}</Typography>
          {badge && <Chip label={badge} size="small"
            sx={{ height: 20, fontSize: 10, bgcolor: '#f0f7ff', color: ACCENT }} />}
        </Box>
      </AccordionSummary>
      <AccordionDetails sx={{ px: 2.5, pb: 2.5, pt: 0, borderTop: '1px solid #f1f5f9' }}>
        {children}
      </AccordionDetails>
    </Accordion>
  )
}

// ── Web source card ───────────────────────────────────────────────────────────

function WebSourceCard({ source, index, onExpand }) {
  return (
    <Box sx={{
      bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 2, p: 2, mb: 1.2,
      borderLeft: `3px solid ${ACCENT}`,
    }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5, gap: 1 }}>
        <Typography sx={{ fontWeight: 600, fontSize: '0.88rem', color: '#0f172a', flex: 1, lineHeight: 1.4 }}>
          {source.title || '(no title)'}
        </Typography>
        <Chip label={`#${index + 1}`} size="small"
          sx={{ height: 18, fontSize: 10, bgcolor: '#eff6ff', color: ACCENT, flexShrink: 0 }} />
      </Box>

      <Box sx={{ display: 'flex', gap: 1, mb: 0.8, flexWrap: 'wrap', alignItems: 'center' }}>
        {source.source && <Chip label={source.source} size="small" sx={{ height: 16, fontSize: 10, bgcolor: '#f1f5f9', color: '#475569' }} />}
        {source.date   && <Chip label={source.date}   size="small" sx={{ height: 16, fontSize: 10, bgcolor: '#f1f5f9', color: '#475569' }} />}
      </Box>

      <Typography sx={{ fontSize: '0.82rem', color: '#475569', lineHeight: 1.6, mb: 1 }}>
        {source.snippet}
      </Typography>

      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
        {source.url && (
          <a href={source.url} target="_blank" rel="noreferrer"
            style={{ fontSize: 11, color: ACCENT, display: 'flex', alignItems: 'center', gap: 3, textDecoration: 'none' }}>
            <OpenInNewIcon style={{ fontSize: 12 }} />
            {source.source || 'Open article'}
          </a>
        )}
        <Button size="small" startIcon={<OpenInFullIcon sx={{ fontSize: 12 }} />}
          onClick={() => onExpand(source)}
          sx={{ fontSize: '0.75rem', color: '#64748b', p: 0, minWidth: 0, ml: 'auto',
            '&:hover': { color: ACCENT, bgcolor: 'transparent' } }}>
          View full content passed to Qwen
        </Button>
      </Box>
    </Box>
  )
}

// ── Style article card ────────────────────────────────────────────────────────

function StyleArticleCard({ article, index, onExpand }) {
  const sim = article.similarity
  return (
    <Box sx={{
      bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 2, p: 2, mb: 1.2,
      borderLeft: '3px solid #7c3aed',
    }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5, gap: 1 }}>
        <Typography sx={{ fontWeight: 600, fontSize: '0.88rem', color: '#0f172a', flex: 1, lineHeight: 1.4 }}>
          {article.title || '(no title)'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.8, flexShrink: 0 }}>
          {sim != null && (
            <Chip label={`sim ${(sim * 100).toFixed(0)}%`} size="small"
              sx={{ height: 18, fontSize: 10, bgcolor: '#f5f3ff', color: '#7c3aed' }} />
          )}
          <Chip label={`${article.word_count || 0}w`} size="small"
            sx={{ height: 18, fontSize: 10, bgcolor: '#f5f3ff', color: '#7c3aed' }} />
        </Box>
      </Box>

      {article.published_at && (
        <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: 11, display: 'block', mb: 0.8 }}>
          {String(article.published_at).slice(0, 10)}
        </Typography>
      )}

      <Typography sx={{ fontSize: '0.82rem', color: '#475569', lineHeight: 1.6 }}>
        {(article.excerpt || '').slice(0, 280)}{(article.excerpt || '').length > 280 ? '…' : ''}
      </Typography>

      <Button size="small" startIcon={<OpenInFullIcon sx={{ fontSize: 12 }} />}
        onClick={() => onExpand(article)}
        sx={{ fontSize: '0.75rem', color: '#7c3aed', p: 0, mt: 0.8, minWidth: 0,
          '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' } }}>
        Read full excerpt (as passed to Qwen)
      </Button>
    </Box>
  )
}

// ── Token badge ───────────────────────────────────────────────────────────────

function TokenBadge({ label, count, color }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6,
      bgcolor: `${color}12`, border: `1px solid ${color}30`, borderRadius: 1.5, px: 1.2, py: 0.4 }}>
      <TokenIcon sx={{ fontSize: 13, color }} />
      <Typography sx={{ fontSize: 11, fontWeight: 700, color }}>{label}:</Typography>
      <Typography sx={{ fontSize: 11, fontWeight: 800, color }}>{count.toLocaleString()}</Typography>
    </Box>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function GenerateContent() {
  const [lang,        setLang]        = useState(null)
  const [authors,     setAuthors]     = useState([])
  const [authLoad,    setAuthLoad]    = useState(false)
  const [selected,    setSelected]    = useState(null)
  const [query,       setQuery]       = useState('')
  const [generating,  setGenerating]  = useState(false)
  const [result,      setResult]      = useState(null)
  const [error,       setError]       = useState(null)
  const [copied,      setCopied]      = useState(false)
  const [modal,       setModal]       = useState(null)  // { title, subtitle, content, url }
  const [topics,      setTopics]      = useState([])
  const [langStats,   setLangStats]   = useState({})   // { en: {articles, authors}, el: {...} }

  // Fetch real stats for both language cards on first render
  useEffect(() => {
    Promise.all(
      LANGS.map(l => getOverview(l.id).then(d => [l.id, d.stats]).catch(() => [l.id, null]))
    ).then(pairs => {
      const map = {}
      pairs.forEach(([id, s]) => { if (s) map[id] = s })
      setLangStats(map)
    })
  }, [])

  useEffect(() => {
    if (!lang) return
    setAuthLoad(true); setSelected(null); setAuthors([]); setResult(null); setTopics([])
    getAuthors(lang)
      .then(setAuthors).catch(() => setAuthors([]))
      .finally(() => setAuthLoad(false))
  }, [lang])

  // Fetch topics instantly whenever an author is selected
  useEffect(() => {
    if (!selected || !lang) { setTopics([]); return }
    getAuthorTopics(lang, selected.author_id)
      .then(d => setTopics(d.topics || []))
      .catch(() => setTopics([]))
  }, [selected, lang])

  const handleGenerate = async () => {
    if (!selected || !query.trim()) return
    setGenerating(true); setResult(null); setError(null)
    try {
      const res = await generateContent({
        lang, author_id: selected.author_id,
        author_name: selected.author_name, query: query.trim(),
      })
      setResult(res)
    } catch (e) {
      setError(e.response?.data?.detail || e.message || 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const handleCopy = () => {
    if (result?.generated_content) {
      navigator.clipboard.writeText(result.generated_content)
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    }
  }

  const reset = () => { setResult(null); setQuery(''); setSelected(null); setTopics([]) }

  const openWebModal = (source) => setModal({
    title:    source.title,
    subtitle: `${source.source}  ·  ${source.date}`,
    content:  source.full_content || source.snippet,
    url:      source.url,
  })

  const openStyleModal = (article) => setModal({
    title:    article.title || '(no title)',
    subtitle: `${String(article.published_at || '').slice(0, 10)}  ·  ${article.word_count || 0} words`,
    content:  article.excerpt,
    url:      null,
  })

  // ── Language selection ───────────────────────────────────────────────────
  if (!lang) {
    return (
      <Box sx={{ px: { xs: 3, md: 6 }, py: 6, maxWidth: 900, mx: 'auto' }}>
        <Box sx={{ textAlign: 'center', mb: 5 }}>
          <Chip icon={<AutoAwesomeIcon sx={{ fontSize: 14 }} />} label="V0 → V1 Content Generation"
            size="small" sx={{ bgcolor: '#eff6ff', color: ACCENT, fontWeight: 600, mb: 2, fontSize: 12 }} />
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#0f172a', mb: 1.5 }}>
            Generate Publisher-Style Content
          </Typography>
          <Typography sx={{ color: '#64748b', fontSize: '1rem', maxWidth: 580, mx: 'auto', lineHeight: 1.7 }}>
            Select a language corpus, choose an author, enter a topic — the system rewrites your
            query, fetches live web facts, retrieves the author's style via bge-m3 semantic search,
            and generates a V1 draft in their voice.
          </Typography>
        </Box>

        {/* Pipeline diagram */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, mb: 5, flexWrap: 'wrap' }}>
          {[
            { label: 'Your Topic',    color: '#64748b' },
            { label: 'Query Rewrite', color: ACCENT },
            { label: 'Web Facts',     color: '#0891b2' },
            { label: 'Author Style',  color: '#7c3aed' },
            { label: 'V1 Draft',      color: '#059669' },
          ].map((s, i, arr) => (
            <React.Fragment key={s.label}>
              <Box sx={{ bgcolor: `${s.color}12`, border: `1px solid ${s.color}30`, borderRadius: 2, px: 2, py: 0.8 }}>
                <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: s.color }}>{s.label}</Typography>
              </Box>
              {i < arr.length - 1 && (
                <Typography sx={{ color: '#cbd5e1', px: 0.5, fontSize: '1.2rem' }}>→</Typography>
              )}
            </React.Fragment>
          ))}
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, maxWidth: 680, mx: 'auto' }}>
          {LANGS.map(l => {
            const s = langStats[l.id]
            const subtitle = s
              ? `${(s.total_articles || 0).toLocaleString()} articles · ${(s.total_authors || 0).toLocaleString()} authors · ${s.total_publishers || 0} publisher${s.total_publishers !== 1 ? 's' : ''}`
              : 'Loading…'
            return (
              <Box key={l.id} onClick={() => setLang(l.id)} sx={{
                bgcolor: '#fff', border: '1px solid #e2e8f0', borderRadius: 3, p: 4,
                textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s',
                '&:hover': { borderColor: l.color, boxShadow: `0 8px 32px ${l.color}20`, transform: 'translateY(-3px)' },
              }}>
                <Box sx={{ fontSize: 40, mb: 1.5 }}>{l.flag}</Box>
                <Typography sx={{ fontWeight: 700, fontSize: '1.15rem', color: '#0f172a', mb: 0.5 }}>{l.label}</Typography>
                <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: 11, display: 'block', lineHeight: 1.6 }}>
                  {subtitle}
                </Typography>
                <Button variant="outlined" size="small" sx={{
                  mt: 2, borderColor: l.color, color: l.color, fontWeight: 600, fontSize: '0.8rem',
                  '&:hover': { bgcolor: l.bg, borderColor: l.color },
                }}>
                  Select
                </Button>
              </Box>
            )
          })}
        </Box>
      </Box>
    )
  }

  const langMeta = LANGS.find(l => l.id === lang)

  // ── Generation form + results ─────────────────────────────────────────────
  return (
    <Box sx={{ px: { xs: 3, md: 6 }, py: 4, maxWidth: 960, mx: 'auto' }}>

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
        <IconButton onClick={() => { setLang(null); setResult(null) }} size="small"
          sx={{ bgcolor: '#f1f5f9', '&:hover': { bgcolor: '#e2e8f0' } }}>
          <ArrowBackIcon sx={{ fontSize: 18 }} />
        </IconButton>
        <Box sx={{ fontSize: 22 }}>{langMeta.flag}</Box>
        <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color: '#0f172a' }}>
          {langMeta.label} Content Generation
        </Typography>
        <Chip label="V0 → V1" size="small" sx={{ bgcolor: '#eff6ff', color: ACCENT, fontWeight: 700, fontSize: 10 }} />
        {result && (
          <Button size="small" startIcon={<RefreshIcon sx={{ fontSize: 15 }} />} onClick={reset}
            sx={{ ml: 'auto', color: '#64748b', fontSize: '0.82rem' }}>
            New Generation
          </Button>
        )}
      </Box>

      {/* Form */}
      {!result && (
        <Box sx={{ bgcolor: '#fff', border: '1px solid #e2e8f0', borderRadius: 3, p: 3.5, mb: 3 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.78rem', color: '#64748b',
            textTransform: 'uppercase', letterSpacing: 1, mb: 2 }}>
            1 · Select Author
          </Typography>
          <Autocomplete
            options={authors} loading={authLoad}
            getOptionLabel={o => `${o.author_name}  (${o.article_count} articles)`}
            onChange={(_, opt) => setSelected(opt)} value={selected}
            renderInput={params => (
              <TextField {...params} label="Search and select an author" placeholder="Type to filter…"
                variant="outlined" sx={{ bgcolor: '#fafafa' }}
                InputProps={{ ...params.InputProps, endAdornment: (<>{authLoad ? <CircularProgress size={16} /> : null}{params.InputProps.endAdornment}</>) }} />
            )}
            sx={{ mb: topics.length > 0 ? 1.5 : 3 }} noOptionsText="No authors found"
          />

          {/* Topic coverage hint — shown immediately after author selection */}
          {topics.length > 0 && (
            <Box sx={{
              bgcolor: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 2,
              px: 2, py: 1.5, mb: 3, display: 'flex', alignItems: 'flex-start', gap: 1.5,
            }}>
              <Box sx={{ flexShrink: 0, mt: 0.2 }}>
                <StyleIcon sx={{ fontSize: 16, color: '#7c3aed' }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#6d28d9',
                  textTransform: 'uppercase', letterSpacing: 0.6, mb: 0.8 }}>
                  {selected?.author_name} most frequently writes about
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.7, flexWrap: 'wrap' }}>
                  {topics.map((t, i) => (
                    <Chip
                      key={t}
                      label={t}
                      size="small"
                      onClick={() => setQuery(t)}
                      sx={{
                        height: 22, fontSize: '0.75rem', cursor: 'pointer',
                        bgcolor: ['#ede9fe','#ddd6fe','#c4b5fd','#a78bfa','#8b5cf6',
                                  '#f3e8ff','#e9d5ff','#d8b4fe','#c084fc','#a855f7'][i % 10],
                        color: i < 5 ? '#4c1d95' : '#6b21a8',
                        fontWeight: 600,
                        '&:hover': { opacity: 0.8, transform: 'scale(1.04)' },
                        transition: 'all 0.15s',
                      }}
                    />
                  ))}
                </Box>
                <Typography variant="caption" sx={{ color: '#9ca3af', fontSize: 10, mt: 0.8, display: 'block' }}>
                  Tip: queries matching these topics will get the strongest style transfer · click a chip to use it as your query
                </Typography>
              </Box>
            </Box>
          )}

          <Typography sx={{ fontWeight: 700, fontSize: '0.78rem', color: '#64748b',
            textTransform: 'uppercase', letterSpacing: 1, mb: 2 }}>
            2 · Enter Topic
          </Typography>
          <TextField
            multiline rows={3} fullWidth
            placeholder={selected
              ? `What should ${selected.author_name} write about? E.g. "The impact of AI on journalism"`
              : 'Select an author first, then enter your topic…'}
            value={query} onChange={e => setQuery(e.target.value)}
            disabled={!selected} variant="outlined" sx={{ bgcolor: '#fafafa', mb: 3 }}
            inputProps={{ maxLength: 500 }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: 11 }}>
              Query rewrite → web search + URL fetch → bge-m3 style retrieval → Qwen generation
            </Typography>
            <Button variant="contained" size="large"
              disabled={!selected || !query.trim() || generating}
              onClick={handleGenerate}
              startIcon={generating ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : <AutoAwesomeIcon />}
              sx={{ bgcolor: ACCENT, px: 4, minWidth: 180, '&:hover': { bgcolor: '#1d4ed8' } }}>
              {generating ? 'Generating…' : 'Generate Article'}
            </Button>
          </Box>
        </Box>
      )}

      {generating && <PipelineProgress active={generating} />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* ── Results ──────────────────────────────────────────────────────── */}
      {result && (
        <Box>
          {/* Summary bar */}
          <Box sx={{ bgcolor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 2, p: 2, mb: 3,
            display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <CheckCircleIcon sx={{ color: '#16a34a', fontSize: 20 }} />
            <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', color: '#15803d' }}>
              Article generated for <strong>{result.author_name}</strong>
            </Typography>
            <Chip label={`${result.web_results.length} web sources`}       size="small" sx={{ bgcolor: '#dcfce7', color: '#16a34a', fontSize: 10 }} />
            <Chip label={`${result.style_articles.length} style articles`} size="small" sx={{ bgcolor: '#dcfce7', color: '#16a34a', fontSize: 10 }} />
            <Chip label={result.lang === 'el' ? 'Greek' : 'English'}       size="small" sx={{ bgcolor: '#dcfce7', color: '#16a34a', fontSize: 10 }} />
          </Box>

          {/* Step 1: Query rewrite */}
          <ResultAccordion icon={<AutoAwesomeIcon sx={{ fontSize: 20 }} />} title="Query Rewrite" badge="Qwen 2.5">
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 1 }}>
              <Box sx={{ bgcolor: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 2, p: 2 }}>
                <Typography variant="caption" sx={{ color: '#c2410c', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', mb: 0.8 }}>Original</Typography>
                <Typography sx={{ fontSize: '0.88rem', color: '#1e293b', lineHeight: 1.6 }}>{result.query_original}</Typography>
              </Box>
              <Box sx={{ bgcolor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 2, p: 2 }}>
                <Typography variant="caption" sx={{ color: ACCENT, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', mb: 0.8 }}>Rewritten for retrieval</Typography>
                <Typography sx={{ fontSize: '0.88rem', color: '#1e293b', lineHeight: 1.6 }}>{result.query_rewritten}</Typography>
              </Box>
            </Box>
          </ResultAccordion>

          {/* Step 2: Web sources */}
          <ResultAccordion
            icon={<PublicIcon sx={{ fontSize: 20 }} />}
            title="Web Sources"
            badge={`${result.web_results.length} articles · DuckDuckGo + URL content fetch`}
          >
            <Box sx={{ mt: 1 }}>
              <Typography sx={{ fontSize: '0.82rem', color: '#64748b', mb: 2, lineHeight: 1.6 }}>
                Each source was fetched from its URL after DuckDuckGo search — richer content than
                the 200-char snippet alone. Click "View full content passed to Qwen" to see exactly
                what was included in the system prompt.
              </Typography>
              {result.web_results.length === 0
                ? <Typography sx={{ color: '#94a3b8', fontSize: '0.88rem', py: 1 }}>No web results retrieved.</Typography>
                : result.web_results.map((r, i) => (
                    <WebSourceCard key={i} source={r} index={i} onExpand={openWebModal} />
                  ))
              }
            </Box>
          </ResultAccordion>

          {/* Step 3: Style articles */}
          <ResultAccordion
            icon={<StyleIcon sx={{ fontSize: 20 }} />}
            title={`Author Style Context — ${result.author_name}`}
            badge={`${result.style_articles.length} articles · ${
              result.style_retrieval === 'semantic' ? '🔍 bge-m3 semantic search'
              : result.style_retrieval === 'keyword' ? '🔤 keyword match'
              : '🕐 most recent'
            }`}
          >
            <Box sx={{ mt: 1 }}>
              <Typography sx={{ fontSize: '0.82rem', color: '#64748b', mb: 2, lineHeight: 1.6 }}>
                {result.style_retrieval === 'semantic'
                  ? `These articles were retrieved using bge-m3 cosine similarity (pgvector) — the most semantically similar articles by ${result.author_name} to the query. Click any card to read the full excerpt passed to Qwen.`
                  : result.style_retrieval === 'keyword'
                    ? `Keyword-based retrieval (embed tunnel unavailable). Click any card to read the full excerpt.`
                    : `Most recent articles (embed tunnel unavailable). Click any card to read the full excerpt.`
                }
              </Typography>
              {result.style_articles.map((a, i) => (
                <StyleArticleCard key={i} article={a} index={i} onExpand={openStyleModal} />
              ))}
            </Box>
          </ResultAccordion>

          {/* Step 4: System prompt with token counts */}
          <ResultAccordion
            icon={<CodeIcon sx={{ fontSize: 20 }} />}
            title="System Prompt"
            badge="Full prompt sent to Qwen 2.5"
          >
            {/* Token counts outside the prompt box, at the top of the section */}
            {(result.input_tokens > 0 || result.output_tokens > 0) && (
              <Box sx={{ display: 'flex', gap: 1.5, mt: 1.5, mb: 2, flexWrap: 'wrap' }}>
                <TokenBadge label="Input tokens"  count={result.input_tokens}  color={ACCENT} />
                <TokenBadge label="Output tokens" count={result.output_tokens} color="#7c3aed" />
                <TokenBadge label="Total"         count={result.input_tokens + result.output_tokens} color="#059669" />
                <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: 11, alignSelf: 'center', ml: 0.5 }}>
                  · Qwen 2.5-7B-Instruct context window: 32,768 tokens
                </Typography>
              </Box>
            )}
            <Box sx={{ bgcolor: '#0f172a', borderRadius: 2, p: 2.5, overflowX: 'auto' }}>
              <Typography component="pre" sx={{
                fontSize: '0.75rem', color: '#e2e8f0', lineHeight: 1.7,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace', m: 0,
              }}>
                {result.system_prompt}
              </Typography>
            </Box>
          </ResultAccordion>

          {/* Step 5: Generated article */}
          <Box sx={{ bgcolor: '#fff', border: '2px solid #2563eb', borderRadius: 3, overflow: 'hidden', mb: 1.5 }}>
            <Box sx={{ bgcolor: '#eff6ff', px: 2.5, py: 1.5, display: 'flex', alignItems: 'center',
              gap: 1.5, borderBottom: '1px solid #bfdbfe' }}>
              <ArticleIcon sx={{ fontSize: 20, color: ACCENT }} />
              <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e3a8a', flex: 1 }}>
                Generated Article — V1 Draft
              </Typography>
              <Chip label="⚡ Qwen 2.5-7B-Instruct" size="small"
                sx={{ bgcolor: '#dcfce7', color: '#16a34a', fontWeight: 600, fontSize: 10 }} />
              <Tooltip title={copied ? 'Copied!' : 'Copy article'}>
                <IconButton size="small" onClick={handleCopy} sx={{ color: ACCENT }}>
                  <ContentCopyIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </Box>
            <Box sx={{ p: 3 }}>
              {result.generation_error
                ? <Alert severity="error">Generation failed: {result.generation_error}</Alert>
                : (
                  <Box sx={{
                    fontSize: '0.95rem', color: '#1e293b', lineHeight: 1.85,
                    wordBreak: 'break-word',
                    '& h1,& h2,& h3': { fontWeight: 700, color: '#0f172a', mt: 2, mb: 0.5, lineHeight: 1.4 },
                    '& h1': { fontSize: '1.25rem' },
                    '& h2': { fontSize: '1.1rem' },
                    '& h3': { fontSize: '1rem' },
                    '& p':  { mt: 0, mb: 1.5 },
                    '& strong': { fontWeight: 700, color: '#0f172a' },
                    '& em':     { fontStyle: 'italic', color: '#1e293b' },
                    '& blockquote': {
                      borderLeft: '3px solid #bfdbfe', pl: 2, ml: 0,
                      color: '#475569', fontStyle: 'italic',
                    },
                  }}>
                    <ReactMarkdown>{result.generated_content}</ReactMarkdown>
                  </Box>
                )
              }
            </Box>
            <Divider />
            <Box sx={{ px: 3, py: 1.5, display: 'flex', gap: 2, alignItems: 'center', bgcolor: '#f8fafc' }}>
              <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: 11, flex: 1 }}>
                This is a V1 AI draft. A human editor reviews and corrects it to produce V2 — those pairs train the next LoRA round.
              </Typography>
              <Button size="small" onClick={reset} startIcon={<RefreshIcon sx={{ fontSize: 15 }} />}
                sx={{ color: ACCENT, fontSize: '0.82rem', fontWeight: 600 }}>
                Generate Another
              </Button>
            </Box>
          </Box>
        </Box>
      )}

      {/* Shared content modal */}
      <ContentModal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.title || ''}
        subtitle={modal?.subtitle}
        content={modal?.content}
        url={modal?.url}
      />
    </Box>
  )
}
