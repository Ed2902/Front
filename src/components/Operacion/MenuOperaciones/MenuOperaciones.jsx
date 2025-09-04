// src/components/Operaciones/MenuOperaciones/MenuOperaciones.jsx
import './MenuOperaciones.css'
import { useContext } from 'react'
import AuthContext from '../../../context/AuthContext'
import { usePermisos } from '../../../hooks/usePermisos'

const MenuOperaciones = ({ selectedSection, onSelectSection }) => {
  const { user } = useContext(AuthContext)
  const { tienePermiso } = usePermisos()

  // DEBUG: inspecciona lo que ve este componente
  console.log('MenuOperaciones.user.permisos (raw):', user?.permisos)
  console.log('permiso operador?', tienePermiso('operador'))
  console.log('permiso operacionRS?', tienePermiso('operacionRS'))
  console.log('permiso operaciones?', tienePermiso('operaciones'))

  const botones = [
    { label: 'Operaciones Bodega', key: 'bodega', permiso: 'operaciones' },
    { label: 'Operaciones RS', key: 'rs', permiso: 'operacionRS' },
    { label: 'Operador', key: 'operador', permiso: 'operador' },
  ]

  return (
    <div className='menu-operaciones'>
      {botones
        .filter(btn => tienePermiso(btn.permiso))
        .map(btn => (
          <button
            key={btn.key}
            className={`menu-button ${
              selectedSection === btn.key ? 'active' : ''
            }`}
            onClick={() => onSelectSection(btn.key)}
          >
            {btn.label}
          </button>
        ))}
    </div>
  )
}

export default MenuOperaciones
