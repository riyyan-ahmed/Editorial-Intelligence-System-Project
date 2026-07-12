import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Button, Typography, Chip, Tooltip,
} from '@mui/material'
import BarChartIcon       from '@mui/icons-material/BarChart'
import AutoAwesomeIcon    from '@mui/icons-material/AutoAwesome'
import AssignmentIcon     from '@mui/icons-material/Assignment'
import AssessmentIcon     from '@mui/icons-material/Assessment'
import LogoutIcon         from '@mui/icons-material/Logout'
import { clearSession, getSession } from '../api/auth'
import DataExploration   from '../components/DataExploration'
import GenerateContent   from '../components/GenerateContent'
import AssignTasks       from '../components/AssignTasks'
import EvaluationsPanel  from '../components/EvaluationsPanel'

const TABS = [
  { id: 'exploration',  label: 'Dataset Exploration', icon: <BarChartIcon    sx={{ fontSize: 18 }} />, live: true },
  { id: 'generate',     label: 'Generate Content',    icon: <AutoAwesomeIcon sx={{ fontSize: 18 }} />, live: true },
  { id: 'tasks',        label: 'Assign Tasks',         icon: <AssignmentIcon  sx={{ fontSize: 18 }} />, live: true },
  { id: 'evaluations',  label: 'Evaluations',          icon: <AssessmentIcon  sx={{ fontSize: 18 }} />, live: true },
]

function ComingSoon({ title }) {
  return (
    <Box sx={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: 400, gap: 2,
    }}>
      <Box sx={{ fontSize: 48 }}>🚧</Box>
      <Typography variant="h5" sx={{ fontWeight: 700, color: '#0f172a' }}>{title}</Typography>
      <Typography sx={{ color: '#64748b', textAlign: 'center', maxWidth: 360 }}>
        This module is under development. It will be available in the next phase of the project.
      </Typography>
      <Chip label="Coming Soon" sx={{ bgcolor: '#f1f5f9', color: '#64748b', fontWeight: 600 }} />
    </Box>
  )
}

export default function Admin() {
  const nav     = useNavigate()
  const session = getSession()
  const [active, setActive] = useState('exploration')

  const logout = () => { clearSession(); nav('/') }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f8fafc' }}>

      {/* ── Top navbar ───────────────────────────────────────────────────── */}
      <Box sx={{
        bgcolor: '#fff', borderBottom: '1px solid #e2e8f0',
        px: { xs: 3, md: 5 }, py: 0,
        display: 'flex', alignItems: 'stretch',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        {/* Logo */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, pr: 5, borderRight: '1px solid #e2e8f0', mr: 4 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#2563eb' }} />
          <Typography sx={{ fontWeight: 700, fontSize: '0.92rem', color: '#0f172a', letterSpacing: -0.3 }}>
            Editorial Intelligence
          </Typography>
        </Box>

        {/* Tabs */}
        <Box sx={{ display: 'flex', alignItems: 'stretch', flex: 1 }}>
          {TABS.map(t => (
            <Tooltip key={t.id} title={!t.live ? 'Coming soon' : ''} placement="bottom">
              <Box
                onClick={() => t.live && setActive(t.id)}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1, px: 2.5, py: 2,
                  cursor: t.live ? 'pointer' : 'not-allowed',
                  borderBottom: active === t.id ? '2px solid #2563eb' : '2px solid transparent',
                  color: active === t.id ? '#2563eb' : t.live ? '#475569' : '#b0b8c4',
                  fontWeight: active === t.id ? 600 : 500,
                  fontSize: '0.88rem',
                  transition: 'all 0.15s',
                  userSelect: 'none',
                  '&:hover': t.live ? { color: '#2563eb', bgcolor: '#f8fafc' } : {},
                  position: 'relative',
                }}
              >
                {t.icon}
                {t.label}
                {!t.live && (
                  <Chip label="Soon" size="small" sx={{ height: 16, fontSize: 9, bgcolor: '#f1f5f9', color: '#94a3b8', ml: 0.5 }} />
                )}
              </Box>
            </Tooltip>
          ))}
        </Box>

        {/* User + logout */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, pl: 3, borderLeft: '1px solid #e2e8f0' }}>
          <Typography sx={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>
            {session?.username || 'Admin'}
          </Typography>
          <Button
            size="small" startIcon={<LogoutIcon sx={{ fontSize: 16 }} />}
            onClick={logout}
            sx={{ color: '#94a3b8', fontSize: '0.82rem', '&:hover': { color: '#ef4444', bgcolor: '#fff5f5' } }}
          >
            Logout
          </Button>
        </Box>
      </Box>

      {/* ── Module content ───────────────────────────────────────────────── */}
      <Box>
        {active === 'exploration' && <DataExploration />}
        {active === 'generate'   && <GenerateContent />}
        {active === 'tasks'       && <AssignTasks />}
        {active === 'evaluations' && <EvaluationsPanel />}
      </Box>
    </Box>
  )
}
