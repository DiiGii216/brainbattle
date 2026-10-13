import { useEffect, useState } from 'react'
import { Crown, Lock } from 'lucide-react'
import { FORMAT_INFO, type ClientMsg, type Snapshot } from '../shared/protocol'
import Inputs from './Inputs'
import { ConnectionBanner, Confetti, Countdown, FormatBadge, Logo, RankList, answerLines, solutionLines } from './ui'
import { useRoom } from './useRoom'

const tokKey = (c: string) => `bb-token-${c}`
const QUESTION_TEXT = 'text-[clamp(1.25rem,5.2vw,1.5rem)] font-extrabold leading-snug [overflow-wrap:anywhere]'

export default function Player({ code }: { code: string }) {
  const [name, setName] = useState('')
  const [joining, setJoining] = useState<string | null>(null) // Name, sobald Beitritt gestartet
  const [pending] = useState(() => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('')) // idempotenter Beitritt
  const [token, setToken] = useState<string | null>(() => { try { return localStorage.getItem(tokKey(code)) } catch { return null } })
  const [word, setWord] = useState('')
  const room = useRoom(code, () => token ? { t: 'hello', role: 'player', token } : joining ? { t: 'hello', role: 'player', name: joining, token: pending } : null,
    (tk) => { try { localStorage.setItem(tokKey(code), tk) } catch { /* privat */ } setToken(tk) })
  const { snap, err, offset, send, status } = room

  useEffect(() => {
    if (err?.code === 'unknown_token') { try { localStorage.removeItem(tokKey(code)) } catch { /* */ } setToken(null); setJoining(null) }
  }, [err, code])

  if (!token && (!snap?.you)) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col justify-center gap-6 px-4 py-8">
        <div className="a-up text-center"><Logo /></div>
        <form className="card a-up flex flex-col gap-3 p-5" onSubmit={(e) => { e.preventDefault(); room.clearErr(); setJoining(name.trim()); room.reconnect() }}>
          <label htmlFor="n" className="font-bold">Wie heißt du?</label>
          <input id="n" autoFocus maxLength={16} value={name} onChange={(e) => setName(e.target.value)} autoComplete="nickname" placeholder="Dein Spielername"
            className="field rounded-2xl px-4 py-4 text-xl font-bold" />
          <button className="btn btn-gold !min-h-[56px] text-lg" disabled={!name.trim()}>Los geht's</button>
          <p className="text-sm text-mute">Raum {code} · keine Registrierung nötig</p>
          {err && <p role="alert" className="font-bold text-bad">{err.msg}</p>}
        </form>
      </main>
    )
  }
  if (!snap || !snap.you) {
    return <main className="grid min-h-dvh place-items-center p-6 text-center"><ConnectionBanner status={status} /><div>{err ? <p role="alert" className="text-bad">{err.msg}</p> : <p className="a-float text-5xl">🧠</p>}</div></main>
  }
  const you = snap.you

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <ConnectionBanner status={status} />
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-bg/95 px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur">
        <span className="text-3xl" aria-hidden>{you.avatar}</span>
        <div className="min-w-0 flex-1"><div className="truncate font-extrabold">{you.name}</div><div className="text-sm text-mute">Frage {Math.max(snap.qIndex + 1, 0)} / {snap.total}</div></div>
        {snap.phase !== 'LOBBY' && <div className="text-right"><div className="display text-xl tabular-nums">{you.score}</div><div className="text-sm font-bold text-gold">Platz {you.rank}</div></div>}
        {snap.phase === 'QUESTION' && <Countdown snap={snap} offset={offset} size={44} />}
      </header>
      <main className="flex flex-1 flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {snap.paused && <div role="status" className="mt-3 rounded-2xl bg-gold p-3 text-center font-extrabold text-bg">⏸ Pause – gleich geht's weiter</div>}
        <Body snap={snap} send={send} word={word} setWord={setWord} err={err?.msg} />
      </main>
    </div>
  )
}

