import React, { createContext, useState, useEffect } from 'react'

// Crear el contexto de autenticación
const AuthContext = createContext()

// Componente proveedor para envolver la aplicación
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null) // Guardar los datos del usuario
  const [token, setToken] = useState(null) // Guardar el token
  const [loading, setLoading] = useState(true) // 🚀 Saber si está cargando la sesión

  // Verificar si el usuario está autenticado al cargar la aplicación
  useEffect(() => {
    const storedUser = localStorage.getItem('user')
    const storedToken = localStorage.getItem('token')

    if (storedUser && storedToken) {
      setUser(JSON.parse(storedUser))
      setToken(storedToken)
    }

    setLoading(false) // 🚀 Una vez leído, ya no está cargando
  }, [])

  // Función para iniciar sesión
  const login = (userData, token) => {
    setUser(userData)
    setToken(token)
    localStorage.setItem('user', JSON.stringify(userData))
    localStorage.setItem('token', token)
  }

  // Función para cerrar sesión
  const logout = () => {
    setUser(null)
    setToken(null)
    localStorage.removeItem('user')
    localStorage.removeItem('token')
  }

  // Estado y funciones disponibles para ser consumidas
  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

// Exportar el contexto para usarlo en otros componentes
export default AuthContext
