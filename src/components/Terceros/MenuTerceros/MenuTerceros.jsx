// src/components/Terceros/MenuTerceros.jsx
import './MenuTerceros.css'
import { usePermisos } from '../../../hooks/usePermisos'

const MenuTerceros = ({ selectedSection, onSelectSection }) => {
  const { tienePermiso } = usePermisos()

  return (
    <div className='menu-terceros'>
      {tienePermiso('clientes') && (
        <button
          className={selectedSection === 'clientes' ? 'active' : ''}
          onClick={() => onSelectSection('clientes')}
        >
          Gestión de Clientes
        </button>
      )}

      {tienePermiso('proveedores') && (
        <button
          className={selectedSection === 'proveedores' ? 'active' : ''}
          onClick={() => onSelectSection('proveedores')}
        >
          Gestión de Proveedores
        </button>
      )}

      {/* ✅ Nueva opción: Personal Externo */}
      {tienePermiso('personal_externo') && (
        <button
          className={selectedSection === 'personal_externo' ? 'active' : ''}
          onClick={() => onSelectSection('personal_externo')}
        >
          Personal Externo
        </button>
      )}
    </div>
  )
}

export default MenuTerceros
