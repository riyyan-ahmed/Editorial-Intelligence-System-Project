import React, { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { useNavigate } from 'react-router-dom'
import {
  Box, Typography, Chip, Button, TextField, Autocomplete, CircularProgress,
  Alert, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material'
import SchoolIcon        from '@mui/icons-material/School'
import AutoAwesomeIcon   from '@mui/icons-material/AutoAwesome'
import LogoutIcon        from '@mui/icons-material/Logout'
import CheckCircleIcon   from '@mui/icons-material/CheckCircle'
import StyleIcon         from '@mui/icons-material/Style'
import CloseIcon         from '@mui/icons-material/Close'
import AssessmentIcon    from '@mui/icons-material/Assessment'
import HistoryIcon       from '@mui/icons-material/History'
import ExpandMoreIcon    from '@mui/icons-material/ExpandMore'
import { clearSession, getSession, getMyAssignments, submitEvaluation, myEvaluations } from '../api/auth'
import { generateContent, getAuthorTopics } from '../api/index'
import AuthorPanel from '../components/AuthorPanel'

const ACCENT = '#2563eb'
const LANG_META = {
  en: { flag: '🇬🇧', label: 'English', color: '#2563eb', bg: '#eff6ff' },
  el: { flag: '🇬🇷', label: 'Greek',   color: '#0891b2', bg: '#ecfeff' },
}

const TABS = [
  { id: 'learn',    label: 'Learn Styling',    icon: <SchoolIcon      sx={{ fontSize: 18 }} /> },
  { id: 'generate', label: 'Generate Content', icon: <AutoAwesomeIcon sx={{ fontSize: 18 }} /> },
  { id: 'history',  label: 'My Evaluations',   icon: <HistoryIcon     sx={{ fontSize: 18 }} /> },
]

// ── Learn Styling tab ─────────────────────────────────────────────────────────

function LearnStyling({ enAuthors, elAuthors }) {
  const hasEn = enAuthors.length > 0
  const hasEl = elAuthors.length > 0
  const [lang, setLang] = useState(hasEn ? 'en' : 'el')

  if (!hasEn && !hasEl) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 2 }}>
        <SchoolIcon sx={{ fontSize: 48, color: '#cbd5e1' }} />
        <Typography sx={{ color: '#94a3b8', fontSize: '0.95rem', textAlign: 'center' }}>
          No authors have been assigned to you yet.<br />Contact your admin to get access.
        </Typography>
      </Box>
    )
  }

  const authors = lang === 'en' ? enAuthors : elAuthors

  return (
    <Box sx={{ px: { xs: 2, md: 5 }, py: 4, maxWidth: 1000, mx: 'auto' }}>
      <Box sx={{ mb: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: '#0f172a', mb: 0.5 }}>
          Learn Styling
        </Typography>
        <Typography sx={{ color: '#64748b', fontSize: '0.88rem', mb: 3 }}>
          Explore the writing profiles of authors you've been assigned. Select an author to see their style analysis, linguistic metrics, and sample articles.
        </Typography>
      </Box>

      {/* Language selector — only show if assigned in both */}
      {hasEn && hasEl && (
        <Box sx={{ display: 'flex', gap: 1.5, mb: 3 }}>
          {['en', 'el'].map(l => {
            const m = LANG_META[l]
            const count = l === 'en' ? enAuthors.length : elAuthors.length
            return (
              <Box
                key={l}
                onClick={() => setLang(l)}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1.2,
                  px: 2, py: 1.2, borderRadius: 2, cursor: 'pointer',
                  border: `2px solid ${lang === l ? m.color : '#e2e8f0'}`,
                  bgcolor: lang === l ? m.bg : '#fff',
                  transition: 'all 0.15s',
                  '&:hover': { borderColor: m.color },
                }}
              >
                <Typography sx={{ fontSize: '1.1rem' }}>{m.flag}</Typography>
                <Box>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.88rem', color: lang === l ? m.color : '#0f172a' }}>
                    {m.label}
                  </Typography>
                  <Typography sx={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                    {count} author{count !== 1 ? 's' : ''}
                  </Typography>
                </Box>
              </Box>
            )
          })}
        </Box>
      )}

      <AuthorPanel lang={lang} authors={authors} />
    </Box>
  )
}

