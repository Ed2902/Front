import { useState } from 'react'
import Modal from 'react-modal'
import './Movimientos.css'
import {
  FaProjectDiagram,
  FaTable,
  FaExchangeAlt,
  FaArrowDown,
  FaArrowUp,
  FaRetweet,
} from 'react-icons/fa'

// Subcomponentes
import DiagramaFlujo from './DiagramaFlujo'
import TablaMovimientos from './TablaMovimientos'
import FormIngreso from '../Inventario/Formingreso'
import FormTransformacion from '../Inventario/FormTransformacion'
import FormSalida from '../Inventario/FormSalida'

Modal.setAppElement('#root')

const Movimientos = () => {
  const [activeTab, setActiveTab] = useState('diagrama')
  const [modalTipoMovimiento, setModalTipoMovimiento] = useState(false)
  const [modalEntrada, setModalEntrada] = useState(false)
  const [modalSalida, setModalSalida] = useState(false)
  const [modalTransformacion, setModalTransformacion] = useState(false)

  const renderTabContent = () => {
    switch (activeTab) {
      case 'diagrama':
        return <DiagramaFlujo />
      case 'tabla':
        return <TablaMovimientos />
      default:
        return null
    }
  }

  return (
    <div className='inventario-container'>
      {/* Selector de módulo + botones */}
      <div className='barra-seleccion'>
        <ul className='selector-modulos'>
          <li
            className={activeTab === 'diagrama' ? 'activo' : ''}
            onClick={() => setActiveTab('diagrama')}
          >
            <FaProjectDiagram className='icono-tab' /> Diagrama de Flujo
          </li>
          <li
            className={activeTab === 'tabla' ? 'activo' : ''}
            onClick={() => setActiveTab('tabla')}
          >
            <FaTable className='icono-tab' /> Tabla de Movimientos
          </li>
        </ul>

        <div className='acciones-derecha'>
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

      {/* Modales de cada movimiento */}
      <Modal
        isOpen={modalEntrada}
        onRequestClose={() => setModalEntrada(false)}
        className='modal-content'
        overlayClassName='modal-overlay'
      >
        <FormIngreso onSuccess={() => setModalEntrada(false)} />
      </Modal>

      <Modal
        isOpen={modalSalida}
        onRequestClose={() => setModalSalida(false)}
        className='modal-content salida-modal'
        overlayClassName='modal-overlay'
      >
        <FormSalida onSuccess={() => setModalSalida(false)} />
      </Modal>

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

export default Movimientos
