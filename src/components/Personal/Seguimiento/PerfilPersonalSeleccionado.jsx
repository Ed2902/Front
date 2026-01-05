// src/pages/Personal/PerfilPersonalSeleccionado.jsx
import SecureAvatar from '../../Shared/SecureAvatar'
import SecureFolder from '../../Shared/SecureFolder'

const PerfilPersonalSeleccionado = ({ personal }) => {
  if (!personal) return null

  // Preferimos los nombres/apellidos extendidos (API_URL_2) y caemos a los base
  const nombres = personal.nombres || personal.Nombre || ''
  const apellidos = personal.apellidos || personal.Apellido || ''
  const nombreCompleto =
    `${nombres} ${apellidos}`.trim() ||
    `${personal.Nombre || ''} ${personal.Apellido || ''}`.trim()

  const iniciales =
    (nombres?.[0] || personal.Nombre?.[0] || '').toUpperCase() +
    (apellidos?.[0] || personal.Apellido?.[0] || '').toUpperCase()

  const fechaIngreso = personal.fecha_ingreso
  const fechaRetiro = personal.fecha_retiro
  const tienePapeleria = personal.tiene_papeleria

  const carpetaDocs =
    personal.carpeta_documentos || `personal/${personal.Id_personal}`
  const rutaFoto = personal.ruta_foto

  // Datos extendidos
  const email = personal.email
  const telefono = personal.telefono
  const estado = personal.estado
  const horarioEntrada = personal.horario_int
  const horarioSalida = personal.horario_off

  return (
    <div className='card shadow-sm'>
      <div className='card-body'>
        {/* Cabecera tipo MiPerfil */}
        <div className='d-flex flex-column flex-md-row align-items-center gap-3 mb-3'>
          {/* Avatar */}
          <div
            className='d-flex align-items-center justify-content-center bg-white rounded-circle border'
            style={{ width: '88px', height: '88px', overflow: 'hidden' }}
          >
            <SecureAvatar
              rutaFoto={rutaFoto}
              alt={nombreCompleto}
              fallback={
                <span className='fw-bold text-primary fs-3'>{iniciales}</span>
              }
            />
          </div>

          {/* Nombre y datos principales */}
          <div className='text-center text-md-start'>
            <h2 className='h4 mb-1'>{nombreCompleto}</h2>

            <div className='small mb-1'>
              {personal.Cargo || 'Sin cargo'} · {personal.Area || 'Sin área'}
            </div>

            <div className='d-flex flex-wrap justify-content-center justify-content-md-start gap-2 mt-1'>
              <span className='badge bg-light text-dark text-wrap'>
                Doc: {personal.Id_personal}
              </span>
              {estado && (
                <span
                  className={`badge text-wrap ${
                    estado === 'activo'
                      ? 'bg-success-subtle text-success'
                      : 'bg-secondary-subtle text-secondary'
                  }`}
                >
                  {estado}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Info en dos columnas */}
        <div className='row g-3'>
          {/* COLUMNA IZQUIERDA: Info básica */}
          <div className='col-md-6'>
            <div className='card h-100'>
              <div className='card-header fw-semibold'>Información básica</div>
              <div className='card-body'>
                <dl className='row mb-0'>
                  <dt className='col-5 col-sm-4'>Documento</dt>
                  <dd className='col-7 col-sm-8'>{personal.Id_personal}</dd>

                  <dt className='col-5 col-sm-4'>Nombre</dt>
                  <dd className='col-7 col-sm-8'>{nombreCompleto}</dd>

                  <dt className='col-5 col-sm-4'>Cargo</dt>
                  <dd className='col-7 col-sm-8'>
                    {personal.Cargo || (
                      <span className='text-muted'>No definido</span>
                    )}
                  </dd>

                  <dt className='col-5 col-sm-4'>Área</dt>
                  <dd className='col-7 col-sm-8'>
                    {personal.Area || (
                      <span className='text-muted'>No definida</span>
                    )}
                  </dd>

                  <dt className='col-5 col-sm-4'>Email</dt>
                  <dd className='col-7 col-sm-8'>
                    {email || (
                      <span className='text-muted'>Sin correo registrado</span>
                    )}
                  </dd>

                  <dt className='col-5 col-sm-4'>Teléfono</dt>
                  <dd className='col-7 col-sm-8'>
                    {telefono || (
                      <span className='text-muted'>Sin teléfono</span>
                    )}
                  </dd>

                  <dt className='col-5 col-sm-4'>Carpeta docs</dt>
                  <dd className='col-7 col-sm-8'>
                    {carpetaDocs || (
                      <span className='text-muted'>Sin carpeta</span>
                    )}
                  </dd>
                </dl>
              </div>
            </div>
          </div>

          {/* COLUMNA DERECHA: Estado, fechas y horarios */}
          <div className='col-md-6'>
            <div className='card h-100'>
              <div className='card-header fw-semibold'>
                Estado, fechas y horario
              </div>
              <div className='card-body'>
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

                  <dt className='col-5 col-sm-4'>Hora ingreso</dt>
                  <dd className='col-7 col-sm-8'>
                    {horarioEntrada || (
                      <span className='text-muted'>No definido</span>
                    )}
                  </dd>

                  <dt className='col-5 col-sm-4'>Hora salida</dt>
                  <dd className='col-7 col-sm-8'>
                    {horarioSalida || (
                      <span className='text-muted'>No definido</span>
                    )}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Carpeta de documentos igual que en MiPerfil */}
        <div className='row g-3 mt-3'>
          <div className='col-12'>
            <SecureFolder rutaCarpeta={carpetaDocs} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default PerfilPersonalSeleccionado
