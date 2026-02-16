import useProtectedBlobUrl from './useProtectedBlobUrl'
import { buildAbsoluteUrl } from './chatApi'

export default function AttachmentView({ att, token, mine }) {
  const rawUrl = buildAbsoluteUrl(att?.url)
  const name = att?.name || att?.fileId || 'Archivo'
  const mime = String(att?.mime || '')
  const lower = String(name || '').toLowerCase()

  const isAudio =
    mime.startsWith('audio/') ||
    lower.endsWith('.webm') ||
    lower.endsWith('.mp3') ||
    lower.endsWith('.wav')

  const isImage =
    mime.startsWith('image/') ||
    lower.endsWith('.png') ||
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.webp')

  const blobUrl = useProtectedBlobUrl({ url: rawUrl, token, enabled: !!rawUrl })

  const textClass = mine ? 'text-white' : 'text-muted'

  if (isAudio) {
    return (
      <div>
        <div className={`small fw-bold ${mine ? 'text-white' : ''}`}>
          🎧 {name}
        </div>
        {blobUrl ? (
          <audio controls src={blobUrl} className='w-100' />
        ) : (
          <div className={`small ${textClass}`}>Cargando audio…</div>
        )}
      </div>
    )
  }

  if (isImage) {
    return blobUrl ? (
      <a href={blobUrl} target='_blank' rel='noreferrer'>
        <img
          src={blobUrl}
          alt={name}
          className='img-fluid rounded'
          style={{ maxWidth: 240 }}
        />
      </a>
    ) : (
      <div className={`small ${textClass}`}>Cargando imagen…</div>
    )
  }

  return blobUrl ? (
    <a
      href={blobUrl}
      target='_blank'
      rel='noreferrer'
      className={`small fw-bold ${mine ? 'text-white' : ''}`}
    >
      📎 {name}
    </a>
  ) : (
    <div className={`small ${textClass}`}>Cargando archivo…</div>
  )
}
