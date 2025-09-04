// src/components/PrivateRoute.jsx
import React, { useContext } from 'react'
import { Navigate } from 'react-router-dom'
import AuthContext from '../context/AuthContext'
import { usePermisos } from '../hooks/usePermisos'

const PrivateRoute = ({ element, permiso }) => {
  const { token, loading } = useContext(AuthContext)
  const { tienePermiso } = usePermisos()

  if (loading) {
    return <div>Cargando sesión...</div>
  }

  if (!token) {
    return <Navigate to='/login' />
  }

  // Si se exige un permiso, verificarlo
  if (permiso && !tienePermiso(permiso)) {
    return (
      <Navigate
        to='/404'
        state={{ from: location.pathname }} // 👈 guarda de dónde venía
      />
    )
  }
  return element
}

export default PrivateRoute
