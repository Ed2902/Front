// MisTareas.badges.jsx
import { getContrastingTextColor, normalizeHex } from './MisTareas.utils'

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

// org rules
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

// tipo badge
const tipoBadgeStyle = tipo => {
  const t = String(tipo || '')
    .trim()
    .toLowerCase()

  if (t === 'operacion')
    return {
      background: '#E0F2FE',
      border: '1px solid #BAE6FD',
      color: '#075985',
    }
  if (t === 'proyecto')
    return {
      background: '#EDE9FE',
      border: '1px solid #DDD6FE',
      color: '#5B21B6',
    }

  return {
    background: '#ECFDF5',
    border: '1px solid #BBF7D0',
    color: '#166534',
  }
}

export const TipoBadge = ({ tipo }) => (
  <span
    className='badge'
    style={{
      ...tipoBadgeStyle(tipo),
      fontWeight: 900,
      borderRadius: 10,
      padding: '0.20rem 0.45rem',
      fontSize: 12,
      display: 'inline-flex',
      alignItems: 'center',
    }}
    title={tipo || '—'}
  >
    {tipo || '—'}
  </span>
)
