import React, { useEffect, useMemo, useState } from 'react'
import {
  fetchClientes,
  fetchInventarioDetalleCompleto,
} from '../service.CrearTicket.js'

const safeText = v => String(v ?? '').trim()

const buildLabel = (name, description, max = 40) => {
  const n = safeText(name)
  const d = safeText(description)
  if (!d) return n
  const shortDesc = d.length > max ? `${d.slice(0, max)}…` : d
  return `${n} (${shortDesc})`
}

const parseLoteNumber = id_lote => {
  const m = String(id_lote ?? '').match(/(\d+)$/)
  return m ? Number(m[1]) : -1
}

export default function Paso2Catalogo({
  data,
  setData,
  loading,
  cats,
  pris,
  token, // ✅ lo recibimos
}) {
  const isOperacion = data.tipo === 'operacion'

  const categorias = useMemo(
    () =>
      Array.isArray(cats)
        ? cats
            .filter(c => c?.active === true)
            .sort((a, b) => (a?.order ?? 999) - (b?.order ?? 999))
        : [],
    [cats]
  )

  const prioridades = useMemo(
    () =>
      Array.isArray(pris)
        ? pris
            .filter(p => p?.active === true)
            .sort((a, b) => (a?.order ?? 999) - (b?.order ?? 999))
        : [],
    [pris]
  )

  const onCategoria = e => {
    const id = e.target.value
    const obj = categorias.find(c => c._id === id)
    setData(s => ({
      ...s,
      categoria_id: id,
      categoria_label: obj ? buildLabel(obj.name, obj.description) : '',
      categoria_color: obj?.color || '',
    }))
  }

  const onPrioridad = e => {
    const id = e.target.value
    const obj = prioridades.find(p => p._id === id)
    setData(s => ({
      ...s,
      prioridad_id: id,
      prioridad_label: obj ? buildLabel(obj.name, obj.description) : '',
      prioridad_color: obj?.color || '',
    }))
  }

  // =========================
  // OPERACIÓN
  // =========================
  const [clientes, setClientes] = useState([])
  const [inventario, setInventario] = useState([])
  const [opErr, setOpErr] = useState('')

  useEffect(() => {
    let alive = true

    const run = async () => {
      if (!isOperacion) return
      if (!token) {
        setOpErr('Sin token para cargar clientes/inventario.')
        return
      }

      setOpErr('')

      try {
        const [cliRes, invRes] = await Promise.all([
          fetchClientes({ page: 1, limit: 200 }, token),
          fetchInventarioDetalleCompleto(token),
        ])

        if (!alive) return

        // /cliente -> { total, page, limit, data:[...] }
        const cliItems = Array.isArray(cliRes?.data) ? cliRes.data : []
        setClientes(cliItems)

        // inventario puede venir array directo o envuelto
        const invItems = Array.isArray(invRes)
          ? invRes
          : Array.isArray(invRes?.data)
            ? invRes.data
            : []

        // Regla: Cantidad > 0
        setInventario(invItems.filter(i => Number(i?.Cantidad) > 0))
      } catch (e) {
        if (!alive) return
        setOpErr(
          e?.response?.data?.message ||
            e?.message ||
            'No se pudo cargar operación'
        )
      }
    }

    run()
    return () => {
      alive = false
    }
  }, [isOperacion, token])

  const lotes = useMemo(() => {
    const unique = new Map()
    inventario.forEach(i => {
      const lote = i?.LoteProducto?.id_lote
      if (lote) unique.set(lote, lote)
    })
    // GEN_055 arriba -> orden numérico desc
    return Array.from(unique.values()).sort(
      (a, b) => parseLoteNumber(b) - parseLoteNumber(a)
    )
  }, [inventario])

  const productos = useMemo(() => {
    if (!data.operacion_lote_id) return []
    return inventario.filter(
      i => i?.LoteProducto?.id_lote === data.operacion_lote_id
    )
  }, [inventario, data.operacion_lote_id])

  return (
    <div>
      <h6 className='fw-bold mb-2'>Paso 2 — Clasificación</h6>
      <p className='text-muted small mb-3'>
        Categoría, prioridad y contexto operativo si aplica.
      </p>

      <div className='row g-3'>
        {/* Categoría */}
        <div className='col-12 col-md-6'>
          <div className='card border-0 shadow-sm'>
            <div className='card-body'>
              <div className='fw-bold mb-2'>Categoría</div>
              <select
                className='form-select'
                value={data.categoria_id}
                onChange={onCategoria}
                disabled={loading}
              >
                <option value=''>-- selecciona --</option>
                {categorias.map(c => (
                  <option key={c._id} value={c._id}>
                    {buildLabel(c.name, c.description)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Prioridad */}
        <div className='col-12 col-md-6'>
          <div className='card border-0 shadow-sm'>
            <div className='card-body'>
              <div className='fw-bold mb-2'>Prioridad</div>
              <select
                className='form-select'
                value={data.prioridad_id}
                onChange={onPrioridad}
                disabled={loading}
              >
                <option value=''>-- selecciona --</option>
                {prioridades.map(p => (
                  <option key={p._id} value={p._id}>
                    {buildLabel(p.name, p.description)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ===== OPERACIÓN ===== */}
        {isOperacion && (
          <>
            <div className='col-12'>
              <div className='fw-bold mt-2'>Datos de operación</div>
              {opErr ? (
                <div className='text-danger small mt-1'>{opErr}</div>
              ) : null}
              {!opErr && (
                <div className='text-muted small mt-1'>
                  Clientes: {clientes.length} — Inventario disponible:{' '}
                  {inventario.length}
                </div>
              )}
            </div>

            {/* Subtipo */}
            <div className='col-12 col-md-4'>
              <select
                className='form-select'
                value={data.operacion_subtipo}
                onChange={e =>
                  setData(s => ({
                    ...s,
                    operacion_subtipo: e.target.value,
                  }))
                }
              >
                <option value=''>-- subtipo --</option>
                <option value='comercio'>Comercio</option>
                <option value='bodega'>Bodega</option>
              </select>
            </div>

            {/* Cliente */}
            <div className='col-12 col-md-8'>
              <select
                className='form-select'
                value={data.operacion_cliente_id}
                onChange={e =>
                  setData(s => ({
                    ...s,
                    operacion_cliente_id: e.target.value,
                  }))
                }
                disabled={!!opErr}
              >
                <option value=''>-- cliente --</option>
                {clientes
                  .filter(c => c?.Activo !== false)
                  .map(c => (
                    <option key={c.id_Cliente} value={c.id_Cliente}>
                      {c.id_Cliente} — {c.Nombre}
                    </option>
                  ))}
              </select>
            </div>

            {/* Lote */}
            <div className='col-12 col-md-6'>
              <select
                className='form-select'
                value={data.operacion_lote_id}
                onChange={e =>
                  setData(s => ({
                    ...s,
                    operacion_lote_id: e.target.value,
                    operacion_producto_id: '',
                  }))
                }
                disabled={!!opErr || lotes.length === 0}
              >
                <option value=''>-- lote --</option>
                {lotes.map(l => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>

            {/* Producto */}
            <div className='col-12 col-md-6'>
              <select
                className='form-select'
                value={data.operacion_producto_id}
                onChange={e =>
                  setData(s => ({
                    ...s,
                    operacion_producto_id: e.target.value,
                  }))
                }
                disabled={
                  !!opErr || !data.operacion_lote_id || productos.length === 0
                }
              >
                <option value=''>-- producto --</option>
                {productos.map(p => (
                  <option
                    key={`${p?.Producto?.Id_producto}-${p?.LoteProducto?.id_lote}-${p?.id_inventario ?? ''}`}
                    value={p?.Producto?.Id_producto}
                  >
                    {p?.Producto?.Id_producto} — {p?.Producto?.Nombre}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
