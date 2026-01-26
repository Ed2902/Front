import axios from 'axios'

const API_URL_5 = import.meta.env.VITE_API_URL_5 // /tikets/...
const API_URL = import.meta.env.VITE_API_URL // /personal  (y ahora también /cliente, /inventario)

// ---------------------------
// Utils
// ---------------------------
const buildHeaders = (token, isFormData = false) => {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (!isFormData) headers['Content-Type'] = 'application/json'
  return headers
}

const clampLimit = (limit, max = 100, fallback = 20) => {
  const n = Number(limit)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.min(n, max)
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

const norm = s =>
  String(s ?? '')
    .trim()
    .toLowerCase()

const safeGet = async (url, config) => {
  try {
    const res = await axios.get(url, config)
    return { ok: true, data: res.data }
  } catch (e) {
    return {
      ok: false,
      error: e?.response?.data || e?.message || 'Request error',
    }
  }
}

// =============================
// CATÁLOGO  /tikets/catalog
// =============================
export const fetchCatalog = async (
  { orgId, type, page = 1, limit = 100, active = true } = {},
  token
) => {
  const safeLimit = clampLimit(limit, 100, 100)
  const params = { orgId, type, page, limit: safeLimit }
  if (active !== undefined) params.active = active

  const { data } = await axios.get(`${API_URL_5}/catalog`, {
    headers: buildHeaders(token),
    params,
  })
  return data
}

export const fetchCategorias = (orgId, token, { page = 1, limit = 100 } = {}) =>
  fetchCatalog({ orgId, type: 'categoria', page, limit, active: true }, token)

export const fetchPrioridades = (
  orgId,
  token,
  { page = 1, limit = 100 } = {}
) =>
  fetchCatalog({ orgId, type: 'prioridad', page, limit, active: true }, token)

export const fetchEstados = (orgId, token, { page = 1, limit = 100 } = {}) =>
  fetchCatalog({ orgId, type: 'estado', page, limit, active: true }, token)

export const fetchEstadoNuevoId = async (orgId, token) => {
  const res = await fetchEstados(orgId, token, { page: 1, limit: 100 })
  const items = pickItems(res)
  const found = items.find(x => norm(x?.name ?? x?.nombre) === 'nuevo')
  return found?._id || ''
}

// =============================
// PERSONAL  /personal
// =============================
export const fetchPersonal = async (
  { page = 1, limit = 100, search } = {},
  token
) => {
  const safeLimit = clampLimit(limit, 100, 50)
  const params = { page, limit: safeLimit }
  if (search) params.search = search

  const { data } = await axios.get(`${API_URL}/personal`, {
    headers: buildHeaders(token),
    params,
  })
  return data
}

// =============================
// CLIENTES  /cliente
// =============================
export const fetchClientes = async (
  { page = 1, limit = 200, search, activo = true } = {},
  token
) => {
  const safeLimit = clampLimit(limit, 500, 200)
  const params = { page, limit: safeLimit }
  if (search) params.search = search
  if (activo !== undefined) params.activo = activo

  const { data } = await axios.get(`${API_URL}/cliente`, {
    headers: buildHeaders(token),
    params,
  })
  return data
}

// =============================
// INVENTARIO  /inventario/detalle/completo
// =============================
export const fetchInventarioDetalleCompleto = async token => {
  const { data } = await axios.get(`${API_URL}/inventario/detalle/completo`, {
    headers: buildHeaders(token),
  })
  return data
}

// =============================
// AREAS / TEAMS
// =============================
export const fetchAreas = async (
  { page = 1, limit = 100, search } = {},
  token
) => {
  const safeLimit = clampLimit(limit, 100, 50)
  const params = { page, limit: safeLimit }
  if (search) params.search = search

  const { data } = await axios.get(`${API_URL_5}/areas`, {
    headers: buildHeaders(token),
    params,
  })
  return data
}

export const fetchTeams = async (
  { page = 1, limit = 100, search } = {},
  token
) => {
  const safeLimit = clampLimit(limit, 100, 50)
  const params = { page, limit: safeLimit }
  if (search) params.search = search

  const { data } = await axios.get(`${API_URL_5}/teams`, {
    headers: buildHeaders(token),
    params,
  })
  return data
}

// =============================
// LISTADOS (bundles)
// =============================
export const fetchMisCreacionesBundle = async (
  {
    page = 1,
    limit = 20,
    sortBy = 'updatedAt',
    sortDir = 'desc',
    activo = true,
    search,
    orgId,
    tipo,
    estado_id,
    prioridad_id,
    categoria_id,
  } = {},
  token
) => {
  const safeLimit = clampLimit(limit, 100, 20)
  const params = {
    page,
    limit: safeLimit,
    sortBy,
    sortDir,
    activo,
    ...(search ? { search } : {}),
    ...(orgId ? { orgId } : {}),
    ...(tipo ? { tipo } : {}),
    ...(estado_id ? { estado_id } : {}),
    ...(prioridad_id ? { prioridad_id } : {}),
    ...(categoria_id ? { categoria_id } : {}),
  }

  const headers = buildHeaders(token)

  const list = await safeGet(`${API_URL_5}/tickets/mine`, {
    headers,
    params,
  })
  const count = await safeGet(`${API_URL_5}/tickets/count`, {
    headers,
    params,
  })

  const items = pickItems(list.ok ? list.data : null)
  const total =
    (count.ok
      ? (count.data?.total ??
        count.data?.count ??
        count.data?.data?.total ??
        count.data?.data?.count)
      : null) ?? null

  return { items, total, error: list.ok ? null : list.error }
}

export const fetchMisAsignadosBundle = async (
  {
    id_personal,
    page = 1,
    limit = 20,
    sortBy = 'updatedAt',
    sortDir = 'desc',
    activo = true,
    search,
    orgId,
    tipo,
    estado_id,
    prioridad_id,
    categoria_id,
  } = {},
  token
) => {
  const safeLimit = clampLimit(limit, 100, 20)
  const params = {
    page,
    limit: safeLimit,
    sortBy,
    sortDir,
    activo,
    ...(id_personal ? { id_personal } : {}),
    ...(search ? { search } : {}),
    ...(orgId ? { orgId } : {}),
    ...(tipo ? { tipo } : {}),
    ...(estado_id ? { estado_id } : {}),
    ...(prioridad_id ? { prioridad_id } : {}),
    ...(categoria_id ? { categoria_id } : {}),
  }

  const headers = buildHeaders(token)

  const list = await safeGet(`${API_URL_5}/assigned`, {
    headers,
    params,
  })
  const count = await safeGet(`${API_URL_5}/count`, {
    headers,
    params,
  })

  const items = pickItems(list.ok ? list.data : null)
  const total =
    (count.ok
      ? (count.data?.total ??
        count.data?.count ??
        count.data?.data?.total ??
        count.data?.data?.count)
      : null) ?? null

  return { items, total, error: list.ok ? null : list.error }
}

// =============================
// CREATE TICKET  POST /tikets/tickets
// =============================
export const createTicket = async (
  {
    orgId,
    tipo = 'tarea',
    titulo,
    descripcion,
    categoria_id,
    prioridad_id,
    estado_id,
    creado_por,
    asignado_tipo = 'personal',
    asignado_id,
    fecha_estimada,
    nota_estado,
    watchers = [],
    files = [],

    // operación (solo IDs)
    subtipo, // comercio | bodega
    id_cliente,
    id_lote,
    id_producto,
  } = {},
  token
) => {
  const fd = new FormData()

  fd.append('orgId', orgId ?? '')
  fd.append('tipo', tipo ?? 'tarea')
  fd.append('titulo', titulo ?? '')
  fd.append('descripcion', descripcion ?? '')
  fd.append('categoria_id', categoria_id ?? '')
  fd.append('prioridad_id', prioridad_id ?? '')
  fd.append('estado_id', estado_id ?? '')
  fd.append('creado_por', creado_por ?? '')

  fd.append('asignado_a[tipo]', asignado_tipo ?? 'personal')
  fd.append('asignado_a[id]', asignado_id ?? '')

  if (fecha_estimada) fd.append('fecha_estimada', fecha_estimada)
  if (nota_estado) fd.append('nota_estado', nota_estado)
  ;(watchers || []).forEach(x => x && fd.append('watchers[]', String(x)))
  ;(files || []).forEach(
    file => file instanceof File && fd.append('files', file)
  )

  // ✅ CORREGIDO: el backend valida operacion.cliente / operacion.lote / operacion.producto
  if ((tipo ?? 'tarea') === 'operacion') {
    if (subtipo) fd.append('operacion[subtipo]', String(subtipo))

    // enviar IDs dentro de los campos que el backend espera
    if (id_cliente) fd.append('operacion[cliente]', String(id_cliente))
    if (id_lote) fd.append('operacion[lote]', String(id_lote))
    if (id_producto) fd.append('operacion[producto]', String(id_producto))

    // (opcional) mantenemos compat por si algún día lo usas
    // fd.append('operacion[id_cliente]', String(id_cliente))
    // fd.append('operacion[id_lote]', String(id_lote))
    // fd.append('operacion[id_producto]', String(id_producto))
  }

  const { data } = await axios.post(`${API_URL_5}/tickets`, fd, {
    headers: buildHeaders(token, true),
  })
  return data
}

// ======================================================
// ALIASES
// ======================================================
export const listarAreas = fetchAreas
export const listarTeams = fetchTeams
export const listarPersonal = fetchPersonal

export const listarCatalogo = fetchCatalog
export const listarCategorias = (orgId, token) =>
  fetchCategorias(orgId, token, { page: 1, limit: 100 })
export const listarPrioridades = (orgId, token) =>
  fetchPrioridades(orgId, token, { page: 1, limit: 100 })
export const listarEstados = (orgId, token) =>
  fetchEstados(orgId, token, { page: 1, limit: 100 })

export const obtenerEstadoNuevoId = fetchEstadoNuevoId
export const crearTicket = createTicket

export const listarClientes = fetchClientes
export const listarInventarioDetalleCompleto = fetchInventarioDetalleCompleto
