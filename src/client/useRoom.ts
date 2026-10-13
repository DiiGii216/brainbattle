import { useCallback, useEffect, useRef, useState } from 'react'
import type { ClientMsg, ServerMsg, Snapshot } from '../shared/protocol'

export type Status = 'connecting' | 'open' | 'closed'
export interface RoomErr { code: string; msg: string }
const FATAL = new Set(['unknown_token', 'bad_host', 'closed_join', 'name_taken', 'bad_name', 'full'])

/** Verbindet per WebSocket, stellt nach Abbruch automatisch wieder her und liefert den Server-Snapshot. */
export function useRoom(code: string, helloFn: () => ClientMsg | null, onJoined?: (token: string, id: string) => void) {
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [status, setStatus] = useState<Status>('connecting')
  const [err, setErr] = useState<RoomErr | null>(null)
  const [offset, setOffset] = useState(0)
  const ws = useRef<WebSocket | null>(null)
  const hello = useRef(helloFn); hello.current = helloFn
  const joined = useRef(onJoined); joined.current = onJoined
  const [enabled, setEnabled] = useState(true)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let stop = false, tries = 0, timer: ReturnType<typeof setTimeout>
    const open = () => {
      const h = hello.current()
      if (stop || !h) { setStatus('closed'); return }
      setStatus('connecting')
      const w = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/rooms/${code}/ws`)
      ws.current = w
      w.onopen = () => { tries = 0; w.send(JSON.stringify(h)); setStatus('open') }
      w.onmessage = (e) => {
        const m: ServerMsg = JSON.parse(e.data)
        if (m.t === 'state') { setSnap(m.s); setOffset(m.s.now - Date.now()); setErr(null) }
        else if (m.t === 'joined') joined.current?.(m.token, m.id)
        else { setErr({ code: m.code, msg: m.msg }); if (FATAL.has(m.code)) stop = true }
      }
      w.onclose = () => {
        setStatus('closed')
        if (!stop) timer = setTimeout(open, Math.min(500 * 2 ** tries++, 5000))
      }
    }
    if (enabled) open()
    const wake = () => { if (document.visibilityState === 'visible' && ws.current?.readyState !== WebSocket.OPEN && !stop && enabled) { clearTimeout(timer); open() } }
    document.addEventListener('visibilitychange', wake)
    window.addEventListener('online', wake)
    return () => { stop = true; clearTimeout(timer); document.removeEventListener('visibilitychange', wake); window.removeEventListener('online', wake); ws.current?.close() }
  }, [code, enabled, nonce])

  const send = useCallback((m: ClientMsg) => { if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify(m)) }, [])
  const reconnect = useCallback(() => { setErr(null); setNonce((n) => n + 1) }, [])
  return { snap, status, err, offset, send, reconnect, setEnabled, clearErr: () => setErr(null) }
}

/** Server-synchronisierte aktuelle Zeit (nur zur Anzeige). */
export function useNow(offset: number, ms = 100) {
  const [t, setT] = useState(() => Date.now() + offset)
  useEffect(() => { const i = setInterval(() => setT(Date.now() + offset), ms); return () => clearInterval(i) }, [offset, ms])
  return t
}

export function remaining(s: Snapshot, now: number) {
  if (s.paused) return s.remainingMs ?? 0
  return s.endsAt === null ? null : Math.max(0, s.endsAt - now)
}
