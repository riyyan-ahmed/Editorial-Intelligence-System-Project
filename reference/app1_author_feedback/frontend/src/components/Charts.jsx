import React from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area, CartesianGrid,
} from 'recharts'
import { Box } from '@mui/material'

const BLUE = '#2563eb'

const PALETTE = [
  '#2563eb', '#7c3aed', '#0891b2', '#059669',
  '#d97706', '#dc2626', '#db2777', '#65a30d',
]

export function TopAuthorsChart({ data }) {
  if (!data?.length) return null
  const display = [...data].reverse()
  const shorten = (n = '') => n.length > 22 ? n.slice(0, 21) + '…' : n

  return (
    <Box sx={{ mt: 1.5 }}>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={display.map(d => ({ ...d, _name: shorten(d.author_name) }))} layout="vertical" margin={{ left: 8, right: 32, top: 4, bottom: 4 }}>
          <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
          <YAxis type="category" dataKey="_name" width={135} tick={{ fontSize: 11, fill: '#475569' }} />
          <Tooltip
            formatter={(v, _, { payload }) => [`${v.toLocaleString()} articles  ·  avg ${payload.avg_word_count} words`, payload.author_name]}
            contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #e2e8f0' }}
          />
          <Bar dataKey="article_count" radius={[0, 4, 4, 0]}>
            {display.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Box>
  )
}

export function WordDistChart({ data }) {
  if (!data?.length) return null
  return (
    <Box sx={{ mt: 1.5 }}>
      <ResponsiveContainer width="100%" height={130}>
        <BarChart data={data} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
          <XAxis dataKey="range" tick={{ fontSize: 10, fill: '#94a3b8' }} />
          <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} width={36} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
          <Tooltip formatter={(v) => [v.toLocaleString(), 'Articles']} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
          <Bar dataKey="count" radius={[3, 3, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Box>
  )
}

export function PublisherChart({ data }) {
  if (!data?.length) return null
  return (
    <Box sx={{ mt: 1.5 }}>
      <ResponsiveContainer width="100%" height={120}>
        <PieChart>
          <Pie data={data} dataKey="article_count" nameKey="publisher_id" cx="50%" cy="50%" innerRadius={26} outerRadius={48} paddingAngle={2}>
            {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
          </Pie>
          <Tooltip formatter={(v, name) => [v.toLocaleString(), name]} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
          <Legend iconSize={9} wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </Box>
  )
}

export function YearlyChart({ data }) {
  if (!data?.length) return null
  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart data={data} margin={{ left: 0, right: 20, top: 10, bottom: 0 }}>
        <defs>
          <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={BLUE} stopOpacity={0.25} />
            <stop offset="95%" stopColor={BLUE} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#94a3b8' }} />
        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
        <Tooltip formatter={(v) => [v.toLocaleString(), 'Articles']} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
        <Area type="monotone" dataKey="count" stroke={BLUE} strokeWidth={2} fill="url(#blueGrad)" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
