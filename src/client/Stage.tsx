import { Check, CircleCheck, CircleX } from 'lucide-react'
import type { PublicQuestion, Reveal } from '../shared/protocol'
import { LETTERS, PAIR_COLORS } from './ui'

/**
 * Nicht interaktive Fragendarstellung für die Präsentationsansicht. Lösung nur bei übergebenem `reveal`.
 * Größen kommen aus den begrenzten Klassen .s-question/.s-answer (index.css) – keine Skalierung der gesamten Oberfläche.
 * Vor der Auflösung sehen alle Antworten gleich aus (keine Farbe verrät die Lösung).
 */
export default function Stage({ q, reveal }: { q: PublicQuestion; reveal: Reveal | null }) {
  const sol = reveal?.solution
  const counts = reveal?.stats.kind === 'options' ? reveal.stats.counts : null
  const total = counts ? counts.reduce((a, b) => a + b, 0) || 1 : 1
  const who = q.format === 'who'

  const prompt = (
    <h2 className={`s-question shrink-0 font-extrabold [overflow-wrap:anywhere] ${who ? 'mystery rounded-2xl px-5 py-3 italic' : ''} ${q.format === 'tf' ? 'rounded-2xl border-2 border-dashed border-line-strong px-5 py-3' : ''}`}>
      {who && <span className="mr-3 inline-block" aria-hidden>🕵️</span>}
      {q.format === 'tf' ? `„${q.prompt}“` : q.prompt}
    </h2>
  )
  const state = (i: number) => (sol ? (sol.correct === i ? 'ok' : 'dim') : 'idle')
  const cardCls = (st: string) => `relative flex min-h-0 items-center gap-4 overflow-hidden rounded-2xl border-2 px-5 py-2 transition-all duration-500 ${st === 'ok' ? 'border-ok bg-ok/20 ring-4 ring-ok' : 'border-line-strong bg-surface'} ${st === 'dim' ? 'opacity-35' : ''}`

  if (q.format === 'tf') {
    return (
      <div className="flex h-full min-h-0 flex-col s-gap">
        {prompt}
        <div className="grid min-h-0 flex-1 grid-cols-2 s-gap">
          {q.options!.map((o, i) => (
            <div key={i} className={`${cardCls(state(i))} flex-col justify-center text-center`}>
              {i === 0 ? <CircleCheck className="h-[clamp(2rem,9vh,4.5rem)] w-auto" strokeWidth={1.75} aria-hidden /> : <CircleX className="h-[clamp(2rem,9vh,4.5rem)] w-auto" strokeWidth={1.75} aria-hidden />}
              <div className="display text-[clamp(1.75rem,min(4vw,7vh),3.5rem)]">{i === 0 ? 'Fakt' : 'Fake'}{state(i) === 'ok' && <span className="sr-only"> – richtig</span>}</div>
              {counts && <div className="s-info font-bold">{Math.round((counts[i] / total) * 100)} %</div>}
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (q.format === 'mc' || who) {
    return (
      <div className="flex h-full min-h-0 flex-col s-gap">
        {prompt}
        <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-2 s-gap">
          {q.options!.map((o, i) => {
            const st = state(i)
            return (
              <div key={i} className={cardCls(st)}>
                <span className="display grid h-[clamp(2rem,6vh,3.25rem)] w-[clamp(2rem,6vh,3.25rem)] shrink-0 place-items-center rounded-xl bg-deep text-gold-light s-answer">{LETTERS[i]}</span>
                <span className="s-answer min-w-0 flex-1 font-bold [overflow-wrap:anywhere]">{o}{st === 'ok' && <><Check className="ml-2 inline text-ok" size={28} aria-hidden /><span className="sr-only"> – richtig</span></>}</span>
                {counts && <span className="display s-info shrink-0">{counts[i]}</span>}
                {counts && <span className="absolute bottom-0 left-0 h-1.5 bg-gold" style={{ width: `${(counts[i] / total) * 100}%` }} />}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  if (q.format === 'match') {
    return (
      <div className="flex h-full min-h-0 flex-col s-gap">
        {prompt}
        <div className="grid min-h-0 flex-1 grid-cols-[1fr_auto_1fr] items-stretch gap-x-4">
          <div className="flex min-h-0 flex-col s-gap">
            {q.lefts!.map((l, i) => (
              <div key={i} className="flex min-h-0 flex-1 items-center gap-3 rounded-2xl border-2 border-line-strong bg-surface px-4 py-2 s-answer font-bold [overflow-wrap:anywhere]" style={sol ? { borderLeft: `12px solid ${PAIR_COLORS[i]}` } : {}}>
                {sol && <span className="badge-num h-9 w-9 shrink-0 rounded-lg text-lg" style={{ background: PAIR_COLORS[i] }}>{i + 1}</span>}{l}
              </div>
            ))}
          </div>
          <div className="grid place-items-center text-3xl text-mute" aria-hidden>⇄</div>
          <div className="flex min-h-0 flex-col s-gap">
            {q.rights!.map((r, k) => {
              const owner = sol?.map ? sol.map.indexOf(k) : -1
              return (
                <div key={k} className={`dropzone flex min-h-0 flex-1 items-center gap-3 px-4 py-2 s-answer font-bold [overflow-wrap:anywhere] ${owner >= 0 ? 'is-filled' : ''}`} style={owner >= 0 ? { borderColor: PAIR_COLORS[owner], borderWidth: 4 } : {}}>
                  {owner >= 0 && <span className="badge-num h-9 w-9 shrink-0 rounded-lg text-lg" style={{ background: PAIR_COLORS[owner] }}>{owner + 1}</span>}{r}
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
    <div className="flex h-full min-h-0 flex-col s-gap">
      {prompt}
      <div className="flex min-h-0 flex-1 flex-col s-gap">
        {(order ?? q.items!.map((_, i) => i)).map((d, pos) => (
          <div key={d} className={`flex min-h-0 flex-1 items-center gap-4 rounded-2xl border-2 px-5 py-1 s-answer font-bold transition-all duration-700 [overflow-wrap:anywhere] ${order ? 'border-ok bg-ok/20' : 'border-line-strong bg-surface'}`}>
            <span className="display grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-deep text-gold-light">{order ? pos + 1 : '?'}</span>{q.items![d]}
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
    <div className="s-info flex shrink-0 flex-wrap gap-3 font-bold">
      <span className="rounded-full bg-ok px-4 py-1 text-bg">Alles richtig: {r.stats.full}</span>
      <span className="rounded-full bg-gold-light px-4 py-1 text-bg">Teilweise: {r.stats.partial}</span>
      <span className="rounded-full bg-bad px-4 py-1 text-bg">Nichts: {r.stats.none}</span>
    </div>
  )
}
