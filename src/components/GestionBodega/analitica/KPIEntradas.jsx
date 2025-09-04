import React, { useEffect, useState } from 'react'
import { getHistorialConLote } from './analitica.service'

const KPIEntradas = ({ mes, año, tipoProducto }) => {
  const [totalEntradas, setTotalEntradas] = useState(0)
  const [actorMasActivo, setActorMasActivo] = useState('—')
  const [labelActor, setLabelActor] = useState('—')
  const [topProducto, setTopProducto] = useState('—')
  const [conteoMovimientos, setConteoMovimientos] = useState(0)

  useEffect(() => {
    const calcularKPIs = async () => {
      try {
        const datos = await getHistorialConLote()

        const filtrados = datos.filter(d => {
          const fecha = new Date(d.Fecha_movimiento)
          const añoOk = fecha.getFullYear().toString() === año
          const mesOk =
            mes === '00' ||
            (fecha.getMonth() + 1).toString().padStart(2, '0') === mes
          const tipoOk =
            !tipoProducto || d.LoteProducto?.Producto?.Tipo === tipoProducto

          const esEntrada = d.Movimiento_tipo === 'Entrada'
          const vieneDeProveedorCliente =
            !d.id_bodega_origen || d.id_bodega_origen.trim() === ''

          return (
            esEntrada && vieneDeProveedorCliente && añoOk && mesOk && tipoOk
          )
        })

        setConteoMovimientos(filtrados.length)

        const total = filtrados.reduce((acc, d) => acc + (d.Cantidad || 0), 0)
        setTotalEntradas(total)

        const porActor = {}
        const porProducto = {}

        let tieneProveedor = false
        let tieneCliente = false

        filtrados.forEach(d => {
          const producto = d.LoteProducto?.Producto?.Nombre || d.id_producto
          porProducto[producto] = (porProducto[producto] || 0) + d.Cantidad

          if (d.LoteProducto?.id_proveedor) {
            tieneProveedor = true
            const proveedor = d.LoteProducto.id_proveedor
            porActor[proveedor] = (porActor[proveedor] || 0) + d.Cantidad
          } else if (d.LoteProducto?.id_Cliente) {
            tieneCliente = true
            const cliente = d.LoteProducto.id_Cliente
            porActor[cliente] = (porActor[cliente] || 0) + d.Cantidad
          }
        })

        const actorTop = Object.entries(porActor).sort((a, b) => b[1] - a[1])[0]
        const productoTop = Object.entries(porProducto).sort(
          (a, b) => b[1] - a[1]
        )[0]

        setActorMasActivo(actorTop?.[0] || '—')
        setTopProducto(productoTop?.[0] || '—')

        if (tieneProveedor) {
          setLabelActor('Proveedor más activo')
        } else if (tieneCliente) {
          setLabelActor('Cliente más activo')
        } else {
          setLabelActor('Origen')
        }
      } catch (err) {
        console.error('Error cargando KPIs:', err)
      }
    }

    if (mes && año) calcularKPIs()
  }, [mes, año, tipoProducto])

  return (
    <div className='kpi-container'>
      <div className='kpi-card kpi-1'>
        <h4>Total entradas</h4>
        <p>{totalEntradas.toLocaleString()} kg</p>
      </div>
      <div className='kpi-card kpi-2'>
        <h4>{labelActor}</h4>
        <p>{actorMasActivo}</p>
      </div>
      <div className='kpi-card kpi-3'>
        <h4>Producto más ingresado</h4>
        <p>{topProducto}</p>
      </div>
      <div className='kpi-card kpi-4'>
        <h4># Movimientos</h4>
        <p>{conteoMovimientos}</p>
      </div>
    </div>
  )
}

export default KPIEntradas
