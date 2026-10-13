import { useEffect, useState } from 'react'
import { FORMAT_INFO, type Snapshot } from '../shared/protocol'
import Inputs from './Inputs'
import { ConnectionBanner, Confetti, Countdown, FormatBadge, Logo, RankList, solutionLines } from './ui'
import { useRoom } from './useRoom'

const tokKey = (c: string) => `bb-token-${c}`

export default function Player({ code }: { code: string }) {
  const [name, setName] = useState('')
  const [joining, setJoining] = useState<string | null>(null) // Name, sobald Beitritt gestartet
  const [token, setToken] = useState<string | null>(() => { try { return localStorage.getItem(tokKey(code)) } catch { return null } })
  const [word, setWord] = useState('')
  const room = useRoom(code, () => token ? { t: 'hello', role: 'player', token } : joining ? { t: 'hello', role: 'player', name: joining } : null,
    (tk) => { try { localStorage.setItem(tokKey(code), tk) } catch { /* privat */ } setToken(tk) })
  const { snap, err, offset, send, status } = room

  useEffect(() => {
    if (err?.code === 'unknown_token') { try { localStorage.removeItem(tokKey(code)) } catch { /* */ } setToken(null); setJoining(null) }
  }, [err, code])

  if (!token && (!snap?.you)) {
    return (
      <main className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-6 px-4 py-8">
        <div className="a-up text-center"><Logo /></div>
        <form className="card a-up flex flex-col gap-3 p-5" onSubmit={(e) => { e.preventDefault(); room.clearErr(); setJoining(name.trim()); room.reconnect() }}>
          <label htmlFor="n" className="font-bold">Wie heißt du?</label>
          <input id="n" autoFocus maxLength={16} value={name} onChange={(e) => setName(e.target.value)} autoComplete="nickname" placeholder="Dein Spielername"
            className="rounded-2xl bg-navy px-4 py-4 text-xl font-bold outline-none ring-2 ring-steel/30 focus:ring-lime" />
          <button className="btn btn-lime !min-h-[56px] text-lg" disabled={!name.trim()}>Los geht's</button>
          <p className="text-sm text-steel">Raum {code} · keine Registrierung nötig</p>
          {err && <p role="alert" className="font-bold text-coral">{err.msg}</p>}
        </form>
      </main>
    )
  }
  if (!snap || !snap.you) {
    return <main className="grid min-h-full place-items-center p-6 text-center"><ConnectionBanner status={status} /><div>{err ? <p role="alert" className="text-coral">{err.msg}</p> : <p className="a-float text-5xl">🧠</p>}</div></main>
  }
  const you = snap.you

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col">
      <ConnectionBanner status={status} />
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-navy/90 px-4 py-3 backdrop-blur">
        <span className="text-3xl" aria-hidden>{you.avatar}</span>
        <div className="min-w-0 flex-1"><div className="truncate font-extrabold">{you.name}</div><div className="text-xs text-steel">Frage {Math.max(snap.qIndex + 1, 0)} / {snap.total}</div></div>
        {snap.phase !== 'LOBBY' && <div className="text-right"><div className="display text-xl tabular-nums">{you.score}</div><div className="text-xs font-bold text-lime">Platz {you.rank}</div></div>}
        {snap.phase === 'QUESTION' && <Countdown snap={snap} offset={offset} size={52} />}
      </header>
      <main className="flex flex-1 flex-col px-4 pb-6">
        {snap.paused && <div role="status" className="mb-3 rounded-2xl bg-amber p-3 text-center font-extrabold text-navy">⏸ Pause – gleich geht's weiter</div>}
        <Body snap={snap} send={send} word={word} setWord={setWord} err={err?.msg} />
      </main>
    </div>
  )
}