// ── Generate Content tab ──────────────────────────────────────────────────────

function UserGenerateContent({ enAuthors, elAuthors }) {
  const hasEn = enAuthors.length > 0
  const hasEl = elAuthors.length > 0
  const defaultLang = hasEn ? 'en' : 'el'

  const [lang,        setLang]        = useState(defaultLang)
  const [selected,    setSelected]    = useState(null)
  const [topics,      setTopics]      = useState([])
  const [query,       setQuery]       = useState('')
  const [loading,     setLoading]     = useState(false)
  const [result,      setResult]      = useState(null)
  const [error,       setError]       = useState('')
  const [copied,      setCopied]      = useState(false)
  const [userContent,   setUserContent]   = useState('')
  const [evalOpen,      setEvalOpen]      = useState(false)
  const [evalLoading,   setEvalLoading]   = useState(false)
  const [evalSuccess,   setEvalSuccess]   = useState(false)
  const [evalError,     setEvalError]     = useState('')

  const authors = lang === 'en' ? enAuthors : elAuthors

  // Reset author when language changes
  useEffect(() => {
    setSelected(null)
    setTopics([])
    setResult(null)
    setError('')
  }, [lang])

  // Fetch topics when author selected
  useEffect(() => {
    if (!selected) { setTopics([]); return }
    getAuthorTopics(lang, selected.author_id)
      .then(d => setTopics(d.topics || []))
      .catch(() => setTopics([]))
  }, [selected, lang])

  const canGenerate = !!selected && query.trim().length > 2 && !loading

  const generate = async () => {
    if (!canGenerate) return
    setLoading(true); setResult(null); setError(''); setUserContent('')
    try {
      const data = await generateContent({
        lang,
        author_id:   selected.author_id,
        author_name: selected.author_name,
        query:       query.trim(),
      })
      setResult(data)
    } catch (e) {
      setError(e.response?.data?.detail || e.message || 'Generation failed')
    } finally {
      setLoading(false)
    }
  }

  const copy = () => {
    navigator.clipboard.writeText(result?.generated_content || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const reset = () => {
    setResult(null); setQuery(''); setSelected(null); setTopics([]); setEvalSuccess(false); setUserContent('')
    setError('')
  }

  if (!hasEn && !hasEl) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 2 }}>
        <AutoAwesomeIcon sx={{ fontSize: 48, color: '#cbd5e1' }} />
        <Typography sx={{ color: '#94a3b8', fontSize: '0.95rem', textAlign: 'center' }}>
          No authors have been assigned to you yet.<br />Contact your admin to get access.
        </Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ px: { xs: 2, md: 5 }, py: 4, maxWidth: 800, mx: 'auto' }}>

      {result ? (
        // ── Results view ──
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#0f172a' }}>Generated Article</Typography>
              <Typography sx={{ color: '#64748b', fontSize: '0.82rem' }}>
                {selected?.author_name} · {query}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button size="small" onClick={copy}
                sx={{ color: copied ? '#16a34a' : '#64748b', fontSize: '0.82rem' }}>
                {copied ? 'Copied!' : 'Copy'}
              </Button>
              <Button size="small" onClick={reset} sx={{ color: '#64748b', fontSize: '0.82rem' }}>
                New article
              </Button>
            </Box>
          </Box>

          {/* Generated article */}
          <Box sx={{
            bgcolor: '#fff', border: '1px solid #e2e8f0', borderRadius: 2, p: 3, mb: 3,
            fontSize: '0.95rem', color: '#1e293b', lineHeight: 1.85, wordBreak: 'break-word',
            '& h1,& h2,& h3': { fontWeight: 700, color: '#0f172a', mt: 2, mb: 0.5, lineHeight: 1.4 },
            '& h1': { fontSize: '1.25rem' },
            '& h2': { fontSize: '1.1rem' },
            '& h3': { fontSize: '1rem' },
            '& p':  { mt: 0, mb: 1.5 },
            '& strong': { fontWeight: 700 },
            '& em':     { fontStyle: 'italic' },
            '& blockquote': { borderLeft: '3px solid #bfdbfe', pl: 2, ml: 0, color: '#475569', fontStyle: 'italic' },
          }}>
            <ReactMarkdown>{result.generated_content}</ReactMarkdown>
          </Box>

          {/* ── User's own content area ── */}
          <Box sx={{
            bgcolor: '#fafafa', border: '1px solid #e2e8f0', borderRadius: 2, p: 3, mb: 2,
          }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a', mb: 0.5 }}>
              Your Version
            </Typography>
            <Typography sx={{ fontSize: '0.8rem', color: '#94a3b8', mb: 1.5 }}>
              If the generated content doesn't meet your needs, write your own version below, then click Evaluate to compare.
            </Typography>
            <TextField
              multiline
              minRows={6}
              fullWidth
              placeholder="Write your own article here…"
              value={userContent}
              onChange={e => setUserContent(e.target.value)}
              sx={{ bgcolor: '#fff' }}
            />
          </Box>

          {/* Evaluate button */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              startIcon={evalLoading ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <AssessmentIcon />}
              onClick={() => setEvalOpen(true)}
              disabled={!userContent.trim() || evalLoading || !!evalSuccess}
              sx={{
                bgcolor: evalSuccess ? '#16a34a' : '#7c3aed',
                '&:hover': { bgcolor: evalSuccess ? '#15803d' : '#6d28d9' },
                '&:disabled': { bgcolor: '#e9d5ff', color: '#a78bfa' },
                fontWeight: 600,
              }}
            >
              {evalSuccess ? 'Submitted!' : 'Evaluate'}
            </Button>
          </Box>

          {/* Evaluate confirm modal */}
          <Dialog open={evalOpen} onClose={() => !evalLoading && setEvalOpen(false)} maxWidth="sm" fullWidth
            PaperProps={{ sx: { borderRadius: 3 } }}>
            <DialogTitle sx={{ pb: 1, pr: 6 }}>
              <Typography sx={{ fontWeight: 700, color: '#0f172a' }}>Submit for Evaluation</Typography>
              <IconButton onClick={() => setEvalOpen(false)} size="small" disabled={evalLoading}
                sx={{ position: 'absolute', top: 12, right: 12, color: '#94a3b8' }}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </DialogTitle>
            <DialogContent>
              {evalError && <Alert severity="error" sx={{ mb: 2 }}>{evalError}</Alert>}
              <Typography sx={{ color: '#475569', fontSize: '0.9rem', lineHeight: 1.7 }}>
                This will save both the AI-generated article (V1) and your version (V2) as an evaluation pair.
                The admin will use these pairs to calculate <strong>hTER</strong>, <strong>chrF</strong>, and <strong>COMET</strong> metrics,
                and the V1→V2 pairs will feed into the next LoRA fine-tuning cycle.
              </Typography>
              <Box sx={{ mt: 2, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 2, p: 2 }}>
                <Typography sx={{ fontSize: '0.78rem', color: '#64748b' }}>
                  <strong style={{ color: '#0f172a' }}>Author:</strong> {selected?.author_name}<br />
                  <strong style={{ color: '#0f172a' }}>Query:</strong> {query}<br />
                  <strong style={{ color: '#0f172a' }}>Language:</strong> {lang.toUpperCase()}
                </Typography>
              </Box>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
              <Button onClick={() => setEvalOpen(false)} disabled={evalLoading}
                sx={{ color: '#64748b', fontWeight: 600 }}>
                Cancel
              </Button>
              <Button
                variant="contained" disabled={evalLoading}
                startIcon={evalLoading ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : null}
                onClick={async () => {
                  setEvalLoading(true); setEvalError('')
                  try {
                    const res = await submitEvaluation({
                      lang,
                      author_id:    selected.author_id,
                      author_name:  selected.author_name,
                      query,
                      qwen_content: result.generated_content,
                      user_content: userContent,
                    })
                    setEvalSuccess(res)   // store full response with scores
                    setEvalOpen(false)
                  } catch (e) {
                    setEvalError(e.response?.data?.detail || e.message || 'Submission failed')
                  } finally {
                    setEvalLoading(false)
                  }
                }}
                sx={{ bgcolor: '#7c3aed', '&:hover': { bgcolor: '#6d28d9' }, fontWeight: 600 }}
              >
                {evalLoading ? 'Saving…' : 'Confirm & Submit'}
              </Button>
            </DialogActions>
          </Dialog>

          {/* Score display after successful submission */}
          {evalSuccess && evalSuccess.hter_score != null && (
            <Box sx={{
              mt: 2, bgcolor: '#f0fdf4', border: '1px solid #bbf7d0',
              borderRadius: 2, p: 2.5,
            }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.82rem', color: '#15803d', mb: 1.5 }}>
                Evaluation scores saved
              </Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                {[
                  { label: 'hTER', value: evalSuccess.hter_score, fmt: v => v.toFixed(4), good: v => v < 0.84, goodLabel: '< 0.84 baseline', badLabel: '> 0.84 baseline' },
                  { label: 'chrF', value: evalSuccess.chrf_score, fmt: v => v.toFixed(1), good: v => v > 56.28, goodLabel: '> 56.28 baseline', badLabel: '< 56.28 baseline' },
                ].map(({ label, value, fmt, good, goodLabel, badLabel }) => (
                  <Box key={label} sx={{ flex: 1, textAlign: 'center', bgcolor: '#fff', border: '1px solid #bbf7d0', borderRadius: 1.5, p: 1.5 }}>
                    <Typography sx={{ fontWeight: 800, fontSize: '1.3rem', color: good(value) ? '#16a34a' : '#dc2626', lineHeight: 1 }}>
                      {fmt(value)}
                    </Typography>
                    <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.6, mt: 0.5 }}>
                      {label}
                    </Typography>
                    <Typography sx={{ fontSize: '0.68rem', color: good(value) ? '#16a34a' : '#dc2626', mt: 0.3 }}>
                      {good(value) ? `✓ ${goodLabel}` : `✗ ${badLabel}`}
                    </Typography>
                  </Box>
                ))}
                {evalSuccess.comet_score != null && (
                  <Box sx={{ flex: 1, textAlign: 'center', bgcolor: '#fff', border: '1px solid #bbf7d0', borderRadius: 1.5, p: 1.5 }}>
                    <Typography sx={{ fontWeight: 800, fontSize: '1.3rem', color: '#2563eb', lineHeight: 1 }}>
                      {evalSuccess.comet_score.toFixed(4)}
                    </Typography>
                    <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.6, mt: 0.5 }}>
                      COMET
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>
          )}
        </Box>

      ) : (
        // ── Input view ──
        <Box>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#0f172a', mb: 0.5 }}>
              Generate Content
            </Typography>
            <Typography sx={{ color: '#64748b', fontSize: '0.88rem' }}>
              Select one of your assigned authors and enter a topic to generate a style-matched article.
            </Typography>
          </Box>

          {/* Language selector — only show if assigned in both */}
          {hasEn && hasEl && (
            <Box sx={{ display: 'flex', gap: 1.5, mb: 3 }}>
              {[hasEn && 'en', hasEl && 'el'].filter(Boolean).map(l => {
                const m = LANG_META[l]
                return (
                  <Box
                    key={l}
                    onClick={() => setLang(l)}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 1.2,
                      px: 2, py: 1.2, borderRadius: 2, cursor: 'pointer',
                      border: `2px solid ${lang === l ? m.color : '#e2e8f0'}`,
                      bgcolor: lang === l ? m.bg : '#fff',
                      transition: 'all 0.15s',
                      '&:hover': { borderColor: m.color },
                    }}
                  >
                    <Typography sx={{ fontSize: '1.1rem' }}>{m.flag}</Typography>
                    <Typography sx={{ fontWeight: 700, fontSize: '0.88rem', color: lang === l ? m.color : '#0f172a' }}>
                      {m.label}
                    </Typography>
                  </Box>
                )
              })}
            </Box>
          )}

          {/* Author selector */}
          <Box sx={{ mb: 3 }}>
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', mb: 0.8 }}>
              Author
            </Typography>
            <Autocomplete
              options={authors}
              getOptionLabel={o => o.author_name}
              value={selected}
              onChange={(_, opt) => setSelected(opt)}
              renderInput={params => (
                <TextField {...params} placeholder="Select an assigned author…" sx={{ bgcolor: '#fff' }} />
              )}
              noOptionsText="No authors assigned for this language"
            />
          </Box>

          {/* Topic chips */}
          {topics.length > 0 && selected && (
            <Box sx={{
              bgcolor: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 2,
              px: 2, py: 1.5, mb: 3, display: 'flex', alignItems: 'flex-start', gap: 1.5,
            }}>
              <StyleIcon sx={{ fontSize: 16, color: '#7c3aed', mt: 0.2 }} />
              <Box>
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#6d28d9',
                  textTransform: 'uppercase', letterSpacing: 0.6, mb: 0.8 }}>
                  {selected.author_name} most frequently writes about
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.7, flexWrap: 'wrap' }}>
                  {topics.map((t, i) => (
                    <Chip key={t} label={t} size="small"
                      onClick={() => setQuery(t)}
                      sx={{
                        height: 22, fontSize: '0.75rem', cursor: 'pointer',
                        bgcolor: ['#ede9fe','#ddd6fe','#c4b5fd','#a78bfa','#8b5cf6',
                                  '#f3e8ff','#e9d5ff','#d8b4fe','#c084fc','#a855f7'][i % 10],
                        color: i < 5 ? '#4c1d95' : '#6b21a8', fontWeight: 600,
                      }}
                    />
                  ))}
                </Box>
                <Typography variant="caption" sx={{ color: '#9ca3af', fontSize: 10, mt: 0.8, display: 'block' }}>
                  Click a chip to use it as your query
                </Typography>
              </Box>
            </Box>
          )}

          {/* Query input */}
          <Box sx={{ mb: 3 }}>
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', mb: 0.8 }}>
              Topic / Query
            </Typography>
            <TextField
              fullWidth
              placeholder="e.g. Labour welfare reform cuts, climate policy summit…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && canGenerate && generate()}
              sx={{ bgcolor: '#fff' }}
            />
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Button
            variant="contained" fullWidth size="large"
            startIcon={loading ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : <AutoAwesomeIcon />}
            disabled={!canGenerate}
            onClick={generate}
            sx={{ py: 1.4, fontSize: '1rem', fontWeight: 700 }}
          >
            {loading ? 'Generating article…' : 'Generate Article'}
          </Button>

          {loading && (
            <Box sx={{ mt: 2.5, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 2, p: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                <CircularProgress size={14} sx={{ color: ACCENT }} />
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }}>
                  Pipeline running — this takes ~30–60 seconds
                </Typography>
              </Box>
              {['Rewriting query with Qwen 2.5', 'Searching + fetching web sources', 'Retrieving style articles via bge-m3 + pgvector', 'Generating article'].map((s, i) => (
                <Typography key={i} sx={{ fontSize: '0.78rem', color: '#94a3b8', pl: 3.5 }}>• {s}</Typography>
              ))}
            </Box>
          )}
        </Box>
      )}
    </Box>
  )
}

