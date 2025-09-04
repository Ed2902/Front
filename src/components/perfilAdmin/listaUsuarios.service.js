// src/services/perfilAdmin/listaUsuarios.service.js
import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
})

const getAuthToken = () => localStorage.getItem('token')

// Obtener lista de usuarios
export const obtenerUsuarios = async () => {
  const token = getAuthToken()
  const response = await api.get('/usuario', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

// Actualizar permisos de un usuario (por id_usuario)
export const actualizarPermisosUsuario = async (id_usuario, permisos) => {
  const token = getAuthToken()
  const response = await api.put(
    `/usuario/${id_usuario}/permisos`,
    { permisos }, // ✅ formato correcto
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  )
  return response.data
}
