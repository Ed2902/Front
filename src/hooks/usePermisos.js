import { useContext, useMemo, useCallback } from 'react'
import AuthContext from '../context/AuthContext'

export const usePermisos = () => {
  const { user } = useContext(AuthContext)

  const permisos = useMemo(() => {
    if (!user?.permisos) return {}

    if (typeof user.permisos === 'string') {
      try {
        return JSON.parse(user.permisos)
      } catch (error) {
        console.error('Error al parsear permisos:', error)
        return {}
      }
    }

    return user.permisos
  }, [user])

  const tienePermiso = useCallback(
    permiso => {
      return permisos[permiso] === true
    },
    [permisos]
  )
  return { tienePermiso }
}
