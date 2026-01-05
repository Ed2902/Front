// src/components/MenuFinanciera.jsx
import { useEffect, useMemo } from 'react'
import './MenuFinanciera.css'
import { usePermisos } from '../../../hooks/usePermisos'

const MenuFinanciera = ({ selectedSection, onSelectSection }) => {
  const { tienePermiso } = usePermisos()

  const botones = useMemo(() => {
    // Si no tiene el permiso general de Financiera, no mostramos nada
    if (!tienePermiso('financiera')) return []

    const items = [
      {
        label: 'Tabla Financiera',
        key: 'tabla-financiera',
        permiso: 'tablaFinanciera',
      },
      {
        label: 'Control de Facturas',
        key: 'control-facturas',
        permiso: 'controlFacturas',
      },
    ]

    // Solo mostrar lo que el usuario tiene permitido
    return items.filter(b => tienePermiso(b.permiso))
  }, [tienePermiso])

  // Si la sección seleccionada no está permitida, mandarlo a la primera permitida
  useEffect(() => {
    if (!botones.length) return

    const existe = botones.some(b => b.key === selectedSection)
    if (!existe) onSelectSection(botones[0].key)
  }, [botones, selectedSection, onSelectSection])

  // Si no hay nada permitido, no renderizamos el menú
  if (!botones.length) return null

  return (
    <div className='menu-financiera'>
      {botones.map(btn => (
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

export default MenuFinanciera