function Body({ snap, send, word, setWord, err }: { snap: Snapshot; send: (m: import('../shared/protocol').ClientMsg) => void; word: string; setWord: (w: string) => void; err?: string }) {
  const you = snap.you!
  if (snap.phase === 'LOBBY') {
    return (
      <div className="a-up flex flex-1 flex-col items-center gap-5 pt-6 text-center">
        <div className="a-pop text-8xl a-float" aria-hidden>{you.avatar}</div>
        <h1 className="display text-3xl">Du bist drin, <span className="text-lime">{you.name}</span>!</h1>
        <p className="text-steel">Der Moderator startet gleich. {snap.players.length} Teilnehmende sind da.</p>
        <div className="flex flex-wrap justify-center gap-2">{snap.players.map((p) => <span key={p.id} className="rounded-full bg-navy2 px-3 py-1 text-sm font-bold">{p.avatar} {p.name}</span>)}</div>
        {!snap.wordsHidden && (
          <form className="card mt-2 w-full p-4 text-left" onSubmit={(e) => { e.preventDefault(); send({ t: 'word', w: word }) }}>
            <label htmlFor="w" className="font-bold">Welches Wort verbindest du mit Personalplanung?</label>
            <div className="mt-2 flex gap-2">
              <input id="w" maxLength={24} value={word} onChange={(e) => setWord(e.target.value)} className="min-w-0 flex-1 rounded-xl bg-navy px-3 py-3 outline-none ring-2 ring-steel/30 focus:ring-lime" placeholder="ein Wort" />
              <button className="btn btn-ghost">Senden</button>
            </div>
            <p className="mt-1 text-xs text-steel">Optional, ohne Punkte. Du kannst es jederzeit ändern.</p>
          </form>
        )}
      </div>
    )
  }
  if (snap.phase === 'INTERMISSION') {
    if (snap.kind === 'ranking') return (
      <div className="a-up pt-4"><h1 className="display mb-3 text-2xl">Zwischenstand</h1><RankList players={snap.players} meId={you.id} limit={Math.min(snap.players.length, 8)} /></div>
    )
    const u = snap.upcoming!
    return (
      <div className="a-up grid flex-1 place-items-center text-center"><div>
        <div className="a-pop text-7xl" aria-hidden>{FORMAT_INFO[u.format].emoji}</div>
        <p className="mt-4 text-steel">Frage {u.number} von {snap.total}</p>
        <h1 className="display mt-1 text-3xl">{FORMAT_INFO[u.format].name}</h1>
        <p className="mt-2 text-steel">{FORMAT_INFO[u.format].hint}</p>
      </div></div>
    )
  }
  if (snap.phase === 'QUESTION') {
    const q = snap.question!
    if (you.answered) {
      return (
        <div className="a-pop grid flex-1 place-items-center text-center"><div>
          <div className="text-7xl" aria-hidden>🔒</div>
          <h1 className="display mt-3 text-3xl text-lime">Antwort gesperrt</h1>
          <p className="mt-2 text-steel">Warte auf die Auflösung …</p>
          <p className="mt-6 text-sm text-steel">{snap.answeredCount} von {snap.players.length} haben geantwortet</p>
        </div></div>
      )
    }
    return (
      <div key={q.id} className="a-up flex flex-1 flex-col gap-3 pt-2">
        <div className="flex items-center justify-between"><FormatBadge q={q} /><span className="text-xs font-bold text-steel">bis {q.points} Punkte</span></div>
        <h1 className={`font-extrabold leading-snug ${q.format === 'who' ? 'text-xl italic' : 'text-xl'}`}>{q.prompt}</h1>
        {err && <p role="alert" className="font-bold text-coral">{err}</p>}
        <Inputs q={q} onSubmit={(a) => send({ t: 'answer', q: q.id, a })} />
      </div>
    )
  }
  if (snap.phase === 'REVEAL' && snap.reveal && snap.question) {
    const r = you.result
    const full = r?.full, got = r && r.points > 0
    return (
      <div className="a-up flex flex-col gap-4 pt-4">
        <div className={`rounded-3xl p-5 text-center text-navy ${full ? 'bg-lime' : got ? 'bg-amber' : r?.answered ? 'bg-coral a-shake' : 'bg-steel'}`}>
          <div className="text-6xl a-pop" aria-hidden>{full ? '🎉' : got ? '👍' : r?.answered ? '🙈' : '⏰'}</div>
          <div className="display mt-1 text-3xl">{full ? 'Richtig!' : got ? 'Teilweise richtig' : r?.answered ? 'Leider falsch' : 'Keine Antwort'}</div>
          <div className="display mt-1 text-5xl tabular-nums">+{r?.points ?? 0}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs font-bold uppercase tracking-wider text-lime">Richtige Lösung</div>
          <ul className="mt-1 font-bold">{solutionLines(snap.question, snap.reveal).map((l, i) => <li key={i}>{l}</li>)}</ul>
          <p className="mt-3 text-steel">💡 {snap.reveal.explanation}</p>
        </div>
        <p className="text-center text-sm text-steel">Du bist aktuell auf Platz <b className="text-lime">{you.rank}</b> mit {you.score} Punkten.</p>
      </div>
    )
  }
  if (snap.phase === 'FINAL') {
    const full = you.results.filter((r) => r.full).length
    const champ = you.rank === 1
    return (
      <div className="a-up flex flex-col items-center gap-4 pt-6 text-center">
        {champ && <Confetti />}
        <div className="a-pop text-8xl" aria-hidden>{champ ? '🏆' : you.rank === 2 ? '🥈' : you.rank === 3 ? '🥉' : '🧠'}</div>
        <h1 className="display text-3xl">{champ ? 'Du bist Champion!' : `Platz ${you.rank}`}</h1>
        <div className="display text-6xl text-lime tabular-nums">{you.score}</div>
        <p className="text-steel">von 2.500 Punkten · {full} von {snap.total} Fragen komplett richtig</p>
        <div className="flex flex-wrap justify-center gap-1.5" aria-label="Ergebnis je Frage">
          {Array.from({ length: snap.total }, (_, i) => <span key={i} title={`Frage ${i + 1}`} className={`grid h-7 w-7 place-items-center rounded-lg text-xs font-extrabold text-navy ${you.results[i]?.full ? 'bg-lime' : you.results[i]?.points ? 'bg-amber' : 'bg-coral'}`}>{i + 1}</span>)}
        </div>
        <div className="mt-2 w-full text-left"><RankList players={snap.players} meId={you.id} limit={Math.min(snap.players.length, 6)} /></div>
      </div>
    )
  }
  return null
}
