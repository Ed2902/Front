// src/components/ControlIngresos/RegistrarUsuario/RegistrarUsuario.jsx
import { useEffect, useRef, useState, useContext } from 'react'
import Modal from 'react-modal'
import Webcam from 'react-webcam'
import axios from 'axios'
import {
  crearPersonal,
  subirFotosPersonal,
  verPersonalPorDocumento,
  verVectoresPorPersonal,
  actualizarFotosPersonal,
  setApi,
} from './RegistrarUsuario_service'

import AuthContext from '../../../context/AuthContext'

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
  const { token } = useContext(AuthContext) || {}

  // Inyecta axios con token/API key al service cuando cambie el token
  useEffect(() => {
    const instance = axios.create({
      baseURL: import.meta.env.VITE_API_URL_2 || 'http://localhost:8000',
    })
    instance.interceptors.request.use(config => {
      const apiKey = import.meta.env.VITE_API_KEY || ''
      if (apiKey) config.headers['X-API-Key'] = apiKey
      if (token) config.headers.Authorization = `Bearer ${token}`
      return config
    })
    setApi(instance)
  }, [token])

  // "registrar" o "actualizar"
  const [modo, setModo] = useState('registrar')

  const [formData, setFormData] = useState({
    documento: '',
    nombres: '',
    apellidos: '',
    email: '',
    telefono: '',
    estado: 'inactivo',
    horario_int: '', // HH:MM
    horario_off: '', // HH:MM
  })

  const [personalExistenteId, setPersonalExistenteId] = useState(null)
  const [infoVectores, setInfoVectores] = useState(null)
  const [captures, setCaptures] = useState({
    frontal: null,
    izq45: null,
    der45: null,
    arriba: null,
    abajo: null,
  })

  const [activeSlot, setActiveSlot] = useState(null)
  const [isCamOpen, setIsCamOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const webcamRef = useRef(null)

  const videoConstraints = { video: { facingMode: 'user' } }
  const countPhotos = ANGULOS.filter(a => !!captures[a.key]).length
  const allFiveReady = countPhotos === 5
  const minPhotosOk = modo === 'actualizar' ? countPhotos >= 1 : allFiveReady

  useEffect(() => {
    Modal.setAppElement('#root')
  }, [])

  // Si cambias de modo, resetea selección
  useEffect(() => {
    setPersonalExistenteId(null)
    setInfoVectores(null)
    setCaptures({
      frontal: null,
      izq45: null,
      der45: null,
      arriba: null,
      abajo: null,
    })
    if (modo === 'registrar') {
      setFormData({
        documento: '',
        nombres: '',
        apellidos: '',
        email: '',
        telefono: '',
        estado: 'inactivo',
        horario_int: '',
        horario_off: '',
      })
    }
  }, [modo])

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

  // ---- Buscar personal por documento (solo en modo "actualizar")
  const buscarPorDocumento = async () => {
    const doc = formData.documento?.trim()
    if (!doc) {
      alert('Ingresa un documento para buscar.')
      return
    }
    try {
      setSaving(true)
      const p = await verPersonalPorDocumento(doc)
      if (!p?.id) {
        setPersonalExistenteId(null)
        setInfoVectores(null)
        alert('No se encontró un personal con ese documento.')
        return
      }
      setPersonalExistenteId(p.id)
      // Rellenar los campos (bloquéalos en modo actualizar)
      setFormData(prev => ({
        ...prev,
        documento: p.documento ?? doc,
        nombres: p.nombres ?? '',
        apellidos: p.apellidos ?? '',
        email: p.email ?? '',
        telefono: p.telefono ?? '',
        estado: p.estado ?? 'activo',
        horario_int: p.horario_int ?? '',
        horario_off: p.horario_off ?? '',
      }))
      // Traer info de vectores
      try {
        const v = await verVectoresPorPersonal(p.id)
        const sizes = [
          'vector1',
          'vector2',
          'vector3',
          'vector4',
          'vector5',
        ].map(k => (v?.[k] ? v[k].length || 1 : 0))
        setInfoVectores({
          tiene: sizes.some(s => s > 0),
          detalle: sizes,
        })
      } catch {
        setInfoVectores(null)
      }
    } catch (err) {
      console.error(err)
      alert('Error al buscar el personal.')
    } finally {
      setSaving(false)
    }
  }

  // Validación simple de hh:mm
  const isTime = t => /^\d{2}:\d{2}$/.test(t)
  const needTimes = modo === 'registrar'
  const validTimes =
    !needTimes || (isTime(formData.horario_int) && isTime(formData.horario_off))

  const handleSubmit = async e => {
    e.preventDefault()

    // ✅ solo validar horarios cuando se registra
    if (!validTimes) {
      alert('Completa horario de entrada y salida en formato HH:MM.')
      return
    }

    if (!minPhotosOk) {
      alert(
        modo === 'actualizar'
          ? 'Para actualizar, captura al menos 1 foto.'
          : 'Debes capturar las 5 fotos (frontal, 45° izq., 45° der., arriba y abajo).'
      )
      return
    }

    try {
      setSaving(true)
      setUploadProgress(0)

      if (modo === 'registrar') {
        // 1) Crear personal (con horarios)
        const creado = await crearPersonal(formData)
        const personalId = creado?.id
        if (!personalId) throw new Error('No se recibió el ID del personal.')

        // 2) Subir 5 fotos
        const files = ANGULOS.map(a => captures[a.key].file)
        await subirFotosPersonal(personalId, files, p => setUploadProgress(p))

        alert('Usuario registrado y fotos subidas correctamente.')
      } else {
        if (!personalExistenteId) {
          alert('Primero busca y selecciona el personal por documento.')
          return
        }
        // 1..5 fotos (al menos 1)
        const files = ANGULOS.map(a => captures[a.key]?.file).filter(Boolean)
        await actualizarFotosPersonal(personalExistenteId, files, p =>
          setUploadProgress(p)
        )
        alert('Fotos actualizadas correctamente.')
      }

      // Reset
      if (modo === 'registrar') {
        setFormData({
          documento: '',
          nombres: '',
          apellidos: '',
          email: '',
          telefono: '',
          estado: 'activo',
          horario_int: '',
          horario_off: '',
        })
      }
      setCaptures({
        frontal: null,
        izq45: null,
        der45: null,
        arriba: null,
        abajo: null,
      })
      setUploadProgress(0)
      if (modo === 'actualizar' && personalExistenteId) {
        try {
          const v = await verVectoresPorPersonal(personalExistenteId)
          const sizes = [
            'vector1',
            'vector2',
            'vector3',
            'vector4',
            'vector5',
          ].map(k => (v?.[k] ? v[k].length || 1 : 0))
          setInfoVectores({
            tiene: sizes.some(s => s > 0),
            detalle: sizes,
          })
        } catch {
          /* noop */
        }
      }
    } catch (err) {
      console.error(err)
      alert('Ocurrió un error.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className='container-fluid mt-4'>
      <div className='d-flex align-items-center justify-content-between'>
        <h3 className='mb-0'>Registrar / Actualizar Usuario</h3>

        {/* Selector de modo */}
        <div className='d-flex align-items-center gap-2'>
          <span className='small text-muted'>Modo:</span>
          <select
            className='form-select form-select-sm'
            style={{ width: 160 }}
            value={modo}
            onChange={e => setModo(e.target.value)}
            disabled={saving}
          >
            <option value='registrar'>Registrar</option>
            <option value='actualizar'>Actualizar (solo fotos)</option>
          </select>
        </div>
      </div>

      <form onSubmit={handleSubmit} className='mt-3'>
        <div className='row'>
          <div className='col-md-4 mb-3'>
            <label className='form-label'>Documento</label>
            <div className='input-group'>
              <input
                className='form-control'
                name='documento'
                value={formData.documento}
                onChange={handleChange}
                required
                disabled={saving}
              />
              {modo === 'actualizar' && (
                <button
                  type='button'
                  className='btn btn-outline-primary'
                  onClick={buscarPorDocumento}
                  disabled={saving || !formData.documento.trim()}
                  title='Buscar por documento'
                >
                  Buscar
                </button>
              )}
            </div>
            {modo === 'actualizar' && personalExistenteId && (
              <div className='form-text'>
                ID encontrado: <b>{personalExistenteId}</b>
              </div>
            )}
          </div>

          <div className='col-md-4 mb-3'>
            <label className='form-label'>Nombres</label>
            <input
              className='form-control'
              name='nombres'
              value={formData.nombres}
              onChange={handleChange}
              required
              disabled={saving || modo === 'actualizar'}
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
              disabled={saving || modo === 'actualizar'}
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
              disabled={saving || modo === 'actualizar'}
            />
          </div>
          <div className='col-md-4 mb-3'>
            <label className='form-label'>Teléfono</label>
            <input
              className='form-control'
              name='telefono'
              value={formData.telefono}
              onChange={handleChange}
              disabled={saving || modo === 'actualizar'}
            />
          </div>

          {/* Horarios */}
          <div className='col-md-2 mb-3'>
            <label className='form-label'>Hora entrada</label>
            <input
              type='time'
              className='form-control'
              name='horario_int'
              value={formData.horario_int}
              onChange={handleChange}
              required={modo === 'registrar'}
              disabled={saving || modo === 'actualizar'}
            />
          </div>
          <div className='col-md-2 mb-3'>
            <label className='form-label'>Hora salida</label>
            <input
              type='time'
              className='form-control'
              name='horario_off'
              value={formData.horario_off}
              onChange={handleChange}
              required={modo === 'registrar'}
              disabled={saving || modo === 'actualizar'}
            />
          </div>
        </div>

        {/* Info vectores (solo modo actualizar) */}
        {modo === 'actualizar' && personalExistenteId && (
          <div className='alert alert-secondary'>
            <div className='d-flex justify-content-between align-items-center'>
              <div>
                <b>Vectores actuales:</b>{' '}
                {infoVectores?.tiene
                  ? 'Sí (mostrando tamaños de blobs)'
                  : 'No registrados'}
              </div>
              {infoVectores?.detalle && (
                <code className='small'>
                  {JSON.stringify(infoVectores.detalle)}
                </code>
              )}
            </div>
            <div className='small text-muted mt-1'>
              *Para actualizar, captura al menos 1 nueva foto. Se reemplazará el
              set completo.
            </div>
          </div>
        )}

        {/* Capturas del rostro */}
        <div className='mt-4'>
          <h5 className='mb-3'>
            Capturas del rostro ({modo === 'actualizar' ? '1–5' : '5'} ángulos)
          </h5>
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
            disabled={
              saving ||
              !minPhotosOk ||
              (modo === 'actualizar' && !personalExistenteId)
            }
          >
            {modo === 'registrar'
              ? 'Registrar y subir fotos'
              : 'Actualizar fotos'}
          </button>
        </div>
      </form>

      {/* Modal */}
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
