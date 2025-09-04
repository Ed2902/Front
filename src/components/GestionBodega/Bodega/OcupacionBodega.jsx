import TarjetaBodega from './TarjetaBodega'
import './Bodegas.css'

const OcupacionBodega = ({ bodegas, inventario }) => {
  const calcularVolumenPorBodega = id_bodega => {
    const inventarioBodega = inventario.filter(
      i => i.id_bodega === id_bodega && i.Producto
    )

    return inventarioBodega.reduce((total, item) => {
      const { Alto, Ancho, Largo } = item.Producto
      const cantidad = Number(item.Cantidad) || 0

      if (!Alto || !Ancho || !Largo) return total

      const volumenUnitarioM3 = (Alto * Ancho * Largo) / 1_000_000
      return total + volumenUnitarioM3 * cantidad
    }, 0)
  }

  return (
    <div className='ocupacion-grid'>
      {bodegas.map((bodega, index) => {
        const capacidad = Number(bodega.Capacidad) || 0
        const ocupado = calcularVolumenPorBodega(bodega.id_bodega)

        return (
          <div
            key={bodega.id_bodega}
            className='tarjeta-test-secuencial'
            style={{ animationDelay: `${index * 0.2}s` }}
          >
            <TarjetaBodega
              nombre={bodega.nombre}
              capacidad={capacidad}
              ocupado={ocupado}
            />
          </div>
        )
      })}
    </div>
  )
}

export default OcupacionBodega
