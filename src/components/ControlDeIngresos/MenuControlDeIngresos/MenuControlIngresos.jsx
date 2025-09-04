// src/components/ControlIngresos/MenuControlIngresos/MenuControlIngresos.jsx
import './MenuControlIngresos.css'
import { usePermisos } from '../../../hooks/usePermisos'

const MenuControlIngresos = ({ selectedSection, onSelectSection }) => {
  const { tienePermiso } = usePermisos()

  const botones = [
    {
      label: 'Registrar usuario',
      key: 'crearUsuario',
      protegido: true,
      permiso: 'crearUsuario',
    },
    {
      label: 'Marcación de horario',
      key: 'marcacion',
      protegido: true,
      permiso: 'marcacion',
    },
    {
      label: 'Reporte de horarios',
      key: 'reporte',
      protegido: true,
      permiso: 'reporte',
    },
  ]

  return (
    <div className='menu-control-ingresos'>
      {botones
        .filter(btn => !btn.protegido || tienePermiso(btn.permiso))
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

export default MenuControlIngresos
