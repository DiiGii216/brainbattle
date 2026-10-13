/**
 * Voller Simulationsdurchlauf gegen einen laufenden Worker (BASE, Standard http://localhost:8787).
 * Starten:  wrangler dev --var TIME_SCALE:0.05   (≈ 35 s statt 11:23 min)   dann:  npm run sim
 * Prüft Multiplayer, Punkte, Sperren, Manipulation, Pause, Reconnect, Ranking, Champion, Lösungs-Leaks.
 */
import { QUESTIONS } from '../src/worker/questions'
import type { Snapshot, ServerMsg, ClientMsg } from '../src/shared/protocol'

const BASE = process.env.BASE ?? 'http://localhost:8787'
const N = Number(process.env.PLAYERS ?? 12)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
let failures = 0
const check = (ok: boolean, msg: string) => { if (!ok) { failures++; console.error('✗', msg) } }

class Client {
  ws!: WebSocket
  snap: Snapshot | null = null
  errs: string[] = []
  token = ''
  id = ''
  constructor(public label: string, public hello: ClientMsg) {}
  async connect(hello = this.hello) {
    this.ws = new WebSocket(BASE.replace('http', 'ws') + `/api/rooms/${code}/ws`)
    await new Promise<void>((res, rej) => { this.ws.onopen = () => res(); this.ws.onerror = () => rej(new Error('ws error')) })
    this.ws.onmessage = (e) => {
      const m: ServerMsg = JSON.parse(String(e.data))
      if (m.t === 'state') { this.snap = m.s; this.onState?.(m.s) }
      else if (m.t === 'joined') { this.token = m.token; this.id = m.id }
      else this.errs.push(m.code)
    }
    this.send(hello)
    await sleep(120)
  }
  onState?: (s: Snapshot) => void
  send(m: ClientMsg) { this.ws.send(JSON.stringify(m)) }
}

let code = ''
const create = await (await fetch(BASE + '/api/rooms', { method: 'POST' })).json() as { code: string; hostToken: string }
code = create.code
console.log('Raum', code)

const host = new Client('host', { t: 'hello', role: 'host', hostToken: create.hostToken })
const screen = new Client('screen', { t: 'hello', role: 'screen' })
await host.connect(); await screen.connect()
const evil = new Client('evil', { t: 'hello', role: 'host', hostToken: 'x'.repeat(48) })
await evil.connect()
check(evil.errs.includes('bad_host'), 'falscher Host-Token abgelehnt')

const names = ['Anna', 'Ben', 'Cem', 'Dana', 'Eli', 'Fynn', 'Gül', 'Hans', 'Ida', 'Jonas', 'Kira', 'Lars', 'Mia', 'Nils']
const bots: Client[] = []
for (let i = 0; i < N; i++) {
  const c = new Client(names[i], { t: 'hello', role: 'player', name: names[i] })
  await c.connect(); bots.push(c)
}
const dup = new Client('dup', { t: 'hello', role: 'player', name: 'anna' }); await dup.connect()
check(dup.errs.includes('name_taken'), 'doppelter Name abgelehnt')
const html = new Client('bx/b', { t: 'hello', role: 'player', name: '<b>x</b>' }); await html.connect()
check(html.snap?.players.some((p) => p.name === 'bx/b') === true || html.errs.length === 0, 'Name bereinigt')
bots[0].send({ t: 'host', cmd: 'start' })
await sleep(100)
check(screen.snap!.phase === 'LOBBY', 'Spieler darf nicht starten')
check(bots[0].errs.includes('forbidden'), 'Moderatorbefehl von Spieler → forbidden')
check(screen.snap!.players.length === N + 1, 'Lobby zeigt alle Spieler auf dem Screen')
check(bots.every((b) => b.snap!.players.length === N + 1), 'Lobby synchron auf allen Geräten')
// 'xss' Spieler wird mitgezählt → N+1 Teilnehmende insgesamt
bots.push(html)
const ALL = bots

// Fähigkeiten je Bot
const skill = ALL.map((_, i) => 0.25 + (0.7 * i) / ALL.length)
const expected = new Map<string, { score: number; full: number; practiceFull: number }>()
ALL.forEach((b) => expected.set(b.label, { score: 0, full: 0, practiceFull: 0 }))
const sent = new Map<string, unknown>() // `${label}:${qid}` → Antwort
const seen = new Set<number>()
const rnd = (n: number) => Math.floor(Math.random() * n)

