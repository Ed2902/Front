// src/pages/Personal/SeguimientoPersonal.jsx
import { useContext, useEffect, useState } from 'react'
import AuthContext from '../../../context/AuthContext'
import {
  listarPersonalComoOpciones,
  subirDocumentosPersonal,
  actualizarFotoPersonal,
  actualizarDatosPersonal,
  crearHistorialPersonal,
} from './seguimientoService'
import PerfilPersonalSeleccionado from './PerfilPersonalSeleccionado'
import HistorialPersonalSeleccionado from './HistorialPersonalSeleccionado'

// 🟦 Modal base reutilizable
const BackdropModal = ({ open, title, children, onClose }) => {
  if (!open) return null

  return (
    <div
      className='secure-preview-backdrop'
      onClick={onClose}
      style={{ zIndex: 2100 }}
    >
      <div
        className='secure-preview-modal'
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '700px' }}
      >
        <div className='secure-preview-header d-flex justify-content-between align-items-center'>
          <h6 className='mb-0 text-truncate'>{title}</h6>
          <button
            type='button'
            className='btn-close btn-close-white'
            onClick={onClose}
          />
        </div>
        <div className='secure-preview-body'>{children}</div>
      </div>
    </div>
  )
}

// 🟦 Modal: subir documentos
// 🟦 Modal: subir documentos
const ModalSubirDocumentos = ({
  open,
  onClose,
  idPersonal,
  onSuccess,
  loadingParent,
}) => {
  const { token } = useContext(AuthContext)
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isDragging, setIsDragging] = useState(false)

  const addFiles = newFiles => {
    if (!newFiles?.length) return
    setFiles(prev => [...prev, ...Array.from(newFiles)])
  }

  const handleFilesChange = e => {
    addFiles(e.target.files)
  }

  const handleDragOver = e => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = e => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = e => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    addFiles(e.dataTransfer.files)
  }

  const handleSubmit = async e => {
    e.preventDefault()
    if (!idPersonal || files.length === 0) return

    try {
      setLoading(true)
      setError('')
      setSuccess('')
      await subirDocumentosPersonal(idPersonal, files, token)
      setSuccess('Documentos cargados correctamente.')
      setFiles([])
      if (onSuccess) onSuccess()
    } catch (err) {
      console.error(err)
      setError('No se pudieron subir los documentos.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <BackdropModal
      open={open}
      onClose={onClose}
      title={`Cargar documentos - ID ${idPersonal}`}
    >
      <form onSubmit={handleSubmit}>
        {error && <div className='alert alert-danger'>{error}</div>}
        {success && <div className='alert alert-success'>{success}</div>}

        {/* Nota visible sobre nomenclatura */}
        <div className='alert alert-info py-2'>
          <strong>Importante:</strong> nombra claramente cada archivo antes de
          subirlo. Ejemplos:{' '}
          <em>CONTRATO_LABORAL.pdf, AFILIACION_EPS.pdf, HOJA_DE_VIDA.pdf</em>.
        </div>

        {/* Zona de drag & drop */}
        <div className='mb-3'>
          <label className='form-label'>Archivos</label>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className='mb-2'
            style={{
              border: '2px dashed #59a1f7',
              borderRadius: '10px',
              padding: '20px',
              textAlign: 'center',
              backgroundColor: isDragging ? '#f0f7ff' : '#f9fbff',
              cursor: 'pointer',
            }}
            onClick={() =>
              document.getElementById('input-docs-personal')?.click()
            }
          >
            <p className='mb-1 fw-semibold'>
              Arrastra y suelta aquí los documentos
            </p>
            <p className='mb-0 small text-muted'>
              o haz clic para buscarlos en tu equipo
            </p>
          </div>

          <input
            id='input-docs-personal'
            type='file'
            multiple
            className='form-control'
            style={{ display: 'none' }}
            onChange={handleFilesChange}
            disabled={loading || loadingParent}
          />

          <div className='form-text'>
            Puedes subir varios archivos (contrato, EPS, ARL, hoja de vida,
            etc.).
          </div>
        </div>

        {/* Lista de archivos seleccionados */}
        {files.length > 0 && (
          <div className='mb-3'>
            <div className='small fw-semibold mb-1'>
              Archivos seleccionados ({files.length}):
            </div>
            <ul className='small mb-0'>
              {files.map((f, idx) => (
                <li key={idx}>{f.name}</li>
              ))}
            </ul>
          </div>
        )}

        <div className='text-end'>
          <button
            type='button'
            className='btn btn-secondary me-2'
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type='submit'
            className='btn-agregarform'
            disabled={loading || !files.length || loadingParent}
          >
            {loading ? 'Subiendo...' : 'Subir documentos'}
          </button>
        </div>
      </form>
    </BackdropModal>
  )
}

// 🟦 Modal: actualizar foto
const ModalActualizarFoto = ({
  open,
  onClose,
  idPersonal,
  onSuccess,
  loadingParent,
}) => {
  const { token } = useContext(AuthContext)
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async e => {
    e.preventDefault()
    if (!idPersonal || !file) return

    try {
      setLoading(true)
      setError('')
      setSuccess('')
      await actualizarFotoPersonal(idPersonal, file, token)
      setSuccess('Foto actualizada correctamente.')
      setFile(null)
      if (onSuccess) onSuccess()
    } catch (err) {
      console.error(err)
      setError('No se pudo actualizar la foto.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <BackdropModal
      open={open}
      onClose={onClose}
      title={`Actualizar foto de perfil - ID ${idPersonal}`}
    >
      <form onSubmit={handleSubmit}>
        {error && <div className='alert alert-danger'>{error}</div>}
        {success && <div className='alert alert-success'>{success}</div>}

        <div className='mb-3'>
          <label className='form-label'>Nueva foto</label>
          <input
            type='file'
            accept='image/*'
            className='form-control'
            onChange={e => setFile(e.target.files?.[0] || null)}
            disabled={loading || loadingParent}
          />
        </div>

        <div className='text-end'>
          <button
            type='button'
            className='btn btn-secondary me-2'
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type='submit'
            className='btn-agregarform'
            disabled={loading || !file || loadingParent}
          >
            {loading ? 'Guardando...' : 'Actualizar foto'}
          </button>
        </div>
      </form>
    </BackdropModal>
  )
}

// 🟦 Modal: editar datos básicos
const ModalEditarDatos = ({
  open,
  onClose,
  personal,
  onSuccess,
  loadingParent,
}) => {
  const { token } = useContext(AuthContext)

  const [cargo, setCargo] = useState(personal?.Cargo || '')
  const [area, setArea] = useState(personal?.Area || '')
  const [fechaIngreso, setFechaIngreso] = useState(
    personal?.fecha_ingreso || ''
  )
  const [fechaRetiro, setFechaRetiro] = useState(personal?.fecha_retiro || '')
  const [tienePapeleria, setTienePapeleria] = useState(
    personal?.tiene_papeleria ? 1 : 0
  )

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (!personal) return
    setCargo(personal.Cargo || '')
    setArea(personal.Area || '')
    setFechaIngreso(personal.fecha_ingreso || '')
    setFechaRetiro(personal.fecha_retiro || '')
    setTienePapeleria(personal.tiene_papeleria ? 1 : 0)
  }, [personal])

  const handleSubmit = async e => {
    e.preventDefault()
    if (!personal?.Id_personal) return

    try {
      setLoading(true)
      setError('')
      setSuccess('')
      await actualizarDatosPersonal(
        personal.Id_personal,
        {
          Cargo: cargo,
          Area: area,
          fecha_ingreso: fechaIngreso || null,
          fecha_retiro: fechaRetiro || null,
          tiene_papeleria: tienePapeleria,
        },
        token
      )
      setSuccess('Datos actualizados correctamente.')
      if (onSuccess) onSuccess()
    } catch (err) {
      console.error(err)
      setError('No se pudieron actualizar los datos.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <BackdropModal
      open={open}
      onClose={onClose}
      title={`Editar datos - ID ${personal?.Id_personal}`}
    >
      <form onSubmit={handleSubmit}>
        {error && <div className='alert alert-danger'>{error}</div>}
        {success && <div className='alert alert-success'>{success}</div>}

        <div className='mb-3'>
          <label className='form-label'>Cargo</label>
          <input
            type='text'
            className='form-control'
            value={cargo}
            onChange={e => setCargo(e.target.value)}
            disabled={loading || loadingParent}
          />
        </div>

        <div className='mb-3'>
          <label className='form-label'>Área</label>
          <input
            type='text'
            className='form-control'
            value={area}
            onChange={e => setArea(e.target.value)}
            disabled={loading || loadingParent}
          />
        </div>

        <div className='mb-3 row'>
          <div className='col-md-6'>
            <label className='form-label'>Fecha ingreso</label>
            <input
              type='date'
              className='form-control'
              value={fechaIngreso || ''}
              onChange={e => setFechaIngreso(e.target.value)}
              disabled={loading || loadingParent}
            />
          </div>
          <div className='col-md-6'>
            <label className='form-label'>Fecha retiro</label>
            <input
              type='date'
              className='form-control'
              value={fechaRetiro || ''}
              onChange={e => setFechaRetiro(e.target.value)}
              disabled={loading || loadingParent}
            />
          </div>
        </div>

        <div className='mb-3'>
          <label className='form-label'>Papelería</label>
          <select
            className='form-select'
            value={tienePapeleria}
            onChange={e => setTienePapeleria(Number(e.target.value))}
            disabled={loading || loadingParent}
          >
            <option value={0}>Sin documentos</option>
            <option value={1}>Con documentos</option>
          </select>
        </div>

        <div className='text-end'>
          <button
            type='button'
            className='btn btn-secondary me-2'
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type='submit'
            className='btn-agregarform'
            disabled={loading || loadingParent}
          >
            {loading ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </BackdropModal>
  )
}

// 🟦 Modal: nuevo historial
const ModalNuevoHistorial = ({
  open,
  onClose,
  idPersonal,
  onSuccess,
  loadingParent,
}) => {
  const { token, user } = useContext(AuthContext)

  // ENUM tipo_evento: NOTA, DOCUMENTO, CAMBIO_ESTADO, LLAMADO_ATENCION, OTRO
  const [tipoEvento, setTipoEvento] = useState('DOCUMENTO')

  // ENUM tipo_documento: CONTRATO, MEMORANDO, ACUERDO, OTRO
  const [tipoDocumento, setTipoDocumento] = useState('MEMORANDO')

  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [fechaDocumento, setFechaDocumento] = useState('')
  const [archivo, setArchivo] = useState(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const idUsuarioRegistra = user?.personal?.id_personal || ''

  const handleSubmit = async e => {
    e.preventDefault()
    if (!idPersonal) return

    try {
      setLoading(true)
      setError('')
      setSuccess('')

      await crearHistorialPersonal(
        {
          id_personal: idPersonal,
          tipo_evento: tipoEvento,
          tipo_documento: tipoDocumento,
          titulo,
          descripcion,
          fecha_documento: fechaDocumento,
          id_usuario_registra: idUsuarioRegistra,
        },
        archivo,
        token
      )

      setSuccess('Historial creado correctamente.')
      setTitulo('')
      setDescripcion('')
      setFechaDocumento('')
      setArchivo(null)
      if (onSuccess) onSuccess()
    } catch (err) {
      console.error(err)
      setError('No se pudo crear el historial.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <BackdropModal
      open={open}
      onClose={onClose}
      title={`Nuevo evento en historial - ID ${idPersonal}`}
    >
      <form onSubmit={handleSubmit}>
        {error && <div className='alert alert-danger'>{error}</div>}
        {success && <div className='alert alert-success'>{success}</div>}

        <div className='row mb-3'>
          <div className='col-md-6'>
            <label className='form-label'>Tipo de evento</label>
            <select
              className='form-select'
              value={tipoEvento}
              onChange={e => setTipoEvento(e.target.value)}
              disabled={loading || loadingParent}
            >
              <option value='NOTA'>NOTA</option>
              <option value='DOCUMENTO'>DOCUMENTO</option>
              <option value='CAMBIO_ESTADO'>CAMBIO_ESTADO</option>
              <option value='LLAMADO_ATENCION'>LLAMADO_ATENCION</option>
              <option value='OTRO'>OTRO</option>
            </select>
          </div>
          <div className='col-md-6'>
            <label className='form-label'>Tipo de documento</label>
            <select
              className='form-select'
              value={tipoDocumento}
              onChange={e => setTipoDocumento(e.target.value)}
              disabled={loading || loadingParent}
            >
              <option value='CONTRATO'>CONTRATO</option>
              <option value='MEMORANDO'>MEMORANDO</option>
              <option value='ACUERDO'>ACUERDO</option>
              <option value='OTRO'>OTRO</option>
            </select>
          </div>
        </div>

        <div className='mb-3'>
          <label className='form-label'>Título</label>
          <input
            type='text'
            className='form-control'
            value={titulo}
            onChange={e => setTitulo(e.target.value)}
            disabled={loading || loadingParent}
          />
        </div>

        <div className='mb-3'>
          <label className='form-label'>Descripción</label>
          <textarea
            className='form-control'
            rows={3}
            value={descripcion}
            onChange={e => setDescripcion(e.target.value)}
            disabled={loading || loadingParent}
          />
        </div>

        <div className='row mb-3'>
          <div className='col-md-6'>
            <label className='form-label'>Fecha del documento</label>
            <input
              type='date'
              className='form-control'
              value={fechaDocumento}
              onChange={e => setFechaDocumento(e.target.value)}
              disabled={loading || loadingParent}
            />
          </div>
          <div className='col-md-6'>
            <label className='form-label'>Archivo adjunto (opcional)</label>
            <input
              type='file'
              className='form-control'
              onChange={e => setArchivo(e.target.files?.[0] || null)}
              disabled={loading || loadingParent}
            />
          </div>
        </div>

        <div className='text-end'>
          <button
            type='button'
            className='btn btn-secondary me-2'
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type='submit'
            className='btn-agregarform'
            disabled={loading || loadingParent}
          >
            {loading ? 'Guardando...' : 'Crear historial'}
          </button>
        </div>
      </form>
    </BackdropModal>
  )
}

// 🟦 Componente principal
const SeguimientoPersonal = () => {
  const { token } = useContext(AuthContext)

  const [opciones, setOpciones] = useState([])
  const [loadingOpciones, setLoadingOpciones] = useState(true)
  const [errorOpciones, setErrorOpciones] = useState('')

  const [idSeleccionado, setIdSeleccionado] = useState('')
  const [personalSeleccionado, setPersonalSeleccionado] = useState(null)

  // para refrescar historial cuando se crea uno nuevo
  const [refreshHistorialKey, setRefreshHistorialKey] = useState(0)

  // estado modales
  const [openModalDocs, setOpenModalDocs] = useState(false)
  const [openModalFoto, setOpenModalFoto] = useState(false)
  const [openModalDatos, setOpenModalDatos] = useState(false)
  const [openModalHistorial, setOpenModalHistorial] = useState(false)

  useEffect(() => {
    const cargar = async () => {
      try {
        setLoadingOpciones(true)
        setErrorOpciones('')
        const opts = await listarPersonalComoOpciones(token)
        setOpciones(opts)
      } catch (err) {
        console.error(err)
        setErrorOpciones('No se pudo cargar la lista de personal.')
      } finally {
        setLoadingOpciones(false)
      }
    }

    cargar()
  }, [token])

  const handleBuscar = () => {
    if (!idSeleccionado) {
      setPersonalSeleccionado(null)
      return
    }
    const encontrado = opciones.find(opt => opt.value === idSeleccionado)
    setPersonalSeleccionado(encontrado || null)
  }

  const idPersonalActual = personalSeleccionado?.value || ''

  const handleHistorialCreado = () => {
    setRefreshHistorialKey(prev => prev + 1)
  }

  return (
    <div className='container-fluid'>
      <div className='card shadow-sm mb-3'>
        <div className='card-header fw-semibold d-flex justify-content-between align-items-center'>
          <span>Seguimiento de personal</span>

          {/* Botones de acciones solo si hay seleccionado */}
          {idPersonalActual && (
            <div className='d-flex flex-wrap gap-2'>
              <button
                type='button'
                className='btn btn-sm btn-outline-primary'
                onClick={() => setOpenModalDocs(true)}
              >
                Cargar documentos
              </button>
              <button
                type='button'
                className='btn btn-sm btn-outline-primary'
                onClick={() => setOpenModalFoto(true)}
              >
                Cambiar foto
              </button>
              <button
                type='button'
                className='btn btn-sm btn-outline-primary'
                onClick={() => setOpenModalDatos(true)}
              >
                Editar datos
              </button>
              <button
                type='button'
                className='btn btn-sm btn-outline-primary'
                onClick={() => setOpenModalHistorial(true)}
              >
                Nuevo historial
              </button>
            </div>
          )}
        </div>

        <div className='card-body'>
          {errorOpciones && (
            <div className='alert alert-danger'>{errorOpciones}</div>
          )}

          <div className='row g-2 align-items-end'>
            {/* Select de personal */}
            <div className='col-md-6'>
              <label className='form-label'>
                Selecciona un colaborador (lista)
              </label>
              <select
                className='form-select'
                value={idSeleccionado}
                onChange={e => setIdSeleccionado(e.target.value)}
                disabled={loadingOpciones}
              >
                <option value=''>
                  {loadingOpciones ? 'Cargando personal...' : '— Selecciona —'}
                </option>
                {opciones.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Input para escribir el ID / cédula */}
            <div className='col-md-4'>
              <label className='form-label'>
                O escribe el ID del colaborador
              </label>
              <input
                type='text'
                className='form-control'
                value={idSeleccionado}
                onChange={e => setIdSeleccionado(e.target.value)}
                placeholder='Ej: 1032485205'
                disabled={loadingOpciones}
              />
            </div>

            {/* Botón Buscar */}
            <div className='col-md-2 text-md-end'>
              <button
                type='button'
                className='btn-agregarform w-100'
                onClick={handleBuscar}
                disabled={!idSeleccionado || loadingOpciones}
              >
                Buscar
              </button>
            </div>
          </div>
        </div>
      </div>

      {personalSeleccionado && (
        <>
          <PerfilPersonalSeleccionado personal={personalSeleccionado.raw} />

          <div className='mt-3'>
            <HistorialPersonalSeleccionado
              idPersonal={idPersonalActual}
              refreshKey={refreshHistorialKey}
            />
          </div>
        </>
      )}

      {/* Modales */}
      <ModalSubirDocumentos
        open={openModalDocs}
        onClose={() => setOpenModalDocs(false)}
        idPersonal={idPersonalActual}
        loadingParent={loadingOpciones}
        onSuccess={() => {}}
      />

      <ModalActualizarFoto
        open={openModalFoto}
        onClose={() => setOpenModalFoto(false)}
        idPersonal={idPersonalActual}
        loadingParent={loadingOpciones}
        onSuccess={() => {}}
      />

      <ModalEditarDatos
        open={openModalDatos}
        onClose={() => setOpenModalDatos(false)}
        personal={personalSeleccionado?.raw || null}
        loadingParent={loadingOpciones}
        onSuccess={() => {}}
      />

      <ModalNuevoHistorial
        open={openModalHistorial}
        onClose={() => setOpenModalHistorial(false)}
        idPersonal={idPersonalActual}
        loadingParent={loadingOpciones}
        onSuccess={handleHistorialCreado}
      />
    </div>
  )
}

export default SeguimientoPersonal
