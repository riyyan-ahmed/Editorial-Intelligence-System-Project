import React, { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import {
  Box, Typography, Chip, CircularProgress, Alert,
  Dialog, DialogTitle, DialogContent, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  Tabs, Tab,
} from '@mui/material'
import CloseIcon        from '@mui/icons-material/Close'
import VisibilityIcon   from '@mui/icons-material/Visibility'
import AssessmentIcon   from '@mui/icons-material/Assessment'
import BarChartIcon     from '@mui/icons-material/BarChart'
import { listEvaluations, getEvalStats } from '../api/auth'

const LANG_COLORS = {
  en: { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8', label: 'English', flag: '🇬🇧' },
  el: { bg: '#fdf4ff', border: '#e9d5ff', text: '#7c3aed', label: 'Greek',   flag: '🇬🇷' },
}
const BASELINE = { hter: 0.8371, chrf: 56.28 }

function LangFilter({ langs, active, onChange }) {
  const all = ['all', ...langs]
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
      <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', mr: 0.5 }}>
        Language:
      </Typography>
      {all.map(l => {
        const lc  = LANG_COLORS[l] || {}
        const sel = active === l
        return (
          <Box
            key={l}
            onClick={() => onChange(l)}
            sx={{
              display: 'flex', alignItems: 'center', gap: 0.6,
              px: 1.5, py: 0.5, borderRadius: 5, cursor: 'pointer',
              border: `1.5px solid ${sel ? (lc.text || '#0f172a') : '#e2e8f0'}`,
              bgcolor: sel ? (lc.bg || '#f1f5f9') : '#fff',
              color: sel ? (lc.text || '#0f172a') : '#64748b',
              fontWeight: sel ? 700 : 500, fontSize: '0.78rem',
              transition: 'all 0.12s',
              '&:hover': { borderColor: lc.text || '#0f172a' },
            }}
          >
            {l === 'all' ? 'All' : `${lc.flag} ${lc.label}`}
          </Box>
        )
      })}
    </Box>
  )
}

function ScoreCell({ value, good }) {
  if (value == null) return <Typography sx={{ color: '#cbd5e1', fontSize: '0.78rem' }}>—</Typography>
  return (
    <Typography sx={{ fontWeight: 700, fontSize: '0.82rem', color: good ? '#16a34a' : '#dc2626' }}>
      {value}
    </Typography>
  )
}

function PairModal({ row, onClose }) {
  if (!row) return null
  const lc = LANG_COLORS[row.lang] || {}
  return (
    <Dialog open={!!row} onClose={onClose} maxWidth="lg" fullWidth scroll="paper"
      PaperProps={{ sx: { borderRadius: 3, maxHeight: '90vh' } }}>
      <DialogTitle sx={{ pb: 1.5, borderBottom: '1px solid #e2e8f0', pr: 6 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>
          Evaluation Pair #{row.id}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, mt: 0.8, flexWrap: 'wrap' }}>
          <Chip label={row.author_name} size="small" sx={{ height: 20, fontSize: 10, bgcolor: '#f1f5f9', color: '#475569' }} />
          <Chip label={row.lang?.toUpperCase()} size="small"
            sx={{ height: 20, fontSize: 10, bgcolor: lc.bg, color: lc.text }} />
          <Chip label={row.username} size="small" sx={{ height: 20, fontSize: 10, bgcolor: '#f0fdf4', color: '#16a34a' }} />
          <Chip label={row.evaluated_at?.slice(0,10)} size="small" sx={{ height: 20, fontSize: 10, bgcolor: '#f8fafc', color: '#94a3b8' }} />
        </Box>
        <Typography sx={{ mt: 0.8, fontSize: '0.85rem', color: '#64748b' }}>
          Query: <strong style={{ color: '#0f172a' }}>{row.query}</strong>
        </Typography>
        <IconButton onClick={onClose} size="small"
          sx={{ position: 'absolute', top: 12, right: 12, color: '#94a3b8' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 2.5 }}>
        {/* Scores */}
        {(row.hter_score != null || row.chrf_score != null) && (
          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            {[
              { label: 'hTER', value: row.hter_score?.toFixed(4), good: row.hter_score < BASELINE.hter, note: `Baseline: ${BASELINE.hter}` },
              { label: 'chrF', value: row.chrf_score?.toFixed(2),  good: row.chrf_score > BASELINE.chrf,  note: `Baseline: ${BASELINE.chrf}` },
              row.comet_score != null && { label: 'COMET', value: row.comet_score?.toFixed(4), good: true, note: 'Higher = better' },
            ].filter(Boolean).map(({ label, value, good, note }) => (
              <Box key={label} sx={{ flex: 1, textAlign: 'center', bgcolor: good ? '#f0fdf4' : '#fef2f2', border: `1px solid ${good ? '#bbf7d0' : '#fecaca'}`, borderRadius: 2, p: 1.5 }}>
                <Typography sx={{ fontWeight: 800, fontSize: '1.4rem', color: good ? '#16a34a' : '#dc2626', lineHeight: 1 }}>{value}</Typography>
                <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8, mt: 0.4 }}>{label}</Typography>
                <Typography sx={{ fontSize: '0.68rem', color: '#94a3b8', mt: 0.2 }}>{note}</Typography>
              </Box>
            ))}
          </Box>
        )}

        {/* Side-by-side content */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
          <Box>
            <Chip label="V1 — Qwen Generated" size="small"
              sx={{ bgcolor: '#eff6ff', color: '#1d4ed8', fontWeight: 700, fontSize: 10, mb: 1.5 }} />
            <Box sx={{
              bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 2, p: 2.5,
              fontSize: '0.84rem', color: '#1e293b', lineHeight: 1.75,
              '& h1,& h2,& h3': { fontWeight: 700, mt: 1.5, mb: 0.5 },
              '& p': { mt: 0, mb: 1.2 },
              '& em': { fontStyle: 'italic' },
              '& blockquote': { borderLeft: '3px solid #bfdbfe', pl: 1.5, ml: 0, color: '#475569', fontStyle: 'italic' },
            }}>
              <ReactMarkdown>{row.qwen_content}</ReactMarkdown>
            </Box>
          </Box>
          <Box>
            <Chip label="V2 — Human Version" size="small"
              sx={{ bgcolor: '#f0fdf4', color: '#16a34a', fontWeight: 700, fontSize: 10, mb: 1.5 }} />
            <Box sx={{
              bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 2, p: 2.5,
              fontSize: '0.84rem', color: '#1e293b', lineHeight: 1.75,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {row.user_content}
            </Box>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  )
}

function StatsPanel({ stats, langFilter }) {
  if (!stats || stats.total === 0) return null
  const langs = Object.entries(stats.by_lang)
    .filter(([lang]) => langFilter === 'all' || lang === langFilter)

  if (langs.length === 0) return (
    <Box sx={{ bgcolor: '#f8fafc', border: '2px dashed #e2e8f0', borderRadius: 2, p: 5, textAlign: 'center' }}>
      <BarChartIcon sx={{ fontSize: 48, color: '#cbd5e1', mb: 1.5 }} />
      <Typography sx={{ color: '#94a3b8', fontSize: '0.9rem' }}>No data for this language yet.</Typography>
    </Box>
  )

  return (
    <Box sx={{ mb: 4 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${langs.length}, 1fr)`, gap: 3 }}>
        {langs.map(([lang, s]) => {
          const lc = LANG_COLORS[lang] || {}
          return (
            <Box key={lang} sx={{ bgcolor: '#fff', border: '1px solid #e2e8f0', borderRadius: 2, p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Chip label={`${lc.flag || ''} ${lc.label || lang.toUpperCase()}`} size="small"
                  sx={{ bgcolor: lc.bg, color: lc.text, fontWeight: 700, fontSize: 10 }} />
                <Typography sx={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                  {s.count} pair{s.count !== 1 ? 's' : ''}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {[
                  { label: 'Avg hTER', value: s.avg_hter, fmt: v => v?.toFixed(4), good: v => v != null && v < BASELINE.hter, baseline: `baseline ${BASELINE.hter}`, best: s.best_hter?.toFixed(4) },
                  { label: 'Avg chrF', value: s.avg_chrf, fmt: v => v?.toFixed(1), good: v => v != null && v > BASELINE.chrf, baseline: `baseline ${BASELINE.chrf}`, best: s.best_chrf?.toFixed(1) },
                  s.avg_comet != null && { label: 'Avg COMET', value: s.avg_comet, fmt: v => v?.toFixed(4), good: () => true, baseline: 'higher = better', best: null },
                ].filter(Boolean).map(({ label, value, fmt, good, baseline, best }) => (
                  <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1.2, bgcolor: '#f8fafc', borderRadius: 1 }}>
                    <Box>
                      <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>{label}</Typography>
                      <Typography sx={{ fontSize: '0.68rem', color: '#94a3b8' }}>{baseline}</Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', color: good(value) ? '#16a34a' : '#dc2626', lineHeight: 1 }}>
                        {value != null ? fmt(value) : '—'}
                      </Typography>
                      {best && <Typography sx={{ fontSize: '0.68rem', color: '#94a3b8' }}>best: {best}</Typography>}
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          )
        })}
      </Box>

      {/* Fine-tuning readiness bar */}
      <Box sx={{ mt: 2.5, bgcolor: '#fffbeb', border: '1px solid #fde68a', borderRadius: 2, p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: '#92400e' }}>
            LoRA Fine-tuning Readiness
          </Typography>
          <Typography sx={{ fontSize: '0.74rem', color: '#b45309' }}>
            Target: 50 pairs per language before first fine-tune cycle. Currently: {stats.total} total pairs.
          </Typography>
        </Box>
        {langs.map(([lang, s]) => (
          <Box key={lang} sx={{ textAlign: 'center', minWidth: 80 }}>
            <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: s.count >= 50 ? '#16a34a' : '#d97706' }}>
              {s.count}/50
            </Typography>
            <Typography sx={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600 }}>
              {(LANG_COLORS[lang] || {}).label || lang.toUpperCase()}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  )
}

export default function EvaluationsPanel() {
  const [tab,        setTab]        = useState(0)
  const [rows,       setRows]       = useState([])
  const [stats,      setStats]      = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')
  const [viewing,    setViewing]    = useState(null)
  const [langFilter, setLangFilter] = useState('all')

  useEffect(() => {
    Promise.all([listEvaluations(), getEvalStats()])
      .then(([r, s]) => { setRows(r); setStats(s) })
      .catch(e => setError(e.response?.data?.detail || e.message))
      .finally(() => setLoading(false))
  }, [])

  // Languages that actually have data
  const availableLangs = [...new Set(rows.map(r => r.lang))].filter(Boolean).sort()

  const filteredRows = langFilter === 'all'
    ? rows
    : rows.filter(r => r.lang === langFilter)

  return (
    <Box sx={{ px: { xs: 2, md: 5 }, py: 4, maxWidth: 1200, mx: 'auto' }}>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#0f172a', mb: 0.5 }}>Evaluations</Typography>
          <Typography sx={{ color: '#64748b', fontSize: '0.9rem' }}>
            V1→V2 pairs submitted by editors — for metric scoring and LoRA fine-tuning.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          {[
            { label: 'Total Pairs', value: rows.length, bg: '#f0f7ff', border: '#bfdbfe', color: '#2563eb' },
            { label: 'Scored',      value: rows.filter(r => r.hter_score != null).length, bg: '#f0fdf4', border: '#bbf7d0', color: '#16a34a' },
          ].map(({ label, value, bg, border, color }) => (
            <Box key={label} sx={{ textAlign: 'center', bgcolor: bg, border: `1px solid ${border}`, borderRadius: 2, px: 2.5, py: 1.2 }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1.4rem', color, lineHeight: 1 }}>{value}</Typography>
              <Typography sx={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {/* Language filter */}
      {availableLangs.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <LangFilter langs={availableLangs} active={langFilter} onChange={l => { setLangFilter(l) }} />
        </Box>
      )}

      <Box sx={{ borderBottom: '1px solid #e2e8f0', mb: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}
          sx={{ '& .MuiTab-root': { textTransform: 'none', fontSize: '0.88rem', fontWeight: 500 }, '& .Mui-selected': { color: '#2563eb !important', fontWeight: 600 }, '& .MuiTabs-indicator': { bgcolor: '#2563eb' } }}>
          <Tab label="Individual Pairs" icon={<AssessmentIcon sx={{ fontSize: 16 }} />} iconPosition="start" />
          <Tab label="Aggregated Stats" icon={<BarChartIcon   sx={{ fontSize: 16 }} />} iconPosition="start" />
        </Tabs>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 4 }}>
          <CircularProgress size={22} /><Typography sx={{ color: '#64748b' }}>Loading…</Typography>
        </Box>
      ) : (
        <>
          {tab === 0 && (
            filteredRows.length === 0 ? (
              <Box sx={{ bgcolor: '#f8fafc', border: '2px dashed #e2e8f0', borderRadius: 2, p: 5, textAlign: 'center' }}>
                <AssessmentIcon sx={{ fontSize: 48, color: '#cbd5e1', mb: 1.5 }} />
                <Typography sx={{ color: '#94a3b8', fontSize: '0.9rem' }}>
                  {langFilter === 'all'
                    ? 'No evaluation pairs yet. Editors submit from the Generate Content tab.'
                    : `No ${LANG_COLORS[langFilter]?.label || langFilter.toUpperCase()} evaluations yet.`}
                </Typography>
              </Box>
            ) : (
              <TableContainer component={Paper} sx={{ border: '1px solid #e2e8f0', boxShadow: 'none', borderRadius: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#0f172a' }}>
                      {['#', 'User', 'Author', 'Lang', 'Query', 'Date', 'hTER', 'chrF', 'COMET', ''].map(h => (
                        <TableCell key={h} sx={{ color: '#fff', fontWeight: 700, fontSize: '0.75rem', py: 1.5, borderBottom: 'none' }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredRows.map((row, i) => {
                      const lc = LANG_COLORS[row.lang] || {}
                      return (
                        <TableRow key={row.id} sx={{ bgcolor: i % 2 === 0 ? '#fff' : '#f8fafc', '&:hover': { bgcolor: '#eff6ff' } }}>
                          <TableCell sx={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>#{row.id}</TableCell>
                          <TableCell sx={{ fontSize: '0.82rem', fontWeight: 600, color: '#0f172a' }}>{row.username}</TableCell>
                          <TableCell sx={{ fontSize: '0.82rem', color: '#334155' }}>{row.author_name}</TableCell>
                          <TableCell><Chip label={row.lang?.toUpperCase()} size="small" sx={{ height: 18, fontSize: '0.68rem', fontWeight: 700, bgcolor: lc.bg, color: lc.text }} /></TableCell>
                          <TableCell><Typography sx={{ fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{row.query}</Typography></TableCell>
                          <TableCell sx={{ fontSize: '0.78rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>{row.evaluated_at?.slice(0,10)}</TableCell>
                          <TableCell><ScoreCell value={row.hter_score?.toFixed(4)} good={row.hter_score != null && row.hter_score < BASELINE.hter} /></TableCell>
                          <TableCell><ScoreCell value={row.chrf_score?.toFixed(1)}  good={row.chrf_score  != null && row.chrf_score  > BASELINE.chrf} /></TableCell>
                          <TableCell><ScoreCell value={row.comet_score?.toFixed(3)} good={row.comet_score != null} /></TableCell>
                          <TableCell>
                            <IconButton size="small" onClick={() => setViewing(row)} sx={{ color: '#64748b', '&:hover': { color: '#2563eb' } }}>
                              <VisibilityIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )
          )}

          {tab === 1 && (
            stats && stats.total > 0
              ? <StatsPanel stats={stats} langFilter={langFilter} />
              : <Box sx={{ bgcolor: '#f8fafc', border: '2px dashed #e2e8f0', borderRadius: 2, p: 5, textAlign: 'center' }}>
                  <BarChartIcon sx={{ fontSize: 48, color: '#cbd5e1', mb: 1.5 }} />
                  <Typography sx={{ color: '#94a3b8', fontSize: '0.9rem' }}>No scored data yet.</Typography>
                </Box>
          )}
        </>
      )}

      <PairModal row={viewing} onClose={() => setViewing(null)} />
    </Box>
  )
}