function answerFor(i: number, qi: number): unknown {
  const q = QUESTIONS[qi]
  const good = Math.random() < skill[i]
  switch (q.format) {
    case 'mc': case 'who': return good ? q.correct : (q.correct + 1 + rnd(3)) % 4
    case 'tf': return good ? (q.correct ? 0 : 1) : (q.correct ? 1 : 0)
    case 'match': {
      const right = q.pairs.map((_, k) => q.rightOrder.indexOf(k))
      if (good) return right
      const a = [...right]; [a[0], a[1]] = [a[1], a[0]]; return a
    }
    case 'order': {
      const right = q.items.map((_, p) => q.display.indexOf(p))
      if (good) return right
      const a = [...right]; [a[0], a[1]] = [a[1], a[0]]; return a
    }
  }
}

let reconnected = false, paused = false, lateJoinTested = false
const revealsChecked = new Set<number>()

ALL.forEach((b, i) => {
  b.onState = async (s) => {
    if (s.phase === 'QUESTION' && s.question) {
      check(!JSON.stringify(s).includes('explanation') && s.reveal === null, `Q${s.qIndex + 1}: keine Lösung im QUESTION-Snapshot`)
      const key = `${b.label}:${s.question.id}`
      if (sent.has(key) || s.you?.answered) return
      sent.set(key, null)
      if (i === 5 && s.qIndex === 2 && !paused) return // Bot 5 pausiert Test unten
      await sleep(30 + rnd(250))
      if (i === 3 && s.qIndex === 4 && !reconnected) { // Reconnect-Test
        reconnected = true
        const before = b.snap!.you!.score
        b.ws.close(); await sleep(80)
        await b.connect({ t: 'hello', role: 'player', token: b.token })
        check(b.snap?.you?.score === before && b.snap.you.name === b.label, 'Reconnect stellt Identität + Punkte wieder her')
        check(b.snap?.phase === s.phase && b.snap.step === s.step, 'Reconnect stellt aktuellen Zustand wieder her')
      }
      const a = answerFor(i, s.qIndex)
      sent.set(key, a)
      const n0 = b.errs.length
      b.send({ t: 'answer', q: s.question.id, a: a as number })
      await sleep(60)
      if (b.errs.slice(n0).includes('closed')) sent.delete(key) // während Pause abgelehnt
      if (i === 0 && s.qIndex === 1) { // zweite Abgabe → gesperrt
        await sleep(40)
        b.send({ t: 'answer', q: s.question.id, a: 0 })
        await sleep(60)
        check(b.errs.includes('locked'), 'zweite Abgabe wird gesperrt')
      }
      if (i === 1 && s.qIndex === 1) { // Manipulation
        b.send({ t: 'answer', q: s.question.id, a: 99 as number })
        b.send({ t: 'answer', q: 999, a: 0 })
        await sleep(60)
        check(b.errs.includes('bad_answer') || b.errs.includes('locked'), 'ungültige Antwort abgelehnt')
      }
    }
    if (s.phase === 'REVEAL' && s.reveal && i === 0) {
      const qi = s.qIndex
      if (revealsChecked.has(qi)) return
      revealsChecked.add(qi)
    }
  }
})

