// src/components/ControlIngresos/SeccionDinamicaControlDeIngresos/SeccionDinamicaControlDeIngresos.jsx
import './SeccionDinamicaControlDeIngresos.css'
import RegistrarUsuario from '../RegistrarUsuario/RegistrarUsuario'
import Marcacion from '../Marcacion/Marcacion'
import ReporteAsistencia from '../ReporteAsistencia/ReporteAsistencia'

const SeccionDinamicaControlDeIngresos = ({ selectedSection }) => {
  let contenido

  switch (selectedSection) {
    case 'crearUsuario':
      contenido = <RegistrarUsuario />
      break
    case 'marcacion':
      contenido = <Marcacion />
      break
    case 'reporte':
      contenido = <ReporteAsistencia />
      break
    default:
      contenido = <Marcacion />
  }

  return <div className='control-ingresos-seccion'>{contenido}</div>
}

export default SeccionDinamicaControlDeIngresos
