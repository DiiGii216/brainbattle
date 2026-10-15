import { describe, expect, it } from 'vitest'
import { QUESTIONS } from '../src/worker/questions'
import { grade, partial, pointsOf, publicQuestion, rankPlayers, scoreAnswer, validateAnswer, buildReveal } from '../src/worker/game'

const q = (id: number) => QUESTIONS.find((x) => x.id === id)!

describe('Fragenkatalog', () => {
  it('hat 20 Fragen mit korrekter Format-Verteilung', () => {
    expect(QUESTIONS).toHaveLength(20)
    const c: Record<string, number> = {}
    QUESTIONS.forEach((x) => (c[x.format] = (c[x.format] ?? 0) + 1))
    expect(c).toEqual({ mc: 8, tf: 4, match: 5, order: 1, who: 2 })
  })
  it('Gesamtpunkte = 2500, Zeitbudget ≈ 11 Minuten', () => {
    expect(QUESTIONS.reduce((a, x) => a + pointsOf(x), 0)).toBe(2500)
    // Fragen + 7 s Auflösung + 20 × 3 s Übergang (inkl. Countdown vor Frage 1) + 2 × 20 s Zwischenranking
    const secs = QUESTIONS.reduce((a, x) => a + x.seconds + 7, 0) + 20 * 3 + 40
    expect(secs).toBe(656) // 10:56; plus ca. 30 s Finale-Animation ≈ 11:26 (Brief: 11:23 + Puffer)
  })
  it('Erklärungen ≤ 25 Wörter, eindeutige IDs, MC mit 4 verschiedenen Optionen', () => {
    expect(new Set(QUESTIONS.map((x) => x.id)).size).toBe(20)
    for (const x of QUESTIONS) {
      expect(x.explanation.split(/\s+/).length).toBeLessThanOrEqual(25)
      if (x.format === 'mc' || x.format === 'who') {
        expect(new Set(x.options).size).toBe(4)
        expect(x.correct).toBeGreaterThanOrEqual(0)
        expect(x.correct).toBeLessThan(4)
      }
    }
  })
  it('Permutationen für Matching/Ordering sind gültig', () => {
    for (const x of QUESTIONS) {
      if (x.format === 'match') expect([...x.rightOrder].sort()).toEqual(x.pairs.map((_, i) => i))
      if (x.format === 'order') expect([...x.display].sort()).toEqual(x.items.map((_, i) => i))
    }
  })
  it('öffentliche Frage enthält keine Lösung', () => {
    for (const x of QUESTIONS) {
      const json = JSON.stringify(publicQuestion(x))
      expect(json).not.toContain('explanation')
      expect(json).not.toContain('"correct"')
    }
  })
})

describe('Bewertung', () => {
  it('MC: richtig = volle Punkte, falsch = 0', () => {
    expect(scoreAnswer(q(2), 1).points).toBe(100)
    expect(scoreAnswer(q(2), 0).points).toBe(0)
    expect(scoreAnswer(q(11), 1).points).toBe(150)
    expect(scoreAnswer(q(2), null)).toMatchObject({ points: 0, answered: false })
  })
  it('Fakt/Fake', () => {
    expect(scoreAnswer(q(6), 0).full).toBe(true) // Fakt
    expect(scoreAnswer(q(14), 1).full).toBe(true) // Fake
    expect(scoreAnswer(q(14), 0).points).toBe(0)
  })
  it('Matching: anteilig mit floor', () => {
    const m = q(12) as Extract<typeof QUESTIONS[number], { format: 'match' }>
    // korrekte Antwort: für jede linke Zeile Anzeigeindex des passenden Rechts
    const right = m.pairs.map((_, i) => m.rightOrder.indexOf(i))
    expect(scoreAnswer(m, right)).toMatchObject({ points: 150, full: true })
    const swapped = [right[1], right[0], right[2]] // zwei vertauscht → 1 von 3 korrekt
    expect(scoreAnswer(m, swapped).points).toBe(partial(150, 1, 3))
    expect(partial(150, 1, 3)).toBe(50)
    expect(partial(100, 1, 3)).toBe(33)
  })
  it('Ordering: anteilig pro Position', () => {
    const o = q(7) as Extract<typeof QUESTIONS[number], { format: 'order' }>
    const right = o.items.map((_, pos) => o.display.indexOf(pos))
    expect(scoreAnswer(o, right)).toMatchObject({ points: 100, full: true })
    const sw = [right[1], right[0], right[2], right[3]]
    expect(grade(o, sw)).toEqual({ correct: 2, total: 4 })
    expect(scoreAnswer(o, sw).points).toBe(50)
  })
  it('Validierung lehnt Manipulation ab', () => {
    expect(validateAnswer(q(2), 4)).toBeNull()
    expect(validateAnswer(q(2), -1)).toBeNull()
    expect(validateAnswer(q(2), '1')).toBeNull()
    expect(validateAnswer(q(2), [1])).toBeNull()
    expect(validateAnswer(q(6), 2)).toBeNull()
    expect(validateAnswer(q(12), [0, 0, 1])).toBeNull()
    expect(validateAnswer(q(12), [0, 1])).toBeNull()
    expect(validateAnswer(q(7), [0, 1, 2, 9])).toBeNull()
    expect(validateAnswer(q(7), [0, 1, 2, 3])).toEqual([0, 1, 2, 3])
  })
  it('Reveal-Statistik', () => {
    const r = buildReveal(q(2), [1, 1, 0], 5)
    expect(r.stats).toEqual({ kind: 'options', counts: [1, 2, 0, 0], unanswered: 2 })
    expect(r.solution.correct).toBe(1)
  })
})

describe('Ranking', () => {
  it('Tie-Breaker und geteilte Ränge', () => {
    const r = rankPlayers([
      { id: 'a', name: 'A', score: 500, practiceFull: 2, fullCount: 5 },
      { id: 'b', name: 'B', score: 500, practiceFull: 3, fullCount: 4 },
      { id: 'c', name: 'C', score: 500, practiceFull: 3, fullCount: 4 },
      { id: 'd', name: 'D', score: 600, practiceFull: 0, fullCount: 1 },
      { id: 'e', name: 'E', score: 500, practiceFull: 3, fullCount: 6 },
    ])
    expect(r.map((x) => [x.id, x.rank])).toEqual([['d', 1], ['e', 2], ['b', 3], ['c', 3], ['a', 5]])
  })
})
