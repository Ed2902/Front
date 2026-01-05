import { useForm } from 'react-hook-form'
import { useEffect, useMemo, useState, useContext, useRef } from 'react'
import axios from 'axios'
import AuthContext from '../../../../context/AuthContext'
import { crearAlistamiento } from './alistamiento_service'
import { getInventarioResumen } from '../../Inventario/salida_service'

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

const FormAlistamiento = ({ onSuccess, onClose }) => {
  const { user } = useContext(AuthContext)

  // ✅ id_personal real según tu login
  const idPersonal = user?.personal?.id_personal || ''

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm()

  const {
    register: registerItem,
    handleSubmit: handleSubmitItem,
    setValue: setValueItem,
    watch: watchItem,
    reset: resetItem,
    formState: { errors: errorsItem },
  } = useForm()

  const [clientes, setClientes] = useState([])

  const [invResumen, setInvResumen] = useState([])
  const [idLoteItem, setIdLoteItem] = useState('')
  const productoItem = watchItem('id_producto_item')

  const [invOpciones, setInvOpciones] = useState([])
  const [opcionSeleccionadaKey, setOpcionSeleccionadaKey] = useState('')
  const [cantidadDisponibleItem, setCantidadDisponibleItem] = useState(null)

  const evidenciaRef = useRef(null)
  const [evidenciaPreviewName, setEvidenciaPreviewName] = useState('')

  const [items, setItems] = useState([])
  const [statusMessage, setStatusMessage] = useState(null)
  const [procesando, setProcesando] = useState(false)

  // cargar inventario + clientes
  useEffect(() => {
    const fetchData = async () => {
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
      } catch (e) {
        console.error(e)
        setStatusMessage('Error cargando inventario/clientes')
      }
    }
    fetchData()
  }, [])

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
      setValueItem('id_bodega_origen', opciones[0].id_bodega)
      setValueItem('id_ubicacion_origen', opciones[0].id_ubicacion)
    }
  }, [idLoteItem, productoItem, invResumen, setValueItem])

  const totalCantidad = useMemo(
    () => items.reduce((sum, it) => sum + toNumberCO(it.cantidad), 0),
    [items]
  )

  const allVerified = useMemo(
    () => items.length > 0 && items.every(it => !!it.verificado),
    [items]
  )

  const onAddItem = data => {
    setStatusMessage(null)

    const id_producto = data.id_producto_item
    const cantidad = toNumberCO(data.cantidad_item)

    if (!idLoteItem) return setStatusMessage('Selecciona un lote')
    if (!id_producto) return setStatusMessage('Selecciona un producto')
    if (!opcionSeleccionadaKey)
      return setStatusMessage('Selecciona bodega/ubicación')
    if (cantidad <= 0) return setStatusMessage('Cantidad debe ser mayor a 0')
    if (cantidadDisponibleItem != null && cantidad > cantidadDisponibleItem) {
      return setStatusMessage('Cantidad supera la disponible en esa posición')
    }

    // no duplicar lote+producto
    const dup = items.some(
      it =>
        String(it.id_lote) === String(idLoteItem) &&
        String(it.id_producto) === String(id_producto)
    )
    if (dup)
      return setStatusMessage('Ese lote + producto ya está en el alistamiento')

    const op = invOpciones.find(o => o.key === opcionSeleccionadaKey)
    const productoNombre =
      productosDisponibles.find(p => p.id === id_producto)?.name || id_producto

    setItems(prev => [
      ...prev,
      {
        id_lote: idLoteItem,
        id_producto,
        producto_nombre: productoNombre,
        id_bodega_origen: op?.id_bodega || '',
        id_ubicacion_origen: op?.id_ubicacion || '',
        bodegaNombre: op?.bodegaNombre || '',
        ubicacionNombre: op?.ubicacionNombre || '',
        cantidad,
        comentario: data.comentario_item?.trim() || '',
        verificado: false,
      },
    ])

    resetItem({
      id_producto_item: '',
      cantidad_item: '',
      comentario_item: '',
      id_bodega_origen: '',
      id_ubicacion_origen: '',
    })
    setOpcionSeleccionadaKey('')
    setCantidadDisponibleItem(null)
  }

  const removeItem = idx => setItems(prev => prev.filter((_, i) => i !== idx))
  const toggleVerified = idx =>
    setItems(prev =>
      prev.map((it, i) =>
        i === idx ? { ...it, verificado: !it.verificado } : it
      )
    )

  const onSubmit = async data => {
    setStatusMessage(null)

    if (!idPersonal)
      return setStatusMessage(
        'No se encontró user.personal.id_personal (login)'
      )
    if (!items.length) return setStatusMessage('Debes agregar al menos un item')
    if (!allVerified)
      return setStatusMessage('Debes verificar cada item antes de guardar')

    const file = evidenciaRef.current?.files?.[0]
    if (!file) return setStatusMessage('La evidencia general es obligatoria')

    const payloadItems = items.map(it => ({
      id_lote: it.id_lote,
      id_producto: it.id_producto,
      cantidad: it.cantidad,
      comentario: it.comentario || null,
      id_bodega_origen: it.id_bodega_origen || null,
      id_ubicacion_origen: it.id_ubicacion_origen || null,
    }))

    const fd = new FormData()
    fd.append('nombre', data.nombre?.trim() || '')
    fd.append('id_personal', String(idPersonal))
    fd.append('id_cliente', data.id_cliente?.trim() || '')
    // ✅ backend usa "observaciones"
    fd.append('observaciones', data.observaciones?.trim() || '')
    fd.append('items', JSON.stringify(payloadItems))
    fd.append('evidencia_general', file)

    setProcesando(true)
    try {
      await crearAlistamiento(fd)

      setItems([])
      setIdLoteItem('')
      setInvOpciones([])
      setOpcionSeleccionadaKey('')
      setCantidadDisponibleItem(null)
      setEvidenciaPreviewName('')
      if (evidenciaRef.current) evidenciaRef.current.value = ''
      reset()

      onSuccess?.()
    } catch (e) {
      console.error(e)
      setStatusMessage(
        e?.response?.data?.message || e?.message || 'Error creando alistamiento'
      )
    } finally {
      setProcesando(false)
    }
  }

  return (
    <div className='container-fluid'>
      <div className='d-flex align-items-center justify-content-between mb-3'>
        <h4 className='mb-0'>Crear Alistamiento</h4>
        {onClose ? (
          <button
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
        <div className='card mb-3'>
          <div className='card-body'>
            <div className='row g-2'>
              <div className='col-12 col-md-5'>
                <label className='form-label small mb-1'>
                  Nombre del alistamiento *
                </label>
                <input
                  className='form-control form-control-sm'
                  placeholder='Ej: Despacho Cliente X (Día 1)'
                  {...register('nombre', { required: 'Nombre requerido' })}
                />
                {errors?.nombre ? (
                  <div className='text-danger small'>
                    {errors.nombre.message}
                  </div>
                ) : null}
              </div>

              <div className='col-12 col-md-3'>
                <label className='form-label small mb-1'>
                  Cliente (opcional)
                </label>
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

              <div className='col-12 col-md-4'>
                <label className='form-label small mb-1'>
                  Evidencia general *
                </label>
                <input
                  ref={evidenciaRef}
                  type='file'
                  className='form-control form-control-sm'
                  onChange={e =>
                    setEvidenciaPreviewName(e.target.files?.[0]?.name || '')
                  }
                  accept='image/*'
                />
                {evidenciaPreviewName ? (
                  <div className='text-muted small mt-1'>
                    Archivo: {evidenciaPreviewName}
                  </div>
                ) : null}
              </div>

              <div className='col-12'>
                <label className='form-label small mb-1'>
                  Observaciones (opcional)
                </label>
                <textarea
                  rows={2}
                  className='form-control form-control-sm'
                  placeholder='Notas generales del alistamiento...'
                  {...register('observaciones')}
                />
              </div>
            </div>
          </div>
        </div>

        {/* EDITOR ITEM */}
        <div className='card mb-3'>
          <div className='card-body'>
            <div className='d-flex align-items-center justify-content-between mb-2'>
              <h6 className='mb-0'>Agregar ítems desde inventario</h6>
              <div className='text-muted small'>
                Total ítems: <b>{items.length}</b> · Total cantidad:{' '}
                <b>{totalCantidad.toLocaleString('es-CO')}</b>
              </div>
            </div>

            <div className='row g-2'>
              <div className='col-12 col-md-3'>
                <label className='form-label small mb-1'>Lote *</label>
                <select
                  className='form-select form-select-sm'
                  value={idLoteItem}
                  onChange={e => {
                    setIdLoteItem(e.target.value)
                    setValueItem('id_producto_item', '')
                  }}
                >
                  <option value=''>Selecciona lote</option>
                  {lotesDisponibles.map(l => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>

              <div className='col-12 col-md-4'>
                <label className='form-label small mb-1'>Producto *</label>
                <select
                  className='form-select form-select-sm'
                  {...registerItem('id_producto_item', { required: true })}
                >
                  <option value=''>Selecciona producto</option>
                  {productosDisponibles.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {errorsItem?.id_producto_item ? (
                  <div className='text-danger small'>Producto requerido</div>
                ) : null}
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
                      op ? toNumberCO(op.cantidad) : null
                    )
                  }}
                  disabled={!invOpciones.length}
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
                      {toNumberCO(op.cantidad).toLocaleString('es-CO')}
                    </option>
                  ))}
                </select>
              </div>

              <div className='col-12 col-md-2'>
                <label className='form-label small mb-1'>Cantidad *</label>
                <input
                  className='form-control form-control-sm'
                  placeholder='0'
                  {...registerItem('cantidad_item', { required: true })}
                />
                {cantidadDisponibleItem != null ? (
                  <div className='text-muted small mt-1'>
                    Disponible: {cantidadDisponibleItem.toLocaleString('es-CO')}
                  </div>
                ) : null}
              </div>

              <div className='col-12'>
                <label className='form-label small mb-1'>
                  Comentario ítem (opcional)
                </label>
                <input
                  className='form-control form-control-sm'
                  placeholder='Notas del item...'
                  {...registerItem('comentario_item')}
                />
              </div>

              <div className='col-12 d-flex justify-content-end'>
                <button
                  type='button'
                  className='btn btn-primary btn-sm'
                  onClick={handleSubmitItem(onAddItem)}
                >
                  Agregar ítem
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* TABLA ITEMS */}
        <div className='card mb-3'>
          <div className='card-body p-0'>
            <div className='table-responsive'>
              <table className='table table-sm table-hover mb-0'>
                <thead className='table-light'>
                  <tr>
                    <th style={{ width: 120 }}>Lote</th>
                    <th>Producto</th>
                    <th style={{ width: 120 }} className='text-end'>
                      Cantidad
                    </th>
                    <th style={{ width: 130 }}>Verificado</th>
                    <th style={{ width: 90 }} className='text-end'>
                      Acción
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className='text-center text-muted py-4'>
                        Aún no agregas ítems
                      </td>
                    </tr>
                  ) : (
                    items.map((it, idx) => (
                      <tr key={`${it.id_lote}-${it.id_producto}`}>
                        <td className='fw-semibold'>{it.id_lote}</td>
                        <td>
                          {it.producto_nombre}{' '}
                          <span className='text-muted'>({it.id_producto})</span>
                        </td>
                        <td className='text-end fw-semibold'>
                          {toNumberCO(it.cantidad).toLocaleString('es-CO')}
                        </td>
                        <td>
                          <div className='form-check'>
                            <input
                              className='form-check-input'
                              type='checkbox'
                              checked={!!it.verificado}
                              onChange={() => toggleVerified(idx)}
                              id={`verif-${idx}`}
                            />
                            <label
                              className='form-check-label small'
                              htmlFor={`verif-${idx}`}
                            >
                              Revisado
                            </label>
                          </div>
                        </td>
                        <td className='text-end'>
                          <button
                            type='button'
                            className='btn btn-outline-danger btn-sm'
                            onClick={() => removeItem(idx)}
                          >
                            X
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>

                {items.length ? (
                  <tfoot>
                    <tr>
                      <td colSpan={2} className='text-end fw-semibold'>
                        TOTAL
                      </td>
                      <td className='text-end fw-bold'>
                        {totalCantidad.toLocaleString('es-CO')}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </div>
          </div>
        </div>

        {!allVerified && items.length ? (
          <div className='text-danger small mb-2'>
            Debes marcar “Revisado” en cada ítem antes de guardar.
          </div>
        ) : null}

        <div className='d-flex justify-content-end gap-2'>
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
            className='btn btn-success'
            disabled={procesando}
          >
            {procesando ? 'Guardando...' : 'Guardar alistamiento'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default FormAlistamiento
