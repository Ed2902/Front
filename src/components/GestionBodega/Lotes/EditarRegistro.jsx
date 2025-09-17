// src/pages/.../EditarRegistro.jsx
import { useEffect, useMemo, useState } from 'react'
import { getProductosDisponibles, updateLoteProducto } from './Lotes_service.js'

const EditarRegistro = ({ registro, onCancel, onSuccess }) => {
  const [productos, setProductos] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // Form state
  const [form, setForm] = useState({
    id_producto: '',
    Cantidad: '',
    PesoUnitarioKg: '',
  })

  // Cargar productos
  useEffect(() => {
    let mounted = true
    getProductosDisponibles()
      .then(data => mounted && setProductos(data))
      .catch(err => setError(err?.message || 'Error cargando productos'))
    return () => {
      mounted = false
    }
  }, [])

  // Cargar valores actuales del registro
  useEffect(() => {
    if (!registro) return
    setForm({
      id_producto: registro.id_producto || '',
      Cantidad: registro.Cantidad ?? '',
      PesoUnitarioKg: registro.PesoUnitarioKg ?? '',
    })
  }, [registro])

  // Normalizaciones (acepta coma o punto)
  const normalizeNumber = v => {
    if (v === '' || v === null || v === undefined) return ''
    const s = String(v).replace(',', '.')
    const n = Number(s)
    return Number.isNaN(n) ? '' : n
  }

  const normalized = useMemo(
    () => ({
      id_producto: String(form.id_producto || '').trim(),
      Cantidad: form.Cantidad === '' ? '' : normalizeNumber(form.Cantidad),
      PesoUnitarioKg:
        form.PesoUnitarioKg === ''
          ? null
          : normalizeNumber(form.PesoUnitarioKg),
    }),
    [form]
  )

  const initialNormalized = useMemo(
    () => ({
      id_producto: String(registro?.id_producto || '').trim(),
      Cantidad: registro?.Cantidad ?? '',
      PesoUnitarioKg: registro?.PesoUnitarioKg ?? null,
    }),
    [registro]
  )

  // Validaciones
  const valid =
    normalized.id_producto &&
    normalized.Cantidad !== '' &&
    !Number.isNaN(normalized.Cantidad) &&
    Number(normalized.Cantidad) > 0 &&
    (normalized.PesoUnitarioKg === null ||
      (!Number.isNaN(normalized.PesoUnitarioKg) &&
        Number(normalized.PesoUnitarioKg) >= 0))

  // Dirty (habilita botón solo si cambió algo)
  const dirty = useMemo(() => {
    const pesoInit = initialNormalized.PesoUnitarioKg ?? null
    const pesoNow = normalized.PesoUnitarioKg ?? null
    return (
      normalized.id_producto !== initialNormalized.id_producto ||
      Number(normalized.Cantidad) !== Number(initialNormalized.Cantidad) ||
      pesoInit !== pesoNow
    )
  }, [normalized, initialNormalized])

  const handleChange = field => e => {
    setForm(prev => ({ ...prev, [field]: e.target.value }))
  }

  const handleSubmit = async e => {
    e.preventDefault()
    if (!valid || !dirty || saving) return

    setSaving(true)
    setError(null)
    try {
      // ID oculto para la URL
      const id =
        registro.id_lote_producto || registro.Id_lote_producto || registro.id
      const payload = {
        id_producto: normalized.id_producto,
        Cantidad: Number(normalized.Cantidad),
        PesoUnitarioKg: normalized.PesoUnitarioKg, // null si vacío
      }
      await updateLoteProducto(id, payload)
      onSuccess?.()
    } catch (err) {
      const msg =
        err?.response?.data?.message || err?.message || 'Error al actualizar'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  // Mostramos Lote (no el id_lote_producto)
  const loteId = registro?.id_lote || '—'

  return (
    <form onSubmit={handleSubmit}>
      {/* Mostrar Lote en lugar del ID Lote-Producto */}
      <div className='mb-3'>
        <label className='form-label'>Lote</label>
        <input className='form-control' value={loteId} readOnly />
      </div>

      <div className='mb-3'>
        <label className='form-label'>Producto</label>
        <select
          className='form-select'
          value={form.id_producto}
          onChange={handleChange('id_producto')}
        >
          <option value=''>Seleccione un producto</option>
          {productos.map(p => (
            <option key={p.Id_producto} value={p.Id_producto}>
              {p.Nombre} ({p.Id_producto})
            </option>
          ))}
        </select>
      </div>

      <div className='row g-3'>
        <div className='col-md-6'>
          <label className='form-label'>Cantidad</label>
          <input
            type='number'
            step='0.01'
            className='form-control'
            value={form.Cantidad}
            onChange={handleChange('Cantidad')}
            placeholder='0.00'
          />
        </div>
        <div className='col-md-6'>
          <label className='form-label'>Peso U. (Kg)</label>
          <input
            type='text'
            inputMode='decimal'
            className='form-control'
            value={form.PesoUnitarioKg}
            onChange={handleChange('PesoUnitarioKg')}
            placeholder='Opcional (coma o punto)'
          />
        </div>
      </div>

      {error && <div className='alert alert-danger mt-3'>{error}</div>}

      <div className='d-flex justify-content-end gap-2 mt-4'>
        <button
          type='button'
          className='btn btn-outline-secondary'
          onClick={onCancel}
        >
          Cancelar
        </button>
        <button
          type='submit'
          className='btn btn-success'
          disabled={!valid || !dirty || saving}
        >
          {saving ? 'Guardando...' : 'Actualizar'}
        </button>
      </div>
    </form>
  )
}

export default EditarRegistro
