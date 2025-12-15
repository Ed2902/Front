import { useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Button, Col, Form, Row, Spinner } from 'react-bootstrap'
import { crearFactVenta } from './FactVenta.service'

const LINEAS = [
  { value: 'Harvest', label: 'Harvest' },
  { value: 'Fastway', label: 'Fastway' },
  { value: 'Greenway', label: 'Greeway' },
  { value: 'Compras Gen', label: 'Compras Gen' },
]

const toISODateUTC = yyyyMmDd => {
  if (!yyyyMmDd) return ''
  const d = new Date(`${yyyyMmDd}T00:00:00.000Z`)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString()
}

const todayInputUTC = () => {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(
    2,
    '0'
  )}-${String(d.getUTCDate()).padStart(2, '0')}`
}

const asNumberString = v => {
  if (v === null || v === undefined) return ''
  const s = String(v).trim()
  if (!s) return ''
  return s
    .replace(/[^\d.,-]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
}

function DropZone({ label, helper, files, setFiles, accept, name = 'files' }) {
  const [dragOver, setDragOver] = useState(false)

  const addFiles = list => {
    const arr = Array.from(list || [])
    if (!arr.length) return
    setFiles([...(files || []), ...arr])
  }

  const removeAt = idx => {
    setFiles((files || []).filter((_, i) => i !== idx))
  }

  return (
    <div className='mb-3'>
      <div className='d-flex justify-content-between align-items-end'>
        <Form.Label className='mb-1'>{label}</Form.Label>
        {files?.length ? (
          <small className='text-muted'>{files.length} archivo(s)</small>
        ) : null}
      </div>

      {helper ? <div className='text-muted small mb-2'>{helper}</div> : null}

      <div
        role='button'
        tabIndex={0}
        onDragOver={e => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => {
          e.preventDefault()
          setDragOver(false)
          addFiles(e.dataTransfer.files)
        }}
        onClick={() => {
          const input = document.getElementById(name)
          input?.click()
        }}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            const input = document.getElementById(name)
            input?.click()
          }
        }}
        style={{
          border: '2px dashed #cbd5e1',
          background: dragOver ? '#f8fafc' : '#ffffff',
          borderRadius: 12,
          padding: 14,
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <div className='d-flex flex-column gap-1'>
          <div className='fw-semibold'>Arrastra acá tus archivos</div>
          <div className='text-muted small'>
            o haz click para seleccionar (puedes subir varios)
          </div>
        </div>

        <input
          id={name}
          type='file'
          accept={accept}
          multiple
          style={{ display: 'none' }}
          onChange={e => addFiles(e.target.files)}
        />
      </div>

      {files?.length > 0 && (
        <div className='mt-2 d-flex flex-column gap-1'>
          {files.map((f, i) => (
            <div
              key={`${f.name}-${i}`}
              className='d-flex align-items-center justify-content-between border rounded px-2 py-1'
            >
              <small className='text-truncate' style={{ maxWidth: 520 }}>
                {f.name}
              </small>
              <Button
                size='sm'
                variant='outline-danger'
                onClick={() => removeAt(i)}
              >
                Quitar
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function FormVenta({ token, onCancel, onCreated }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [okMsg, setOkMsg] = useState('')

  // validación
  const [touched, setTouched] = useState({})
  const touch = k => setTouched(t => ({ ...t, [k]: true }))

  // campos (obligatorios: cliente, factura, fecha, vencimiento)
  const [cliente, setCliente] = useState('')
  const [linea, setLinea] = useState('Compras Gen')
  const [factura, setFactura] = useState('')

  const [fecha, setFecha] = useState(todayInputUTC())
  const [diasCredito, setDiasCredito] = useState('30')
  const [fechaVenc, setFechaVenc] = useState('')

  // opcionales
  const [valorCop, setValorCop] = useState('')
  const [valorUsd, setValorUsd] = useState('')
  const [trmFactura, setTrmFactura] = useState('')
  const [doField, setDoField] = useState('')
  const [detalles, setDetalles] = useState('')

  // archivos
  const [soportesPago, setSoportesPago] = useState([])
  const [docs, setDocs] = useState([])

  // calcular vencimiento (si el usuario lo edita manualmente, queda como lo dejó)
  useEffect(() => {
    if (!fecha) return
    const n = Number(asNumberString(diasCredito || '0'))
    if (!Number.isFinite(n)) return

    const d = new Date(`${fecha}T00:00:00.000Z`)
    if (Number.isNaN(d.getTime())) return
    d.setUTCDate(d.getUTCDate() + n)

    const yyyy = d.getUTCFullYear()
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(d.getUTCDate()).padStart(2, '0')

    // Si fechaVenc está vacío, lo calculamos; si ya existe, no lo pisamos
    setFechaVenc(prev => (prev ? prev : `${yyyy}-${mm}-${dd}`))
  }, [fecha, diasCredito])

  const errors = useMemo(() => {
    const e = {}
    if (!cliente.trim()) e.cliente = 'Cliente es obligatorio'
    if (!factura.trim()) e.factura = 'Factura es obligatoria'
    if (!fecha) e.fecha = 'Fecha es obligatoria'
    if (!fechaVenc) e.fechaVenc = 'Vencimiento es obligatorio'
    return e
  }, [cliente, factura, fecha, fechaVenc])

  const canSubmit = useMemo(() => {
    return token && Object.keys(errors).length === 0
  }, [token, errors])

  const onSubmit = async e => {
    e.preventDefault()
    setError('')
    setOkMsg('')

    setTouched(t => ({
      ...t,
      cliente: true,
      factura: true,
      fecha: true,
      fechaVenc: true,
    }))

    if (Object.keys(errors).length) return

    setSaving(true)

    try {
      const fd = new FormData()

      // obligatorios
      fd.append('cliente', cliente.trim())
      fd.append('factura', factura.trim())
      fd.append('fecha', toISODateUTC(fecha))
      fd.append('fecha_vencimiento', toISODateUTC(fechaVenc))

      // opcionales
      fd.append('linea', linea || 'Compras Gen')
      fd.append(
        'dias_credito',
        String(Number(asNumberString(diasCredito) || 0))
      )
      fd.append('valor_cop', String(Number(asNumberString(valorCop) || 0)))
      fd.append('valor_usd', String(Number(asNumberString(valorUsd) || 0)))
      fd.append('trm_factura', String(Number(asNumberString(trmFactura) || 0)))
      fd.append('do', doField.trim())
      fd.append('detalles', detalles.trim())

      // 🔒 estado fijo
      fd.append('estado', 'PENDIENTE')
      fd.append('trm_pago', '0')
      fd.append('fecha_pago', '')

      // archivos
      soportesPago.forEach(f => fd.append('soportes_pago', f))
      docs.forEach(f => fd.append('docs', f))

      await crearFactVenta(fd, token)

      setOkMsg('Venta creada correctamente ✅')
      onCreated?.()
    } catch (err) {
      setError(err?.message || 'Error creando la venta')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Form onSubmit={onSubmit}>
      {error && <Alert variant='danger'>{error}</Alert>}
      {okMsg && <Alert variant='success'>{okMsg}</Alert>}

      {/* 1) Cliente + Línea + Factura */}
      <Row className='g-2 mb-2'>
        <Col lg={4}>
          <Form.Label>Cliente *</Form.Label>
          <Form.Control
            size='sm'
            value={cliente}
            onChange={e => setCliente(e.target.value)}
            onBlur={() => touch('cliente')}
            isInvalid={touched.cliente && !!errors.cliente}
            placeholder='Ej: cliente'
          />
          <Form.Control.Feedback type='invalid'>
            {errors.cliente}
          </Form.Control.Feedback>
        </Col>

        <Col lg={4}>
          <Form.Label>Línea</Form.Label>
          <Form.Select
            size='sm'
            value={linea}
            onChange={e => setLinea(e.target.value)}
          >
            {LINEAS.map(l => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </Form.Select>
        </Col>

        <Col lg={4}>
          <Form.Label>Factura *</Form.Label>
          <Form.Control
            size='sm'
            value={factura}
            onChange={e => setFactura(e.target.value)}
            onBlur={() => touch('factura')}
            isInvalid={touched.factura && !!errors.factura}
            placeholder='Ej: 555555'
          />
          <Form.Control.Feedback type='invalid'>
            {errors.factura}
          </Form.Control.Feedback>
        </Col>
      </Row>

      {/* 2) Fecha + Crédito + Vencimiento + Estado (4 en una fila) */}
      <Row className='g-2 mb-2'>
        <Col lg={3}>
          <Form.Label>Fecha *</Form.Label>
          <Form.Control
            type='date'
            size='sm'
            value={fecha}
            onChange={e => {
              setFecha(e.target.value)
              // si cambian la fecha y no han tocado vencimiento, resetea para recalcular
              if (!touched.fechaVenc) setFechaVenc('')
            }}
            onBlur={() => touch('fecha')}
            isInvalid={touched.fecha && !!errors.fecha}
          />
          <div className='text-muted small mt-1'>
            Fecha impresa en la factura
          </div>
          <Form.Control.Feedback type='invalid'>
            {errors.fecha}
          </Form.Control.Feedback>
        </Col>

        <Col lg={3}>
          <Form.Label>Días crédito</Form.Label>
          <Form.Control
            size='sm'
            value={diasCredito}
            onChange={e => {
              setDiasCredito(e.target.value)
              if (!touched.fechaVenc) setFechaVenc('')
            }}
            placeholder='Ej: 30'
          />
        </Col>

        <Col lg={3}>
          <Form.Label>Vencimiento *</Form.Label>
          <Form.Control
            type='date'
            size='sm'
            value={fechaVenc}
            onChange={e => setFechaVenc(e.target.value)}
            onBlur={() => touch('fechaVenc')}
            isInvalid={touched.fechaVenc && !!errors.fechaVenc}
          />
          <Form.Control.Feedback type='invalid'>
            {errors.fechaVenc}
          </Form.Control.Feedback>
        </Col>

        <Col lg={3}>
          <Form.Label>Estado</Form.Label>
          <div className='pt-1'>
            <Badge bg='warning'>PENDIENTE</Badge>
          </div>
        </Col>
      </Row>

      {/* 3) Valores (sin estado) */}
      <Row className='g-2 mb-2'>
        <Col lg={4}>
          <Form.Label>Valor COP</Form.Label>
          <Form.Control
            size='sm'
            value={valorCop}
            onChange={e => setValorCop(e.target.value)}
            placeholder='Ej: 1500000'
          />
        </Col>

        <Col lg={4}>
          <Form.Label>Valor USD</Form.Label>
          <Form.Control
            size='sm'
            value={valorUsd}
            onChange={e => setValorUsd(e.target.value)}
            placeholder='Ej: 380'
          />
        </Col>

        <Col lg={4}>
          <Form.Label>TRM factura</Form.Label>
          <Form.Control
            size='sm'
            value={trmFactura}
            onChange={e => setTrmFactura(e.target.value)}
            placeholder='Ej: 3950.5'
          />
        </Col>
      </Row>

      {/* 4) DO + Detalles */}
      <Row className='g-2 mb-3'>
        <Col lg={4}>
          <Form.Label>D.O</Form.Label>
          <Form.Control
            size='sm'
            value={doField}
            onChange={e => setDoField(e.target.value)}
            placeholder='Ej: DO-12345'
          />
        </Col>

        <Col lg={8}>
          <Form.Label>Detalles</Form.Label>
          <Form.Control
            size='sm'
            as='textarea'
            rows={2}
            value={detalles}
            onChange={e => setDetalles(e.target.value)}
            placeholder='Ej: Factura con crédito a 30 días'
          />
        </Col>
      </Row>

      {/* 5) Archivos */}
      <Row className='g-2'>
        <Col lg={6}>
          <DropZone
            name='soportes_pago_drop'
            label='Soportes de pago'
            helper='Sube soportes de pago (pueden ser varios).'
            files={soportesPago}
            setFiles={setSoportesPago}
          />
        </Col>

        <Col lg={6}>
          <DropZone
            name='docs_drop'
            label='Documentos adicionales'
            helper='Notas crédito u otros documentos adicionales (no soportes de pago).'
            files={docs}
            setFiles={setDocs}
          />
        </Col>
      </Row>

      <div className='d-flex justify-content-end gap-2 mt-2'>
        <Button variant='secondary' onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button type='submit' disabled={!canSubmit || saving}>
          {saving ? (
            <>
              <Spinner size='sm' className='me-2' /> Guardando…
            </>
          ) : (
            'Crear'
          )}
        </Button>
      </div>
    </Form>
  )
}
