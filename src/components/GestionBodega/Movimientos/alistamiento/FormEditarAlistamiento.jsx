import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import axios from 'axios'
import { getInventarioResumen } from '../../Inventario/salida_service'
import UbicarProductoInventario from './UbicarProductoInventario'
import {
  actualizarAlistamiento,
  obtenerAlistamiento,
  agregarItemAlistamiento,
  editarItemAlistamiento,
  eliminarItemAlistamiento,
} from './alistamiento_service'

const pickFirstDefined = (...vals) => vals.find(v => v != null && v !== '')

const getIdAlistamiento = row =>
  pickFirstDefined(row?.id_alistamiento, row?.Id_alistamiento, row?.id, row?.Id)

const getDetalles = a =>
  (Array.isArray(a?.detalles) && a.detalles) ||
  (Array.isArray(a?.Detalles) && a.Detalles) ||
  (Array.isArray(a?.items) && a.items) ||
  (Array.isArray(a?.Items) && a.Items) ||
  []

const getDetalleId = d =>
  pickFirstDefined(d?.id_detalle, d?.Id_detalle, d?.id, d?.Id)

const toNumberSafe = v => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const sortLotesDesc = (a, b) => {
  const na = parseInt((String(a).match(/\d+$/) || [0])[0], 10)
  const nb = parseInt((String(b).match(/\d+$/) || [0])[0], 10)
  if (nb !== na) return nb - na
  return String(b).localeCompare(String(a))
}

const mapDetalleToEditable = d => ({
  id_detalle: getDetalleId(d),
  id_lote:
    pickFirstDefined(
      d?.id_lote,
      d?.Id_lote,
      d?.lote?.Id_lote,
      d?.lote?.id_lote
    ) || '',
  id_producto: pickFirstDefined(d?.id_producto, d?.Id_producto) || '',
  producto_nombre:
    pickFirstDefined(d?.producto?.Nombre, d?.producto?.nombre) ||
    pickFirstDefined(d?.id_producto, d?.Id_producto) ||
    '—',
  cantidad: pickFirstDefined(d?.cantidad, d?.Cantidad) ?? '',
  comentario: pickFirstDefined(d?.comentario, d?.Comentario) || '',
})

