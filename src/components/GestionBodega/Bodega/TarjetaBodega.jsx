import GaugeChart from 'react-gauge-chart'
import './Bodegas.css'

const TarjetaBodega = ({ nombre, capacidad, ocupado }) => {
  const porcentaje = capacidad > 0 ? ocupado / capacidad : 0
  const disponible = Math.max(capacidad - ocupado, 0).toFixed(2)
  const porcentajeTexto = (porcentaje * 100).toFixed(1)
  const colorGauge = porcentaje > 0.8 ? '#F74C1B' : '#00BA59'

  return (
    <div className='tarjeta-bodega'>
      <h4 className='bodega-titulo'>📦 {nombre}</h4>

      <GaugeChart
        id={`gauge-${nombre}`}
        nrOfLevels={20}
        percent={porcentaje}
        colors={['#00BA59', '#F74C1B']}
        arcWidth={0.3}
        arcsLength={[0.8, 0.2]}
        textColor='#000'
        needleColor={colorGauge}
        needleBaseColor={colorGauge}
        className='bodega-gauge'
      />

      <div className='bodega-info'>
        <p>
          <strong>Capacidad:</strong> {capacidad} m³
        </p>
        <p>
          <strong>Ocupado:</strong> {ocupado.toFixed(2)} m³
        </p>
        <p>
          <strong>Disponible:</strong> {disponible} m³
        </p>
        <p>
          <strong>% Ocupado:</strong> {porcentajeTexto}%
        </p>
      </div>
    </div>
  )
}

export default TarjetaBodega
