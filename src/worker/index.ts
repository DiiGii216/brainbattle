import { Room, type Env } from './room'

export { Room }

const CODE_RE = /^\d{6}$/

function newCode() {
  const a = new Uint32Array(1)
  crypto.getRandomValues(a)
  return String(100000 + (a[0] % 900000))
}
function newToken() {
  const a = new Uint8Array(24)
  crypto.getRandomValues(a)
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    if (url.pathname === '/api/rooms' && req.method === 'POST') {
      for (let i = 0; i < 8; i++) {
        const code = newCode()
        const hostToken = newToken()
        const stub = env.ROOM.get(env.ROOM.idFromName(code))
        const r = await stub.fetch('https://room/init', { method: 'POST', body: JSON.stringify({ code, hostToken }) })
        if (r.ok) return Response.json({ code, hostToken })
      }
      return new Response('Raum konnte nicht erstellt werden', { status: 503 })
    }
    const m = url.pathname.match(/^\/api\/rooms\/(\d{6})\/(ws|info)$/)
    if (m && CODE_RE.test(m[1])) {
      const stub = env.ROOM.get(env.ROOM.idFromName(m[1]))
      return stub.fetch(`https://room/${m[2]}`, req)
    }
    return new Response('Not found', { status: 404 })
  },
} satisfies ExportedHandler<Env>
