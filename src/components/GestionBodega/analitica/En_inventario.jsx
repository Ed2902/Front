import React, { useEffect, useState } from 'react'
import {
  ComposedChart,
  Line,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { getHistorialConLote, getInventarioPlano } from './analitica.service'

const En_inventario = ({ tipoProducto }) => {
  const [data, setData] = useState([])

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const [historial, inventario] = await Promise.all([
          getHistorialConLote(),
          getInventarioPlano(),
        ])

        const infoProductos = {}
        historial.forEach(h => {
          const producto = h.LoteProducto?.Producto
          if (producto) {
            infoProductos[producto.Id_producto] = {
              nombre: producto.Nombre,
              tipo: producto.Tipo,
            }
          }
        })

        const resumen = {}
        inventario.forEach(d => {
          const prodInfo = infoProductos[d.id_producto]
          if (!prodInfo) return

          if (!tipoProducto || prodInfo.tipo === tipoProducto) {
            const nombre = prodInfo.nombre || d.id_producto
            const cantidad = d.Cantidad || 0
            resumen[nombre] = (resumen[nombre] || 0) + cantidad
          }
        })

        const dataFormateada = Object.entries(resumen)
          .map(([producto, cantidad]) => ({ producto, cantidad }))
          .sort((a, b) => b.cantidad - a.cantidad)

        setData(dataFormateada)
      } catch (err) {
        console.error('Error al cargar inventario actual:', err)
      }
    }

    cargarDatos()
  }, [tipoProducto])

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div
          style={{
            background: '#fff',
            padding: '8px 12px',
            border: '1px solid #ccc',
            borderRadius: '6px',
            fontSize: '14px',
          }}
        >
          <p style={{ fontWeight: 'bold' }}>Producto: {label}</p>
          <p style={{ color: '#59A1F7' }}>
            Cantidad: <strong>{payload[0].value} kg</strong>
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div className='grafico-inventario grafico-expandible'>
      <h3 style={{ marginBottom: 10 }}>Productos en Inventario Actual</h3>
      {data.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#888' }}>
          No hay datos disponibles.
        </p>
      ) : (
        <div style={{ width: '100%', height: '100%' }}>
          <ResponsiveContainer width='100%' height='100%'>
            <ComposedChart
              layout='vertical'
              data={data}
              margin={{ top: 20, right: 30, bottom: 40, left: 0 }}
            >
              <CartesianGrid stroke='#f5f5f5' />
              <XAxis
                type='number'
                tickFormatter={v => `${v} kg`}
                label={{
                  value: 'Cantidad (kg)',
                  position: 'insideBottom',
                  offset: -10,
                }}
              />
              <YAxis
                type='category'
                dataKey='producto'
                width={110}
                tick={{ fontSize: 14 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type='monotone'
                dataKey='cantidad'
                fill='rgba(103, 225, 255, 0.6)'
                stroke='#67E1FF'
              />
              <Bar dataKey='cantidad' barSize={18} fill='#59A1F7' />
              <Line
                type='monotone'
                dataKey='cantidad'
                stroke='#F74C1B'
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

export default En_inventario