const FormEditarAlistamiento = ({ alistamiento, onSuccess, onClose }) => {
  const evidenciaRef = useRef(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      nombre: '',
      id_cliente: '',
      id_personal: '',
      observaciones: '',
    },
  })

  const [clientes, setClientes] = useState([])
  const [procesando, setProcesando] = useState(false)
  const [procesandoItemId, setProcesandoItemId] = useState(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [evidenciaPreviewName, setEvidenciaPreviewName] = useState('')
  const [items, setItems] = useState([])
  const [invResumen, setInvResumen] = useState([])
  const [idLoteItem, setIdLoteItem] = useState('')
  const [idProductoItem, setIdProductoItem] = useState('')
  const [invOpciones, setInvOpciones] = useState([])
  const [opcionSeleccionadaKey, setOpcionSeleccionadaKey] = useState('')
  const [cantidadDisponibleItem, setCantidadDisponibleItem] = useState(null)
  const [posPendienteKey, setPosPendienteKey] = useState('')
  const [newItem, setNewItem] = useState({
    cantidad: '',
    comentario: '',
  })

  const idAlistamiento = useMemo(
    () => getIdAlistamiento(alistamiento),
    [alistamiento]
  )

  useEffect(() => {
    setItems(getDetalles(alistamiento).map(mapDetalleToEditable))

    reset({
      nombre:
        pickFirstDefined(alistamiento?.nombre, alistamiento?.Nombre) || '',
      id_cliente:
        pickFirstDefined(
          alistamiento?.id_cliente,
          alistamiento?.id_Cliente,
          alistamiento?.Id_cliente,
          alistamiento?.Id_Cliente
        ) || '',
      id_personal:
        pickFirstDefined(
          alistamiento?.id_personal,
          alistamiento?.Id_personal
        ) || '',
      observaciones:
        pickFirstDefined(
          alistamiento?.observaciones,
          alistamiento?.Observaciones,
          alistamiento?.comentario,
          alistamiento?.Comentario
        ) || '',
    })

    setStatusMessage('')
    setEvidenciaPreviewName('')
    if (evidenciaRef.current) evidenciaRef.current.value = ''
  }, [alistamiento, reset])

  const reloadDetalle = async () => {
    if (!idAlistamiento) return
    const full = await obtenerAlistamiento(idAlistamiento)
    setItems(getDetalles(full).map(mapDetalleToEditable))
  }

  const lotesDisponibles = useMemo(() => {
    const setLotes = new Set(
      invResumen
        .map(r => pickFirstDefined(r?.Id_lote, r?.id_lote))
        .filter(Boolean)
    )
    return Array.from(setLotes).sort(sortLotesDesc)
  }, [invResumen])

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

  useEffect(() => {
    setInvOpciones([])
    setOpcionSeleccionadaKey('')
    setCantidadDisponibleItem(null)

    if (!idLoteItem || !idProductoItem) return

    const rows = invResumen.filter(r => {
      const id_lote = pickFirstDefined(r?.Id_lote, r?.id_lote)
      const id_prod = pickFirstDefined(r?.Id_producto, r?.id_producto)
      return id_lote === idLoteItem && id_prod === idProductoItem
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

      const cantidad = toNumberSafe(
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
        op => (op.id_bodega || op.id_ubicacion) && toNumberSafe(op.cantidad) > 0
      )
      .sort((a, b) => toNumberSafe(b.cantidad) - toNumberSafe(a.cantidad))

    setInvOpciones(opciones)
    if (opciones.length === 1) {
      setOpcionSeleccionadaKey(opciones[0].key)
      setCantidadDisponibleItem(toNumberSafe(opciones[0].cantidad))
    }
  }, [idLoteItem, idProductoItem, invResumen])

  useEffect(() => {
    if (!posPendienteKey) return
    if (!invOpciones.length) return

    const op = invOpciones.find(o => o.key === posPendienteKey)
    if (!op) return

    setOpcionSeleccionadaKey(op.key)
    setCantidadDisponibleItem(toNumberSafe(op.cantidad))
    setPosPendienteKey('')
  }, [posPendienteKey, invOpciones])

  const onPickFromSearch = op => {
    setStatusMessage('')
    const lote = String(op?.id_lote || '')
    const prod = String(op?.id_producto || '')
    const keyPos = `${op?.id_bodega || ''}|${op?.id_ubicacion || ''}`

    setIdLoteItem(lote)
    setIdProductoItem(prod)
    setPosPendienteKey(keyPos)
  }

  useEffect(() => {
    const loadClientes = async () => {
      try {
        const resumenData = await getInventarioResumen()
        setInvResumen(Array.isArray(resumenData) ? resumenData : [])

        const token = localStorage.getItem('token')
        const resp = await axios.get(
          `${import.meta.env.VITE_API_URL}/cliente`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        )
        setClientes(Array.isArray(resp.data?.data) ? resp.data.data : [])
      } catch (error) {
        console.error(error)
        setStatusMessage('No se pudo cargar inventario/clientes')
      }
    }

    loadClientes()
  }, [])

  const onSubmit = async data => {
    setStatusMessage('')

    if (!idAlistamiento) {
      setStatusMessage('No se encontró el id del alistamiento a editar')
      return
    }

    const fd = new FormData()
    fd.append('nombre', data.nombre?.trim() || '')
    fd.append('id_cliente', data.id_cliente?.trim() || '')
    fd.append('id_personal', data.id_personal?.trim() || '')
    fd.append('observaciones', data.observaciones?.trim() || '')

    const file = evidenciaRef.current?.files?.[0]
    if (file) fd.append('evidencia_general', file)

    setProcesando(true)
    try {
      await actualizarAlistamiento(idAlistamiento, fd)
      onSuccess?.()
    } catch (error) {
      console.error(error)
      setStatusMessage(
        error?.response?.data?.message ||
          error?.message ||
          'No se pudo actualizar el alistamiento'
      )
    } finally {
      setProcesando(false)
    }
  }

  const onChangeItem = (idx, field, value) => {
    setItems(prev =>
      prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it))
    )
  }

  const onGuardarItem = async item => {
    setStatusMessage('')
    const itemId = Number(item?.id_detalle)

    if (!idAlistamiento || !Number.isInteger(itemId) || itemId <= 0) {
      setStatusMessage('No se encontró el id del ítem para editar')
      return
    }

    const cantidad = toNumberSafe(item.cantidad)
    if (cantidad <= 0) {
      setStatusMessage('La cantidad del ítem debe ser mayor a 0')
      return
    }

    setProcesandoItemId(itemId)
    try {
      await editarItemAlistamiento(idAlistamiento, itemId, {
        cantidad,
        comentario: item.comentario?.trim() || '',
      })
      await reloadDetalle()
      setStatusMessage(`Ítem ${itemId} actualizado`)
    } catch (error) {
      console.error(error)
      setStatusMessage(
        error?.response?.data?.message ||
          error?.message ||
          'No se pudo actualizar el ítem'
      )
    } finally {
      setProcesandoItemId(null)
    }
  }

  const onEliminarItem = async item => {
    setStatusMessage('')
    const itemId = Number(item?.id_detalle)

    if (!idAlistamiento || !Number.isInteger(itemId) || itemId <= 0) {
      setStatusMessage('No se encontró el id del ítem para eliminar')
      return
    }

    setProcesandoItemId(itemId)
    try {
      await eliminarItemAlistamiento(idAlistamiento, itemId)
      await reloadDetalle()
      setStatusMessage(`Ítem ${itemId} eliminado`)
    } catch (error) {
      console.error(error)
      setStatusMessage(
        error?.response?.data?.message ||
          error?.message ||
          'No se pudo eliminar el ítem'
      )
    } finally {
      setProcesandoItemId(null)
    }
  }

  const onAgregarItem = async () => {
    setStatusMessage('')

    if (!idAlistamiento) {
      setStatusMessage('No se encontró el id del alistamiento')
      return
    }

    const id_lote = String(idLoteItem || '').trim()
    const id_producto = String(idProductoItem || '').trim()
    const cantidad = toNumberSafe(newItem.cantidad)

    if (!id_lote || !id_producto) {
      setStatusMessage('Selecciona lote y producto')
      return
    }
    if (!opcionSeleccionadaKey) {
      setStatusMessage('Selecciona bodega/ubicación')
      return
    }
    if (cantidad <= 0) {
      setStatusMessage('La cantidad del nuevo ítem debe ser mayor a 0')
      return
    }
    if (cantidadDisponibleItem != null && cantidad > cantidadDisponibleItem) {
      setStatusMessage('Cantidad supera la disponible en esa posición')
      return
    }

    const op = invOpciones.find(o => o.key === opcionSeleccionadaKey)

    setProcesandoItemId('new')
    try {
      await agregarItemAlistamiento(idAlistamiento, {
        id_lote,
        id_producto,
        cantidad,
        comentario: newItem.comentario?.trim() || '',
        id_bodega_origen: op?.id_bodega || '',
        id_ubicacion_origen: op?.id_ubicacion || '',
      })

      setNewItem({
        cantidad: '',
        comentario: '',
      })
      setIdLoteItem('')
      setIdProductoItem('')
      setInvOpciones([])
      setOpcionSeleccionadaKey('')
      setCantidadDisponibleItem(null)
      setPosPendienteKey('')

      await reloadDetalle()
      setStatusMessage('Ítem agregado')
    } catch (error) {
      console.error(error)
      setStatusMessage(
        error?.response?.data?.message ||
          error?.message ||
          'No se pudo agregar el ítem'
      )
    } finally {
      setProcesandoItemId(null)
    }
  }

  return (
    <div className='container-fluid'>
      <div className='d-flex align-items-center justify-content-between mb-3'>
        <h4 className='mb-0'>Editar Alistamiento #{idAlistamiento || '—'}</h4>
        {onClose ? (
          <button
            type='button'
            className='btn btn-outline-secondary btn-sm'
            onClick={onClose}
          >
            Cerrar
          </button>
        ) : null}
      </div>

      {statusMessage ? (
        <div className='alert alert-info py-2'>{statusMessage}</div>
      ) : null}

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className='card'>
          <div className='card-body'>
            <div className='row g-2'>
              <div className='col-12 col-md-6'>
                <label className='form-label small mb-1'>Nombre *</label>
                <input
                  className='form-control form-control-sm'
                  {...register('nombre', {
                    required: 'Nombre requerido',
                    minLength: { value: 2, message: 'Mínimo 2 caracteres' },
                  })}
                />
                {errors?.nombre ? (
                  <div className='text-danger small'>
                    {errors.nombre.message}
                  </div>
                ) : null}
              </div>

              <div className='col-12 col-md-3'>
                <label className='form-label small mb-1'>Cliente</label>
                <select
                  className='form-select form-select-sm'
                  {...register('id_cliente')}
                >
                  <option value=''>— Sin cliente —</option>
                  {clientes.map(c => (
                    <option key={c.id_Cliente} value={c.id_Cliente}>
                      {c.Nombre} ({c.id_Cliente})
                    </option>
                  ))}
                </select>
              </div>

              <div className='col-12 col-md-3'>
                <label className='form-label small mb-1'>
                  Operador (id_personal) *
                </label>
                <input
                  className='form-control form-control-sm'
                  {...register('id_personal', {
                    required: 'id_personal requerido',
                  })}
                />
                {errors?.id_personal ? (
                  <div className='text-danger small'>
                    {errors.id_personal.message}
                  </div>
                ) : null}
              </div>

              <div className='col-12 col-md-6'>
                <label className='form-label small mb-1'>
                  Nueva evidencia (opcional)
                </label>
                <input
                  ref={evidenciaRef}
                  type='file'
                  className='form-control form-control-sm'
                  accept='image/*'
                  onChange={e =>
                    setEvidenciaPreviewName(e.target.files?.[0]?.name || '')
                  }
                />
                {evidenciaPreviewName ? (
                  <div className='text-muted small mt-1'>
                    Archivo: {evidenciaPreviewName}
                  </div>
                ) : null}
              </div>

              <div className='col-12'>
                <label className='form-label small mb-1'>Observaciones</label>
                <textarea
                  rows={3}
                  className='form-control form-control-sm'
                  {...register('observaciones')}
                />
              </div>
            </div>

            <div className='d-flex justify-content-end gap-2 mt-3'>
              <button
                type='button'
                className='btn btn-outline-secondary'
                onClick={onClose}
                disabled={procesando}
              >
                Cancelar
              </button>
              <button
                type='submit'
                className='btn btn-primary'
                disabled={procesando}
              >
                {procesando ? 'Actualizando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>

        <div className='card mt-3'>
          <div className='card-body'>
            <div className='d-flex justify-content-between align-items-center mb-2'>
              <h6 className='mb-0'>Editar ítems</h6>
              <span className='small text-muted'>Total: {items.length}</span>
            </div>

            <div className='table-responsive'>
              <table className='table table-sm table-striped align-middle'>
                <thead>
                  <tr>
                    <th style={{ width: 90 }}>Id</th>
                    <th style={{ width: 120 }}>Lote</th>
                    <th>Producto</th>
                    <th style={{ width: 130 }}>Cantidad</th>
                    <th>Comentario</th>
                    <th style={{ width: 180 }} className='text-end'>
                      Acción
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {!items.length ? (
                    <tr>
                      <td colSpan={6} className='text-center text-muted py-3'>
                        Sin ítems
                      </td>
                    </tr>
                  ) : (
                    items.map((item, idx) => {
                      const itemId = Number(item.id_detalle)
                      const isBusy = procesandoItemId === itemId

                      return (
                        <tr
                          key={`${item.id_detalle}-${item.id_lote}-${item.id_producto}-${idx}`}
                        >
                          <td>{item.id_detalle || '—'}</td>
                          <td>{item.id_lote || '—'}</td>
                          <td>
                            {item.producto_nombre}{' '}
                            <span className='text-muted'>
                              ({item.id_producto})
                            </span>
                          </td>
                          <td>
                            <input
                              type='number'
                              min='0'
                              step='any'
                              className='form-control form-control-sm'
                              value={item.cantidad}
                              onChange={e =>
                                onChangeItem(idx, 'cantidad', e.target.value)
                              }
                              disabled={isBusy}
                            />
                          </td>
                          <td>
                            <input
                              className='form-control form-control-sm'
                              value={item.comentario}
                              onChange={e =>
                                onChangeItem(idx, 'comentario', e.target.value)
                              }
                              disabled={isBusy}
                            />
                          </td>
                          <td className='text-end'>
                            <div className='d-inline-flex gap-2'>
                              <button
                                type='button'
                                className='btn btn-outline-primary btn-sm'
                                onClick={() => onGuardarItem(item)}
                                disabled={isBusy}
                              >
                                Guardar
                              </button>
                              <button
                                type='button'
                                className='btn btn-outline-danger btn-sm'
                                onClick={() => onEliminarItem(item)}
                                disabled={isBusy}
                              >
                                Eliminar
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className='border rounded p-2 mt-2 bg-light'>
              <div className='row justify-content-center'>
                <div className='col-12 col-md-8'>
                  <UbicarProductoInventario
                    invResumen={invResumen}
                    onSelect={onPickFromSearch}
                  />
                </div>
              </div>

              <div className='row g-2 align-items-end'>
                <div className='col-12 col-md-3'>
                  <label className='form-label small mb-1'>Lote *</label>
                  <select
                    className='form-select form-select-sm'
                    value={idLoteItem}
                    onChange={e => {
                      setIdLoteItem(e.target.value)
                      setIdProductoItem('')
                      setPosPendienteKey('')
                    }}
                    disabled={procesandoItemId === 'new'}
                  >
                    <option value=''>Selecciona lote</option>
                    {lotesDisponibles.map(l => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>

                <div className='col-12 col-md-3'>
                  <label className='form-label small mb-1'>Producto *</label>
                  <select
                    className='form-select form-select-sm'
                    value={idProductoItem}
                    onChange={e => setIdProductoItem(e.target.value)}
                    disabled={procesandoItemId === 'new'}
                  >
                    <option value=''>Selecciona producto</option>
                    {productosDisponibles.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className='col-12 col-md-3'>
                  <label className='form-label small mb-1'>
                    Bodega / Ubicación *
                  </label>
                  <select
                    className='form-select form-select-sm'
                    value={opcionSeleccionadaKey}
                    onChange={e => {
                      const key = e.target.value
                      setOpcionSeleccionadaKey(key)
                      const op = invOpciones.find(o => o.key === key)
                      setCantidadDisponibleItem(
                        op ? toNumberSafe(op.cantidad) : null
                      )
                    }}
                    disabled={!invOpciones.length || procesandoItemId === 'new'}
                  >
                    <option value=''>
                      {invOpciones.length
                        ? 'Selecciona posición'
                        : 'Sin opciones'}
                    </option>
                    {invOpciones.map(op => (
                      <option key={op.key} value={op.key}>
                        {op.bodegaNombre || op.id_bodega} ·{' '}
                        {op.ubicacionNombre || op.id_ubicacion} · Disp:{' '}
                        {toNumberSafe(op.cantidad).toLocaleString('es-CO')}
                      </option>
                    ))}
                  </select>
                </div>

                <div className='col-12 col-md-1'>
                  <label className='form-label small mb-1'>Cantidad *</label>
                  <input
                    type='number'
                    min='0'
                    step='any'
                    className='form-control form-control-sm'
                    value={newItem.cantidad}
                    onChange={e =>
                      setNewItem(prev => ({
                        ...prev,
                        cantidad: e.target.value,
                      }))
                    }
                    disabled={procesandoItemId === 'new'}
                  />
                  {cantidadDisponibleItem != null ? (
                    <div className='text-muted small mt-1'>
                      Disp: {cantidadDisponibleItem.toLocaleString('es-CO')}
                    </div>
                  ) : null}
                </div>

                <div className='col-12 col-md-2'>
                  <label className='form-label small mb-1'>Comentario</label>
                  <input
                    className='form-control form-control-sm'
                    value={newItem.comentario}
                    onChange={e =>
                      setNewItem(prev => ({
                        ...prev,
                        comentario: e.target.value,
                      }))
                    }
                    disabled={procesandoItemId === 'new'}
                  />
                </div>

                <div className='col-12 col-md-12 d-flex justify-content-end'>
                  <button
                    type='button'
                    className='btn btn-success btn-sm'
                    onClick={onAgregarItem}
                    disabled={procesandoItemId === 'new'}
                  >
                    Agregar ítem
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}

export default FormEditarAlistamiento
