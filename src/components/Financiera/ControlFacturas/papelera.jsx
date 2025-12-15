import { useContext, useEffect, useMemo, useState } from 'react'
import AuthContext from '../../../context/AuthContext'
import {
  listarFactCompraTrash,
  restaurarFactCompra,
} from './FactCompra.service'
import { listarFactVentaTrash, restaurarFactVenta } from './FactVenta.service'
import { usePermisos } from '../../../hooks/usePermisos'
import './papelera.css'

const safeText = v => (v === null || v === undefined ? '' : String(v))

const fmtDate = iso => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return safeText(iso)
  return d.toLocaleString()
}

const asNumber = v => {
  if (v === null || v === undefined || v === '') return 0
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  const s = String(v).trim()
  const cleaned = s
    .replace(/[^\d.,-]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : 0
}

const fmtCOP = n =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(asNumber(n))

// id interno SOLO para restaurar
const getInternalId = row => row?._id || row?.id || ''

const getConsecutivo = row =>
  row?.consecutivo ?? row?.Consecutivo ?? row?.fc ?? row?.FC ?? ''

const getFactura = row => row?.factura ?? row?.Factura ?? ''

const getLinea = row =>
  row?.linea ?? row?.Linea ?? row?.línea ?? row?.Línea ?? ''

const getValor = row =>
  row?.valor_cop ??
  row?.valorCOP ??
  row?.valor ??
  row?.total ??
  row?.monto ??
  row?.Valor ??
  0

const getDeletedAt = row =>
  row?.deletedAt || row?.deleted_at || row?.updatedAt || ''

const daysLeftToPurge = deletedAt => {
  if (!deletedAt) return ''
  const d = new Date(deletedAt)
  if (Number.isNaN(d.getTime())) return ''
  const purgeAt = new Date(d.getTime() + 30 * 24 * 60 * 60 * 1000)

  const now = new Date()
  const diffMs = purgeAt.getTime() - now.getTime()
  const days = Math.ceil(diffMs / (24 * 60 * 60 * 1000))

  return days < 0 ? 0 : days
}

// ✅ etiqueta tipo
const tipoLabel = t => (t === 'VENTA' ? 'Venta' : 'Compra')

// ✅ nombre según tipo
const getNombreTercero = row => {
  if (row?.__tipo === 'VENTA') return row?.cliente ?? row?.Cliente ?? ''
  return row?.proveedor ?? row?.Proveedor ?? ''
}

export default function Papelera() {
  const { token } = useContext(AuthContext)
  const { tienePermiso } = usePermisos()

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [restoringId, setRestoringId] = useState(null)
  const [error, setError] = useState('')
  const [okMsg, setOkMsg] = useState('')

  const NoAutorizado = () => (
    <div style={{ padding: 16 }}>
      <h2 style={{ margin: 0 }}>404</h2>
      <p style={{ marginTop: 8, marginBottom: 0 }}>Intenta más tarde.</p>
    </div>
  )

  // ✅ Permisos del módulo (papelera compartida)
  const puedeEntrar = useMemo(() => {
    return tienePermiso('financiera') && tienePermiso('controlFacturas')
  }, [tienePermiso])

  const puedeVerCompras = useMemo(() => {
    return puedeEntrar && tienePermiso('factcompras')
  }, [puedeEntrar, tienePermiso])

  const puedeVerVentas = useMemo(() => {
    return puedeEntrar && tienePermiso('factventas')
  }, [puedeEntrar, tienePermiso])

  const load = async () => {
    setLoading(true)
    setError('')
    setOkMsg('')

    try {
      // ✅ Si no tiene permiso para nada, no cargamos
      if (!puedeEntrar || (!puedeVerCompras && !puedeVerVentas)) {
        setItems([])
        return
      }

      const calls = []
      if (puedeVerCompras) calls.push(listarFactCompraTrash(token))
      else calls.push(Promise.resolve([]))

      if (puedeVerVentas) calls.push(listarFactVentaTrash(token))
      else calls.push(Promise.resolve([]))

      const [resCompra, resVenta] = await Promise.all(calls)

      const rowsCompra = Array.isArray(resCompra)
        ? resCompra
        : Array.isArray(resCompra?.data)
        ? resCompra.data
        : []

      const rowsVenta = Array.isArray(resVenta)
        ? resVenta
        : Array.isArray(resVenta?.data)
        ? resVenta.data
        : []

      const taggedCompra = puedeVerCompras
        ? rowsCompra.map(r => ({ ...r, __tipo: 'COMPRA' }))
        : []

      const taggedVenta = puedeVerVentas
        ? rowsVenta.map(r => ({ ...r, __tipo: 'VENTA' }))
        : []

      const merged = [...taggedCompra, ...taggedVenta]
      merged.sort((a, b) => {
        const da = new Date(getDeletedAt(a) || 0).getTime()
        const db = new Date(getDeletedAt(b) || 0).getTime()
        return (db || 0) - (da || 0)
      })

      setItems(merged)
    } catch (e) {
      setError(
        e?.response?.data?.message ||
          e?.message ||
          'No se pudo cargar la papelera.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puedeEntrar, puedeVerCompras, puedeVerVentas])

  const onRestore = async row => {
    const internalId = getInternalId(row)
    if (!internalId) return

    // ✅ Bloqueo por tipo (seguridad extra)
    if (row?.__tipo === 'VENTA' && !puedeVerVentas) return
    if (row?.__tipo !== 'VENTA' && !puedeVerCompras) return

    setRestoringId(internalId)
    setError('')
    setOkMsg('')

    try {
      if (row?.__tipo === 'VENTA') {
        await restaurarFactVenta(internalId, token)
      } else {
        await restaurarFactCompra(internalId, token)
      }

      setItems(prev => prev.filter(x => getInternalId(x) !== internalId))
      setOkMsg('Factura restaurada correctamente.')
    } catch (e) {
      setError(
        e?.response?.data?.message ||
          e?.message ||
          'No se pudo restaurar la factura.'
      )
    } finally {
      setRestoringId(null)
    }
  }

  const rows = useMemo(() => items, [items])

  // ✅ 404 si no puede entrar o no tiene sub-permisos
  if (!puedeEntrar || (!puedeVerCompras && !puedeVerVentas)) {
    return (
      <div className='papelera-page'>
        <NoAutorizado />
      </div>
    )
  }

  return (
    <div className='papelera-page'>
      <div className='papelera-head papelera-head-center'>
        <div>
          <h2 className='papelera-title'>Papelera</h2>
          <p className='papelera-subtitle'>
            Facturas eliminadas{' '}
            {puedeVerCompras && puedeVerVentas
              ? '(compra y venta)'
              : puedeVerCompras
              ? '(solo compra)'
              : '(solo venta)'}
            . Puedes restaurarlas a la tabla principal.
          </p>
        </div>
      </div>

      {error && <div className='pap-alert pap-alert-error'>{error}</div>}
      {okMsg && <div className='pap-alert pap-alert-ok'>{okMsg}</div>}

      <div className='pap-card'>
        <div className='pap-card-head'>
          <div className='pap-chip'>
            Total en papelera: <b>{rows.length}</b>
          </div>
        </div>

        {loading ? (
          <div className='pap-loading'>
            <div className='pap-spinner' />
            <span>Cargando papelera…</span>
          </div>
        ) : rows.length === 0 ? (
          <div className='pap-empty'>
            <b>No hay facturas en papelera.</b>
            <div className='pap-empty-sub'>
              Cuando elimines una factura, aparecerá aquí.
            </div>
          </div>
        ) : (
          <div className='pap-table-wrap'>
            <table className='pap-table'>
              <thead>
                <tr>
                  <th style={{ width: 110 }}>Tipo</th>
                  <th style={{ width: 140 }}>Consecutivo</th>
                  <th>Tercero</th>
                  <th style={{ width: 160 }}>Línea</th>
                  <th style={{ width: 160 }}>Factura</th>
                  <th style={{ width: 180 }}>Valor</th>
                  <th style={{ width: 170 }}>Eliminada</th>
                  <th style={{ width: 160 }}>Días restantes</th>
                  <th style={{ width: 170, textAlign: 'right' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const internalId = getInternalId(row)
                  const disabled = restoringId === internalId

                  const consecutivo = getConsecutivo(row)
                  const tercero = getNombreTercero(row)
                  const linea = getLinea(row)
                  const factura = getFactura(row)
                  const valor = getValor(row)

                  const deletedAt = getDeletedAt(row)
                  const dias = daysLeftToPurge(deletedAt)

                  const restoreDisabledByPerm =
                    (row?.__tipo === 'VENTA' && !puedeVerVentas) ||
                    (row?.__tipo !== 'VENTA' && !puedeVerCompras)

                  return (
                    <tr
                      key={
                        internalId || `${row?.__tipo}-${consecutivo}-${factura}`
                      }
                    >
                      <td className='pap-mono'>{tipoLabel(row?.__tipo)}</td>
                      <td className='pap-mono'>
                        {safeText(consecutivo || '—')}
                      </td>
                      <td>{safeText(tercero || '—')}</td>
                      <td>{safeText(linea || '—')}</td>
                      <td className='pap-mono'>{safeText(factura || '—')}</td>
                      <td>{fmtCOP(valor)}</td>
                      <td>{fmtDate(deletedAt)}</td>
                      <td>{dias === '' ? '—' : `${dias} días`}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type='button'
                          className='pap-btn pap-btn-primary'
                          onClick={() => onRestore(row)}
                          disabled={disabled || restoreDisabledByPerm}
                          title={
                            restoreDisabledByPerm
                              ? 'No tienes permiso para restaurar este tipo.'
                              : ''
                          }
                        >
                          {disabled ? (
                            <>
                              <span className='pap-btn-spinner' />
                              Restaurando…
                            </>
                          ) : (
                            'Restaurar'
                          )}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
