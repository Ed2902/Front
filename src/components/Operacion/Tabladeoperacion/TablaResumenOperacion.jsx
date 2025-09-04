import React from 'react'

const TablaResumenOperacion = ({ op }) => {
  if (!op) return null
  const productos = Array.isArray(op.productos) ? op.productos : []
  const servicios = Array.isArray(op.servicios) ? op.servicios : []
  const internos = Array.isArray(op.personalesInternos)
    ? op.personalesInternos
    : []
  const externos = Array.isArray(op.personalesExternos)
    ? op.personalesExternos
    : []

  return (
    <div className='card'>
      <div className='card-header py-2'>
        <strong>Resumen de operación</strong>
      </div>
      <div className='card-body p-2'>
        <div className='table-responsive'>
          <table className='table table-sm mb-2'>
            <tbody>
              <tr>
                <th className='w-50'>ID Operación</th>
                <td>{op.id_operacion}</td>
              </tr>
              <tr>
                <th>Tipo</th>
                <td>
                  {op.id_tipo_operacion}
                  {op.tipo_operacion ? ` (${op.tipo_operacion})` : ''}
                </td>
              </tr>
              <tr>
                <th>Lote</th>
                <td>{op.lote || '-'}</td>
              </tr>
              <tr>
                <th>Cliente</th>
                <td>{op.cliente || '-'}</td>
              </tr>
              <tr>
                <th>Operador</th>
                <td>{op.operador || '-'}</td>
              </tr>
              <tr>
                <th>Total Ítems</th>
                <td>{Number(op.cantidad_total_items ?? 0)}</td>
              </tr>
              <tr>
                <th>Estado Inventario</th>
                <td>{op.gestion_inventario || 'Sin estado'}</td>
              </tr>
              <tr>
                <th>Fecha Creación</th>
                <td>{op.fecha_creacion || '-'}</td>
              </tr>
              <tr>
                <th>Fecha Realización</th>
                <td>{op.fecha_realizacion || '-'}</td>
              </tr>
              <tr>
                <th>Fecha Fin</th>
                <td>{op.fecha_fin || '-'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className='mb-2'>
          <div className='small text-muted'>Productos</div>
          {productos.length ? (
            <ul className='mb-2 ps-3'>
              {productos.map((p, i) => (
                <li key={i}>
                  {p.id_producto} - {p.nombre} ({p.cantidad})
                </li>
              ))}
            </ul>
          ) : (
            <div className='text-muted'>N/A</div>
          )}
        </div>

        <div className='mb-2'>
          <div className='small text-muted'>Servicios</div>
          {servicios.length ? (
            <ul className='mb-2 ps-3'>
              {servicios.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          ) : (
            <div className='text-muted'>N/A</div>
          )}
        </div>

        <div className='mb-2'>
          <div className='small text-muted'>Personales Internos</div>
          {internos.length ? (
            <ul className='mb-0 ps-3'>
              {internos.map((p, i) => (
                <li key={i}>
                  {p.nombre} ({p.cargo})
                </li>
              ))}
            </ul>
          ) : (
            <div className='text-muted'>N/A</div>
          )}
        </div>

        <div className='mb-0'>
          <div className='small text-muted'>Personales Externos</div>
          {externos.length ? (
            <ul className='mb-0 ps-3'>
              {externos.map((p, i) => (
                <li key={i}>{p.nombre}</li>
              ))}
            </ul>
          ) : (
            <div className='text-muted'>N/A</div>
          )}
        </div>
      </div>
    </div>
  )
}

export default TablaResumenOperacion
