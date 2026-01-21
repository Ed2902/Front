import { useForm } from 'react-hook-form'
import { useEffect, useState } from 'react'
import {
  actualizarClienteActivo,
  actualizarClienteObservaciones,
  actualizarClienteAuto,
  getNombrePersonal,
} from './Cliente_service'
import './FormCliente.css'

const LINEAS_SERVICIO = ['Logistica internacional', 'Bodega', 'RS']

const FormEditarCliente = ({ cliente, onClose, onSuccess }) => {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      Nombre: cliente?.Nombre || '',
      Correo: cliente?.Correo || '',
      Celular: cliente?.Celular || '',
      Direccion: cliente?.Direccion || '',
      Observaciones: cliente?.Observaciones || '',
      Activo: Boolean(cliente?.Activo),
      Id_personal: cliente?.Id_personal ?? cliente?.id_personal ?? '',
      Linea_servicio: cliente?.Linea_servicio ?? cliente?.linea_servicio ?? '',
    },
  })

  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Mostrar nombre del comercial
  const idPersonalWatch = watch('Id_personal')
  const [nombreComercial, setNombreComercial] = useState('')

  useEffect(() => {
    let cancel = false
    const run = async () => {
      const id = String(idPersonalWatch ?? '').trim()
      if (!id) {
        setNombreComercial('')
        return
      }
      try {
        const nombre = await getNombrePersonal(id)
        if (!cancel) setNombreComercial(nombre || '')
      } catch (e) {
        console.error('Error trayendo nombre del personal:', e)
        if (!cancel) setNombreComercial('')
      }
    }
    run()
    return () => {
      cancel = true
    }
  }, [idPersonalWatch])

  // docs (todos opcionales en actualización)
  const documentos = [
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
    {
      campo: 'tratamiento_datos_personales_url',
      backend: 'tratamiento_datos_personales',
      label: 'Tratamiento de datos personales',
    },
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
    {
      campo: 'certificado_contadora_url',
      backend: 'certificado_contadora',
      label: 'Certificado contadora',
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

    documentos.forEach(({ campo }) => {
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

      // payload para backend
      const payload = {
        Nombre: data.Nombre,
        Correo: data.Correo,
        Celular: data.Celular,
      }

      const dir = String(data.Direccion ?? '').trim()
      payload.Direccion = dir === '' ? null : dir

      const linea = String(data.Linea_servicio ?? '').trim()
      payload.Linea_servicio = linea === '' ? null : linea

      const idp = String(data.Id_personal ?? '').trim()
      payload.Id_personal = idp === '' ? null : idp

      // FormData de docs (solo archivos)
      const formDataDocs = new FormData()
      documentos.forEach(({ campo, backend }) => {
        const file = data[campo]?.[0]
        if (file instanceof File) {
          formDataDocs.append(backend, file)
        }
      })

      // 1) actualizar datos (+docs si hay)
      await actualizarClienteAuto(cliente.id_Cliente, payload, formDataDocs)

      // 2) activo
      const activoInicial = Boolean(cliente.Activo)
      const activoNuevo = Boolean(data.Activo)
      if (activoNuevo !== activoInicial) {
        await actualizarClienteActivo(cliente.id_Cliente, activoNuevo)
      }

      // 3) observaciones
      const obsInicial = cliente.Observaciones || ''
      const obsNuevo = data.Observaciones || ''
      if (obsNuevo !== obsInicial) {
        await actualizarClienteObservaciones(
          cliente.id_Cliente,
          obsNuevo ? obsNuevo : null
        )
      }

      // ✅ IMPORTANTE: primero refrescar en el padre y luego cerrar modal
      if (onSuccess) {
        await onSuccess(cliente.id_Cliente)
      }
      onClose?.()
    } catch (error) {
      console.error('❌ Error al editar cliente:', error)
      console.log('DETAIL:', error?.response?.data)

      const msg =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        (Array.isArray(error?.response?.data?.errors)
          ? error.response.data.errors.map(e => e.msg).join(', ')
          : null) ||
        error.message ||
        'Error al editar cliente.'
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
          <label className='form-label'>Comercial a cargo (ID)</label>
          <input className='form-control mb-2' {...register('Id_personal')} />
          {String(idPersonalWatch ?? '').trim() !== '' && (
            <small className='text-muted'>
              {nombreComercial
                ? `Nombre: ${nombreComercial}`
                : 'Buscando nombre...'}
            </small>
          )}
        </div>

        <div>
          <label className='form-label'>Línea de negocio</label>
          <select className='form-select mb-2' {...register('Linea_servicio')}>
            <option value=''>— Seleccionar —</option>
            {LINEAS_SERVICIO.map(l => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
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
      <h6>Actualizar documentos (opcional)</h6>

      <div className='grid-documentos-form'>
        {documentos.map(({ campo, label }) => (
          <div className='input-archivo' key={campo}>
            <label>{label}</label>
            <input type='file' accept='.pdf,.docx' {...register(campo)} />
          </div>
        ))}
      </div>

      {errorMsg && <p className='text-danger mt-2'>{errorMsg}</p>}

      <div className='botones-acciones'>
        <button type='button' className='btn btn-secondary' onClick={onClose}>
          Cancelar
        </button>
        <button type='submit' className='btn-agregarform' disabled={submitting}>
          {submitting ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </div>
    </form>
  )
}

export default FormEditarCliente
