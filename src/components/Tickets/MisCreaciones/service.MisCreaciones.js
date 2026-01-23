// src/components/Tickets/MisCreaciones/service.MisCreaciones.js
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

// ✅ CATÁLOGO (para filtros y maps)
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

// ✅ TEAMS / AREAS (para filtros y expanded)
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

// ✅ PERSONAL (desde OTRO SERVER) -> ideal para resolver Nombre + Apellido
export const listarPersonal = async token => {
  if (!API_URL) return []
  const { data } = await axios.get(`${API_URL}/personal`, {
    headers: buildHeaders(token),
  })
  return data
}

// ✅ Endpoint: /tickets/mine
export const listarTicketsMine = async (
  {
    id_personal,
    scope, // opcional (si luego lo usas)
    page = 1,
    limit = 100,
    sortBy = 'updatedAt',
    sortDir = 'desc',
  } = {},
  token
) => {
  const params = { id_personal, page, limit, sortBy, sortDir }
  if (scope) params.scope = scope
  const { data } = await axios.get(`${API_URL_5}/tickets/mine`, {
    headers: buildHeaders(token),
    params,
  })
  return data
}

// ✅ EDITAR (PUT /tickets/:id)
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

// ✅ ELIMINAR (soft delete) PATCH /tickets/:id/deactivate
export const deactivateTicket = async (ticketId, { id_personal }, token) => {
  if (!ticketId) throw new Error('deactivateTicket: ticketId requerido')
  const { data } = await axios.patch(
    `${API_URL_5}/tickets/${ticketId}/deactivate`,
    { id_personal },
    { headers: buildHeaders(token) }
  )
  return data
}

// ✅ BUNDLE PARA TABLA
export const fetchMisCreacionesBundle = async (
  { id_personal, page = 1, limit = 100, orgId = '' } = {},
  token
) => {
  const resTickets = await listarTicketsMine(
    { id_personal, page, limit, sortBy: 'updatedAt', sortDir: 'desc' },
    token
  )

  const rows = pickItems(resTickets)
  const effectiveOrgId = orgId || rows?.[0]?.orgId || ''

  const [resTeams, resAreas, resPersonal] = await Promise.all([
    listarTeams({ page: 1, limit: 100 }, token),
    listarAreas({ page: 1, limit: 100 }, token),
    listarPersonal(token),
  ])

  const teams = pickItems(resTeams)
  const areas = pickItems(resAreas)
  const personal = Array.isArray(resPersonal)
    ? resPersonal
    : pickItems(resPersonal)

  let estados = []
  let prioridades = []
  let categorias = []

  if (effectiveOrgId) {
    const [resE, resP, resC] = await Promise.all([
      listarEstados(effectiveOrgId, token),
      listarPrioridades(effectiveOrgId, token),
      listarCategorias(effectiveOrgId, token),
    ])
    estados = pickItems(resE)
    prioridades = pickItems(resP)
    categorias = pickItems(resC)
  }

  const personalMap = Object.fromEntries(
    (personal || [])
      .filter(p => p && p.Id_personal !== undefined && p.Id_personal !== null)
      .map(p => [String(p.Id_personal), p])
  )

  const maps = {
    estadosMap: Object.fromEntries((estados || []).map(x => [x._id, x])),
    prioridadesMap: Object.fromEntries(
      (prioridades || []).map(x => [x._id, x])
    ),
    categoriasMap: Object.fromEntries((categorias || []).map(x => [x._id, x])),
    teamsMap: Object.fromEntries((teams || []).map(x => [x._id, x])),
    areasMap: Object.fromEntries((areas || []).map(x => [x._id, x])),
    personalMap,
  }

  return {
    ok: true,
    rows,
    maps,
    meta: resTickets?.meta || null,
    orgId: effectiveOrgId,
  }
}
