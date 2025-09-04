import './Menutickets.css'
import { useContext } from 'react'
import AuthContext from '../../../context/AuthContext'
import { usePermisos } from '../../../hooks/usePermisos'

const MenuTickets = ({ selectedSection, onSelectSection }) => {
  useContext(AuthContext)
  const { tienePermiso } = usePermisos()

  const botones = [
    { label: 'Usuarios', key: 'usuarios', permiso: 'crearTicket' },
    { label: 'Soporte', key: 'soporte', permiso: 'soporteTicket' },
  ]

  return (
    <div className='menu-tickets'>
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

export default MenuTickets
