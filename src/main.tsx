import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Hubot Sans with both weight and width axes, self-hosted (it isn't on Google Fonts).
import '@fontsource-variable/hubot-sans/wdth.css'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from './lib/theme'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
