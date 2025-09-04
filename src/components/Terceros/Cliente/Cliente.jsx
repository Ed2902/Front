import { useEffect, useState, useMemo } from 'react'
import { FaFilePdf, FaFileWord } from 'react-icons/fa'
import {
  getClientes,
  getDocumentosCliente,
  getAuthToken,
} from './Cliente_service'
import './Cliente.css'
import FormCliente from './FormCliente'
import FormEditarCliente from './FormEditarCliente' // ✅ NUEVO

const API_BASE_URL = import.meta.env.VITE_API_URL

const Cliente = () => {
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [globalFilter, setGlobalFilter] = useState('')
  const [documentosPorCliente, setDocumentosPorCliente] = useState({})
  const [pdfEnModal, setPdfEnModal] = useState(null)

  const [modalVisible, setModalVisible] = useState(false)
  const [modalAgregarVisible, setModalAgregarVisible] = useState(false)
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null)

  useEffect(() => {
    fetchClientes()
  }, [])

  const fetchClientes = async () => {
    try {
      setLoading(true)
      const data = await getClientes()
      setClientes(data)
    } catch (error) {
      console.error('Error al obtener clientes:', error.message)
    } finally {
      setLoading(false)
    }
  }

  const filteredClientes = useMemo(() => {
    return clientes.filter(cliente =>
      [cliente.id_Cliente, cliente.Nombre, cliente.Correo].some(field =>
        field?.toLowerCase().includes(globalFilter.toLowerCase())
      )
    )
  }, [clientes, globalFilter])

  const handleToggleDocumentos = async idCliente => {
    if (documentosPorCliente[idCliente]) {
      setDocumentosPorCliente(prev => {
        const copy = { ...prev }
        delete copy[idCliente]
        return copy
      })
    } else {
      try {
        const archivos = await getDocumentosCliente(idCliente)
        setDocumentosPorCliente(prev => ({
          ...prev,
          [idCliente]: archivos,
        }))
      } catch (error) {
        console.error('Error al obtener documentos:', error)
      }
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

  const handleClickDocumento = async (urlParcial, nombre) => {
    // Asegurar que incluya el prefijo correcto
    const rutaFinal = urlParcial.startsWith('/backendfastway')
      ? urlParcial
      : `/backendfastway${urlParcial}`

    const url = `${window.location.origin}${rutaFinal}`
    const ext = nombre.split('.').pop().toLowerCase()

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
      {/* Encabezado con botón Agregar */}
      <div className='d-flex justify-content-between align-items-center mb-3'>
        <h2 className='mb-0'>Clientes Registrados</h2>
        <button
          className='btn-agregarform'
          onClick={() => setModalAgregarVisible(true)}
        >
          Agregar Cliente
        </button>
      </div>

      {/* Filtro */}
      <input
        type='text'
        className='form-control buscador-pequeno mb-3'
        placeholder='Buscar por nombre, correo o ID'
        value={globalFilter}
        onChange={e => setGlobalFilter(e.target.value)}
      />

      {/* Listado de clientes */}
      {loading ? (
        <p>Cargando clientes...</p>
      ) : (
        <div className='accordion' id='clientesAccordion'>
          {filteredClientes.map((cliente, index) => (
            <div className='accordion-item' key={cliente.id_Cliente}>
              <h2 className='accordion-header' id={`heading-${index}`}>
                <button
                  className='accordion-button collapsed'
                  type='button'
                  data-bs-toggle='collapse'
                  data-bs-target={`#collapse-${index}`}
                  aria-expanded='false'
                  aria-controls={`collapse-${index}`}
                  onClick={() => handleToggleDocumentos(cliente.id_Cliente)}
                >
                  {cliente.Nombre}{' '}
                  <span className='ms-2 text-muted'>
                    ({cliente.id_Cliente})
                  </span>
                </button>
              </h2>
              <div
                id={`collapse-${index}`}
                className='accordion-collapse collapse'
                aria-labelledby={`heading-${index}`}
                data-bs-parent='#clientesAccordion'
              >
                <div className='accordion-body'>
                  <p>
                    <strong>Correo:</strong> {cliente.Correo}
                  </p>
                  <p>
                    <strong>Celular:</strong> {cliente.Celular}
                  </p>
                  <p>
                    <strong>Fecha Registro:</strong>{' '}
                    {new Date(cliente.Fecha_registro).toLocaleDateString()}
                  </p>

                  <hr />
                  <div className='d-flex justify-content-between align-items-center mb-2'>
                    <h6 className='mb-0'>📄 Documentos:</h6>
                    <button
                      className='btn-agregarform'
                      onClick={() => {
                        setClienteSeleccionado(cliente)
                        setModalVisible(true)
                      }}
                    >
                      Actualizar
                    </button>
                  </div>

                  {documentosPorCliente[cliente.id_Cliente]?.length > 0 ? (
                    <div className='grid-documentos'>
                      {documentosPorCliente[cliente.id_Cliente].map(
                        (doc, i) => {
                          const urlParcial = doc.url
                          const nombre = doc.nombre
                          const ext = nombre.split('.').pop().toLowerCase()
                          return (
                            <div
                              key={i}
                              className='card-doc'
                              onClick={() =>
                                handleClickDocumento(urlParcial, nombre)
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

      {/* Modal visor PDF */}
      {pdfEnModal && (
        <div className='modal-backdrop' onClick={() => setPdfEnModal(null)}>
          <div className='modal-pdf' onClick={e => e.stopPropagation()}>
            <iframe src={pdfEnModal} title='Documento PDF' />
          </div>
        </div>
      )}

      {/* Modal Editar Cliente */}
      {modalVisible && clienteSeleccionado && (
        <div className='modal-backdrop' onClick={() => setModalVisible(false)}>
          <div className='modal-pdf' onClick={e => e.stopPropagation()}>
            <FormEditarCliente
              cliente={clienteSeleccionado}
              onClose={() => {
                setModalVisible(false)
                setClienteSeleccionado(null)
              }}
              onSuccess={fetchClientes}
            />
          </div>
        </div>
      )}

      {/* Modal Agregar Cliente */}
      {modalAgregarVisible && (
        <div
          className='modal-backdrop'
          onClick={() => setModalAgregarVisible(false)}
        >
          <div className='modal-pdf' onClick={e => e.stopPropagation()}>
            <FormCliente
              onClose={() => setModalAgregarVisible(false)}
              onSuccess={fetchClientes}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default Cliente
