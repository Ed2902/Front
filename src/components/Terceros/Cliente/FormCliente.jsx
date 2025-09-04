import { useForm } from 'react-hook-form'
import { useState } from 'react'
import { crearCliente } from './Cliente_service'
import './FormCliente.css'

const FormCliente = ({ onClose, onSuccess }) => {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm()

  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Mapeo frontend => backend
  const documentosObligatorios = [
    { campo: 'rut_url', backend: 'rut' },
    { campo: 'camara_comercio_url', backend: 'camara_comercio' },
    { campo: 'cedula_url', backend: 'cedula' },
    { campo: 'certificacion_bancaria_url', backend: 'certificacion_bancaria' },
    { campo: 'acuerdo_seguridad_url', backend: 'acuerdo_seguridad' },
  ]

  const documentosOpcionales = [
    { campo: 'circular_170_url', backend: 'circular_170' },
    {
      campo: 'certificacion_comercial_url',
      backend: 'certificacion_comercial',
    },
    { campo: 'estados_financieros_url', backend: 'estados_financieros' },
    { campo: 'certificado_contadora_url', backend: 'certificado_contadora' },
  ]

  const MAX_FILE_SIZE_MB = 10

  const validarTamanos = data => {
    const errores = []

    const revisar = (archivo, nombreCampo) => {
      if (archivo?.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        errores.push(`"${nombreCampo}" supera ${MAX_FILE_SIZE_MB} MB`)
      }
    }

    documentosObligatorios.forEach(({ campo }) =>
      revisar(data[campo]?.[0], campo)
    )
    documentosOpcionales.forEach(({ campo }) => {
      if (data[campo]?.[0]) revisar(data[campo][0], campo)
    })

    return errores
  }

  const onSubmit = async data => {
    setSubmitting(true)
    setErrorMsg('')

    try {
      console.log('🟢 Datos del formulario:', data)

      const erroresArchivo = validarTamanos(data)
      if (erroresArchivo.length > 0) {
        setErrorMsg(erroresArchivo.join(', '))
        setSubmitting(false)
        return
      }

      const formData = new FormData()
      formData.append('id_Cliente', data.id_Cliente)
      formData.append('Nombre', data.Nombre)
      formData.append('Correo', data.Correo)
      formData.append('Celular', data.Celular)
      formData.append('Fecha_registro', new Date().toISOString()) // debe coincidir con tu backend

      documentosObligatorios.forEach(({ campo, backend }) => {
        const file = data[campo]?.[0]
        if (file instanceof File) {
          formData.append(backend, file)
        }
      })

      documentosOpcionales.forEach(({ campo, backend }) => {
        const file = data[campo]?.[0]
        if (file instanceof File) {
          formData.append(backend, file)
        }
      })

      console.log('📦 FormData preview:')
      for (const [k, v] of formData.entries()) {
        console.log(`${k}:`, v)
      }

      await crearCliente(formData)

      if (onSuccess) onSuccess()
      onClose()
    } catch (error) {
      console.error('❌ Error al registrar cliente:', error)
      const msg =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error.message ||
        'Error al registrar cliente.'
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
      <h5 className='mb-3'>Registrar Cliente</h5>

      <div className='grid-datos-cliente'>
        <div>
          <label className='form-label'>ID Cliente *</label>
          <input
            className='form-control mb-2'
            {...register('id_Cliente', { required: true })}
          />
          {errors.id_Cliente && (
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
            {...register('Correo', { required: true })}
          />
          {errors.Correo && (
            <p className='text-danger'>Este campo es obligatorio</p>
          )}
        </div>

        <div>
          <label className='form-label'>Celular *</label>
          <input
            className='form-control mb-3'
            {...register('Celular', { required: true })}
          />
          {errors.Celular && (
            <p className='text-danger'>Este campo es obligatorio</p>
          )}
        </div>
      </div>

      <hr />
      <h6>Documentos obligatorios *</h6>
      <div className='grid-documentos-form'>
        {documentosObligatorios.map(({ campo }) => (
          <div className='input-archivo' key={campo}>
            <label>{campo.replace('_url', '').replace(/_/g, ' ')}</label>
            <input
              type='file'
              accept='.pdf,.docx'
              className={watch(campo)?.length ? 'input-verde' : ''}
              {...register(campo, { required: true })}
            />
            {errors[campo] && <p className='text-danger'>Requerido</p>}
          </div>
        ))}
      </div>

      <h6 className='mt-4'>Documentos opcionales</h6>
      <div className='grid-documentos-form'>
        {documentosOpcionales.map(({ campo }) => (
          <div className='input-archivo' key={campo}>
            <label>{campo.replace('_url', '').replace(/_/g, ' ')}</label>
            <input
              type='file'
              accept='.pdf,.docx'
              className={watch(campo)?.length ? 'input-verde' : ''}
              {...register(campo)}
            />
          </div>
        ))}
      </div>

      {errorMsg && <p className='text-danger'>{errorMsg}</p>}

      <div className='botones-acciones'>
        <button type='button' className='btn btn-secondary' onClick={onClose}>
          Cancelar
        </button>
        <button type='submit' className='btn-agregarform' disabled={submitting}>
          {submitting ? 'Enviando...' : 'Guardar Cliente'}
        </button>
      </div>
    </form>
  )
}

export default FormCliente
