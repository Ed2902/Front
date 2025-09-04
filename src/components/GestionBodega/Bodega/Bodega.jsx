import { useEffect, useState } from 'react'
import Modal from 'react-modal'
import {
  getBodegas,
  getUbicaciones,
  getOcupacionDetalle,
} from './BodegaService'
import BodegaTabla from './BodegaTabla'
import OcupacionBodega from './OcupacionBodega'
import FormBodega from './FormBodega'
import FormUbicacion from './FormUbicacion'
import './Bodegas.css'

// Obligatorio para que react-modal funcione bien
Modal.setAppElement('#root')

const Bodega = () => {
  const [bodegas, setBodegas] = useState([])
  const [ubicaciones, setUbicaciones] = useState([])
  const [inventario, setInventario] = useState([])

  const [isModalBodegaOpen, setIsModalBodegaOpen] = useState(false)
  const [isModalUbicacionOpen, setIsModalUbicacionOpen] = useState(false)

  const fetchData = async () => {
    try {
      const [bodegasData, ubicacionesData, inventarioData] = await Promise.all([
        getBodegas(),
        getUbicaciones(),
        getOcupacionDetalle(),
      ])
      setBodegas(bodegasData)
      setUbicaciones(ubicacionesData)
      setInventario(inventarioData)
    } catch (error) {
      console.error('Error cargando datos:', error)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  return (
    <div className='bodega-contenedor'>
      {/* === Modales === */}
      <Modal
        isOpen={isModalBodegaOpen}
        onRequestClose={() => setIsModalBodegaOpen(false)}
        className='modal-content'
        overlayClassName='modal-overlay'
      >
        <h2>Agregar Bodega</h2>
        <FormBodega
          onSuccess={() => {
            setIsModalBodegaOpen(false)
            fetchData()
          }}
        />
      </Modal>

      <Modal
        isOpen={isModalUbicacionOpen}
        onRequestClose={() => setIsModalUbicacionOpen(false)}
        className='modal-content'
        overlayClassName='modal-overlay'
      >
        <h2>Agregar Ubicación</h2>
        <FormUbicacion
          onSuccess={() => {
            setIsModalUbicacionOpen(false)
            fetchData()
          }}
        />
      </Modal>

      {/* === Cabecera + botones === */}
      <h2>Gestión de Bodegas</h2>
      <div className='bodega-header'>
        <button
          className='btn-agregar'
          onClick={() => setIsModalBodegaOpen(true)}
        >
          Agregar Bodega
        </button>
        <button
          className='btn-agregar'
          onClick={() => setIsModalUbicacionOpen(true)}
        >
          Agregar Ubicación
        </button>
      </div>

      {/* === Tabla de bodegas + ubicaciones === */}
      <BodegaTabla
        bodegas={bodegas}
        ubicaciones={ubicaciones}
        inventario={inventario}
      />

      {/* === Tarjetas de ocupación === */}
      <h3>Ocupación de Bodegas</h3>
      <OcupacionBodega bodegas={bodegas} inventario={inventario} />
    </div>
  )
}

export default Bodega
