import React, { useEffect, useState } from 'react'
import { getHistorialConLote, getInventarioPlano } from './analitica.service'
import './Analitica.css'

const RotacionProductos = ({ año, tipoProducto }) => {
  const [tablaRotacion, setTablaRotacion] = useState([])

  useEffect(() => {
    const calcularRotacion = async () => {
      try {
        const historial = await getHistorialConLote()
        const inventario = await getInventarioPlano()

        const salidas = historial.filter(d => {
          const fecha = new Date(d.Fecha_movimiento)
          const tipo = d.LoteProducto?.Producto?.Tipo?.toLowerCase() || ''
          return (
            d.Movimiento_tipo === 'Salida' &&
            fecha.getFullYear().toString() === año &&
            (!tipoProducto || tipo === tipoProducto.toLowerCase())
          )
        })

        const totalSalidas = {}
        salidas.forEach(d => {
          const producto = d.LoteProducto?.Producto?.Nombre || d.id_producto
          totalSalidas[producto] = (totalSalidas[producto] || 0) + d.Cantidad
        })

        const stockActual = {}
        inventario.forEach(d => {
          const tipo = d.Producto?.Tipo?.toLowerCase() || ''
          const producto = d.Producto?.Nombre || d.id_producto

          if (!producto) return // seguridad

          // incluir aunque no coincida el tipo, si no hay tipo definido
          const coincideTipo =
            !tipoProducto || tipo === tipoProducto.toLowerCase()

          if (coincideTipo) {
            stockActual[producto] = (stockActual[producto] || 0) + d.Cantidad
          }
        })

        // unificar productos de ambos orígenes
        const productos = Array.from(
          new Set([...Object.keys(stockActual), ...Object.keys(totalSalidas)])
        )

        const tabla = productos.map(producto => {
          const salida = totalSalidas[producto] || 0
          const stock = stockActual[producto] || 0
          const rotacion =
            stock > 0 ? (salida / stock).toFixed(2) : salida > 0 ? '∞' : '0.00'

          return {
            producto,
            salida,
            stock,
            rotacion,
          }
        })

        tabla.sort((a, b) => parseFloat(b.rotacion) - parseFloat(a.rotacion))
        setTablaRotacion(tabla)
      } catch (err) {
        console.error('Error calculando rotación:', err)
      }
    }

    if (año) calcularRotacion()
  }, [año, tipoProducto])

  return (
    <div className='tabla-rotacion'>
      <h3>
        Tasa de Rotación por Producto – {año}
        {tipoProducto ? ` / Tipo: ${tipoProducto}` : ''}
      </h3>
      {tablaRotacion.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#888' }}>
          No hay datos para este tipo de producto.
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Salidas (kg)</th>
              <th>Stock actual</th>
              <th>Rotación</th>
            </tr>
          </thead>
          <tbody>
            {tablaRotacion.map(row => (
              <tr key={row.producto}>
                <td>{row.producto}</td>
                <td>{row.salida}</td>
                <td>{row.stock}</td>
                <td>{row.rotacion}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default RotacionProductos
