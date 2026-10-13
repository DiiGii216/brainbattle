import { useEffect, useState } from 'react'
import { Crown } from 'lucide-react'
import { FORMAT_INFO, type Snapshot } from '../shared/protocol'
import Stage from './Stage'
import { ConnectionBanner, Confetti, Countdown, FormatBadge, Logo, QR, RankList, groupByRank } from './ui'
import { useRoom } from './useRoom'

/** Fenstergröße der (ggf. nur kleinen) Bildschirmfreigabe – steuert nur, wie viel Zusatzinhalt gezeigt wird, nie die Schriftgröße. */
function useViewport() {
  const [v, setV] = useState({ w: innerWidth, h: innerHeight })
  useEffect(() => { const h = () => setV({ w: innerWidth, h: innerHeight }); addEventListener('resize', h); return () => removeEventListener('resize', h) }, [])
  return v
}
/** Zeilenhöhe der Rangliste: füllt die verfügbare Höhe für n Teilnehmende, bleibt aber lesbar (≥ 1,9 rem). */
const rowH = (n: number, reserve: string, max = '4.3rem') => `clamp(1.9rem, calc((100vh - ${reserve}) / ${Math.max(n, 1)}), ${max})`

export default function Screen({ code }: { code: string }) {
  const { snap, status, offset } = useRoom(code, () => ({ t: 'hello', role: 'screen' }))
  useEffect(() => { document.body.style.cursor = 'default' }, [])
  const [fs, setFs] = useState(false)
  useEffect(() => { const h = () => setFs(!!document.fullscreenElement); document.addEventListener('fullscreenchange', h); return () => document.removeEventListener('fullscreenchange', h) }, [])
  const toggleFs = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.())

  return (
    <div className="relative h-dvh w-screen overflow-hidden">
      <ConnectionBanner status={status} />
      {!fs && <button onClick={toggleFs} className="absolute right-3 top-3 z-30 rounded-lg bg-surface/70 px-3 py-1 text-sm font-bold text-mute opacity-40 hover:opacity-100 focus:opacity-100">⛶ Vollbild</button>}
      {!snap ? <div className="grid h-full place-items-center"><Logo /></div> : <Content snap={snap} offset={offset} code={code} />}
    </div>
  )
}

