// =================== TRAMPA DE DEPURACIÓN JSON.parse ===================
// ⚠️ Temporal. Quita este bloque cuando termines de depurar.
;(function () {
  // Evita re-instalar la trampa más de una vez (útil en HMR/preview)
  if (typeof window !== 'undefined' && window.__JSON_PARSE_TRAP_INSTALLED__)
    return
  try {
    const origParse = JSON.parse
    JSON.parse = function (input, ...rest) {
      if (
        input === undefined ||
        input === 'undefined' ||
        input === null ||
        input === ''
      ) {
        const err = new Error('[TRAP] JSON.parse con valor inválido')
        // Con sourcemaps habilitados en vite.config.js, este stack te llevará a src/...
        console.error(
          '[TRAP] JSON.parse recibió:',
          input,
          '\nStack:\n',
          err.stack
        )
        // Para que la app no se caiga mientras depuras:
        return null
      }
      return origParse.call(this, input, ...rest)
    }
    if (typeof window !== 'undefined') {
      window.__JSON_PARSE_TRAP_INSTALLED__ = true
    }
  } catch (e) {
    console.warn('[TRAP] No se pudo instalar la trampa de JSON.parse:', e)
  }
})()
// =================== FIN TRAMPA DE DEPURACIÓN ===================

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'

import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
