import { useEffect, useMemo, useState } from 'react'
import DataTable from 'react-data-table-component'
import { usePermisos } from '../../../hooks/usePermisos'
import { getLoteProductosByLote } from '../service.Financiera'
import './DetalleLoteFinanciero.css'

const numberCO = (n, d = 2) =>
  (Number(n) || 0).toLocaleString('es-CO', {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  })

const moneyCO = n =>
  (Number(n) || 0).toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })

export default function DetalleLoteFinanciero({ idLote }) {
  const { tienePermiso } = usePermisos()
  const canViewPrices = tienePermiso('verPreciosFinanciera')

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await getLoteProductosByLote(idLote)
        if (!cancelled) setItems(Array.isArray(data) ? data : [])
      } catch (e) {
        console.error(e)
        if (!cancelled) setError('No se pudo cargar el detalle del lote.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    if (idLote) load()
    return () => {
      cancelled = true
    }
  }, [idLote])

  const totalValor = useMemo(
    () =>
      canViewPrices
        ? items.reduce(
            (s, it) =>
              s + (Number(it.valor_unitario) || 0) * (Number(it.Cantidad) || 0),
            0
          )
        : 0,
    [items, canViewPrices]
  )

  const columns = useMemo(() => {
    const baseCols = [
      {
        name: 'Código',
        selector: r => r.id_producto,
        sortable: true,
        width: '120px',
      },
      {
        name: 'Nombre',
        selector: r => r.Producto?.Nombre ?? r.id_producto ?? '—',
        sortable: true,
        width: '200px',
      },
      {
        name: 'Proveedor',
        selector: r => r.ProveedorNombre ?? '—',
        sortable: true,
        width: '120px',
      },
      {
        name: 'Cant.',
        selector: r => r.Cantidad,
        sortable: true,
        right: true,
        width: '100px',
        cell: r => <span className='text-end'>{numberCO(r.Cantidad, 2)}</span>,
      },
      {
        name: 'Peso unit. (kg)',
        selector: r => r.PesoUnitarioKg ?? null,
        sortable: true,
        right: true,
        width: '120px',
        cell: r =>
          r.PesoUnitarioKg != null ? (
            <span className='text-end'>{numberCO(r.PesoUnitarioKg, 2)}</span>
          ) : (
            <span className='text-muted'>—</span>
          ),
      },
    ]

    // Agregar columnas de precios solo si tiene permiso
    if (canViewPrices) {
      baseCols.push(
        {
          name: 'Vlr unit.',
          selector: r => r.valor_unitario,
          sortable: true,
          right: true,
          width: '140px',
          cell: r => (
            <span className='text-end'>{moneyCO(r.valor_unitario)}</span>
          ),
        },
        {
          name: 'Subtotal',
          selector: r =>
            (Number(r.valor_unitario) || 0) * (Number(r.Cantidad) || 0),
          sortable: true,
          right: true,
          width: '160px',
          cell: r => (
            <span className='fw-semibold text-end'>
              {moneyCO(
                (Number(r.valor_unitario) || 0) * (Number(r.Cantidad) || 0)
              )}
            </span>
          ),
        }
      )
    }

    baseCols.push({
      name: 'Fecha',
      selector: r =>
        r.Fecha_registro
          ? new Date(r.Fecha_registro).toLocaleString('es-CO')
          : '—',
      sortable: true,
      width: '180px',
    })

    return baseCols
  }, [canViewPrices])

  const styles = {
    headCells: { style: { fontWeight: 600 } },
    rows: { style: { minHeight: '40px' } },
  }

  return (
    <div className='detalle-financiera'>
      <div className='text-muted small d-flex align-items-center gap-2 me-2'>
        <div>
          <strong>Detalle Lote:</strong>{' '}
          <span className='badge bg-light text-dark'>{idLote}</span>
        </div>
        {canViewPrices && (
          <div className='text-muted small d-flex align-items-center gap-2'>
            <span>
              <strong>Total:</strong> {moneyCO(totalValor)}
            </span>
            {loading && (
              <span
                className='spinner-border spinner-border-sm text-secondary'
                role='status'
                aria-hidden='true'
              />
            )}
          </div>
        )}
      </div>

      {error && <div className='alert alert-danger py-2 mb-2'>{error}</div>}

      <div className='detalle-financiera-scroll'>
        <DataTable
          columns={columns}
          data={items}
          dense
          responsive
          highlightOnHover
          noHeader
          customStyles={styles}
          pagination
          paginationPerPage={10}
          paginationRowsPerPageOptions={[10, 20, 50]}
          progressPending={loading}
          progressComponent={<div className='py-3 text-center'>Cargando…</div>}
        />
      </div>
    </div>
  )
}