function Content({ snap, offset, code }: { snap: Snapshot; offset: number; code: string }) {
  const joinUrl = `${location.origin}/join/${code}`
  const n = snap.players.length
  const { w, h } = useViewport()
  const tight = h < 640 || w < 1100 // wenig Platz: Dekoration und Zusatzspalten weglassen

  if (snap.phase === 'LOBBY') {
    const maxC = Math.max(1, ...snap.words.map((x) => x.count))
    const qr = Math.round(Math.min(300, h * 0.32))
    return (
      <div className="s-pad grid h-full grid-cols-[1.1fr_1fr] gap-[3vw]">
        <div className="flex min-h-0 flex-col justify-between gap-4">
          <div><Logo huge /><p className="s-answer mt-3 font-bold text-mute">20 Fragen. 10 Themen. Ein Champion.</p></div>
          <div className="flex items-center gap-6">
            <QR url={joinUrl} size={qr} />
            <div className="min-w-0">
              <div className="s-info font-bold text-mute">Scanne den Code oder gehe auf</div>
              <div className="s-answer font-bold break-all">{location.host}</div>
              <div className="s-info mt-2 font-bold text-mute">Raumcode</div>
              <div className="display text-[clamp(2.5rem,min(6vw,11vh),5rem)] leading-none tracking-[.12em] text-gold">{code}</div>
            </div>
          </div>
        </div>
        <div className="card flex min-h-0 flex-col overflow-hidden p-[clamp(.75rem,2vw,2rem)]">
          <div className="mb-3 flex items-baseline justify-between"><h2 className="display s-title">Spieler</h2><span className="display s-title text-gold">{n}</span></div>
          <ul className="flex flex-wrap content-start gap-2 overflow-hidden">
            {snap.players.map((p) => <li key={p.id} className="a-pop s-info rounded-full border border-line-strong bg-surface px-4 py-1.5 font-bold">{p.avatar} {p.name}</li>)}
            {n === 0 && <li className="s-answer text-mute">Warte auf die ersten Mitspielenden …</li>}
          </ul>
          {!snap.wordsHidden && snap.words.length > 0 && (
            <div className="mt-auto border-t border-line pt-3">
              <div className="s-info mb-2 font-bold text-mute">Was verbindet ihr mit Personalplanung?</div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                {snap.words.map((x) => <span key={x.word} className="a-pop font-extrabold text-violet-soft" style={{ fontSize: `clamp(1rem, ${0.8 + (x.count / maxC) * 1.4}rem + 1vh, 3rem)` }}>{x.word}</span>)}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (snap.phase === 'INTERMISSION' && snap.kind === 'next') {
    const u = snap.upcoming!
    return (
      <div className="grid h-full place-items-center px-6 text-center"><div className="a-pop">
        <div className="text-[clamp(4rem,18vh,9rem)] leading-none" aria-hidden>{FORMAT_INFO[u.format].emoji}</div>
        <div className="s-answer mt-2 font-bold text-mute">Frage {u.number} von {snap.total} · {u.level === 'KNOW' ? 'KNOW IT' : 'PROVE IT'}</div>
        <h1 className="display mt-2 text-[clamp(2rem,min(7vw,12vh),5.5rem)] leading-none text-gold">{FORMAT_INFO[u.format].name}</h1>
        <p className="s-answer mt-3 text-mute">{FORMAT_INFO[u.format].hint}</p>
      </div></div>
    )
  }

  if (snap.phase === 'QUESTION' || snap.phase === 'REVEAL') {
    const q = snap.question!
    const reveal = snap.phase === 'REVEAL' ? snap.reveal : null
    const top3 = snap.phase === 'QUESTION' && h >= 700 && snap.players.some((p) => p.score > 0) ? snap.players.slice(0, 3) : []
    const side = !!reveal && !tight
    return (
      <div className="s-pad flex h-full flex-col s-gap">
        <header className="flex shrink-0 items-center gap-4">
          <div className="display s-info text-mute">Frage <span className="text-ink">{q.number}</span>/{q.total}</div>
          <FormatBadge q={q} big />
          {!tight && <div className="s-info min-w-0 truncate font-bold text-mute">{q.topic}</div>}
          <div className="ml-auto flex items-center gap-4">
            {snap.phase === 'QUESTION' && <div className="text-right"><div className="display text-[clamp(1.5rem,5vh,3rem)] tabular-nums">{snap.answeredCount}<span className="text-mute">/{n}</span></div><div className="text-sm font-bold text-mute">Antworten</div></div>}
            {snap.phase === 'QUESTION' ? <Countdown snap={snap} offset={offset} size={h < 640 ? 64 : 96} /> : <div className="s-info rounded-full bg-gold px-4 py-1.5 font-extrabold text-bg">AUFLÖSUNG</div>}
          </div>
        </header>
        {snap.paused && <div role="status" className="s-answer shrink-0 rounded-2xl bg-gold p-2 text-center font-extrabold text-bg">⏸ Pause</div>}
        <div className={`min-h-0 flex-1 ${side ? 'grid grid-cols-[1fr_clamp(16rem,24vw,22rem)] gap-6' : 'flex flex-col s-gap'}`}>
          <div key={q.id} className="a-up h-full min-h-0 flex-1"><Stage q={q} reveal={reveal} /></div>
          {reveal && (
            <aside className={`a-up flex min-h-0 flex-col gap-3 ${side ? '' : 'shrink-0'}`}>
              <div className="card p-4"><div className="text-sm font-bold uppercase tracking-wider text-gold">Kurz erklärt</div><p className="s-info mt-1 leading-snug">💡 {reveal.explanation}</p>
                {side && <p className="mt-2 text-base text-mute">{reveal.stats.unanswered > 0 ? `${reveal.stats.unanswered} ohne Antwort` : 'Alle haben geantwortet'}</p>}</div>
              {side && <div className="card min-h-0 flex-1 p-3"><div className="mb-2 text-sm font-bold uppercase tracking-wider text-mute">Top 5</div><RankList players={snap.players} limit={5} rowH="clamp(2.2rem, 6.5vh, 3.2rem)" delta /></div>}
            </aside>
          )}
        </div>
        {top3.length > 0 && (
          <footer className="s-info flex shrink-0 items-center gap-5 text-mute" aria-label="Aktuelle Top 3">
            <span className="font-bold uppercase tracking-wider">Top 3</span>
            {top3.map((p) => <span key={p.id} className="font-bold text-ink">{p.rank}. {p.avatar} {p.name} <span className="text-gold">{p.score}</span></span>)}
          </footer>
        )}
      </div>
    )
  }

  if (snap.phase === 'INTERMISSION') {
    // Alle Teilnehmenden (auch bei 12+) – Zeilenhöhe passt sich der Fensterhöhe an.
    return (
      <div className="s-pad flex h-full flex-col s-gap">
        <div className="flex shrink-0 items-center justify-between gap-4"><h1 className="display s-title text-gold">Zwischenstand nach Frage {snap.qIndex + 1}</h1><Countdown snap={snap} offset={offset} size={h < 640 ? 56 : 88} /></div>
        <div className="mx-auto min-h-0 w-full max-w-5xl flex-1 overflow-y-auto text-[clamp(1rem,2.7vh,1.5rem)]"><RankList players={snap.players} rowH={rowH(n, '9.5rem')} /></div>
        {snap.paused && <div className="s-answer shrink-0 rounded-2xl bg-gold p-2 text-center font-extrabold text-bg">⏸ Pause</div>}
      </div>
    )
  }

  return <Final snap={snap} tight={tight} />
}

function Final({ snap, tight }: { snap: Snapshot; tight: boolean }) {
  const [stage, setStage] = useState(0)
  useEffect(() => {
    const t = [setTimeout(() => setStage(1), 2500), setTimeout(() => setStage(2), 6000), setTimeout(() => setStage(3), 10000)]
    return () => t.forEach(clearTimeout)
  }, [])
  const n = snap.players.length
  const groups = groupByRank(snap.players)
  const place = (r: number) => groups.find(([rk]) => rk === r)?.[1] ?? []
  // Podium-Reihenfolge: 2 – 1 – 3. Geteilte Ränge: alle Namen auf derselben Stufe.
  const cols = [{ r: 2, h: '55%', show: stage >= 2, c: 'bg-mute', e: '🥈' }, { r: 1, h: '80%', show: stage >= 3, c: 'bg-gold', e: '🏆' }, { r: 3, h: '38%', show: stage >= 1, c: 'bg-gold-light', e: '🥉' }]
  const champs = place(1)
  return (
    <div className="s-pad grid h-full grid-cols-[1.4fr_1fr] gap-[2.5vw]">
      {stage >= 3 && <Confetti />}
      <div className="flex min-h-0 flex-col s-gap">
        <section className={`card shrink-0 p-4 text-center ${stage >= 3 ? 'glow-gold a-pop' : ''}`} aria-live="polite" aria-label="Champion">
          {stage >= 3
            ? <><div className="s-info flex items-center justify-center gap-2 font-bold uppercase tracking-widest text-gold"><Crown size={28} aria-hidden /> Champion</div>
                <h1 className="display s-title [overflow-wrap:anywhere]">{champs.map((p) => `${p.avatar} ${p.name}`).join(' & ')}</h1>
                <div className="display s-answer text-gold">{champs[0]?.score} Punkte</div></>
            : <h1 className="display s-title">Und der Champion ist …</h1>}
        </section>
        <div className="grid min-h-0 flex-1 grid-cols-3 items-end gap-4" aria-label="Siegerpodest">
          {cols.map((c) => (
            <div key={c.r} className="flex h-full min-h-0 flex-col justify-end text-center">
              {c.show && place(c.r).length > 0 && (
                <>
                  <div className="a-pop mb-2"><div className="text-[clamp(1.75rem,7vh,3.5rem)] leading-none" aria-hidden>{place(c.r)[0].avatar}</div>
                    {place(c.r).map((p) => <div key={p.id} className="s-answer font-extrabold [overflow-wrap:anywhere]">{p.name}</div>)}
                    <div className="display s-answer text-gold">{place(c.r)[0].score}</div></div>
                  <div className={`a-grow ${c.c} grid place-items-start rounded-t-2xl pt-2 text-bg`} style={{ height: c.h }}><div className="display mx-auto text-[clamp(1.75rem,7vh,4.5rem)]">{c.r}</div></div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="card flex min-h-0 flex-col p-4">
        <h2 className="display mb-2 shrink-0 text-xl">Gesamtübersicht</h2>
        <div className="min-h-0 flex-1 overflow-y-auto text-[clamp(1rem,2.5vh,1.3rem)]"><RankList players={snap.players} rowH={rowH(n, tight ? '10rem' : '12.5rem', '3.4rem')} /></div>
        {!tight && <p className="mt-2 shrink-0 text-base text-mute">Gleichstand: mehr Praxisfragen komplett richtig, dann mehr Fragen komplett richtig.</p>}
      </div>
    </div>
  )
}
