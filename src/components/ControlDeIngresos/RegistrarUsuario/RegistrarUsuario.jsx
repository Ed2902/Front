// src/components/ControlIngresos/RegistrarUsuario/RegistrarUsuario.jsx
import { useEffect, useRef, useState } from 'react'
import Modal from 'react-modal'
import Webcam from 'react-webcam'
import { crearPersonal, subirFotosPersonal } from './RegistrarUsuario_service'

const ANGULOS = [
  { key: 'frontal', label: 'Frontal' },
  { key: 'izq45', label: '45° Izquierda' },
  { key: 'der45', label: '45° Derecha' },
  { key: 'arriba', label: 'Leve Arriba' },
  { key: 'abajo', label: 'Leve Abajo' },
]

// Utilidad: dataURL -> File
function dataURLtoFile(dataUrl, filename) {
  const arr = dataUrl.split(',')
  const mime = arr[0].match(/:(.*?);/)[1]
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) u8arr[n] = bstr.charCodeAt(n)
  return new File([u8arr], filename, { type: mime })
}

const RegistrarUsuario = () => {
  const [formData, setFormData] = useState({
    documento: '',
    nombres: '',
    apellidos: '',
    email: '',
    telefono: '',
    estado: 'inactivo',
    horas_semana: '',
  })

  const [captures, setCaptures] = useState({
    frontal: null,
    izq45: null,
    der45: null,
    arriba: null,
    abajo: null,
  }) // { key: { preview, file } }

  const [activeSlot, setActiveSlot] = useState(null)
  const [isCamOpen, setIsCamOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const webcamRef = useRef(null)

  const videoConstraints = { video: { facingMode: 'user' } }
  const allFiveReady = ANGULOS.every(a => !!captures[a.key])

  useEffect(() => {
    // Requerido por react-modal para accesibilidad
    Modal.setAppElement('#root')
  }, [])

  const handleChange = e => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const openCameraFor = slotKey => {
    setActiveSlot(slotKey)
    setIsCamOpen(true)
  }

  const cerrarCamara = () => {
    setIsCamOpen(false)
    setActiveSlot(null)
  }

  const tomarFoto = () => {
    const shot = webcamRef.current?.getScreenshot()
    if (!shot || !activeSlot) return
    const file = dataURLtoFile(shot, `${activeSlot}.jpg`)
    setCaptures(prev => ({
      ...prev,
      [activeSlot]: { preview: shot, file },
    }))
    cerrarCamara()
  }

  const eliminarFoto = slotKey => {
    setCaptures(prev => ({ ...prev, [slotKey]: null }))
  }

  const handleSubmit = async e => {
    e.preventDefault()
    if (!allFiveReady) {
      alert(
        'Debes capturar las 5 fotos (frontal, 45° izq., 45° der., arriba y abajo).'
      )
      return
    }

    try {
      setSaving(true)
      setUploadProgress(0)

      // 1) Crear personal (JSON)
      const creado = await crearPersonal(formData) // { id, ... }
      const personalId = creado?.id
      if (!personalId) throw new Error('No se recibió el ID del personal.')

      // 2) Subir fotos (FormData): personal_id + 5 x "files"
      const files = ANGULOS.map(a => captures[a.key].file)
      await subirFotosPersonal(personalId, files, p => setUploadProgress(p))

      alert('Usuario registrado y fotos subidas correctamente.')

      // Reset
      setFormData({
        documento: '',
        nombres: '',
        apellidos: '',
        email: '',
        telefono: '',
        estado: 'activo',
        horas_semana: '',
      })
      setCaptures({
        frontal: null,
        izq45: null,
        der45: null,
        arriba: null,
        abajo: null,
      })
      setUploadProgress(0)
    } catch (err) {
      console.error(err)
      alert('Ocurrió un error al registrar o subir las fotos.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className='container-fluid mt-4'>
      <h3 className='text-center mb-4'>Registrar Usuario</h3>

      <form onSubmit={handleSubmit} className='mt-3'>
        <div className='row'>
          <div className='col-md-4 mb-3'>
            <label className='form-label'>Documento</label>
            <input
              className='form-control'
              name='documento'
              value={formData.documento}
              onChange={handleChange}
              required
              disabled={saving}
            />
          </div>
          <div className='col-md-4 mb-3'>
            <label className='form-label'>Nombres</label>
            <input
              className='form-control'
              name='nombres'
              value={formData.nombres}
              onChange={handleChange}
              required
              disabled={saving}
            />
          </div>
          <div className='col-md-4 mb-3'>
            <label className='form-label'>Apellidos</label>
            <input
              className='form-control'
              name='apellidos'
              value={formData.apellidos}
              onChange={handleChange}
              required
              disabled={saving}
            />
          </div>
        </div>

        <div className='row'>
          <div className='col-md-4 mb-3'>
            <label className='form-label'>Email</label>
            <input
              type='email'
              className='form-control'
              name='email'
              value={formData.email}
              onChange={handleChange}
              disabled={saving}
            />
          </div>
          <div className='col-md-4 mb-3'>
            <label className='form-label'>Teléfono</label>
            <input
              className='form-control'
              name='telefono'
              value={formData.telefono}
              onChange={handleChange}
              disabled={saving}
            />
          </div>
          <div className='col-md-2 mb-3'>
            <label className='form-label'>Estado</label>
            <select
              className='form-select'
              name='estado'
              value={formData.estado}
              onChange={handleChange}
              disabled={saving}
            >
              <option value='inactivo'>Inactivo</option>
              <option value='activo'>activo</option>
            </select>
          </div>
          <div className='col-md-2 mb-3'>
            <label className='form-label'>Horas/semana</label>
            <input
              type='number'
              className='form-control'
              name='horas_semana'
              value={formData.horas_semana}
              onChange={handleChange}
              required
              disabled={saving}
              min={0}
            />
          </div>
        </div>

        {/* Capturas del rostro */}
        <div className='mt-4'>
          <h5 className='mb-3'>Capturas del rostro (5 ángulos)</h5>
          <div className='row g-3'>
            {ANGULOS.map(({ key, label }) => {
              const cap = captures[key]
              return (
                <div key={key} className='col-12 col-md-6 col-lg-4'>
                  <div className='card h-100'>
                    {cap?.preview ? (
                      <>
                        <img
                          src={cap.preview}
                          alt={label}
                          className='card-img-top'
                          style={{ objectFit: 'cover', height: 220 }}
                        />
                        <div className='card-body'>
                          <h6 className='card-title'>{label}</h6>
                          <div className='d-flex gap-2'>
                            <button
                              type='button'
                              className='btn btn-secondary btn-sm'
                              onClick={() => openCameraFor(key)}
                              disabled={saving}
                            >
                              Rehacer
                            </button>
                            <button
                              type='button'
                              className='btn btn-outline-danger btn-sm'
                              onClick={() => eliminarFoto(key)}
                              disabled={saving}
                            >
                              Eliminar
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div
                          className='d-flex align-items-center justify-content-center bg-light'
                          style={{ height: 220 }}
                        >
                          <span className='text-muted'>Sin captura</span>
                        </div>
                        <div className='card-body'>
                          <h6 className='card-title'>{label}</h6>
                          <button
                            type='button'
                            className='btn btn-primary'
                            onClick={() => openCameraFor(key)}
                            disabled={saving}
                          >
                            Tomar foto
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Progreso de subida */}
        {saving && (
          <div className='my-4'>
            <label className='form-label'>Subiendo imágenes…</label>
            <div
              className='progress'
              role='progressbar'
              aria-valuemin='0'
              aria-valuemax='100'
            >
              <div
                className='progress-bar progress-bar-striped progress-bar-animated'
                style={{ width: `${uploadProgress}%` }}
              >
                {uploadProgress}%
              </div>
            </div>
          </div>
        )}

        {/* Guardar */}
        <div className='text-center my-4'>
          <button
            type='submit'
            className='btn btn-success'
            disabled={saving || !allFiveReady}
          >
            Registrar y subir fotos
          </button>
        </div>
      </form>

      {/* Modal con react-modal (sin Bootstrap JS) */}
      <Modal
        isOpen={isCamOpen}
        onRequestClose={cerrarCamara}
        style={{
          content: {
            inset: '50% auto auto 50%',
            transform: 'translate(-50%, -50%)',
            maxWidth: '720px',
            width: '95%',
            borderRadius: '12px',
          },
          overlay: { backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 },
        }}
      >
        <div className='d-flex justify-content-between align-items-center mb-2'>
          <h5 className='m-0'>
            Tomar foto{' '}
            {activeSlot &&
              `– ${ANGULOS.find(a => a.key === activeSlot)?.label}`}
          </h5>
          <button
            type='button'
            className='btn btn-sm btn-outline-secondary'
            onClick={cerrarCamara}
          >
            Cerrar
          </button>
        </div>

        <div className='d-flex justify-content-center'>
          <Webcam
            ref={webcamRef}
            audio={false}
            screenshotFormat='image/jpeg'
            videoConstraints={videoConstraints}
            style={{ width: '100%', maxWidth: 640, borderRadius: 12 }}
          />
        </div>
        <p className='mt-3 small text-muted text-center'>
          Sugerencias: rostro centrado y bien iluminado, expresión neutra.
          Mantén estable el encuadre.
        </p>

        <div className='d-flex justify-content-end gap-2 mt-3'>
          <button
            type='button'
            className='btn btn-secondary'
            onClick={cerrarCamara}
          >
            Cancelar
          </button>
          <button type='button' className='btn btn-primary' onClick={tomarFoto}>
            Capturar
          </button>
        </div>
      </Modal>
    </div>
  )
}

export default RegistrarUsuario
