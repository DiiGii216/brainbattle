import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Landing from './Landing'
import Player from './Player'
import Host from './Host'
import Screen from './Screen'

function App() {
  const m = location.pathname.match(/^\/(join|host|screen)\/(\d{6})\/?$/)
  if (m?.[1] === 'join') return <Player code={m[2]} />
  if (m?.[1] === 'host') return <Host code={m[2]} />
  if (m?.[1] === 'screen') return <Screen code={m[2]} />
  return <Landing />
}
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
