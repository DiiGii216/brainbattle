import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { QUESTIONS } from '../src/worker/questions'
import { scoreAnswer, validateAnswer } from '../src/worker/game'
import { appendSeq, isMatchComplete, moveSeq, nextFreeLeft, placeMatch, releaseMatch, type MatchMap } from '../src/client/inputLogic'

/** Antwortformat bleibt unverändert: Matching = pro linkem Begriff der gewählte rechte Index, Ordering = Elementindizes in Reihenfolge. */
describe('Matchmaker-Eingabelogik (Tippen und Ziehen teilen sich diese Funktionen)', () => {
  const empty: MatchMap = [null, null, null]
  it('Zuordnen setzt genau einen Eintrag', () => {
    expect(placeMatch(empty, 0, 2)).toEqual([2, null, null])
  })
  it('Tippen und Ziehen erzeugen dieselbe Antwort', () => {
    // identische Aktionsfolge – beide Bedienwege rufen placeMatch(map, begriff, ziel)
    const seq = [[0, 2], [1, 0], [2, 1]] as const
    const a = seq.reduce((m, [l, k]) => placeMatch(m, l, k), empty)
    const b = seq.reduce((m, [l, k]) => placeMatch(m, l, k), empty)
    expect(a).toEqual(b)
    expect(a).toEqual([2, 0, 1])
  })
  it('Zuordnung ändern: Karte auf anderes Zielfeld gibt das alte frei', () => {
    expect(placeMatch([2, null, null], 0, 1)).toEqual([1, null, null])
  })
  it('belegtes Zielfeld: bisheriger Begriff wird frei – nie doppelt vergeben', () => {
    expect(placeMatch([2, null, null], 1, 2)).toEqual([null, 2, null])
  })
  it('belegtes Zielfeld bei bereits zugeordnetem Begriff: Tausch', () => {
    expect(placeMatch([2, 0, null], 0, 0)).toEqual([0, 2, null])
  })
  it('erneutes Ablegen auf dasselbe Ziel ändert nichts', () => {
    const m: MatchMap = [2, null, null]
    expect(placeMatch(m, 0, 2)).toBe(m)
  })
  it('kein rechtes Element wird je doppelt zugeordnet (zufällige Aktionsfolgen)', () => {
    for (let run = 0; run < 200; run++) {
      let m: MatchMap = [null, null, null, null]
      for (let i = 0; i < 20; i++) {
        m = Math.random() < 0.2 ? releaseMatch(m, Math.floor(Math.random() * 4)) : placeMatch(m, Math.floor(Math.random() * 4), Math.floor(Math.random() * 4))
        const set = m.filter((v) => v !== null)
        expect(new Set(set).size).toBe(set.length)
      }
    }
  })
  it('Lösen und Vollständigkeit', () => {
    expect(releaseMatch([2, 0, 1], 1)).toEqual([2, null, 1])
    expect(isMatchComplete([2, null, 1])).toBe(false)
    expect(isMatchComplete([2, 0, 1])).toBe(true)
  })
  it('nächster freier Begriff (zyklisch)', () => {
    expect(nextFreeLeft([0, null, null], 0)).toBe(1)
    expect(nextFreeLeft([null, 1, 2], 2)).toBe(0)
    expect(nextFreeLeft([0, 1, 2], 0)).toBeNull()
  })
  it('vollständige Eingabe besteht die Serververifikation und wird korrekt bewertet', () => {
    const m = QUESTIONS.find((x) => x.id === 12)! as Extract<typeof QUESTIONS[number], { format: 'match' }>
    const right = m.pairs.map((_, i) => m.rightOrder.indexOf(i))
    // Spieler ordnet in beliebiger Reihenfolge zu → gleiche Antwort
    let map: MatchMap = [null, null, null]
    ;[2, 0, 1].forEach((l) => { map = placeMatch(map, l, right[l]) })
    expect(isMatchComplete(map)).toBe(true)
    expect(validateAnswer(m, map as number[])).toEqual(right)
    expect(scoreAnswer(m, map as number[])).toMatchObject({ points: 150, full: true })
  })
})

