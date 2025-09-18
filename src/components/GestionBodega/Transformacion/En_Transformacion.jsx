// src/components/Inventario/Transformaciones/EnTransformacion.jsx
import { useEffect, useMemo, useState } from 'react'
import Modal from 'react-modal'
import DataTable from 'react-data-table-component'
import { FaFileExcel } from 'react-icons/fa'
import { utils, writeFile } from 'xlsx'

import {
  getTransformaciones,
  getHistorialTransformaciones, // 👈 NEW para listar salidas por paso
  getProductos, // 👈 NEW para mapear nombres de productos
  calcularMermaPaso,
  cerrarTransformacionPaso,
} from './TransformacionService'
import PintarTransformacion from './pintarTransformacion'
import FormTransformacion from '../Inventario/FormTransformacion'
import { usePermisos } from '../../../hooks/usePermisos'

Modal.setAppElement('#root')

const EnTransformacion = () => {
  const { tienePermiso } = usePermisos()

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [globalFilter, setGlobalFilter] = useState('')

  const [isAgregarModalOpen, setIsAgregarModalOpen] = useState(false)
  const [isTransformarModalOpen, setIsTransformarModalOpen] = useState(false)
  const [isAnalizarModalOpen, setIsAnalizarModalOpen] = useState(false)

  const [rowSeleccionada, setRowSeleccionada] = useState(null)

  // Estado para análisis
  const [analizando, setAnalizando] = useState(false)
  const [analisis, setAnalisis] = useState(null)
  const [msg, setMsg] = useState(null) // {type:'success'|'error', text:string}

  // Cierre directo (desde el botón rojo)
  const [cerrando, setCerrando] = useState(false)

  // 📦 Productos (map Id_producto -> Nombre) para mostrar nombres de destino
  const [productoMap, setProductoMap] = useState({})
  useEffect(() => {
    const loadProductos = async () => {
      try {
        const prods = await getProductos()
        const map = {}
        ;(prods || []).forEach(p => (map[p.Id_producto] = p.Nombre))
        setProductoMap(map)
      } catch {
        // silencio: si falla, mostramos solo el Id en la tabla
      }
    }
    loadProductos()
  }, [])

  // 🧾 Salidas del paso (agrupadas)
  const [salidasPaso, setSalidasPaso] = useState([]) // [{id, nombre, totalKg, movimientos, tipos:{...}}]
  const [cargandoSalidas, setCargandoSalidas] = useState(false)

  const nf = (n, d = 2) =>
    n == null || n === ''
      ? '—'
      : Number(n).toLocaleString('es-CO', {
          minimumFractionDigits: d,
          maximumFractionDigits: d,
        })

  const cargarTransformaciones = async () => {
    try {
      setLoading(true)
      setError(null)
      const permisos = {
        verProductosRS: tienePermiso('productosRS'),
        verProductosBodega: tienePermiso('productosBodega'),
      }
      const data = await getTransformaciones(permisos)
      setRows(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error(err)
      setError('No se pudo cargar transformaciones.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarTransformaciones()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tienePermiso])

  const formatFecha = fecha => {
    if (!fecha) return ''
    const d = new Date(fecha)
    return d.toLocaleString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  }

  const filtered = useMemo(() => {
    const q = globalFilter.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(r =>
      [
        r?.LoteProducto?.Lote?.Id_lote,
        r?.LoteProducto?.Id_lote_producto,
        r?.Producto?.Nombre,
        r?.Producto?.Id_producto,
        r?.Personal?.Nombre,
        r?.Estado,
      ]
        .join(' ')
        .toLowerCase()
        .includes(q)
    )
  }, [rows, globalFilter])

  const exportar = () => {
    const wb = utils.book_new()
    const sheet = utils.json_to_sheet(
      filtered.map(r => ({
        Lote: r?.LoteProducto?.Lote?.Id_lote || '',
        'Lote-Producto': r?.LoteProducto?.Id_lote_producto || '',
        Producto: r?.Producto?.Nombre || '',
        Cantidad: r?.Cantidad ?? '',
        'Fecha mov.': formatFecha(r?.HistorialIngresoSalida?.Fecha_movimiento),
        Personal: r?.Personal?.Nombre || '',
        Estado: r?.Estado || '',
      }))
    )
    utils.book_append_sheet(wb, sheet, 'Transformaciones')
    writeFile(wb, 'Transformaciones.xlsx')
  }

  // 🔎 Calcular merma + cargar salidas agrupadas del paso
  const abrirAnalisis = async r => {
    setRowSeleccionada(r)
    setAnalisis(null)
    setSalidasPaso([])
    setMsg(null)
    setIsAnalizarModalOpen(true)

    try {
      setAnalizando(true)
      const resp = await calcularMermaPaso({
        id_transformacion_paso: r?.Id_transformacion_paso,
      })
      setAnalisis(resp || null)
    } catch (e) {
      console.error(e)
      setMsg({
        type: 'error',
        text: 'No se pudo calcular la merma para este paso.',
      })
    } finally {
      setAnalizando(false)
    }

    // ➕ Cargar "¿en qué se transformó?"
    try {
      setCargandoSalidas(true)
      const all = await getHistorialTransformaciones()
      const delPaso = (all || []).filter(
        h =>
          String(
            h?.id_transformacion_paso ?? h?.Id_transformacion_paso ?? ''
          ) === String(r?.Id_transformacion_paso)
      )

      // Agrupar por producto destino
      const grouped = Object.values(
        delPaso.reduce((acc, item) => {
          const idDest =
            item?.id_producto_new ??
            item?.Id_producto_new ??
            item?.id_producto_destino ??
            item?.id_producto // fallback

          const gen =
            Number(
              item?.cantidad_generada ??
                item?.Cantidad_generada ??
                item?.cantidad ??
                0
            ) || 0

          const tipo = item?.tipos_transformacion || item?.Tipos_transformacion

          if (!acc[idDest]) {
            acc[idDest] = {
              id: idDest,
              nombre: productoMap[idDest] || idDest,
              totalKg: 0,
              movimientos: 0,
              tipos: {}, // {Corte: 2, Limpieza:1}
            }
          }
          acc[idDest].totalKg += gen
          acc[idDest].movimientos += 1
          if (tipo) {
            acc[idDest].tipos[tipo] = (acc[idDest].tipos[tipo] || 0) + 1
          }
          return acc
        }, {})
      ).sort((a, b) => b.totalKg - a.totalKg)

      setSalidasPaso(grouped)
    } catch (e) {
      console.error(e)
      // no cortamos el modal si falla, solo mostramos vacío
      setSalidasPaso([])
    } finally {
      setCargandoSalidas(false)
    }
  }

  const handleCerrarPaso = async r => {
    if (!r?.Id_transformacion_paso || r?.Estado === 'Cerrado') return
    const ok = window.confirm(
      `¿Está seguro de cerrar el paso #${r.Id_transformacion_paso}?`
    )
    if (!ok) return
    try {
      setCerrando(true)
      await cerrarTransformacionPaso({
        id_transformacion_paso: r.Id_transformacion_paso,
      })
      alert('Paso cerrado correctamente.')
      await cargarTransformaciones()
    } catch (e) {
      console.error(e)
      alert(
        e?.response?.data?.message ||
          'Ocurrió un error al cerrar el paso de transformación.'
      )
    } finally {
      setCerrando(false)
    }
  }

  const BUTTON_W = 160

  const columns = [
    {
      name: 'Lote',
      selector: r => r?.LoteProducto?.Lote?.Id_lote || '—',
      sortable: true,
      width: '90px',
    },
    {
      name: 'Lote-Producto',
      selector: r => r?.LoteProducto?.Id_lote_producto || '—',
      sortable: true,
      width: '100px',
    },
    {
      name: 'Producto',
      selector: r => r?.Producto?.Nombre || '—',
      sortable: true,
      grow: 6,
      wrap: true,
    },
    {
      name: 'Cantidad',
      selector: r => r?.Cantidad ?? '—',
      sortable: true,
      right: true,
      width: '100px',
    },
    {
      name: 'Fecha Movimiento',
      selector: r => formatFecha(r?.HistorialIngresoSalida?.Fecha_movimiento),
      sortable: true,
      width: '110px',
    },
    {
      name: 'Personal',
      selector: r => r?.Personal?.Nombre || '—',
      sortable: true,
      width: '120px',
    },
    {
      name: 'Estado',
      selector: r => r?.Estado || '—',
      sortable: true,
      width: '120px',
      cell: r => {
        const est = r?.Estado || '—'
        return (
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 8,
              fontSize: 12,
              background:
                est === 'Cerrado'
                  ? '#e9ecef'
                  : est === 'En_proceso'
                  ? '#ffeeba'
                  : '#d4edda',
            }}
          >
            {est}
          </span>
        )
      },
    },
    {
      name: 'Acciones',
      width: '190px',
      cell: r => {
        const isCerrado = r?.Estado === 'Cerrado'
        return (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              minWidth: BUTTON_W,
            }}
          >
            <button
              className='btn btn-primary btn-sm'
              style={{ width: '100%' }}
              disabled={isCerrado}
              onClick={() => {
                setRowSeleccionada(r)
                setIsTransformarModalOpen(true)
              }}
              title={
                isCerrado
                  ? 'Paso cerrado: no se puede transformar'
                  : 'Transformar'
              }
            >
              Transformar
            </button>

            <button
              className='btn btn-outline-dark btn-sm'
              style={{ width: '100%' }}
              disabled={!isCerrado}
              onClick={() => abrirAnalisis(r)}
              title={
                !isCerrado
                  ? 'Disponible cuando el paso esté cerrado'
                  : 'Ver análisis de merma y salidas'
              }
            >
              Analizar merma
            </button>

            <button
              className='btn btn-danger btn-sm'
              style={{ width: '100%' }}
              disabled={isCerrado || cerrando}
              onClick={() => handleCerrarPaso(r)}
              title='Cerrar paso'
            >
              {cerrando ? 'Cerrando…' : 'Cerrar'}
            </button>
          </div>
        )
      },
    },
  ]

  const customStyles = {
    headCells: { style: { fontWeight: 600 } },
    rows: { style: { minHeight: '64px' } },
  }

  const SubHeader = (
    <div className='d-flex w-100 align-items-center gap-2'>
      <div className='input-group' style={{ maxWidth: 420 }}>
        <span className='input-group-text'>Buscar</span>
        <input
          type='text'
          className='form-control'
          placeholder='Lote, producto, personal o estado…'
          value={globalFilter}
          onChange={e => setGlobalFilter(e.target.value)}
        />
      </div>

      <div className='ms-auto d-flex align-items-center gap-2'>
        <button
          className='btn btn-success btn-sm'
          onClick={exportar}
          disabled={loading || filtered.length === 0}
        >
          <FaFileExcel className='me-1' /> Exportar
        </button>
        <button
          className='btn btn-primary btn-sm'
          onClick={() => setIsAgregarModalOpen(true)}
        >
          Agregar Transformación
        </button>
      </div>
    </div>
  )

  return (
    <div className='card'>
      <div className='card-header'>
        <strong>Transformaciones en curso</strong>
      </div>

      <div className='card-body'>
        {error && <div className='alert alert-danger py-2'>{error}</div>}

        <DataTable
          columns={columns}
          data={filtered}
          progressPending={loading}
          pagination
          paginationPerPage={30}
          paginationRowsPerPageOptions={[30, 50, 100]}
          highlightOnHover
          dense
          responsive
          customStyles={customStyles}
          subHeader
          subHeaderComponent={SubHeader}
          persistTableHead
          noDataComponent={
            <div className='text-muted small py-3'>Sin datos.</div>
          }
        />
      </div>

      {/* MODAL: Agregar -> FormTransformacion.jsx */}
      <Modal
        isOpen={isAgregarModalOpen}
        onRequestClose={() => setIsAgregarModalOpen(false)}
        className='modal-content'
        overlayClassName='modal-overlay'
      >
        <FormTransformacion
          onClose={() => setIsAgregarModalOpen(false)}
          onSuccess={() => {
            setIsAgregarModalOpen(false)
            cargarTransformaciones()
          }}
        />
      </Modal>

      {/* MODAL: Transformar (usa pintarTransformacion) */}
      <Modal
        isOpen={isTransformarModalOpen}
        onRequestClose={() => setIsTransformarModalOpen(false)}
        className='modal-content'
        overlayClassName='modal-overlay'
      >
        <PintarTransformacion transformacionData={rowSeleccionada} />
      </Modal>

      {/* MODAL: Analizar merma + salidas */}
      <Modal
        isOpen={isAnalizarModalOpen}
        onRequestClose={() => setIsAnalizarModalOpen(false)}
        className='modal-content'
        overlayClassName='modal-overlay'
      >
        <div className='container py-3'>
          <div className='d-flex align-items-center mb-2'>
            <h5 className='mb-0'>
              Análisis de merma — Paso #
              {rowSeleccionada?.Id_transformacion_paso || '—'}
            </h5>
          </div>

          {msg && (
            <div
              className={`alert ${
                msg.type === 'success' ? 'alert-success' : 'alert-danger'
              } py-2`}
            >
              {msg.text}
            </div>
          )}

          {analizando ? (
            <div className='d-flex align-items-center my-3'>
              <div className='spinner-border me-2' role='status' />
              <span>Calculando merma…</span>
            </div>
          ) : analisis ? (
            <>
              {(() => {
                const modo = analisis.modo_merma || analisis.modo || 'KG'
                const isKG = String(modo).toUpperCase() === 'KG'

                const entrada = isKG
                  ? analisis.entradaKg ??
                    analisis.entradaKG ??
                    analisis.entrada ??
                    null
                  : analisis.entradaUN ??
                    analisis.entradaUn ??
                    analisis.entrada ??
                    null

                const salidas = isKG
                  ? analisis.salidasKg ??
                    analisis.salidaKg ??
                    analisis.salidas ??
                    null
                  : analisis.salidasUN ??
                    analisis.salidasUn ??
                    analisis.salidaUN ??
                    analisis.salidaUn ??
                    analisis.salidas ??
                    null

                const merma = isKG
                  ? analisis.mermaKg ??
                    analisis.mermaKG ??
                    analisis.merma ??
                    null
                  : analisis.mermaUN ??
                    analisis.mermaUn ??
                    analisis.merma ??
                    null

                const rendimiento = analisis.rendimiento_pct

                return (
                  <>
                    <div className='row g-3'>
                      <div className='col-md-6'>
                        <div className='card'>
                          <div className='card-body'>
                            <div className='small text-muted'>Modo</div>
                            <div className='fs-5 fw-semibold'>{modo}</div>
                          </div>
                        </div>
                      </div>
                      <div className='col-md-6'>
                        <div className='card'>
                          <div className='card-body'>
                            <div className='small text-muted'>
                              ¿Aplica merma?
                            </div>
                            <div className='fs-5 fw-semibold'>
                              {analisis.aplica_merma ? 'Sí' : 'No'}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className='col-md-4'>
                        <div className='card'>
                          <div className='card-body'>
                            <div className='small text-muted'>Entrada</div>
                            <div className='fs-5 fw-semibold'>
                              {isKG ? `${nf(entrada)} kg` : nf(entrada, 0)}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className='col-md-4'>
                        <div className='card'>
                          <div className='card-body'>
                            <div className='small text-muted'>Salidas</div>
                            <div className='fs-5 fw-semibold'>
                              {isKG ? `${nf(salidas)} kg` : nf(salidas, 0)}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className='col-md-4'>
                        <div className='card'>
                          <div className='card-body'>
                            <div className='small text-muted'>Merma</div>
                            <div className='fs-5 fw-semibold'>
                              {isKG ? `${nf(merma)} kg` : nf(merma, 0)}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className='col-md-6'>
                        <div className='card'>
                          <div className='card-body'>
                            <div className='small text-muted'>Rendimiento</div>
                            <div className='fs-5 fw-semibold'>
                              {rendimiento != null
                                ? `${nf(rendimiento, 2)} %`
                                : '—'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 📦 NUEVO: “En qué se transformó” */}
                    <div className='mt-4'>
                      <h6 className='mb-2'>Transformado en</h6>
                      {cargandoSalidas ? (
                        <div className='d-flex align-items-center my-2'>
                          <div className='spinner-border me-2' role='status' />
                          <span>Cargando salidas…</span>
                        </div>
                      ) : salidasPaso.length === 0 ? (
                        <div className='text-muted'>
                          No hay registros de productos generados para este
                          paso.
                        </div>
                      ) : (
                        <div className='table-responsive'>
                          <table className='table table-sm table-bordered align-middle mb-0'>
                            <thead className='table-light'>
                              <tr>
                                <th>Producto destino</th>
                                <th className='text-end'>
                                  Total generado (kg)
                                </th>
                                <th className='text-center'>Movs</th>
                                <th>Tipos</th>
                              </tr>
                            </thead>
                            <tbody>
                              {salidasPaso.map((s, i) => (
                                <tr key={`${s.id}-${i}`}>
                                  <td>
                                    <div className='fw-semibold'>
                                      {s.nombre}
                                    </div>
                                    <div className='text-muted small'>
                                      {s.id}
                                    </div>
                                  </td>
                                  <td className='text-end'>{nf(s.totalKg)}</td>
                                  <td className='text-center'>
                                    {s.movimientos}
                                  </td>
                                  <td>
                                    {Object.keys(s.tipos).length === 0 ? (
                                      <span className='text-muted'>—</span>
                                    ) : (
                                      <div className='d-flex flex-wrap gap-2'>
                                        {Object.entries(s.tipos).map(
                                          ([t, c]) => (
                                            <span
                                              key={`${t}-${c}`}
                                              className='badge bg-light text-dark'
                                            >
                                              {t}: {c}
                                            </span>
                                          )
                                        )}
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    <div className='d-flex justify-content-end gap-2 mt-3'>
                      <button
                        className='btn btn-outline-secondary btn-sm'
                        onClick={() => abrirAnalisis(rowSeleccionada)}
                        disabled={analizando}
                      >
                        Recalcular
                      </button>
                      <button
                        className='btn btn-secondary btn-sm'
                        onClick={() => setIsAnalizarModalOpen(false)}
                        disabled={analizando}
                      >
                        Cerrar ventana
                      </button>
                      {/* 👇 Intencionalmente SIN botón de “Cerrar paso” aquí */}
                    </div>
                  </>
                )
              })()}
            </>
          ) : (
            <div className='text-muted'>Sin datos de análisis.</div>
          )}
        </div>
      </Modal>
    </div>
  )
}

export default EnTransformacion
