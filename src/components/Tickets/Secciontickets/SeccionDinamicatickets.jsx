import './SeccionDinamicatickets.css'
import TicketsList from '../Usuario/TicketsList'
import TicketsSoporte from '../Soporte/TicketsSoporte'

const SeccionDinamicaTickets = ({ selectedSection }) => {
  let contenido
  switch (selectedSection) {
    case 'usuarios':
      contenido = <TicketsList />
      break

    case 'soporte':
      contenido = <TicketsSoporte />
      break

    default:
      contenido = <TicketsList />
  }

  return <div className='tickets-seccion'>{contenido}</div>
}

export default SeccionDinamicaTickets
