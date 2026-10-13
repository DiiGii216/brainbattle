import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { FORMAT_INFO, type PlayerPub, type PublicQuestion, type Reveal, type Snapshot } from '../shared/protocol'
import { remaining, useNow } from './useRoom'

export const OPT_STYLE = [
  { bg: 'bg-lime', fg: 'text-navy', ring: 'ring-lime' },
  { bg: 'bg-coral', fg: 'text-navy', ring: 'ring-coral' },
  { bg: 'bg-sky', fg: 'text-navy', ring: 'ring-sky' },
  { bg: 'bg-amber', fg: 'text-navy', ring: 'ring-amber' },
]
export const LETTERS = ['A', 'B', 'C', 'D']
export const PAIR_COLORS = ['#D7FD68', '#FF756B', '#6CCBFF']

export function Logo({ small, huge }: { small?: boolean; huge?: boolean }) {
  return (
    <div className={`display leading-none ${small ? 'text-xl' : huge ? 'text-[5.5rem]' : 'text-4xl'}`}>
      <span className="text-lime">Brain</span> <span className="text-coral">Battle</span>
      {!small && <div className="mt-2 text-[0.35em] font-sans normal-case tracking-wide font-semibold text-steel">Personalplanung Edition</div>}
    </div>
  )
}

export function ConnectionBanner({ status }: { status: string }) {
  if (status === 'open') return null
  return (
    <div role="status" className="fixed inset-x-0 top-0 z-40 bg-coral px-4 py-2 text-center text-sm font-bold text-navy">
      Verbindung unterbrochen – verbinde neu …
    </div>
  )
}

export function QR({ url, size = 220 }: { url: string; size?: number }) {
  const [src, setSrc] = useState('')
  useEffect(() => { QRCode.toDataURL(url, { margin: 1, width: 480, color: { dark: '#101522', light: '#F7F8FA' } }).then(setSrc) }, [url])
  return src ? <img src={src} alt={`QR-Code zum Beitritt: ${url}`} width={size} height={size} className="rounded-2xl bg-snow p-2" style={{ width: size, height: size }} /> : <div style={{ width: size, height: size }} />
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
      <svg viewBox="0 0 100 100" className="-rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#26324b" strokeWidth="9" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={low ? '#FF756B' : '#D7FD68'} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - ratio)} style={{ transition: 'stroke-dashoffset .12s linear' }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center display tabular-nums" style={{ fontSize: size * 0.34 }}>
        {snap.paused ? '❚❚' : Math.ceil(rem / 1000)}
      </div>
    </div>
  )
}

export function FormatBadge({ q, big }: { q: { format: keyof typeof FORMAT_INFO; level: 'KNOW' | 'PROVE' }; big?: boolean }) {
  const f = FORMAT_INFO[q.format]
  return (
    <div className={`inline-flex items-center gap-2 rounded-full bg-navy3 font-extrabold ${big ? 'px-5 py-2 text-lg' : 'px-3 py-1 text-xs'}`}>
      <span aria-hidden>{f.emoji}</span>
      <span className="display">{f.name}</span>
      <span className={`rounded-full px-2 py-0.5 text-[0.8em] ${q.level === 'KNOW' ? 'bg-sky text-navy' : 'bg-coral text-navy'}`}>
        {q.level === 'KNOW' ? 'KNOW IT' : 'PROVE IT'}
      </span>
    </div>
  )
}

/** Ranking mit sanft animierten Platzwechseln (Zeilen sind absolut positioniert, Position per transform). */
export function RankList({ players, meId, limit, rowH = 3.4, delta }: { players: PlayerPub[]; meId?: string; limit?: number; rowH?: number; delta?: boolean }) {
  const list = limit ? players.slice(0, limit) : players
  const idx = new Map(list.map((p, i) => [p.id, i]))
  const stable = useMemo(() => [...list].sort((a, b) => a.id.localeCompare(b.id)), [list.map((p) => p.id).join()])
  return (
    <ol className="relative" style={{ height: `${list.length * rowH}rem` }}>
      {stable.map((p) => (
        <li key={p.id} className={`absolute inset-x-0 flex items-center gap-3 rounded-2xl px-3 ${p.id === meId ? 'bg-lime text-navy' : 'bg-navy2'}`}
          style={{ height: `${rowH - 0.4}rem`, transform: `translateY(${(idx.get(p.id) ?? 0) * rowH}rem)`, transition: 'transform .9s cubic-bezier(.3,.8,.2,1)' }}>
          <span className="display w-8 text-center text-lg tabular-nums">{p.rank}</span>
          <span className="text-2xl" aria-hidden>{p.avatar}</span>
          <span className="min-w-0 flex-1 truncate font-bold">{p.name}</span>
          {delta && p.delta > 0 && <span className="a-pop rounded-full bg-lime px-2 text-sm font-extrabold text-navy" style={p.id === meId ? { background: '#101522', color: '#D7FD68' } : {}}>+{p.delta}</span>}
          <span className="display tabular-nums">{p.score}</span>
        </li>
      ))}
    </ol>
  )
}

export function Confetti() {
  const pieces = useMemo(() => Array.from({ length: 70 }, (_, i) => ({
    left: Math.random() * 100, dx: (Math.random() - 0.5) * 300, d: 3 + Math.random() * 3, delay: Math.random() * 2.5,
    color: ['#D7FD68', '#FF756B', '#6CCBFF', '#FFC857', '#F7F8FA'][i % 5],
  })), [])
  return <>{pieces.map((p, i) => <i key={i} className="confetti" style={{ left: `${p.left}%`, background: p.color, ['--dx' as string]: `${p.dx}px`, animationDuration: `${p.d}s`, animationDelay: `${p.delay}s` }} />)}</>
}

/** Lösungstext für die Auflösung (Spieler-Handy). */
export function solutionLines(q: PublicQuestion, r: Reveal): string[] {
  if (r.solution.correct !== undefined) return [q.options![r.solution.correct]]
  if (r.solution.map) return q.lefts!.map((l, i) => `${l} → ${q.rights![r.solution.map![i]]}`)
  if (r.solution.order) return r.solution.order.map((d, i) => `${i + 1}. ${q.items![d]}`)
  return []
}

export function groupByRank(players: PlayerPub[]) {
  const m = new Map<number, PlayerPub[]>()
  players.forEach((p) => m.set(p.rank, [...(m.get(p.rank) ?? []), p]))
  return [...m].sort((a, b) => a[0] - b[0])
}
