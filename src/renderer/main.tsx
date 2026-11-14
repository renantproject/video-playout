import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import SecondaryWindow from './components/SecondaryWindow'
import './styles/index.css'

const isSecondary = window.location.search.includes('mode=secondary')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isSecondary ? <SecondaryWindow /> : <App />}
  </React.StrictMode>,
)