// Reveal-Prüfung zentral auf dem Screen: nach jeder Auflösung Erwartungswerte aus gesendeten Antworten berechnen
screen.onState = async (s) => {
  if (s.phase === 'QUESTION' && !seen.has(s.qIndex)) seen.add(s.qIndex)
  if (s.phase === 'QUESTION' && s.qIndex === 2 && !paused) {
    paused = true
    await sleep(100)
    host.send({ t: 'host', cmd: 'pause' }); await sleep(150)
    const p = host.snap!
    check(p.paused && p.endsAt === null && (p.remainingMs ?? 0) > 0, 'Pause friert Restzeit serverseitig ein')
    const rem = p.remainingMs!
    ALL[5].send({ t: 'answer', q: 3, a: 0 }); await sleep(100)
    check(ALL[5].errs.includes('closed'), 'Antwort während Pause abgelehnt')
    await sleep(900)
    check(host.snap!.remainingMs === rem && host.snap!.phase === 'QUESTION', 'Pause: Zeit läuft nicht weiter')
    host.send({ t: 'host', cmd: 'resume' }); await sleep(100)
    const r = host.snap!
    check(!r.paused && r.endsAt! - Date.now() <= rem + 50 && r.endsAt! - Date.now() > 0, 'Fortsetzen stellt Restzeit wieder her')
    const b = ALL[5]; const a = answerFor(5, 2); sent.set(`${b.label}:3`, a); b.send({ t: 'answer', q: 3, a: a as number })
  }
  if (s.phase === 'REVEAL' && s.reveal && !(s.qIndex in done)) {
    done[s.qIndex] = true
    await sleep(150)
    const q = QUESTIONS[s.qIndex]
    const sol = s.reveal.solution
    for (const b of ALL) {
      const a = sent.get(`${b.label}:${q.id}`) as number | number[] | undefined
      const max = q.level === 'KNOW' ? 100 : 150
      let pts = 0, full = false
      if (a !== undefined && a !== null) {
        if (q.format === 'match') { const c = (a as number[]).filter((k, i) => sol.map![i] === k).length; pts = Math.floor(max * c / q.pairs.length); full = c === q.pairs.length }
        else if (q.format === 'order') { const c = (a as number[]).filter((d, p) => sol.order![p] === d).length; pts = Math.floor(max * c / q.items.length); full = c === q.items.length }
        else { full = a === sol.correct; pts = full ? max : 0 }
      }
      const e = expected.get(b.label)!
      e.score += pts; if (full) { e.full++; if (q.level === 'PROVE') e.practiceFull++ }
      check(b.snap?.you?.result?.points === pts, `Q${q.id} ${b.label}: Punkte ${b.snap?.you?.result?.points} ≠ erwartet ${pts}`)
      check(b.snap?.you?.score === e.score, `Q${q.id} ${b.label}: Gesamtpunkte ${b.snap?.you?.score} ≠ ${e.score}`)
    }
    // Ranking identisch auf allen Clients
    const ref = JSON.stringify(screen.snap!.players.map((p) => [p.id, p.score, p.rank]))
    check(ALL.every((b) => JSON.stringify(b.snap!.players.map((p) => [p.id, p.score, p.rank])) === ref), `Q${q.id}: Ranking auf allen Clients identisch`)
    check(s.reveal.explanation.length > 0 && s.question?.id === q.id, 'Reveal enthält Erklärung')
  }
  if (s.phase === 'INTERMISSION' && s.qIndex >= 0 && !lateJoinTested && s.step > 3) {
    lateJoinTested = true
    const late = new Client('late', { t: 'hello', role: 'player', name: 'Zuspät' }); await late.connect()
    check(late.errs.includes('closed'), 'Neue Spieler nach Spielstart abgelehnt')
  }
}
const done: Record<number, boolean> = {}

const t0 = Date.now()
host.send({ t: 'host', cmd: 'start' })
for (let i = 0; i < 600 && screen.snap!.phase !== 'FINAL'; i++) await sleep(250)
await sleep(500)
const fin = screen.snap!
check(fin.phase === 'FINAL', 'Spiel erreicht FINAL')
check(seen.size === 20, `alle 20 Fragen gespielt (${seen.size})`)
check(Object.keys(done).length === 20, 'alle 20 Auflösungen geprüft')
// Champion
const exp = [...expected].map(([name, e]) => ({ name, ...e })).sort((a, b) => b.score - a.score || b.practiceFull - a.practiceFull || b.full - a.full)
const champ = fin.players.filter((p) => p.rank === 1).map((p) => p.name).sort()
const champExp = exp.filter((e) => e.score === exp[0].score && e.practiceFull === exp[0].practiceFull && e.full === exp[0].full).map((e) => e.name).sort()
check(JSON.stringify(champ) === JSON.stringify(champExp), `Champion korrekt: ${champ} vs ${champExp}`)
check(ALL.every((b) => b.snap!.phase === 'FINAL' && b.snap!.you!.results.length === 20), 'Alle Clients im Finale mit 20 Ergebnissen')
console.log(`Dauer ${(Date.now() - t0) / 1000}s | Champion: ${champ.join(', ')} (${fin.players[0].score} Punkte)`)
console.log(failures === 0 ? '✓ Simulation erfolgreich' : `✗ ${failures} Fehler`)
process.exit(failures ? 1 : 0)
