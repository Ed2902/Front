import axios from 'axios'

// Configuración global de Axios
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL, // URL base desde .env
  headers: {
    'Content-Type': 'application/json', // Tipo de contenido de las solicitudes
  },
})

// Interceptor para agregar el token de autenticación en cada solicitud
api.interceptors.request.use(
  config => {
    // Obtener el token del localStorage
    const token = localStorage.getItem('token')

    // Si el token está presente, agregarlo en los headers de la solicitud
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`
    }

    return config
  },
  error => Promise.reject(error)
)

// Función para verificar si el token sigue siendo válido (opcional, según tu lógica de backend)
export const isTokenValid = () => {
  const token = localStorage.getItem('token')

  // Lógica para verificar si el token sigue siendo válido (puedes adaptarlo según tu backend)
  if (!token) {
    return false
  }

  // Si el token está presente, podrías añadir lógica aquí para validar su expiración
  // Por ejemplo, si el token tiene un campo 'exp' o algo similar:
  // const decodedToken = jwt_decode(token);
  // const expirationTime = decodedToken.exp * 1000;  // Convertir a milisegundos
  // if (Date.now() > expirationTime) {
  //   return false;
  // }

  return true // Si el token es válido
}

// Función para eliminar el token cuando el usuario cierre sesión
export const logout = () => {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
}

// Exportar la instancia de Axios y las funciones adicionales
export default api
