import React, { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { getHistorialConLote } from './analitica.service'
import './Analitica.css' // 👉 Asegúrate de importar este archivo

const ContribucionTipoMensual = ({ año, tipoProducto }) => {
  const [dataFormateada, setDataFormateada] = useState([])

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const datos = await getHistorialConLote()

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

        datos.forEach(item => {
          const fecha = new Date(item.Fecha_movimiento)
          const añoItem = fecha.getFullYear().toString()
          const mesLabel = meses[fecha.getMonth()]
          const tipo = item.LoteProducto?.Producto?.Tipo || 'Sin tipo'
          const cantidad = item.Cantidad || 0

          const tipoMatch =
            !tipoProducto || tipoProducto === 'Todos' || tipo === tipoProducto

          if (
            item.Movimiento_tipo === 'Entrada' &&
            añoItem === año &&
            tipoMatch
          ) {
            if (!resumen[mesLabel]) resumen[mesLabel] = {}
            if (!resumen[mesLabel][tipo]) resumen[mesLabel][tipo] = 0
            resumen[mesLabel][tipo] += cantidad
          }
        })

        const data = Object.entries(resumen).map(([mes, tipos]) => ({
          mes,
          ...tipos,
        }))

        setDataFormateada(data)
      } catch (err) {
        console.error('Error cargando contribución mensual:', err)
      }
    }

    if (año) cargarDatos()
  }, [año, tipoProducto])

  const tiposUnicos = Array.from(
    new Set(
      dataFormateada.flatMap(d => Object.keys(d).filter(k => k !== 'mes'))
    )
  )

  const coloresEmpresa = [
    '#F74C1B', // primario
    '#59A1F7', // secundario
    '#67E1FF', // segundo secundario
    '#00BA59', // tercer color
    '#FFA500', // naranja alterno
    '#FF69B4', // rosa fuerte
    '#00CED1', // cyan
  ]

  return (
    <div className='grafico-wrapper'>
      <h3>Contribución Mensual por Tipo de Producto – {año}</h3>
      {dataFormateada.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#888' }}>
          No hay datos disponibles.
        </p>
      ) : (
        <ResponsiveContainer width='100%' height={350}>
          <BarChart
            className='grafico-animado'
            data={dataFormateada}
            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray='3 3' />
            <XAxis dataKey='mes' />
            <YAxis />
            <Tooltip />
            <Legend />
            {tiposUnicos.map((tipo, i) => (
              <Bar
                key={tipo}
                dataKey={tipo}
                stackId='1'
                fill={coloresEmpresa[i % coloresEmpresa.length]}
                name={tipo}
                animationDuration={1000}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

export default ContribucionTipoMensual
