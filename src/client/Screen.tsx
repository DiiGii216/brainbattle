import { useEffect, useState } from 'react'
import { FORMAT_INFO, type Snapshot } from '../shared/protocol'
import Stage from './Stage'
import { ConnectionBanner, Confetti, Countdown, FormatBadge, Logo, QR, RankList, groupByRank } from './ui'
import { useRoom } from './useRoom'

export default function Screen({ code }: { code: string }) {
  const { snap, status, offset } = useRoom(code, () => ({ t: 'hello', role: 'screen' }))
  useEffect(() => {
    document.documentElement.style.fontSize = 'min(1.05vw, 1.87vh)'
    document.body.style.cursor = 'default'
    return () => { document.documentElement.style.fontSize = '' }
  }, [])
  const [fs, setFs] = useState(false)
  useEffect(() => { const h = () => setFs(!!document.fullscreenElement); document.addEventListener('fullscreenchange', h); return () => document.removeEventListener('fullscreenchange', h) }, [])
  const toggleFs = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.())

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <ConnectionBanner status={status} />
      {!fs && <button onClick={toggleFs} className="absolute right-3 top-3 z-30 rounded-lg bg-navy2/70 px-3 py-1 text-xs font-bold text-steel opacity-40 hover:opacity-100 focus:opacity-100">⛶ Vollbild</button>}
      {!snap ? <div className="grid h-full place-items-center"><Logo /></div> : <Content snap={snap} offset={offset} code={code} />}
    </div>
  )
}

