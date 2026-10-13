import { useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { FORMAT_INFO, type Answer, type PlayerPub, type PublicQuestion, type Reveal, type Snapshot } from '../shared/protocol'
import { remaining, useNow } from './useRoom'

export const LETTERS = ['A', 'B', 'C', 'D']
/** Zuordnungsnummern (Matchmaker): Farbe nur zur Wiedererkennung, nie als Hinweis auf Richtigkeit. */
export const PAIR_COLORS = ['#F5BE66', '#D5BDFF', '#FFD88E', '#AAB3CD']

export function Logo({ small, huge }: { small?: boolean; huge?: boolean }) {
  return (
    <div className={`display leading-none ${small ? 'text-xl' : huge ? 'text-[clamp(2.5rem,7vw,5.5rem)]' : 'text-4xl'}`}>
      <span className="text-gold">Brain</span> <span className="text-ink">Battle</span>
      {!small && <div className="mt-2 text-[0.35em] font-sans normal-case tracking-wide font-semibold text-violet-soft">Personalplanung Edition</div>}
    </div>
  )
}

export function ConnectionBanner({ status }: { status: string }) {
  if (status === 'open') return null
  return (
    <div role="status" className="fixed inset-x-0 top-0 z-40 bg-bad px-4 py-2 text-center text-sm font-bold text-bg">
      Verbindung unterbrochen – verbinde neu …
    </div>
  )
}

export function QR({ url, size = 220 }: { url: string; size?: number }) {
  const [src, setSrc] = useState('')
  useEffect(() => { QRCode.toDataURL(url, { margin: 1, width: 480, color: { dark: '#090D25', light: '#F7F8FD' } }).then(setSrc) }, [url])
  return src ? <img src={src} alt={`QR-Code zum Beitritt: ${url}`} width={size} height={size} className="max-w-full rounded-2xl bg-ink p-2" style={{ width: size, height: size }} /> : <div style={{ width: size, height: size }} />
}

export function Countdown({ snap, offset, size = 72 }: { snap: Snapshot; offset: number; size?: number }) {
  const now = useNow(offset, 100)
  const rem = remaining(snap, now)
  if (rem === null) return null
  const ratio = snap.durationMs ? Math.min(1, rem / snap.durationMs) : 0
  const r = 44, c = 2 * Math.PI * r
  const low = rem < 5000 && snap.phase === 'QUESTION'
  return (
    <div className={`relative shrink-0 ${low ? 'a-shake' : ''}`} style={{ width: size, height: size }} role="timer" aria-label={`${Math.ceil(rem / 1000)} Sekunden`}>
      <svg viewBox="0 0 100 100" className="-rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={r} fill="none" stroke="#303A61" strokeWidth="9" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={low ? '#F07178' : '#F5BE66'} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - ratio)} style={{ transition: 'stroke-dashoffset .12s linear' }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center display tabular-nums" style={{ fontSize: size * 0.34 }} aria-hidden>
        {snap.paused ? '❚❚' : Math.ceil(rem / 1000)}
      </div>
    </div>
  )
}

export function FormatBadge({ q, big }: { q: { format: keyof typeof FORMAT_INFO; level: 'KNOW' | 'PROVE' }; big?: boolean }) {
  const f = FORMAT_INFO[q.format]
  return (
    <div className={`inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface font-extrabold ${big ? 'px-4 py-1.5 text-base' : 'px-3 py-1 text-sm'}`}>
      <span aria-hidden>{f.emoji}</span>
      <span className="display">{f.name}</span>
      <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[0.8em] ${q.level === 'KNOW' ? 'bg-violet-soft text-bg' : 'bg-gold text-bg'}`}>
        {q.level === 'KNOW' ? 'KNOW IT' : 'PROVE IT'}
      </span>
    </div>
  )
}

const rankMemory = new Map<string, { idx: number; rank: number }>()

/**
 * Ranking mit sanft animierten Platzwechseln (Zeilen absolut positioniert, Position per transform).
 * `rowH` ist eine CSS-Länge (z. B. "3.4rem" oder clamp/calc), damit die Liste auch bei knapper Höhe vollständig passt.
 * Merkt sich Ränge über Remounts hinweg: deutliche Verbesserungen (≥ 2 Plätze) werden kurz hervorgehoben.
 */
export function RankList({ players, meId, limit, rowH = '3.4rem', delta }: { players: PlayerPub[]; meId?: string; limit?: number; rowH?: string; delta?: boolean }) {
  const list = limit ? players.slice(0, limit) : players
  const key = list.map((p) => `${p.id}:${p.rank}`).join()
  const [pos, setPos] = useState(() => new Map(list.map((p, i) => [p.id, rankMemory.get(p.id)?.idx ?? i])))
  const [climb, setClimb] = useState<Map<string, number>>(new Map())
  const prev = useRef(new Map([...rankMemory].map(([id, m]) => [id, m.rank])))
  const stable = useMemo(() => [...list].sort((a, b) => a.id.localeCompare(b.id)), [key]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const next = new Map(list.map((p, i) => [p.id, i]))
    const up = new Map<string, number>()
    list.forEach((p) => {
      const was = prev.current.get(p.id)
      if (was !== undefined && was - p.rank >= 2) up.set(p.id, was - p.rank)
      rankMemory.set(p.id, { idx: next.get(p.id)!, rank: p.rank })
    })
    prev.current = new Map(list.map((p) => [p.id, p.rank]))
    const raf = requestAnimationFrame(() => setPos(next))
    let t: ReturnType<typeof setTimeout> | undefined
    if (up.size) { setClimb(up); t = setTimeout(() => setClimb(new Map()), 2600) }
    return () => { cancelAnimationFrame(raf); if (t) clearTimeout(t) }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ol className="relative" style={{ ['--rh' as string]: rowH, height: `calc(var(--rh) * ${list.length})` }} aria-label="Rangliste">
      {stable.map((p) => {
        const me = p.id === meId
        const up = climb.get(p.id)
        return (
          <li key={p.id} aria-current={me ? 'true' : undefined}
            className={`absolute inset-x-0 flex items-center gap-2 rounded-xl px-3 sm:gap-3 ${me ? 'bg-gold text-bg' : 'border border-line bg-surface'} ${up ? 'a-climb' : ''}`}
            style={{ height: 'calc(var(--rh) - 0.35rem)', transform: `translateY(calc(var(--rh) * ${pos.get(p.id) ?? 0}))`, transition: 'transform .9s cubic-bezier(.3,.8,.2,1)' }}>
            <span className="display w-8 shrink-0 text-center text-base tabular-nums" aria-label={`Platz ${p.rank}`}>{p.rank}</span>
            <span className="text-xl leading-none" aria-hidden>{p.avatar}</span>
            <span className="min-w-0 flex-1 truncate font-bold">{p.name}</span>
            {up && <span className="a-pop shrink-0 rounded-full bg-ok px-2 text-sm font-extrabold text-bg">▲{up}</span>}
            {delta && p.delta > 0 && <span className={`a-pop shrink-0 rounded-full px-2 text-sm font-extrabold ${me ? 'bg-bg text-gold-light' : 'bg-deep text-gold-light'}`}>+{p.delta}</span>}
            <span className="display shrink-0 tabular-nums">{p.score}</span>
          </li>
        )
      })}
    </ol>
  )
}

/** Kurzes Konfetti (≈ 6 s, danach aus dem DOM entfernt). Bei prefers-reduced-motion per CSS ausgeblendet. */
export function Confetti() {
  const [on, setOn] = useState(true)
  useEffect(() => { const t = setTimeout(() => setOn(false), 7000); return () => clearTimeout(t) }, [])
  const pieces = useMemo(() => Array.from({ length: 60 }, (_, i) => ({
    left: Math.random() * 100, dx: (Math.random() - 0.5) * 300, d: 3 + Math.random() * 2.5, delay: Math.random() * 1.5,
    color: ['#F5BE66', '#FFD88E', '#8058D1', '#D5BDFF', '#F7F8FD'][i % 5],
  })), [])
  if (!on) return null
  return <div aria-hidden className="pointer-events-none fixed inset-0 z-50 overflow-hidden">{pieces.map((p, i) => <i key={i} className="confetti" style={{ left: `${p.left}%`, background: p.color, ['--dx' as string]: `${p.dx}px`, animationDuration: `${p.d}s`, animationDelay: `${p.delay}s` }} />)}</div>
}

/** Lösungstext für die Auflösung (Spieler-Handy). */
export function solutionLines(q: PublicQuestion, r: Reveal): string[] {
  if (r.solution.correct !== undefined) return [q.options![r.solution.correct]]
  if (r.solution.map) return q.lefts!.map((l, i) => `${l} → ${q.rights![r.solution.map![i]]}`)
  if (r.solution.order) return r.solution.order.map((d, i) => `${i + 1}. ${q.items![d]}`)
  return []
}

/** Lesbare Darstellung der vom Server gespeicherten eigenen Antwort. */
export function answerLines(q: PublicQuestion, a: Answer | null): string[] {
  if (a === null) return []
  if (typeof a === 'number') return [q.options![a]]
  if (q.format === 'match') return q.lefts!.map((l, i) => `${l} → ${q.rights![a[i]]}`)
  return a.map((d, i) => `${i + 1}. ${q.items![d]}`)
}

export function groupByRank(players: PlayerPub[]) {
  const m = new Map<number, PlayerPub[]>()
  players.forEach((p) => m.set(p.rank, [...(m.get(p.rank) ?? []), p]))
  return [...m].sort((a, b) => a[0] - b[0])
}
