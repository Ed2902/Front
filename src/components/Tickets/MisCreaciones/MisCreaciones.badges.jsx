// MisCreaciones.badges.jsx
import React from 'react'
import {
  getAsignacionScope,
  getContrastingTextColor,
  normalizeHex,
  personaLabel,
} from './MisCreaciones.utils.js'

export const Ell = ({ children, title, maxWidth = '100%' }) => (
  <span
    title={title}
    style={{
      display: 'inline-block',
      maxWidth,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      verticalAlign: 'middle',
    }}
  >
    {children}
  </span>
)

export const CatalogBadge = ({ item, fallback = '—', maxW = 110 }) => {
  const label =
    item?.name ||
    item?.name_norm ||
    item?.nombre ||
    item?.nombre_norm ||
    fallback

  const bg = normalizeHex(item?.color)
  const style = bg
    ? {
        background: bg,
        color: getContrastingTextColor(bg),
        border: '1px solid rgba(0,0,0,.15)',
      }
    : {}

  return (
    <span
      className={bg ? 'badge' : 'badge bg-light text-dark'}
      title={label}
      style={{
        ...style,
        borderRadius: 10,
        padding: '0.20rem 0.45rem',
        fontWeight: 800,
        fontSize: 12,
        display: 'inline-flex',
        alignItems: 'center',
        maxWidth: maxW,
      }}
    >
      <Ell title={label} maxWidth={Math.max(40, maxW - 18)}>
        {label}
      </Ell>
    </span>
  )
}

const orgBadgeStyle = orgId => {
  const org = String(orgId || '')
    .trim()
    .toLowerCase()

  if (org === 'fastwaysas')
    return {
      background: '#FFE3C2',
      color: '#7A3E00',
      border: '1px solid #FFD2A3',
    }

  if (org === 'greemway' || org === 'greenway')
    return {
      background: '#CFF7F3',
      color: '#075B57',
      border: '1px solid #AEEDE6',
    }

  if (org === 'metalharvest')
    return {
      background: '#DFF5D8',
      color: '#1F5A1A',
      border: '1px solid #C9EDBF',
    }

  return { background: '#EFEFEF', color: '#333', border: '1px solid #E2E2E2' }
}

export const OrgBadge = ({ orgId, maxW = 110 }) => (
  <span
    className='badge'
    style={{
      ...orgBadgeStyle(orgId),
      fontWeight: 800,
      borderRadius: 10,
      padding: '0.20rem 0.45rem',
      fontSize: 12,
      display: 'inline-flex',
      alignItems: 'center',
      maxWidth: maxW,
    }}
    title={orgId || '—'}
  >
    <Ell title={orgId || '—'} maxWidth={Math.max(40, maxW - 18)}>
      {orgId || '—'}
    </Ell>
  </span>
)

export const AsigBadge = ({ ticket }) => {
  const s = getAsignacionScope(ticket)
  return (
    <div className='w-100 d-flex justify-content-center'>
      <span
        className={s.cls}
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

export const CreatorName = ({ ticket, maps }) => {
  const personalMap = maps?.personalMap || {}
  const creadorId = ticket?.creado_por
  if (!creadorId) return <span className='text-muted'>—</span>
  const info = personaLabel(creadorId, personalMap)
  return (
    <div
      className='w-100 d-flex justify-content-center'
      style={{ minWidth: 0 }}
    >
      <div
        className='d-flex flex-column align-items-center'
        style={{ minWidth: 0, textAlign: 'center' }}
        title={info.raw}
      >
        <Ell title={info.title} maxWidth={160}>
          <span className='fw-semibold'>{info.title}</span>
        </Ell>
      </div>
    </div>
  )
}
