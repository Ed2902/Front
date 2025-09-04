import React, { useEffect, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { getHistorialConLote } from './analitica.service'

// 🎯 Punto personalizado con icono y color dinámico
const CustomizedDot = ({ cx, cy, value }) => {
  let fill = '#59A1F7' // azul por defecto
  if (value > 500) fill = '#00BA59' // verde
  else if (value < 100) fill = '#F74C1B' // naranja

  return (
    <svg
      x={cx - 10}
      y={cy - 10}
      width={20}
      height={20}
      viewBox='0 0 1024 1024'
      fill={fill}
    >
      <path d='M512 1009.984c-274.912 0-497.76-222.848-497.76-497.76s222.848-497.76 497.76-497.76c274.912 0 497.76 222.848 497.76 497.76s-222.848 497.76-497.76 497.76zM340.768 295.936c-39.488 0-71.52 32.8-71.52 73.248s32.032 73.248 71.52 73.248c39.488 0 71.52-32.8 71.52-73.248s-32.032-73.248-71.52-73.248zM686.176 296.704c-39.488 0-71.52 32.8-71.52 73.248s32.032 73.248 71.52 73.248c39.488 0 71.52-32.8 71.52-73.248s-32.032-73.248-71.52-73.248zM772.928 555.392c-18.752-8.864-40.928-0.576-49.632 18.528-40.224 88.576-120.256 143.552-208.832 143.552-85.952 0-164.864-52.64-205.952-137.376-9.184-18.912-31.648-26.592-50.08-17.28-18.464 9.408-21.216 21.472-15.936 32.64 52.8 111.424 155.232 186.784 269.76 186.784 117.984 0 217.12-70.944 269.76-186.784 8.672-19.136 9.568-31.2-9.12-40.096z' />
    </svg>
  )
}

const CrecimientoInventario = ({ año, mes, tipoProducto }) => {
  const [dataFormateada, setDataFormateada] = useState([])
  const [productosUnicos, setProductosUnicos] = useState([])
  const [productoSeleccionado, setProductoSeleccionado] = useState('Todos')

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const datos = await getHistorialConLote()
        const resumen = {}

        datos.forEach(item => {
          const fecha = new Date(item.Fecha_movimiento)
          const añoItem = fecha.getFullYear().toString()
          const mesItem = (fecha.getMonth() + 1).toString().padStart(2, '0')
          const dia = fecha.getDate().toString()
          const tipo = item.LoteProducto?.Producto?.Tipo || ''
          const producto =
            item?.LoteProducto?.Producto?.Nombre || item.id_producto
          const cantidad = item.Cantidad || 0

          const esEntradaProveedor =
            item.Movimiento_tipo === 'Entrada' &&
            (!item.id_bodega_origen || item.id_bodega_origen.trim() === '')

          const esDelAño = añoItem === año
          const esDelMes = mes === '00' || mes === mesItem

          if (
            esEntradaProveedor &&
            esDelAño &&
            esDelMes &&
            (!tipoProducto || tipo === tipoProducto)
          ) {
            if (!resumen[dia]) resumen[dia] = {}
            if (!resumen[dia][producto]) resumen[dia][producto] = 0
            resumen[dia][producto] += cantidad
          }
        })

        const data = Object.entries(resumen)
          .map(([dia, productos]) => ({
            dia,
            ...productos,
          }))
          .sort((a, b) => parseInt(a.dia) - parseInt(b.dia))

        setDataFormateada(data)

        const productos = new Set()
        data.forEach(d => {
          Object.keys(d).forEach(k => {
            if (k !== 'dia') productos.add(k)
          })
        })
        setProductosUnicos(Array.from(productos))
      } catch (error) {
        console.error('Error al cargar crecimiento de inventario:', error)
      }
    }

    if (año) cargarDatos()
  }, [año, mes, tipoProducto])

  const colores = [
    '#F74C1B',
    '#59A1F7',
    '#67E1FF',
    '#00BA59',
    '#FFB347',
    '#B19CD9',
  ]

  return (
    <div
      className='grafico-crecimiento'
      style={{
        marginTop: '-20px',
        paddingBottom: '10px',
        paddingTop: '10px',
      }}
    >
      <h3 style={{ marginBottom: 10 }}>
        Crecimiento Diario de Inventario – {mes}/{año}
      </h3>

      <div style={{ margin: '10px 0 12px 0' }}>
        <label style={{ marginRight: 10, fontWeight: 'bold' }}>
          Producto:{' '}
        </label>
        <select
          value={productoSeleccionado}
          onChange={e => setProductoSeleccionado(e.target.value)}
        >
          <option value='Todos'>Todos</option>
          {productosUnicos.map(p => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      {dataFormateada.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#888' }}>
          No hay datos disponibles.
        </p>
      ) : (
        <ResponsiveContainer width='100%' height={300}>
          <LineChart
            data={dataFormateada}
            margin={{ top: 5, right: 30, left: 20, bottom: 40 }}
          >
            <CartesianGrid strokeDasharray='3 3' />
            <XAxis
              dataKey='dia'
              label={{ value: 'Día', position: 'insideBottom', offset: -5 }}
            />
            <YAxis
              label={{ value: 'Kg', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip />
            <Legend />
            {productosUnicos
              .filter(
                prod =>
                  productoSeleccionado === 'Todos' ||
                  prod === productoSeleccionado
              )
              .map((prod, index) => (
                <Line
                  key={prod}
                  type='monotone'
                  dataKey={prod}
                  stroke={colores[index % colores.length]}
                  strokeWidth={2}
                  dot={<CustomizedDot />}
                  activeDot={{ r: 5 }}
                  name={prod}
                />
              ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

export default CrecimientoInventario
