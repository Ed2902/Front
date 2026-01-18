import { useForm } from 'react-hook-form'
import { useState } from 'react'
import {
  actualizarClienteDatos,
  actualizarClienteActivo,
  actualizarClienteObservaciones,
  actualizarSoloDocumentosCliente,
} from './Cliente_service'
import './FormCliente.css'

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
    },
  })

  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // ✅ LOS 15 DOCUMENTOS (correo + extra)
  const documentosOpcionales = [
    // obligatorios del correo (en editar pasan a opcionales)
    { campo: 'cedula_url', backend: 'cedula' },
    { campo: 'camara_comercio_url', backend: 'camara_comercio' },
    { campo: 'rut_url', backend: 'rut' },
    { campo: 'certificacion_bancaria_url', backend: 'certificacion_bancaria' },
    { campo: 'acuerdo_seguridad_url', backend: 'acuerdo_seguridad' },
    {
      campo: 'tratamiento_datos_personales_url',
      backend: 'tratamiento_datos_personales',
    },

    // opcionales del correo
    { campo: 'visita_seguridad_url', backend: 'visita_seguridad' },
    {
      campo: 'certificacion_comercial_url',
      backend: 'certificacion_comercial',
    },
    { campo: 'estados_financieros_url', backend: 'estados_financieros' },
    { campo: 'lista_clinton_url', backend: 'lista_clinton' },
    { campo: 'certificacion_judicial_url', backend: 'certificacion_judicial' },
    {
      campo: 'certificacion_contraloria_url',
      backend: 'certificacion_contraloria',
    },
    {
      campo: 'certificacion_procuraduria_url',
      backend: 'certificacion_procuraduria',
    },
    { campo: 'circular_170_url', backend: 'circular_170' },

    // extra (se mantiene)
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

      // 1️⃣ Actualizar datos básicos
      await actualizarClienteDatos(cliente.id_Cliente, {
        Nombre: data.Nombre,
        Correo: data.Correo,
        Celular: data.Celular,
        Direccion: data.Direccion || null,
      })

      // 2️⃣ Cambiar activo si aplica
      const activoInicial = Boolean(cliente.Activo)
      const activoNuevo = Boolean(data.Activo)
      if (activoNuevo !== activoInicial) {
        await actualizarClienteActivo(cliente.id_Cliente, activoNuevo)
      }

      // 3️⃣ Actualizar observaciones si aplica
      const obsInicial = cliente.Observaciones || ''
      const obsNuevo = data.Observaciones || ''
      if (obsNuevo !== obsInicial) {
        await actualizarClienteObservaciones(
          cliente.id_Cliente,
          obsNuevo || null
        )
      }

      // 4️⃣ Subir SOLO documentos adjuntados
      const formDataDocs = new FormData()
      let hayDocs = false

      documentosOpcionales.forEach(({ campo, backend }) => {
        const file = data[campo]?.[0]
        if (file instanceof File) {
          formDataDocs.append(backend, file)
          hayDocs = true
        }
      })

      if (hayDocs) {
        await actualizarSoloDocumentosCliente(cliente.id_Cliente, formDataDocs)
      }

      onSuccess?.()
      onClose?.()
    } catch (error) {
      console.error('❌ Error al editar cliente:', error)
      const msg =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
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
