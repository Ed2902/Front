import { useState, useEffect } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MarkerType,
} from 'react-flow-renderer'
import { getHistorialConLote } from './Movimientos.service'
import { usePermisos } from '../../../hooks/usePermisos'
import './DiagramaFlujo.css'

const DiagramaFlujo = () => {
  const [datosHistorial, setDatosHistorial] = useState([])
  const [lotesUnicos, setLotesUnicos] = useState([])
  const [productosPorLote, setProductosPorLote] = useState([])
  const [idLote, setIdLote] = useState('')
  const [idProducto, setIdProducto] = useState('')
  const [nodes, setNodes] = useState([])
  const [edges, setEdges] = useState([])
  const [inventario, setInventario] = useState([])
  const [resumenMovimientos, setResumenMovimientos] = useState([])

  const { tienePermiso } = usePermisos()

  // Permisos del usuario
  const permisoProductosRS = tienePermiso('productosRS')
  const permisoProductosBodega = tienePermiso('productosBodega')

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const datos = await getHistorialConLote()
        setDatosHistorial(datos)

        // Filtrar lotes con productos permitidos
        const lotes = datos
          .map(d => d.LoteProducto?.id_lote)
          .filter((v, i, a) => v && a.indexOf(v) === i)
          .map(id => {
            const productos = datos
              .filter(d => d.LoteProducto?.id_lote === id)
              .map(d => d.LoteProducto?.Producto)
              .filter(p => p)
            const productosFiltrados = productos.filter(p => {
              if (permisoProductosRS && p.Tipo === 'RS') return true
              if (permisoProductosBodega && p.Tipo === 'Bodega') return true
              if (permisoProductosRS && permisoProductosBodega) return true
              return false
            })
            return { id, label: id, productos: productosFiltrados }
          })
          .filter(lote => lote.productos.length > 0) // Filtramos los lotes que no tienen productos válidos

        setLotesUnicos(lotes)
      } catch (err) {
        console.error('Error cargando historial:', err)
      }
    }

    cargarDatos()
  }, [permisoProductosRS, permisoProductosBodega])

  useEffect(() => {
    if (!idLote) return setProductosPorLote([])

    const productos = datosHistorial
      .filter(d => d.LoteProducto?.id_lote === idLote)
      .map(d => d.LoteProducto?.Producto?.Id_producto)
      .filter((v, i, a) => v && a.indexOf(v) === i)
      .map(id => ({ id, label: id }))

    // Filtrar productos según los permisos
    const productosFiltrados = productos.filter(p => {
      const producto = datosHistorial.find(
        d => d.LoteProducto?.id_producto === p.id
      )
      const tipoProducto = producto?.LoteProducto?.Producto?.Tipo

      if (permisoProductosRS && tipoProducto === 'RS') return true
      if (permisoProductosBodega && tipoProducto === 'Bodega') return true
      if (permisoProductosRS && permisoProductosBodega) return true

      return false
    })

    setProductosPorLote(productosFiltrados)
  }, [idLote, datosHistorial, permisoProductosRS, permisoProductosBodega])

  const generarDiagrama = () => {
    const filtrados = datosHistorial.filter(
      d =>
        d.LoteProducto?.id_lote === idLote &&
        (!idProducto || d.LoteProducto?.id_producto === idProducto)
    )

    const ordenados = [...filtrados].sort(
      (a, b) => new Date(a.Fecha_movimiento) - new Date(b.Fecha_movimiento)
    )

    const nodos = []
    const conexiones = []
    const mapaNodos = {}
    const inventarioMap = {}
    const resumenMap = {} // nuevo
    const posY = { Entrada: -120, Transformación: 0, Salida: 120 }
    let xPos = 0

    ordenados.forEach((mov, i) => {
      const id = `nodo-${i}`
      const tipo = mov.Movimiento_tipo
      const producto =
        mov.LoteProducto?.Producto?.Nombre || mov.id_producto || '¿Producto?'
      const cantidad = mov.Cantidad
      const fecha = new Date(mov.Fecha_movimiento).toLocaleDateString('es-CO')
      const lote = mov.LoteProducto?.id_lote
      const prodId = mov.LoteProducto?.id_producto

      if (!inventarioMap[prodId]) inventarioMap[prodId] = 0
      if (!resumenMap[prodId])
        resumenMap[prodId] = { entrada: 0, salida: 0, transformada: 0 }

      if (tipo === 'Entrada') {
        inventarioMap[prodId] += cantidad
        resumenMap[prodId].entrada += cantidad
      } else if (tipo === 'Salida') {
        inventarioMap[prodId] -= cantidad
        resumenMap[prodId].salida += cantidad
      } else if (tipo === 'Transformación') {
        inventarioMap[prodId] -= cantidad
        resumenMap[prodId].transformada += cantidad
      }

      const y = posY[tipo] ?? 60
      const node = {
        id,
        data: {
          label: `${tipo}\n📦 ${producto}\nCantidad: ${cantidad}\n${fecha}`,
        },
        position: { x: xPos * 200, y },
        style: {
          backgroundColor:
            tipo === 'Entrada'
              ? '#bbf7d0'
              : tipo === 'Salida'
              ? '#fecdd3'
              : tipo === 'Transformación'
              ? '#dbeafe'
              : '#fffacc',
          border: `3px solid ${
            tipo === 'Entrada'
              ? '#22c55e'
              : tipo === 'Salida'
              ? '#ef4444'
              : '#3b82f6'
          }`,
          padding: 10,
          borderRadius: 10,
          fontWeight: 'bold',
          fontSize: 13,
          whiteSpace: 'pre-line',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          color: '#111',
          width: 140,
          textAlign: 'center',
        },
        draggable: false,
        sourcePosition: 'right',
        targetPosition: 'left',
      }

      nodos.push(node)
      mapaNodos[id] = {
        ...mov,
        index: i,
        id_lote: lote,
        id_producto: prodId,
        fecha: mov.Fecha_movimiento,
      }
      xPos++
    })

    nodos.forEach(actual => {
      const mov = mapaNodos[actual.id]

      if (mov.Movimiento_tipo === 'Transformación') {
        Object.entries(mapaNodos).forEach(([idPrev, prev]) => {
          if (
            prev.Movimiento_tipo === 'Entrada' &&
            prev.id_lote === mov.id_lote &&
            prev.id_producto === mov.id_producto &&
            new Date(prev.fecha) < new Date(mov.fecha)
          ) {
            conexiones.push({
              id: `e-${idPrev}-${actual.id}`,
              source: idPrev,
              target: actual.id,
              animated: true,
              type: 'step',
              markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' },
            })
          }
        })
      }

      if (mov.Movimiento_tipo === 'Entrada') {
        const prevTrans = Object.values(mapaNodos).filter(
          p =>
            p.Movimiento_tipo === 'Transformación' &&
            p.id_lote === mov.id_lote &&
            p.id_producto !== mov.id_producto &&
            new Date(p.fecha) < new Date(mov.fecha)
        )
        if (prevTrans.length > 0) {
          const ult = prevTrans[prevTrans.length - 1]
          conexiones.push({
            id: `e-${ult.index}-${actual.id}`,
            source: `nodo-${ult.index}`,
            target: actual.id,
            animated: true,
            type: 'step',
            markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' },
          })
        }
      }

      if (mov.Movimiento_tipo === 'Salida') {
        const prev = Object.entries(mapaNodos).filter(
          // eslint-disable-next-line no-unused-vars
          ([_, p]) =>
            p.id_lote === mov.id_lote &&
            p.id_producto === mov.id_producto &&
            new Date(p.fecha) < new Date(mov.fecha)
        )
        if (prev.length > 0) {
          const [idPrev] = prev[prev.length - 1]
          conexiones.push({
            id: `e-${idPrev}-${actual.id}`,
            source: idPrev,
            target: actual.id,
            animated: true,
            type: 'step',
            markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' },
          })
        }
      }
    })

    setNodes(nodos)
    setEdges(conexiones)

    const resumen = Object.entries(inventarioMap).map(
      ([producto, cantidad]) => ({ producto, cantidad })
    )
    const resumenDetalle = Object.entries(resumenMap).map(
      ([producto, valores]) => ({ producto, ...valores })
    )

    setInventario(resumen)
    setResumenMovimientos(resumenDetalle)
  }

  return (
    <div className='diagrama-flujo-container'>
      <div className='filtros-diagrama'>
        <select
          value={idLote}
          onChange={e => setIdLote(e.target.value)}
          disabled={lotesUnicos.length === 0}
        >
          <option value=''>Selecciona un lote</option>
          {lotesUnicos.map(l => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>

        <select
          value={idProducto}
          onChange={e => setIdProducto(e.target.value)}
          disabled={!productosPorLote.length}
        >
          <option value=''>Todos los productos</option>
          {productosPorLote.map(p => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>

        <button className='btn-agregarform' onClick={generarDiagrama}>
          Generar Diagrama
        </button>
      </div>

      <div
        style={{
          height: 600,
          background: '#f0f8ff',
          borderRadius: '10px',
          marginTop: '20px',
        }}
      >
        <ReactFlow nodes={nodes} edges={edges} fitView>
          <Background />
          <Controls />
        </ReactFlow>
      </div>

      {inventario.length > 0 && (
        <div className='resumen-inventario'>
          <h4>Inventario Actual por Producto</h4>
          <ul>
            {inventario.map(({ producto, cantidad }) => (
              <li key={producto}>
                <strong>{producto}</strong>: {cantidad} unidades
              </li>
            ))}
          </ul>
        </div>
      )}

      {resumenMovimientos.length > 0 && (
        <div className='resumen-movimientos'>
          <h4>Resumen de Movimientos por Producto</h4>
          <ul>
            {resumenMovimientos.map(
              ({ producto, entrada, salida, transformada }) => (
                <li key={producto}>
                  <strong>{producto}</strong>: Entrada: {entrada}, Salida:{' '}
                  {salida}, Transformada: {transformada}
                </li>
              )
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

export default DiagramaFlujo
