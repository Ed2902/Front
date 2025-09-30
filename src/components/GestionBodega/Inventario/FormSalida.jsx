// src/components/Inventario/Salidas/FormSalidaLotes.jsx

import { useForm } from 'react-hook-form'
import { useEffect, useMemo, useState, useContext, useRef } from 'react'
import SignatureCanvas from 'react-signature-canvas'
import AuthContext from '../../../context/AuthContext'
import {
  getOperaciones,
  crearSalida,
  crearDocumentoSalida, // se usa al final de procesarSalidas
} from './salida_service'
import { getInventarioResumen } from './inventario_service'
import Webcam from 'react-webcam'

// ===== Helpers
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
const numeroDeOP = id => Number(String(id || '').replace(/^OP/i, '')) || 0
const sortLotesDesc = (a, b) => {
  const na = parseInt((String(a).match(/\d+$/) || [0])[0], 10)
  const nb = parseInt((String(b).match(/\d+$/) || [0])[0], 10)
  if (nb !== na) return nb - na
  return String(b).localeCompare(String(a))
}

const FormSalidaLotes = ({ onSuccess }) => {
  const { user } = useContext(AuthContext)

  // Form principal (globales)
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors },
  } = useForm()

  // Sub-form (ítem)
  const {
    register: registerItem,
    handleSubmit: handleSubmitItem,
    setValue: setValueItem,
    watch: watchItem,
    formState: { errors: errorsItem },
  } = useForm()

  // ===== Catálogos
  const [invResumen, setInvResumen] = useState([])
  const [operaciones, setOperaciones] = useState([])

  // ===== Estado del editor de ítem
  const [idLoteItem, setIdLoteItem] = useState('')
  const productoItem = watchItem('id_producto_item')

  // Opciones de Bodega/Ubicación con stock para el lote+producto
  const [invOpciones, setInvOpciones] = useState([])
  const [opcionSeleccionadaKey, setOpcionSeleccionadaKey] = useState('')
  const [cantidadDisponibleItem, setCantidadDisponibleItem] = useState(null)

  // Carrito
  const [items, setItems] = useState([])

  // Cámara por ítem
  const [cameraIndex, setCameraIndex] = useState(null)
  const webcamRef = useRef(null)

  // Firmas globales
  const firmaRefs = {
    autorizador: useRef(),
    conductor: useRef(),
    receptor: useRef(),
  }
  const [firmaActual, setFirmaActual] = useState(null)
  const [firmas, setFirmas] = useState({})

  // Mensajes / progreso
  const [statusMessage, setStatusMessage] = useState(null)
  const [procesando, setProcesando] = useState(false)
  const [progreso, setProgreso] = useState([])

  // PDF generado
  const [docGenerado, setDocGenerado] = useState(null) // { id, url }

  // ===== Carga inicial
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [resumenData, operacionesData] = await Promise.all([
          getInventarioResumen(),
          getOperaciones(),
        ])
        setInvResumen(Array.isArray(resumenData) ? resumenData : [])
        const ordenadas = (operacionesData || [])
          .filter(op => !!op?.id_operacion)
          .sort(
            (a, b) => numeroDeOP(b.id_operacion) - numeroDeOP(a.id_operacion)
          )
        setOperaciones(ordenadas)
      } catch (e) {
        console.error('Error cargando catálogos', e)
      }
    }
    fetchData()
  }, [])

  // ===== Lotes únicos ordenados desc
  const lotesDisponibles = useMemo(() => {
    const set = new Set(
      invResumen
        .map(r => pickFirstDefined(r?.Id_lote, r?.id_lote))
        .filter(Boolean)
    )
    return Array.from(set).sort(sortLotesDesc)
  }, [invResumen])

  // ===== Productos por lote
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

  // ===== Opciones de Bodega/Ubicación con stock
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

  // ===== Firmas
  const guardarFirma = tipo => {
    const canvas = firmaRefs[tipo].current
    if (!canvas || canvas.isEmpty()) return alert('Firma vacía')
    const b64 = canvas.toDataURL('image/png')
    setFirmas(prev => ({ ...prev, [tipo]: b64 }))
    setFirmaActual(null)
  }
  const limpiarFirma = tipo => firmaRefs[tipo].current?.clear()

  // ===== Evidencia por ítem
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
  const openCameraForItem = idx => setCameraIndex(idx)
  const closeCamera = () => setCameraIndex(null)
  const captureForItem = () => {
    const imageSrc = webcamRef.current.getScreenshot()
    fetch(imageSrc)
      .then(r => r.blob())
      .then(blob => {
        const file = new File(
          [blob],
          `foto-item-${cameraIndex}-${Date.now()}.jpg`,
          {
            type: 'image/jpeg',
          }
        )
        onFileForItem(cameraIndex, file)
        setCameraIndex(null)
      })
  }

  // Evitar submit con Enter dentro del editor de ítems
  const preventEnterSubmit = e => {
    if (e.key === 'Enter') e.preventDefault()
  }

  // ===== Agregar ítem
  const onAddItem = handleSubmitItem(
    ({ id_lote_item, id_producto_item, cantidad_item }) => {
      const cant = Number(cantidad_item)
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
        id_producto: id_producto_item, // enviar solo código
        cantidad: cant,
        id_bodega_origen: op.id_bodega || '',
        id_ubicacion_origen: op.id_ubicacion || '',
        evidenciaFile: null,
        evidenciaName: '',
        // solo visual
        nombre_producto_view: prodNombre,
        bodega_nombre_view: op.bodegaNombre || op.id_bodega || '',
        ubicacion_nombre_view: op.ubicacionNombre || op.id_ubicacion || '',
      }

      // Unificar por Lote+Producto+Bodega+Ubicación
      setItems(prev => {
        const idx = prev.findIndex(
          it =>
            it.id_lote === nuevo.id_lote &&
            it.id_producto === nuevo.id_producto &&
            it.id_bodega_origen === nuevo.id_bodega_origen &&
            it.id_ubicacion_origen === nuevo.id_ubicacion_origen
        )
        if (idx >= 0) {
          const copy = [...prev]
          copy[idx] = { ...copy[idx], cantidad: copy[idx].cantidad + cant }
          return copy
        }
        return [...prev, nuevo]
      })

      // Limpiar sub-form
      setValueItem('id_lote_item', '')
      setValueItem('id_producto_item', '')
      setValueItem('cantidad_item', '')
      setIdLoteItem('')
      setInvOpciones([])
      setOpcionSeleccionadaKey('')
      setCantidadDisponibleItem(null)
    }
  )

  const removeItem = idx => setItems(prev => prev.filter((_, i) => i !== idx))

  // ===== Procesar todo (incluye generar PDF)
  const allItemsHaveEvidence =
    items.length > 0 && items.every(it => !!it.evidenciaFile)

  const procesarSalidas = async data => {
    if (!items.length) {
      setStatusMessage({ type: 'error', text: 'Agrega al menos un ítem.' })
      setTimeout(() => setStatusMessage(null), 2000)
      return
    }
    if (!allItemsHaveEvidence) {
      setStatusMessage({
        type: 'error',
        text: 'Todos los ítems deben tener evidencia.',
      })
      setTimeout(() => setStatusMessage(null), 2200)
      return
    }

    setProcesando(true)
    const resultados = items.map((_, idx) => ({
      idx,
      estado: 'pendiente',
      mensaje: '',
    }))
    setProgreso(resultados)

    // Procesar salidas ítem por ítem
    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      const formData = new FormData()
      formData.append('id_lote', it.id_lote)
      formData.append('id_producto', it.id_producto)
      formData.append('operacion', data.operacion || '')
      formData.append('cantidad', String(it.cantidad))
      formData.append('comentario', data.comentario || '')
      formData.append('id_personal', user?.personal?.id_personal || '')
      formData.append('id_bodega_origen', it.id_bodega_origen)
      formData.append('id_ubicacion_origen', it.id_ubicacion_origen)
      formData.append('evidencia', it.evidenciaFile)
      formData.append('firma_autorizador', firmas.autorizador || '')
      formData.append('firma_conductor', firmas.conductor || '')
      formData.append('firma_receptor', firmas.receptor || '')

      try {
        await crearSalida(formData)
        resultados[i] = { idx: i, estado: 'ok', mensaje: 'OK' }
        setProgreso([...resultados])
      } catch (e) {
        resultados[i] = {
          idx: i,
          estado: 'error',
          mensaje: e?.response?.data?.message || e?.message || 'Error',
        }
        setProgreso([...resultados])
      }
    }

    const huboError = resultados.some(p => p.estado === 'error')

    // Si todo salió OK, generamos el PDF MASIVO AQUÍ MISMO
    if (!huboError) {
      try {
        setStatusMessage({ type: 'success', text: 'Generando documento…' })

        // Tomamos un snapshot de items antes de limpiar
        const itemsSnapshot = items.map(it => ({ ...it }))

        // Construimos payload esperado por /documentos-salida
        const lotes = Array.from(
          new Set(itemsSnapshot.map(it => String(it.id_lote)))
        )
        const productos = Array.from(
          new Set(itemsSnapshot.map(it => String(it.id_producto)))
        )

        const payload = {
          // el controller ya mapea comentario_global/comentario a metadata.comentario
          comentario_global: data.comentario || '',
          operacion: data.operacion || '',
          firmas: {
            autorizador: firmas.autorizador || null,
            conductor: firmas.conductor || null,
            receptor: firmas.receptor || null,
          },
          creado_por: user?.id_usuario || user?.personal?.id_personal || null,
          lotes,
          productos,
          items: itemsSnapshot.map(it => ({
            id_lote: String(it.id_lote),
            id_producto: String(it.id_producto),
            cantidad: Number(it.cantidad) || 0,
            id_bodega_origen: it.id_bodega_origen || null,
            id_ubicacion_origen: it.id_ubicacion_origen || null,
            // Solo visuales para PDF (si el backend los ignora, no pasa nada)
            producto_nombre: it.nombre_producto_view || null,
            bodega_origen_nombre: it.bodega_nombre_view || null,
            ubicacion_origen_nombre: it.ubicacion_nombre_view || null,
          })),
        }

        const resp = await crearDocumentoSalida(payload)
        // Estructuras posibles: { id_documento, ruta_pdf, ... } o { downloadUrl, ... }
        const idDoc = resp?.id_documento
        const downloadUrl =
          resp?.downloadUrl ||
          (idDoc ? `/api/documentos-salida/${idDoc}/download` : null)

        if (idDoc && downloadUrl) {
          setDocGenerado({ id: idDoc, url: downloadUrl })
          setStatusMessage({ type: 'success', text: 'Documento generado.' })
        } else {
          setStatusMessage({
            type: 'error',
            text: 'Documento creado, pero no se pudo construir el enlace de descarga.',
          })
        }
      } catch (e) {
        setStatusMessage({
          type: 'error',
          text:
            e?.response?.data?.message ||
            e?.message ||
            'No se pudo generar el documento.',
        })
      }
    }

    setProcesando(false)

    // Limpieza de formulario y carrito (conservamos el enlace del PDF si existe)
    if (!huboError) {
      reset()
      setItems([])
      setInvOpciones([])
      setOpcionSeleccionadaKey('')
      setCantidadDisponibleItem(null)
      setFirmas({})
      setProgreso([])
      // onSuccess después de un respiro para que alcance a mostrarse el estado
      setTimeout(() => {
        setStatusMessage(null)
        onSuccess && onSuccess()
      }, 1200)
    } else {
      setStatusMessage({
        type: 'error',
        text: 'Proceso finalizado con errores.',
      })
      setTimeout(() => setStatusMessage(null), 2500)
    }
  }

  return (
    <div className='container-fluid mt-3'>
      <h5 className='fw-bold text-center mb-2'>Registrar Salidas (por lote)</h5>

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

      {/* ===== GLOBAL: Operación, comentario y firmas ===== */}
      <form onSubmit={handleSubmit(procesarSalidas)} className='mt-1'>
        <div className='row g-2'>
          <div className='col-md-6'>
            <label className='form-label mb-1'>ID Operación</label>
            <select
              className={`form-select form-select-sm ${
                errors.operacion ? 'is-invalid' : ''
              }`}
              {...register('operacion')}
              name='operacion'
            >
              <option value=''>Selecciona una operación</option>
              {operaciones.map(op => (
                <option key={op.id_operacion} value={op.id_operacion}>
                  {op.id_operacion}
                </option>
              ))}
            </select>
            {errors.operacion && (
              <div className='invalid-feedback'>Obligatorio</div>
            )}
          </div>

          <div className='col-md-6'>
            <label className='form-label mb-1'>Comentario (global)</label>
            <input
              type='text'
              className={`form-control form-select-sm ${
                errors.comentario ? 'is-invalid' : ''
              }`}
              placeholder='Notas u observaciones…'
              {...register('comentario', { required: true })}
              name='comentario'
            />
            {errors.comentario && (
              <div className='invalid-feedback'>Campo requerido</div>
            )}
          </div>
        </div>

        {/* ===== ÍTEMS: editor + tabla ===== */}
        <div className='mt-3 p-2 border rounded' onKeyDown={preventEnterSubmit}>
          <div className='small text-muted fw-semibold mb-2'>
            Agregar ítem al listado
          </div>

          <div className='row g-2 align-items-end'>
            {/* Lote */}
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

            {/* Producto */}
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

            {/* Bodega / Ubicación */}
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
                    {op.ubicacionNombre || op.id_ubicacion || '—'}
                    {' — Cant: '}
                    {toNumberCO(op.cantidad)}
                  </option>
                ))}
              </select>
            </div>

            {/* Cantidad */}
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
                    Number(v) <= cantidadDisponibleItem ||
                    `Máximo disponible en la ubicación: ${cantidadDisponibleItem}`,
                })}
              />
              {errorsItem.cantidad_item && (
                <div className='invalid-feedback'>
                  {errorsItem.cantidad_item.message || 'Inválida'}
                </div>
              )}
            </div>

            {/* Info ubicaciones */}
            <div className='col-12 mt-2'>
              {invOpciones.length > 0 ? (
                <div className='alert alert-info py-2 mb-0'>
                  Ubicaciones disponibles para el producto seleccionado:
                  <ul className='mb-0 mt-1'>
                    {invOpciones.map(op => (
                      <li key={`info-${op.key}`}>
                        <strong>
                          {op.bodegaNombre || op.id_bodega || '—'}
                        </strong>{' '}
                        ·{' '}
                        <strong>
                          {op.ubicacionNombre || op.id_ubicacion || '—'}
                        </strong>{' '}
                        — Cant: <strong>{toNumberCO(op.cantidad)}</strong>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className='form-text'>
                  Selecciona lote y producto para ver ubicaciones con stock.
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

        {/* Tabla de Ítems con evidencia por fila */}
        <div className='mt-3'>
          <div className='d-flex justify-content-between align-items-center mb-2'>
            <span className='small text-muted'>
              Ítems a procesar: <strong>{items.length}</strong>
            </span>
            <div className='d-flex gap-2'>
              {docGenerado?.url && (
                <a
                  className='btn btn-outline-success btn-sm'
                  href={docGenerado.url}
                  target='_blank'
                  rel='noreferrer'
                >
                  Descargar documento
                </a>
              )}
              <button
                type='button'
                className='btn btn-outline-danger btn-sm'
                disabled={!items.length || procesando}
                onClick={() => setItems([])}
              >
                Vaciar lista
              </button>
            </div>
          </div>

          <div className='table-responsive'>
            <table className='table table-sm table-striped align-middle'>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Lote</th>
                  <th>Producto</th>
                  <th className='text-end'>Cantidad</th>
                  <th>Bodega</th>
                  <th>Ubicación</th>
                  <th>Evidencia</th>
                  <th style={{ width: 140 }}></th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan='8' className='text-center text-muted'>
                      Sin ítems
                    </td>
                  </tr>
                ) : (
                  items.map((it, idx) => (
                    <tr
                      key={`${it.id_lote}-${it.id_producto}-${it.id_bodega_origen}-${it.id_ubicacion_origen}-${idx}`}
                    >
                      <td>{idx + 1}</td>
                      <td>{it.id_lote}</td>
                      <td>
                        {it.nombre_producto_view
                          ? `${it.nombre_producto_view} (${it.id_producto})`
                          : it.id_producto}
                      </td>
                      <td className='text-end'>{it.cantidad}</td>
                      <td>
                        {it.bodega_nombre_view || it.id_bodega_origen || '-'}
                      </td>
                      <td>
                        {it.ubicacion_nombre_view ||
                          it.id_ubicacion_origen ||
                          '-'}
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
                              Usar cámara
                            </button>
                            <button
                              type='button'
                              className='btn btn-outline-secondary btn-sm'
                              onClick={() =>
                                document
                                  .getElementById(`file-item-${idx}`)
                                  .click()
                              }
                              disabled={procesando}
                            >
                              Subir imagen
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
                              <span className='text-danger'>Sin evidencia</span>
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
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Panel de cámara por ítem */}
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

        {/* Firmas globales */}
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

        {/* Progreso */}
        {procesando && (
          <div className='mt-2'>
            <div className='small text-muted mb-1'>Procesando…</div>
            <div className='list-group'>
              {items.map((it, i) => {
                const p = progreso.find(x => x.idx === i)
                const estado = p?.estado || 'pendiente'
                const badge =
                  estado === 'ok'
                    ? 'bg-success'
                    : estado === 'error'
                    ? 'bg-danger'
                    : 'bg-secondary'
                return (
                  <div
                    key={i}
                    className='list-group-item d-flex justify-content-between align-items-center'
                  >
                    <span>
                      {it.id_lote} / {it.id_producto} — {it.cantidad} ·{' '}
                      {it.id_bodega_origen || '-'} /{' '}
                      {it.id_ubicacion_origen || '-'}
                    </span>
                    <span className={`badge ${badge}`}>{estado}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Acciones */}
        <div className='d-flex justify-content-end gap-2 mt-3'>
          {/* Eliminamos el botón de "Generar documento (PDF)". Todo sale con Submit */}
          <button
            type='submit'
            className='btn btn-primary btn-sm'
            disabled={
              isSubmitting ||
              !items.length ||
              !allItemsHaveEvidence ||
              procesando
            }
            title={
              !items.length
                ? 'Agrega ítems'
                : !allItemsHaveEvidence
                ? 'Todos los ítems requieren evidencia'
                : 'Procesar'
            }
          >
            {procesando ? 'Procesando…' : 'Procesar salidas'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default FormSalidaLotes
