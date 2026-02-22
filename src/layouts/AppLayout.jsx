import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from '../components/Sidebar/Sidebar'
import FloatingChat from '../components/chat/FloatingChat'
import './AppLayout.css'

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className={`app-layout ${collapsed ? 'collapsed' : ''}`}>
      <Sidebar onToggleCollapse={setCollapsed} />

      <main className='app-main'>
        <Outlet />
      </main>

      <FloatingChat />
    </div>
  )
}
