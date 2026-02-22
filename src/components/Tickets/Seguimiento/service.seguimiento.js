// src/components/Tickets/Seguimiento/service.seguimiento.js
import axios from 'axios'

const API_URL_5 = import.meta.env.VITE_API_URL_5 // http://localhost:4000/tikets
const API_URL = import.meta.env.VITE_API_URL // ✅ OTRO SERVER (personal)

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

// ✅ TEAMS
export const listarTeams = async (
  { page = 1, limit = 100, search, activo } = {},
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

// ✅ AREAS
export const listarAreas = async (
  { page = 1, limit = 100, search, activo } = {},
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

// ✅ PERSONAL (otro server)
export const listarPersonal = async token => {
  if (!API_URL) return []
  const { data } = await axios.get(`${API_URL}/personal`, {
    headers: buildHeaders(token),
  })
  return data
}

export const listarCatalogo = async (
  { orgId, type, page = 1, limit = 100, active = true } = {},
  token
) => {
  const params = { orgId, type, page, limit }
  if (active !== undefined) params.active = active
  try {
    const { data } = await axios.get(`${API_URL_5}/catalog`, {
      headers: buildHeaders(token),
      params,
    })
    return data
  } catch (e) {
    const status = e?.response?.status
    if (status === 400 && Object.hasOwn(params, 'active')) {
      const retryParams = { ...params }
      delete retryParams.active
      const { data } = await axios.get(`${API_URL_5}/catalog`, {
        headers: buildHeaders(token),
        params: retryParams,
      })
      return data
    }
    throw e
  }
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

// ✅ Endpoint: /tickets/assigned
export const listarTicketsAssigned = async (
  {
    id_personal, // requerido por tu endpoint
    page = 1,
    limit = 20,
    activo = true,

    // rango por createdAt (según tu backend)
    createdAt_desde,
    createdAt_hasta,

    // sorting
    sortBy = 'lastMoveAt',
    sortDir = 'desc',

    // filtros opcionales que ya soporta tu buildFilters
    orgId,
    tipo,
    estado_id,
    estado_ids,
    exclude_estado_ids,
    prioridad_id,
    categoria_id,
    operacion_subtipo,
    fecha_estimada_desde,
    fecha_estimada_hasta,
    search,
  } = {},
  token
) => {
  if (!id_personal)
    throw new Error('listarTicketsAssigned: id_personal requerido')

  const params = {
    id_personal,
    page,
    limit,
    activo,
    sortBy,
    sortDir,
  }

  if (createdAt_desde) params.createdAt_desde = createdAt_desde
  if (createdAt_hasta) params.createdAt_hasta = createdAt_hasta

  if (orgId) params.orgId = orgId
  if (tipo) params.tipo = tipo
  if (estado_id) params.estado_id = estado_id
  if (estado_ids) params.estado_ids = estado_ids
  if (exclude_estado_ids) params.exclude_estado_ids = exclude_estado_ids
  if (prioridad_id) params.prioridad_id = prioridad_id
  if (categoria_id) params.categoria_id = categoria_id
  if (operacion_subtipo) params.operacion_subtipo = operacion_subtipo

  if (fecha_estimada_desde) params.fecha_estimada_desde = fecha_estimada_desde
  if (fecha_estimada_hasta) params.fecha_estimada_hasta = fecha_estimada_hasta

  if (search) params.search = search

  const { data } = await axios.get(`${API_URL_5}/tickets/assigned`, {
    headers: buildHeaders(token),
    params,
  })

  return data
}

export const putTicket = async (ticketId, payload, token) => {
  if (!ticketId) throw new Error('putTicket: ticketId requerido')
  const { data } = await axios.put(
    `${API_URL_5}/tickets/${ticketId}`,
    payload,
    {
      headers: buildHeaders(token),
    }
  )
  return data
}

export const deactivateTicket = async (ticketId, { id_personal }, token) => {
  if (!ticketId) throw new Error('deactivateTicket: ticketId requerido')
  const { data } = await axios.patch(
    `${API_URL_5}/tickets/${ticketId}/deactivate`,
    { id_personal },
    { headers: buildHeaders(token) }
  )
  return data
}

// ✅ BUNDLE: tickets + maps (personal/areas/teams)
export const fetchSeguimientoBundle = async (
  {
    id_personal,
    page = 1,
    limit = 100,
    activo = true,
    createdAt_desde,
    createdAt_hasta,
    sortBy = 'lastMoveAt',
    sortDir = 'desc',
    orgId,
    tipo,
    estado_id,
    estado_ids,
    exclude_estado_ids,
    prioridad_id,
    categoria_id,
    operacion_subtipo,
    fecha_estimada_desde,
    fecha_estimada_hasta,
    search,
  } = {},
  token
) => {
  const resTickets = await listarTicketsAssigned(
    {
      id_personal,
      page,
      limit,
      activo,
      createdAt_desde,
      createdAt_hasta,
      sortBy,
      sortDir,
      orgId,
      tipo,
      estado_id,
      estado_ids,
      exclude_estado_ids,
      prioridad_id,
      categoria_id,
      operacion_subtipo,
      fecha_estimada_desde,
      fecha_estimada_hasta,
      search,
    },
    token
  )

  const rows = pickItems(resTickets)
  const effectiveOrgId = orgId || rows?.[0]?.orgId || ''

  const [areasResult, personalResult] = await Promise.allSettled([
    listarAreas({ page: 1, limit: 200 }, token),
    listarPersonal(token),
  ])

  const resAreas = areasResult.status === 'fulfilled' ? areasResult.value : []
  const resPersonal =
    personalResult.status === 'fulfilled' ? personalResult.value : []

  const areas = pickItems(resAreas)
  const personal = Array.isArray(resPersonal)
    ? resPersonal
    : pickItems(resPersonal)

  const personalMap = Object.fromEntries(
    (personal || [])
      .filter(p => p && p.Id_personal !== undefined && p.Id_personal !== null)
      .map(p => [String(p.Id_personal), p])
  )

  const maps = {
    estadosMap: {},
    prioridadesMap: {},
    categoriasMap: {},
    teamsMap: {},
    areasMap: Object.fromEntries((areas || []).map(x => [x._id, x])),
    personalMap,
  }

  if (effectiveOrgId) {
    const [resE, resP, resC] = await Promise.all([
      listarEstados(effectiveOrgId, token),
      listarPrioridades(effectiveOrgId, token),
      listarCategorias(effectiveOrgId, token),
    ])

    const estados = pickItems(resE)
    const prioridades = pickItems(resP)
    const categorias = pickItems(resC)

    maps.estadosMap = Object.fromEntries((estados || []).map(x => [x._id, x]))
    maps.prioridadesMap = Object.fromEntries(
      (prioridades || []).map(x => [x._id, x])
    )
    maps.categoriasMap = Object.fromEntries(
      (categorias || []).map(x => [x._id, x])
    )
  }

  return {
    ok: true,
    rows,
    maps,
    meta: resTickets?.meta || null,
    orgId: effectiveOrgId,
  }
}
