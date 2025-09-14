// src/components/ControlIngresos/ReporteAsistencia/ReporteDetalleDiario.jsx
import { useEffect, useMemo, useState } from 'react'
import DataTable from 'react-data-table-component'
import { utils, writeFile } from 'xlsx'
import { getReporteDetalleDiario } from './reporte_asistencia_service'
import {
  fmtHM,
  computeHorasDiaHMS,
  computeRetrasoMin,
  computeSalidaAntesMin,
} from './asistencia_config'

const ReporteDetalleDiario = ({ filtros = {} }) => {
  const { from = '', to = '', toleranciaRetrasoMin = 0 } = filtros || {}

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // UI: búsqueda local (documento / nombre / fecha)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await getReporteDetalleDiario({
          from,
          to,
          toleranciaRetrasoMin,
        })

        // 🔁 Normalización y cálculo con 07:30 / 17:30 / almuerzo 13–14
        const computed = (Array.isArray(data) ? data : []).map(d => {
          const entradaIso = d?.entrada || null
          const salidaIso = d?.salida || null

          const horasDiaHMS = computeHorasDiaHMS(entradaIso, salidaIso)
          const retrasoMin = computeRetrasoMin(entradaIso, toleranciaRetrasoMin)
          const salidaAntesMin = computeSalidaAntesMin(salidaIso)

          return {
            ...d,
            id: `${d?.persona?.documento}-${d?.fecha}`,
            nombre: `${d?.persona?.nombres || ''} ${
              d?.persona?.apellidos || ''
            }`.trim(),
            entradaHM: d?.entrada ? fmtHM(d.entrada) : '',
            salidaHM: d?.salida ? fmtHM(d.salida) : '',
            horasDiaHMS,
            retrasoMin,
            salidaAntesMin,
          }
        })

        setRows(computed)
      } catch (err) {
        console.error(err)
        setError('No se pudo cargar el detalle diario.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [from, to, toleranciaRetrasoMin])

  // Filtrado local por buscador
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(r => {
      const doc = String(r?.persona?.documento || '').toLowerCase()
      const nom = String(r?.nombre || '').toLowerCase()
      const fec = String(r?.fecha || '').toLowerCase()
      return doc.includes(q) || nom.includes(q) || fec.includes(q)
    })
  }, [rows, search])

  // Exportar a Excel (usa lo filtrado que ves en pantalla)
  const exportar = () => {
    const wb = utils.book_new()
    const ws = utils.json_to_sheet(
      filtered.map(d => ({
        Fecha: d.fecha,
        Documento: d.persona.documento,
        Nombre: d.nombre,
        Entrada: d.entradaHM,
        Salida: d.salidaHM,
        'Horas día (HH:MM:SS)': d.horasDiaHMS,
        'Retraso (min)': d.retrasoMin,
        'Salida antes (min)': d.salidaAntesMin,
        Novedad: d.novedad,
      }))
    )
    utils.book_append_sheet(wb, ws, 'Detalle')
    writeFile(
      wb,
      `Detalle_Asistencia_${from || 'inicio'}_a_${to || 'fin'}.xlsx`
    )
  }

  // Encabezados multilínea
  const HeaderTwoLines = ({ top, bottom, align = 'center' }) => (
    <div
      className={`d-flex flex-column ${
        align === 'right'
          ? 'text-end'
          : align === 'left'
          ? 'text-start'
          : 'text-center'
      }`}
    >
      <span>{top}</span>
      <small className='text-muted'>{bottom}</small>
    </div>
  )

  // Columnas DataTable
  const columns = useMemo(
    () => [
      {
        name: 'Fecha',
        selector: row => row.fecha,
        sortable: true,
        width: '110px',
      },
      {
        name: 'Documento',
        selector: row => row?.persona?.documento || '',
        sortable: true,
        width: '130px',
      },
      {
        name: 'Nombre',
        selector: row => row.nombre,
        sortable: true,
        grow: 4,
        wrap: true,
      },
      {
        name: <HeaderTwoLines top='Entrada' bottom='(HH:MM)' />,
        selector: row => row.entradaHM,
        sortable: true,
        width: '100px',
        cell: row => <span className='text-start'>{row.entradaHM}</span>,
      },
      {
        name: <HeaderTwoLines top='Salida' bottom='(HH:MM)' />,
        selector: row => row.salidaHM,
        sortable: true,
        width: '100px',
        cell: row => <span className='text-start'>{row.salidaHM}</span>,
      },
      {
        name: <HeaderTwoLines top='Horas día' bottom='(HH:MM:SS)' />,
        selector: row => row.horasDiaHMS,
        sortable: true,
        width: '130px',
        cell: row => <span className='text-start'>{row.horasDiaHMS}</span>,
      },
      {
        name: <HeaderTwoLines top='Retraso' bottom='(min)' />, // 👈 multilínea
        selector: row => row.retrasoMin,
        sortable: true,
        width: '95px',
        cell: row => (
          <span
            className={`text-start ${
              row.retrasoMin > 0 ? 'text-danger fw-semibold' : ''
            }`}
          >
            {row.retrasoMin}
          </span>
        ),
      },
      {
        name: <HeaderTwoLines top='Salida antes' bottom='(min)' />, // 👈 multilínea
        selector: row => row.salidaAntesMin,
        sortable: true,
        width: '110px',
        cell: row => (
          <span
            className={`text-start ${
              row.salidaAntesMin > 0 ? 'text-warning fw-semibold' : ''
            }`}
          >
            {row.salidaAntesMin}
          </span>
        ),
      },
      {
        name: 'Novedad',
        selector: row => row.novedad,
        sortable: true,
        width: '130px',
        cell: row => {
          const text = row.novedad || ''
          const badgeClass =
            text === 'A tiempo'
              ? 'text-bg-success'
              : text === 'Falta entrada/salida'
              ? 'text-bg-secondary'
              : 'text-bg-danger'
          return <span className={`badge ${badgeClass}`}>{text}</span>
        },
      },
    ],
    []
  )

  // Estilos DataTable: permitir wrap en encabezados (no cortar títulos)
  const customStyles = {
    headCells: {
      style: {
        fontWeight: 600,
        whiteSpace: 'normal', // 👈 permite multilínea
        lineHeight: '1.1',
        paddingTop: '0.75rem',
        paddingBottom: '0.75rem',
      },
    },
    rows: { style: { minHeight: '44px' } },
  }

  // SubHeader: buscador + export
  const SubHeader = (
    <div className='d-flex flex-wrap gap-2 w-100'>
      <div className='input-group' style={{ maxWidth: 360 }}>
        <span className='input-group-text'>Buscar</span>
        <input
          type='text'
          className='form-control'
          placeholder='Documento, nombre o fecha…'
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className='ms-auto'>
        <button
          className='btn btn-sm btn-success'
          onClick={exportar}
          disabled={loading || filtered.length === 0}
        >
          Exportar Excel
        </button>
      </div>
    </div>
  )

  return (
    <div className='card'>
      <div className='card-header d-flex align-items-center'>
        <strong>Detalle diario</strong>
      </div>

      <div className='card-body'>
        {error && <div className='alert alert-danger py-2 mb-2'>{error}</div>}

        <DataTable
          columns={columns}
          data={filtered}
          progressPending={loading}
          pagination
          paginationPerPage={30} // 👈 mínimo 30 filas por “hoja”
          paginationRowsPerPageOptions={[30, 50, 100]} // 👈 opciones
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
    </div>
  )
}

export default ReporteDetalleDiario
