// src/components/GestionBodega/Lotes/FormatoEquivalenteModal.jsx
import { useEffect, useMemo, useState } from 'react'
import Modal from 'react-modal'
import axios from 'axios'
import {
  actualizarCamposNuevosLote,
  actualizarPrecioLoteProducto,
  generarPDFFormatoEquivalente,
} from './formatoEquivalente.service'

// Unidades de negocio válidas
const UNIDADES_NEGOCIO = ['Harvest', 'Fastway']

const numberOrNull = v => {
  if (v === '' || v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

const getIdLP = r => r.id_lote_producto ?? r.Id_lote_producto ?? r.id ?? null

// Para construir URL absoluta hacia el backend manteniendo rutas relativas (/api/...)
const API_BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '')
  : `${window.location.origin}`

const FormatoEquivalenteModal = ({
  isOpen,
  onClose,
  idLote,
  registros = [],
  productNameById = {},
}) => {
  const [unidadNegocio, setUnidadNegocio] = useState('')
  const [aceptacion, setAceptacion] = useState(false)
  const [precios, setPrecios] = useState({}) // { id_lote_producto: valor_unitario }
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [okMsg, setOkMsg] = useState('')
  const [downloadUrl, setDownloadUrl] = useState('') // <-- URL protegida para ver/descargar

  // Inicializa precios con lo que venga en registros (si ya existieran)
  useEffect(() => {
    if (!isOpen) return
    setError('')
    setOkMsg('')
    setAceptacion(false)
    setUnidadNegocio('')
    setDownloadUrl('')
    const seed = {}
    for (const r of registros) {
      const key = getIdLP(r)
      if (!key) continue
      const existing =
        r.valor_unitario ?? r.ValorUnitario ?? r.precio_unitario ?? null
      seed[key] = numberOrNull(existing) ?? ''
    }
    setPrecios(seed)
  }, [isOpen, registros])

  const filas = useMemo(
    () =>
      [...registros].sort(
        (a, b) => new Date(a.Fecha_registro) - new Date(b.Fecha_registro)
      ),
    [registros]
  )

  // Subtotal: si hay peso (>0) => Cant × PesoU × ValorU; si no, Cant × ValorU
  const subtotales = useMemo(() => {
    const map = {}
    for (const r of filas) {
      const idp = getIdLP(r)
      const vu = numberOrNull(precios[idp]) // $/Kg o $/u según peso
      const cant = Number(r.Cantidad || 0)
      const pesoU = Number(r.PesoUnitarioKg ?? 0)

      if (vu == null || !isFinite(vu)) {
        map[idp] = null
      } else if (pesoU > 0) {
        map[idp] = vu * cant * pesoU
      } else {
        map[idp] = vu * cant
      }
    }
    return map
  }, [filas, precios])

  const totalLote = useMemo(() => {
    return Object.values(subtotales).reduce(
      (acc, v) => acc + (v == null ? 0 : v),
      0
    )
  }, [subtotales])

  const handleChangePrecio = (idLp, value) => {
    const cleaned = value.replace(/[^\d.,-]/g, '').replace(',', '.')
    setPrecios(prev => ({ ...prev, [idLp]: cleaned }))
  }

  const validar = () => {
    const faltantes = []
    if (!idLote) faltantes.push('Id_lote')
    if (!unidadNegocio) faltantes.push('unidad_negocio')
    // Todos los precios deben estar informados y numéricos (≥ 0)
    for (const r of filas) {
      const idp = getIdLP(r)
      if (!idp) continue
      const vu = numberOrNull(precios[idp])
      if (vu == null || vu < 0) {
        faltantes.push(`valor_unitario del producto ${r.id_producto}`)
      }
    }
    if (!aceptacion) faltantes.push('aceptación')
    if (faltantes.length) {
      setError(`Completa los campos requeridos: ${faltantes.join(', ')}`)
      return false
    }
    return true
  }

  const onGenerar = async () => {
    setError('')
    setOkMsg('')
    setDownloadUrl('')
    if (!validar()) return

    try {
      setGuardando(true)

      // 1) Actualizar precios por producto (evita IDs inválidos)
      for (const r of filas) {
        const idLP = getIdLP(r)
        if (!idLP) continue
        const valor_unitario = numberOrNull(precios[idLP])
        if (valor_unitario == null || valor_unitario < 0) continue
        await actualizarPrecioLoteProducto(String(idLP).trim(), {
          valor_unitario,
        })
      }

      // 2) Actualizar campos nuevos del lote
      const payloadLote = {
        unidad_negocio: unidadNegocio,
        valor_total_lote: Number(totalLote.toFixed(2)),
        aceptacion: true,
        aceptacion_fecha: new Date().toISOString(),
      }
      await actualizarCamposNuevosLote(idLote, payloadLote)

      // 3) Generar PDF
      const { message, downloadUrl: dlUrl } =
        await generarPDFFormatoEquivalente(idLote)
      setOkMsg(message || 'PDF generado exitosamente')
      if (dlUrl) setDownloadUrl(dlUrl)
    } catch (e) {
      const apiMsg =
        e?.response?.data?.message || e?.message || 'Error generando el PDF'
      setError(apiMsg)
    } finally {
      setGuardando(false)
    }
  }

  const formatMoney = n =>
    Number(n || 0).toLocaleString('es-CO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })

  const kgTotales = r => {
    const cant = Number(r.Cantidad || 0)
    const pesoU = Number(r.PesoUnitarioKg ?? 0)
    const total = cant * pesoU
    return isFinite(total) ? total : 0
  }

  // Hint visual ($/Kg o $/u)
  const precioHint = r => (Number(r.PesoUnitarioKg ?? 0) > 0 ? '$/Kg' : '$/u')

  // Ver/Descargar PDF (autenticado) en nueva pestaña usando Blob URL
  const handleVerDescargarPdf = async () => {
    if (!downloadUrl) return
    const token = localStorage.getItem('token') || ''
    const absoluteUrl = /^https?:\/\//i.test(downloadUrl)
      ? downloadUrl
      : `${API_BASE}${downloadUrl}`

    try {
      const res = await axios.get(absoluteUrl, {
        responseType: 'blob',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      const blobUrl = URL.createObjectURL(res.data)
      window.open(blobUrl, '_blank', 'noopener,noreferrer')
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
    } catch (e) {
      console.error(e) // <- ahora usamos la variable y no dispara el warning
      setError(
        'No se pudo abrir el PDF. Verifica tu sesión e intenta de nuevo.'
      )
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={() => !guardando && onClose()}
      contentLabel='Formato equivalente'
      className='modal-content modal-xl position-relative p-4'
      overlayClassName='modal-overlay'
    >
      {/* Botón cerrar en esquina */}
      <button
        type='button'
        className='btn-close position-absolute top-0 end-0 m-3'
        aria-label='Cerrar'
        onClick={onClose}
        disabled={guardando}
      />

      {/* Header con más aire */}
      <div className='mb-3 pb-2 border-bottom'>
        <h4 className='m-0'>Formato equivalente</h4>
        <br />
        <div className='text-muted small mt-1'>
          Lote <span className='badge text-bg-primary'>{idLote}</span>
        </div>
      </div>

      {/* Unidad de negocio + aceptación */}
      <div className='row g-4 mb-4'>
        <div className='col-sm-6 col-md-4'>
          <label className='form-label'>Unidad de negocio</label>
          <select
            className='form-select'
            value={unidadNegocio}
            onChange={e => setUnidadNegocio(e.target.value)}
            disabled={guardando}
          >
            <option value=''>Seleccione…</option>
            {UNIDADES_NEGOCIO.map(op => (
              <option key={op} value={op}>
                {op}
              </option>
            ))}
          </select>
          <div className='form-text'>
            Opciones permitidas: <strong>Harvest</strong> o{' '}
            <strong>Fastway</strong>.
          </div>
        </div>

        <div className='col-sm-6 col-md-4 d-flex align-items-end'>
          <div className='form-check'>
            <input
              className='form-check-input chk-accept'
              type='checkbox'
              id='chkAceptacion'
              checked={aceptacion}
              onChange={e => setAceptacion(e.target.checked)}
              disabled={guardando}
            />
            <label
              className='form-check-label fw-semibold'
              htmlFor='chkAceptacion'
            >
              <span className='badge text-bg-success me-1'>⬅️ Click aca ✔</span>
              Autorización
            </label>
            <div className='form-text text-danger-emphasis'>
              Solo debe marcarlo la persona autorizada:{' '}
              <strong>por Don Libardo o superiores</strong>.
            </div>
          </div>
        </div>

        <div className='col-sm-12 col-md-4 d-flex align-items-end justify-content-md-end'>
          <div className='text-end w-100'>
            <div className='small text-muted'>Total lote (estimado)</div>
            <div className='display-6 fw-semibold'>
              $ {formatMoney(totalLote)}
            </div>
          </div>
        </div>
      </div>

      {/* Tabla con más separación */}
      <div className='table-responsive'>
        <table className='table table-sm align-middle'>
          <thead className='table-light'>
            <tr>
              <th className='px-4' style={{ minWidth: 240 }}>
                Producto
              </th>
              <th className='text-end px-4'>Cantidad</th>
              <th className='text-end px-4'>Peso U. (Kg)</th>
              <th className='text-end px-4'>Kg totales</th>
              <th className='text-end px-4' style={{ minWidth: 240 }}>
                Valor unitario
              </th>
              <th className='text-end px-4' style={{ minWidth: 180 }}>
                Subtotal
              </th>
            </tr>
          </thead>
          <tbody>
            {filas.map(r => {
              const idLP = getIdLP(r)
              const nombre =
                productNameById[String(r.id_producto)] || r.Nombre || ''
              const cant = Number(r.Cantidad || 0)
              const subtotal = subtotales[idLP]
              const pesoU =
                r.PesoUnitarioKg == null ? null : Number(r.PesoUnitarioKg)
              const hint = precioHint(r)

              return (
                <tr key={idLP ?? `${r.id_producto}-${r.Fecha_registro}`}>
                  <td className='text-break px-4'>
                    <div className='fw-semibold'>{r.id_producto}</div>
                    <div className='text-muted small'>{nombre}</div>
                  </td>
                  <td className='text-end px-4'>{cant}</td>
                  <td className='text-end px-4'>
                    {pesoU == null ? (
                      <span className='text-muted'>—</span>
                    ) : (
                      numberOrNull(pesoU)
                    )}
                  </td>
                  <td className='text-end px-4'>
                    {pesoU ? (
                      kgTotales(r)
                    ) : (
                      <span className='text-muted'>—</span>
                    )}
                  </td>
                  <td className='px-4'>
                    <div className='input-group input-group-sm'>
                      <span className='input-group-text'>$</span>
                      <input
                        type='text'
                        className='form-control text-end'
                        value={precios[idLP] ?? ''}
                        onChange={e => handleChangePrecio(idLP, e.target.value)}
                        placeholder='0.00'
                        disabled={guardando || !idLP}
                        title={`Valor unitario (${hint})`}
                      />
                      <span className='input-group-text'>{hint}</span>
                    </div>
                    {!idLP && (
                      <div className='text-danger small mt-1'>
                        Registro antiguo sin id_lote_producto (no se
                        actualizará).
                      </div>
                    )}
                  </td>
                  <td className='text-end px-4'>
                    {subtotal == null ? (
                      <span className='text-muted'>—</span>
                    ) : (
                      <span className='fw-semibold'>
                        $ {formatMoney(subtotal)}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <th colSpan={5} className='text-end px-4'>
                Total lote
              </th>
              <th className='text-end px-4'>$ {formatMoney(totalLote)}</th>
            </tr>
          </tfoot>
        </table>
      </div>

      {error && (
        <div className='alert alert-danger py-2 mt-3'>{String(error)}</div>
      )}
      {okMsg && (
        <div className='alert alert-success py-2 mt-3 d-flex flex-wrap align-items-center gap-2'>
          <span>{okMsg}. También puedes descargarlo desde Financiera.</span>
          {downloadUrl && (
            <button
              type='button'
              className='btn btn-sm btn-success ms-auto'
              onClick={handleVerDescargarPdf}
            >
              Ver/Descargar PDF
            </button>
          )}
        </div>
      )}

      {/* Footer de acciones con aire */}
      <div className='d-flex gap-2 justify-content-end mt-4 pt-2 border-top'>
        <button
          className='btn btn-outline-secondary'
          onClick={onClose}
          disabled={guardando}
        >
          Cancelar
        </button>
        <button
          className='btn btn-primary'
          onClick={onGenerar}
          disabled={guardando}
          title='Actualiza precios, guarda datos del lote y genera el PDF'
        >
          {guardando ? 'Generando…' : 'Generar PDF'}
        </button>
      </div>
    </Modal>
  )
}

export default FormatoEquivalenteModal
