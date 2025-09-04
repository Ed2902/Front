import React, { useEffect, useState } from 'react'
import {
  RadialBarChart,
  RadialBar,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { getHistorialConLote } from './analitica.service'

const EntradasRadialPorProducto = ({ año, mes, tipoProducto }) => {
  const [data, setData] = useState([])

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const datos = await getHistorialConLote()
        const resumen = {}

        datos.forEach(d => {
          const fecha = new Date(d.Fecha_movimiento)
          const anioItem = fecha.getFullYear().toString()
          const mesItem = (fecha.getMonth() + 1).toString().padStart(2, '0')
          const tipo = d.LoteProducto?.Producto?.Tipo
          const producto = d.LoteProducto?.Producto?.Nombre || d.id_producto

          const esDelAnio = anioItem === año
          const esDelMes = mes === '00' || mes === mesItem
          const esDelTipo = tipoProducto ? tipo === tipoProducto : true
          const esEntradaProveedor =
            d.Movimiento_tipo === 'Entrada' &&
            (!d.id_bodega_origen || d.id_bodega_origen.trim() === '')

          if (esEntradaProveedor && esDelAnio && esDelMes && esDelTipo) {
            if (!resumen[producto]) resumen[producto] = 0
            resumen[producto] += d.Cantidad || 0
          }
        })

        const colores = [
          '#8884d8',
          '#83a6ed',
          '#8dd1e1',
          '#82ca9d',
          '#a4de6c',
          '#d0ed57',
          '#ffc658',
          '#ff7f50',
          '#00bcd4',
        ]

        const datosFinal = Object.entries(resumen)
          .map(([name, cantidad], i) => ({
            name,
            uv: cantidad,
            fill: colores[i % colores.length],
          }))
          .sort((a, b) => b.uv - a.uv)

        setData(datosFinal)
      } catch (err) {
        console.error('Error cargando entradas por producto:', err)
      }
    }

    if (año && tipoProducto) cargarDatos()
  }, [año, mes, tipoProducto])

  // 🎯 Tooltip personalizado
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload
      return (
        <div
          style={{
            backgroundColor: '#fff',
            border: '1px solid #ccc',
            padding: '8px',
            borderRadius: '6px',
          }}
        >
          <strong>{item.name}</strong>
          <br />
          Cantidad: {item.uv.toLocaleString()} kg
        </div>
      )
    }
    return null
  }

  return (
    <div className='grafico-radial-producto'>
      <h3>
        Entradas por Producto – {año}
        {mes !== '00' ? ` / Mes ${mes}` : ''}
      </h3>

      <div style={{ display: 'flex', gap: '30px', alignItems: 'center' }}>
        {/* Gráfico */}
        <div style={{ flex: 2, minWidth: '300px', height: '400px' }}>
          <ResponsiveContainer width='100%' height='100%'>
            <RadialBarChart
              cx='50%'
              cy='50%'
              innerRadius='10%'
              outerRadius='80%'
              barSize={10}
              data={data}
            >
              <RadialBar
                minAngle={15}
                label={{ position: 'insideStart', fill: '#fff' }}
                background
                clockWise
                dataKey='uv'
              />
              <Tooltip content={<CustomTooltip />} />
            </RadialBarChart>
          </ResponsiveContainer>
        </div>

        {/* Leyenda personalizada */}
        <div style={{ flex: 1 }}>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {data.map((item, index) => (
              <li
                key={index}
                style={{
                  color: item.fill,
                  marginBottom: '8px',
                  fontWeight: 'bold',
                }}
              >
                {item.name}: {item.uv.toLocaleString()} kg
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

export default EntradasRadialPorProducto
