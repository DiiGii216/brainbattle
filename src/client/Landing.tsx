import { useState } from 'react'
import { Logo } from './ui'

export default function Landing() {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function create() {
    setBusy(true); setErr('')
    try {
      const r = await fetch('/api/rooms', { method: 'POST' })
      if (!r.ok) throw new Error()
      const { code, hostToken } = await r.json() as { code: string; hostToken: string }
      localStorage.setItem(`bb-host-${code}`, hostToken)
      location.href = `/host/${code}`
    } catch { setErr('Raum konnte nicht erstellt werden. Bitte erneut versuchen.'); setBusy(false) }
  }
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-8 px-4 py-10">
      <div className="a-up text-center"><Logo /><p className="mt-4 text-lg font-semibold text-steel">20 Fragen. 10 Themen. Ein Champion.</p></div>
      <form className="card a-up flex flex-col gap-3 p-5" onSubmit={(e) => { e.preventDefault(); if (/^\d{6}$/.test(code)) location.href = `/join/${code}` }}>
        <label htmlFor="code" className="font-bold">Ich spiele mit – Raumcode</label>
        <input id="code" inputMode="numeric" autoComplete="off" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          placeholder="6-stelliger Code" className="display rounded-2xl bg-navy px-4 py-4 text-center text-3xl tracking-[.3em] outline-none ring-2 ring-steel/30 focus:ring-lime" />
        <button className="btn btn-lime" disabled={code.length !== 6}>Beitreten</button>
      </form>
      <div className="card a-up p-5">
        <p className="mb-3 font-bold">Ich moderiere</p>
        <button className="btn btn-ghost w-full" onClick={create} disabled={busy}>{busy ? 'Erstelle …' : 'Neuen Spielraum erstellen'}</button>
        {err && <p role="alert" className="mt-2 text-coral">{err}</p>}
      </div>
    </main>
  )
}
