/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useMemo, useState } from 'react'
import { FaFileExcel } from 'react-icons/fa'
import { utils, writeFile } from 'xlsx'
import { getInventarioCompleto } from './inventario_service'
import { usePermisos } from '../../../hooks/usePermisos'
import './Inventario.css'

const InventarioPorTercero = () => {
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
        console.error('Error cargando inventario:', error.message)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const agrupadoPorTercero = useMemo(() => {
    const mapa = {}

    for (const item of dataOriginal) {
      const tipo = item.Producto?.Tipo
      if (!puedeVerTipo(tipo)) continue
      if (item.Cantidad <= 0) continue

      const tercero =
        item.LoteProducto?.Cliente?.Nombre ||
        item.LoteProducto?.Proveedor?.Nombre ||
        'Desconocido'
      if (!mapa[tercero]) mapa[tercero] = []

      const { Alto, Ancho, Largo } = item.Producto || {}
      const volumenUnitario = (Alto * Ancho * Largo) / 1_000_000 // m³
      const volumenTotal = volumenUnitario * item.Cantidad // m³
      const volumenTotalCm3 = volumenTotal * 1_000_000 // cm³

      mapa[tercero].push({
        id_producto: item.Producto?.Id_producto || item.id_producto,
        nombre_producto: item.Producto?.Nombre || 'Desconocido',
        tipo: item.Producto?.Tipo || '',
        unidad: item.Producto?.Unidad_de_medida || '',
        cantidad: item.Cantidad,
        volumen_m3: volumenTotal,
        volumen_cm3: volumenTotalCm3,
        bodega: item.Bodega?.nombre || item.id_bodega,
        ubicacion: item.UbicacionBodega?.nombre || item.id_ubicacion,
        fecha: new Date(item.Fecha_ultimo_registri).toLocaleDateString('es-CO'),
      })
    }

    return Object.fromEntries(
      // eslint-disable-next-line no-unused-vars
      Object.entries(mapa).filter(([_, items]) => items.length > 0)
    )
  }, [dataOriginal, puedeVerTipo])

  const tercerosFiltrados = useMemo(() => {
    if (!globalFilter) return agrupadoPorTercero
    const filtro = globalFilter.toLowerCase()
    return Object.fromEntries(
      Object.entries(agrupadoPorTercero).filter(
        ([tercero, items]) =>
          tercero.toLowerCase().includes(filtro) ||
          items.some(item =>
            Object.values(item).some(val =>
              String(val).toLowerCase().includes(filtro)
            )
          )
      )
    )
  }, [agrupadoPorTercero, globalFilter])

  const exportToExcel = () => {
    const plano = Object.entries(tercerosFiltrados).flatMap(
      ([tercero, productos]) =>
        productos.map(p => ({
          Tercero: tercero,
          Código: p.id_producto,
          Producto: p.nombre_producto,
          Unidad: p.unidad,
          Cantidad: p.cantidad,
          'Volumen m³': p.volumen_m3.toFixed(5),
          'Volumen cm³': p.volumen_cm3.toFixed(0),
          Bodega: p.bodega,
          Ubicación: p.ubicacion,
          Fecha: p.fecha,
        }))
    )
    const worksheet = utils.json_to_sheet(plano)
    const workbook = utils.book_new()
    utils.book_append_sheet(workbook, worksheet, 'Inventario por Tercero')
    writeFile(workbook, 'InventarioPorTercero.xlsx')
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
          placeholder='Buscar cliente o proveedor...'
          className='form-control buscador-pequeno'
          value={globalFilter}
          onChange={e => setGlobalFilter(e.target.value)}
        />
      </div>

      <div className='accordion' id='accordionTerceros'>
        {loading ? (
          <p>Cargando datos...</p>
        ) : (
          Object.entries(tercerosFiltrados).map(
            ([tercero, productos], index) => {
              const totalVolumen = productos.reduce(
                (sum, p) => sum + p.volumen_m3,
                0
              )
              return (
                <div className='accordion-item' key={tercero}>
                  <h2 className='accordion-header' id={`heading-${index}`}>
                    <button
                      className='accordion-button collapsed'
                      type='button'
                      data-bs-toggle='collapse'
                      data-bs-target={`#collapse-${index}`}
                      aria-expanded='false'
                      aria-controls={`collapse-${index}`}
                    >
                      {tercero} —{' '}
                      {totalVolumen.toLocaleString('es-CO', {
                        minimumFractionDigits: 5,
                        maximumFractionDigits: 5,
                      })}{' '}
                      m³
                    </button>
                  </h2>
                  <div
                    id={`collapse-${index}`}
                    className='accordion-collapse collapse'
                    aria-labelledby={`heading-${index}`}
                    data-bs-parent='#accordionTerceros'
                  >
                    <div className='accordion-body'>
                      <table className='table table-striped table-sm'>
                        <thead>
                          <tr>
                            <th>Código</th>
                            <th>Producto</th>
                            <th>Unidad</th>
                            <th>Cantidad</th>
                            <th>Volumen (m³)</th>
                            <th>Volumen (cm³)</th>
                            <th>Bodega</th>
                            <th>Ubicación</th>
                            <th>Fecha</th>
                          </tr>
                        </thead>
                        <tbody>
                          {productos.map((p, i) => (
                            <tr key={i}>
                              <td>{p.id_producto}</td>
                              <td>{p.nombre_producto}</td>
                              <td>{p.unidad}</td>
                              <td>{p.cantidad}</td>
                              <td>{p.volumen_m3.toFixed(5)}</td>
                              <td>
                                {p.volumen_cm3
                                  .toFixed(0)
                                  .toLocaleString('es-CO')}
                              </td>
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
              )
            }
          )
        )}
      </div>
    </div>
  )
}

export default InventarioPorTercero
