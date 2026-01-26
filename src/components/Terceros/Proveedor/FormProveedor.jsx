import { useForm } from 'react-hook-form'
import { useState } from 'react'
import { crearProveedor } from './Proveedor_service'
import './FormProveedor.css'

const FormProveedor = ({ onClose, onSuccess }) => {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      Activo: true,
      Tipo_proveedor: 'INSUMOS',
      Direccion: '',
      Contacto: '',
    },
  })

  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const documentosObligatorios = [
    { campo: 'rut', label: 'RUT' },
    { campo: 'camara_comercio', label: 'Cámara de Comercio' },
    { campo: 'certificacion_bancaria', label: 'Certificación Bancaria' },
  ]

  const documentosOpcionales = [
    { campo: 'acuerdo_seguridad', label: 'Acuerdo de Seguridad' },
    { campo: 'cedula', label: 'Cédula Representante' },
    { campo: 'circular_170', label: 'Circular 170' },
    { campo: 'certificacion_comercial', label: 'Certificación Comercial' },
    { campo: 'estados_financieros', label: 'Estados Financieros' },
    { campo: 'certificado_contadora', label: 'Certificado Contadora' },
  ]

  const onSubmit = async data => {
    setSubmitting(true)
    setErrorMsg('')

    try {
      const formData = new FormData()

      formData.append('id_proveedor', data.id_proveedor)
      formData.append('Nombre', data.Nombre)
      formData.append('Correo', data.Correo)
      formData.append('Telefono', data.Telefono)

      // ✅ nuevos campos
      formData.append('Tipo_proveedor', data.Tipo_proveedor)
      formData.append('Direccion', data.Direccion || '')
      formData.append('Contacto', data.Contacto || '')

      // ✅ activo
      formData.append('Activo', data.Activo ? 'true' : 'false')

      // docs obligatorios
      documentosObligatorios.forEach(d => {
        const file = data[d.campo]?.[0]
        if (file instanceof File) formData.append(d.campo, file)
      })

      // docs opcionales
      documentosOpcionales.forEach(d => {
        const file = data[d.campo]?.[0]
        if (file instanceof File) formData.append(d.campo, file)
      })

      await crearProveedor(formData)
      onSuccess?.()
      onClose?.()
    } catch (error) {
      console.error('❌ Error al registrar proveedor:', error)
      const msg =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error.message ||
        'Error al registrar proveedor.'
      setErrorMsg(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      className='formulario-cliente'
      onSubmit={handleSubmit(onSubmit)}
      encType='multipart/form-data'
    >
      <h5 className='mb-3'>Registrar Proveedor</h5>

      <div className='grid-datos-cliente'>
        <div>
          <label className='form-label'>ID Proveedor *</label>
          <input
            className='form-control mb-2'
            {...register('id_proveedor', { required: true })}
          />
          {errors.id_proveedor && (
            <p className='text-danger'>Este campo es obligatorio</p>
          )}
        </div>

        <div>
          <label className='form-label'>Nombre *</label>
          <input
            className='form-control mb-2'
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
            className='form-control mb-2'
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
            className='form-control mb-2'
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

        {/* ✅ NUEVO: TIPO */}
        <div>
          <label className='form-label'>Tipo proveedor *</label>
          <select
            className='form-select mb-2'
            {...register('Tipo_proveedor', { required: true })}
          >
            <option value='RS'>RS</option>
            <option value='Logistica internacional'>
              Logistica internacional
            </option>
            <option value='Bodega'>Bodega</option>
          </select>
          {errors.Tipo_proveedor && (
            <p className='text-danger'>Este campo es obligatorio</p>
          )}
        </div>

        {/* ✅ NUEVO: DIRECCIÓN */}
        <div>
          <label className='form-label'>Dirección</label>
          <input className='form-control mb-2' {...register('Direccion')} />
        </div>

        {/* ✅ NUEVO: CONTACTO */}
        <div>
          <label className='form-label'>Contacto</label>
          <input className='form-control mb-2' {...register('Contacto')} />
        </div>

        <div>
          <label className='form-label'>Activo</label>
          <div className='form-check mt-1'>
            <input
              className='form-check-input'
              type='checkbox'
              {...register('Activo')}
            />
            <label className='form-check-label'>Proveedor activo</label>
          </div>
        </div>
      </div>

      <hr />
      <h6>Documentos obligatorios *</h6>
      <div className='grid-documentos-form'>
        {documentosObligatorios.map(d => (
          <div className='input-archivo' key={d.campo}>
            <label>{d.label}</label>
            <input
              type='file'
              accept='.pdf,docx'
              className={watch(d.campo)?.length ? 'input-verde' : ''}
              {...register(d.campo, { required: true })}
            />
            {errors[d.campo] && <p className='text-danger'>Requerido</p>}
          </div>
        ))}
      </div>

      <h6 className='mt-4'>Documentos opcionales</h6>
      <div className='grid-documentos-form'>
        {documentosOpcionales.map(d => (
          <div className='input-archivo' key={d.campo}>
            <label>{d.label}</label>
            <input
              type='file'
              accept='.pdf,.docx'
              className={watch(d.campo)?.length ? 'input-verde' : ''}
              {...register(d.campo)}
            />
          </div>
        ))}
      </div>

      {errorMsg && <p className='text-danger mt-2'>{errorMsg}</p>}

      <div className='botones-acciones'>
        <button type='button' className='btn btn-secondary' onClick={onClose}>
          Cancelar
        </button>
        <button type='submit' className='btn-agregarform' disabled={submitting}>
          {submitting ? 'Enviando...' : 'Guardar Proveedor'}
        </button>
      </div>
    </form>
  )
}

export default FormProveedor
