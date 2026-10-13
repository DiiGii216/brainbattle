import type { Answer, Format, PublicQuestion, Reveal } from '../shared/protocol'
import { QUESTIONS, type Question } from './questions'

export const TOTAL = QUESTIONS.length
export const REVEAL_MS = 7000
export const NEXT_MS = 3000
export const RANKING_MS = 20000
export const RANKING_AFTER = [10, 15] // Zwischenranking nach diesen Fragennummern
export const BASE_POINTS = { KNOW: 100, PROVE: 150 } as const

export const pointsOf = (q: Question) => BASE_POINTS[q.level]

/** Teilpunkte: floor(maxPoints × korrekt / gesamt) – deterministisch, ohne Aufrunden. */
export const partial = (max: number, correct: number, total: number) => Math.floor((max * correct) / total)

const isInt = (n: unknown, max: number): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) < max

const isPerm = (a: unknown, n: number): a is number[] =>
  Array.isArray(a) && a.length === n && a.every((x) => isInt(x, n)) && new Set(a).size === n

/** Prüft eine Roh-Antwort gegen das Format. Gibt null zurück, wenn ungültig. */
export function validateAnswer(q: Question, raw: unknown): Answer | null {
  switch (q.format) {
    case 'mc':
    case 'who':
      return isInt(raw, q.options.length) ? raw : null
    case 'tf':
      return isInt(raw, 2) ? raw : null
    case 'match':
      return isPerm(raw, q.pairs.length) ? raw : null
    case 'order':
      return isPerm(raw, q.items.length) ? raw : null
  }
}

/** Anzahl korrekter Teile und Gesamtzahl für eine (validierte) Antwort. */
export function grade(q: Question, a: Answer): { correct: number; total: number } {
  switch (q.format) {
    case 'mc':
    case 'who':
      return { correct: a === q.correct ? 1 : 0, total: 1 }
    case 'tf':
      return { correct: a === (q.correct ? 0 : 1) ? 1 : 0, total: 1 }
    case 'match': {
      const m = a as number[]
      return { correct: m.filter((k, i) => q.rightOrder[k] === i).length, total: q.pairs.length }
    }
    case 'order': {
      const o = a as number[]
      return { correct: o.filter((d, pos) => q.display[d] === pos).length, total: q.items.length }
    }
  }
}

export function scoreAnswer(q: Question, a: Answer | null) {
  if (a === null) return { points: 0, full: false, answered: false, correct: 0, total: 1 }
  const { correct, total } = grade(q, a)
  const max = pointsOf(q)
  const multi = q.format === 'match' || q.format === 'order'
  const points = multi ? partial(max, correct, total) : correct === total ? max : 0
  return { points, full: correct === total, answered: true, correct, total }
}

export function publicQuestion(q: Question): PublicQuestion {
  const base = {
    id: q.id, number: q.id, total: TOTAL, format: q.format as Format, topic: q.topic, level: q.level,
    seconds: q.seconds, points: pointsOf(q), prompt: q.prompt,
  }
  switch (q.format) {
    case 'mc':
    case 'who':
      return { ...base, options: [...q.options] }
    case 'tf':
      return { ...base, options: ['Fakt', 'Fake'] }
    case 'match':
      return { ...base, lefts: q.pairs.map((p) => p.left), rights: q.rightOrder.map((i) => q.pairs[i].right) }
    case 'order':
      return { ...base, items: q.display.map((i) => q.items[i]) }
  }
}

export function buildReveal(q: Question, answers: Answer[], playerCount: number): Reveal {
  const unanswered = Math.max(0, playerCount - answers.length)
  let solution: Reveal['solution']
  if (q.format === 'mc' || q.format === 'who') solution = { correct: q.correct }
  else if (q.format === 'tf') solution = { correct: q.correct ? 0 : 1 }
  else if (q.format === 'match') solution = { map: q.pairs.map((_, i) => q.rightOrder.indexOf(i)) }
  else if (q.format === 'order') solution = { order: q.items.map((_, pos) => q.display.indexOf(pos)) }
  else solution = {}

  let stats: Reveal['stats']
  if (q.format === 'mc' || q.format === 'who' || q.format === 'tf') {
    const n = q.format === 'tf' ? 2 : q.options.length
    const counts = Array(n).fill(0)
    for (const a of answers) counts[a as number]++
    stats = { kind: 'options', counts, unanswered }
  } else {
    let full = 0, part = 0, none = 0
    for (const a of answers) {
      const g = grade(q, a)
      if (g.correct === g.total) full++
      else if (g.correct > 0) part++
      else none++
    }
    stats = { kind: 'parts', full, partial: part, none, unanswered }
  }
  return { solution, explanation: q.explanation, stats }
}

export interface RankInput {
  id: string
  name: string
  score: number
  practiceFull: number
  fullCount: number
}

/** Sortierung + Rang mit geteilten Rängen (Tie-Breaker: Praxis-Volltreffer, dann Volltreffer gesamt). */
export function rankPlayers<T extends RankInput>(players: T[]): (T & { rank: number })[] {
  const sorted = [...players].sort(
    (a, b) =>
      b.score - a.score || b.practiceFull - a.practiceFull || b.fullCount - a.fullCount || a.name.localeCompare(b.name, 'de'),
  )
  let rank = 0
  return sorted.map((p, i) => {
    const prev = sorted[i - 1]
    if (!prev || prev.score !== p.score || prev.practiceFull !== p.practiceFull || prev.fullCount !== p.fullCount) rank = i + 1
    return { ...p, rank }
  })
}

export const AVATARS = ['🦊', '🐼', '🦁', '🐙', '🦉', '🐸', '🦄', '🐯', '🐧', '🦋', '🐳', '🦖', '🐝', '🦔', '🐨', '🦩', '🐲', '🦜', '🐢', '🦈']

export function cleanName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const n = raw.replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16)
  return n.length >= 1 ? n : null
}

export function cleanWord(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const n = raw.replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24)
  return n.length >= 1 ? n : null
}
