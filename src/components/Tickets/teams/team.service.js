import axios from 'axios'

const API_URL_5 = import.meta.env.VITE_API_URL_5
const API_URL = import.meta.env.VITE_API_URL // /personal

const headers = token => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
})

// ===== TEAMS =====
export async function listTeams({ page = 1, limit = 10 } = {}, token) {
  const { data } = await axios.get(`${API_URL_5}/teams`, {
    headers: headers(token),
    params: { page, limit },
  })
  return data
}

export async function getTeamById(id, token) {
  const { data } = await axios.get(`${API_URL_5}/teams/${id}`, {
    headers: headers(token),
  })
  return data
}

export async function createTeam(payload, token) {
  // POST /teams  (requiere id_personal y lider_id_personal)
  const { data } = await axios.post(`${API_URL_5}/teams`, payload, {
    headers: headers(token),
  })
  return data
}

export async function updateTeam(id, payload, token) {
  const { data } = await axios.put(`${API_URL_5}/teams/${id}`, payload, {
    headers: headers(token),
  })
  return data
}

export async function deactivateTeam(id, token) {
  const { data } = await axios.patch(
    `${API_URL_5}/teams/${id}/deactivate`,
    {},
    { headers: headers(token) }
  )
  return data
}

// ===== PERSONAL =====
export async function getPersonal(token) {
  const { data } = await axios.get(`${API_URL}/personal`, {
    headers: headers(token),
  })
  return data
}
