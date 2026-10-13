import type { PublicQuestion, Reveal } from '../shared/protocol'
import { LETTERS, OPT_STYLE, PAIR_COLORS } from './ui'

/** Große, nicht interaktive Fragendarstellung für die Präsentationsansicht. Lösung nur bei übergebenem `reveal`. */
export default function Stage({ q, reveal }: { q: PublicQuestion; reveal: Reveal | null }) {
  const sol = reveal?.solution
  const counts = reveal?.stats.kind === 'options' ? reveal.stats.counts : null
  const total = counts ? counts.reduce((a, b) => a + b, 0) || 1 : 1

  const prompt = (
    <h2 className={`font-extrabold leading-tight ${q.format === 'who' ? 'display text-[2.3rem] normal-case' : 'text-[2.4rem]'} ${q.format === 'tf' ? 'rounded-3xl border-2 border-dashed border-steel/50 p-6' : ''}`}>
      {q.format === 'who' && <span className="mr-3 inline-block a-float" aria-hidden>🕵️</span>}
      {q.format === 'tf' ? `„${q.prompt}“` : q.prompt}
    </h2>
  )

  if (q.format === 'tf') {
    return (
      <div className="flex h-full flex-col gap-6">
        {prompt}
        <div className="grid flex-1 grid-cols-2 gap-6">
          {q.options!.map((o, i) => {
            const state = sol ? (sol.correct === i ? 'ok' : 'dim') : 'idle'
            return (
              <div key={i} className={`relative grid place-items-center rounded-3xl text-center transition-all duration-500 ${i === 0 ? 'bg-lime text-navy' : 'bg-coral text-navy'} ${state === 'dim' ? 'opacity-25 scale-95' : ''} ${state === 'ok' ? 'ring-8 ring-snow scale-105' : ''}`}>
                <div><div className="text-[4rem]" aria-hidden>{i === 0 ? '✅' : '🚫'}</div><div className="display text-[3.4rem]">{o}</div>
                  {counts && <div className="mt-2 text-2xl font-bold">{Math.round((counts[i] / total) * 100)} %</div>}</div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  if (q.format === 'mc' || q.format === 'who') {
    return (
      <div className="flex h-full flex-col gap-6">
        {prompt}
        <div className={`grid flex-1 gap-4 ${q.format === 'who' ? 'grid-cols-2' : 'grid-cols-2'}`}>
          {q.options!.map((o, i) => {
            const st = OPT_STYLE[i]
            const state = sol ? (sol.correct === i ? 'ok' : 'dim') : 'idle'
            return (
              <div key={i} className={`relative flex items-center gap-4 overflow-hidden rounded-3xl p-5 text-[1.6rem] font-bold leading-snug transition-all duration-500 ${q.format === 'who' ? 'bg-navy3 text-snow' : `${st.bg} ${st.fg}`} ${state === 'dim' ? 'opacity-25' : ''} ${state === 'ok' ? 'ring-8 ring-snow scale-[1.03]' : ''}`}>
                <span className={`display grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-2xl ${q.format === 'who' ? `${st.bg} ${st.fg}` : 'bg-navy text-snow'}`}>{LETTERS[i]}</span>
                <span className="min-w-0">{o}{state === 'ok' && ' ✓'}</span>
                {counts && <span className="absolute bottom-0 left-0 h-2 bg-navy/60" style={{ width: `${(counts[i] / total) * 100}%` }} />}
                {counts && <span className="ml-auto display text-xl">{counts[i]}</span>}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  if (q.format === 'match') {
    return (
      <div className="flex h-full flex-col gap-6">
        {prompt}
        <div className="grid flex-1 grid-cols-[1fr_auto_1fr] items-stretch gap-x-6 gap-y-4">
          <div className="flex flex-col justify-around gap-4">
            {q.lefts!.map((l, i) => (
              <div key={i} className="flex flex-1 items-center gap-4 rounded-3xl bg-navy3 p-5 text-[1.5rem] font-bold" style={sol ? { borderLeft: `14px solid ${PAIR_COLORS[i]}` } : {}}>{l}</div>
            ))}
          </div>
          <div className="grid place-items-center text-4xl text-steel" aria-hidden>⇄</div>
          <div className="flex flex-col justify-around gap-4">
            {q.rights!.map((r, k) => {
              const owner = sol?.map ? sol.map.indexOf(k) : -1
              return (
                <div key={k} className="flex flex-1 items-center rounded-3xl border-2 border-dashed border-sky/60 bg-navy2 p-5 text-[1.5rem] font-bold transition-all" style={owner >= 0 ? { borderStyle: 'solid', borderColor: PAIR_COLORS[owner], borderWidth: 6 } : {}}>
                  {owner >= 0 && <span className="display mr-3 grid h-10 w-10 place-items-center rounded-xl text-navy" style={{ background: PAIR_COLORS[owner] }}>{owner + 1}</span>}{r}
                </div>
              )
            })}
          </div>
        </div>
        {sol && reveal?.stats.kind === 'parts' && <PartsStats r={reveal} />}
      </div>
    )
  }

  // order
  const order = sol?.order
  return (
    <div className="flex h-full flex-col gap-6">
      {prompt}
      <div className="flex flex-1 flex-col justify-around gap-3">
        {(order ?? q.items!.map((_, i) => i)).map((d, pos) => (
          <div key={d} className="flex flex-1 items-center gap-5 rounded-3xl bg-navy3 px-6 text-[1.7rem] font-bold transition-all duration-700" style={order ? { background: '#D7FD68', color: '#101522' } : {}}>
            <span className="display grid h-12 w-12 place-items-center rounded-2xl bg-navy text-snow">{order ? pos + 1 : '?'}</span>{q.items![d]}
          </div>
        ))}
      </div>
      {sol && reveal?.stats.kind === 'parts' && <PartsStats r={reveal} />}
    </div>
  )
}

function PartsStats({ r }: { r: Reveal }) {
  if (r.stats.kind !== 'parts') return null
  return (
    <div className="flex gap-4 text-xl font-bold">
      <span className="rounded-full bg-lime px-4 py-1 text-navy">Alles richtig: {r.stats.full}</span>
      <span className="rounded-full bg-amber px-4 py-1 text-navy">Teilweise: {r.stats.partial}</span>
      <span className="rounded-full bg-coral px-4 py-1 text-navy">Nichts: {r.stats.none}</span>
    </div>
  )
}
