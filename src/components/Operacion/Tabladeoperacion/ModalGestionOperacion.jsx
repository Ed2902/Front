import React from 'react'
import Modal from 'react-modal'
import TablaResumenOperacion from './TablaResumenOperacion'
import { getIdTipo, TIPOS_SECUNDARIOS } from './inventario'

import FormIngreso from '../../GestionBodega/Inventario/Formingreso'
import FormSalida from '../../GestionBodega/Inventario/FormSalida'
import FormTransformacion from '../../GestionBodega/Inventario/FormTransformacion'

const renderFormForTipo = (op, onDone) => {
  if (!op) return null
  const tipo = getIdTipo(op)
  const handleSuccess = () => onDone?.()

  if (tipo === 'ENTRADA') {
    return (
      <div className='card'>
        <div className='card-header py-2'>
          <strong>Formulario de Entrada</strong>
        </div>
        <div className='card-body'>
          <FormIngreso onSuccess={handleSuccess} />
        </div>
      </div>
    )
  }
  if (tipo === 'SALIDA') {
    return (
      <div className='card'>
        <div className='card-header py-2'>
          <strong>Formulario de Salida</strong>
        </div>
        <div className='card-body'>
          <FormSalida onSuccess={handleSuccess} />
        </div>
      </div>
    )
  }
  if (TIPOS_SECUNDARIOS.has(tipo)) {
    return (
      <div className='card'>
        <div className='card-header py-2'>
          <strong>Formulario de Gestión</strong>
        </div>
        <div className='card-body'>
          <FormTransformacion onSuccess={handleSuccess} />
        </div>
      </div>
    )
  }

  return (
    <div className='alert alert-secondary'>
      Este modal no tiene formulario para el tipo{' '}
      <strong>
        {op.id_tipo_operacion}
        {op.tipo_operacion ? ` (${op.tipo_operacion})` : ''}
      </strong>
      .
    </div>
  )
}

const ModalGestionOperacion = ({
  isOpen,
  onRequestClose,
  operacion,
  onActionSuccess,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onRequestClose}
      contentLabel='Gestionar operación'
      className='custom-modal-xl'
      overlayClassName='custom-modal-overlay'
    >
      <h2 className='mb-3'>Gestionar Operación</h2>

      {operacion && (
        <div className='row g-3'>
          <div className='col-12 col-xl-7'>
            {renderFormForTipo(operacion, onActionSuccess)}
          </div>
          <div className='col-12 col-xl-5'>
            <TablaResumenOperacion op={operacion} />
          </div>
        </div>
      )}

      <div className='d-flex justify-content-end mt-3'>
        <button className='btn btn-secondary' onClick={onRequestClose}>
          Cerrar
        </button>
      </div>
    </Modal>
  )
}

export default ModalGestionOperacion
