import React, { useState } from 'react'
import { Box, Tabs, Tab, Typography, Divider } from '@mui/material'
import DatasetTab from './DatasetTab'

const DATASETS = [
  { lang: 'el', label: 'Greek Corpus',   flag: '🇬🇷', pubs: 'avopolis.gr · allyou.gr · newplatform.gr' },
  { lang: 'en', label: 'English Corpus', flag: '🇬🇧', pubs: 'The Guardian' },
]

export default function DataExploration() {
  const [active, setActive] = useState(0)

  return (
    <Box>
      {/* Section header */}
      <Box sx={{ bgcolor: '#fff', borderBottom: '1px solid #e2e8f0', px: { xs: 3, md: 5 }, pt: 3.5, pb: 0 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#0f172a', mb: 0.5 }}>
          Dataset Exploration
        </Typography>
        <Typography sx={{ color: '#64748b', fontSize: '0.9rem', mb: 2.5 }}>
          232,000+ editorial articles embedded with bge-m3 · explore author styles, corpus statistics, and writing profiles
        </Typography>

        <Tabs
          value={active}
          onChange={(_, v) => setActive(v)}
          sx={{
            '& .MuiTab-root': {
              textTransform: 'none', fontWeight: 500, fontSize: '0.9rem',
              color: '#64748b', minHeight: 44, pb: 1.5,
            },
            '& .Mui-selected':       { color: '#2563eb !important', fontWeight: 600 },
            '& .MuiTabs-indicator':  { bgcolor: '#2563eb', height: 2 },
          }}
        >
          {DATASETS.map(d => (
            <Tab
              key={d.lang}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                  <span>{d.flag}</span>
                  <span>{d.label}</span>
                </Box>
              }
            />
          ))}
        </Tabs>
      </Box>

      {/* Tab content */}
      {DATASETS.map((d, i) => (
        <Box key={d.lang} hidden={active !== i}>
          {active === i && <DatasetTab lang={d.lang} meta={d} />}
        </Box>
      ))}
    </Box>
  )
}
