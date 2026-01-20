// src/modules/CrearTicket/service.CrearTicket.js
import axios from 'axios'

const API_URL_5 = import.meta.env.VITE_API_URL_5

const buildHeaders = (token, isFormData = false) => {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (!isFormData) headers['Content-Type'] = 'application/json'
  return headers
}

const pickItems = res => {
  if (!res) return []
  if (Array.isArray(res.items)) return res.items
  if (Array.isArray(res.data)) return res.data
  if (Array.isArray(res.rows)) return res.rows
  if (Array.isArray(res.results)) return res.results
  if (Array.isArray(res)) return res
  return []
}

// ======================================================
// GET /tickets/mine
// ======================================================
export const listarTicketsMine = async (
  {
    id_personal,
    scope = 'created',
    page = 1,
    limit = 100,
    sortBy = 'createdAt',
    sortDir = 'desc',
  } = {},
  token
) => {
  const params = { id_personal, scope, page, limit, sortBy, sortDir }
  const { data } = await axios.get(`${API_URL_5}/tickets/mine`, {
    headers: buildHeaders(token),
    params,
  })
  return data
}

export const listarMisCreaciones = async (
  {
    id_personal,
    page = 1,
    limit = 100,
    sortBy = 'createdAt',
    sortDir = 'desc',
  } = {},
  token
) =>
  listarTicketsMine(
    { id_personal, scope: 'created', page, limit, sortBy, sortDir },
    token
  )

// ======================================================
// CATÁLOGO
// ======================================================
export const listarCatalogo = async (
  { orgId, type, page = 1, limit = 100, active = true } = {},
  token
) => {
  const params = { orgId, type, page, limit }
  if (active !== undefined) params.active = active
  const { data } = await axios.get(`${API_URL_5}/catalog`, {
    headers: buildHeaders(token),
    params,
  })
  return data
}

export const listarEstados = async (orgId, token) =>
  listarCatalogo(
    { orgId, type: 'estado', page: 1, limit: 100, active: true },
    token
  )

export const listarPrioridades = async (orgId, token) =>
  listarCatalogo(
    { orgId, type: 'prioridad', page: 1, limit: 100, active: true },
    token
  )

export const listarCategorias = async (orgId, token) =>
  listarCatalogo(
    { orgId, type: 'categoria', page: 1, limit: 100, active: true },
    token
  )

// ======================================================
// TEAMS / AREAS
// ======================================================
export const listarTeams = async (
  { page = 1, limit = 100, search, activo = true } = {},
  token
) => {
  const params = { page, limit }
  if (search) params.search = search
  if (activo !== undefined) params.activo = activo
  const { data } = await axios.get(`${API_URL_5}/teams`, {
    headers: buildHeaders(token),
    params,
  })
  return data
}

export const listarAreas = async (
  { page = 1, limit = 100, search, activo = true } = {},
  token
) => {
  const params = { page, limit }
  if (search) params.search = search
  if (activo !== undefined) params.activo = activo
  const { data } = await axios.get(`${API_URL_5}/areas`, {
    headers: buildHeaders(token),
    params,
  })
  return data
}

