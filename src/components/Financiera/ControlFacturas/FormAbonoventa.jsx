// src/modules/Financiera/FactVenta/FormAbonoVenta.jsx
import { useContext, useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Button, Col, Form, Row, Spinner } from 'react-bootstrap'
import { FaDollarSign, FaPaperclip, FaSave } from 'react-icons/fa'

import AuthContext from '../../../context/AuthContext'
import {
  actualizarAbonosFactVenta,
  subirSoportesAbonoVenta,
} from './FactVenta.service'
import './FormAbono.css'

const onlyDigits = v => String(v ?? '').replace(/[^\d]/g, '')

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

const fmtCOP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})

const fmtUSD = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const toDateInputUTC = iso => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

const FormAbonoVenta = ({ facturaId, factura, abonoIndex = 0, onSuccess }) => {
  const { token } = useContext(AuthContext)

  // ====== Base abono ======
  const baseAbono = useMemo(
    () => factura?.abonos?.[abonoIndex] || null,
    [factura, abonoIndex]
  )

  // COP base congelado (si USD)
  const copBase = useMemo(() => {
    return baseAbono?.monto_cop ?? factura?.valor_cop ?? factura?.monto_cop ?? 0
  }, [baseAbono, factura])

  // USD base (para preservar cuando envías COP / o precargar al activar USD)
  const usdBase = useMemo(() => baseAbono?.monto_usd ?? 0, [baseAbono])

  // fecha base
  const fechaBase = useMemo(() => {
    const f = baseAbono?.fecha_pago
    return f ? toDateInputUTC(f) : ''
  }, [baseAbono])

  // ====== State ======
  const [isUSD, setIsUSD] = useState(false)
  const [montoCOP, setMontoCOP] = useState(String(asNumber(copBase) || ''))
  const [montoUSD, setMontoUSD] = useState('') // en COP no se edita, en USD sí
  const [fechaPago, setFechaPago] = useState(fechaBase)
  const [files, setFiles] = useState([])

  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  // Si activan USD: congela COP y precarga USD si existe
  useEffect(() => {
    if (isUSD) {
      setMontoCOP(String(asNumber(copBase)))
      if (!montoUSD && asNumber(usdBase) > 0) {
        setMontoUSD(String(asNumber(usdBase)))
      }
    } else {
      // Si vuelves a COP, limpiamos el input USD (pero igual preservaremos usdBase al enviar)
      setMontoUSD('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUSD, copBase])

  // ====== Files ======
  const onPickFiles = e => {
    const selected = Array.from(e.target.files || [])
    if (selected.length) setFiles(prev => [...prev, ...selected])
    e.target.value = ''
  }

  const removeFile = idx => setFiles(prev => prev.filter((_, i) => i !== idx))

  // ====== Validación ======
  const validar = () => {
    if (!fechaPago) return 'Debes seleccionar la fecha de pago.'

    const cop = asNumber(onlyDigits(montoCOP))
    if (!cop || cop <= 0) return 'Debes ingresar el monto COP.'

    if (isUSD) {
      const usdInput = asNumber(onlyDigits(montoUSD))
      const usdToSend = usdInput > 0 ? usdInput : asNumber(usdBase)
      if (!usdToSend || usdToSend <= 0) return 'Debes ingresar el monto USD.'
    }

    return ''
  }

  // ====== Payload (CLAVE: preservar el otro sin interferir) ======
  const buildAbonoPayload = () => {
    const cop = asNumber(onlyDigits(montoCOP))
    const usdPrev = asNumber(usdBase)

    const abono = {
      monto_cop: cop,
      fecha_pago: fechaPago, // YYYY-MM-DD
    }

    if (isUSD) {
      // USD: manda USD (si no lo editas, preserva el anterior)
      const usdInput = asNumber(onlyDigits(montoUSD))
      const usdToSend = usdInput > 0 ? usdInput : usdPrev
      abono.monto_usd = usdToSend
    } else {
      // COP: NO editas USD, pero si tu backend reemplaza el objeto, debemos preservarlo
      if (usdPrev > 0) {
        abono.monto_usd = usdPrev
      }
    }

    return abono
  }

  // ====== ÚNICO BOTÓN: JSON -> (si hay) FormData ======
  const guardar = async () => {
    const msg = validar()
    if (msg) {
      setError(msg)
      return
    }

    setSaving(true)
    setUploading(false)
    setError('')
    setOk('')

    try {
      const abono = buildAbonoPayload()

      // 1) PUT JSON
      await actualizarAbonosFactVenta(facturaId, [abono], token)

      // 2) POST soportes (si hay)
      if (files.length) {
        setUploading(true)
        const formData = new FormData()
        files.forEach(f => formData.append('soportes_pago', f))
        await subirSoportesAbonoVenta(facturaId, abonoIndex, formData, token)
      }

      setOk(
        files.length
          ? 'Abono actualizado y soportes cargados.'
          : 'Abono actualizado correctamente.'
      )
      setFiles([])
      onSuccess?.()
    } catch (err) {
      setError(err?.response?.data?.message || 'Error al guardar el abono.')
    } finally {
      setUploading(false)
      setSaving(false)
    }
  }

  // ====== Datos para mostrar ======
  const saldoCOP = asNumber(factura?.saldo_cop)
  const saldoUSD = asNumber(factura?.saldo_usd)
  const valorCOP = asNumber(factura?.valor_cop)
  const valorUSD = asNumber(factura?.valor_usd)

  const busy = saving || uploading

  return (
    <div className='abono-form'>
      <div className='d-flex justify-content-between align-items-start mb-2'>
        <div>
          <h5 className='mb-1' style={{ fontWeight: 900 }}>
            Hacer abono
          </h5>
          <div className='text-muted' style={{ fontSize: 12 }}>
            Factura: <strong>{factura?.factura || '-'}</strong> · Cliente:{' '}
            <strong>{factura?.cliente || '-'}</strong>
          </div>
        </div>

        <div className='d-flex gap-2 flex-wrap justify-content-end'>
          <Badge bg='light' text='dark' className='px-3 py-2'>
            Saldo COP: <strong>{fmtCOP.format(saldoCOP)}</strong>
          </Badge>
          <Badge bg='light' text='dark' className='px-3 py-2'>
            Saldo USD: <strong>{fmtUSD.format(saldoUSD)}</strong>
          </Badge>
          <Badge bg='light' text='dark' className='px-3 py-2'>
            Valor COP: <strong>{fmtCOP.format(valorCOP)}</strong>
          </Badge>
          <Badge bg='light' text='dark' className='px-3 py-2'>
            Valor USD: <strong>{fmtUSD.format(valorUSD)}</strong>
          </Badge>
        </div>
      </div>

      {error && (
        <Alert variant='danger' className='py-2 mb-2'>
          {error}
        </Alert>
      )}
      {ok && (
        <Alert variant='success' className='py-2 mb-2'>
          {ok}
        </Alert>
      )}

      <Form>
        <Row className='g-3'>
          <Col md={6}>
            <Form.Group>
              <Form.Label style={{ fontWeight: 800, fontSize: 12 }}>
                Fecha de pago
              </Form.Label>
              <Form.Control
                type='date'
                value={fechaPago}
                onChange={e => setFechaPago(e.target.value)}
                disabled={busy}
              />
            </Form.Group>
          </Col>

          <Col md={6} className='d-flex align-items-end'>
            <Form.Check
              type='checkbox'
              id='abono-usd'
              checked={isUSD}
              disabled={busy}
              onChange={e => setIsUSD(e.target.checked)}
              label={
                <span style={{ fontWeight: 900 }}>
                  <FaDollarSign style={{ marginRight: 6 }} /> Abono en USD
                </span>
              }
            />
          </Col>

          <Col md={6}>
            <Form.Group>
              <Form.Label style={{ fontWeight: 800, fontSize: 12 }}>
                Monto COP {isUSD ? '(congelado)' : ''}
              </Form.Label>
              <Form.Control
                value={montoCOP}
                disabled={busy || isUSD}
                inputMode='numeric'
                onChange={e => setMontoCOP(onlyDigits(e.target.value))}
              />
              {isUSD && (
                <div className='text-muted mt-1' style={{ fontSize: 11 }}>
                  En USD se envía el COP actual sin cambios.
                </div>
              )}
            </Form.Group>
          </Col>

          <Col md={6}>
            <Form.Group>
              <Form.Label style={{ fontWeight: 800, fontSize: 12 }}>
                Monto USD
              </Form.Label>
              <Form.Control
                value={montoUSD}
                disabled={busy || !isUSD}
                inputMode='numeric'
                onChange={e => setMontoUSD(onlyDigits(e.target.value))}
                placeholder={isUSD ? 'Ej: 100' : 'Activa USD para editar'}
              />
              {isUSD && asNumber(usdBase) > 0 && (
                <div className='text-muted mt-1' style={{ fontSize: 11 }}>
                  USD actual:{' '}
                  <strong>{fmtUSD.format(asNumber(usdBase))}</strong> (se
                  preserva si no lo cambias)
                </div>
              )}
              {!isUSD && asNumber(usdBase) > 0 && (
                <div className='text-muted mt-1' style={{ fontSize: 11 }}>
                  USD actual:{' '}
                  <strong>{fmtUSD.format(asNumber(usdBase))}</strong> (no se
                  modifica en abono COP)
                </div>
              )}
            </Form.Group>
          </Col>

          <Col md={12}>
            <div className='d-flex align-items-center justify-content-between flex-wrap gap-2'>
              <label className='file-btn m-0'>
                <FaPaperclip /> Adjuntar soportes
                <input
                  type='file'
                  multiple
                  onChange={onPickFiles}
                  disabled={busy}
                />
              </label>

              <div className='text-muted' style={{ fontSize: 12 }}>
                {files.length
                  ? `${files.length} archivo(s) listo(s)`
                  : 'Sin archivos seleccionados'}
              </div>
            </div>

            {!!files.length && (
              <div className='mt-2'>
                {files.map((f, i) => (
                  <div key={`${f.name}-${i}`} className='file-item'>
                    <span title={f.name}>{f.name}</span>
                    <button
                      type='button'
                      onClick={() => removeFile(i)}
                      disabled={busy}
                    >
                      Quitar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Col>

          <Col md={12}>
            <div className='abono-actions'>
              <Button
                variant='success'
                className='btn primary'
                onClick={guardar}
                disabled={busy}
              >
                <FaSave style={{ marginRight: 8 }} />
                {saving
                  ? 'Guardando…'
                  : files.length
                  ? 'Guardar y subir soportes'
                  : 'Guardar abono'}
                {busy && <Spinner size='sm' className='ms-2' />}
              </Button>
            </div>
          </Col>
        </Row>
      </Form>
    </div>
  )
}

export default FormAbonoVenta
