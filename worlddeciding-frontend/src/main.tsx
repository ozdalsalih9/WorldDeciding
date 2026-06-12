import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import './civic-orbit.css'
import AppProviders from '@/app/providers'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <AppProviders>
    <App />
  </AppProviders>
)
