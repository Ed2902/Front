import './MenuGestionBodega.css'
import { usePermisos } from '../../../hooks/usePermisos'

const MenuGestionBodega = ({ selectedSection, onSelectSection }) => {
  const { tienePermiso } = usePermisos()

  const botones = [
    {
      label: 'Inventario',
      key: 'inventario',
      protegido: true,
      permiso: 'inventario',
    },
    { label: 'Movimientos', key: 'movimientos' },
    { label: 'En transfor...', key: 'transformaciones' },
    { label: 'Bodegas', key: 'bodegas' },
    { label: 'Productos', key: 'productos' },
    { label: 'Lotes', key: 'lotes' },
    {
      label: 'Dashboard',
      key: 'Dashboard',
      protegido: true,
      permiso: 'dashboard',
    },
  ]

  return (
    <div className='menu-gestion-bodega'>
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

export default MenuGestionBodega
