import { useState } from 'react'
import { DragDropProvider, KeyboardSensor, type DragEndEvent, type DragMoveEvent, PointerSensor, useDragOperation, useDraggable, useDroppable } from '@dnd-kit/react'
import { useSortable } from '@dnd-kit/react/sortable'
import { Accessibility, PointerActivationConstraints } from '@dnd-kit/dom'
import { move } from '@dnd-kit/helpers'
import { ChevronDown, ChevronUp, GripVertical, RotateCcw, X } from 'lucide-react'
import type { PublicQuestion } from '../shared/protocol'
import { appendSeq, isMatchComplete, moveSeq, nextFreeLeft, placeMatch, releaseMatch, type MatchMap } from './inputLogic'
import { PAIR_COLORS } from './ui'

export interface InputProps {
  q: PublicQuestion
  /** true, solange die Antwort gesendet wird bzw. die Frage pausiert: Eingabe gesperrt. */
  locked: boolean
  submit: (a: number | number[]) => void
  renderSubmit: (p: { ready: boolean; hint: string; onClick: () => void }) => React.ReactNode
}

/* ---------- dnd-kit-Konfiguration (einheitlich für beide Formate) ---------- */
// Touch: Karte erst nach kurzem Halten (220 ms, ≤ 8 px Bewegung) aufnehmen → normales Scrollen bleibt möglich.
// Am sichtbaren Griff (Handle) startet der Zug sofort; nur dort ist touch-action: none gesetzt.
const pointerSensor = PointerSensor.configure({
  activatorElements: (source) => [source.element, source.handle].filter((e): e is Element => !!e),
  activationConstraints: (event, source) => {
    const onHandle = !!source.handle && event.target instanceof Node && source.handle.contains(event.target)
    if (event.pointerType === 'touch' && !onHandle) return [new PointerActivationConstraints.Delay({ value: 220, tolerance: 8 })]
    return [new PointerActivationConstraints.Distance({ value: 4 })]
  },
})
const label = (s: { data?: Record<string, unknown> } | null | undefined) => String(s?.data?.label ?? 'Karte')
const a11yPlugin = Accessibility.configure({
  announcements: {
    dragstart: (e: DragMoveEvent) => `${label(e.operation.source)} aufgenommen.`,
    dragover: (e: DragMoveEvent) => (e.operation.target ? `${label(e.operation.source)} über ${label(e.operation.target)}.` : undefined),
    dragend: (e: DragEndEvent) => (e.canceled ? 'Verschieben abgebrochen.' : `${label(e.operation.source)} abgelegt.`),
  },
  screenReaderInstructions: { draggable: 'Zum Aufnehmen Leertaste oder Eingabetaste drücken, mit den Pfeiltasten bewegen, Leertaste zum Ablegen, Escape zum Abbrechen. Alternativ die Schaltflächen verwenden.' },
})
const withGermanA11y = (defaults: unknown[]) => [...defaults.filter((p) => p !== Accessibility), a11yPlugin]
const MATCH_SENSORS = [pointerSensor] // Tastatur/Screenreader nutzen die Tippen-Bedienung (echte Buttons)
const ORDER_SENSORS = [pointerSensor, KeyboardSensor]

/* ---------- Matchmaker ---------- */
export function Match({ q, locked, submit, renderSubmit }: InputProps) {
  const lefts = q.lefts!, rights = q.rights!
  const [map, setMap] = useState<MatchMap>(() => lefts.map(() => null))
  const [active, setActive] = useState<number | null>(0)
  const [dragging, setDragging] = useState(false)
  const [live, setLive] = useState('')

  /** Einziger Schreibzugriff auf die Antwort – von Tippen und Ziehen gemeinsam genutzt. */
  const assign = (l: number, k: number) => {
    if (locked) return
    const next = placeMatch(map, l, k)
    setMap(next)
    setActive(nextFreeLeft(next, l))
    setLive(`${lefts[l]} wurde „${rights[k]}“ zugeordnet.`)
  }
  const release = (l: number) => { if (locked) return; setMap(releaseMatch(map, l)); setActive(l); setLive(`Zuordnung von ${lefts[l]} gelöst.`) }
  const reset = () => { if (locked) return; setMap(lefts.map(() => null)); setActive(0); setLive('Alle Zuordnungen zurückgesetzt.') }
  const missing = map.filter((v) => v === null).length

  return (
    <DragDropProvider sensors={MATCH_SENSORS} plugins={withGermanA11y as never}
      onDragStart={() => setDragging(true)}
      onDragEnd={(e) => {
        setDragging(false)
        if (e.canceled) return
        const { source, target } = e.operation
        if (source && target && typeof source.data?.left === 'number' && typeof target.data?.right === 'number') assign(source.data.left, target.data.right)
      }}>
      <div className={`flex flex-1 flex-col gap-3 ${dragging ? 'dnd-active' : ''}`}>
        <p className="text-sm font-semibold text-mute">Begriff auf ein Zielfeld ziehen – oder erst den Begriff, dann das Zielfeld antippen.</p>
        <p className="sr-only" role="status" aria-live="polite">{live}</p>
        <ul className="flex flex-col gap-3" aria-label="Begriffe">
          {lefts.map((l, i) => <LeftCard key={i} i={i} text={l} target={map[i] !== null ? rights[map[i]!] : null} active={active === i} locked={locked} onTap={() => setActive(i)} />)}
        </ul>
        <h2 className="mt-1 text-sm font-bold uppercase tracking-wider text-violet-soft">Zielfelder</h2>
        <ul className="flex flex-col gap-3" aria-label="Zielfelder">
          {rights.map((r, k) => {
            const owner = map.indexOf(k)
            return <Zone key={k} k={k} text={r} owner={owner >= 0 ? owner : null} ownerText={owner >= 0 ? lefts[owner] : null} canTap={active !== null} locked={locked}
              onTap={() => active !== null && assign(active, k)} onRelease={() => release(owner)} />
          })}
        </ul>
        <button type="button" className="btn btn-ghost !min-h-[48px] self-start text-base" onClick={reset} disabled={locked || missing === lefts.length}><RotateCcw size={18} aria-hidden /> Alle zurücksetzen</button>
        {renderSubmit({ ready: isMatchComplete(map), hint: missing ? `Noch ${missing} von ${lefts.length} Begriffen zuordnen.` : 'Alles zugeordnet – du kannst noch ändern oder abgeben.', onClick: () => isMatchComplete(map) && submit(map) })}
      </div>
    </DragDropProvider>
  )
}

