// Prefijos_service.js
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
  return localStorage.getItem('token') // <-- asegúrate de guardar el token ahí
}

/**
 * Obtiene el catálogo de prefijos desde la API.
 * Retorna siempre un array (filtra: activo===true y excluye id_prefijo==='NA').
 */
export async function getPrefijos({ page = 1, pageSize = 100 } = {}) {
  const token = getAuthToken()

  const { data } = await api.get('/prefijo', {
    params: { page, pageSize },
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })

  const list = Array.isArray(data?.data) ? data.data : []
  return list
    .filter(
      p => p?.activo === true && String(p?.id_prefijo).toUpperCase() !== 'NA'
    )
    .map(p => ({
      id_prefijo: p.id_prefijo,
      nombre: p.nombre,
      prefijo: p.prefijo, // ej: RS-CHS6-L
      tipo: p.tipo, // ej: BODEGA_GENERICO | RS_ESPECIFICO | RS_GENERICO
      orden: p.orden ?? 0,
    }))
}
