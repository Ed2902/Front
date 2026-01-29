import { useEffect, useMemo, useRef, useState } from 'react'
import { io as ioClient } from 'socket.io-client'
import {
  FILES_ORIGIN,
  buildPersonaMap,
  fetchChats,
  fetchMessages,
  fetchPersonas,
  formatRelativeDate,
  getChatDisplay,
  markRead,
  sendMessage,
  uploadChatFiles,
} from './chatApi'

import Avatar from './Avatar'
import AttachmentView from './AttachmentView'
import NewChat from './NewChat'

export default function ChatPanel({ token, myId, myPersonal, onClose }) {
  const myName =
    `${myPersonal?.nombre || ''} ${myPersonal?.apellido || ''}`.trim()

  const [tab, setTab] = useState('free')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [personas, setPersonas] = useState([])
  const [chats, setChats] = useState([])

  const [activeChat, setActiveChat] = useState(null)
  const [messages, setMessages] = useState([])
  const [msgLoading, setMsgLoading] = useState(false)
  const [msgError, setMsgError] = useState('')

  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  const [typingUsers, setTypingUsers] = useState(new Set())
  const [readMap, setReadMap] = useState({})

  const personaMap = useMemo(() => buildPersonaMap(personas), [personas])

  const socketRef = useRef(null)
  const typingTimerRef = useRef(null)
  const activeChatRef = useRef(null)

  useEffect(() => {
    activeChatRef.current = activeChat
  }, [activeChat])

  const refreshInbox = async (showLoading = true) => {
    if (!token || !myId) return
    if (showLoading) {
      setLoading(true)
      setError('')
    }

    try {
      const [p, c] = await Promise.all([
        fetchPersonas({ token }),
        fetchChats({
          token,
          id_personal: myId,
          page: 1,
          limit: 100,
          contextType:
            tab === 'ticket' ? 'ticket' : tab === 'free' ? 'free' : undefined,
        }),
      ])

      setPersonas(p || [])
      setChats(c?.items || [])
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Error cargando chats')
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  const ensureSocket = () => {
    if (socketRef.current) return socketRef.current

    const s = ioClient(FILES_ORIGIN, {
      transports: ['websocket'],
      withCredentials: true,
      auth: { token },
    })

    const onIncomingMessage = payload => {
      const chatId = String(payload?.chatId || '')
      const m = payload?.message
      if (!chatId || !m?._id) return

      const currentChat = activeChatRef.current
      if (currentChat && String(currentChat._id) === chatId) {
        setMessages(prev => {
          const exists = prev.some(x => String(x._id) === String(m._id))
          if (exists) return prev
          return [...prev, m]
        })

        s.emit('chat:read', { chatId })
        setReadMap(prev => ({
          ...prev,
          [String(myId)]: new Date().toISOString(),
        }))
      }

      refreshInbox(false)
    }

    s.on('chat:message:new', onIncomingMessage)
    s.on('message:new', onIncomingMessage)

    s.on('chat:typing:start', ({ chatId, id_personal }) => {
      const currentChat = activeChatRef.current
      if (!currentChat || String(currentChat._id) !== String(chatId)) return
      const pid = String(id_personal || '')
      if (!pid || pid === String(myId)) return
      setTypingUsers(prev => new Set([...prev, pid]))
    })

    s.on('chat:typing:stop', ({ chatId, id_personal }) => {
      const currentChat = activeChatRef.current
      if (!currentChat || String(currentChat._id) !== String(chatId)) return
      const pid = String(id_personal || '')
      if (!pid || pid === String(myId)) return
      setTypingUsers(prev => {
        const n = new Set(prev)
        n.delete(pid)
        return n
      })
    })

    s.on('chat:read:update', ({ chatId, id_personal, lastReadAt }) => {
      const currentChat = activeChatRef.current
      if (!currentChat || String(currentChat._id) !== String(chatId)) return
      const pid = String(id_personal || '')
      if (!pid || !lastReadAt) return
      setReadMap(prev => ({ ...prev, [pid]: lastReadAt }))
    })

    socketRef.current = s
    return s
  }

  useEffect(() => {
    ensureSocket()
    refreshInbox(true)
    return () => {
      clearTimeout(typingTimerRef.current)
      try {
        socketRef.current?.disconnect()
      } catch {}
      socketRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    refreshInbox(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  const openChat = async chat => {
    setActiveChat(chat)
    setMessages([])
    setTypingUsers(new Set())
    setReadMap({})
    setMsgError('')
    setDraft('')
    setMsgLoading(true)

    const s = ensureSocket()

    try {
      s.emit('chat:join', { chatId: String(chat._id) })

      const r = await fetchMessages({
        token,
        chatId: chat._id,
        id_personal: myId,
        page: 1,
        limit: 80,
      })

      setMessages((r?.items || []).slice().reverse())

      await markRead({ token, chatId: chat._id, id_personal: myId })
      s.emit('chat:read', { chatId: String(chat._id) })

      refreshInbox(false)
    } catch (e) {
      setMsgError(
        e?.response?.data?.error || e?.message || 'Error cargando mensajes'
      )
    } finally {
      setMsgLoading(false)
    }
  }

  const emitTyping = on => {
    if (!activeChat) return
    const s = ensureSocket()
    s.emit(on ? 'chat:typing:start' : 'chat:typing:stop', {
      chatId: String(activeChat._id),
    })
  }

  const onDraftChange = v => {
    setDraft(v)
    emitTyping(true)
    clearTimeout(typingTimerRef.current)
    typingTimerRef.current = setTimeout(() => emitTyping(false), 900)
  }

  const isReadBySomeoneElse = msg => {
    if (!activeChat) return false
    if (String(msg?.sender_id_personal) !== String(myId)) return false
    const at = new Date(msg?.createdAt || msg?.created_at || 0).getTime()
    if (!at) return false

    const others = (activeChat.participants || []).filter(
      p => String(p) !== String(myId)
    )
    for (const oid of others) {
      const lr = readMap[String(oid)]
      if (!lr) continue
      const t = new Date(lr).getTime()
      if (t && t >= at) return true
    }
    return false
  }

  const upsertMessage = msg => {
    if (!msg?._id) return
    setMessages(prev => {
      const exists = prev.some(x => String(x._id) === String(msg._id))
      if (exists) return prev
      return [...prev, msg]
    })
  }

  const sendTextOnly = async () => {
    const text = String(draft || '').trim()
    if (!text || !activeChat) return

    setSending(true)
    setDraft('')
    setMsgError('')

    try {
      const m = await sendMessage({
        token,
        chatId: activeChat._id,
        id_personal: myId,
        text,
        attachments: [],
      })

      const msg = m?.message || m?.item || m
      upsertMessage(msg)

      emitTyping(false)
      refreshInbox(false)
    } catch (e) {
      setMsgError(e?.response?.data?.error || e?.message || 'No se pudo enviar')
    } finally {
      setSending(false)
    }
  }

  const fileInputRef = useRef(null)
  const pickFiles = () => fileInputRef.current?.click()

  const onFilesSelected = async e => {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (!files.length || !activeChat) return

    setSending(true)
    setMsgError('')
    try {
      const uploaded = await uploadChatFiles({
        token,
        chatId: activeChat._id,
        id_personal: myId,
        files,
      })

      const m = await sendMessage({
        token,
        chatId: activeChat._id,
        id_personal: myId,
        text: '',
        attachments: uploaded,
      })

      const msg = m?.message || m?.item || m
      upsertMessage(msg)

      refreshInbox(false)
    } catch (err) {
      setMsgError(
        err?.response?.data?.error || err?.message || 'No se pudo adjuntar'
      )
    } finally {
      setSending(false)
    }
  }

  const [recording, setRecording] = useState(false)
  const mediaRecorderRef = useRef(null)
  const recordedChunksRef = useRef([])

  const startRecording = async () => {
    if (recording || !activeChat) return
    setMsgError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      recordedChunksRef.current = []

      mr.ondataavailable = ev => {
        if (ev.data && ev.data.size > 0) recordedChunksRef.current.push(ev.data)
      }

      mr.onstop = async () => {
        try {
          const blob = new Blob(recordedChunksRef.current, {
            type: 'audio/webm',
          })
          const file = new File([blob], `audio-${Date.now()}.webm`, {
            type: 'audio/webm',
          })

          setSending(true)
          const uploaded = await uploadChatFiles({
            token,
            chatId: activeChat._id,
            id_personal: myId,
            files: [file],
          })

          const m = await sendMessage({
            token,
            chatId: activeChat._id,
            id_personal: myId,
            text: '',
            attachments: uploaded,
          })

          const msg = m?.message || m?.item || m
          upsertMessage(msg)

          refreshInbox(false)
        } catch (err) {
          setMsgError(
            err?.response?.data?.error ||
              err?.message ||
              'No se pudo enviar audio'
          )
        } finally {
          setSending(false)
        }

        try {
          stream.getTracks().forEach(t => t.stop())
        } catch {}
      }

      mediaRecorderRef.current = mr
      mr.start()
      setRecording(true)
    } catch {
      setMsgError('No se pudo acceder al micrófono.')
    }
  }

  const stopRecording = () => {
    if (!recording) return
    try {
      mediaRecorderRef.current?.stop()
    } catch {}
    setRecording(false)
  }

  return (
    <div className='card shadow-lg' style={{ width: 400, height: 580 }}>
      <div className='card-header d-flex align-items-center gap-2'>
        <Avatar
          ruta_foto={myPersonal?.ruta_foto || null}
          name={myName}
          size={32}
          token={token}
        />
        <div className='flex-grow-1'>
          <div className='fw-bold'>Chat</div>
          <div className='text-muted small'>{myName}</div>
        </div>
        <button className='btn btn-sm btn-outline-secondary' onClick={onClose}>
          ✕
        </button>
      </div>

      <div
        className='card-body p-2 d-flex flex-column'
        style={{ minHeight: 0 }}
      >
        {!activeChat && (
          <div className='btn-group w-100 mb-2'>
            <button
              className={`btn btn-sm ${
                tab === 'ticket' ? 'btn-primary' : 'btn-outline-primary'
              }`}
              onClick={() => setTab('ticket')}
            >
              Tickets
            </button>
            <button
              className={`btn btn-sm ${
                tab === 'free' ? 'btn-primary' : 'btn-outline-primary'
              }`}
              onClick={() => setTab('free')}
            >
              Libres
            </button>
            <button
              className={`btn btn-sm ${
                tab === 'new' ? 'btn-primary' : 'btn-outline-primary'
              }`}
              onClick={() => setTab('new')}
            >
              Nuevo
            </button>
          </div>
        )}

        {!activeChat && tab === 'new' && (
          <div className='flex-grow-1 overflow-auto'>
            <NewChat
              token={token}
              myId={myId}
              personas={personas}
              onCreated={async createdChat => {
                setTab('free')
                await refreshInbox(true)
                if (createdChat && createdChat._id) openChat(createdChat)
              }}
            />
          </div>
        )}

        {!activeChat && tab !== 'new' && (
          <div className='flex-grow-1 overflow-auto'>
            <div className='d-flex align-items-center justify-content-between px-1 mb-2'>
              <div className='fw-bold small'>
                {tab === 'ticket' ? 'Chats de tickets' : 'Tus chats libres'}
              </div>
              <button
                className='btn btn-sm btn-outline-secondary'
                onClick={() => refreshInbox(true)}
              >
                Actualizar
              </button>
            </div>

            {loading && <div className='text-muted small p-2'>Cargando…</div>}
            {!loading && error && (
              <div className='text-danger small p-2'>{error}</div>
            )}

            {!loading && !error && chats.length === 0 && (
              <div className='text-muted small p-2'>
                No tienes chats en esta sección.
              </div>
            )}

            {!loading &&
              !error &&
              chats.map(chat => {
                const d = getChatDisplay({ chat, myId, personaMap })
                const unread = Number(chat?.unreadCount || 0)
                const time = formatRelativeDate(chat?.lastMessage?.at)
                const preview =
                  String(chat?.lastMessage?.preview || '').trim() ||
                  'Sin mensajes'

                return (
                  <button
                    key={chat._id}
                    onClick={() => openChat(chat)}
                    className={`w-100 text-start btn ${
                      unread > 0
                        ? 'btn-outline-primary'
                        : 'btn-outline-secondary'
                    } mb-2`}
                  >
                    <div className='d-flex align-items-center gap-2'>
                      <Avatar
                        ruta_foto={d.ruta_foto}
                        name={d.name}
                        size={38}
                        token={token}
                      />
                      <div className='flex-grow-1' style={{ minWidth: 0 }}>
                        <div className='d-flex justify-content-between gap-2'>
                          <div className='fw-bold small text-truncate'>
                            {d.name}
                          </div>
                          <div className='text-muted small'>{time}</div>
                        </div>
                        <div className='d-flex justify-content-between gap-2 mt-1'>
                          <div className='text-muted small text-truncate'>
                            {preview}
                          </div>
                          {unread > 0 && (
                            <span className='badge bg-primary'>
                              {unread > 9 ? '9+' : unread}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}
          </div>
        )}

        {activeChat && (
          <>
            <div className='d-flex align-items-center gap-2 mb-2'>
              <button
                className='btn btn-sm btn-outline-secondary'
                onClick={() => {
                  setActiveChat(null)
                  setMessages([])
                  setTypingUsers(new Set())
                  setReadMap({})
                  setMsgError('')
                  setDraft('')
                }}
              >
                ←
              </button>
              <div className='fw-bold small flex-grow-1 text-truncate'>
                {getChatDisplay({ chat: activeChat, myId, personaMap }).name}
              </div>
            </div>

            <div className='flex-grow-1 overflow-auto border rounded p-2'>
              {msgLoading && <div className='text-muted small'>Cargando…</div>}
              {!msgLoading && msgError && (
                <div className='text-danger small'>{msgError}</div>
              )}

              {!msgLoading &&
                !msgError &&
                messages.map(m => {
                  const mine = String(m?.sender_id_personal) === String(myId)
                  const text = String(m?.text || '').trim()
                  const at = m?.createdAt || m?.created_at

                  return (
                    <div
                      key={m._id}
                      className={`d-flex mb-2 ${
                        mine ? 'justify-content-end' : 'justify-content-start'
                      }`}
                    >
                      <div
                        className={`p-2 rounded ${
                          mine ? 'bg-primary text-white' : 'bg-light'
                        }`}
                        style={{ maxWidth: '82%' }}
                      >
                        {!!text && <div className='small'>{text}</div>}

                        {!!m?.attachments?.length && (
                          <div className='mt-2 d-flex flex-column gap-2'>
                            {m.attachments.map(a => (
                              <AttachmentView
                                key={a.fileId || a.url}
                                att={a}
                                token={token}
                                mine={mine}
                              />
                            ))}
                          </div>
                        )}

                        <div className='d-flex justify-content-between gap-3 mt-2'>
                          <div className='small opacity-75'>
                            {formatRelativeDate(at)}
                          </div>
                          {mine && (
                            <div className='small fw-bold opacity-75'>
                              {isReadBySomeoneElse(m) ? '✓✓' : '✓'}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}

              {typingUsers.size > 0 && (
                <div className='text-muted small mt-2'>Escribiendo…</div>
              )}
            </div>

            <div className='mt-2'>
              {msgError && (
                <div className='text-danger small mb-1'>{msgError}</div>
              )}

              <div className='d-flex gap-2 align-items-center'>
                <input
                  ref={fileInputRef}
                  type='file'
                  multiple
                  className='d-none'
                  onChange={onFilesSelected}
                />

                <button
                  className='btn btn-outline-secondary btn-sm'
                  onClick={pickFiles}
                  disabled={sending || recording}
                  title='Adjuntar'
                >
                  📎
                </button>

                <button
                  className='btn btn-outline-secondary btn-sm'
                  onClick={recording ? stopRecording : startRecording}
                  disabled={sending}
                  title={recording ? 'Detener' : 'Grabar'}
                >
                  {recording ? '⏹️' : '🎙️'}
                </button>

                <input
                  className='form-control form-control-sm'
                  value={draft}
                  onChange={e => onDraftChange(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendTextOnly()}
                  placeholder='Escribe un mensaje…'
                />

                <button
                  className='btn btn-primary btn-sm'
                  onClick={sendTextOnly}
                  disabled={sending || recording}
                >
                  {sending ? '…' : 'Enviar'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
