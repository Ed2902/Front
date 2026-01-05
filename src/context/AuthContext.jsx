import React, { createContext, useState, useEffect } from 'react'
import { registerWebPush } from '../utils/webpushClient'

// Crear el contexto de autenticación
const AuthContext = createContext()

const API_BASE_DEFAULT = import.meta.env.VITE_API_URL_4
const ORG_ID = import.meta.env.VITE_ORG_ID

// Componente proveedor
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [loading, setLoading] = useState(true)

  // Cargar sesión desde localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem('user')
    const storedToken = localStorage.getItem('token')

    if (storedUser && storedToken) {
      setUser(JSON.parse(storedUser))
      setToken(storedToken)
    }

    setLoading(false)
  }, [])

  // LOGIN
  const login = async (userData, token) => {
    setUser(userData)
    setToken(token)

    localStorage.setItem('user', JSON.stringify(userData))
    localStorage.setItem('token', token)

    // 🔑 Normalizar principalId (una sola regla)
    const principalId =
      userData?.principalId ??
      userData?.id_usuario ??
      userData?.personal?.id_personal

    // 🔔 Registrar Web Push UNA VEZ al iniciar sesión
    try {
      if (principalId && token) {
        await registerWebPush({
          apiBaseUrl: API_BASE_DEFAULT,
          orgId: ORG_ID,
          principalId: String(principalId),
          token,
        })
        console.log('🔔 WebPush registrado para principalId:', principalId)
      } else {
        console.warn(
          '⚠️ No se pudo registrar WebPush: falta principalId o token'
        )
      }
    } catch (err) {
      console.error('❌ Error registrando WebPush en login:', err)
    }
  }

  // LOGOUT
  const logout = () => {
    setUser(null)
    setToken(null)
    localStorage.removeItem('user')
    localStorage.removeItem('token')
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export default AuthContext
