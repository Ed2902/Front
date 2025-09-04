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

const ProveedorVsTipo = () => {
  const [dataFormateada, setDataFormateada] = useState([])

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const datos = await getHistorialConLote()

        const resumen = {}

        datos.forEach(item => {
          const proveedor = item.LoteProducto?.id_proveedor || 'Sin proveedor'
          const tipo = item.LoteProducto?.Producto?.Tipo || 'Sin tipo'
          const cantidad = item.Cantidad || 0

          if (item.Movimiento_tipo !== 'Entrada') return

          if (!resumen[proveedor]) resumen[proveedor] = {}
          if (!resumen[proveedor][tipo]) resumen[proveedor][tipo] = 0

          resumen[proveedor][tipo] += cantidad
        })

        const data = Object.entries(resumen).map(([proveedor, tipos]) => ({
          proveedor,
          ...tipos,
        }))

        setDataFormateada(data)
      } catch (error) {
        console.error('Error cargando datos proveedor vs tipo:', error)
      }
    }

    cargarDatos()
  }, [])

  const tiposUnicos = Array.from(
    new Set(
      dataFormateada.flatMap(d => Object.keys(d).filter(k => k !== 'proveedor'))
    )
  )

  const colores = [
    '#F74C1B',
    '#59A1F7',
    '#67E1FF',
    '#00BA59',
    '#FFB347',
    '#B19CD9',
  ]

  return (
    <div className='grafico-proveedor-vs-tipo'>
      <h3>Comparativo: Proveedor vs Tipo de Producto</h3>
      {dataFormateada.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#888' }}>
          No hay datos disponibles.
        </p>
      ) : (
        <ResponsiveContainer width='100%' height={350}>
          <BarChart
            data={dataFormateada}
            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray='3 3' />
            <XAxis dataKey='proveedor' />
            <YAxis />
            <Tooltip />
            <Legend />
            {tiposUnicos.map((tipo, i) => (
              <Bar
                key={tipo}
                dataKey={tipo}
                stackId='1'
                fill={colores[i % colores.length]}
                name={tipo}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

export default ProveedorVsTipo
