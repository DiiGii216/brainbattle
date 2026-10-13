import { useEffect, useState } from 'react'
import type { Answer, PublicQuestion } from '../shared/protocol'
import { LETTERS, OPT_STYLE, PAIR_COLORS } from './ui'

/** Interaktive Antworteingabe auf dem Handy. onSubmit sendet die endgültige Antwort. */
export default function Inputs({ q, onSubmit, paused }: { q: PublicQuestion; onSubmit: (a: Answer) => void; paused?: boolean }) {
  const [choice, setChoice] = useState<number | null>(null)
  const [map, setMap] = useState<(number | null)[]>(() => (q.lefts ?? []).map(() => null))
  const [activeLeft, setActiveLeft] = useState<number | null>(0)
  const [seq, setSeq] = useState<number[]>([])
  const [busy, setBusy] = useState(false)
  const submit = (a: Answer) => { if (busy) return; setBusy(true); onSubmit(a); setTimeout(() => setBusy(false), 2000) }

  useEffect(() => {
    if (q.format !== 'mc' && q.format !== 'who') return
    const h = (e: KeyboardEvent) => { const i = 'abcd'.indexOf(e.key.toLowerCase()); const n = '1234'.indexOf(e.key); const k = i >= 0 ? i : n; if (k >= 0 && k < 4) setChoice(k) }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [q.format])

  const SubmitBtn = ({ ok, onClick }: { ok: boolean; onClick: () => void }) => (
    <button className="btn btn-lime mt-4 w-full !min-h-[60px] text-lg" disabled={!ok || busy || paused} onClick={onClick}>Antwort abgeben 🔒</button>
  )

  if (q.format === 'tf') {
    return (
      <div className="flex flex-1 flex-col">
        <div className="grid flex-1 grid-rows-2 gap-3">
          {q.options!.map((o, i) => (
            <button key={i} aria-pressed={choice === i} onClick={() => setChoice(i)}
              className={`display grid place-items-center rounded-3xl text-4xl text-navy transition-all ${i === 0 ? 'bg-lime' : 'bg-coral'} ${choice === i ? 'scale-[1.02] ring-8 ring-snow' : choice !== null ? 'opacity-40' : ''}`}>
              <span><span className="block text-5xl" aria-hidden>{i === 0 ? '✅' : '🚫'}</span>{o}</span>
            </button>
          ))}
        </div>
        <SubmitBtn ok={choice !== null} onClick={() => submit(choice!)} />
      </div>
    )
  }

  if (q.format === 'mc' || q.format === 'who') {
    const who = q.format === 'who'
    return (
      <div className="flex flex-1 flex-col">
        <div className={`grid flex-1 gap-3 ${who ? 'grid-cols-1' : 'grid-cols-1 min-[480px]:grid-cols-2'}`} role="radiogroup">
          {q.options!.map((o, i) => {
            const st = OPT_STYLE[i]
            return (
              <button key={i} role="radio" aria-checked={choice === i} onClick={() => setChoice(i)}
                className={`flex min-h-[64px] items-center gap-3 rounded-2xl p-3 text-left text-base font-bold leading-snug transition-all ${who ? 'bg-navy3 text-snow' : `${st.bg} ${st.fg}`} ${choice === i ? 'scale-[1.02] ring-4 ring-snow' : choice !== null ? 'opacity-50' : ''}`}>
                <span className={`display grid h-10 w-10 shrink-0 place-items-center rounded-xl ${who ? `${st.bg} ${st.fg}` : 'bg-navy text-snow'}`}>{LETTERS[i]}</span>
                <span>{o}</span>
              </button>
            )
          })}
        </div>
        <SubmitBtn ok={choice !== null} onClick={() => submit(choice!)} />
      </div>
    )
  }

  if (q.format === 'match') {
    const used = new Map<number, number>() // rightIdx → leftIdx
    map.forEach((r, l) => r !== null && used.set(r, l))
    const pickRight = (k: number) => {
      if (activeLeft === null) return
      const next = [...map]
      const other = used.get(k)
      if (other !== undefined) next[other] = null
      next[activeLeft] = k
      setMap(next)
      const free = next.findIndex((v, i) => v === null && i !== activeLeft)
      setActiveLeft(free >= 0 ? free : null)
    }
    return (
      <div className="flex flex-1 flex-col gap-3">
        <p className="text-sm font-semibold text-steel">1. Begriff antippen · 2. passende Antwort antippen</p>
        <div className="flex flex-col gap-2">
          {q.lefts!.map((l, i) => (
            <button key={i} aria-pressed={activeLeft === i} onClick={() => setActiveLeft(i)}
              className={`rounded-2xl bg-navy3 p-3 text-left font-bold transition-all ${activeLeft === i ? 'ring-4 ring-snow' : ''}`} style={{ borderLeft: `10px solid ${PAIR_COLORS[i]}` }}>
              {l}
              <span className="mt-1 block text-sm font-semibold text-steel">{map[i] !== null ? `→ ${q.rights![map[i]!]}` : 'noch nicht zugeordnet'}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          {q.rights!.map((r, k) => {
            const owner = used.get(k)
            return (
              <button key={k} onClick={() => pickRight(k)} disabled={activeLeft === null && owner === undefined}
                className="flex min-h-[56px] items-center gap-3 rounded-2xl border-2 border-dashed border-sky/60 bg-navy2 p-3 text-left font-semibold" style={owner !== undefined ? { borderStyle: 'solid', borderColor: PAIR_COLORS[owner] } : {}}>
                {owner !== undefined && <span className="display grid h-8 w-8 shrink-0 place-items-center rounded-lg text-navy" style={{ background: PAIR_COLORS[owner] }}>{owner + 1}</span>}{r}
              </button>
            )
          })}
        </div>
        <div className="mt-auto"><SubmitBtn ok={map.every((v) => v !== null)} onClick={() => submit(map as number[])} /></div>
      </div>
    )
  }

  // order
  const n = q.items!.length
  return (
    <div className="flex flex-1 flex-col gap-3">
      <p className="text-sm font-semibold text-steel">Tippe die Elemente in der richtigen Reihenfolge an. Platziertes erneut antippen = zurück.</p>
      <ol className="flex flex-col gap-2">
        {Array.from({ length: n }, (_, pos) => (
          <li key={pos}>
            <button disabled={seq[pos] === undefined} onClick={() => setSeq(seq.slice(0, pos))}
              className={`flex min-h-[52px] w-full items-center gap-3 rounded-2xl p-3 text-left font-bold ${seq[pos] !== undefined ? 'a-pop bg-lime text-navy' : 'border-2 border-dashed border-steel/40 text-steel'}`}>
              <span className="display grid h-8 w-8 place-items-center rounded-lg bg-navy text-snow">{pos + 1}</span>
              {seq[pos] !== undefined ? q.items![seq[pos]] : 'frei'}
            </button>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        {q.items!.map((it, d) => !seq.includes(d) && (
          <button key={d} onClick={() => setSeq([...seq, d])} className="btn bg-navy3 !min-h-[52px] text-left">{it}</button>
        ))}
      </div>
      <div className="mt-auto"><SubmitBtn ok={seq.length === n} onClick={() => submit(seq)} /></div>
    </div>
  )
}
