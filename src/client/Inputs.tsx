import { useEffect, useRef, useState } from 'react'
import { Check, CircleCheck, CircleX } from 'lucide-react'
import type { Answer, PublicQuestion } from '../shared/protocol'
import { Match, Order, type InputProps } from './DragInputs'
import { LETTERS } from './ui'

const CONFIRM_TIMEOUT = 5000

/**
 * Interaktive Antworteingabe auf dem Handy. `onSubmit` sendet die endgültige Antwort und liefert zurück, ob die Nachricht
 * tatsächlich auf die Leitung ging. Endgültig "abgegeben" ist die Antwort erst, wenn der Server-Snapshot `you.answered`
 * meldet – dann ersetzt Player diese Komponente durch die Sperransicht. Bis dahin zeigt sie nur "wird gesendet".
 */
export default function Inputs({ q, onSubmit, paused, serverErr }: { q: PublicQuestion; onSubmit: (a: Answer) => boolean; paused?: boolean; serverErr?: string }) {
  const [sending, setSending] = useState(false)
  const [note, setNote] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  useEffect(() => { if (serverErr) { clearTimeout(timer.current); setSending(false) } }, [serverErr])

  const submit = (a: Answer) => {
    if (sending || paused) return
    if (!onSubmit(a)) { setNote('Keine Verbindung – die Antwort wurde nicht gesendet. Sobald die Verbindung steht, erneut abgeben.'); return }
    setNote(''); setSending(true)
    timer.current = setTimeout(() => { setSending(false); setNote('Noch keine Bestätigung vom Server. Prüfe die Verbindung und gib die Antwort erneut ab.') }, CONFIRM_TIMEOUT)
  }
  // Pause sperrt nur das Absenden (Server lehnt Antworten ab); Anordnen bleibt möglich.
  const locked = sending
  const renderSubmit = ({ ready, hint, onClick }: { ready: boolean; hint: string; onClick: () => void }) => (
    <SubmitBar ready={ready} hint={hint} sending={sending} paused={!!paused} note={note} onClick={onClick} />
  )

  if (q.format === 'match') return <Match q={q} locked={locked} submit={submit} renderSubmit={renderSubmit} />
  if (q.format === 'order') return <Order q={q} locked={locked} submit={submit} renderSubmit={renderSubmit} />
  return <Choice q={q} locked={locked} submit={submit} renderSubmit={renderSubmit} />
}

function SubmitBar({ ready, hint, sending, paused, note, onClick }: { ready: boolean; hint: string; sending: boolean; paused: boolean; note: string; onClick: () => void }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-auto border-t border-line bg-bg px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-4">
      <p className="mb-2 text-center text-sm font-semibold text-mute" role="status">{sending ? 'Antwort wird an den Server gesendet …' : paused ? 'Pause – Eingabe gesperrt.' : hint}</p>
      {note && <p role="alert" className="mb-2 text-center text-sm font-bold text-bad">{note}</p>}
      <button type="button" className="btn btn-gold w-full !min-h-[60px] text-lg" disabled={!ready || sending || paused} aria-busy={sending} onClick={onClick}>
        {sending ? 'Wird gesendet …' : 'Antwort abgeben'}
      </button>
    </div>
  )
}

/** Quiz-Klassiker, Wer bin ich? (4 Optionen) und Fakt/Fake (2 Optionen): ein Index als Antwort. */
function Choice({ q, locked, submit, renderSubmit }: { q: PublicQuestion; locked: boolean; submit: (a: Answer) => void; renderSubmit: InputProps['renderSubmit'] }) {
  const [choice, setChoice] = useState<number | null>(null)
  const tf = q.format === 'tf'

  useEffect(() => {
    if (tf) return
    const h = (e: KeyboardEvent) => {
      if (locked || (e.target as HTMLElement | null)?.closest('input,textarea')) return
      const i = 'abcd'.indexOf(e.key.toLowerCase()), n = '1234'.indexOf(e.key), k = i >= 0 ? i : n
      if (k >= 0 && k < 4) setChoice(k)
    }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [tf, locked])

  return (
    <div className="flex flex-1 flex-col">
      <div role="radiogroup" aria-label="Antwortmöglichkeiten" className={`grid flex-1 gap-3 ${tf ? 'grid-rows-2' : 'auto-rows-min'}`}>
        {q.options!.map((o, i) => (
          <button key={i} type="button" role="radio" aria-checked={choice === i} disabled={locked} onClick={() => setChoice(i)}
            className={`choice flex items-center gap-3 p-3 text-left ${tf ? 'min-h-[120px] flex-col justify-center text-center' : 'min-h-[68px]'}`}>
            {tf
              ? <>{i === 0 ? <CircleCheck size={56} strokeWidth={1.75} aria-hidden /> : <CircleX size={56} strokeWidth={1.75} aria-hidden />}
                  <span className="display text-3xl">{i === 0 ? 'Fakt' : 'Fake'}</span></>
              : <>
                  <span className="badge-num h-10 w-10 shrink-0 rounded-xl text-lg !bg-deep !text-gold-light" aria-hidden>{LETTERS[i]}</span>
                  <span className="min-w-0 flex-1 text-lg font-bold leading-snug [overflow-wrap:anywhere]">{o}</span>
                  {choice === i && <Check key="c" className="a-pop shrink-0 text-gold" size={26} aria-hidden />}
                </>}
          </button>
        ))}
      </div>
      {renderSubmit({ ready: choice !== null, hint: choice === null ? 'Wähle eine Antwort.' : 'Du kannst die Auswahl noch ändern.', onClick: () => choice !== null && submit(choice) })}
    </div>
  )
}
