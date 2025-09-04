import './Transformacion.css'

const MetricsTransformacion = ({ data = [] }) => {
  const hoy = new Date()
  const primerDiaSemana = new Date(hoy)
  primerDiaSemana.setDate(hoy.getDate() - hoy.getDay() + 1)
  const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1)

  // 🔍 Filtrar solo registros con estado "Cerrado"
  const cerrados = data.filter(item => item.Estado === 'Cerrado')

  const cantidadSemana = cerrados.reduce((total, item) => {
    const fecha = new Date(item?.HistorialIngresoSalida?.Fecha_movimiento)
    return fecha >= primerDiaSemana && fecha <= hoy
      ? total + item.Cantidad
      : total
  }, 0)

  const cantidadMes = cerrados.reduce((total, item) => {
    const fecha = new Date(item?.HistorialIngresoSalida?.Fecha_movimiento)
    return fecha >= primerDiaMes && fecha <= hoy ? total + item.Cantidad : total
  }, 0)

  const productoTop = (() => {
    const conteo = {}
    cerrados.forEach(item => {
      const nombre = item.Producto?.Nombre
      if (nombre) {
        conteo[nombre] = (conteo[nombre] || 0) + item.Cantidad
      }
    })
    const max = Object.entries(conteo).sort((a, b) => b[1] - a[1])[0]
    return max ? `${max[0]} – ${max[1].toFixed(2)}` : '—'
  })()

  return (
    <div className='metrics-container'>
      <div className='metric-card azul'>
        <h4>Procesado esta Semana</h4>
        <p>{cantidadSemana.toFixed(2)}</p>
      </div>
      <div className='metric-card naranja'>
        <h4>Procesado este Mes</h4>
        <p>{cantidadMes.toFixed(2)}</p>
      </div>
      <div className='metric-card verde'>
        <h4>Producto más Transformado</h4>
        <p>{productoTop}</p>
      </div>
    </div>
  )
}

export default MetricsTransformacion
