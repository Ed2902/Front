// src/modules/CrearTicket/service.CrearTicket.js
import axios from 'axios'

const API_URL_5 = import.meta.env.VITE_API_URL_5 // http://localhost:4000/tikets

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

// GET /tickets/mine
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

// CATÁLOGO
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

// TEAMS / AREAS
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

// ✅ BUNDLE PARA TABLA (maps por _id)
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
