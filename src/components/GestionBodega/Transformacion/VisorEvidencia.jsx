import { useState } from 'react'
import { FaImage, FaTimes } from 'react-icons/fa'
import { fetchEvidenciaBlob } from './TransformacionService'
import './Transformacion.css'

const VisorEvidencia = ({ filename }) => {
  const [modalVisible, setModalVisible] = useState(false)
  const [imageUrl, setImageUrl] = useState('')

  const abrirModal = async () => {
    try {
      const url = await fetchEvidenciaBlob(filename)
      setImageUrl(url)
      setModalVisible(true)
    } catch (error) {
      console.error('Error al obtener imagen:', error)
    }
  }

  const cerrarModal = () => {
    setModalVisible(false)
    setImageUrl('')
  }

  const manejarClickFondo = e => {
    if (e.target.classList.contains('modal-evidencia')) {
      cerrarModal()
    }
  }

  return (
    <>
      <button className='btn-evidencia' onClick={abrirModal}>
        <FaImage />
      </button>

      {modalVisible && (
        <div className='modal-evidencia' onClick={manejarClickFondo}>
          <div className='modal-contenido'>
            <button className='btn-cerrar' onClick={cerrarModal}>
              <FaTimes />
            </button>
            <img src={imageUrl} alt='Evidencia' className='imagen-modal' />
          </div>
        </div>
      )}
    </>
  )
}

export default VisorEvidencia
