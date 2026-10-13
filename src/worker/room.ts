import { DurableObject } from 'cloudflare:workers'
import type { Answer, ClientMsg, Phase, PlayerPub, QResult, Reveal, ServerMsg, Snapshot } from '../shared/protocol'
import {
  AVATARS, NEXT_MS, RANKING_AFTER, RANKING_MS, REVEAL_MS, TOTAL, buildReveal, cleanName, cleanWord, publicQuestion,
  rankPlayers, scoreAnswer, validateAnswer,
} from './game'
import { QUESTIONS } from './questions'

export interface Env {
  ROOM: DurableObjectNamespace<Room>
  TIME_SCALE?: string
  ROOM_TTL_MS?: string
}

interface Player {
  id: string
  token: string
  name: string
  avatar: string
  score: number
  fullCount: number
  practiceFull: number
  delta: number
  results: QResult[]
  word: string | null
}

interface State {
  code: string
  hostToken: string
  lastActivity: number
  phase: Phase
  kind: 'next' | 'ranking' | null
  step: number
  qIndex: number // 0-basiert: aktuelle bzw. (in INTERMISSION) kommende Frage
  paused: boolean
  auto: boolean
  endsAt: number | null
  remainingMs: number | null
  durationMs: number
  players: Record<string, Player>
  order: string[]
  answers: Record<string, Answer>
  reveal: Reveal | null
  wordsHidden: boolean
}

interface Attach {
  role?: 'host' | 'screen' | 'player'
  pid?: string
}

const MAX_PLAYERS = 20
const MAX_MSG = 4096
const DEFAULT_TTL = 6 * 3600 * 1000

const rid = (bytes = 16) => {
  const a = new Uint8Array(bytes)
  crypto.getRandomValues(a)
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('')
}
function safeEq(a: string, b: string) {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}

