// src/pages/Personal/HistorialPersonalSeleccionado.jsx
import { useContext, useEffect, useState } from 'react'
import AuthContext from '../../../context/AuthContext'
import { getHistorialPersonal } from '../Perfil/personalService'
import SecureHistorialPersonal from '../../Shared/SecureHistorialPersonal'

const HistorialPersonalSeleccionado = ({ idPersonal, refreshKey = 0 }) => {
  const { token } = useContext(AuthContext)

  const [historial, setHistorial] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const cargarHistorial = async () => {
      if (!idPersonal) {
        setError('Selecciona primero un colaborador.')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError('')

        const data = await getHistorialPersonal(idPersonal, token)
        setHistorial(Array.isArray(data.historial) ? data.historial : [])
      } catch (err) {
        console.error(err)
        setError('No se pudo cargar el historial del personal.')
      } finally {
        setLoading(false)
      }
    }

    cargarHistorial()
  }, [idPersonal, token, refreshKey])

  return (
    <div className='card shadow-sm'>
      <div className='card-header fw-semibold'>
        Historial del personal (ID {idPersonal || '—'})
      </div>

      <div className='card-body'>
        {loading && (
          <div className='text-muted small'>Cargando historial...</div>
        )}

        {error && !loading && (
          <div className='alert alert-danger mb-0'>{error}</div>
        )}

        {!loading && !error && historial.length === 0 && (
          <div className='text-muted small'>
            No hay eventos registrados en el historial.
          </div>
        )}

        {!loading && !error && historial.length > 0 && (
          <div className='list-group'>
            {historial.map(item => (
              <div
                key={item.id_historial}
                className='list-group-item d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2'
              >
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

export default HistorialPersonalSeleccionado
