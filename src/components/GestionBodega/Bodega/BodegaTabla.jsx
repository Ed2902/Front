import Accordion from 'react-bootstrap/Accordion'
import Table from 'react-bootstrap/Table'
import ProgressBar from 'react-bootstrap/ProgressBar'

const BodegaTabla = ({ bodegas, ubicaciones, inventario }) => {
  const getNivelModulo = (texto = '') => {
    const limpio = String(texto)
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/\s+/g, ' ')
      .trim()

    const re = /Nivel\s*(\d+).*?Modulo\s*(\d+)/i
    const m = limpio.match(re)

    const nivel = m && m[1] ? Number(m[1]) : Number.POSITIVE_INFINITY
    const modulo = m && m[2] ? Number(m[2]) : Number.POSITIVE_INFINITY

    return {
      nivel: Number.isFinite(nivel) ? nivel : Number.POSITIVE_INFINITY,
      modulo: Number.isFinite(modulo) ? modulo : Number.POSITIVE_INFINITY,
    }
  }

  // Calcula ocupación en m³ para una ubicación específica
  const calcularOcupacionUbicacion = (idUbicacion, capacidadUbicacion) => {
    const inventarioUbicacion = inventario.filter(
      item => item.id_ubicacion === idUbicacion
    )

    const volumenTotal = inventarioUbicacion.reduce((acc, item) => {
      const { Alto, Ancho, Largo } = item.Producto || {}
      const cantidad = item.Cantidad || 0
      if (!Alto || !Ancho || !Largo) return acc
      const volumenUnitarioM3 = (Alto * Ancho * Largo) / 1_000_000
      return acc + volumenUnitarioM3 * cantidad
    }, 0)

    const disponible = capacidadUbicacion - volumenTotal
    const porcentaje =
      capacidadUbicacion > 0
        ? Math.min((volumenTotal / capacidadUbicacion) * 100, 100)
        : 0

    return {
      ocupado: volumenTotal.toFixed(2),
      disponible: Math.max(disponible, 0).toFixed(2),
      porcentaje: porcentaje.toFixed(1),
    }
  }

  return (
    <Accordion defaultActiveKey={bodegas.map((_, i) => i.toString())}>
      {bodegas.map((bodega, index) => {
        // Filtra y ordena: Nivel asc, luego Módulo asc
        const ubicacionesBodega = ubicaciones
          .filter(u => u.id_bodega === bodega.id_bodega && u.activo)
          .slice()
          .sort((a, b) => {
            const A = getNivelModulo(a.nombre)
            const B = getNivelModulo(b.nombre)
            if (A.nivel !== B.nivel) return A.nivel - B.nivel
            return A.modulo - B.modulo
          })

        return (
          <Accordion.Item eventKey={index.toString()} key={bodega.id_bodega}>
            <Accordion.Header>
              📦 {bodega.nombre} ({bodega.id_bodega})
            </Accordion.Header>
            <Accordion.Body>
              <Table striped bordered hover responsive>
                <thead>
                  <tr>
                    <th>Ubicación</th>
                    <th>Capacidad (m³)</th>
                    <th>Ocupado (m³)</th>
                    <th>Disponible (m³)</th>
                    <th>% Ocupación</th>
                  </tr>
                </thead>
                <tbody>
                  {ubicacionesBodega.map(ubic => {
                    const { ocupado, disponible, porcentaje } =
                      calcularOcupacionUbicacion(
                        ubic.id_ubicacion,
                        ubic.capacidad
                      )
                    const pct = parseFloat(porcentaje)

                    return (
                      <tr key={ubic.id_ubicacion}>
                        <td>{ubic.nombre}</td>
                        <td>{ubic.capacidad}</td>
                        <td>{ocupado}</td>
                        <td>{disponible}</td>
                        <td>
                          <ProgressBar
                            now={pct}
                            label={`${porcentaje}%`}
                            variant={
                              pct > 80
                                ? 'danger'
                                : pct > 50
                                ? 'warning'
                                : 'success'
                            }
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </Table>
            </Accordion.Body>
          </Accordion.Item>
        )
      })}
    </Accordion>
  )
}

export default BodegaTabla
