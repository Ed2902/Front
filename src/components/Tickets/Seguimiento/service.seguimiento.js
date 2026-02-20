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

// ✅ AREAS
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

// ✅ PERSONAL (otro server)
export const listarPersonal = async token => {
  if (!API_URL) return []
  const { data } = await axios.get(`${API_URL}/personal`, {
    headers: buildHeaders(token),
  })
  return data
}

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

// ✅ BUNDLE: tickets + maps (personal/areas/teams)
export const fetchSeguimientoBundle = async (
  {
    id_personal,
    page = 1,
    limit = 20,
    activo = true,
    createdAt_desde,
    createdAt_hasta,
    sortBy = 'lastMoveAt',
    sortDir = 'desc',
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
    },
    token
  )

  const rows = pickItems(resTickets)

  const [resTeams, resAreas, resPersonal] = await Promise.all([
    listarTeams({ page: 1, limit: 200 }, token),
    listarAreas({ page: 1, limit: 200 }, token),
    listarPersonal(token),
  ])

  const teams = pickItems(resTeams)
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
    teamsMap: Object.fromEntries((teams || []).map(x => [x._id, x])),
    areasMap: Object.fromEntries((areas || []).map(x => [x._id, x])),
    personalMap,
  }

  return {
    ok: true,
    rows,
    maps,
    meta: resTickets?.meta || null,
  }
}
