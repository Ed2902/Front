// components/FiltroFechasBusqueda.jsx
import React from 'react'
import {
  Button,
  ButtonGroup,
  Form,
  InputGroup,
  Row,
  Col,
} from 'react-bootstrap'
import { FaSearch } from 'react-icons/fa'

const pad2 = n => String(n).padStart(2, '0')
const toYMD = d =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
const shiftDays = n => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(0, 0, 0, 0)
  return toYMD(d)
}

export default function FiltroFechasBusqueda({
  date,
  search,
  onDateChange,
  onSearchChange,
  onCargar,
}) {
  return (
    <div className='card mb-3'>
      <div className='card-body py-2'>
        <Row className='g-2 align-items-center'>
          {/* Fecha + quick buttons (compacto) */}
          <Col md='auto' className='d-flex align-items-center gap-2'>
            <span className='fw-semibold small'>Fecha</span>
            <Form.Control
              size='sm'
              type='date'
              value={date}
              onChange={e => onDateChange?.(e.target.value)}
              style={{ width: 150 }}
            />
            <ButtonGroup size='sm'>
              <Button
                variant='light'
                onClick={() => onDateChange?.(shiftDays(1))}
              >
                Ayer
              </Button>
              <Button
                variant='light'
                onClick={() => onDateChange?.(shiftDays(2))}
              >
                Antier
              </Button>
              <Button
                variant='light'
                onClick={() => onDateChange?.(shiftDays(3))}
              >
                Hace 3 días
              </Button>
            </ButtonGroup>
          </Col>

          {/* Buscar + Cargar (alineado a la derecha y pegado) */}
          <Col
            md
            className='d-flex align-items-center justify-content-end gap-2'
          >
            <span className='fw-semibold small d-none d-md-inline'>Buscar</span>
            <InputGroup size='sm' style={{ maxWidth: 260 }}>
              <InputGroup.Text>
                <FaSearch />
              </InputGroup.Text>
              <Form.Control
                type='text'
                placeholder='Usuario u hostname…'
                value={search}
                onChange={e => onSearchChange?.(e.target.value)}
              />
            </InputGroup>
            <Button size='sm' variant='primary' onClick={onCargar}>
              Cargar
            </Button>
          </Col>
        </Row>
      </div>
    </div>
  )
}
