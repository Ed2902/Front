import { useEffect, useState, useMemo } from 'react'
import { FaFilePdf, FaFileWord } from 'react-icons/fa'
import {
  getProveedores,
  getDocumentosProveedor,
  getAuthToken,
} from './Proveedor_service'
import './Proveedor.css'
import FormProveedor from './FormProveedor'

const API_BASE_URL = import.meta.env.VITE_API_URL

const Proveedor = () => {
  const [proveedores, setProveedores] = useState([])
  const [loading, setLoading] = useState(true)
  const [globalFilter, setGlobalFilter] = useState('')
  const [documentosPorProveedor, setDocumentosPorProveedor] = useState({})
  const [pdfEnModal, setPdfEnModal] = useState(null)

  const [modalVisible, setModalVisible] = useState(false)
  const [modalAgregarVisible, setModalAgregarVisible] = useState(false)
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState(null)

  useEffect(() => {
    fetchProveedores()
  }, [])

  const fetchProveedores = async () => {
    try {
      setLoading(true)
      const data = await getProveedores()
      setProveedores(data)
    } catch (error) {
      console.error('Error al obtener proveedores:', error.message)
    } finally {
      setLoading(false)
    }
  }

  const filteredProveedores = useMemo(() => {
    return proveedores.filter(proveedor =>
      [proveedor.id_proveedor, proveedor.Nombre, proveedor.Correo].some(field =>
        field?.toLowerCase().includes(globalFilter.toLowerCase())
      )
    )
  }, [proveedores, globalFilter])

  const handleToggleDocumentos = async idProveedor => {
    try {
      const archivos = await getDocumentosProveedor(idProveedor)
      setDocumentosPorProveedor(prev => ({
        ...prev,
        [idProveedor]: archivos,
      }))
    } catch (error) {
      console.error('Error al obtener documentos:', error)
    }
  }

  const formatearNombre = nombre => {
    const partes = nombre.split('-')
    if (partes.length > 1) {
      const tipo = partes[0].replace(/_/g, ' ')
      const resto = partes
        .slice(1)
        .join('-')
        .replace(/\.(pdf|docx)$/i, '')
      return `${tipo.toUpperCase()} (${resto})`
    }
    return nombre
  }

  const handleClickDocumento = async (urlParcial, nombre, idProveedor) => {
    const ext = nombre.split('.').pop().toLowerCase()
    const carpetaProveedor = `proveedor-${idProveedor}`

    const rutaFinal = urlParcial?.startsWith('/backendfastway/uploads')
      ? urlParcial
      : `/backendfastway/uploads/proveedores/${carpetaProveedor}/${nombre}`

    const url = `${API_BASE_URL.replace('/api', '')}${rutaFinal}`

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
        },
      })

      if (!response.ok) throw new Error('Error al obtener el archivo')

      const blob = await response.blob()

      if (ext === 'pdf') {
        const pdfBlob = new Blob([blob], { type: 'application/pdf' })
        const blobUrl = URL.createObjectURL(pdfBlob)
        setPdfEnModal(blobUrl)
      } else {
        const blobUrl = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = blobUrl
        link.download = nombre
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }
    } catch (err) {
      console.error('Error al acceder al documento:', err)
    }
  }

  return (
    <div className='container mt-4'>
      <div className='d-flex justify-content-between align-items-center mb-3'>
        <h2 className='mb-0'>Proveedores Registrados</h2>
        <button
          className='btn-agregarform'
          onClick={() => setModalAgregarVisible(true)}
        >
          Agregar Proveedor
        </button>
      </div>

      <input
        type='text'
        className='form-control buscador-pequeno mb-3'
        placeholder='Buscar por nombre, correo o ID'
        value={globalFilter}
        onChange={e => setGlobalFilter(e.target.value)}
      />

      {loading ? (
        <p>Cargando proveedores...</p>
      ) : (
        <div className='accordion' id='proveedoresAccordion'>
          {filteredProveedores.map((proveedor, index) => (
            <div className='accordion-item' key={proveedor.id_proveedor}>
              <h2 className='accordion-header' id={`heading-${index}`}>
                <button
                  className='accordion-button collapsed'
                  type='button'
                  data-bs-toggle='collapse'
                  data-bs-target={`#collapse-${index}`}
                  aria-expanded='false'
                  aria-controls={`collapse-${index}`}
                  onClick={() => handleToggleDocumentos(proveedor.id_proveedor)}
                >
                  {proveedor.Nombre}{' '}
                  <span className='ms-2 text-muted'>
                    ({proveedor.id_proveedor})
                  </span>
                </button>
              </h2>
              <div
                id={`collapse-${index}`}
                className='accordion-collapse collapse'
                aria-labelledby={`heading-${index}`}
                data-bs-parent='#proveedoresAccordion'
              >
                <div className='accordion-body'>
                  <p>
                    <strong>Correo:</strong> {proveedor.Correo}
                  </p>
                  <p>
                    <strong>Teléfono:</strong> {proveedor.Telefono}
                  </p>
                  <p>
                    <strong>Fecha Registro:</strong>{' '}
                    {new Date(proveedor.Fecha_registro).toLocaleDateString()}
                  </p>

                  <hr />
                  <div className='d-flex justify-content-between align-items-center mb-2'>
                    <h6 className='mb-0'>📄 Documentos:</h6>
                    <button
                      className='btn-agregarform'
                      onClick={() => {
                        setProveedorSeleccionado(proveedor)
                        setModalVisible(true)
                      }}
                    >
                      Actualizar
                    </button>
                  </div>

                  {documentosPorProveedor[proveedor.id_proveedor]?.length >
                  0 ? (
                    <div className='grid-documentos'>
                      {documentosPorProveedor[proveedor.id_proveedor].map(
                        (doc, i) => {
                          const urlParcial = doc.url
                          const nombre = doc.nombre
                          const ext = nombre.split('.').pop().toLowerCase()
                          return (
                            <div
                              key={i}
                              className='card-doc'
                              onClick={() =>
                                handleClickDocumento(
                                  urlParcial,
                                  nombre,
                                  proveedor.id_proveedor
                                )
                              }
                            >
                              <div className='icono-doc'>
                                {ext === 'pdf' ? <FaFilePdf /> : <FaFileWord />}
                              </div>
                              <div className='nombre-doc'>
                                {formatearNombre(nombre)}
                              </div>
                            </div>
                          )
                        }
                      )}
                    </div>
                  ) : (
                    <p className='text-muted'>No hay documentos disponibles.</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {pdfEnModal && (
        <div className='modal-backdrop' onClick={() => setPdfEnModal(null)}>
          <div className='modal-pdf' onClick={e => e.stopPropagation()}>
            <iframe src={pdfEnModal} title='Documento PDF' />
          </div>
        </div>
      )}

      {modalVisible && proveedorSeleccionado && (
        <div className='modal-backdrop' onClick={() => setModalVisible(false)}>
          <div className='modal-pdf' onClick={e => e.stopPropagation()}>
            <h5 className='mb-2'>Hola, proveedor seleccionado:</h5>
            <p>
              <strong>ID:</strong> {proveedorSeleccionado.id_proveedor}
            </p>
            <button
              className='btn-agregarform mt-3'
              onClick={() => setModalVisible(false)}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {modalAgregarVisible && (
        <div
          className='modal-backdrop'
          onClick={() => setModalAgregarVisible(false)}
        >
          <div className='modal-pdf' onClick={e => e.stopPropagation()}>
            <FormProveedor
              onClose={() => setModalAgregarVisible(false)}
              onSuccess={() => {
                setModalAgregarVisible(false)
                fetchProveedores()
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default Proveedor
