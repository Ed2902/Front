import { useState } from 'react'
import './Transformacion.css'

import EnTransformacion from './En_Transformacion'
import HistorialTransformacion from './Historial_Transformacion'

const Transformacion = () => {
  const [activeTab, setActiveTab] = useState('enCurso')

  const renderTabContent = () => {
    switch (activeTab) {
      case 'enCurso':
        return <EnTransformacion />
      case 'historial':
        return <HistorialTransformacion />
      default:
        return null
    }
  }

  return (
    <div className='transformacion-container'>
      <div className='barra-seleccion'>
        <ul className='selector-modulos'>
          <li
            className={activeTab === 'enCurso' ? 'activo' : ''}
            onClick={() => setActiveTab('enCurso')}
          >
            En Transformación
          </li>
          <li
            className={activeTab === 'historial' ? 'activo' : ''}
            onClick={() => setActiveTab('historial')}
          >
            Historial y Merma
          </li>
        </ul>
      </div>

      {renderTabContent()}
    </div>
  )
}

export default Transformacion
