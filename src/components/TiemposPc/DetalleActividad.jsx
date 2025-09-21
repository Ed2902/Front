// components/DetalleActividad.jsx
import React, { useMemo, useState } from 'react'
import { Button, Card, Row, Col, Table, Nav } from 'react-bootstrap'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LabelList,
  Cell,
} from 'recharts'
import { FaDesktop, FaClock, FaLock, FaHourglassHalf } from 'react-icons/fa'

// =============== Helpers ==================
const pad2 = n => String(n).padStart(2, '0')
const toHMS = secFloat => {
  const s = Math.max(0, Math.floor(Number(secFloat) || 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${pad2(h)}:${pad2(m)}:${pad2(sec)}`
}
const hmsText = t => t || '00:00:00'
const trunc = (txt, n = 28) =>
  String(txt || '').length > n
    ? String(txt).slice(0, n - 1) + '…'
    : String(txt || '')

const BAR_COLORS = [
  '#1E73B6',
  '#2CB6C0',
  '#0B3D6E',
  '#82ca9d',
  '#ffc658',
  '#7F56D9',
  '#EF6C00',
  '#D81B60',
]

// Apps tipo “documentos”
const DOC_APPS = new Map([
  ['excel.exe', 'Excel'],
  ['winword.exe', 'Word'],
  ['powerpnt.exe', 'PowerPoint'],
  ['acrord32.exe', 'Adobe Reader'],
  ['pdf.exe', 'PDF'],
  ['notepad.exe', 'Bloc de notas'],
  ['photos.exe', 'Fotos'],
])
const docLabel = exe => DOC_APPS.get(String(exe || '').toLowerCase()) || exe

// ===== Etiqueta inteligente para barras
const TimeLabel = props => {
  const { x = 0, y = 0, width = 0, height = 0, value } = props
  const txt = toHMS(value)
  const PAD = 8
  const THRESHOLD = 110
  if (width >= THRESHOLD) {
    return (
      <text
        x={x + width - PAD}
        y={y + height / 2}
        textAnchor='end'
        dominantBaseline='central'
        fill='#ffffff'
        fontSize={12}
        fontWeight={600}
      >
        {txt}
      </text>
    )
  }
  return (
    <text
      x={x + width + PAD}
      y={y + height / 2}
      textAnchor='start'
      dominantBaseline='central'
      fill='#0B3D6E'
      fontSize={12}
      fontWeight={600}
    >
      {txt}
    </text>
  )
}

export default function DetalleActividad({ row, onClose }) {
  const rowOk = !!(row && row.metrics)
  const m = rowOk ? row.metrics : {}
  const human = m?.human || {}

  // 👇 Total en pantalla = Operando + Espera (en segundos)
  const seconds = m?.seconds || {}
  const totalPantallaHMS = toHMS(
    (seconds.operando || 0) + (seconds.espera || 0)
  )

  const topApps = m?.top?.apps
  const topWeb = m?.top?.web

  const appsRaw = useMemo(
    () => (Array.isArray(topApps) ? topApps : []),
    [topApps]
  )
  const webRaw = useMemo(() => (Array.isArray(topWeb) ? topWeb : []), [topWeb])

  const appsSorted = useMemo(
    () => [...appsRaw].sort((a, b) => (b.total_sec || 0) - (a.total_sec || 0)),
    [appsRaw]
  )
  const webSorted = useMemo(
    () => [...webRaw].sort((a, b) => (b.total_sec || 0) - (a.total_sec || 0)),
    [webRaw]
  )

  const [showAllApps, setShowAllApps] = useState(false)
  const apps = useMemo(
    () => (showAllApps ? appsSorted : appsSorted.slice(0, 10)),
    [showAllApps, appsSorted]
  )

  // Documentos agregados por app
  const docsAgg = useMemo(() => {
    const byExe = new Map()
    for (const a of appsSorted) {
      const exe = String(a.app || '').toLowerCase()
      if (!DOC_APPS.has(exe)) continue
      const titles = Array.isArray(a.top_titles)
        ? a.top_titles.filter(t => t && String(t).trim() !== '')
        : []
      if (!byExe.has(exe)) {
        byExe.set(exe, {
          app: a.app,
          total_sec: Number(a.total_sec) || 0,
          titles: new Set(titles),
          topTitle: titles[0] || docLabel(a.app),
        })
      } else {
        const node = byExe.get(exe)
        node.total_sec += Number(a.total_sec) || 0
        titles.forEach(t => node.titles.add(t))
        if (!node.topTitle && titles[0]) node.topTitle = titles[0]
      }
    }
    return [...byExe.values()]
      .map(v => ({
        app: v.app,
        appLabel: docLabel(v.app),
        total_sec: Math.floor(v.total_sec || 0),
        topTitle: v.topTitle || docLabel(v.app),
        titles: [...v.titles].sort().slice(0, 12),
      }))
      .sort((a, b) => b.total_sec - a.total_sec)
  }, [appsSorted])

  const [activeTab, setActiveTab] = useState('apps')

  // Datos para el gráfico según pestaña
  const chartData = useMemo(() => {
    if (activeTab === 'web') {
      return webSorted.slice(0, 8).map(d => ({
        name: trunc(d.domain),
        value: Math.floor(d.total_sec || 0),
      }))
    }
    if (activeTab === 'docs') {
      return docsAgg.slice(0, 8).map(d => ({
        name: trunc(d.topTitle || d.appLabel),
        value: Math.floor(d.total_sec || 0),
      }))
    }
    return appsSorted.slice(0, 8).map(a => ({
      name: trunc(a.app),
      value: Math.floor(a.total_sec || 0),
    }))
  }, [activeTab, appsSorted, webSorted, docsAgg])

  return (
    <>
      {rowOk && (
        <Card className='mt-3'>
          <Card.Header className='d-flex justify-content-between align-items-center'>
            <div>
              <FaDesktop className='me-2' />
              <strong>
                Detalle de actividad — {row?.user} @ {row?.hostname}
              </strong>
              <div className='small text-muted'>
                {row?.date || m?.context?.date || ''}
              </div>
            </div>
            <Button size='sm' variant='outline-secondary' onClick={onClose}>
              Cerrar
            </Button>
          </Card.Header>

          <Card.Body>
            {/* KPIs (5 tarjetas, la última es Total en pantalla) */}
            <Row className='mb-3 g-3 row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-5'>
              <Col>
                <Card className='text-center p-2 h-100'>
                  <FaClock className='text-primary mb-1' />
                  <div className='fw-bold fs-5'>{hmsText(human?.operando)}</div>
                  <div className='small text-muted'>Operando</div>
                </Card>
              </Col>
              <Col>
                <Card className='text-center p-2 h-100'>
                  <FaHourglassHalf className='text-warning mb-1' />
                  <div className='fw-bold fs-5'>{hmsText(human?.espera)}</div>
                  <div className='small text-muted'>Espera (cargas)</div>
                </Card>
              </Col>
              <Col>
                <Card className='text-center p-2 h-100'>
                  <FaClock className='text-secondary mb-1' />
                  <div className='fw-bold fs-5'>
                    {hmsText(human?.inactividad_real)}
                  </div>
                  <div className='small text-muted'>Inactividad</div>
                </Card>
              </Col>
              <Col>
                <Card className='text-center p-2 h-100'>
                  <FaLock className='text-danger mb-1' />
                  <div className='fw-bold fs-5'>
                    {hmsText(human?.bloqueado)}
                  </div>
                  <div className='small text-muted'>Bloqueado</div>
                </Card>
              </Col>
              {/* ✅ Total en pantalla (Operando + Espera) */}
              <Col>
                <Card className='text-center p-2 h-100'>
                  <FaDesktop className='text-success mb-1' />
                  <div className='fw-bold fs-5 text-success'>
                    {totalPantallaHMS}
                  </div>
                  <div className='small text-muted'>Total en pantalla</div>
                </Card>
              </Col>
            </Row>

            <Row className='g-4'>
              {/* Gráfico de barras horizontal */}
              <Col md={5}>
                <Card className='h-100'>
                  <Card.Header className='py-2'>
                    <strong>
                      Top{' '}
                      {activeTab === 'apps'
                        ? 'apps'
                        : activeTab === 'web'
                        ? 'dominios'
                        : 'documentos'}{' '}
                      (barras)
                    </strong>
                  </Card.Header>
                  <Card.Body>
                    {chartData.length === 0 ? (
                      <div className='text-muted small'>Sin datos</div>
                    ) : (
                      <div style={{ width: '100%', height: 320 }}>
                        <ResponsiveContainer>
                          <BarChart
                            data={chartData}
                            layout='vertical'
                            margin={{ top: 8, right: 32, bottom: 0, left: 8 }}
                            barCategoryGap={10}
                          >
                            <XAxis type='number' domain={[0, 'dataMax']} hide />
                            <YAxis
                              type='category'
                              dataKey='name'
                              width={230}
                              axisLine={false}
                              tickLine={false}
                            />
                            <Tooltip
                              formatter={v => [toHMS(v), 'Tiempo']}
                              labelFormatter={n => n}
                            />
                            <Bar
                              dataKey='value'
                              radius={[6, 6, 6, 6]}
                              isAnimationActive
                              animationDuration={900}
                              animationBegin={120}
                            >
                              {chartData.map((_, i) => (
                                <Cell
                                  key={i}
                                  fill={BAR_COLORS[i % BAR_COLORS.length]}
                                />
                              ))}
                              <LabelList
                                dataKey='value'
                                content={<TimeLabel />}
                              />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </Card.Body>
                </Card>
              </Col>

              {/* Tabs y tablas */}
              <Col md={7}>
                <Nav
                  variant='tabs'
                  activeKey={activeTab}
                  onSelect={k => setActiveTab(k || 'apps')}
                >
                  <Nav.Item>
                    <Nav.Link eventKey='apps'>Aplicaciones</Nav.Link>
                  </Nav.Item>
                  <Nav.Item>
                    <Nav.Link eventKey='web'>Web (dominios)</Nav.Link>
                  </Nav.Item>
                  <Nav.Item>
                    <Nav.Link eventKey='docs'>Documentos</Nav.Link>
                  </Nav.Item>
                </Nav>

                <div className='border border-top-0 rounded-bottom p-2'>
                  {activeTab === 'apps' && (
                    <>
                      <Table striped hover size='sm' className='mb-2'>
                        <thead>
                          <tr>
                            <th style={{ width: '55%' }}>Aplicación</th>
                            <th style={{ width: '45%' }} className='text-end'>
                              Tiempo (HH:MM:SS)
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {apps.length === 0 ? (
                            <tr>
                              <td colSpan={2} className='text-muted'>
                                Sin datos
                              </td>
                            </tr>
                          ) : (
                            apps.map((a, i) => (
                              <tr key={i}>
                                <td className='font-mono'>{a.app}</td>
                                <td className='text-end'>
                                  {toHMS(a.total_sec)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </Table>
                      {appsSorted.length > 10 && (
                        <div className='d-flex justify-content-end'>
                          <Button
                            variant='outline-secondary'
                            size='sm'
                            onClick={() => setShowAllApps(v => !v)}
                          >
                            {showAllApps
                              ? 'Ver menos'
                              : `Ver todo (${appsSorted.length})`}
                          </Button>
                        </div>
                      )}
                    </>
                  )}

                  {activeTab === 'web' && (
                    <Table striped hover size='sm'>
                      <thead>
                        <tr>
                          <th style={{ width: '55%' }}>Dominio</th>
                          <th style={{ width: '45%' }} className='text-end'>
                            Tiempo (HH:MM:SS)
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {webSorted.length === 0 ? (
                          <tr>
                            <td colSpan={2} className='text-muted'>
                              Sin datos
                            </td>
                          </tr>
                        ) : (
                          webSorted.map((w, i) => (
                            <tr key={i}>
                              <td>{w.domain}</td>
                              <td className='text-end'>{toHMS(w.total_sec)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </Table>
                  )}

                  {activeTab === 'docs' && (
                    <Table striped hover size='sm'>
                      <thead>
                        <tr>
                          <th style={{ width: '55%' }}>Documentos (títulos)</th>
                          <th style={{ width: '20%' }} className='text-end'>
                            Tiempo (HH:MM:SS)
                          </th>
                          <th style={{ width: '25%' }}>Aplicación</th>
                        </tr>
                      </thead>
                      <tbody>
                        {docsAgg.length === 0 ? (
                          <tr>
                            <td colSpan={3} className='text-muted'>
                              Sin documentos
                            </td>
                          </tr>
                        ) : (
                          docsAgg.map((d, i) => (
                            <tr key={i}>
                              <td>
                                {d.titles.length === 0 ? (
                                  <span className='text-muted'>
                                    {d.topTitle}
                                  </span>
                                ) : (
                                  <ul className='mb-0 ps-3'>
                                    {d.titles.map((t, j) => (
                                      <li key={j} className='small'>
                                        {t}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </td>
                              <td className='text-end'>{toHMS(d.total_sec)}</td>
                              <td>
                                <span className='fw-semibold'>
                                  {d.appLabel}
                                </span>
                                <div className='small text-muted'>{d.app}</div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </Table>
                  )}
                </div>
              </Col>
            </Row>
          </Card.Body>
        </Card>
      )}
    </>
  )
}
