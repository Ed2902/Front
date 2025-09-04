import { useState } from 'react'
import Sidebar from '../../components/Sidebar/Sidebar'
import MenuTickets from '../../components/Tickets/Menutickets/MenuTickets'
import SeccionDinamicaTickets from '../../components/Tickets/Secciontickets/SeccionDinamicaTickets'
import './Tickets.css'

export default function Tickets() {
  const [selectedSection, setSelectedSection] = useState(null)

  return (
    <section className='layout'>
      <Sidebar />
      <div className='body'>
        {/* 🧭 Menú de Tickets */}
        <MenuTickets
          selectedSection={selectedSection}
          onSelectSection={setSelectedSection}
        />

        {/* 🔁 Sección dinámica según lo seleccionado */}
        <SeccionDinamicaTickets selectedSection={selectedSection} />
      </div>
    </section>
  )
}
