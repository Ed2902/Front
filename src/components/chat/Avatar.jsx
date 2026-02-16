import useProtectedBlobUrl from './useProtectedBlobUrl'
import { buildPhotoUrl } from './chatApi'

function initials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!parts.length) return 'C'
  const a = parts[0]?.[0] || 'C'
  const b = parts[1]?.[0] || ''
  return (a + b).toUpperCase()
}

export default function Avatar({ ruta_foto, name, size = 42, token }) {
  const raw = ruta_foto ? buildPhotoUrl(ruta_foto) : ''
  const blobSrc = useProtectedBlobUrl({ url: raw, token, enabled: !!raw })

  if (blobSrc) {
    return (
      <img
        src={blobSrc}
        alt={name}
        style={{
          width: size,
          height: size,
          borderRadius: 999,
          objectFit: 'cover',
          flexShrink: 0,
        }}
      />
    )
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: 'rgba(0,0,0,0.06)',
        display: 'grid',
        placeItems: 'center',
        fontWeight: 900,
        color: 'rgba(0,0,0,0.55)',
        flexShrink: 0,
      }}
    >
      {initials(name)}
    </div>
  )
}
