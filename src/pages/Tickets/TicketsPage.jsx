import { useEffect, useState } from 'react'
import MenuTickets from '../../components/Tickets/Menutickets/Menutickets'
import SeccionDinamicaTickets from '../../components/Tickets/Secciontickets/SeccionDinamicatickets'
import './Tickets.css'

export default function Tickets() {
  const [selectedSection, setSelectedSection] = useState(null)

  // 🔔 Leer sección desde la URL (push / deep-link)
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search)
      const sectionFromUrl = sp.get('ticketsSection')

      if (sectionFromUrl) {
        setSelectedSection(sectionFromUrl)
      } else {
        setSelectedSection('misTareas')
      }
    } catch {
      setSelectedSection('misTareas')
    }
  }, [])

  return (
    <div className='page'>
      <MenuTickets
        selectedSection={selectedSection}
        onSelectSection={setSelectedSection}
      />

      <SeccionDinamicaTickets selectedSection={selectedSection} />
    </div>
  )
}
