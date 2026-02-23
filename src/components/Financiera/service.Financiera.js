// src/services/service.Financiera.js
import axios from 'axios'

const FIN_BASE_URL =
  import.meta.env.VITE_API_URL_4 ||
  import.meta.env.VITE_FINANCIERA_API_URL ||
  import.meta.env.VITE_API_URL

const WMS_API_BASE = String(import.meta.env.VITE_API_URL || '').replace(
  /\/+$/,
  ''
)
const WMS_FILES_BASE = WMS_API_BASE.replace(/\/api\/?$/i, '')

// Instancia base de Axios (WMS)
const apiWms = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Instancia para Financiera (si no existe env propio, usa VITE_API_URL)
const apiFinanciera = axios.create({
  baseURL: FIN_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Token
const getAuthToken = () => localStorage.getItem('token')

const financieraHasPrefix = () => {
  const base = String(FIN_BASE_URL || '')
  return /\/Financiera(\/|$)/i.test(base)
}

const finRoute = path => {
  const p = String(path || '')
  if (financieraHasPrefix()) return p
  return `/Financiera${p.startsWith('/') ? p : `/${p}`}`
}

// Helper: construir URL absoluta de archivo usando SOLO la variable de entorno
const makeFileUrl = path => {
  if (!path) return null
  const base = String(WMS_FILES_BASE || '').replace(/\/+$/, '')
  const rel = String(path).replace(/^\/+/, '') // sin leading /
  return `${base}/${rel}`
}

const makeFinancieraFileUrl = path => {
  if (!path) return null
  const base = String(FIN_BASE_URL || '').replace(/\/+$/, '')
  const rel = String(path).replace(/^\/+/, '')
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
  const { data } = await apiWms.get('/lote', {
    headers: { Authorization: `Bearer ${token}` },
  })

  const list = Array.isArray(data) ? data : []

  const lotes = list.map(normalizeLote).sort(sortLotesDesc)
  const ids = lotes.map(l => l?.Id_lote).filter(Boolean)

  if (!ids.length) return lotes

  try {
    const { data: finData } = await apiFinanciera.get(
      finRoute('/documentos-lote/resumen'),
      {
        headers: { Authorization: `Bearer ${token}` },
        params: { lotes: ids.join(',') },
      }
    )

    const resumen = finData?.data || {}

    return lotes.map(lote => {
      const docs = resumen?.[lote.Id_lote] || {}
      const cuentaRuta = docs?.cuenta_cobro?.ruta || null
      const soporteRuta = docs?.soporte_pago?.ruta || null

      return {
        ...lote,
        cuenta_cobro: cuentaRuta || lote.cuenta_cobro || null,
        soporte_pago: soporteRuta || lote.soporte_pago || null,
        cuenta_cobro_url:
          (cuentaRuta && makeFinancieraFileUrl(cuentaRuta)) ||
          lote.cuenta_cobro_url,
        soporte_pago_url:
          (soporteRuta && makeFinancieraFileUrl(soporteRuta)) ||
          lote.soporte_pago_url,
      }
    })
  } catch {
    return lotes
  }
}

// (opcional) GET /lote/:id – útil para refrescar una fila luego de subir docs
export const getLoteByIdFinanciero = async idLote => {
  const token = getAuthToken()
  const { data } = await apiWms.get(`/lote/${encodeURIComponent(idLote)}`, {
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
  const { data } = await apiWms.get('/lote-producto', {
    headers: { Authorization: `Bearer ${token}` },
  })

  let lotes = (Array.isArray(data) ? data : []).map(p => ({
    ...p,
    ProveedorNombre: p?.Proveedor?.Nombre ?? null,
  }))

  // Enriquecer con nombres de productos si no vienen incluidos
  lotes = await Promise.all(
    lotes.map(async p => {
      if (!p.Producto?.Nombre && p.id_producto) {
        try {
          const { data: producto } = await apiWms.get(
            `/producto/${encodeURIComponent(p.id_producto)}`,
            { headers: { Authorization: `Bearer ${token}` } }
          )
          return {
            ...p,
            Producto: { ...p.Producto, Nombre: producto.Nombre },
          }
        } catch (err) {
          console.warn(`No se pudo obtener producto ${p.id_producto}:`, err)
          return p
        }
      }
      return p
    })
  )

  return lotes
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

  const cuentaFiles = Array.isArray(cuentaFile)
    ? cuentaFile
    : cuentaFile
      ? [cuentaFile]
      : []
  const soporteFiles = Array.isArray(soporteFile)
    ? soporteFile
    : soporteFile
      ? [soporteFile]
      : []

  cuentaFiles.forEach(file => form.append('cuenta_cobro', file))
  soporteFiles.forEach(file => form.append('soporte_pago', file))

  const { data } = await apiFinanciera.post(
    finRoute(`/documentos-lote/${encodeURIComponent(idLote)}/upload`),
    form,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'multipart/form-data',
      },
    }
  )

  const resumen = data?.data || {}
  const cuentaRuta = resumen?.cuenta_cobro?.ruta || null
  const soporteRuta = resumen?.soporte_pago?.ruta || null

  return {
    Id_lote: idLote,
    cuenta_cobro: cuentaRuta,
    soporte_pago: soporteRuta,
    cuenta_cobro_url: makeFinancieraFileUrl(cuentaRuta),
    soporte_pago_url: makeFinancieraFileUrl(soporteRuta),
  }
}

export const uploadCuentaCobro = async (idLote, file) =>
  uploadDocsLote(idLote, { cuentaFile: file })

export const uploadSoportePago = async (idLote, file) =>
  uploadDocsLote(idLote, { soporteFile: file })

export const getDocumentosLote = async idLote => {
  const token = getAuthToken()
  const { data } = await apiFinanciera.get(
    finRoute(`/documentos-lote/${encodeURIComponent(idLote)}`),
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  )

  const docs = Array.isArray(data?.data) ? data.data : []
  return docs.map(d => ({
    ...d,
    url: makeFinancieraFileUrl(d?.ruta),
  }))
}
