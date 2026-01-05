// src/pages/Personal/secciones/MiPerfil.jsx
import { useContext, useEffect, useState } from 'react'
import AuthContext from '../../../context/AuthContext'
import { getMiPerfilDetalle } from './personalService'
import SecureAvatar from '../../../components/Shared/SecureAvatar'
import SecureFolder from '../../../components/Shared/SecureFolder'

const MiPerfil = () => {
  const { user, token } = useContext(AuthContext)

  const basePersonal = user?.personal
  const [detalle, setDetalle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const cargarDetalle = async () => {
      if (!basePersonal?.id_personal) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError('')
        const data = await getMiPerfilDetalle(basePersonal.id_personal, token)
        setDetalle(data)
      } catch (err) {
        console.error(err)
        setError('No se pudo cargar la información adicional de tu perfil.')
      } finally {
        setLoading(false)
      }
    }

    cargarDetalle()
  }, [basePersonal?.id_personal, token])

  if (!basePersonal) {
    return (
      <div className='container-fluid'>
        <div className='alert alert-warning mt-3'>
          No se encontró información de tu perfil.
        </div>
      </div>
    )
  }

  const nombreCompleto =
    detalle?.nombres && detalle?.apellidos
      ? `${detalle.nombres} ${detalle.apellidos}`
      : `${basePersonal.nombre} ${basePersonal.apellido}`

  const email = detalle?.email
  const telefono = detalle?.telefono
  const estado = detalle?.estado
  const horarioInt = detalle?.horario_int
  const horarioOff = detalle?.horario_off

  const fechaIngreso = basePersonal.fecha_ingreso
  const fechaRetiro = basePersonal.fecha_retiro
  const tienePapeleria = basePersonal.tiene_papeleria
  const carpetaDocs = basePersonal.carpeta_documentos

  const iniciales =
    (basePersonal.nombre?.[0] || '').toUpperCase() +
    (basePersonal.apellido?.[0] || '').toUpperCase()

  return (
    <div className='container-fluid'>
      {/* ===============================
            PORTADA CON IMAGEN DE FONDO
      ================================= */}
      <div
        className='text-white rounded-3 mb-3'
        style={{
          padding: '20px',
          backgroundImage: `
            linear-gradient(
              rgba(0, 0, 0, 0.08),
              rgba(0, 0, 0, 0.66)
            ),
            url('Fastway.png')
          `,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          borderRadius: '12px',
        }}
      >
        <div className='d-flex flex-column align-items-center text-center'>
          {/* Avatar */}
          <div
            className='mb-2 d-flex align-items-center justify-content-center bg-white rounded-circle border'
            style={{ width: '220px', height: '220px', overflow: 'hidden' }}
          >
            <SecureAvatar
              rutaFoto={basePersonal.ruta_foto}
              alt={nombreCompleto}
              fallback={
                <span className='fw-bold text-primary fs-3'>{iniciales}</span>
              }
            />
          </div>

          {/* Nombre y datos principales */}
          <div>
            <h1 className='h4 mb-1'>{nombreCompleto}</h1>
            <div className='small mb-2'>
              {basePersonal.cargo} · {basePersonal.area}
            </div>

            {estado && (
              <span
                className={`badge ${
                  estado === 'activo' ? 'bg-success' : 'bg-secondary'
                } text-uppercase`}
              >
                {estado}
              </span>
            )}
          </div>
        </div>
      </div>
      {/* FIN PORTADA */}

      {/* Mensajes de carga / error */}
      {loading && (
        <div className='alert alert-info'>
          Cargando información adicional de tu perfil...
        </div>
      )}

      {error && !loading && <div className='alert alert-danger'>{error}</div>}

      {/* Tarjetas de información */}
      <div className='row g-3'>
        <div className='col-md-6'>
          <div className='card h-100'>
            <div className='card-header fw-semibold'>Información básica</div>
            <div className='card-body'>
              <dl className='row mb-0'>
                <dt className='col-5 col-sm-4'>Documento</dt>
                <dd className='col-7 col-sm-8'>{basePersonal.id_personal}</dd>

                <dt className='col-5 col-sm-4'>Nombre</dt>
                <dd className='col-7 col-sm-8'>{nombreCompleto}</dd>

                <dt className='col-5 col-sm-4'>Cargo</dt>
                <dd className='col-7 col-sm-8'>{basePersonal.cargo}</dd>

                <dt className='col-5 col-sm-4'>Área</dt>
                <dd className='col-7 col-sm-8'>{basePersonal.area}</dd>

                <dt className='col-5 col-sm-4'>Carpeta docs</dt>
                <dd className='col-7 col-sm-8'>{carpetaDocs}</dd>
              </dl>
            </div>
          </div>
        </div>

        <div className='col-md-6'>
          <div className='card h-100'>
            <div className='card-header fw-semibold'>
              Contacto, horario y estado
            </div>
            <div className='card-body'>
              <dl className='row mb-3'>
                <dt className='col-5 col-sm-4'>Email</dt>
                <dd className='col-7 col-sm-8'>
                  {email || <span className='text-muted'>Sin registrar</span>}
                </dd>

                <dt className='col-5 col-sm-4'>Teléfono</dt>
                <dd className='col-7 col-sm-8'>
                  {telefono || (
                    <span className='text-muted'>Sin registrar</span>
                  )}
                </dd>

                <dt className='col-5 col-sm-4'>Horario entrada</dt>
                <dd className='col-7 col-sm-8'>
                  {horarioInt || (
                    <span className='text-muted'>No definido</span>
                  )}
                </dd>

                <dt className='col-5 col-sm-4'>Horario salida</dt>
                <dd className='col-7 col-sm-8'>
                  {horarioOff || (
                    <span className='text-muted'>No definido</span>
                  )}
                </dd>
              </dl>

              <hr />

              <dl className='row mb-0'>
                <dt className='col-5 col-sm-4'>Fecha ingreso</dt>
                <dd className='col-7 col-sm-8'>
                  {fechaIngreso || (
                    <span className='text-muted'>No registrada</span>
                  )}
                </dd>

                <dt className='col-5 col-sm-4'>Fecha retiro</dt>
                <dd className='col-7 col-sm-8'>
                  {fechaRetiro || <span className='text-muted'>Activo</span>}
                </dd>

                <dt className='col-5 col-sm-4'>Papelería</dt>
                <dd className='col-7 col-sm-8'>
                  {tienePapeleria ? 'Con documentos' : 'Sin documentos'}
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* Carpeta de documentos */}
      <div className='row g-3 mt-3'>
        <div className='col-12'>
          <SecureFolder rutaCarpeta={carpetaDocs} />
        </div>
      </div>
    </div>
  )
}

export default MiPerfil
