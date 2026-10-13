import { useEffect, useState } from 'react'
import { FORMAT_INFO } from '../shared/protocol'
import { ConnectionBanner, Countdown, Logo, QR } from './ui'
import { useRoom } from './useRoom'

const key = (c: string) => `bb-host-${c}`

export default function Host({ code }: { code: string }) {
  const [token, setToken] = useState<string | null>(() => {
    const m = location.hash.match(/k=([0-9a-f]+)/)
    try { if (m) { localStorage.setItem(key(code), m[1]); history.replaceState(null, '', location.pathname); return m[1] } return localStorage.getItem(key(code)) } catch { return m?.[1] ?? null }
  })
  const [paste, setPaste] = useState('')
  const { snap, status, err, offset, send } = useRoom(code, () => token ? { t: 'hello', role: 'host', hostToken: token } : null)
  const [copied, setCopied] = useState('')
  const joinUrl = `${location.origin}/join/${code}`
  useEffect(() => { if (copied) { const t = setTimeout(() => setCopied(''), 1800); return () => clearTimeout(t) } }, [copied])
  const copy = (txt: string, what: string) => navigator.clipboard?.writeText(txt).then(() => setCopied(what))

  if (!token || err?.code === 'bad_host') {
    return (
      <main className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-4 px-4">
        <Logo small />
        <form className="card flex flex-col gap-3 p-5" onSubmit={(e) => { e.preventDefault(); const m = paste.match(/k=([0-9a-f]+)/) ?? paste.match(/^([0-9a-f]{48})$/); if (m) { try { localStorage.setItem(key(code), m[1]) } catch { /* */ } setToken(m[1]); location.reload() } }}>
          <p className="font-bold">Moderator-Schlüssel fehlt oder ist ungültig.</p>
          <p className="text-sm text-steel">Öffne den Raum auf dem Gerät, auf dem du ihn erstellt hast – oder füge hier deinen privaten Wiederherstellungslink ein.</p>
          <input value={paste} onChange={(e) => setPaste(e.target.value)} aria-label="Wiederherstellungslink" className="rounded-xl bg-navy px-3 py-3 outline-none ring-2 ring-steel/30 focus:ring-lime" />
          <button className="btn btn-lime">Weiter</button>
          <a href="/" className="text-center text-sm text-steel underline">Neuen Raum erstellen</a>
        </form>
      </main>
    )
  }
  if (!snap) return <main className="grid min-h-full place-items-center"><ConnectionBanner status={status} /><p className="a-float text-5xl">🧠</p></main>

  const lobby = snap.phase === 'LOBBY', final = snap.phase === 'FINAL'
  const running = !lobby && !final
  const phaseLabel = { LOBBY: 'Lobby', QUESTION: `Frage ${snap.qIndex + 1}/${snap.total} läuft`, REVEAL: `Auflösung Frage ${snap.qIndex + 1}`, INTERMISSION: snap.kind === 'ranking' ? 'Zwischenranking' : `Gleich: Frage ${snap.qIndex + 1}`, FINAL: 'Finale' }[snap.phase]
  const act = (cmd: 'start' | 'pause' | 'resume' | 'next' | 'close' | 'reset', value?: boolean) => send({ t: 'host', cmd, step: snap.step, value })

  return (
    <div className="mx-auto max-w-5xl px-4 pb-10">
      <ConnectionBanner status={status} />
      <header className="flex flex-wrap items-center justify-between gap-3 py-5"><Logo small /><div className="text-right text-sm text-steel">Moderation · Raum <b className="display text-lime">{code}</b></div></header>
      <div className="grid gap-4 md:grid-cols-[1fr_20rem]">
        <section className="flex flex-col gap-4">
          <div className="card flex items-center gap-4 p-5">
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold uppercase tracking-wider text-steel">Aktueller Schritt</div>
              <div className="display text-2xl">{phaseLabel}{snap.paused && ' · ⏸ PAUSE'}</div>
              {snap.phase === 'QUESTION' && snap.question && <div className="mt-1 text-steel">{FORMAT_INFO[snap.question.format].emoji} {snap.question.topic} · <b className="text-snow">{snap.answeredCount}/{snap.players.length}</b> Antworten</div>}
            </div>
            {running && <Countdown snap={snap} offset={offset} size={84} />}
          </div>
          <div className="card flex flex-wrap gap-3 p-5">
            {lobby && <button className="btn btn-lime !min-h-[64px] text-xl" disabled={snap.players.length === 0} onClick={() => act('start')}>▶ Spiel starten ({snap.players.length})</button>}
            {running && (snap.paused
              ? <button className="btn btn-lime" onClick={() => act('resume')}>▶ Fortsetzen</button>
              : <button className="btn btn-ghost" onClick={() => act('pause')}>⏸ Pause</button>)}
            {running && <button className="btn btn-ghost" disabled={snap.paused} onClick={() => act('next')}>⏭ Nächster Schritt</button>}
            {snap.phase === 'QUESTION' && <button className="btn btn-coral" disabled={snap.paused} onClick={() => act('close')}>⏹ Frage schließen</button>}
            <button className="btn btn-ghost" onClick={() => { if (confirm('Spiel zurücksetzen? Alle Punkte werden gelöscht, Spieler bleiben in der Lobby.')) act('reset') }}>↺ Zurücksetzen</button>
          </div>
          <div className="card flex flex-wrap items-center gap-x-6 gap-y-3 p-5">
            <label className="flex items-center gap-3 font-bold"><input type="checkbox" className="h-6 w-6 accent-lime" checked={snap.auto} onChange={(e) => send({ t: 'host', cmd: 'auto', value: e.target.checked })} /> Automatikmodus</label>
            <label className="flex items-center gap-3 font-bold"><input type="checkbox" className="h-6 w-6 accent-lime" checked={!snap.wordsHidden} onChange={(e) => send({ t: 'host', cmd: 'words', value: !e.target.checked })} /> Wortwolke zeigen</label>
            <p className="w-full text-sm text-steel">{snap.auto ? 'Phasen laufen automatisch weiter (ca. 12 Minuten).' : 'Manuell: Nach jeder Frage mit „Nächster Schritt“ weiterschalten.'}</p>
          </div>
          <div className="card p-5">
            <div className="mb-3 font-bold">Teilnehmende ({snap.players.length}/20)</div>
            <ul className="flex flex-wrap gap-2">
              {snap.players.length === 0 && <li className="text-steel">Noch niemand da – QR-Code zeigen!</li>}
              {snap.players.map((p) => <li key={p.id} className={`rounded-full px-3 py-1 text-sm font-bold ${p.connected ? 'bg-navy3' : 'bg-navy3/40 text-steel'}`}>{p.avatar} {p.name}{!lobby && <span className="ml-2 text-lime">{p.score}</span>}</li>)}
            </ul>
          </div>
        </section>
        <aside className="flex flex-col gap-4">
          <div className="card flex flex-col items-center gap-3 p-5 text-center">
            <QR url={joinUrl} size={180} />
            <div className="display text-4xl tracking-[.15em] text-lime">{code}</div>
            <div className="break-all text-xs text-steel">{joinUrl}</div>
            <button className="btn btn-ghost w-full" onClick={() => copy(joinUrl, 'join')}>{copied === 'join' ? '✓ Kopiert' : 'Beitrittslink kopieren'}</button>
          </div>
          <a className="btn btn-lime" href={`/screen/${code}`} target="_blank" rel="noreferrer">🖥 Präsentationsansicht öffnen</a>
          <button className="btn btn-ghost text-sm" onClick={() => copy(`${location.origin}/host/${code}#k=${token}`, 'host')}>{copied === 'host' ? '✓ Kopiert' : '🔑 Privaten Moderator-Link kopieren'}</button>
          <p className="text-xs text-steel">Teile im Konferenztool nur das Fenster der Präsentationsansicht – nicht diese Seite und niemals den privaten Link.</p>
        </aside>
      </div>
    </div>
  )
}