function Body({ snap, send, word, setWord, err }: { snap: Snapshot; send: (m: ClientMsg) => boolean; word: string; setWord: (w: string) => void; err?: string }) {
  const you = snap.you!
  if (snap.phase === 'LOBBY') {
    return (
      <div className="a-up flex flex-1 flex-col items-center gap-5 pt-6 text-center">
        <div className="a-pop text-8xl a-float" aria-hidden>{you.avatar}</div>
        <h1 className="display text-3xl">Du bist drin, <span className="text-gold">{you.name}</span>!</h1>
        <p className="text-mute">Der Moderator startet gleich. {snap.players.length} Teilnehmende sind da.</p>
        <div className="flex flex-wrap justify-center gap-2">{snap.players.map((p) => <span key={p.id} className="rounded-full border border-line bg-surface px-3 py-1 text-sm font-bold">{p.avatar} {p.name}</span>)}</div>
        {!snap.wordsHidden && (
          <form className="card mt-2 w-full p-4 text-left" onSubmit={(e) => { e.preventDefault(); send({ t: 'word', w: word }) }}>
            <label htmlFor="w" className="font-bold">Welches Wort verbindest du mit Personalplanung?</label>
            <div className="mt-2 flex gap-2">
              <input id="w" maxLength={24} value={word} onChange={(e) => setWord(e.target.value)} className="field min-w-0 flex-1 rounded-xl px-3 py-3 text-lg" placeholder="ein Wort" />
              <button className="btn btn-ghost">Senden</button>
            </div>
            <p className="mt-1 text-sm text-mute">Optional, ohne Punkte. Du kannst es jederzeit ändern.</p>
          </form>
        )}
      </div>
    )
  }
  if (snap.phase === 'INTERMISSION') {
    if (snap.kind === 'ranking') return (
      <div className="a-up pt-4"><h1 className="display mb-3 text-2xl">Zwischenstand</h1><RankList players={snap.players} meId={you.id} /></div>
    )
    const u = snap.upcoming!
    return (
      <div className="a-up grid flex-1 place-items-center text-center"><div>
        <div className="a-pop text-7xl" aria-hidden>{FORMAT_INFO[u.format].emoji}</div>
        <p className="mt-4 text-mute">Frage {u.number} von {snap.total}</p>
        <h1 className="display mt-1 text-3xl">{FORMAT_INFO[u.format].name}</h1>
        <p className="mt-2 text-mute">{FORMAT_INFO[u.format].hint}</p>
      </div></div>
    )
  }
  if (snap.phase === 'QUESTION') {
    const q = snap.question!
    if (you.answered) {
      // Autoritativ: nur der Server-Snapshot (you.answered / myAnswer) führt hierher.
      const mine = answerLines(q, you.myAnswer)
      return (
        <div className="a-pop flex flex-1 flex-col items-center justify-center gap-3 py-6 text-center">
          <Lock size={56} className="text-gold" aria-hidden />
          <h1 role="status" className="display text-3xl text-gold">Antwort gesperrt</h1>
          <p className="text-mute">Vom Server bestätigt. Warte auf die Auflösung …</p>
          {mine.length > 0 && (
            <div className="card w-full p-4 text-left"><div className="text-sm font-bold uppercase tracking-wider text-violet-soft">Deine Antwort</div>
              <ul className="mt-1 font-bold [overflow-wrap:anywhere]">{mine.map((l, i) => <li key={i}>{l}</li>)}</ul></div>
          )}
          <p className="text-sm text-mute">{snap.answeredCount} von {snap.players.length} haben geantwortet</p>
        </div>
      )
    }
    return (
      <div key={q.id} className="a-up flex flex-1 flex-col gap-3 pt-3">
        <div className="flex items-center justify-between gap-2"><FormatBadge q={q} /><span className="shrink-0 text-sm font-bold text-mute">bis {q.points} Punkte</span></div>
        {q.format === 'who'
          ? <div className="mystery rounded-2xl p-4"><div className="mb-1 text-sm font-bold uppercase tracking-wider text-violet-soft"><span aria-hidden>🕵️ </span>Rätsel</div><h1 className={`${QUESTION_TEXT} italic`}>{q.prompt}</h1></div>
          : <h1 className={QUESTION_TEXT}>{q.prompt}</h1>}
        {err && <p role="alert" className="font-bold text-bad">{err}</p>}
        <Inputs q={q} paused={snap.paused} serverErr={err} onSubmit={(a) => send({ t: 'answer', q: q.id, a })} />
      </div>
    )
  }
  if (snap.phase === 'REVEAL' && snap.reveal && snap.question) {
    const r = you.result
    const full = r?.full, got = r && r.points > 0
    return (
      <div className="a-up flex flex-col gap-4 pt-4">
        <div className={`rounded-3xl p-5 text-center text-bg ${full ? 'bg-ok' : got ? 'bg-gold-light' : r?.answered ? 'bg-bad a-shake' : 'bg-mute'}`}>
          <div className="a-pop text-6xl" aria-hidden>{full ? '🎉' : got ? '👍' : r?.answered ? '🙈' : '⏰'}</div>
          <div className="display mt-1 text-3xl">{full ? 'Richtig!' : got ? 'Teilweise richtig' : r?.answered ? 'Leider falsch' : 'Keine Antwort'}</div>
          <div className="display mt-1 text-5xl tabular-nums">+{r?.points ?? 0}</div>
        </div>
        <div className="card p-4">
          <div className="text-sm font-bold uppercase tracking-wider text-gold">Richtige Lösung</div>
          <ul className="mt-1 text-lg font-bold [overflow-wrap:anywhere]">{solutionLines(snap.question, snap.reveal).map((l, i) => <li key={i}>{l}</li>)}</ul>
          <p className="mt-3 text-mute">💡 {snap.reveal.explanation}</p>
        </div>
        <p className="text-center text-sm text-mute">Du bist aktuell auf Platz <b className="text-gold">{you.rank}</b> mit {you.score} Punkten.</p>
      </div>
    )
  }
  if (snap.phase === 'FINAL') {
    const full = you.results.filter((r) => r.full).length
    const champ = you.rank === 1
    return (
      <div className="a-up flex flex-col items-center gap-4 pt-6 text-center">
        {champ && <Confetti />}
        <div className={`a-pop grid h-28 w-28 place-items-center rounded-full text-7xl ${champ ? 'glow-gold bg-surface' : ''}`} aria-hidden>{champ ? <Crown size={64} className="text-gold" /> : you.rank === 2 ? '🥈' : you.rank === 3 ? '🥉' : '🧠'}</div>
        <h1 className="display text-3xl">{champ ? 'Du bist Champion!' : `Platz ${you.rank}`}</h1>
        <div className="display text-6xl text-gold tabular-nums">{you.score}</div>
        <p className="text-mute">von 2.500 Punkten · {full} von {snap.total} Fragen komplett richtig</p>
        <ul className="flex flex-wrap justify-center gap-1.5" aria-label="Ergebnis je Frage">
          {Array.from({ length: snap.total }, (_, i) => {
            const r = you.results[i]
            const txt = r?.full ? 'richtig' : r?.points ? 'teilweise richtig' : 'nicht richtig'
            return <li key={i} aria-label={`Frage ${i + 1}: ${txt}`} title={`Frage ${i + 1}: ${txt}`} className={`grid h-8 w-8 place-items-center rounded-lg text-sm font-extrabold text-bg ${r?.full ? 'bg-ok' : r?.points ? 'bg-gold-light' : 'bg-bad'}`}>{i + 1}</li>
          })}
        </ul>
        <h2 className="display mt-2 w-full text-left text-xl">Gesamtwertung</h2>
        <div className="w-full text-left"><RankList players={snap.players} meId={you.id} /></div>
      </div>
    )
  }
  return null
}
