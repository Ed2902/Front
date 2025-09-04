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

const SalidasPorCliente = ({ tipoProducto, mes, año }) => {
  const [dataAgrupada, setDataAgrupada] = useState([])

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

        datos.forEach(d => {
          const fecha = new Date(d.Fecha_movimiento)
          const anioItem = fecha.getFullYear().toString()
          const mesItem = (fecha.getMonth() + 1).toString().padStart(2, '0')
          const mesLabel = meses[fecha.getMonth()]

          const esSalida = d.Movimiento_tipo === 'Salida'
          const esDelAnio = anioItem === año
          const esDelMes = mes === '00' || mes === mesItem
          const esDelTipo = d.LoteProducto?.Producto?.Tipo === tipoProducto
          const cliente = d.LoteProducto?.id_Cliente || 'Sin cliente'

          if (esSalida && esDelAnio && esDelMes && esDelTipo) {
            const cantidad = d.Cantidad || 0

            if (!resumen[mesLabel]) resumen[mesLabel] = {}
            if (!resumen[mesLabel][cliente]) resumen[mesLabel][cliente] = 0

            resumen[mesLabel][cliente] += cantidad
          }
        })

        const data = Object.entries(resumen).map(([mesLabel, clientes]) => ({
          mes: mesLabel,
          ...clientes,
        }))

        setDataAgrupada(data)
      } catch (err) {
        console.error('Error cargando salidas por cliente:', err)
      }
    }

    cargarDatos()
  }, [tipoProducto, mes, año])

  const clientesUnicos = Array.from(
    new Set(dataAgrupada.flatMap(d => Object.keys(d).filter(k => k !== 'mes')))
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
    <div className='grafico-cliente'>
      <h3>Salidas por Cliente – Tipo: {tipoProducto}</h3>
      <ResponsiveContainer width='100%' height={280}>
        <BarChart
          data={dataAgrupada}
          margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray='3 3' />
          <XAxis dataKey='mes' />
          <YAxis />
          <Tooltip />
          <Legend />

          {clientesUnicos.map((cli, index) => (
            <Bar
              key={cli}
              dataKey={cli}
              fill={colores[index % colores.length]}
              name={cli}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default SalidasPorCliente
