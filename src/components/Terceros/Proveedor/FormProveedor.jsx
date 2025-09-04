import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { crearProveedor } from './Proveedor_service'
import './Proveedor.css'

const FormProveedor = ({ onClose }) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
    watch,
  } = useForm()
  const [mensaje, setMensaje] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async data => {
    try {
      setSubmitting(true)
      const formData = new FormData()

      formData.append('id_proveedor', data.id_proveedor)
      formData.append('Nombre', data.Nombre)
      formData.append('Correo', data.Correo)
      formData.append('Telefono', data.Telefono)

      const archivos = {
        rut: data.rut?.[0],
        camara_comercio: data.camara_comercio?.[0],
        certificacion_bancaria: data.certificacion_bancaria?.[0],
        acuerdo_seguridad: data.acuerdo_seguridad?.[0],
        cedula: data.cedula?.[0],
        circular_170: data.circular_170?.[0],
        certificacion_comercial: data.certificacion_comercial?.[0],
        estados_financieros: data.estados_financieros?.[0],
        certificado_contadora: data.certificado_contadora?.[0],
      }

      Object.entries(archivos).forEach(([key, file]) => {
        if (file instanceof File) formData.append(key, file)
      })

      await crearProveedor(formData)
      reset()
      onClose && onClose() // Cierra el modal
      window.location.reload() // Recarga para mostrar la tabla actualizada
    } catch (error) {
      console.error('❌ Error al registrar proveedor:', error)
      if (error.response?.data?.errors) {
        setMensaje(`❌ ${error.response.data.errors[0].msg}`)
      } else {
        setMensaje('❌ Error al registrar proveedor.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const renderInputFile = (nombre, label, requerido = false) => (
    <div className='input-archivo'>
      <label className='form-label'>{label}</label>
      <input
        type='file'
        accept='.pdf,.docx'
        className={watch(nombre)?.length ? 'input-verde' : ''}
        {...register(nombre, { required: requerido })}
      />
      {errors[nombre] && requerido && <p className='text-danger'>Requerido</p>}
    </div>
  )

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      encType='multipart/form-data'
      className='formulario-cliente'
    >
      <h5 className='mb-3'>Registrar Proveedor</h5>

      <div className='grid-datos-cliente'>
        <div>
          <label className='form-label'>ID Proveedor *</label>
          <input
            className='form-control'
            {...register('id_proveedor', { required: true })}
          />
          {errors.id_proveedor && (
            <p className='text-danger'>Este campo es obligatorio</p>
          )}
        </div>

        <div>
          <label className='form-label'>Nombre *</label>
          <input
            className='form-control'
            {...register('Nombre', { required: true })}
          />
          {errors.Nombre && (
            <p className='text-danger'>Este campo es obligatorio</p>
          )}
        </div>

        <div>
          <label className='form-label'>Correo *</label>
          <input
            type='email'
            className='form-control'
            {...register('Correo', {
              required: true,
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: 'Correo inválido',
              },
            })}
          />
          {errors.Correo && (
            <p className='text-danger'>
              {errors.Correo.message || 'Campo obligatorio'}
            </p>
          )}
        </div>

        <div>
          <label className='form-label'>Teléfono *</label>
          <input
            className='form-control'
            {...register('Telefono', {
              required: true,
              pattern: {
                value: /^[0-9]{7,15}$/,
                message: 'Teléfono inválido',
              },
            })}
          />
          {errors.Telefono && (
            <p className='text-danger'>
              {errors.Telefono.message || 'Campo obligatorio'}
            </p>
          )}
        </div>
      </div>

      <hr />
      <h6>Documentos obligatorios *</h6>
      <div className='grid-documentos-form'>
        {renderInputFile('rut', 'RUT', true)}
        {renderInputFile('camara_comercio', 'Cámara de Comercio', true)}
        {renderInputFile(
          'certificacion_bancaria',
          'Certificación Bancaria',
          true
        )}
      </div>

      <h6 className='mt-4'>Documentos opcionales</h6>
      <div className='grid-documentos-form'>
        {renderInputFile('acuerdo_seguridad', 'Acuerdo de Seguridad')}
        {renderInputFile('cedula', 'Cédula Representante')}
        {renderInputFile('circular_170', 'Circular 170')}
        {renderInputFile('certificacion_comercial', 'Certificación Comercial')}
        {renderInputFile('estados_financieros', 'Estados Financieros')}
        {renderInputFile('certificado_contadora', 'Certificado Contadora')}
      </div>

      {mensaje && <p className='text-danger text-center mt-3'>{mensaje}</p>}

      <div className='botones-acciones'>
        <button type='submit' className='btn-agregarform' disabled={submitting}>
          {submitting ? 'Enviando...' : 'Registrar'}
        </button>
      </div>
    </form>
  )
}

export default FormProveedor
