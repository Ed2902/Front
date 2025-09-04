import React from 'react'
import { FaFileExcel } from 'react-icons/fa' // Importamos el ícono de Excel
import './FiltrosMovimientos.css'

const FiltrosMovimientos = ({
  globalFilter,
  setGlobalFilter,
  tiposSeleccionados,
  handleTipoChange,
  tipoProductoFiltro,
  setTipoProductoFiltro,
  clienteFiltro,
  setClienteFiltro,
  proveedorFiltro,
  setProveedorFiltro,
  clientesDisponibles = [],
  proveedoresDisponibles = [],
  onExportExcel,
  total,
}) => {
  return (
    <div className='filtros-movimientos'>
      <div className='filtros-superiores'>
        <input
          type='text'
          placeholder='Buscar...'
          value={globalFilter}
          onChange={e => setGlobalFilter(e.target.value)}
          className='input-busqueda'
        />

        <button className='btn-excel' onClick={onExportExcel}>
          {/* Botón con ícono de Excel */}
          <FaFileExcel size={20} />{' '}
          {/* Puedes ajustar el tamaño del ícono aquí */}
        </button>

        <span className='total-registros'>
          Total: <strong>{total}</strong>
        </span>
      </div>

      <div className='grupo-filtros'>
        <div className='filtro-grupo'>
          <label className='filtro-label'>Tipo de Movimiento:</label>
          <div className='filtro-checklist'>
            <label>
              <input
                type='checkbox'
                checked={tiposSeleccionados.length === 3}
                onChange={() => handleTipoChange('todos')}
              />
              Todos
            </label>
            {['entrada', 'salida', 'transformacion'].map(tipo => (
              <label key={tipo}>
                <input
                  type='checkbox'
                  checked={tiposSeleccionados.includes(tipo)}
                  onChange={() => handleTipoChange(tipo)}
                />
                {tipo.charAt(0).toUpperCase() + tipo.slice(1)}
              </label>
            ))}
          </div>
        </div>

        <div className='filtro-grupo'>
          <label className='filtro-label'>Tipo de Producto:</label>
          <select
            value={tipoProductoFiltro}
            onChange={e => setTipoProductoFiltro(e.target.value)}
            className='select-filtro'
          >
            <option value='todos'>Todos</option>
            <option value='rs'>RS</option>
            <option value='bodega'>Bodega</option>
          </select>
        </div>

        <div className='filtro-grupo'>
          <label className='filtro-label'>Cliente:</label>
          <select
            value={clienteFiltro}
            onChange={e => setClienteFiltro(e.target.value)}
            className='select-filtro'
          >
            <option value='todos'>Todos</option>
            {clientesDisponibles.map(cliente => (
              <option key={cliente} value={cliente}>
                {cliente}
              </option>
            ))}
          </select>
        </div>

        <div className='filtro-grupo'>
          <label className='filtro-label'>Proveedor:</label>
          <select
            value={proveedorFiltro}
            onChange={e => setProveedorFiltro(e.target.value)}
            className='select-filtro'
          >
            <option value='todos'>Todos</option>
            {proveedoresDisponibles.map(prov => (
              <option key={prov} value={prov}>
                {prov}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}

export default FiltrosMovimientos