// ======================================================
// ✅ POST /tickets (multipart/form-data)
// - Soporta: todos los tipos + asignación + operación + adjuntos múltiples
// - Keys compatibles con tu validator:
//   asignado_a[tipo], asignado_a[id], watchers[], operacion[subtipo], etc.
// ======================================================
export const crearTicket = async (
  {
    orgId,
    tipo, // tarea | proyecto | operacion
    titulo,
    descripcion,
    categoria_id,
    prioridad_id,
    estado_id,

    creado_por,

    // asignación
    asignado_tipo, // personal | area | team
    asignado_id, // id_personal o ObjectId

    // opcionales
    watchers = [], // array id_personal
    fecha_estimada, // 'YYYY-MM-DD' o ISO string
    nota_estado,

    // operacion (si tipo=operacion)
    operacion_subtipo, // comercio | bodega
    operacion_cliente,
    operacion_lote,
    operacion_producto,
    operacion_apoyo_ids = [], // array id_personal
    operacion_servicios_adicionales = [], // array strings

    // archivos
    files = [], // File[]
  } = {},
  token
) => {
  const fd = new FormData()

  // required
  fd.append('orgId', orgId ?? '')
  fd.append('tipo', tipo ?? '')
  fd.append('titulo', titulo ?? '')
  fd.append('descripcion', descripcion ?? '')
  fd.append('categoria_id', categoria_id ?? '')
  fd.append('prioridad_id', prioridad_id ?? '')
  fd.append('estado_id', estado_id ?? '')
  fd.append('creado_por', creado_por ?? '')

  // asignado_a bracket keys
  fd.append('asignado_a[tipo]', asignado_tipo ?? '')
  fd.append('asignado_a[id]', asignado_id ?? '')

  // opcionales
  if (fecha_estimada) fd.append('fecha_estimada', fecha_estimada)
  if (nota_estado) fd.append('nota_estado', nota_estado)
  ;(watchers || []).forEach(x => {
    if (x) fd.append('watchers[]', String(x))
  })

  // operacion
  if (tipo === 'operacion') {
    fd.append('operacion[subtipo]', operacion_subtipo ?? '')
    fd.append('operacion[cliente]', operacion_cliente ?? '')
    if (operacion_lote) fd.append('operacion[lote]', operacion_lote)
    if (operacion_producto) fd.append('operacion[producto]', operacion_producto)
    ;(operacion_apoyo_ids || []).forEach(x => {
      if (x) fd.append('operacion[apoyo_ids][]', String(x))
    })
    ;(operacion_servicios_adicionales || []).forEach(x => {
      if (x) fd.append('operacion[servicios_adicionales][]', String(x))
    })
  }

  // Archivos (multer uploadAny.any() captura cualquier key)
  ;(files || []).forEach(file => {
    if (file instanceof File) fd.append('files', file)
  })

  const { data } = await axios.post(`${API_URL_5}/tickets`, fd, {
    headers: buildHeaders(token, true),
  })

  return data
}

// ======================================================
// ✅ BUNDLE PARA TABLA (maps por _id)
// ======================================================
export const fetchMisCreacionesBundle = async (
  { id_personal, page = 1, limit = 100 } = {},
  token
) => {
  const resTickets = await listarMisCreaciones(
    { id_personal, page, limit },
    token
  )
  const rows = pickItems(resTickets)

  const orgId = rows?.[0]?.orgId || ''

  const [resTeams, resAreas] = await Promise.all([
    listarTeams({ page: 1, limit: 100 }, token),
    listarAreas({ page: 1, limit: 100 }, token),
  ])

  const teams = pickItems(resTeams)
  const areas = pickItems(resAreas)

  let estados = []
  let prioridades = []
  let categorias = []

  if (orgId) {
    const [resE, resP, resC] = await Promise.all([
      listarEstados(orgId, token),
      listarPrioridades(orgId, token),
      listarCategorias(orgId, token),
    ])
    estados = pickItems(resE)
    prioridades = pickItems(resP)
    categorias = pickItems(resC)
  }

  const maps = {
    estadosMap: Object.fromEntries((estados || []).map(x => [x._id, x])),
    prioridadesMap: Object.fromEntries(
      (prioridades || []).map(x => [x._id, x])
    ),
    categoriasMap: Object.fromEntries((categorias || []).map(x => [x._id, x])),
    teamsMap: Object.fromEntries((teams || []).map(x => [x._id, x])),
    areasMap: Object.fromEntries((areas || []).map(x => [x._id, x])),
  }

  return {
    ok: true,
    rows,
    maps,
    meta: resTickets?.meta || null,
    orgId,
  }
}
