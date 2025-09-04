import React, { useEffect, useState } from 'react'
import {
  ComposedChart,
  Bar,
  Line,
  Area,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { getHistorialConLote, getProveedores } from './analitica.service'

const EntradasPorProveedor = ({ mes, año, tipoProducto }) => {
  const [dataAgrupada, setDataAgrupada] = useState([])

  useEffect(() => {
    const procesarDatos = async () => {
      try {
        const [historial, proveedores] = await Promise.all([
          getHistorialConLote(),
          getProveedores(),
        ])

        const mapaProveedores = {}
        proveedores.forEach(p => {
          mapaProveedores[p.Id_proveedor] = p.Nombre
        })

        const meses = [
          'Ene',
          'Feb',
          'Mar',
          'Abr',
          'May',
          'Jun',
          'Jul',
          'Ago',
          'Sep',
          'Oct',
          'Nov',
          'Dic',
        ]

        const resumen = {}

        historial.forEach(item => {
          const fecha = new Date(item.Fecha_movimiento)
          const anioItem = fecha.getFullYear().toString()
          const mesItem = (fecha.getMonth() + 1).toString().padStart(2, '0')
          const tipo = item?.LoteProducto?.Producto?.Tipo

          const esDelAnio = anioItem === año
          const esDelMes = mes === '00' || mes === mesItem
          const esDelTipo = tipoProducto ? tipo === tipoProducto : true

          const esEntradaProveedor =
            item.Movimiento_tipo === 'Entrada' &&
            (!item.id_bodega_origen || item.id_bodega_origen.trim() === '')

          if (esEntradaProveedor && esDelAnio && esDelMes && esDelTipo) {
            const mesLabel = meses[fecha.getMonth()]
            const idProv = item?.LoteProducto?.id_proveedor
            const nombreProveedor =
              mapaProveedores[idProv] || idProv || 'Sin proveedor'
            const cantidad = item.Cantidad || 0

            if (!resumen[mesLabel]) resumen[mesLabel] = {}
            if (!resumen[mesLabel][nombreProveedor])
              resumen[mesLabel][nombreProveedor] = 0

            resumen[mesLabel][nombreProveedor] += cantidad
          }
        })

        const dataFormateada = Object.entries(resumen).map(
          ([mesLabel, proveedores]) => ({
            mes: mesLabel,
            ...proveedores,
          })
        )

        setDataAgrupada(dataFormateada)
      } catch (error) {
        console.error('Error procesando datos de proveedor:', error)
      }
    }

    if (año && tipoProducto) {
      procesarDatos()
    }
  }, [año, mes, tipoProducto])

  const proveedoresUnicos = Array.from(
    new Set(dataAgrupada.flatMap(d => Object.keys(d).filter(k => k !== 'mes')))
  )

  const colores = [
    '#F74C1B',
    '#59A1F7',
    '#67E1FF',
    '#00BA59',
    '#FFBE0B',
    '#C77DFF',
  ]

  // Tooltip personalizado que agrupa por proveedor
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const visto = new Set()
      return (
        <div
          style={{
            backgroundColor: '#fff',
            border: '1px solid #ccc',
            padding: '8px',
            borderRadius: '6px',
          }}
        >
          <strong>Mes: {label}</strong>
          <br />
          {payload
            .filter(entry => {
              const clave = entry.dataKey
              if (visto.has(clave)) return false
              visto.add(clave)
              return true
            })
            .map((entry, index) => (
              <div key={index}>
                {entry.name}: {entry.value.toLocaleString()} kg
              </div>
            ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className='grafico-proveedor'>
      <h3>
        Entradas por Proveedor – {año}
        {mes !== '00' ? ` / Mes ${mes}` : ''}
      </h3>
      <ResponsiveContainer width='100%' height={400}>
        <ComposedChart
          data={dataAgrupada}
          margin={{ top: 20, right: 30, bottom: 20, left: 20 }}
        >
          <CartesianGrid stroke='#f5f5f5' />
          <XAxis
            dataKey='mes'
            label={{ value: 'Mes', position: 'insideBottomRight', offset: 0 }}
            scale='band'
          />
          <YAxis
            label={{
              value: 'Cantidad (kg)',
              angle: -90,
              position: 'insideLeft',
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          {proveedoresUnicos.map((prov, index) => (
            <React.Fragment key={prov}>
              <Area
                type='monotone'
                dataKey={prov}
                fill={colores[index % colores.length]}
                stroke={colores[index % colores.length]}
                fillOpacity={0.2}
                legendType='none'
              />
              <Bar
                dataKey={prov}
                barSize={20}
                fill={colores[index % colores.length]}
              />
              <Line
                type='monotone'
                dataKey={prov}
                stroke={colores[index % colores.length]}
                strokeWidth={2}
                legendType='none'
              />
              <Scatter
                dataKey={prov}
                fill={colores[index % colores.length]}
                legendType='none'
              />
            </React.Fragment>
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

export default EntradasPorProveedor
