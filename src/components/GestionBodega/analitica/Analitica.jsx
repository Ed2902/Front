import React, { useEffect, useState } from 'react'
import Modal from 'react-modal'

// Filtros y KPIs
import FiltroGlobal from './FiltroGlobal'
import KPIEntradas from './KPIEntradas'

// Gráficos
import EntradasPorProveedor from './EntradasPorProveedor'
import EntradasPorProducto from './EntradasPorProducto'
import EntradasPorCliente from './EntradasPorCliente'
import SalidasPorCliente from './SalidasPorCliente'
import En_inventario from './En_inventario'
import CrecimientoInventario from './CrecimientoInventario'
import RotacionProductos from './RotacionProductos'
import ContribucionTipoMensual from './ContribucionTipoMensual'

// Estilos y servicios
import { getHistorialConLote } from './analitica.service'
import './Analitica.css'

Modal.setAppElement('#root')

const Analitica = () => {
  const [mes, setMes] = useState('00')
  const [año, setAño] = useState('2025')
  const [tipoProducto, setTipoProducto] = useState('')
  const [tiposDisponibles, setTiposDisponibles] = useState([])
  const [historial, setHistorial] = useState([])

  const [graficoActivo, setGraficoActivo] = useState(null)

  useEffect(() => {
    const cargarHistorial = async () => {
      try {
        const datos = await getHistorialConLote()
        setHistorial(datos)

        const tiposUnicos = Array.from(
          new Set(
            datos.map(d => d.LoteProducto?.Producto?.Tipo).filter(Boolean)
          )
        )
        setTiposDisponibles(tiposUnicos)
      } catch (error) {
        console.error('Error al cargar historial:', error)
      }
    }

    cargarHistorial()
  }, [])

  useEffect(() => {
    if (!tipoProducto && tiposDisponibles.length > 0) {
      setTipoProducto(tiposDisponibles[0])
    }
  }, [tiposDisponibles, tipoProducto])

  const datosFiltrados = historial.filter(
    h => h.LoteProducto?.Producto?.Tipo === tipoProducto
  )

  const hayCliente = datosFiltrados.some(h => h.LoteProducto?.id_Cliente)
  const hayProveedor = datosFiltrados.some(h => h.LoteProducto?.id_proveedor)

  const abrirModal = (componente, propsExtra = {}) =>
    setGraficoActivo({ componente, props: propsExtra })

  const cerrarModal = () => setGraficoActivo(null)

  const renderGraficoEnModal = () => {
    if (!graficoActivo) return null
    const { componente, props } = graficoActivo

    const map = {
      EntradasPorProveedor,
      EntradasPorCliente,
      SalidasPorCliente,
      EntradasPorProducto,
      En_inventario,
      CrecimientoInventario,
      RotacionProductos,
      ContribucionTipoMensual,
    }

    const Componente = map[componente]
    return <Componente {...props} />
  }

  return (
    <div className='contenedor-analitica'>
      <h2>Dashboard de Análisis Mensual</h2>

      <FiltroGlobal
        mes={mes}
        setMes={setMes}
        año={año}
        setAño={setAño}
        tipoProducto={tipoProducto}
        setTipoProducto={setTipoProducto}
        tiposDisponibles={tiposDisponibles}
      />

      <div className='kpi-analitica'>
        <KPIEntradas tipoProducto={tipoProducto} mes={mes} año={año} />
      </div>

      {tipoProducto && (
        <div className='bloque-tipo'>
          <h3>Analítica para tipo: {tipoProducto}</h3>

          <div className='graficos-analitica'>
            {hayProveedor && (
              <div
                onClick={() =>
                  abrirModal('EntradasPorProveedor', { tipoProducto, mes, año })
                }
              >
                <EntradasPorProveedor
                  tipoProducto={tipoProducto}
                  mes={mes}
                  año={año}
                />
              </div>
            )}
            {hayCliente && (
              <>
                <div
                  onClick={() =>
                    abrirModal('EntradasPorCliente', { tipoProducto, mes, año })
                  }
                >
                  <EntradasPorCliente
                    tipoProducto={tipoProducto}
                    mes={mes}
                    año={año}
                  />
                </div>
                <div
                  onClick={() =>
                    abrirModal('SalidasPorCliente', { tipoProducto, mes, año })
                  }
                >
                  <SalidasPorCliente
                    tipoProducto={tipoProducto}
                    mes={mes}
                    año={año}
                  />
                </div>
              </>
            )}
          </div>

          <div className='graficos-dobles'>
            <div
              onClick={() =>
                abrirModal('EntradasPorProducto', { tipoProducto, mes, año })
              }
            >
              <EntradasPorProducto
                tipoProducto={tipoProducto}
                mes={mes}
                año={año}
              />
            </div>
            <div onClick={() => abrirModal('En_inventario', { tipoProducto })}>
              <En_inventario tipoProducto={tipoProducto} />
            </div>
          </div>

          <div className='graficos-dobles'>
            <div
              onClick={() =>
                abrirModal('CrecimientoInventario', { tipoProducto, mes, año })
              }
            >
              <CrecimientoInventario
                tipoProducto={tipoProducto}
                mes={mes}
                año={año}
              />
            </div>
            <div
              onClick={() =>
                abrirModal('RotacionProductos', { tipoProducto, mes, año })
              }
            >
              <RotacionProductos
                tipoProducto={tipoProducto}
                mes={mes}
                año={año}
              />
            </div>
          </div>

          <div className='graficos-dobles'>
            <div onClick={() => abrirModal('ContribucionTipoMensual', { año })}>
              <ContribucionTipoMensual año={año} />
            </div>
          </div>
        </div>
      )}

      <Modal
        isOpen={!!graficoActivo}
        onRequestClose={cerrarModal}
        className='modal-grafico'
        overlayClassName='modal-overlay'
        contentLabel='Vista ampliada'
      >
        <button onClick={cerrarModal} className='btn btn-danger float-end'>
          Cerrar
        </button>
        <div style={{ marginTop: '20px' }}>{renderGraficoEnModal()}</div>
      </Modal>
    </div>
  )
}

export default Analitica
