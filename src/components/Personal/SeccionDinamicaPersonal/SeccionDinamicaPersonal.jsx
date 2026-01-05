// src/components/Personal/SeccionDinamicaPersonal/SeccionDinamicaPersonal.jsx

import MiPerfil from '../../Personal/Perfil/MiPerfil'
import HistorialPersonal from '../../Personal/Perfil/HistorialPersonal'

// 🔥 Importamos los 3 nuevos componentes:
import SeguimientoPersonal from '../../Personal/Seguimiento/SeguimientoPersonal'

const SeccionDinamicaPersonal = ({ selectedSection }) => {
  let contenido

  switch (selectedSection) {
    case 'mi-perfil':
      contenido = (
        <>
          <MiPerfil />

          {/* Separación visual */}
          <div className='mt-4'></div>

          {/* Historial debajo del perfil */}
          <HistorialPersonal />
        </>
      )
      break

    case 'perfiles-personal':
      contenido = (
        <>
          {/* 🔥 AQUÍ VA EL SELECT + PERFIL + HISTORIAL EXTERNO */}
          <SeguimientoPersonal />
        </>
      )
      break

    default:
      contenido = <h2>Selecciona una sección</h2>
  }

  return <div className='personal-seccion'>{contenido}</div>
}

export default SeccionDinamicaPersonal
