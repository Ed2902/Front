import axios from 'axios'

const API_URL_5 = import.meta.env.VITE_API_URL_5

const buildHeaders = token => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
})

export async function listCatalog(
  { orgId, type, page = 1, limit = 20, active, search } = {},
  token
) {
  const params = { orgId, type, page, limit }
  if (active !== undefined) params.active = active
  if (search) params.search = search

  const { data } = await axios.get(`${API_URL_5}/catalog`, {
    headers: buildHeaders(token),
    params,
  })
  return data
}

// ✅ NUEVO: trae múltiples org/type y retorna un solo array
export async function listCatalogAll(
  { orgIds = [], types = [], active, search, perQueryLimit = 100 } = {},
  token
) {
  const calls = []
  for (const orgId of orgIds) {
    for (const type of types) {
      calls.push(
        listCatalog(
          {
            orgId,
            type,
            page: 1,
            limit: perQueryLimit,
            active,
            search,
          },
          token
        ).then(res => ({
          orgId,
          type,
          items: Array.isArray(res?.items) ? res.items : [],
        }))
      )
    }
  }

  const results = await Promise.all(calls)
  const merged = results.flatMap(r =>
    (r.items || []).map(it => ({
      ...it,
      _orgId: r.orgId,
      _type: r.type,
    }))
  )

  // ordenar por updatedAt desc si existe
  merged.sort((a, b) => {
    const da = new Date(a.updatedAt || a.createdAt || 0).getTime()
    const db = new Date(b.updatedAt || b.createdAt || 0).getTime()
    return db - da
  })

  return merged
}

export async function createCatalog(payload, token) {
  const { data } = await axios.post(`${API_URL_5}/catalog`, payload, {
    headers: buildHeaders(token),
  })
  return data
}

export async function updateCatalog(id, orgId, payload, token) {
  const { data } = await axios.put(`${API_URL_5}/catalog/${id}`, payload, {
    headers: buildHeaders(token),
    params: { orgId },
  })
  return data
}

export async function deactivateCatalog(id, orgId, token) {
  const { data } = await axios.patch(
    `${API_URL_5}/catalog/${id}/deactivate`,
    {},
    { headers: buildHeaders(token), params: { orgId } }
  )
  return data
}