function LeftCard({ i, text, target, active, locked, onTap }: { i: number; text: string; target: string | null; active: boolean; locked: boolean; onTap: () => void }) {
  const { ref, isDragging } = useDraggable({ id: `l${i}`, data: { left: i, label: text }, disabled: locked })
  return (
    <li>
      <button ref={ref} type="button" aria-pressed={active} disabled={locked} onClick={onTap}
        className={`choice draggable flex min-h-[64px] w-full items-center gap-3 p-3 text-left ${isDragging ? 'is-dragging' : ''}`}>
        <span className="badge-num h-9 w-9 shrink-0 rounded-lg text-lg" style={{ background: PAIR_COLORS[i] }} aria-label={`Begriff ${i + 1}`}>{i + 1}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-bold leading-snug [overflow-wrap:anywhere]">{text}</span>
          <span className="block text-sm font-semibold text-mute [overflow-wrap:anywhere]">{target ? `→ ${target}` : 'noch nicht zugeordnet'}</span>
        </span>
        <GripVertical className="shrink-0 text-mute" size={22} aria-hidden />
      </button>
    </li>
  )
}

function Zone({ k, text, owner, ownerText, canTap, locked, onTap, onRelease }: { k: number; text: string; owner: number | null; ownerText: string | null; canTap: boolean; locked: boolean; onTap: () => void; onRelease: () => void }) {
  const { ref, isDropTarget } = useDroppable({ id: `r${k}`, data: { right: k, label: text }, disabled: locked })
  const { source } = useDragOperation()
  return (
    <li ref={ref} className={`dropzone flex items-stretch ${isDropTarget && source ? 'is-over' : ''} ${owner !== null ? 'is-filled' : ''}`}>
      <button type="button" disabled={locked || !canTap} onClick={onTap} aria-label={`Zielfeld: ${text}${ownerText ? `, zugeordnet: ${ownerText}` : ''}`}
        className="flex min-h-[60px] min-w-0 flex-1 items-center gap-3 rounded-[0.9rem] p-3 text-left">
        {owner !== null && <span key={owner} className="badge-num a-snap h-9 w-9 shrink-0 rounded-lg text-lg" style={{ background: PAIR_COLORS[owner] }} aria-hidden>{owner + 1}</span>}
        <span className="min-w-0">
          <span className="block text-lg font-semibold leading-snug [overflow-wrap:anywhere]">{text}</span>
          {owner !== null
            ? <span className="block text-sm font-bold text-gold-light [overflow-wrap:anywhere]">{ownerText}</span>
            : <span className="block text-sm text-mute">{canTap ? 'Hier ablegen oder tippen' : 'Zuerst einen Begriff wählen'}</span>}
        </span>
      </button>
      {owner !== null && (
        <button type="button" disabled={locked} onClick={onRelease} aria-label={`Zuordnung von ${ownerText} lösen`} className="grid w-12 shrink-0 place-items-center text-mute hover:text-ink"><X size={22} aria-hidden /></button>
      )}
    </li>
  )
}