function Content({ snap, offset, code }: { snap: Snapshot; offset: number; code: string }) {
  const joinUrl = `${location.origin}/join/${code}`
  const n = snap.players.length

  if (snap.phase === 'LOBBY') {
    const maxC = Math.max(1, ...snap.words.map((w) => w.count))
    return (
      <div className="grid h-full grid-cols-[1.1fr_1fr] gap-10 p-12">
        <div className="flex flex-col justify-between">
          <div><Logo huge /><p className="mt-4 text-3xl font-bold text-steel">20 Fragen. 10 Themen. Ein Champion.</p></div>
          <div className="flex items-center gap-8">
            <QR url={joinUrl} size={300} />
            <div>
              <div className="text-xl font-bold text-steel">Scanne den Code oder gehe auf</div>
              <div className="mt-1 text-2xl font-bold break-all">{location.host}</div>
              <div className="mt-3 text-xl font-bold text-steel">Raumcode</div>
              <div className="display text-[5rem] leading-none tracking-[.12em] text-lime">{code}</div>
            </div>
          </div>
        </div>
        <div className="card flex flex-col p-8">
          <div className="mb-4 flex items-baseline justify-between"><h2 className="display text-3xl">Spieler</h2><span className="display text-5xl text-lime">{n}</span></div>
          <ul className="flex flex-wrap content-start gap-3">
            {snap.players.map((p) => <li key={p.id} className="a-pop rounded-full bg-navy3 px-5 py-2 text-2xl font-bold">{p.avatar} {p.name}</li>)}
            {n === 0 && <li className="text-2xl text-steel">Warte auf die ersten Mitspielenden …</li>}
          </ul>
          {!snap.wordsHidden && snap.words.length > 0 && (
            <div className="mt-auto border-t border-steel/20 pt-5">
              <div className="mb-2 text-lg font-bold text-steel">Was verbindet ihr mit Personalplanung?</div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                {snap.words.map((w) => <span key={w.word} className="a-pop font-extrabold text-sky" style={{ fontSize: `${1.2 + (w.count / maxC) * 1.8}rem` }}>{w.word}</span>)}
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
      <div className="grid h-full place-items-center text-center"><div className="a-pop">
        <div className="text-[9rem]" aria-hidden>{FORMAT_INFO[u.format].emoji}</div>
        <div className="mt-2 text-3xl font-bold text-steel">Frage {u.number} von {snap.total} · {u.level === 'KNOW' ? 'KNOW IT' : 'PROVE IT'}</div>
        <h1 className="display mt-2 text-[5.5rem] leading-none text-lime">{FORMAT_INFO[u.format].name}</h1>
        <p className="mt-4 text-3xl text-steel">{FORMAT_INFO[u.format].hint}</p>
      </div></div>
    )
  }

  if (snap.phase === 'QUESTION' || snap.phase === 'REVEAL') {
    const q = snap.question!
    const reveal = snap.phase === 'REVEAL' ? snap.reveal : null
    return (
      <div className="flex h-full flex-col gap-5 p-10">
        <header className="flex items-center gap-6">
          <div className="display text-3xl text-steel">Frage <span className="text-snow">{q.number}</span>/{q.total}</div>
          <FormatBadge q={q} big />
          <div className="truncate text-xl font-bold text-steel">{q.topic}</div>
          <div className="ml-auto flex items-center gap-6">
            {snap.phase === 'QUESTION' && <div className="text-right"><div className="display text-5xl tabular-nums">{snap.answeredCount}<span className="text-steel">/{n}</span></div><div className="text-sm font-bold text-steel">Antworten</div></div>}
            {snap.phase === 'QUESTION' ? <Countdown snap={snap} offset={offset} size={128} /> : <div className="rounded-full bg-lime px-5 py-2 text-xl font-extrabold text-navy">AUFLÖSUNG</div>}
          </div>
        </header>
        {snap.paused && <div role="status" className="rounded-2xl bg-amber p-3 text-center text-2xl font-extrabold text-navy">⏸ Pause</div>}
        <div className={`min-h-0 flex-1 ${reveal ? 'grid grid-cols-[1fr_22rem] gap-8' : ''}`}>
          <div key={q.id} className="a-up h-full"><Stage q={q} reveal={reveal} /></div>
          {reveal && (
            <aside className="a-up flex min-h-0 flex-col gap-4">
              <div className="card p-5"><div className="text-sm font-bold uppercase tracking-wider text-lime">Kurz erklärt</div><p className="mt-1 text-xl leading-snug">💡 {reveal.explanation}</p>
                <p className="mt-2 text-sm text-steel">{reveal.stats.unanswered > 0 ? `${reveal.stats.unanswered} ohne Antwort` : 'Alle haben geantwortet'}</p></div>
              <div className="card min-h-0 flex-1 p-4"><div className="mb-2 text-sm font-bold uppercase tracking-wider text-steel">Top 5</div><RankList players={snap.players} limit={5} rowH={3.2} delta /></div>
            </aside>
          )}
        </div>
      </div>
    )
  }

  if (snap.phase === 'INTERMISSION') {
    return (
      <div className="flex h-full flex-col gap-4 p-12">
        <div className="flex items-center justify-between"><h1 className="display text-6xl text-lime">Zwischenstand nach Frage {snap.qIndex + 1}</h1><Countdown snap={snap} offset={offset} size={110} /></div>
        <div className="min-h-0 flex-1 overflow-hidden"><RankList players={snap.players} limit={Math.min(n, 10)} rowH={4.3} /></div>
        {snap.paused && <div className="rounded-2xl bg-amber p-3 text-center text-2xl font-extrabold text-navy">⏸ Pause</div>}
      </div>
    )
  }

  return <Final snap={snap} />
}

function Final({ snap }: { snap: Snapshot }) {
  const [stage, setStage] = useState(0)
  useEffect(() => {
    const t = [setTimeout(() => setStage(1), 2500), setTimeout(() => setStage(2), 6000), setTimeout(() => setStage(3), 10000)]
    return () => t.forEach(clearTimeout)
  }, [])
  const groups = groupByRank(snap.players)
  const place = (r: number) => groups.find(([rk]) => rk === r)?.[1] ?? []
  // Podium-Reihenfolge: 2 – 1 – 3
  const cols = [{ r: 2, h: '55%', show: stage >= 2, c: 'bg-steel', e: '🥈' }, { r: 1, h: '80%', show: stage >= 3, c: 'bg-lime', e: '🏆' }, { r: 3, h: '38%', show: stage >= 1, c: 'bg-amber', e: '🥉' }]
  const champs = place(1)
  return (
    <div className="grid h-full grid-cols-[1.5fr_1fr] gap-10 p-12">
      {stage >= 3 && <Confetti />}
      <div className="flex min-h-0 flex-col">
        <h1 className="display text-6xl">{stage >= 3 ? <>Champion: <span className="text-lime">{champs.map((p) => p.name).join(' & ')}</span></> : 'Und der Champion ist …'}</h1>
        <div className="mt-6 grid min-h-0 flex-1 grid-cols-3 items-end gap-6">
          {cols.map((c) => (
            <div key={c.r} className="flex h-full flex-col justify-end text-center">
              {c.show && place(c.r).length > 0 && (
                <>
                  <div className="a-pop mb-3"><div className="text-6xl" aria-hidden>{place(c.r)[0].avatar}</div>
                    {place(c.r).map((p) => <div key={p.id} className="truncate text-3xl font-extrabold">{p.name}</div>)}
                    <div className="display text-4xl text-lime">{place(c.r)[0].score}</div></div>
                  <div className={`a-grow ${c.c} grid place-items-start rounded-t-3xl pt-4 text-navy`} style={{ height: c.h }}><div className="display mx-auto text-7xl">{c.r}</div></div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="card flex min-h-0 flex-col p-6">
        <h2 className="display mb-3 text-2xl">Gesamtübersicht</h2>
        <div className="min-h-0 flex-1 overflow-hidden"><RankList players={snap.players} limit={Math.min(snap.players.length, 10)} rowH={3.4} /></div>
        <p className="mt-2 text-sm text-steel">Gleichstand: mehr Praxisfragen komplett richtig, dann mehr Fragen komplett richtig.</p>
      </div>
    </div>
  )
}