describe('Ordering-Eingabelogik', () => {
  it('Tippen hängt an, Doppeltes wird ignoriert', () => {
    expect(appendSeq([1], 3)).toEqual([1, 3])
    expect(appendSeq([1, 3], 3)).toEqual([1, 3])
  })
  it('Pfeile verschieben um eine Position und stoppen an den Rändern', () => {
    expect(moveSeq([0, 1, 2], 1, -1)).toEqual([1, 0, 2])
    expect(moveSeq([0, 1, 2], 1, 1)).toEqual([0, 2, 1])
    const edge = [0, 1, 2]
    expect(moveSeq(edge, 0, -1)).toBe(edge)
    expect(moveSeq(edge, 2, 1)).toBe(edge)
  })
  it('alle Eingabewege ergeben dieselbe, servergültige Antwort', () => {
    const o = QUESTIONS.find((x) => x.id === 7)! as Extract<typeof QUESTIONS[number], { format: 'order' }>
    const right = o.items.map((_, pos) => o.display.indexOf(pos)) // [Aufschwung, Boom, Abschwung, Tiefphase] als Anzeigeindizes
    // Weg A: direkt in richtiger Reihenfolge antippen. Weg B: falsch antippen, dann per Pfeil/Drag-Move korrigieren.
    const a = right.reduce(appendSeq, [] as number[])
    let b = [right[1], right[0], right[3], right[2]].reduce(appendSeq, [] as number[])
    b = moveSeq(b, 1, -1) // Aufschwung nach vorn
    b = moveSeq(b, 3, -1) // Abschwung vor Tiefphase
    expect(b).toEqual(a)
    expect(validateAnswer(o, b)).toEqual(a)
    expect(scoreAnswer(o, b)).toMatchObject({ points: 100, full: true })
  })
  it('unvollständige Reihenfolge wird vom Server abgelehnt (zusätzlich zur Button-Sperre)', () => {
    const o = QUESTIONS.find((x) => x.id === 7)!
    expect(validateAnswer(o, [0, 1])).toBeNull()
  })
})

/* ---------- Broadcast-Gold: Kontrast (WCAG 2.2 AA) direkt aus den Tokens in index.css ---------- */
const css = readFileSync(new URL('../src/client/index.css', import.meta.url), 'utf8')
const token = (n: string) => css.match(new RegExp(`--color-${n}:\\s*(#[0-9a-fA-F]{6})`))![1]
const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
const contrast = (a: string, b: string) => { const [x, y] = [lum(token(a)), lum(token(b))].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }

describe('Broadcast-Gold-Tokens', () => {
  it('Tokens entsprechen der Vorgabe', () => {
    const expected: Record<string, string> = { bg: '#090d25', panel: '#111833', surface: '#192141', deep: '#0c122d', ink: '#f7f8fd', mute: '#aab3cd', gold: '#f5be66', 'gold-light': '#ffd88e', violet: '#8058d1', 'violet-soft': '#d5bdff', ok: '#43c991', bad: '#f07178', line: '#303a61', 'line-strong': '#657394' }
    for (const [k, v] of Object.entries(expected)) expect(token(k).toLowerCase()).toBe(v)
  })
  it.each([
    ['ink', 'bg'], ['ink', 'panel'], ['ink', 'surface'], ['mute', 'bg'], ['mute', 'panel'], ['mute', 'surface'], ['mute', 'deep'],
    ['gold', 'bg'], ['gold', 'panel'], ['gold', 'surface'], ['gold-light', 'deep'], ['violet-soft', 'bg'], ['violet-soft', 'panel'], ['violet-soft', 'surface'],
    ['bg', 'gold'], ['bg', 'gold-light'], ['bg', 'ok'], ['bg', 'bad'], ['bg', 'violet-soft'], ['bg', 'mute'],
    ['ok', 'bg'], ['bad', 'bg'],
  ])('Text %s auf %s ≥ 4,5:1', (fg, bgc) => { expect(contrast(fg, bgc)).toBeGreaterThanOrEqual(4.5) })
  it.each([['line-strong', 'bg'], ['line-strong', 'panel'], ['line-strong', 'surface'], ['gold', 'surface']])('interaktive Begrenzung %s gegen %s ≥ 3:1', (fg, bgc) => { expect(contrast(fg, bgc)).toBeGreaterThanOrEqual(3) })
})
