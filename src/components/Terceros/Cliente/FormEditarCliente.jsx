import { useForm } from 'react-hook-form'
import { useEffect, useState } from 'react'
import { actualizarCliente } from './Cliente_service'
import './FormCliente.css'

const FormEditarCliente = ({ cliente, onClose, onSuccess }) => {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    setValue,
  } = useForm()

  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (cliente) {
      setValue('id_Cliente', cliente.id_Cliente)
      setValue('Nombre', cliente.Nombre)
      setValue('Correo', cliente.Correo)
      setValue('Celular', cliente.Celular)
    }
  }, [cliente, setValue])

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
      const erroresArchivo = validarTamanos(data)
      if (erroresArchivo.length > 0) {
        setErrorMsg(erroresArchivo.join(', '))
        setSubmitting(false)
        return
      }

      const formData = new FormData()
      formData.append('id_Cliente', cliente.id_Cliente)
      formData.append('Correo', data.Correo)
      formData.append('Celular', data.Celular)

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

      await actualizarCliente(cliente.id_Cliente, formData)

      if (onSuccess) onSuccess()
      onClose()
    } catch (error) {
      const msg =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error.message ||
        'Error al actualizar cliente.'
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
      <h5 className='mb-3'>Editar Cliente</h5>

      <div className='grid-datos-cliente'>
        <div>
          <label className='form-label'>ID Cliente *</label>
          <input
            className='form-control mb-2'
            {...register('id_Cliente')}
            disabled
          />
        </div>

        <div>
          <label className='form-label'>Nombre *</label>
          <input
            className='form-control mb-2'
            {...register('Nombre')}
            disabled
          />
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
      <h6>Actualizar Documentos</h6>
      <div className='grid-documentos-form'>
        {[...documentosObligatorios, ...documentosOpcionales].map(
          ({ campo }) => (
            <div className='input-archivo' key={campo}>
              <label>{campo.replace('_url', '').replace(/_/g, ' ')}</label>
              <input
                type='file'
                accept='.pdf,.docx'
                className={watch(campo)?.length ? 'input-verde' : ''}
                {...register(campo)}
              />
            </div>
          )
        )}
      </div>

      {errorMsg && <p className='text-danger'>{errorMsg}</p>}

      <div className='botones-acciones'>
        <button type='button' className='btn btn-secondary' onClick={onClose}>
          Cancelar
        </button>
        <button type='submit' className='btn-agregarform' disabled={submitting}>
          {submitting ? 'Guardando...' : 'Actualizar Cliente'}
        </button>
      </div>
    </form>
  )
}

export default FormEditarCliente
