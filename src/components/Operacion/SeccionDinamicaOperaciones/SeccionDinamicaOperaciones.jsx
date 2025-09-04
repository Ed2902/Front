// src/components/Operaciones/SeccionDinamicaOperaciones/SeccionDinamicaOperaciones.jsx

import './SeccionDinamicaOperaciones.css'
import Tabladeoperacion from '../Tabladeoperacion/Tabladeoperacion'
import Tabladeoperador from '../Tabladeoperador/Tabladeoperador'

const SeccionDinamicaOperaciones = ({ selectedSection }) => {
  let contenido

  switch (selectedSection) {
    case 'bodega':
      contenido = <Tabladeoperacion />
      break
    case 'rs':
      contenido = <h3>Vista de Operaciones RS (pendiente)</h3>
      break
    case 'operador':
      contenido = <Tabladeoperador /> // 👈 mostrar tabla del operador
      break
    default:
      contenido = <h3>Selecciona una sección de operaciones</h3>
  }

  return <div className='operaciones-seccion'>{contenido}</div>
}

export default SeccionDinamicaOperaciones
