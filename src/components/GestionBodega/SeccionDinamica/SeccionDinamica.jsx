import Productos from '../Producto/Producto'
import Lotes from '../Lotes/Lotes'
import './SeccionDinamica.css'
import Bodega from '../Bodega/Bodega' // o la ruta correcta según tu estructura
import Inventario from '../Inventario/Inventario'
import Transformacion from '../Transformacion/Transformacion'
import Movimientos from '../Movimientos/Movimientos'
import Analitica from '../analitica/Analitica'

const SeccionDinamica = ({ selectedSection }) => {
  let contenido

  switch (selectedSection) {
    case 'inventario':
      contenido = <Inventario />
      break
    case 'movimientos':
      contenido = <Movimientos />
      break
    case 'transformaciones':
      contenido = <Transformacion />
      break
    case 'bodegas':
      contenido = <Bodega />
      break
    case 'productos':
      contenido = <Productos />
      break
    case 'lotes':
      contenido = <Lotes />
      break
    case 'Dashboard':
      contenido = <Analitica />
      break
    default:
      contenido = <h2>Selecciona una sección</h2>
  }

  return <div className='gestion-bodega-seccion'>{contenido}</div>
}

export default SeccionDinamica
