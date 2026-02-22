// FormSalida.jsx (Híbrido: precarga desde alistamiento + permite agregar manual)
import { useForm } from 'react-hook-form'
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useLocation } from 'react-router-dom'
import Webcam from 'react-webcam'
import SignatureCanvas from 'react-signature-canvas'

import AuthContext from '../../../context/AuthContext'
import { crearSalida, getInventarioResumen } from './salida_service'

import { obtenerAlistamiento } from '../Movimientos/alistamiento/alistamiento_service'

const pickFirstDefined = (...vals) => vals.find(v => v != null && v !== '')

const toNumberCO = v => {
  if (v == null) return 0
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  if (typeof v === 'string') {
    const s = v.trim().replace(/\s+/g, '').replace(/\./g, '').replace(/,/g, '.')
    const n = parseFloat(s)
    return Number.isNaN(n) ? 0 : n
  }
  const n = Number(v)
  return Number.isNaN(n) ? 0 : n
}

const sortLotesDesc = (a, b) => {
  const na = parseInt((String(a).match(/\d+$/) || [0])[0], 10)
  const nb = parseInt((String(b).match(/\d+$/) || [0])[0], 10)
  if (nb !== na) return nb - na
  return String(b).localeCompare(String(a))
}

const normalizeDetalleToItem = (d, idx) => {
  const id_lote =
    pickFirstDefined(d?.id_lote, d?.Id_lote) ||
    pickFirstDefined(d?.lote?.Id_lote, d?.lote?.id_lote) ||
    ''

  const id_producto =
    pickFirstDefined(d?.id_producto, d?.Id_producto) ||
    pickFirstDefined(d?.producto?.Id_producto, d?.producto?.id_producto) ||
    ''

  const cantidad = toNumberCO(pickFirstDefined(d?.cantidad, d?.Cantidad, 0))

  // 👇 NUEVO: traer bodega y ubicación del alistamiento
  const id_bodega_origen =
    pickFirstDefined(
      d?.id_bodega_origen,
      d?.Id_bodega_origen,
      d?.id_bodega,
      d?.Id_bodega
    ) || ''

  const id_ubicacion_origen =
    pickFirstDefined(
      d?.id_ubicacion_origen,
      d?.Id_ubicacion_origen,
      d?.id_ubicacion,
      d?.Id_ubicacion
    ) || ''

  const nombreProd =
    pickFirstDefined(d?.producto?.Nombre, d?.producto?.nombre) || id_producto

  return {
    id_lote,
    id_producto,
    cantidad,

    id_bodega_origen,
    id_ubicacion_origen,

    evidenciaFile: null,
    evidenciaName: '',

    nombre_producto_view: nombreProd,
    bodega_nombre_view: id_bodega_origen,
    ubicacion_nombre_view: id_ubicacion_origen,

    _from_alistamiento: true,
    _idx: idx,
  }
}

