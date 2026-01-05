// src/pages/Personal/Perfil/HistorialPersonal.jsx
import { useContext, useEffect, useState } from 'react'
import AuthContext from '../../../context/AuthContext'
import { getHistorialPersonal } from './personalService'
import SecureHistorialPersonal from '../../../components/Shared/SecureHistorialPersonal'

const HistorialPersonal = () => {
  const { user, token } = useContext(AuthContext)
  const basePersonal = user?.personal

  const [historial, setHistorial] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const cargarHistorial = async () => {
      if (!basePersonal?.id_personal) {
        setError('No se encontró el ID del personal.')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError('')

        // 🔥 Llamamos al service que ya creaste
        const data = await getHistorialPersonal(basePersonal.id_personal, token)

        // data = { id_personal: "...", historial: [ ... ] }
        setHistorial(Array.isArray(data.historial) ? data.historial : [])
      } catch (err) {
        console.error(err)
        setError('No se pudo cargar el historial del personal.')
      } finally {
        setLoading(false)
      }
    }

    cargarHistorial()
  }, [basePersonal?.id_personal, token])

  return (
    <div className='card shadow-sm'>
      <div className='card-header fw-semibold'>Historial del personal</div>

      <div className='card-body'>
        {/* Estado de carga */}
        {loading && (
          <div className='text-muted small'>Cargando historial...</div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className='alert alert-danger mb-0'>{error}</div>
        )}

        {/* Sin historial */}
        {!loading && !error && historial.length === 0 && (
          <div className='text-muted small'>
            No hay eventos registrados en el historial.
          </div>
        )}

        {/* Lista de historial */}
        {!loading && !error && historial.length > 0 && (
          <div className='list-group'>
            {historial.map(item => (
              <div
                key={item.id_historial}
                className='list-group-item d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2'
              >
                {/* IZQUIERDA: texto descriptivo */}
                <div>
                  <div className='d-flex flex-wrap align-items-center gap-2 mb-1'>
                    <span className='badge bg-secondary'>
                      {item.tipo_evento}
                    </span>

                    {item.tipo_documento && (
                      <span className='badge bg-light text-dark'>
                        {item.tipo_documento}
                      </span>
                    )}

                    {item.fecha_documento && (
                      <span className='text-muted small'>
                        {item.fecha_documento}
                      </span>
                    )}
                  </div>

                  <div className='fw-semibold'>{item.titulo}</div>

                  {item.descripcion && (
                    <div className='text-muted small'>{item.descripcion}</div>
                  )}
                </div>

                {/* DERECHA: acciones (ver/descargar archivo) */}
                {item.ruta_relativa && (
                  <SecureHistorialPersonal
                    rutaRelativa={item.ruta_relativa}
                    nombreArchivo={item.titulo}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default HistorialPersonal
