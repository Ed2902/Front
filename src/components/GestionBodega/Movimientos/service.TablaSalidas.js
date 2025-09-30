import axios from 'axios'

// Instancia base de Axios
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Función auxiliar para obtener el token
const getAuthToken = () => {
  return localStorage.getItem('token')
}

// 🔎 Utilidad: convertir ruta_pdf a URL absoluta
const buildPdfUrl = ruta_pdf => {
  if (!ruta_pdf) return null
  if (/^https?:\/\//i.test(ruta_pdf)) return ruta_pdf
  return `${import.meta.env.VITE_API_URL}/${ruta_pdf.replace(/^\/+/, '')}`
}

// 🔎 Agrupar productos sumando cantidades
const aggregateProductos = (items = []) => {
  const map = new Map()
  for (const it of items) {
    const id = it.id_producto ?? String(it.id_producto || '')
    const nombre = it.producto_nombre ?? id
    const cantidad = Number(it.cantidad) || 0

    if (!map.has(id)) {
      map.set(id, { id_producto: id, nombre, cantidad: 0 })
    }
    map.get(id).cantidad += cantidad
  }
  return Array.from(map.values())
}

// 🔎 Extraer lotes únicos
const extractLotes = (items = []) => {
  const set = new Set()
  for (const it of items) {
    if (it.id_lote) set.add(it.id_lote)
  }
  return Array.from(set)
}

// 🔎 Parsear payload seguro
const parsePayload = str => {
  try {
    if (!str) return { titulo: null, metadata: {}, items: [] }
    const parsed = JSON.parse(str)
    return {
      titulo: parsed.titulo ?? null,
      metadata: parsed.metadata ?? {},
      items: Array.isArray(parsed.items) ? parsed.items : [],
    }
  } catch {
    return { titulo: null, metadata: {}, items: [] }
  }
}

// 🔎 Transformar cada fila
const transformRow = row => {
  const { titulo, metadata, items } = parsePayload(row.payload)

  const fecha = row.created_at ? new Date(row.created_at) : null
  const fechaStr = fecha
    ? new Intl.DateTimeFormat('es-CO', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(fecha)
    : ''

  return {
    fecha_creacion: fechaStr,
    titulo: titulo || 'Documento de salida',
    comentario: metadata?.comentario ?? null,
    operacion: metadata?.operacion ?? null,
    usuario: metadata?.usuario ?? null,
    lotes: extractLotes(items),
    productos: aggregateProductos(items),
    pdf_url: buildPdfUrl(row.ruta_pdf),
  }
}

// 🚀 Obtener documentos de salida
export const getDocumentosSalida = async (limit = 20, offset = 0) => {
  const token = getAuthToken()
  const response = await api.get('/documentos-salida', {
    params: { limit, offset },
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const payload = response?.data || {}
  const total = Number(payload.total ?? 0)
  const rows = Array.isArray(payload.data) ? payload.data.map(transformRow) : []

  return {
    total,
    limit: Number(payload.limit ?? limit),
    offset: Number(payload.offset ?? offset),
    rows,
  }
}
