// MisTareas.hook.js
import { useCallback, useEffect, useState } from 'react'
import { fetchMisTareasBundle } from './service.MisTareas'

const EMPTY_MAPS = {
  estadosMap: {},
  prioridadesMap: {},
  categoriasMap: {},
  teamsMap: {},
  areasMap: {},
  personalMap: {},
}

export const useMisTareasBundle = ({ token, id_personal, orgId }) => {
  const [rawRows, setRawRows] = useState([])
  const [maps, setMaps] = useState(EMPTY_MAPS)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!token || !id_personal) return

    try {
      setLoading(true)
      setError(null)

      const bundle = await fetchMisTareasBundle(
        {
          id_personal,
          page: 1,
          limit: 100,
          orgId: orgId || '',
        },
        token
      )

      setRawRows(Array.isArray(bundle.rows) ? bundle.rows : [])
      setMaps(bundle.maps || EMPTY_MAPS)
    } catch (e) {
      console.error(e)
      setError('No se pudo cargar Mis Tickets Asignados.')
      setRawRows([])
      setMaps(EMPTY_MAPS)
    } finally {
      setLoading(false)
    }
  }, [token, id_personal, orgId])

  useEffect(() => {
    load()
  }, [load])

  return { rawRows, maps, loading, error, load }
}
