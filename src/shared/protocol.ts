export type Phase = 'LOBBY' | 'QUESTION' | 'REVEAL' | 'INTERMISSION' | 'FINAL'
export type Format = 'mc' | 'tf' | 'match' | 'order' | 'who'
/** mc/tf/who: option index. match: for each left item the chosen right index. order: display indices in chosen order. */
export type Answer = number | number[]

export interface PublicQuestion {
  id: number
  number: number
  total: number
  format: Format
  topic: string
  level: 'KNOW' | 'PROVE'
  seconds: number
  points: number
  prompt: string
  options?: string[]
  lefts?: string[]
  rights?: string[]
  items?: string[]
}

export interface Reveal {
  solution: { correct?: number; map?: number[]; order?: number[] }
  explanation: string
  stats:
    | { kind: 'options'; counts: number[]; unanswered: number }
    | { kind: 'parts'; full: number; partial: number; none: number; unanswered: number }
}

export interface PlayerPub {
  id: string
  name: string
  avatar: string
  score: number
  rank: number
  connected: boolean
  fullCount: number
  practiceFull: number
  delta: number
}

export interface QResult {
  points: number
  full: boolean
  answered: boolean
}

export interface You {
  id: string
  name: string
  avatar: string
  score: number
  rank: number
  answered: boolean
  myAnswer: Answer | null
  result: QResult | null
  results: QResult[]
}

export interface Snapshot {
  code: string
  phase: Phase
  kind: 'next' | 'ranking' | null
  step: number
  qIndex: number
  total: number
  paused: boolean
  auto: boolean
  now: number
  endsAt: number | null
  remainingMs: number | null
  durationMs: number
  players: PlayerPub[]
  answeredCount: number
  question: PublicQuestion | null
  upcoming: { number: number; format: Format; topic: string; level: 'KNOW' | 'PROVE' } | null
  reveal: Reveal | null
  words: { word: string; count: number }[]
  wordsHidden: boolean
  you: You | null
}

export type ClientMsg =
  | { t: 'hello'; role: 'host'; hostToken: string }
  | { t: 'hello'; role: 'screen' }
  | { t: 'hello'; role: 'player'; token?: string; name?: string }
  | { t: 'answer'; q: number; a: Answer }
  | { t: 'word'; w: string }
  | { t: 'host'; cmd: 'start' | 'pause' | 'resume' | 'next' | 'close' | 'reset' | 'auto' | 'words'; step?: number; value?: boolean }

export type ServerMsg =
  | { t: 'state'; s: Snapshot }
  | { t: 'joined'; token: string; id: string }
  | { t: 'err'; code: string; msg: string }

export const FORMAT_INFO: Record<Format, { name: string; hint: string; emoji: string }> = {
  mc: { name: 'QUIZ-KLASSIKER', hint: 'Eine Antwort ist richtig', emoji: '🎯' },
  tf: { name: 'FAKT ODER FAKE?', hint: 'Stimmt die Aussage?', emoji: '🕵️' },
  match: { name: 'MATCHMAKER', hint: 'Passende Paare bilden', emoji: '🧩' },
  order: { name: "BRING'S IN ORDNUNG!", hint: 'Antippen oder ziehen: in die richtige Reihenfolge', emoji: '🔢' },
  who: { name: 'WER BIN ICH?', hint: 'Errate den Fachbegriff', emoji: '🎭' },
}