// ================= Component =================
const FormSalida = ({ onSuccess, onClose, alistamientoInicial }) => {
  const { user } = useContext(AuthContext)
  const location = useLocation()

  // ✅ en modal, el dato real llega por props, NO por location.state
  const prefillFromProps = alistamientoInicial || null

  // ✅ por si algún día lo abres por navegación también
  const prefillFromState =
    location.state?.prefillSalida ||
    location.state?.state?.prefillSalida ||
    null

  // ✅ prioridad: props > state
  const [prefillSalida, setPrefillSalida] = useState(
    prefillFromProps || prefillFromState
  )

  // ===== Form encabezado
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    getValues,
    watch,
    formState: { isSubmitting, errors },
  } = useForm({
    defaultValues: {
      id_alistamiento: '',
      comentario: '',
    },
  })

  // ===== Subform para agregar manualmente
  const {
    register: registerItem,
    handleSubmit: handleSubmitItem,
    setValue: setValueItem,
    watch: watchItem,
    formState: { errors: errorsItem },
  } = useForm({
    defaultValues: {
      id_lote_item: '',
      id_producto_item: '',
      cantidad_item: '',
    },
  })

  // ===== Inventario resumen
  const [invResumen, setInvResumen] = useState([])

  // ===== Editor manual
  const [idLoteItem, setIdLoteItem] = useState('')
  const productoItem = watchItem('id_producto_item')
  const [invOpciones, setInvOpciones] = useState([])
  const [opcionSeleccionadaKey, setOpcionSeleccionadaKey] = useState('')
  const [cantidadDisponibleItem, setCantidadDisponibleItem] = useState(null)

  // ===== Ítems salida (híbrido)
  const [items, setItems] = useState([])

  // ===== Mensajes / estado
  const [statusMessage, setStatusMessage] = useState(null)
  const [procesando, setProcesando] = useState(false)

  // ===== Cámara evidencia por ítem
  const [cameraIndex, setCameraIndex] = useState(null)
  const webcamRef = useRef(null)

  // ===== Firmas globales
  const firmaRefs = {
    autorizador: useRef(),
    conductor: useRef(),
    receptor: useRef(),
  }
  const [firmaActual, setFirmaActual] = useState(null)
  const [firmas, setFirmas] = useState({})

  // ================= UI helpers =================
  const preventEnterSubmit = e => {
    if (e.key === 'Enter') e.preventDefault()
  }

  // ✅ si el modal abre con un alistamiento, lo seteamos acá
  useEffect(() => {
    if (alistamientoInicial) setPrefillSalida(alistamientoInicial)
  }, [alistamientoInicial])

  // ================= Persistencia del prefill (solo para navegación, no estorba modal) =================
  useEffect(() => {
    // si viene del modal, NO sobrescribimos con sessionStorage
    if (prefillFromProps) return

    if (prefillFromState) {
      try {
        sessionStorage.setItem(
          'prefillSalida',
          JSON.stringify(prefillFromState)
        )
      } catch {
        /* empty */
      }
      setPrefillSalida(prefillFromState)
      return
    }

    try {
      const saved = sessionStorage.getItem('prefillSalida')
      if (saved) setPrefillSalida(JSON.parse(saved))
    } catch {
      /* empty */
    }
  }, [prefillFromState, prefillFromProps])

  // ================= Cargar inventario resumen =================
  useEffect(() => {
    const fetchData = async () => {
      try {
        const resumenData = await getInventarioResumen()
        setInvResumen(Array.isArray(resumenData) ? resumenData : [])
      } catch (e) {
        console.error('Error cargando inventario resumen', e)
        setStatusMessage({
          type: 'error',
          text: 'Error cargando inventario resumen.',
        })
        setTimeout(() => setStatusMessage(null), 2000)
      }
    }
    fetchData()
  }, [])

  // ================= Lotes disponibles (desc) =================
  const lotesDisponibles = useMemo(() => {
    const set = new Set(
      invResumen
        .map(r => pickFirstDefined(r?.Id_lote, r?.id_lote))
        .filter(Boolean)
    )
    return Array.from(set).sort(sortLotesDesc)
  }, [invResumen])

  // ================= Productos disponibles por lote =================
  const productosDisponibles = useMemo(() => {
    if (!idLoteItem) return []
    const map = new Map()
    invResumen.forEach(r => {
      const id_lote = pickFirstDefined(r?.Id_lote, r?.id_lote)
      if (id_lote !== idLoteItem) return

      const id_producto = pickFirstDefined(r?.Id_producto, r?.id_producto)
      if (!id_producto) return

      const nombre =
        pickFirstDefined(r?.Nombre_Producto, r?.Producto?.Nombre) || id_producto
      if (!map.has(id_producto)) map.set(id_producto, nombre)
    })
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => String(a.name).localeCompare(String(b.name), 'es'))
  }, [invResumen, idLoteItem])

  // ================= Opciones Bodega/Ubicación (manual editor) =================
  useEffect(() => {
    setInvOpciones([])
    setOpcionSeleccionadaKey('')
    setCantidadDisponibleItem(null)

    if (!idLoteItem || !productoItem) return

    const rows = invResumen.filter(r => {
      const id_lote = pickFirstDefined(r?.Id_lote, r?.id_lote)
      const id_prod = pickFirstDefined(r?.Id_producto, r?.id_producto)
      return id_lote === idLoteItem && id_prod === productoItem
    })

    const map = new Map()
    rows.forEach(r => {
      const id_bodega =
        pickFirstDefined(
          r?.id_bodega,
          r?.Id_bodega,
          r?.Bodega?.Id,
          r?.BodegaId
        ) || ''
      const bodegaNombre =
        pickFirstDefined(r?.Bodega?.Nombre, r?.BodegaNombre, r?.Bodega) || ''
      const id_ubicacion =
        pickFirstDefined(
          r?.id_ubicacion,
          r?.Id_ubicacion,
          r?.Ubicacion?.Id,
          r?.UbicacionId
        ) || ''
      const ubicacionNombre =
        pickFirstDefined(
          r?.Ubicacion?.Nombre,
          r?.UbicacionNombre,
          r?.Ubicacion,
          r?.ubicacion
        ) || ''
      const cantidad = toNumberCO(
        pickFirstDefined(
          r?.Cantidad_Inventario,
          r?.Cantidad,
          r?.Cantidad_Lote,
          0
        )
      )

      const key = `${id_bodega}|${id_ubicacion}`
      if (!map.has(key)) {
        map.set(key, {
          key,
          id_bodega,
          bodegaNombre,
          id_ubicacion,
          ubicacionNombre,
          cantidad: 0,
        })
      }
      map.get(key).cantidad += cantidad
    })

    const opciones = Array.from(map.values())
      .filter(
        op => (op.id_bodega || op.id_ubicacion) && toNumberCO(op.cantidad) > 0
      )
      .sort((a, b) => toNumberCO(b.cantidad) - toNumberCO(a.cantidad))

    setInvOpciones(opciones)

    if (opciones.length === 1) {
      setOpcionSeleccionadaKey(opciones[0].key)
      setCantidadDisponibleItem(toNumberCO(opciones[0].cantidad))
    }
  }, [idLoteItem, productoItem, invResumen])

  // ================= Opciones por Lote+Producto (para filas precargadas) =================
  const opcionesPorLoteProducto = useMemo(() => {
    const map = new Map()

    invResumen.forEach(r => {
      const id_lote = pickFirstDefined(r?.Id_lote, r?.id_lote)
      const id_prod = pickFirstDefined(r?.Id_producto, r?.id_producto)
      if (!id_lote || !id_prod) return

      const id_bodega =
        pickFirstDefined(
          r?.id_bodega,
          r?.Id_bodega,
          r?.Bodega?.Id,
          r?.BodegaId
        ) || ''
      const bodegaNombre =
        pickFirstDefined(r?.Bodega?.Nombre, r?.BodegaNombre, r?.Bodega) || ''
      const id_ubicacion =
        pickFirstDefined(
          r?.id_ubicacion,
          r?.Id_ubicacion,
          r?.Ubicacion?.Id,
          r?.UbicacionId
        ) || ''
      const ubicacionNombre =
        pickFirstDefined(
          r?.Ubicacion?.Nombre,
          r?.UbicacionNombre,
          r?.Ubicacion,
          r?.ubicacion
        ) || ''

      const cantidad = toNumberCO(
        pickFirstDefined(
          r?.Cantidad_Inventario,
          r?.Cantidad,
          r?.Cantidad_Lote,
          0
        )
      )

      const lk = `${id_lote}__${id_prod}`
      if (!map.has(lk)) map.set(lk, new Map())

      const bucket = map.get(lk)
      const key = `${id_bodega}|${id_ubicacion}`

      if (!bucket.has(key)) {
        bucket.set(key, {
          key,
          id_bodega,
          bodegaNombre,
          id_ubicacion,
          ubicacionNombre,
          cantidad: 0,
        })
      }
      bucket.get(key).cantidad += cantidad
    })

    const out = new Map()
    for (const [lk, bucket] of map.entries()) {
      const opciones = Array.from(bucket.values())
        .filter(
          op => (op.id_bodega || op.id_ubicacion) && toNumberCO(op.cantidad) > 0
        )
        .sort((a, b) => toNumberCO(b.cantidad) - toNumberCO(a.cantidad))
      out.set(lk, opciones)
    }
    return out
  }, [invResumen])

  const getOpcionesFila = useCallback(
    (id_lote, id_producto) => {
      const lk = `${String(id_lote)}__${String(id_producto)}`
      return opcionesPorLoteProducto.get(lk) || []
    },
    [opcionesPorLoteProducto]
  )

  // ================= Precarga desde Alistamiento =================
  const cargarDesdeAlistamiento = useCallback(
    async (prefill, modo = 'REEMPLAZAR') => {
      if (!prefill) return

      let data = prefill

      const prefillId = pickFirstDefined(
        data?.id_alistamiento,
        data?.Id_alistamiento
      )

      const traeDetalles =
        Array.isArray(data?.detalles) && data.detalles.length > 0

      if (!traeDetalles && prefillId) {
        try {
          data = await obtenerAlistamiento(prefillId)
        } catch (e) {
          console.error(e)
          setStatusMessage({
            type: 'error',
            text:
              e?.response?.data?.message ||
              e?.message ||
              'No se pudo cargar el alistamiento.',
          })
          setTimeout(() => setStatusMessage(null), 2500)
          return
        }
      }

      const id_alist = pickFirstDefined(
        data?.id_alistamiento,
        data?.Id_alistamiento
      )

      const detalles = Array.isArray(data?.detalles) ? data.detalles : []

      if (!id_alist || !detalles.length) {
        setStatusMessage({
          type: 'error',
          text: 'El alistamiento no trae detalles para precargar.',
        })
        setTimeout(() => setStatusMessage(null), 2500)
        return
      }

      reset({
        id_alistamiento: String(id_alist),
        comentario: String(data?.observaciones || ''),
      })
      setValue('id_alistamiento', String(id_alist))

      console.log('DETALLES QUE LLEGAN:', detalles)

      const nuevos = detalles.map((d, idx) => normalizeDetalleToItem(d, idx))

      setItems(prev => {
        if (modo === 'SUMAR') return [...prev, ...nuevos]
        return nuevos
      })

      setStatusMessage({
        type: 'success',
        text: `Ítems cargados desde alistamiento #${id_alist}`,
      })
      setTimeout(() => setStatusMessage(null), 2000)
    },
    [reset, setValue]
  )

  // ✅ auto-precarga (modal o navegación)
  useEffect(() => {
    if (prefillSalida) cargarDesdeAlistamiento(prefillSalida, 'REEMPLAZAR')
  }, [prefillSalida, cargarDesdeAlistamiento])

  // ================= Acciones items =================
  const setUbicacionParaItem = (idx, key) => {
    setItems(prev => {
      const copy = [...prev]
      const it = copy[idx]
      const opts = getOpcionesFila(it.id_lote, it.id_producto)
      const op = opts.find(o => o.key === key)

      copy[idx] = {
        ...it,
        id_bodega_origen: op?.id_bodega || '',
        id_ubicacion_origen: op?.id_ubicacion || '',
        bodega_nombre_view: op?.bodegaNombre || op?.id_bodega || '',
        ubicacion_nombre_view: op?.ubicacionNombre || op?.id_ubicacion || '',
      }
      return copy
    })
  }

  const onFileForItem = (idx, file) => {
    setItems(prev => {
      const copy = [...prev]
      copy[idx] = {
        ...copy[idx],
        evidenciaFile: file || null,
        evidenciaName: file?.name || '',
      }
      return copy
    })
  }

  const updateCantidadItem = (idx, value) => {
    const cant = toNumberCO(value)
    setItems(prev => {
      const copy = [...prev]
      copy[idx] = { ...copy[idx], cantidad: cant }
      return copy
    })
  }

  const removeItem = idx => setItems(prev => prev.filter((_, i) => i !== idx))

  // ================= Cámara =================
  const openCameraForItem = idx => setCameraIndex(idx)
  const closeCamera = () => setCameraIndex(null)

  const captureForItem = () => {
    const imageSrc = webcamRef.current?.getScreenshot()
    if (!imageSrc) return

    fetch(imageSrc)
      .then(r => r.blob())
      .then(blob => {
        const file = new File(
          [blob],
          `foto-item-${cameraIndex}-${Date.now()}.jpg`,
          { type: 'image/jpeg' }
        )
        onFileForItem(cameraIndex, file)
        setCameraIndex(null)
      })
      .catch(err => console.error(err))
  }

  // ================= Firmas =================
  const guardarFirma = tipo => {
    const canvas = firmaRefs[tipo]?.current
    if (!canvas || canvas.isEmpty()) {
      setStatusMessage({ type: 'error', text: 'La firma está vacía.' })
      setTimeout(() => setStatusMessage(null), 2000)
      return
    }

    const b64 = canvas.toDataURL('image/png')
    setFirmas(prev => ({ ...prev, [tipo]: b64 }))
    setFirmaActual(null)

    setStatusMessage({ type: 'success', text: `Firma ${tipo} guardada.` })
    setTimeout(() => setStatusMessage(null), 1200)
  }

  const limpiarFirma = tipo => firmaRefs[tipo]?.current?.clear()

  // ================= Agregar manual =================
  const onAddItem = handleSubmitItem(
    ({ id_lote_item, id_producto_item, cantidad_item }) => {
      const cant = toNumberCO(cantidad_item)
      if (!id_lote_item || !id_producto_item || !cant || cant <= 0) return

      const op = invOpciones.find(o => o.key === opcionSeleccionadaKey)
      if (!op) {
        setStatusMessage({
          type: 'error',
          text: 'Selecciona Bodega/Ubicación.',
        })
        setTimeout(() => setStatusMessage(null), 2000)
        return
      }

      if (cantidadDisponibleItem != null && cant > cantidadDisponibleItem) {
        setStatusMessage({
          type: 'error',
          text: `No hay suficiente inventario en la ubicación seleccionada (máx: ${cantidadDisponibleItem}).`,
        })
        setTimeout(() => setStatusMessage(null), 2500)
        return
      }

      const prodNombre =
        productosDisponibles.find(p => p.id === id_producto_item)?.name ||
        id_producto_item

      const nuevo = {
        id_lote: id_lote_item,
        id_producto: id_producto_item,
        cantidad: cant,

        id_bodega_origen: op.id_bodega || '',
        id_ubicacion_origen: op.id_ubicacion || '',

        evidenciaFile: null,
        evidenciaName: '',

        nombre_producto_view: prodNombre,
        bodega_nombre_view: op.bodegaNombre || op.id_bodega || '',
        ubicacion_nombre_view: op.ubicacionNombre || op.id_ubicacion || '',

        _from_alistamiento: false,
      }

      setItems(prev => [...prev, nuevo])

      setValueItem('id_lote_item', '')
      setValueItem('id_producto_item', '')
      setValueItem('cantidad_item', '')
      setIdLoteItem('')
      setInvOpciones([])
      setOpcionSeleccionadaKey('')
      setCantidadDisponibleItem(null)
    }
  )

  // ================= Validaciones globales =================
  const allItemsHaveEvidence =
    items.length > 0 && items.every(it => !!it.evidenciaFile)

  const allItemsHaveUbicacion =
    items.length > 0 &&
    items.every(it => !!it.id_bodega_origen && !!it.id_ubicacion_origen)

  // ================= Submit (procesar salida NUEVA) =================
  const procesarSalidas = async data => {
    const id_alist = String(data?.id_alistamiento || '').trim()

    // ❌ Ya NO validamos que sea obligatorio

    if (!items.length) {
      setStatusMessage({ type: 'error', text: 'Agrega al menos un ítem.' })
      setTimeout(() => setStatusMessage(null), 2000)
      return
    }

    if (!allItemsHaveUbicacion) {
      setStatusMessage({
        type: 'error',
        text: 'Todos los ítems deben tener Bodega y Ubicación.',
      })
      setTimeout(() => setStatusMessage(null), 2400)
      return
    }

    if (!allItemsHaveEvidence) {
      setStatusMessage({
        type: 'error',
        text: 'Todos los ítems requieren evidencia.',
      })
      setTimeout(() => setStatusMessage(null), 2200)
      return
    }

    // 🔹 Payload items (sin evidencia, va por separado)
    const itemsPayload = items.map(it => ({
      id_lote: String(it.id_lote),
      id_producto: String(it.id_producto),
      cantidad: toNumberCO(it.cantidad),
      id_bodega_origen: String(it.id_bodega_origen),
      id_ubicacion_origen: String(it.id_ubicacion_origen),
    }))

    const formData = new FormData()

    // ✅ Solo enviamos id_alistamiento si existe
    if (id_alist) {
      formData.append('id_alistamiento', id_alist)
    }

    formData.append('comentario', data?.comentario || '')

    // obligatorio según tu validator
    formData.append('nombre', 'AUTO')

    formData.append(
      'id_personal',
      user?.personal?.id_personal || user?.id_usuario || ''
    )

    // items como JSON string
    formData.append('items', JSON.stringify(itemsPayload))

    // evidencias (una por ítem en el mismo orden)
    items.forEach(it => {
      formData.append('evidencias', it.evidenciaFile)
    })

    // firmas opcionales
    formData.append('firma_autorizador', firmas.autorizador || '')
    formData.append('firma_conductor', firmas.conductor || '')
    formData.append('firma_receptor', firmas.receptor || '')

    setProcesando(true)

    try {
      await crearSalida(formData)

      setStatusMessage({ type: 'success', text: 'Salida registrada.' })
      setTimeout(() => setStatusMessage(null), 1500)

      setProcesando(false)

      reset({ id_alistamiento: '', comentario: '' })
      setItems([])
      setInvOpciones([])
      setOpcionSeleccionadaKey('')
      setCantidadDisponibleItem(null)
      setFirmas({})
      setFirmaActual(null)

      try {
        sessionStorage.removeItem('prefillSalida')
      } catch {
        /* empty */
      }

      onSuccess?.()
    } catch (e) {
      setProcesando(false)
      setStatusMessage({
        type: 'error',
        text: e?.response?.data?.message || e?.message || 'Error en salida',
      })
      setTimeout(() => setStatusMessage(null), 2500)
    }
  }

  const totalCantidad = useMemo(() => {
    return items.reduce((acc, it) => acc + toNumberCO(it.cantidad), 0)
  }, [items])

  const idAlistValue = getValues('id_alistamiento')

  return (
    <div className='container-fluid mt-3'>
      <div className='d-flex align-items-center justify-content-between mb-2'>
        <h5 className='fw-bold text-center m-0 flex-grow-1'>
          Registrar Salida (híbrido)
        </h5>

        {typeof onClose === 'function' && (
          <button
            type='button'
            className='btn btn-outline-secondary btn-sm ms-2'
            onClick={onClose}
          >
            Cerrar
          </button>
        )}
      </div>

      {statusMessage && (
        <div
          className='position-sticky top-0'
          style={{
            zIndex: 1200,
            borderRadius: 8,
            padding: '8px 12px',
            background:
              statusMessage.type === 'success' ? '#00BA59' : '#F74C1B',
            color: 'white',
            boxShadow: '0 6px 20px rgba(0,0,0,.15)',
            textAlign: 'center',
            marginBottom: 8,
          }}
          role='status'
        >
          {statusMessage.text}
        </div>
      )}

      <form
        onSubmit={handleSubmit(procesarSalidas)}
        onKeyDown={preventEnterSubmit}
        className='mt-1'
      >
        {/* ===== Encabezado ===== */}
        <div className='row g-2'>
          <div className='col-md-4'>
            <label className='form-label mb-1'>ID Alistamiento (origen)</label>
            <input
              className={`form-control form-control-sm`}
              readOnly
              {...register('id_alistamiento')}
              value={watch('id_alistamiento') || ''}
            />
            {errors.id_alistamiento && (
              <div className='invalid-feedback'>Obligatorio</div>
            )}
          </div>

          <div className='col-md-8'>
            <label className='form-label mb-1'>Comentario (global)</label>
            <input
              type='text'
              className={`form-control form-control-sm ${
                errors.comentario ? 'is-invalid' : ''
              }`}
              placeholder='Notas u observaciones…'
              {...register('comentario', { required: true })}
            />
            {errors.comentario && (
              <div className='invalid-feedback'>Campo requerido</div>
            )}
          </div>
        </div>

        {/* ===== Acciones de precarga ===== */}
        <div className='d-flex flex-wrap gap-2 mt-2'>
          <button
            type='button'
            className='btn btn-outline-primary btn-sm'
            onClick={() => {
              const id = String(idAlistValue || '').trim()
              if (!id) {
                setStatusMessage({
                  type: 'error',
                  text: 'Primero debe existir el ID de alistamiento.',
                })
                setTimeout(() => setStatusMessage(null), 1800)
                return
              }
              cargarDesdeAlistamiento({ id_alistamiento: id }, 'REEMPLAZAR')
            }}
          >
            Cargar ítems del alistamiento
          </button>

          <button
            type='button'
            className='btn btn-outline-secondary btn-sm'
            disabled={!items.length}
            onClick={() => setItems([])}
          >
            Vaciar lista
          </button>

          <div className='ms-auto small text-muted d-flex align-items-center'>
            Ítems: <b className='ms-1'>{items.length}</b> — Total Cantidad:{' '}
            <b className='ms-1'>{totalCantidad}</b>
          </div>
        </div>

        {/* ===== Editor manual ===== */}
        <div className='mt-3 p-2 border rounded' onKeyDown={preventEnterSubmit}>
          <div className='small text-muted fw-semibold mb-2'>
            Agregar ítem manual (se mezcla con lo precargado)
          </div>

          <div className='row g-2 align-items-end'>
            <div className='col-md-3'>
              <label className='form-label mb-1'>Lote</label>
              <select
                className={`form-select form-select-sm ${
                  errorsItem.id_lote_item ? 'is-invalid' : ''
                }`}
                {...registerItem('id_lote_item', { required: true })}
                onChange={e => {
                  const v = e.target.value
                  setIdLoteItem(v)
                  setValueItem('id_lote_item', v)
                  setValueItem('id_producto_item', '')
                  setInvOpciones([])
                  setOpcionSeleccionadaKey('')
                  setCantidadDisponibleItem(null)
                }}
                value={idLoteItem}
              >
                <option value=''>Selecciona un lote</option>
                {lotesDisponibles.map(lote => (
                  <option key={lote} value={lote}>
                    {lote}
                  </option>
                ))}
              </select>
              {errorsItem.id_lote_item && (
                <div className='invalid-feedback'>Obligatorio</div>
              )}
            </div>

            <div className='col-md-4'>
              <label className='form-label mb-1'>Producto</label>
              <select
                className={`form-select form-select-sm ${
                  errorsItem.id_producto_item ? 'is-invalid' : ''
                }`}
                {...registerItem('id_producto_item', { required: true })}
              >
                <option value=''>Selecciona un producto</option>
                {productosDisponibles.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.id})
                  </option>
                ))}
              </select>
              {errorsItem.id_producto_item && (
                <div className='invalid-feedback'>Obligatorio</div>
              )}
            </div>

            <div className='col-md-3'>
              <label className='form-label mb-1'>Bodega / Ubicación</label>
              <select
                className='form-select form-select-sm'
                value={opcionSeleccionadaKey}
                onChange={e => {
                  const k = e.target.value
                  setOpcionSeleccionadaKey(k)
                  const op = invOpciones.find(o => o.key === k)
                  setCantidadDisponibleItem(op ? toNumberCO(op.cantidad) : null)
                }}
                disabled={invOpciones.length === 0}
              >
                <option value=''>
                  {invOpciones.length
                    ? 'Selecciona ubicación'
                    : 'Sin ubicaciones con stock'}
                </option>
                {invOpciones.map(op => (
                  <option key={op.key} value={op.key}>
                    {op.bodegaNombre || op.id_bodega || '—'} →{' '}
                    {op.ubicacionNombre || op.id_ubicacion || '—'} — Cant:{' '}
                    {toNumberCO(op.cantidad)}
                  </option>
                ))}
              </select>
            </div>

            <div className='col-md-2'>
              <label className='form-label mb-1'>Cantidad</label>
              <input
                type='number'
                min='0'
                step='any'
                className={`form-control form-control-sm ${
                  errorsItem.cantidad_item ? 'is-invalid' : ''
                }`}
                {...registerItem('cantidad_item', {
                  required: 'Obligatorio',
                  validate: v =>
                    cantidadDisponibleItem == null ||
                    toNumberCO(v) <= cantidadDisponibleItem ||
                    `Máximo disponible en la ubicación: ${cantidadDisponibleItem}`,
                })}
              />
              {errorsItem.cantidad_item && (
                <div className='invalid-feedback'>
                  {errorsItem.cantidad_item.message || 'Inválida'}
                </div>
              )}
            </div>

            <div className='col-md-3 mt-2'>
              <button
                type='button'
                className='btn btn-primary btn-sm w-100'
                onClick={onAddItem}
              >
                Agregar ítem
              </button>
            </div>
          </div>
        </div>

        {/* ===== Tabla ítems ===== */}
        <div className='mt-3'>
          <div className='table-responsive'>
            <table className='table table-sm table-striped align-middle'>
              <thead>
                <tr>
                  <th>#</th>
                  <th style={{ width: 120 }}>Lote</th>
                  <th>Producto</th>
                  <th style={{ width: 140 }} className='text-end'>
                    Cantidad
                  </th>
                  <th style={{ minWidth: 320 }}>Bodega / Ubicación</th>
                  <th>Evidencia</th>
                  <th style={{ width: 120 }}></th>
                </tr>
              </thead>

              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan='7' className='text-center text-muted'>
                      Sin ítems
                    </td>
                  </tr>
                ) : (
                  items.map((it, idx) => {
                    const opcionesFila = getOpcionesFila(
                      it.id_lote,
                      it.id_producto
                    )
                    const selectedKey = `${it.id_bodega_origen || ''}|${
                      it.id_ubicacion_origen || ''
                    }`

                    return (
                      <tr key={`${it.id_lote}-${it.id_producto}-${idx}`}>
                        <td>{idx + 1}</td>
                        <td className='fw-semibold'>
                          {it.id_lote || <span className='text-muted'>—</span>}
                        </td>
                        <td>
                          {it.nombre_producto_view
                            ? `${it.nombre_producto_view} (${it.id_producto})`
                            : it.id_producto}
                          {it._from_alistamiento && (
                            <span className='badge bg-info text-dark ms-2'>
                              alistamiento
                            </span>
                          )}
                        </td>

                        <td className='text-end'>
                          <input
                            type='number'
                            min='0'
                            step='any'
                            className='form-control form-control-sm text-end'
                            value={it.cantidad}
                            onChange={e =>
                              updateCantidadItem(idx, e.target.value)
                            }
                            disabled={procesando}
                          />
                        </td>

                        <td>
                          <select
                            className={`form-select form-select-sm ${
                              !it.id_bodega_origen || !it.id_ubicacion_origen
                                ? 'is-invalid'
                                : ''
                            }`}
                            value={
                              it.id_bodega_origen && it.id_ubicacion_origen
                                ? selectedKey
                                : ''
                            }
                            onChange={e =>
                              setUbicacionParaItem(idx, e.target.value)
                            }
                            disabled={procesando}
                          >
                            <option value=''>
                              {opcionesFila.length
                                ? 'Selecciona bodega/ubicación'
                                : 'Sin ubicaciones con stock'}
                            </option>
                            {opcionesFila.map(op => (
                              <option key={op.key} value={op.key}>
                                {op.bodegaNombre || op.id_bodega || '—'} →{' '}
                                {op.ubicacionNombre || op.id_ubicacion || '—'} —
                                Cant: {toNumberCO(op.cantidad)}
                              </option>
                            ))}
                          </select>

                          {(!it.id_bodega_origen ||
                            !it.id_ubicacion_origen) && (
                            <div className='invalid-feedback d-block'>
                              Selecciona bodega/ubicación
                            </div>
                          )}
                        </td>

                        <td>
                          <div className='d-flex flex-column gap-1'>
                            <div className='d-flex gap-2'>
                              <button
                                type='button'
                                className='btn btn-outline-secondary btn-sm'
                                onClick={() => openCameraForItem(idx)}
                                disabled={procesando}
                              >
                                Cámara
                              </button>
                              <button
                                type='button'
                                className='btn btn-outline-secondary btn-sm'
                                onClick={() =>
                                  document
                                    .getElementById(`file-item-${idx}`)
                                    ?.click()
                                }
                                disabled={procesando}
                              >
                                Subir
                              </button>
                            </div>

                            <input
                              id={`file-item-${idx}`}
                              type='file'
                              accept='image/*'
                              hidden
                              onChange={e =>
                                onFileForItem(idx, e.target.files?.[0] || null)
                              }
                            />

                            <div className='small'>
                              {it.evidenciaName ? (
                                <span className='text-success'>
                                  Archivo: <strong>{it.evidenciaName}</strong>
                                </span>
                              ) : (
                                <span className='text-danger'>
                                  Sin evidencia
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className='text-end'>
                          <button
                            type='button'
                            className='btn btn-outline-danger btn-sm'
                            onClick={() => removeItem(idx)}
                            disabled={procesando}
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {cameraIndex !== null && (
            <div className='mt-2 border rounded p-2'>
              <div className='d-flex justify-content-between align-items-center mb-2'>
                <div className='fw-semibold'>
                  Cámara para ítem #{cameraIndex + 1}
                </div>
                <button
                  type='button'
                  className='btn btn-outline-dark btn-sm'
                  onClick={closeCamera}
                >
                  Cerrar
                </button>
              </div>

              <div className='ratio ratio-16x9'>
                <Webcam
                  ref={webcamRef}
                  screenshotFormat='image/jpeg'
                  className='w-100 h-100'
                />
              </div>

              <div className='d-flex justify-content-center gap-2 mt-2'>
                <button
                  type='button'
                  className='btn btn-primary btn-sm'
                  onClick={captureForItem}
                >
                  Capturar
                </button>
                <button
                  type='button'
                  className='btn btn-outline-danger btn-sm'
                  onClick={closeCamera}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ===== Firmas ===== */}
        <div className='row g-2 mt-2'>
          {['autorizador', 'conductor', 'receptor'].map(tipo => (
            <div key={tipo} className='col-md-4'>
              <div className='border rounded p-2 h-100'>
                <div className='small text-muted mb-1'>Firma {tipo}</div>

                {firmaActual === tipo ? (
                  <>
                    <SignatureCanvas
                      ref={firmaRefs[tipo]}
                      canvasProps={{
                        className: 'w-100',
                        style: { border: '1px dashed #ccc', height: 140 },
                      }}
                    />
                    <div className='d-flex gap-2 mt-2'>
                      <button
                        type='button'
                        className='btn btn-primary btn-sm'
                        onClick={() => guardarFirma(tipo)}
                      >
                        Guardar
                      </button>
                      <button
                        type='button'
                        className='btn btn-outline-secondary btn-sm'
                        onClick={() => limpiarFirma(tipo)}
                      >
                        Limpiar
                      </button>
                      <button
                        type='button'
                        className='btn btn-outline-dark btn-sm'
                        onClick={() => setFirmaActual(null)}
                      >
                        Cancelar
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    type='button'
                    className={`btn btn-sm ${
                      firmas[tipo] ? 'btn-success' : 'btn-outline-primary'
                    }`}
                    onClick={() => setFirmaActual(tipo)}
                  >
                    {firmas[tipo] ? 'Firmado ✅' : 'Firmar ✍️'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* ===== Submit ===== */}
        <div className='d-flex justify-content-end gap-2 mt-3'>
          <button
            type='submit'
            className='btn btn-primary btn-sm'
            disabled={
              isSubmitting ||
              !items.length ||
              !allItemsHaveEvidence ||
              !allItemsHaveUbicacion ||
              procesando
            }
          >
            {procesando ? 'Procesando…' : 'Procesar salida'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default FormSalida
