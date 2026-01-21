import { useForm } from 'react-hook-form'
import { useState } from 'react'
import { crearCliente, getAuthToken } from './Cliente_service'
import './FormCliente.css'

const LINEAS_SERVICIO = ['Logistica internacional', 'Bodega', 'RS']

const getIdPersonalFromToken = () => {
  try {
    const token = getAuthToken()
    if (!token) return null
    const payloadBase64 = token.split('.')[1]
    const payloadJson = atob(
      payloadBase64.replace(/-/g, '+').replace(/_/g, '/')
    )
    const payload = JSON.parse(payloadJson)

    // En tu login llega como id_personal (y también viene user.personal.id_personal)
    return payload?.id_personal || payload?.user?.personal?.id_personal || null
  } catch {
    return null
  }
}

const FormCliente = ({ onClose, onSuccess }) => {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      Activo: true,
      Linea_servicio: 'Bodega',
    },
  })

  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // ✅ Mapeo frontend => backend (NO se cambian los existentes)
  const documentosObligatorios = [
    { campo: 'rut_url', backend: 'rut', label: 'RUT' },
    {
      campo: 'camara_comercio_url',
      backend: 'camara_comercio',
      label: 'Cámara de comercio',
    },
    { campo: 'cedula_url', backend: 'cedula', label: 'Fotocopia de la cédula' },
    {
      campo: 'certificacion_bancaria_url',
      backend: 'certificacion_bancaria',
      label: 'Certificación bancaria',
    },
    {
      campo: 'acuerdo_seguridad_url',
      backend: 'acuerdo_seguridad',
      label: 'Acuerdo de seguridad',
    },

    // ✅ NUEVO (obligatorio según el correo)
    // Nota: la clave backend es NUEVA; las anteriores NO se modifican.
    {
      campo: 'tratamiento_datos_personales_url',
      backend: 'tratamiento_datos_personales',
      label: 'Tratamiento de datos personales',
    },
  ]

  const documentosOpcionales = [
    // (existentes)
    {
      campo: 'circular_170_url',
      backend: 'circular_170',
      label: 'Circular 170',
    },
    {
      campo: 'certificacion_comercial_url',
      backend: 'certificacion_comercial',
      label: 'Certificación comercial',
    },
    {
      campo: 'estados_financieros_url',
      backend: 'estados_financieros',
      label: 'Estados financieros',
    },

    // ✅ NUEVOS (opcionales según el correo)
    {
      campo: 'visita_seguridad_url',
      backend: 'visita_seguridad',
      label: 'Visita de seguridad',
    },
    {
      campo: 'lista_clinton_url',
      backend: 'lista_clinton',
      label: 'Lista Clinton',
    },
    {
      campo: 'certificacion_judicial_url',
      backend: 'certificacion_judicial',
      label: 'Certificación judicial',
    },
    {
      campo: 'certificacion_contraloria_url',
      backend: 'certificacion_contraloria',
      label: 'Certificación Contraloría',
    },
    {
      campo: 'certificacion_procuraduria_url',
      backend: 'certificacion_procuraduria',
      label: 'Certificación Procuraduría',
    },

    // ✅ EXTRA (se mantiene aunque no esté en el correo)
    {
      campo: 'certificado_contadora_url',
      backend: 'certificado_contadora',
      label: 'Certificado contadora (extra)',
    },
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
      formData.append('id_Cliente', data.id_Cliente)
      formData.append('Nombre', data.Nombre)
      formData.append('Correo', data.Correo)
      formData.append('Celular', data.Celular)
      formData.append('Fecha_registro', new Date().toISOString())

      formData.append('Activo', data.Activo ? 'true' : 'false')
      if (data.Direccion) formData.append('Direccion', data.Direccion)
      if (data.Observaciones)
        formData.append('Observaciones', data.Observaciones)

      // ✅ Envía obligatorios
      documentosObligatorios.forEach(({ campo, backend }) => {
        const file = data[campo]?.[0]
        if (file instanceof File) formData.append(backend, file)
      })

      // ✅ Envía opcionales
      documentosOpcionales.forEach(({ campo, backend }) => {
        const file = data[campo]?.[0]
        if (file instanceof File) formData.append(backend, file)
      })

      await crearCliente(formData)

      onSuccess?.()
      onClose?.()
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

  const labelDeCampo = item =>
    item?.label || item?.campo?.replace('_url', '').replace(/_/g, ' ')

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
            className='form-control mb-2'
            {...register('Celular', { required: true })}
          />
          {errors.Celular && (
            <p className='text-danger'>Este campo es obligatorio</p>
          )}
        </div>

        <div>
          <label className='form-label'>Dirección</label>
          <input className='form-control mb-2' {...register('Direccion')} />
        </div>

        <div>
          <label className='form-label'>Línea de servicio *</label>
          <select
            className='form-control mb-2'
            {...register('Linea_servicio', { required: true })}
          >
            {LINEAS_SERVICIO.map(op => (
              <option key={op} value={op}>
                {op}
              </option>
            ))}
          </select>
          {errors.Linea_servicio && (
            <p className='text-danger'>Este campo es obligatorio</p>
          )}
        </div>

        <div>
          <label className='form-label'>Activo</label>
          <div className='form-check mt-1'>
            <input
              className='form-check-input'
              type='checkbox'
              {...register('Activo')}
            />
            <label className='form-check-label'>Cliente activo</label>
          </div>
        </div>
      </div>

      <div className='mb-3'>
        <label className='form-label'>Observaciones</label>
        <textarea
          className='form-control'
          rows={3}
          {...register('Observaciones')}
        />
      </div>

      <hr />
      <h6>Documentos obligatorios *</h6>
      <div className='grid-documentos-form'>
        {documentosObligatorios.map(({ campo }) => (
          <div className='input-archivo' key={campo}>
            <label>
              {labelDeCampo(
                documentosObligatorios.find(d => d.campo === campo)
              )}
            </label>
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
            <label>
              {labelDeCampo(documentosOpcionales.find(d => d.campo === campo))}
            </label>
            <input
              type='file'
              accept='.pdf,.docx'
              className={watch(campo)?.length ? 'input-verde' : ''}
              {...register(campo)}
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
          {submitting ? 'Enviando...' : 'Guardar Cliente'}
        </button>
      </div>
    </form>
  )
}

export default FormCliente
