import { useEffect, useRef, useState } from 'react'
import useProtectedBlobUrl from './useProtectedBlobUrl'
import { buildAbsoluteUrl } from './chatApi'

const addQueryParam = (url, key, value) => {
  const rawUrl = String(url || '').trim()
  const rawValue = String(value || '').trim()
  if (!rawUrl || !rawValue) return rawUrl

  const sep = rawUrl.includes('?') ? '&' : '?'
  return `${rawUrl}${sep}${encodeURIComponent(key)}=${encodeURIComponent(rawValue)}`
}

export default function AttachmentView({ att, token, mine, myId }) {
  const rawUrl = buildAbsoluteUrl(att?.url)
  const protectedUrl = addQueryParam(rawUrl, 'id_personal', myId)
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

  const isGeneratedAudioName = /^audio-\d+\.(mp3|wav|webm|ogg)$/i.test(lower)

  const blobUrl = useProtectedBlobUrl({
    url: protectedUrl,
    token,
    enabled: !!protectedUrl,
  })

  const textClass = mine ? 'text-dark' : 'text-muted'
  const attachmentBoxStyle = {
    background: mine ? 'rgba(255,255,255,0.55)' : '#f7f7f7',
    border: `1px solid ${mine ? 'rgba(0,0,0,0.08)' : '#e7e7e7'}`,
    borderRadius: 12,
    padding: 8,
  }

  if (isAudio) {
    return (
      <div style={{ ...attachmentBoxStyle, borderRadius: 14, padding: 6 }}>
        {blobUrl ? (
          <AudioInlinePlayer src={blobUrl} mine={mine} />
        ) : (
          <div className={`small ${textClass}`}>Cargando audio…</div>
        )}
      </div>
    )
  }

  if (isImage) {
    return blobUrl ? (
      <a
        href={blobUrl}
        target='_blank'
        rel='noreferrer'
        style={{ display: 'block' }}
      >
        <img
          src={blobUrl}
          alt={name}
          className='img-fluid rounded'
          style={{
            maxWidth: 240,
            borderRadius: 12,
            border: '1px solid rgba(0,0,0,0.08)',
          }}
        />
      </a>
    ) : (
      <div className={`small ${textClass}`}>Cargando imagen…</div>
    )
  }

  return blobUrl ? (
    <div style={attachmentBoxStyle}>
      <a
        href={blobUrl}
        target='_blank'
        rel='noreferrer'
        className={`small fw-bold ${mine ? 'text-dark' : ''}`}
        style={{ textDecoration: 'none' }}
      >
        📎 {name}
      </a>
    </div>
  ) : (
    <div className={`small ${textClass}`}>Cargando archivo…</div>
  )
}

function AudioInlinePlayer({ src, mine }) {
  const audioRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onLoaded = () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
    }
    const onTimeUpdate = () => {
      setCurrentTime(Number.isFinite(audio.currentTime) ? audio.currentTime : 0)
    }
    const onEnded = () => {
      setIsPlaying(false)
    }

    audio.addEventListener('loadedmetadata', onLoaded)
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('ended', onEnded)

    return () => {
      audio.removeEventListener('loadedmetadata', onLoaded)
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('ended', onEnded)
    }
  }, [])

  const togglePlay = async () => {
    const audio = audioRef.current
    if (!audio) return
    try {
      if (isPlaying) {
        audio.pause()
        setIsPlaying(false)
      } else {
        await audio.play()
        setIsPlaying(true)
      }
    } catch {}
  }

  const onSeek = e => {
    const audio = audioRef.current
    if (!audio) return
    const next = Number(e.target.value)
    audio.currentTime = Number.isFinite(next) ? next : 0
    setCurrentTime(audio.currentTime)
  }

  const fmt = total => {
    const s = Math.max(0, Math.floor(Number(total) || 0))
    const mm = String(Math.floor(s / 60)).padStart(2, '0')
    const ss = String(s % 60).padStart(2, '0')
    return `${mm}:${ss}`
  }

  const max = duration > 0 ? duration : 1

  return (
    <div>
      <audio ref={audioRef} src={src} preload='metadata' />

      <div className='d-flex align-items-center gap-2'>
        <button
          type='button'
          onClick={togglePlay}
          style={{
            border: 'none',
            width: 30,
            height: 30,
            borderRadius: 999,
            background: mine ? '#79b9ff' : '#ffbe8a',
            color: mine ? '#0f2a43' : '#5a2f00',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
          aria-label={isPlaying ? 'Pausar audio' : 'Reproducir audio'}
          title={isPlaying ? 'Pausar' : 'Reproducir'}
        >
          {isPlaying ? '❚❚' : '▶'}
        </button>

        <div style={{ minWidth: 0, flex: 1 }}>
          <input
            type='range'
            min='0'
            max={max}
            step='0.1'
            value={Math.min(currentTime, max)}
            onChange={onSeek}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      <div
        className='small'
        style={{
          marginTop: 2,
          display: 'flex',
          justifyContent: 'flex-end',
          color: '#5f6b75',
          fontSize: 11,
        }}
      >
        {fmt(duration)}
      </div>
    </div>
  )
}
