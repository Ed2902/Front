import axios from 'axios'

// Crear una instancia de axios con la URL base de la API
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL, // URL del backend, se toma de .env
  headers: {
    'Content-Type': 'application/json', // Aseguramos que el cuerpo de la solicitud sea JSON
  },
})

// Función para hacer login
export const login = async (username, password) => {
  try {
    // Enviar las credenciales al backend
    const response = await api.post('/auth/login', {
      username,
      password,
    })

    // En caso de login exitoso, el backend devuelve el token JWT
    return response.data // Esto debería contener el token y la información del usuario
  } catch (error) {
    // Si ocurre un error (por ejemplo, credenciales incorrectas), lo lanzamos
    throw new Error(
      error.response ? error.response.data.message : 'Error en el login'
    )
  }
}

// Función para hacer una solicitud autenticada con el token
export const makeAuthenticatedRequest = async (url, data) => {
  const token = localStorage.getItem('authToken') // Obtener el token de localStorage

  // Verificar si el token existe
  if (!token) {
    throw new Error('No token found')
  }

  // Realizar una solicitud con el token en las cabeceras
  const response = await api.post(url, data, {
    headers: {
      Authorization: `Bearer ${token}`, // Enviar el token en el header Authorization
    },
  })

  return response.data // Devolver los datos de la respuesta
}

// Función para obtener el token de localStorage
export const getAuthToken = () => {
  return localStorage.getItem('authToken')
}

// Función para borrar el token de localStorage cuando el usuario cierre sesión
export const logout = () => {
  localStorage.removeItem('authToken')
}