// ── My Evaluations (history) tab ─────────────────────────────────────────────

const LANG_FLAG = { en: '🇬🇧', el: '🇬🇷' }

function ScorePill({ label, value, good }) {
  if (value == null) return null
  const color = good ? '#16a34a' : '#dc2626'
  const bg    = good ? '#f0fdf4' : '#fef2f2'
  return (
    <Box sx={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
      bgcolor: bg, border: `1px solid ${good ? '#bbf7d0' : '#fecaca'}`,
      borderRadius: 1.5, px: 1.2, py: 0.4, minWidth: 60 }}>
      <Typography sx={{ fontWeight: 800, fontSize: '0.82rem', color, lineHeight: 1.2 }}>
        {typeof value === 'number' ? (label === 'chrF' ? value.toFixed(1) : value.toFixed(4)) : value}
      </Typography>
      <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, color: '#94a3b8',
        textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</Typography>
    </Box>
  )
}

function EvalRow({ row }) {
  const [open, setOpen] = useState(false)
  const date = new Date(row.evaluated_at).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  return (
    <>
      <Box
        onClick={() => setOpen(true)}
        sx={{
          bgcolor: '#fff', border: '1px solid #e2e8f0', borderRadius: 2, p: 2,
          cursor: 'pointer', transition: 'all 0.15s',
          '&:hover': { borderColor: '#bfdbfe', boxShadow: '0 1px 6px rgba(37,99,235,0.07)' },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.4 }}>
              <Typography sx={{ fontSize: '0.78rem' }}>{LANG_FLAG[row.lang] || row.lang}</Typography>
              <Typography sx={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {row.author_name}
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>·</Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#64748b',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {row.query}
              </Typography>
            </Box>
            <Typography sx={{ fontSize: '0.72rem', color: '#94a3b8' }}>{date}</Typography>
          </Box>

          <Box sx={{ display: 'flex', gap: 1, flexShrink: 0, alignItems: 'center' }}>
            <ScorePill label="hTER" value={row.hter_score} good={row.hter_score < 0.84} />
            <ScorePill label="chrF"  value={row.chrf_score}  good={row.chrf_score > 56.28} />
            {row.comet_score != null &&
              <ScorePill label="COMET" value={row.comet_score} good={row.comet_score > 0.5} />}
            <ExpandMoreIcon sx={{ fontSize: 18, color: '#94a3b8' }} />
          </Box>
        </Box>
      </Box>

      {/* Detail modal */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ pb: 1, pr: 6 }}>
          <Typography sx={{ fontWeight: 700, color: '#0f172a' }}>
            {row.author_name} · {row.query}
          </Typography>
          <Typography sx={{ fontSize: '0.78rem', color: '#94a3b8', mt: 0.3 }}>{date}</Typography>
          <IconButton onClick={() => setOpen(false)} size="small"
            sx={{ position: 'absolute', top: 12, right: 12, color: '#94a3b8' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {/* Scores */}
          <Box sx={{ display: 'flex', gap: 1.5, mb: 3 }}>
            <ScorePill label="hTER" value={row.hter_score} good={row.hter_score < 0.84} />
            <ScorePill label="chrF"  value={row.chrf_score}  good={row.chrf_score > 56.28} />
            {row.comet_score != null &&
              <ScorePill label="COMET" value={row.comet_score} good={row.comet_score > 0.5} />}
          </Box>

          {/* V1 / V2 side by side */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            {[
              { title: 'V1 — AI Generated', content: row.qwen_content, color: '#2563eb', bg: '#eff6ff' },
              { title: 'V2 — Your Version',  content: row.user_content,  color: '#7c3aed', bg: '#faf5ff' },
            ].map(({ title, content, color, bg }) => (
              <Box key={title} sx={{ bgcolor: bg, border: `1px solid ${color}22`, borderRadius: 2, p: 2 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.78rem', color,
                  textTransform: 'uppercase', letterSpacing: 0.6, mb: 1 }}>{title}</Typography>
                <Typography sx={{ fontSize: '0.83rem', color: '#334155', lineHeight: 1.7,
                  whiteSpace: 'pre-wrap', maxHeight: 320, overflowY: 'auto' }}>
                  {content}
                </Typography>
              </Box>
            ))}
          </Box>
        </DialogContent>
      </Dialog>
    </>
  )
}

function MyHistory() {
  const [rows,       setRows]       = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')
  const [langFilter, setLangFilter] = useState('all')

  useEffect(() => {
    myEvaluations()
      .then(setRows)
      .catch(() => setError('Failed to load history'))
      .finally(() => setLoading(false))
  }, [])

  const availableLangs = [...new Set(rows.map(r => r.lang))].filter(Boolean).sort()
  const filtered = langFilter === 'all' ? rows : rows.filter(r => r.lang === langFilter)

  if (loading) return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 2 }}>
      <CircularProgress size={22} /><Typography sx={{ color: '#64748b' }}>Loading…</Typography>
    </Box>
  )

  return (
    <Box sx={{ px: { xs: 2, md: 5 }, py: 4, maxWidth: 900, mx: 'auto' }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: '#0f172a', mb: 0.5 }}>
          My Evaluations
        </Typography>
        <Typography sx={{ color: '#64748b', fontSize: '0.88rem' }}>
          All evaluation pairs you have submitted, across all assigned authors.
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Language filter — only shown once there are evaluations */}
      {availableLangs.length > 0 && (
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 3 }}>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', mr: 0.5 }}>
            Language:
          </Typography>
          {['all', ...availableLangs].map(l => {
            const lc  = LANG_META[l] || {}
            const sel = langFilter === l
            return (
              <Box
                key={l}
                onClick={() => setLangFilter(l)}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 0.6,
                  px: 1.5, py: 0.5, borderRadius: 5, cursor: 'pointer',
                  border: `1.5px solid ${sel ? (lc.color || '#0f172a') : '#e2e8f0'}`,
                  bgcolor: sel ? (lc.bg || '#f1f5f9') : '#fff',
                  color: sel ? (lc.color || '#0f172a') : '#64748b',
                  fontWeight: sel ? 700 : 500, fontSize: '0.78rem',
                  transition: 'all 0.12s',
                  '&:hover': { borderColor: lc.color || '#0f172a' },
                }}
              >
                {l === 'all' ? 'All' : `${lc.flag} ${lc.label}`}
              </Box>
            )
          })}
        </Box>
      )}

      {filtered.length === 0 && !error ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: 200, gap: 2 }}>
          <HistoryIcon sx={{ fontSize: 48, color: '#cbd5e1' }} />
          <Typography sx={{ color: '#94a3b8', fontSize: '0.95rem', textAlign: 'center' }}>
            {rows.length === 0
              ? <>No evaluations yet.<br />Generate an article and submit your version to see it here.</>
              : `No ${LANG_META[langFilter]?.label || langFilter.toUpperCase()} evaluations yet.`}
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {filtered.map(row => <EvalRow key={row.id} row={row} />)}
        </Box>
      )}
    </Box>
  )
}

