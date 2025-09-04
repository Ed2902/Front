/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useMemo, useState } from 'react'
import { FaFileExcel } from 'react-icons/fa'
import { utils, writeFile } from 'xlsx'
import { getInventarioCompleto } from './inventario_service'
import { usePermisos } from '../../../hooks/usePermisos'
import './Inventario.css'

const InventarioLote = () => {
  const [dataOriginal, setDataOriginal] = useState([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [loading, setLoading] = useState(true)

  const { tienePermiso } = usePermisos()

  const puedeVerTipo = tipo => {
    if (tipo === 'RS') return tienePermiso('productosRS')
    if (tipo === 'Bodega') return tienePermiso('productosBodega')
    return false
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const data = await getInventarioCompleto()
        setDataOriginal(data)
      } catch (error) {
        console.error('Error cargando inventario por lote:', error.message)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const agrupadoPorLote = useMemo(() => {
    const mapa = {}

    for (const item of dataOriginal) {
      const tipo = item.Producto?.Tipo
      if (!puedeVerTipo(tipo)) continue // ❌ Si no tiene permiso, lo omitimos

      const lote = item.LoteProducto?.id_lote || 'Sin Lote'
      if (!mapa[lote]) {
        mapa[lote] = []
      }

      mapa[lote].push({
        id_producto: item.Producto?.Id_producto || item.id_producto,
        nombre_producto: item.Producto?.Nombre || 'Desconocido',
        unidad: item.Producto?.Unidad_de_medida || '',
        cantidad: item.Cantidad,
        bodega: item.Bodega?.nombre || item.id_bodega,
        ubicacion: item.UbicacionBodega?.nombre || item.id_ubicacion,
        fecha: new Date(item.Fecha_ultimo_registri).toLocaleDateString('es-CO'),
      })
    }

    // ❌ Remover lotes que quedaron vacíos
    return Object.fromEntries(
      // eslint-disable-next-line no-unused-vars
      Object.entries(mapa).filter(([_, productos]) => productos.length > 0)
    )
  }, [dataOriginal, puedeVerTipo])

  const lotesFiltrados = useMemo(() => {
    if (!globalFilter) return agrupadoPorLote
    const filtro = globalFilter.toLowerCase()
    return Object.fromEntries(
      Object.entries(agrupadoPorLote).filter(
        ([lote, items]) =>
          lote.toLowerCase().includes(filtro) ||
          items.some(item =>
            Object.values(item).some(val =>
              String(val).toLowerCase().includes(filtro)
            )
          )
      )
    )
  }, [agrupadoPorLote, globalFilter])

  const totalCantidad = useMemo(() => {
    return Object.values(lotesFiltrados)
      .flat()
      .reduce((sum, item) => sum + item.cantidad, 0)
  }, [lotesFiltrados])

  const exportToExcel = () => {
    const plano = Object.entries(lotesFiltrados).flatMap(([lote, productos]) =>
      productos.map(p => ({
        Lote: lote,
        Código: p.id_producto,
        Producto: p.nombre_producto,
        Unidad: p.unidad,
        Cantidad: p.cantidad,
        Bodega: p.bodega,
        Ubicación: p.ubicacion,
        Fecha: p.fecha,
      }))
    )
    const worksheet = utils.json_to_sheet(plano)
    const workbook = utils.book_new()
    utils.book_append_sheet(workbook, worksheet, 'Inventario por Lote')
    writeFile(workbook, 'InventarioPorLote.xlsx')
  }

  return (
    <div className='producto-container'>
      <div className='producto-header'>
        <div className='izquierda'>
          <button className='btn-excel' onClick={exportToExcel}>
            <FaFileExcel size={32} />
          </button>
        </div>
      </div>

      <div className='barra-busqueda-total'>
        <input
          type='text'
          placeholder='Buscar lote o producto...'
          className='form-control buscador-pequeno'
          value={globalFilter}
          onChange={e => setGlobalFilter(e.target.value)}
        />
        <span className='total-cantidad'>
          Total: {totalCantidad.toLocaleString()} unidades
        </span>
      </div>

      <div className='accordion' id='accordionLotes'>
        {loading ? (
          <p>Cargando datos...</p>
        ) : (
          Object.entries(lotesFiltrados).map(([lote, productos], index) => (
            <div className='accordion-item' key={lote}>
              <h2 className='accordion-header' id={`heading-${index}`}>
                <button
                  className='accordion-button collapsed'
                  type='button'
                  data-bs-toggle='collapse'
                  data-bs-target={`#collapse-${index}`}
                  aria-expanded='false'
                  aria-controls={`collapse-${index}`}
                >
                  Lote: {lote} ({productos.length} registros)
                </button>
              </h2>
              <div
                id={`collapse-${index}`}
                className='accordion-collapse collapse'
                aria-labelledby={`heading-${index}`}
                data-bs-parent='#accordionLotes'
              >
                <div className='accordion-body'>
                  <table className='table table-striped table-sm'>
                    <thead>
                      <tr>
                        <th>Código Producto</th>
                        <th>Nombre Producto</th>
                        <th>Unidad</th>
                        <th>Cantidad</th>
                        <th>Bodega</th>
                        <th>Ubicación</th>
                        <th>Última Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productos.map((p, i) => (
                        <tr key={i}>
                          <td>{p.id_producto}</td>
                          <td>{p.nombre_producto}</td>
                          <td>{p.unidad}</td>
                          <td>{p.cantidad}</td>
                          <td>{p.bodega}</td>
                          <td>{p.ubicacion}</td>
                          <td>{p.fecha}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default InventarioLote
