import { useState } from 'react'
import Modal from 'react-modal'
import './Inventario.css'
import {
  FaBoxes,
  FaTruckLoading,
  FaUserFriends,
  FaSearch,
  FaExchangeAlt,
  FaArrowDown,
  FaArrowUp,
  FaRetweet,
  FaWarehouse,
} from 'react-icons/fa'

import InventarioGeneral from './InventarioGeneral'
import InventarioProveedor from './InventarioProveedor'
import InventarioCliente from './InventarioCliente'
import InventarioLote from './InventarioLote.jsx'
import InventarioPorTercero from './InventarioPorTercero.jsx'
import UbicarProducto from './UbicarProducto'
import FormIngreso from './Formingreso'
import FormTransformacion from './FormTransformacion'
import FormSalida from './FormSalida'
import { usePermisos } from '../../../hooks/usePermisos'

Modal.setAppElement('#root')

const Inventario = () => {
  const [activeTab, setActiveTab] = useState('general')
  const [modalTipoMovimiento, setModalTipoMovimiento] = useState(false)
  const [modalEntrada, setModalEntrada] = useState(false)
  const [modalSalida, setModalSalida] = useState(false)
  const [modalTransformacion, setModalTransformacion] = useState(false)

  const { tienePermiso } = usePermisos()
  const puedeVerRS = tienePermiso('productosRS')
  const puedeVerBodega = tienePermiso('productosBodega')

  const renderTabContent = () => {
    if (activeTab === 'general') return <InventarioGeneral />
    if (activeTab === 'proveedor' && puedeVerRS) return <InventarioProveedor />
    if (activeTab === 'cliente' && puedeVerBodega) return <InventarioCliente />
    if (activeTab === 'lote' && (puedeVerRS || puedeVerBodega))
      return <InventarioLote />
    if (activeTab === 'ocupacion' && (puedeVerRS || puedeVerBodega))
      return <InventarioPorTercero />
    if (activeTab === 'buscar') return <UbicarProducto />
    return null
  }

  return (
    <div className='inventario-container'>
      <div className='barra-seleccion'>
        <ul className='selector-modulos'>
          <li
            className={activeTab === 'general' ? 'activo' : ''}
            onClick={() => setActiveTab('general')}
          >
            <FaBoxes className='icono-tab' /> Inventario General
          </li>

          {puedeVerRS && (
            <li
              className={activeTab === 'proveedor' ? 'activo' : ''}
              onClick={() => setActiveTab('proveedor')}
            >
              <FaTruckLoading className='icono-tab' /> Por Proveedor
            </li>
          )}

          {puedeVerBodega && (
            <li
              className={activeTab === 'cliente' ? 'activo' : ''}
              onClick={() => setActiveTab('cliente')}
            >
              <FaUserFriends className='icono-tab' /> Por Cliente
            </li>
          )}

          {(puedeVerRS || puedeVerBodega) && (
            <>
              <li
                className={activeTab === 'lote' ? 'activo' : ''}
                onClick={() => setActiveTab('lote')}
              >
                <FaBoxes className='icono-tab' /> Por Lote
              </li>
              <li
                className={activeTab === 'ocupacion' ? 'activo' : ''}
                onClick={() => setActiveTab('ocupacion')}
              >
                <FaWarehouse className='icono-tab' /> Ocupando
              </li>
            </>
          )}
        </ul>

        <div className='acciones-derecha'>
          <button
            className='btn-agregar'
            onClick={() => setActiveTab('buscar')}
          >
            <FaSearch style={{ marginRight: '6px' }} />
            Ubicar Producto
          </button>
          <button
            className='btn-agregar'
            onClick={() => setModalTipoMovimiento(true)}
          >
            <FaExchangeAlt style={{ marginRight: '6px' }} />
            Hacer Movimiento
          </button>
        </div>
      </div>

      {/* Contenido dinámico */}
      {renderTabContent()}

      {/* Modal selector de tipo */}
      <Modal
        isOpen={modalTipoMovimiento}
        onRequestClose={() => setModalTipoMovimiento(false)}
        className='modal-content modal-tipo-movimiento'
        overlayClassName='modal-overlay'
      >
        <h3 className='mb-4 text-center'>Selecciona el tipo de movimiento</h3>
        <div className='botones-movimiento'>
          <button
            className='btn-movimiento entrada'
            onClick={() => {
              setModalEntrada(true)
              setModalTipoMovimiento(false)
            }}
          >
            <FaArrowDown className='icono-mov' /> Entrada
          </button>

          <button
            className='btn-movimiento salida'
            onClick={() => {
              setModalSalida(true)
              setModalTipoMovimiento(false)
            }}
          >
            <FaArrowUp className='icono-mov' /> Salida
          </button>

          <button
            className='btn-movimiento transformacion'
            onClick={() => {
              setModalTransformacion(true)
              setModalTipoMovimiento(false)
            }}
          >
            <FaRetweet className='icono-mov' /> Transformación
          </button>
        </div>
      </Modal>

      {/* Modal Entrada */}
      <Modal
        isOpen={modalEntrada}
        onRequestClose={() => setModalEntrada(false)}
        className='modal-content'
        overlayClassName='modal-overlay'
      >
        <FormIngreso onSuccess={() => setModalEntrada(false)} />
      </Modal>

      {/* Modal Salida */}
      <Modal
        isOpen={modalSalida}
        onRequestClose={() => setModalSalida(false)}
        className='modal-content salida-modal'
        overlayClassName='modal-overlay'
      >
        <FormSalida onSuccess={() => setModalSalida(false)} />
      </Modal>

      {/* Modal Transformación */}
      <Modal
        isOpen={modalTransformacion}
        onRequestClose={() => setModalTransformacion(false)}
        className='modal-content transformacion-modal'
        overlayClassName='modal-overlay'
      >
        <FormTransformacion onSuccess={() => setModalTransformacion(false)} />
      </Modal>
    </div>
  )
}

export default Inventario
