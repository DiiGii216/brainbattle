import { arrayMove } from '@dnd-kit/helpers'

/**
 * Reine Eingabelogik für Matchmaker und Ordering. Tippen, Ziehen und Tastatur laufen alle über diese Funktionen
 * und verändern damit denselben React-State; das Antwortformat entspricht dem Server (siehe protocol.ts).
 */

/** map[l] = Index des gewählten rechten Elements (oder null). Ein rechtes Element wird nie doppelt vergeben. */
export type MatchMap = (number | null)[]

/** Ordnet linken Begriff `l` dem Zielfeld `k` zu. Belegtes Zielfeld: der bisherige Begriff tauscht (oder wird frei). */
export function placeMatch(map: MatchMap, l: number, k: number): MatchMap {
  const other = map.indexOf(k)
  if (other === l) return map
  const next = [...map]
  if (other >= 0) next[other] = map[l] // Tausch, falls l schon ein Ziel hatte, sonst wird other frei
  next[l] = k
  return next
}

export const releaseMatch = (map: MatchMap, l: number): MatchMap => map.map((v, i) => (i === l ? null : v))

/** Nächster noch freier Begriff nach `l` (zyklisch), sonst null. */
export function nextFreeLeft(map: MatchMap, l: number): number | null {
  for (let s = 1; s <= map.length; s++) {
    const i = (l + s) % map.length
    if (map[i] === null) return i
  }
  return null
}

/** Ordering: seq = Elementindizes in vom Spieler gewählter Reihenfolge (nur bereits eingeordnete). */
export const appendSeq = (seq: number[], d: number) => (seq.includes(d) ? seq : [...seq, d])
export function moveSeq(seq: number[], pos: number, dir: -1 | 1): number[] {
  const to = pos + dir
  return to < 0 || to >= seq.length ? seq : arrayMove(seq, pos, to)
}

export const isMatchComplete = (map: MatchMap): map is number[] => map.every((v) => v !== null)
