// UbicarProductoInventario.jsx
import { useMemo, useState } from 'react'

// Helpers locales (para que el componente sea autónomo)
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

/**
 * props:
 * - invResumen: array (tu getInventarioResumen)
 * - onSelect: (row) => void  // row trae { id_lote, id_producto, id_bodega, id_ubicacion, cantidad, ... }
 * - maxResults?: number
 * - placeholder?: string
 * - label?: string
 * - autoOpen?: boolean
 */
const UbicarProductoInventario = ({
  invResumen = [],
  onSelect,
  maxResults = 12,
  placeholder = 'Escribe producto, lote, bodega o ubicación…',
  label = 'Ubicar producto en inventario',
  autoOpen = true,
}) => {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)

  // Normaliza invResumen -> lista por (lote, producto, bodega, ubicacion) agregando cantidades
  const opciones = useMemo(() => {
    const map = new Map()

    ;(Array.isArray(invResumen) ? invResumen : []).forEach(r => {
      const id_lote = pickFirstDefined(r?.Id_lote, r?.id_lote) || ''
      const id_producto = pickFirstDefined(r?.Id_producto, r?.id_producto) || ''
      if (!id_lote || !id_producto) return

      const productoNombre =
        pickFirstDefined(r?.Nombre_Producto, r?.Producto?.Nombre) || id_producto

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
      if (cantidad <= 0) return

      const key = `${id_lote}|${id_producto}|${id_bodega}|${id_ubicacion}`

      if (!map.has(key)) {
        map.set(key, {
          key,
          id_lote,
          id_producto,
          productoNombre,
          id_bodega,
          bodegaNombre,
          id_ubicacion,
          ubicacionNombre,
          cantidad: 0,
        })
      }
      map.get(key).cantidad += cantidad
    })

    // ordena por más disponible
    return Array.from(map.values()).sort(
      (a, b) => toNumberCO(b.cantidad) - toNumberCO(a.cantidad)
    )
  }, [invResumen])

  const results = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return []
    const filtered = opciones.filter(op => {
      const hay =
        String(op.id_producto).toLowerCase().includes(s) ||
        String(op.productoNombre).toLowerCase().includes(s) ||
        String(op.id_lote).toLowerCase().includes(s) ||
        String(op.bodegaNombre || op.id_bodega)
          .toLowerCase()
          .includes(s) ||
        String(op.ubicacionNombre || op.id_ubicacion)
          .toLowerCase()
          .includes(s)
      return hay
    })
    return filtered.slice(0, Math.max(1, maxResults))
  }, [q, opciones, maxResults])

  const handlePick = op => {
    onSelect?.(op)
    setOpen(false)
    // deja un texto amigable en el input
    setQ(`${op.productoNombre} · Lote ${op.id_lote}`)
  }

  const showDropdown = open && results.length > 0

  return (
    <div className='col-12 position-relative'>
      <label className='form-label small mb-1'>{label}</label>

      <input
        className='form-control form-control-sm'
        value={q}
        placeholder={placeholder}
        onChange={e => {
          setQ(e.target.value)
          if (autoOpen) setOpen(true)
        }}
        onFocus={() => autoOpen && setOpen(true)}
        onBlur={() => {
          // pequeño delay para permitir click en item
          setTimeout(() => setOpen(false), 150)
        }}
      />

      {showDropdown ? (
        <div
          className='list-group position-absolute w-100'
          style={{ zIndex: 50, maxHeight: 260, overflowY: 'auto' }}
        >
          {results.map(op => (
            <button
              type='button'
              key={op.key}
              className='list-group-item list-group-item-action'
              onClick={() => handlePick(op)}
            >
              <div className='d-flex justify-content-between gap-2'>
                <div className='flex-grow-1'>
                  <div className='fw-semibold'>
                    {op.productoNombre}{' '}
                    <span className='text-muted'>({op.id_producto})</span>
                  </div>
                  <div className='small text-muted'>
                    Lote: {op.id_lote} · {op.bodegaNombre || op.id_bodega}{' '}
                    {op.id_ubicacion || op.ubicacionNombre ? (
                      <>· {op.ubicacionNombre || op.id_ubicacion}</>
                    ) : null}
                  </div>
                </div>

                <div className='text-end small'>
                  <div className='fw-semibold'>Disp</div>
                  <div>{toNumberCO(op.cantidad).toLocaleString('es-CO')}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : null}

      {open && q.trim() && results.length === 0 ? (
        <div className='small text-muted mt-1'>Sin resultados</div>
      ) : null}
    </div>
  )
}

export default UbicarProductoInventario
