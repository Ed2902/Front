import { useRef, useState } from 'react'
import Modal from 'react-modal'
import './Movimientos.css'
import {
  FaProjectDiagram,
  FaTable,
  FaExchangeAlt,
  FaArrowDown,
  FaArrowUp,
  FaRetweet,
  FaSignOutAlt,
  FaListAlt,
  FaClipboardList,
} from 'react-icons/fa'

// Subcomponentes
import DiagramaFlujo from './DiagramaFlujo'
import TablaMovimientos from './TablaMovimientos'
import TablaAlistamientos from './alistamiento/tabla_alistamientos.jsx'
import TablaSalidas from './salida/tabla_salidas.jsx'
import TablaEntradas from '../Inventario/tabla_entradas.jsx'
import FormIngreso from '../Inventario/Formingreso'
import FormTransformacion from '../Inventario/FormTransformacion'
import FormSalida from '../Inventario/FormSalida'
import FormAlistamiento from './alistamiento/FormAlistamiento.jsx'

Modal.setAppElement('#root')

const Movimientos = () => {
  const [activeTab, setActiveTab] = useState('diagrama')

  const [modalTipoMovimiento, setModalTipoMovimiento] = useState(false)
  const [modalEntrada, setModalEntrada] = useState(false)
  const [modalSalida, setModalSalida] = useState(false)
  const [modalTransformacion, setModalTransformacion] = useState(false)
  const [modalAlistamiento, setModalAlistamiento] = useState(false)

  // ref seguro para cerrar entrada
  const formIngresoRef = useRef(null)

  // crear salida desde alistamiento
  const [alistamientoSeleccionado, setAlistamientoSeleccionado] = useState(null)

  const renderTabContent = () => {
    switch (activeTab) {
      case 'diagrama':
        return <DiagramaFlujo />

      case 'tabla':
        return <TablaMovimientos />

      case 'alistamientos':
        return (
          <TablaAlistamientos
            onVer={() => {}}
            onEditar={() => {}}
            onCrearSalida={alist => {
              setAlistamientoSeleccionado(alist)
              setModalSalida(true)
            }}
          />
        )

      case 'salidas':
        return <TablaSalidas />

      case 'entradas':
        return <TablaEntradas />

      default:
        return null
    }
  }

  return (
    <div className='inventario-container'>
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

          <li
            className={activeTab === 'alistamientos' ? 'activo' : ''}
            onClick={() => setActiveTab('alistamientos')}
          >
            <FaListAlt className='icono-tab' /> Alistamientos
          </li>

          <li
            className={activeTab === 'salidas' ? 'activo' : ''}
            onClick={() => setActiveTab('salidas')}
          >
            <FaSignOutAlt className='icono-tab' /> Ver Salidas
          </li>

          <li
            className={activeTab === 'entradas' ? 'activo' : ''}
            onClick={() => setActiveTab('entradas')}
          >
            <FaArrowDown className='icono-tab' /> Entradas
          </li>
        </ul>

        {/* ===== ACCIONES DERECHA ===== */}
        <div className='acciones-derecha d-flex gap-2'>
          <button
            className='btn-agregar'
            onClick={() => setModalAlistamiento(true)}
          >
            <FaClipboardList style={{ marginRight: '6px' }} />
            Hacer alistamiento
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

      {renderTabContent()}

      {/* ===== MODAL TIPO MOVIMIENTO ===== */}
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
              setAlistamientoSeleccionado(null)
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

      {/* ===== MODAL ALISTAMIENTO ===== */}
      <Modal
        isOpen={modalAlistamiento}
        onRequestClose={() => setModalAlistamiento(false)}
        className='modal-content alistamiento-modal'
        overlayClassName='modal-overlay'
      >
        <FormAlistamiento
          onSuccess={() => {
            setModalAlistamiento(false)
            setActiveTab('alistamientos')
          }}
          onClose={() => setModalAlistamiento(false)}
        />
      </Modal>

      {/* ===== MODAL ENTRADA ===== */}
      <Modal
        isOpen={modalEntrada}
        onRequestClose={() => formIngresoRef.current?.requestClose?.()}
        className='modal-content'
        overlayClassName='modal-overlay'
      >
        <FormIngreso
          ref={formIngresoRef}
          onClose={() => setModalEntrada(false)}
          onSuccess={() => setModalEntrada(false)}
        />
      </Modal>

      {/* ===== MODAL SALIDA ===== */}
      <Modal
        isOpen={modalSalida}
        onRequestClose={() => setModalSalida(false)}
        className='modal-content salida-modal'
        overlayClassName='modal-overlay'
      >
        <FormSalida
          key={alistamientoSeleccionado?.id_alistamiento || 'salida-libre'} // ✅ CAMBIO
          alistamientoInicial={alistamientoSeleccionado}
          onSuccess={() => {
            setModalSalida(false)
            setAlistamientoSeleccionado(null)
            setActiveTab('salidas')
          }}
          onClose={() => {
            setModalSalida(false)
            setAlistamientoSeleccionado(null)
          }}
        />
      </Modal>

      {/* ===== MODAL TRANSFORMACIÓN ===== */}
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
