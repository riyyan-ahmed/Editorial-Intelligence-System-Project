import { createTheme } from '@mui/material'

const theme = createTheme({
  palette: {
    primary:    { main: '#2563eb', light: '#3b82f6', dark: '#1d4ed8' },
    secondary:  { main: '#0ea5e9' },
    background: { default: '#f8fafc', paper: '#ffffff' },
    text:       { primary: '#0f172a', secondary: '#64748b' },
    success:    { main: '#10b981' },
  },
  typography: {
    fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
    h1: { fontWeight: 800 },
    h2: { fontWeight: 700 },
    h3: { fontWeight: 700 },
    h4: { fontWeight: 700 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
  },
  shape:      { borderRadius: 10 },
  components: {
    MuiButton: {
      styleOverrides: {
        root:          { textTransform: 'none', fontWeight: 600 },
        containedPrimary: { boxShadow: '0 1px 3px rgba(37,99,235,0.3)' },
      },
    },
    MuiPaper: {
      styleOverrides: { root: { boxShadow: '0 1px 8px rgba(0,0,0,0.07)' } },
    },
  },
})

export default theme
