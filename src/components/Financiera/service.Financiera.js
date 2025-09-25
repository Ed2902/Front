// src/services/service.Financiera.js
import axios from 'axios'

// Instancia base de Axios
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Token
const getAuthToken = () => localStorage.getItem('token')

// Helper: construir URL absoluta de archivo usando SOLO la variable de entorno
const makeFileUrl = path => {
  if (!path) return null
  const base = String(import.meta.env.VITE_API_URL || '').replace(/\/+$/, '') // sin trailing /
  const rel = String(path).replace(/^\/+/, '') // sin leading /
  return `${base}/${rel}`
}

const normalizeLote = l => ({
  ...l,
  pdf_generado_url: makeFileUrl(l?.pdf_generado),
  cuenta_cobro_url: makeFileUrl(l?.cuenta_cobro),
  soporte_pago_url: makeFileUrl(l?.soporte_pago),
})

// Extraer número del Id_lote (ej: GEN_006 -> 6, FW_001 -> 1)
const extractLoteNumber = (id = '') => {
  const m = String(id).match(/(\d+)(?!.*\d)/)
  return m ? Number(m[1]) : -Infinity
}

// Orden: Id_lote desc; si empata, aceptacion_fecha desc
const sortLotesDesc = (a, b) => {
  const na = extractLoteNumber(a?.Id_lote)
  const nb = extractLoteNumber(b?.Id_lote)
  if (nb !== na) return nb - na
  const fa = a?.aceptacion_fecha ? new Date(a.aceptacion_fecha).getTime() : 0
  const fb = b?.aceptacion_fecha ? new Date(b.aceptacion_fecha).getTime() : 0
  return fb - fa
}

// -----------------------------
// LOTE (para cabecera financiera)
// -----------------------------

// ✅ GET /lote - obtener lotes (ordenados desc) y normalizar URLs de archivos
export const getLotesFinancieros = async () => {
  const token = getAuthToken()
  const { data } = await api.get('/lote', {
    headers: { Authorization: `Bearer ${token}` },
  })

  const list = Array.isArray(data) ? data : []
  return list.map(normalizeLote).sort(sortLotesDesc)
}

// (opcional) GET /lote/:id – útil para refrescar una fila luego de subir docs
export const getLoteByIdFinanciero = async idLote => {
  const token = getAuthToken()
  const { data } = await api.get(`/lote/${encodeURIComponent(idLote)}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return normalizeLote(data)
}

// -----------------------------
// LOTE PRODUCTO (detalle por lote)
// -----------------------------

// ✅ GET /lote-producto - obtener todos
export const getLoteProductos = async () => {
  const token = getAuthToken()
  const { data } = await api.get('/lote-producto', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return (Array.isArray(data) ? data : []).map(p => ({
    ...p,
    ProveedorNombre: p?.Proveedor?.Nombre ?? null,
  }))
}

// ✅ GET /lote-producto (filtrado en cliente por id_lote)
export const getLoteProductosByLote = async idLote => {
  const all = await getLoteProductos()
  return all.filter(p => p.id_lote === idLote)
}

// -----------------------------
// Subidas de archivos (docs del lote)
// -----------------------------

// POST /lote/:id/docs — puede enviar uno o ambos campos
export const uploadDocsLote = async (idLote, { cuentaFile, soporteFile }) => {
  const token = localStorage.getItem('token')
  const form = new FormData()
  if (cuentaFile) form.append('cuenta_cobro', cuentaFile)
  if (soporteFile) form.append('soporte_pago', soporteFile)

  const { data } = await api.post(
    `/lote/${encodeURIComponent(idLote)}/docs`,
    form,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        // 👇 MUY IMPORTANTE: forzar multipart para que no quede application/json de la instancia
        'Content-Type': 'multipart/form-data',
      },
    }
  )

  // El backend responde { message, lote }
  return normalizeLote(data?.lote || {})
}

export const uploadCuentaCobro = async (idLote, file) =>
  uploadDocsLote(idLote, { cuentaFile: file })

export const uploadSoportePago = async (idLote, file) =>
  uploadDocsLote(idLote, { soporteFile: file })