export class Room extends DurableObject<Env> {
  s: State | null = null
  scale: number
  ttl: number

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    const sc = Number(env.TIME_SCALE)
    this.scale = sc > 0 && sc <= 1 ? sc : 1
    this.ttl = Number(env.ROOM_TTL_MS) > 0 ? Number(env.ROOM_TTL_MS) : DEFAULT_TTL
    ctx.blockConcurrencyWhile(async () => {
      this.s = (await ctx.storage.get<State>('s')) ?? null
    })
  }

  // ---------- HTTP ----------
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url)
    if (url.pathname === '/init' && req.method === 'POST') {
      if (this.s) return new Response('exists', { status: 409 })
      const { code, hostToken } = (await req.json()) as { code: string; hostToken: string }
      const now = Date.now()
      this.s = {
        code, hostToken, lastActivity: now, phase: 'LOBBY', kind: null, step: 0, qIndex: -1, paused: false, auto: true,
        endsAt: null, remainingMs: null, durationMs: 0, players: {}, order: [], answers: {}, reveal: null, wordsHidden: false,
      }
      await this.save()
      return new Response('ok')
    }
    if (!this.s) return new Response('not found', { status: 404 })
    if (url.pathname === '/info') return Response.json({ exists: true, phase: this.s.phase })
    if (req.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair()
      this.ctx.acceptWebSocket(pair[1])
      pair[1].serializeAttachment({} satisfies Attach)
      return new Response(null, { status: 101, webSocket: pair[0] })
    }
    return new Response('bad request', { status: 400 })
  }

  // ---------- WebSocket ----------
  async webSocketMessage(ws: WebSocket, data: string | ArrayBuffer) {
    const s = this.s
    if (!s || typeof data !== 'string' || data.length > MAX_MSG) return
    let msg: ClientMsg
    try {
      msg = JSON.parse(data)
    } catch {
      return
    }
    if (!msg || typeof msg !== 'object') return
    const ticked = await this.tick()
    const at = (ws.deserializeAttachment() ?? {}) as Attach
    const bail = async () => { if (ticked) { await this.save(); this.broadcast() } }
    if (at.role) s.lastActivity = Date.now()

    if (msg.t === 'hello') {
      if (at.role === 'player' && msg.role === 'player' && msg.name !== undefined) { this.err(ws, 'bad_hello', 'Bereits angemeldet'); return bail() }
      await this.hello(ws, msg)
      return bail()
    }
    if (!at.role) { this.err(ws, 'no_hello', 'Bitte zuerst anmelden'); return bail() }

    if (msg.t === 'answer' && at.role === 'player' && at.pid) await this.answer(ws, at.pid, msg)
    else if (msg.t === 'word' && at.role === 'player' && at.pid) await this.word(at.pid, msg.w)
    else if (msg.t === 'host') {
      if (at.role !== 'host') { this.err(ws, 'forbidden', 'Nur der Moderator darf das'); return bail() }
      await this.hostCmd(msg)
    }
    await this.save()
    this.broadcast()
  }

  async webSocketClose(ws: WebSocket) {
    try {
      ws.close()
    } catch { /* bereits geschlossen */ }
    this.broadcast()
  }
  async webSocketError() {
    this.broadcast()
  }

  async alarm() {
    if (!this.s) return
    await this.tick()
    if (Date.now() - this.s.lastActivity > this.ttl) {
      for (const w of this.ctx.getWebSockets()) { try { w.close(1001, 'Raum abgelaufen') } catch { /* weg */ } }
      await this.ctx.storage.deleteAll()
      this.s = null
      return
    }
    await this.save()
    this.broadcast()
  }

  // ---------- Hello / Identität ----------
  private async hello(ws: WebSocket, msg: Extract<ClientMsg, { t: 'hello' }>) {
    const s = this.s!
    if (msg.role === 'host') {
      if (typeof msg.hostToken !== 'string' || !safeEq(msg.hostToken, s.hostToken)) return this.err(ws, 'bad_host', 'Moderator-Schlüssel ungültig')
      ws.serializeAttachment({ role: 'host' } satisfies Attach)
    } else if (msg.role === 'screen') {
      ws.serializeAttachment({ role: 'screen' } satisfies Attach)
    } else if (msg.role === 'player') {
      let p: Player | undefined
      const tk = typeof msg.token === 'string' ? msg.token : null
      if (tk) p = Object.values(s.players).find((x) => safeEq(x.token, tk))
      if (tk && !p && (msg.name === undefined || !/^[0-9a-f]{32}$/.test(tk))) return this.err(ws, 'unknown_token', 'Spieler nicht mehr bekannt – bitte neu beitreten')
      if (!p) {
        if (s.phase !== 'LOBBY') return this.err(ws, 'closed_join', 'Das Spiel läuft bereits – neue Spieler sind nicht mehr möglich')
        const name = cleanName(msg.name)
        if (!name) return this.err(ws, 'bad_name', 'Bitte einen Namen eingeben')
        if (s.order.length >= MAX_PLAYERS) return this.err(ws, 'full', 'Der Raum ist voll')
        if (Object.values(s.players).some((x) => x.name.toLowerCase() === name.toLowerCase()))
          return this.err(ws, 'name_taken', 'Dieser Name ist schon vergeben')
        const used = new Set(Object.values(s.players).map((x) => x.avatar))
        const avatar = AVATARS.find((a) => !used.has(a)) ?? AVATARS[s.order.length % AVATARS.length]
        p = { id: rid(6), token: tk ?? rid(16), name, avatar, score: 0, fullCount: 0, practiceFull: 0, delta: 0, results: [], word: null }
        s.players[p.id] = p
        s.order.push(p.id)
      }
      ws.serializeAttachment({ role: 'player', pid: p.id } satisfies Attach)
      this.send(ws, { t: 'joined', token: p.token, id: p.id })
    } else return
    await this.save()
    this.broadcast()
  }

  // ---------- Spieleraktionen ----------
  private async answer(ws: WebSocket, pid: string, msg: Extract<ClientMsg, { t: 'answer' }>) {
    const s = this.s!
    if (s.phase !== 'QUESTION' || s.paused || s.endsAt === null || Date.now() >= s.endsAt) return this.err(ws, 'closed', 'Die Frage ist bereits geschlossen')
    if (msg.q !== QUESTIONS[s.qIndex].id) return this.err(ws, 'stale', 'Falsche Frage')
    if (s.answers[pid] !== undefined) return this.err(ws, 'locked', 'Antwort bereits abgegeben')
    const a = validateAnswer(QUESTIONS[s.qIndex], msg.a)
    if (a === null) return this.err(ws, 'bad_answer', 'Ungültige Antwort')
    s.answers[pid] = a
    // Alle haben geantwortet: Frage wird nicht vorzeitig beendet (faire, gleiche Zeit für alle).
  }

  private async word(pid: string, w: unknown) {
    const s = this.s!
    if (s.phase !== 'LOBBY') return
    s.players[pid].word = cleanWord(w)
  }

  // ---------- Moderator ----------
  private async hostCmd(msg: Extract<ClientMsg, { t: 'host' }>) {
    const s = this.s!
    const now = Date.now()
    switch (msg.cmd) {
      case 'start':
        if (s.phase === 'LOBBY' && s.order.length > 0) this.enter('INTERMISSION', now, { kind: 'next', qIndex: 0 })
        break
      case 'next':
        if (msg.step !== undefined && msg.step !== s.step) break // idempotent: veralteter Klick
        if (s.paused) break
        if (s.phase === 'QUESTION') this.advance(now)
        else if (s.phase === 'REVEAL' || s.phase === 'INTERMISSION') this.advance(now)
        break
      case 'close':
        if (s.phase === 'QUESTION' && !s.paused && (msg.step === undefined || msg.step === s.step)) this.advance(now)
        break
      case 'pause':
        if (!s.paused && s.endsAt !== null && (s.phase === 'QUESTION' || s.phase === 'REVEAL' || s.phase === 'INTERMISSION')) {
          s.remainingMs = Math.max(0, s.endsAt - now)
          s.endsAt = null
          s.paused = true
        } else if (!s.paused && s.endsAt === null && s.phase !== 'LOBBY' && s.phase !== 'FINAL') {
          s.paused = true // manuell wartende Phase
          s.remainingMs = null
        }
        break
      case 'resume':
        if (s.paused) {
          s.paused = false
          if (s.remainingMs !== null && (s.phase === 'QUESTION' || s.auto)) s.endsAt = now + s.remainingMs
          else this.arm(now)
          s.remainingMs = null
        }
        break
      case 'auto':
        if (s.auto !== !!msg.value) {
          s.auto = !!msg.value
          if (!s.paused) this.arm(now)
        }
        break
      case 'words':
        s.wordsHidden = !!msg.value
        break
      case 'reset':
        for (const p of Object.values(s.players)) {
          p.score = 0; p.fullCount = 0; p.practiceFull = 0; p.delta = 0; p.results = []
        }
        s.phase = 'LOBBY'; s.kind = null; s.qIndex = -1; s.paused = false; s.endsAt = null; s.remainingMs = null
        s.answers = {}; s.reveal = null; s.step++
        break
    }
  }

  // ---------- Zustandsmaschine ----------
  private dur(ms: number) {
    return Math.round(ms * this.scale)
  }

  /** Setzt Timer der aktuellen Phase (Fragen immer mit Deadline; übrige Phasen nur im Automatikmodus). */
  private arm(now: number) {
    const s = this.s!
    if (s.phase === 'LOBBY' || s.phase === 'FINAL') { s.endsAt = null; return }
    if (s.phase === 'QUESTION') return
    s.endsAt = s.auto ? now + s.durationMs : null
  }

  private enter(phase: Phase, at: number, o: { kind?: 'next' | 'ranking' | null; qIndex?: number; ms?: number } = {}) {
    const s = this.s!
    s.phase = phase
    s.kind = o.kind ?? null
    if (o.qIndex !== undefined) s.qIndex = o.qIndex
    s.step++
    s.paused = false
    s.remainingMs = null
    if (phase === 'QUESTION') {
      s.answers = {}
      s.reveal = null
      s.durationMs = this.dur(QUESTIONS[s.qIndex].seconds * 1000)
      s.endsAt = at + s.durationMs
    } else if (phase === 'REVEAL') {
      s.durationMs = this.dur(REVEAL_MS)
      s.endsAt = s.auto ? at + s.durationMs : null
    } else if (phase === 'INTERMISSION') {
      s.durationMs = this.dur(o.kind === 'ranking' ? RANKING_MS : NEXT_MS)
      s.endsAt = s.auto ? at + s.durationMs : null
    } else {
      s.endsAt = null
      s.durationMs = 0
    }
  }

  /** Genau ein Schritt weiter. `at` = Zeitpunkt des Übergangs. */
  private advance(at: number) {
    const s = this.s!
    switch (s.phase) {
      case 'INTERMISSION':
        if (s.kind === 'ranking') this.enter('INTERMISSION', at, { kind: 'next', qIndex: s.qIndex + 1 })
        else this.enter('QUESTION', at)
        break
      case 'QUESTION':
        this.closeQuestion()
        this.enter('REVEAL', at)
        break
      case 'REVEAL': {
        const n = s.qIndex + 1
        if (n >= TOTAL) this.enter('FINAL', at)
        else if (RANKING_AFTER.includes(n)) this.enter('INTERMISSION', at, { kind: 'ranking' })
        else this.enter('INTERMISSION', at, { kind: 'next', qIndex: n })
        break
      }
    }
  }

  private closeQuestion() {
    const s = this.s!
    const q = QUESTIONS[s.qIndex]
    for (const id of s.order) {
      const p = s.players[id]
      if (p.results[s.qIndex]) continue // idempotent
      const r = scoreAnswer(q, s.answers[id] ?? null)
      p.results[s.qIndex] = { points: r.points, full: r.full, answered: r.answered }
      p.score += r.points
      p.delta = r.points
      if (r.full) {
        p.fullCount++
        if (q.level === 'PROVE') p.practiceFull++
      }
    }
    s.reveal = buildReveal(q, Object.values(s.answers), s.order.length)
  }

  /** Holt verpasste Fristen nach (Alarm, Hibernation, Neustart). */
  private async tick() {
    const s = this.s
    let changed = false
    if (!s) return false
    for (let i = 0; i < 80 && !s.paused && s.endsAt !== null && Date.now() >= s.endsAt; i++) {
      const now = Date.now()
      const at = now - s.endsAt > 2000 ? now : s.endsAt // große Verspätung: keine Kettenreaktion
      this.advance(at)
      changed = true
    }
    return changed
  }

  // ---------- Persistenz, Alarm, Broadcast ----------
  private async save() {
    const s = this.s
    if (!s) return
    await this.ctx.storage.put('s', s)
    const next = !s.paused && s.endsAt !== null ? s.endsAt : s.lastActivity + this.ttl
    await this.ctx.storage.setAlarm(Math.max(next, Date.now() + (s.endsAt !== null && !s.paused ? 1 : 60_000)))
  }

  private send(ws: WebSocket, m: ServerMsg) {
    try { ws.send(JSON.stringify(m)) } catch { /* Verbindung weg */ }
  }
  private err(ws: WebSocket, code: string, msg: string) {
    this.send(ws, { t: 'err', code, msg })
  }

  private ranked() {
    const s = this.s!
    return rankPlayers(s.order.map((id) => s.players[id]))
  }

  private snapshot(at: Attach, connected: Set<string>): Snapshot {
    const s = this.s!
    const ranked = this.ranked()
    const rankOf = new Map(ranked.map((p) => [p.id, p.rank]))
    const players: PlayerPub[] = ranked.map((p) => ({
      id: p.id, name: p.name, avatar: p.avatar, score: p.score, rank: p.rank, connected: connected.has(p.id),
      fullCount: p.fullCount, practiceFull: p.practiceFull, delta: p.delta,
    }))
    const showQ = s.phase === 'QUESTION' || s.phase === 'REVEAL'
    const q = s.qIndex >= 0 ? QUESTIONS[s.qIndex] : null
    const counts = new Map<string, { word: string; count: number }>()
    if (s.phase === 'LOBBY')
      for (const p of Object.values(s.players)) if (p.word) {
        const k = p.word.toLowerCase(), c = counts.get(k)
        counts.set(k, { word: c?.word ?? p.word, count: (c?.count ?? 0) + 1 })
      }
    const words = s.wordsHidden ? [] : [...counts.values()].slice(0, 60)
    let you: Snapshot['you'] = null
    if (at.role === 'player' && at.pid && s.players[at.pid]) {
      const p = s.players[at.pid]
      you = {
        id: p.id, name: p.name, avatar: p.avatar, score: p.score, rank: rankOf.get(p.id) ?? 0,
        answered: s.answers[p.id] !== undefined && s.phase === 'QUESTION' ? true : s.phase === 'REVEAL' ? !!p.results[s.qIndex]?.answered : false,
        myAnswer: showQ ? (s.answers[p.id] ?? null) : null,
        result: s.phase === 'REVEAL' ? (p.results[s.qIndex] ?? null) : null,
        results: p.results,
      }
    }
    return {
      code: s.code, phase: s.phase, kind: s.kind, step: s.step, qIndex: s.qIndex, total: TOTAL, paused: s.paused, auto: s.auto,
      now: Date.now(), endsAt: s.endsAt, remainingMs: s.remainingMs, durationMs: s.durationMs, players,
      answeredCount: Object.keys(s.answers).length,
      question: showQ && q ? publicQuestion(q) : null,
      upcoming: s.phase === 'INTERMISSION' && s.kind === 'next' && q ? { number: q.id, format: q.format, topic: q.topic, level: q.level } : null,
      reveal: s.phase === 'REVEAL' ? s.reveal : null,
      words, wordsHidden: s.wordsHidden, you,
    }
  }

  private broadcast() {
    if (!this.s) return
    const sockets = this.ctx.getWebSockets()
    const atts = sockets.map((w) => (w.deserializeAttachment() ?? {}) as Attach)
    const connected = new Set(atts.filter((a, i) => a.pid && sockets[i].readyState === WebSocket.OPEN).map((a) => a.pid!))
    sockets.forEach((ws, i) => {
      if (!atts[i].role) return
      this.send(ws, { t: 'state', s: this.snapshot(atts[i], connected) })
    })
  }
}
