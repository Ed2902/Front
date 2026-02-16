// MisCreaciones.columns.jsx
import React from 'react'
import {
  fmtDate,
  getAsignacionScope,
  getEstadoItemDesdeHistorial,
  getUltimoHist,
  oidToString,
  personaLabel,
} from './MisCreaciones.utils.js'
import { CatalogBadge, OrgBadge, Ell } from './MisCreaciones.badges.jsx'

// ✅ Último movimiento (como MisTareas)
const getLastMoveIso = ticket => {
  const last = getUltimoHist(ticket)
  const iso = last?.changedAt ? String(last.changedAt) : ''
  return iso || ticket?.updatedAt || ticket?.createdAt || ''
}

const AsigBadge = ({ ticket }) => {
  const s = getAsignacionScope(ticket)
  return (
    <div className='w-100 d-flex justify-content-center'>
      <span
        className={s.cls}
        title={s.detail || ''}
        style={{
          fontSize: 12,
          fontWeight: 900,
          borderRadius: 10,
          padding: '0.20rem 0.45rem',
          display: 'inline-flex',
          alignItems: 'center',
        }}
      >
        {s.label}
      </span>
    </div>
  )
}

const CreatorName = ({ ticket, maps }) => {
  const personalMap = maps?.personalMap || {}
  const creadorId = ticket?.creado_por || ticket?.createdBy
  if (!creadorId) return <span className='text-muted'>—</span>

  const info = personaLabel(creadorId, personalMap)

  return (
    <div
      className='w-100 d-flex justify-content-center'
      style={{ minWidth: 0 }}
      title={info.title}
    >
      <div style={{ maxWidth: '100%', minWidth: 0, textAlign: 'center' }}>
        <span
          className='fw-semibold'
          style={{
            display: 'block',
            maxWidth: '100%',
            minWidth: 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {info.title}
        </span>
      </div>
    </div>
  )
}

export const tableStyles = {
  table: { style: { width: '100%' } },
  headRow: { style: { minHeight: '34px' } },
  headCells: {
    style: {
      fontWeight: 700,
      fontSize: '12px',
      paddingTop: '6px',
      paddingBottom: '6px',
      paddingLeft: '8px',
      paddingRight: '8px',
      whiteSpace: 'nowrap',
    },
  },
  rows: { style: { minHeight: '38px' } },
  cells: {
    style: {
      fontSize: '12px',
      paddingTop: '6px',
      paddingBottom: '6px',
      paddingLeft: '8px',
      paddingRight: '8px',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
  },
}

export const buildColumns = ({ maps }) => {
  const ellipsis = (text, title) => (
    <Ell title={title || text} maxWidth='100%'>
      {text || '—'}
    </Ell>
  )

  return [
    {
      id: 'code',
      name: 'Code',
      selector: r => r.code,
      sortable: true,
      width: '76px',
      cell: r => ellipsis(r.code, r.code),
    },

    // ✅ este id=1 lo dejas para defaultSortFieldId={1}
    {
      id: 1,
      name: 'Últ. mov.',
      sortable: true,
      width: '120px',
      selector: r => getLastMoveIso(r) || '',
      cell: r => (
        <span className='text-muted' style={{ fontSize: 12 }}>
          {fmtDate(getLastMoveIso(r))}
        </span>
      ),
    },

    {
      id: 'org',
      name: 'Org',
      selector: r => r.orgId,
      sortable: true,
      width: '115px',
      cell: r => <OrgBadge orgId={r.orgId} maxW={120} />,
    },

    {
      id: 'asig',
      name: 'Asig.',
      sortable: true,
      width: '82px',
      center: true,
      selector: r => getAsignacionScope(r).key,
      cell: r => <AsigBadge ticket={r} />,
    },

    {
      id: 'creador',
      name: 'Creador',
      sortable: true,
      width: '100px',
      center: true,
      selector: r => String(r?.creado_por || r?.createdBy || ''),
      cell: r => <CreatorName ticket={r} maps={maps} />,
    },

    {
      id: 'titulo',
      name: 'Título',
      selector: r => r.titulo,
      sortable: true,
      grow: 2,
      minWidth: '260px',
      cell: r => (
        <div
          title={r.titulo || '—'}
          style={{
            whiteSpace: 'normal',
            lineHeight: 1.2,
            maxWidth: 560,
          }}
        >
          {r.titulo || '—'}
        </div>
      ),
    },

    {
      id: 'tipo',
      name: 'Tipo',
      selector: r => String(r.tipo || ''),
      sortable: true,
      width: '100px',
      cell: r => ellipsis(r.tipo, r.tipo),
    },

    {
      id: 'estado',
      name: 'Estado',
      sortable: true,
      width: '120px',
      selector: r => {
        const item = getEstadoItemDesdeHistorial(r, maps?.estadosMap || {})
        return (
          item?.name ||
          item?.name_norm ||
          item?.nombre ||
          item?.nombre_norm ||
          '—'
        )
      },
      cell: r => {
        const item = getEstadoItemDesdeHistorial(r, maps?.estadosMap || {})
        return <CatalogBadge item={item} fallback='—' maxW={110} />
      },
    },

    {
      id: 'pri',
      name: 'Pri.',
      sortable: true,
      width: '110px',
      selector: r => {
        const id = oidToString(r?.prioridad_id)
        return maps?.prioridadesMap?.[id]?.name || '—'
      },
      cell: r => {
        const id = oidToString(r?.prioridad_id)
        return (
          <CatalogBadge
            item={maps?.prioridadesMap?.[id] || null}
            fallback='—'
            maxW={100}
          />
        )
      },
    },

    {
      id: 'cat',
      name: 'Cat.',
      sortable: true,
      width: '130px',
      selector: r => {
        const id = oidToString(r?.categoria_id)
        return maps?.categoriasMap?.[id]?.name || '—'
      },
      cell: r => {
        const id = oidToString(r?.categoria_id)
        return (
          <CatalogBadge
            item={maps?.categoriasMap?.[id] || null}
            fallback='—'
            maxW={120}
          />
        )
      },
    },
  ]
}
