import { useForm } from 'react-hook-form'
import { useState } from 'react'
import {
  actualizarProveedorDatos,
  actualizarProveedorActivo,
  actualizarSoloDocumentosProveedor,
} from './Proveedor_service'
import './FormProveedor.css'

const FormEditarProveedor = ({ proveedor, onClose, onSuccess }) => {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      Nombre: proveedor?.Nombre || '',
      Correo: proveedor?.Correo || '',
      Telefono: proveedor?.Telefono || '',
      Tipo_proveedor: proveedor?.Tipo_proveedor || 'INSUMOS',
      Direccion: proveedor?.Direccion || '',
      Contacto: proveedor?.Contacto || '',
      Activo: Boolean(proveedor?.Activo),
    },
  })

  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const documentosOpcionales = [
    { campo: 'rut', label: 'RUT' },
    { campo: 'camara_comercio', label: 'Cámara de Comercio' },
    { campo: 'certificacion_bancaria', label: 'Certificación Bancaria' },
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
      // 1) PUT datos
      await actualizarProveedorDatos(proveedor.id_proveedor, {
        Nombre: data.Nombre,
        Correo: data.Correo,
        Telefono: data.Telefono,

        // ✅ nuevos campos
        Tipo_proveedor: data.Tipo_proveedor,
        Direccion: data.Direccion || '',
        Contacto: data.Contacto || '',
      })

      // 2) PATCH activo (solo si cambió)
      const activoInicial = Boolean(proveedor.Activo)
      const activoNuevo = Boolean(data.Activo)
      if (activoNuevo !== activoInicial) {
        await actualizarProveedorActivo(proveedor.id_proveedor, activoNuevo)
      }

      // 3) Docs (solo si adjunta alguno)
      const formDataDocs = new FormData()
      let hayDocs = false

      documentosOpcionales.forEach(d => {
        const file = data[d.campo]?.[0]
        if (file instanceof File) {
          formDataDocs.append(d.campo, file)
          hayDocs = true
        }
      })

      if (hayDocs) {
        await actualizarSoloDocumentosProveedor(
          proveedor.id_proveedor,
          formDataDocs
        )
      }

      onSuccess?.()
      onClose?.()
    } catch (error) {
      console.error('❌ Error al editar proveedor:', error)
      const msg =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error.message ||
        'Error al editar proveedor.'
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
      <h5 className='mb-3'>Editar Proveedor</h5>

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
          <label className='form-label'>Teléfono *</label>
          <input
            className='form-control mb-2'
            {...register('Telefono', { required: true })}
          />
          {errors.Telefono && (
            <p className='text-danger'>Este campo es obligatorio</p>
          )}
        </div>

        {/* ✅ NUEVO: TIPO */}
        <div>
          <label className='form-label'>Tipo proveedor *</label>
          <select
            className='form-select mb-2'
            {...register('Tipo_proveedor', { required: true })}
          >
            <option value='INSUMOS'>INSUMOS</option>
            <option value='RS'>RS</option>
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
      <h6>Actualizar documentos (opcional)</h6>
      <div className='grid-documentos-form'>
        {documentosOpcionales.map(d => (
          <div className='input-archivo' key={d.campo}>
            <label>{d.label}</label>
            <input
              type='file'
              accept='.pdf,docx'
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
          {submitting ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </div>
    </form>
  )
}

export default FormEditarProveedor