// ── User dashboard ────────────────────────────────────────────────────────────

export default function User() {
  const nav     = useNavigate()
  const session = getSession()
  const [active,      setActive]      = useState('learn')
  const [assignments, setAssignments] = useState([])
  const [loadingInit, setLoadingInit] = useState(true)

  useEffect(() => {
    getMyAssignments()
      .then(setAssignments)
      .catch(() => setAssignments([]))
      .finally(() => setLoadingInit(false))
  }, [])

  const logout = () => { clearSession(); nav('/') }

  const enAuthors = assignments.filter(a => a.lang === 'en')
  const elAuthors = assignments.filter(a => a.lang === 'el')

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f8fafc' }}>

      {/* ── Top navbar ── */}
      <Box sx={{
        bgcolor: '#fff', borderBottom: '1px solid #e2e8f0',
        px: { xs: 3, md: 5 }, py: 0,
        display: 'flex', alignItems: 'stretch',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, pr: 5, borderRight: '1px solid #e2e8f0', mr: 4 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#2563eb' }} />
          <Typography sx={{ fontWeight: 700, fontSize: '0.92rem', color: '#0f172a', letterSpacing: -0.3 }}>
            Editorial Intelligence
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'stretch', flex: 1 }}>
          {TABS.map(t => (
            <Box
              key={t.id}
              onClick={() => setActive(t.id)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1, px: 2.5, py: 2,
                cursor: 'pointer',
                borderBottom: active === t.id ? '2px solid #2563eb' : '2px solid transparent',
                color: active === t.id ? '#2563eb' : '#475569',
                fontWeight: active === t.id ? 600 : 500,
                fontSize: '0.88rem',
                transition: 'all 0.15s',
                '&:hover': { color: '#2563eb', bgcolor: '#f8fafc' },
              }}
            >
              {t.icon}
              {t.label}
            </Box>
          ))}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, pl: 3, borderLeft: '1px solid #e2e8f0' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 26, height: 26, borderRadius: '50%', bgcolor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#2563eb' }}>
                {(session?.username || 'U')[0].toUpperCase()}
              </Typography>
            </Box>
            <Typography sx={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>
              {session?.username || 'User'}
            </Typography>
          </Box>
          <Button
            size="small" startIcon={<LogoutIcon sx={{ fontSize: 16 }} />}
            onClick={logout}
            sx={{ color: '#94a3b8', fontSize: '0.82rem', '&:hover': { color: '#ef4444', bgcolor: '#fff5f5' } }}
          >
            Logout
          </Button>
        </Box>
      </Box>

      {/* ── Content ── */}
      {loadingInit ? (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 2 }}>
          <CircularProgress size={24} />
          <Typography sx={{ color: '#64748b' }}>Loading your assignments…</Typography>
        </Box>
      ) : (
        <Box>
          {active === 'learn'    && <LearnStyling        enAuthors={enAuthors} elAuthors={elAuthors} />}
          {active === 'generate' && <UserGenerateContent enAuthors={enAuthors} elAuthors={elAuthors} />}
          {active === 'history'  && <MyHistory />}
        </Box>
      )}
    </Box>
  )
}
