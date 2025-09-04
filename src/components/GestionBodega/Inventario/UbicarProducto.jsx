import { useState, useEffect } from 'react'
import {
  getInventarioPorLoteYProducto,
  getLoteProducto,
} from './Ubicar_service'
import CryptoJS from 'crypto-js'
import QrScanner from 'react-qr-scanner'
import './Inventario.css'

const AES_SECRET_KEY = import.meta.env.VITE_AES_SECRET_KEY

const UbicarProducto = () => {
  const [loteInput, setLoteInput] = useState('')
  const [productoInput, setProductoInput] = useState('')
  const [resultado, setResultado] = useState([])
  const [mensajeQR, setMensajeQR] = useState('')
  const [showQR, setShowQR] = useState(false)

  const [lotesDisponibles, setLotesDisponibles] = useState([])
  const [productosPorLote, setProductosPorLote] = useState({})

  useEffect(() => {
    const cargarLotes = async () => {
      try {
        const data = await getLoteProducto()

        const lotesUnicos = Array.from(new Set(data.map(lp => lp.id_lote)))

        const mapa = {}
        lotesUnicos.forEach(lote => {
          mapa[lote] = data
            .filter(lp => lp.id_lote === lote)
            .map(lp => lp.id_producto)
        })

        setLotesDisponibles(lotesUnicos)
        setProductosPorLote(mapa)
      } catch (error) {
        console.error('Error cargando lotes/productos:', error)
      }
    }

    cargarLotes()
  }, [])

  const decryptData = encryptedText => {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedText, AES_SECRET_KEY)
      const decrypted = bytes.toString(CryptoJS.enc.Utf8)
      if (!decrypted || decrypted.trim() === '') throw new Error('Vacío')
      return JSON.parse(decrypted)
    } catch (error) {
      console.error('❌ Error desencriptando QR:', error)
      return null
    }
  }

  const buscar = async () => {
    if (!loteInput || !productoInput) {
      alert('Selecciona lote y producto primero')
      return
    }

    try {
      const data = await getInventarioPorLoteYProducto(loteInput, productoInput)
      setResultado(data)
      setMensajeQR('')
    } catch (error) {
      console.error('❌ Error consultando inventario:', error)
      setResultado([])
    }
  }

  const handleQRScan = async result => {
    if (result?.text) {
      const data = decryptData(result.text)
      if (!data) return

      const { id_lote, id_producto } = data
      setLoteInput(id_lote || '')
      setProductoInput(id_producto || '')

      try {
        const res = await getInventarioPorLoteYProducto(id_lote, id_producto)
        setResultado(res)
        setMensajeQR('✅ Producto ubicado correctamente.')
      } catch {
        setResultado([])
        setMensajeQR('⚠️ No se encontró el producto del QR.')
      }

      setShowQR(false)
    }
  }

  const handleLoteChange = value => {
    setLoteInput(value)
    setProductoInput('')
  }

  return (
    <div className='inventario-tabla'>
      <h3>Ubicar Producto</h3>

      <div className='busqueda-global'>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          <select
            value={loteInput}
            onChange={e => handleLoteChange(e.target.value)}
            className='form-control buscador-pequeno'
          >
            <option value=''>Seleccionar Lote</option>
            {lotesDisponibles.map(lote => (
              <option key={lote} value={lote}>
                {lote}
              </option>
            ))}
          </select>

          <select
            value={productoInput}
            onChange={e => setProductoInput(e.target.value)}
            className='form-control buscador-pequeno'
            disabled={!loteInput}
          >
            <option value=''>Seleccionar Producto</option>
            {(productosPorLote[loteInput] || []).map(prod => (
              <option key={prod} value={prod}>
                {prod}
              </option>
            ))}
          </select>

          <button className='btn-agregarform' onClick={buscar}>
            Buscar
          </button>

          <button
            className='btn-agregarform'
            onClick={() => setShowQR(!showQR)}
          >
            {showQR ? 'Cerrar Cámara' : 'Escanear QR'}
          </button>
        </div>
      </div>

      {showQR && (
        <div className='qr-container'>
          <QrScanner
            delay={300}
            onScan={handleQRScan}
            onError={err => console.error('Error lector QR:', err)}
            style={{ width: '100%', maxWidth: '400px', margin: '0 auto' }}
          />
        </div>
      )}

      {mensajeQR && (
        <div style={{ margin: '10px 0', fontWeight: 'bold' }}>{mensajeQR}</div>
      )}

      <div className='resultado-cards'>
        {resultado.length === 0 ? (
          <p>No se encontraron coincidencias.</p>
        ) : (
          <div className='row g-3'>
            {resultado.map((item, index) => (
              <div className='col-md-6 col-lg-4' key={index}>
                <div className='card h-100 shadow-sm'>
                  <div className='card-body'>
                    <h5 className='card-title'>
                      {item.Producto?.Nombre || 'Producto desconocido'}
                    </h5>
                    <h6 className='card-subtitle mb-2 text-muted'>
                      ID Producto: {item.Producto?.Id_producto || 'N/A'}
                    </h6>

                    <ul className='list-group list-group-flush mt-3'>
                      <li className='list-group-item'>
                        <strong>Lote:</strong>{' '}
                        {item.LoteProducto?.Lote?.Id_lote || 'N/A'}
                      </li>
                      <li className='list-group-item'>
                        <strong>Cantidad:</strong> {item.Cantidad}
                      </li>
                      <li className='list-group-item'>
                        <strong>Proveedor:</strong>{' '}
                        {item.LoteProducto?.Proveedor?.Nombre || 'N/A'}
                      </li>
                      <li className='list-group-item'>
                        <strong>Bodega:</strong> {item.Bodega?.nombre || 'N/A'}
                      </li>
                      <li className='list-group-item'>
                        <strong>Ubicación:</strong>{' '}
                        {item.UbicacionBodega?.nombre || 'N/A'}
                      </li>
                      <li className='list-group-item'>
                        <strong>Medidas:</strong>{' '}
                        {item.Producto
                          ? `${item.Producto.Alto} x ${item.Producto.Ancho} x ${item.Producto.Largo} (${item.Producto.Unidad_de_medida})`
                          : 'N/A'}
                      </li>
                      <li className='list-group-item'>
                        <strong>Última Entrada:</strong>{' '}
                        {item.Fecha_ultimo_registri
                          ? new Date(
                              item.Fecha_ultimo_registri
                            ).toLocaleDateString('es-CO')
                          : 'N/A'}
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default UbicarProducto