/* ---------- Ordering ---------- */
export function Order({ q, locked, submit, renderSubmit }: InputProps) {
  const items = q.items!, n = items.length
  const [seq, setSeq] = useState<number[]>([]) // eingeordnete Elementindizes, in gewählter Reihenfolge
  const [live, setLive] = useState('')
  const pool = items.map((_, d) => d).filter((d) => !seq.includes(d))
  const say = (s: number[], d: number) => setLive(`${items[d]} steht jetzt auf Platz ${s.indexOf(d) + 1} von ${n}.`)
  const add = (d: number) => { if (locked) return; const s = appendSeq(seq, d); setSeq(s); say(s, d) }
  const step = (pos: number, dir: -1 | 1) => { if (locked) return; const s = moveSeq(seq, pos, dir); setSeq(s); say(s, seq[pos]) }
  const reset = () => { if (locked) return; setSeq([]); setLive('Reihenfolge zurückgesetzt.') }

  return (
    <DragDropProvider sensors={ORDER_SENSORS} plugins={withGermanA11y as never}
      onDragEnd={(e) => { if (e.canceled || locked) return; const s = move(seq, e); setSeq(s); const d = e.operation.source?.id; if (typeof d === 'number') say(s, d) }}>
      <div className="flex flex-1 flex-col gap-3">
        <p className="text-sm font-semibold text-mute">Karten unten antippen, bis alle einsortiert sind. Dann per Ziehen am Griff oder mit ▲ ▼ die Reihenfolge ändern.</p>
        <p className="sr-only" role="status" aria-live="polite">{live}</p>
        <ol className="flex flex-col gap-2" aria-label="Deine Reihenfolge">
          {Array.from({ length: n }, (_, pos) => seq[pos] === undefined
            ? <li key={`e${pos}`} className="dropzone flex min-h-[64px] items-center gap-3 p-3 text-mute"><span className="badge-num h-9 w-9 shrink-0 rounded-lg bg-line text-lg !text-mute">{pos + 1}</span><span className="text-base">frei</span></li>
            : <OrderCard key={seq[pos]} id={seq[pos]} pos={pos} n={n} text={items[seq[pos]]} locked={locked} onUp={() => step(pos, -1)} onDown={() => step(pos, 1)} />)}
        </ol>
        {pool.length > 0 && (
          <>
            <h2 className="mt-1 text-sm font-bold uppercase tracking-wider text-violet-soft">Noch einzuordnen – antippen</h2>
            <ul className="flex flex-col gap-2" aria-label="Noch nicht eingeordnete Karten">
              {pool.map((d) => (
                <li key={d}><button type="button" disabled={locked} onClick={() => add(d)} className="choice flex min-h-[60px] w-full items-center p-3 text-left text-lg font-bold leading-snug [overflow-wrap:anywhere]">{items[d]}</button></li>
              ))}
            </ul>
          </>
        )}
        <button type="button" className="btn btn-ghost !min-h-[48px] self-start text-base" onClick={reset} disabled={locked || seq.length === 0}><RotateCcw size={18} aria-hidden /> Reihenfolge zurücksetzen</button>
        {renderSubmit({ ready: seq.length === n, hint: seq.length < n ? `Noch ${n - seq.length} von ${n} Karten einordnen.` : 'Alle Karten einsortiert – du kannst noch ändern oder abgeben.', onClick: () => seq.length === n && submit(seq) })}
      </div>
    </DragDropProvider>
  )
}

function OrderCard({ id, pos, n, text, locked, onUp, onDown }: { id: number; pos: number; n: number; text: string; locked: boolean; onUp: () => void; onDown: () => void }) {
  const { ref, handleRef, isDragging } = useSortable({ id, index: pos, data: { label: text }, disabled: locked, transition: { duration: 200, easing: 'cubic-bezier(.25,1,.5,1)' } })
  return (
    <li ref={ref} className={`choice draggable is-selected flex min-h-[64px] items-center gap-2 py-2 pl-1 pr-2 ${isDragging ? 'is-dragging' : ''}`}>
      <button ref={handleRef} type="button" disabled={locked} aria-label={`${text} verschieben, Platz ${pos + 1} von ${n}`} className="grip grid h-14 w-10 shrink-0 place-items-center rounded-lg text-mute"><GripVertical size={24} aria-hidden /></button>
      <span className="badge-num h-9 w-9 shrink-0 rounded-lg text-lg" aria-hidden>{pos + 1}</span>
      <span className="min-w-0 flex-1 text-lg font-bold leading-snug [overflow-wrap:anywhere]">{text}</span>
      <span className="flex shrink-0 flex-col gap-1">
        <button type="button" data-no-drag disabled={locked || pos === 0} onClick={onUp} aria-label={`${text} nach oben`} className="grid h-11 w-11 place-items-center rounded-lg bg-deep disabled:opacity-30"><ChevronUp size={22} aria-hidden /></button>
        <button type="button" data-no-drag disabled={locked || pos === n - 1} onClick={onDown} aria-label={`${text} nach unten`} className="grid h-11 w-11 place-items-center rounded-lg bg-deep disabled:opacity-30"><ChevronDown size={22} aria-hidden /></button>
      </span>
    </li>
  )
}
