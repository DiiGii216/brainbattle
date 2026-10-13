// Browser-E2E (Playwright + vorinstalliertes Chromium) gegen laufenden Worker (wrangler dev, TIME_SCALE=1) und gebautes dist/client.
//   npx wrangler dev --port 8787   |   CHROMIUM=/opt/pw-browsers/chromium-*/chrome-linux/chrome npm run e2e
// Prüft über die echte Oberfläche (keine State-Manipulation): Matchmaker per Tippen / Ziehen (Maus + Touch), Ordering per Tippen /
// Ziehen / Tastatur / Pfeile, Sperre nach Abgabe, ehrliche Sende-Bestätigung, 4 Handy-Breiten, 4 Präsentationsgrößen,
// 12 Teilnehmende (6 Browser + 6 Bots), alle 20 Fragen, Zwischenranking, Finale. Screenshots landen in ./shots.
import { chromium } from 'playwright-core'
import fs from 'node:fs'

const BASE = process.env.BASE ?? 'http://localhost:8787'
const out = 'shots'; fs.mkdirSync(out, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let fails = 0
const ok = (c, m) => { if (!c) { fails++; console.error('✗', m) } else console.log('✓', m) }
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined })

/* ---------------- Setup: Host, 5 Präsentationsgrößen, 6 Handys, 6 Bots ---------------- */
const host = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage()
await host.goto(BASE + '/')
await host.getByRole('button', { name: /Spielraum erstellen/ }).click()
await host.waitForURL(/\/host\/\d{6}/)
const code = host.url().match(/host\/(\d{6})/)[1]

const SCREEN_SIZES = [[1280, 720], [960, 540], [1280, 640], [1366, 768], [1920, 1080]]
const screens = []
for (const [w, h] of SCREEN_SIZES) {
  const page = await (await browser.newContext({ viewport: { width: w, height: h } })).newPage()
  await page.goto(`${BASE}/screen/${code}`)
  screens.push({ w, h, page })
}

let dropAnswers = false
const PHONES = [
  { name: 'Anna', w: 375, h: 700 }, { name: 'Ben', w: 390, h: 844 },
  { name: 'W320', w: 320, h: 700 }, { name: 'W360', w: 360, h: 780 }, { name: 'W390', w: 390, h: 844 }, { name: 'W430', w: 430, h: 932 },
]
const phones = []
for (const d of PHONES) {
  const ctx = await browser.newContext({ viewport: { width: d.w, height: d.h }, isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  if (d.name === 'W320') { // Netzwerkausfall simulieren: Antworten werden nicht an den Server weitergereicht
    await page.routeWebSocket(/\/ws$/, (ws) => {
      const server = ws.connectToServer()
      ws.onMessage((m) => { if (dropAnswers && String(m).includes('"t":"answer"')) return; server.send(m) })
      server.onMessage((m) => ws.send(m))
    })
  }
  await page.goto(`${BASE}/join/${code}`)
  await page.getByLabel('Wie heißt du?').fill(d.name)
  await page.getByRole('button', { name: /Los geht/ }).click()
  await page.getByText('Du bist drin').waitFor()
  phones.push({ ...d, page, ctx, cdp: await ctx.newCDPSession(page) })
}
const [anna, ben, w320, w360, w390, w430] = phones

// 6 Bots (Node-WebSocket) beantworten jede Frage zufällig gültig → insgesamt 12 Teilnehmende
const rnd = (n) => Math.floor(Math.random() * n)
const perm = (n) => { const a = Array.from({ length: n }, (_, i) => i); for (let i = n - 1; i > 0; i--) { const j = rnd(i + 1);[a[i], a[j]] = [a[j], a[i]] } return a }
for (const name of ['Bot Cem', 'Bot Dana', 'Bot Eli', 'Bot Fynn', 'Bot Gül', 'Bot Hans']) {
  const ws = new WebSocket(BASE.replace('http', 'ws') + `/api/rooms/${code}/ws`)
  const done = new Set()
  ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', role: 'player', name }))
  ws.onmessage = (e) => {
    const m = JSON.parse(String(e.data))
    if (m.t !== 'state' || m.s.phase !== 'QUESTION' || m.s.you?.answered || done.has(m.s.question.id)) return
    done.add(m.s.question.id)
    const q = m.s.question
    const a = q.format === 'match' ? perm(q.lefts.length) : q.format === 'order' ? perm(q.items.length) : rnd(q.options.length)
    setTimeout(() => ws.readyState === 1 && ws.send(JSON.stringify({ t: 'answer', q: q.id, a })), 300 + rnd(1500))
  }
}
await sleep(600)

/* ---------------- Hilfsfunktionen ---------------- */
const center = async (loc) => { const b = await loc.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 } }
const inView = async (page, loc) => { const b = await loc.boundingBox(); const vp = page.viewportSize(); return !!b && b.y >= 0 && b.y + b.height <= vp.height && b.x >= 0 && b.x + b.width <= vp.width }

/** Ziehen mit der Maus (Pointer-Events, pointerType=mouse). */
async function mouseDrag(page, from, to, { drop = true } = {}) {
  await from.scrollIntoViewIfNeeded()
  const a = await center(from), b = typeof to.x === 'number' ? to : await center(to)
  await page.mouse.move(a.x, a.y); await page.mouse.down()
  await page.mouse.move(a.x + 8, a.y + 8, { steps: 4 })
  await page.mouse.move(b.x, b.y, { steps: 14 })
  await sleep(200)
  if (typeof to.x !== 'number') { // Autoscroll kann das Ziel verschoben haben → nachführen
    for (let i = 0; i < 3; i++) { const c = await center(to); await page.mouse.move(c.x, c.y, { steps: 4 }); await sleep(150) }
  }
  if (drop) { await page.mouse.up(); await sleep(450) }
}
/** Ziehen per Touch (CDP): erst 350 ms halten (kontrollierte Aktivierung), dann bewegen. Optional vorher "scrollen" testen. */
async function touchDrag(p, from, to, { hold = 350 } = {}) {
  const a = await center(from), b = typeof to.x === 'number' ? to : await center(to)
  const t = (type, x, y) => p.cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] })
  await t('touchStart', a.x, a.y); await sleep(hold)
  for (let i = 1; i <= 12; i++) { await t('touchMove', a.x + ((b.x - a.x) * i) / 12, a.y + ((b.y - a.y) * i) / 12); await sleep(16) }
  await sleep(100); await t('touchEnd'); await sleep(450)
}

const matchState = (page) => page.evaluate(() => [...document.querySelectorAll('ul[aria-label="Begriffe"] > li')].map((li) => li.querySelector('span.flex-1 > span:nth-child(2)').textContent.trim()))
const leftCard = (page, text) => page.locator('ul[aria-label="Begriffe"] button', { hasText: text })
const zone = (page, text) => page.locator('ul[aria-label="Zielfelder"] > li', { has: page.locator(`button[aria-label^="Zielfeld: ${text}"]`) })
const zoneBtn = (page, text) => page.locator(`button[aria-label^="Zielfeld: ${text}"]`)
const orderList = (page) => page.locator('ol[aria-label="Deine Reihenfolge"] > li span.flex-1').allInnerTexts()
const pool = (page, t) => page.locator('ul[aria-label="Noch nicht eingeordnete Karten"] button', { hasText: t })
const submitBtn = (page) => page.getByRole('button', { name: /Antwort abgeben|Wird gesendet/ })
const lockedAnswer = async (page) => { await page.getByText('Antwort gesperrt').waitFor({ timeout: 8000 }); return (await page.locator('.card:has-text("Deine Antwort") li').allInnerTexts()).join(' | ') }
const next = host.getByRole('button', { name: /Nächster Schritt/ })
const phaseLabel = async () => (await host.locator('.display.text-2xl').first().textContent()).trim()
const waitLabel = async (re, t = 30000) => { const end = Date.now() + t; while (Date.now() < end) { if (re.test(await phaseLabel())) return true; await sleep(150) } return false }
const step = async () => { await next.click({ timeout: 8000 }).catch(async (e) => { await host.screenshot({ path: `${out}/host-fail.png` }); console.error(await host.locator('body').innerText()); throw e }); await sleep(450) }

/** Layout-Invarianten eines Handys: kein horizontaler Scroll, Absenden sichtbar, Mindestgrößen. */
async function phoneLayout(p, tag) {
  const r = await p.page.evaluate(() => {
    const vw = innerWidth, vh = innerHeight
    const sw = document.documentElement.scrollWidth <= vw
    const wide = [...document.querySelectorAll('main *')].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.right > vw + 1 }).length
    const sub = [...document.querySelectorAll('button')].find((b) => /Antwort abgeben|Wird gesendet/.test(b.textContent))
    const sb = sub?.getBoundingClientRect()
    const small = [...document.querySelectorAll('[role=radio], .dropzone, .choice')].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height < 60 }).length
    const fs = (sel) => [...document.querySelectorAll(sel)].map((e) => parseFloat(getComputedStyle(e).fontSize))
    const h1 = document.querySelector('main h1'), h1fs = h1 ? parseFloat(getComputedStyle(h1).fontSize) : null
    return { sw, wide, subVisible: !!sb && sb.top >= 0 && sb.bottom <= vh + 1 && sb.width > 0, small, answerFs: Math.min(...fs('[role=radio] .flex-1, ul[aria-label="Begriffe"] button span.text-lg, ol[aria-label="Deine Reihenfolge"] span.flex-1'), 99), h1fs }
  })
  ok(r.sw && r.wide === 0, `${tag} ${p.w}px: kein horizontaler Scroll (${r.wide} überstehende Elemente)`)
  ok(r.subVisible, `${tag} ${p.w}px: Absenden-Button sichtbar (sticky)`)
  ok(r.small === 0, `${tag} ${p.w}px: alle Antwortkarten/Zielfelder ≥ 60 px hoch (${r.small} zu klein)`)
  ok(r.answerFs >= 18, `${tag} ${p.w}px: Antworttext ≥ 18 px (${r.answerFs})`)
  ok(r.h1fs >= 20 && r.h1fs <= 24.5, `${tag} ${p.w}px: Fragetext 20–24 px (${r.h1fs})`)
}

/** Präsentationsansicht: nichts abgeschnitten, Schriftgrößen im Soll, keine Seiten-Scrollbalken. */
async function screenLayout(s, tag, { question = false } = {}) {
  const r = await s.page.evaluate(() => {
    const vw = innerWidth, vh = innerHeight
    const doc = document.documentElement
    const els = [...document.querySelectorAll('.s-answer, .s-question')].filter((e) => e.getBoundingClientRect().width > 0)
    const clipped = els.filter((e) => { const b = e.getBoundingClientRect(); return b.bottom > vh + 1 || b.right > vw + 1 || b.top < -1 || e.scrollHeight > e.clientHeight + 2 }).length
    const q = document.querySelector('.s-question'), a = document.querySelector('.s-answer')
    return { noScroll: doc.scrollHeight <= vh + 1 && doc.scrollWidth <= vw + 1, clipped, n: els.length, qfs: q ? parseFloat(getComputedStyle(q).fontSize) : null, afs: a ? parseFloat(getComputedStyle(a).fontSize) : null, ellipsis: document.querySelectorAll('.truncate').length }
  })
  ok(r.noScroll, `${tag} ${s.w}×${s.h}: kein Seiten-Scroll`)
  ok(r.clipped === 0, `${tag} ${s.w}×${s.h}: Inhalte vollständig sichtbar (${r.clipped}/${r.n} abgeschnitten)`)
  if (question && s.w === 1280 && s.h === 720) {
    ok(r.qfs >= 32 && r.qfs <= 40, `${tag} 1280×720: Fragetext 32–40 px (${r.qfs?.toFixed(1)})`)
    ok(r.afs >= 22 && r.afs <= 26, `${tag} 1280×720: Antworttext 22–26 px (${r.afs?.toFixed(1)})`)
  }
  if (question) ok(r.qfs >= 24 && r.afs >= 18, `${tag} ${s.w}×${s.h}: Mindestgrößen Frage ≥ 24 / Antwort ≥ 18 px (${r.qfs?.toFixed(1)}/${r.afs?.toFixed(1)})`)
}
/** Ranking vollständig: n Zeilen, alle innerhalb des Fensters bzw. des Scrollcontainers sichtbar bzw. erreichbar. */
async function rankingFull(page, tag, n, { scrollable = false } = {}) {
  const r = await page.evaluate(() => {
    const vh = innerHeight
    const rows = [...document.querySelectorAll('ol[aria-label="Rangliste"] > li')]
    const box = rows[0]?.closest('ol')?.parentElement?.getBoundingClientRect()
    return { n: rows.length, maxBottom: Math.max(...rows.map((l) => l.getBoundingClientRect().bottom)), boxBottom: box ? Math.min(box.bottom, vh) : vh, rowFs: Math.min(...rows.map((l) => parseFloat(getComputedStyle(l).fontSize))), vh }
  })
  ok(r.n === n, `${tag}: ${r.n} von ${n} Teilnehmenden in der Rangliste`)
  if (!scrollable) ok(r.maxBottom <= r.boxBottom + 1, `${tag}: letzte Zeile vollständig sichtbar, nicht vom Container abgeschnitten (unten ${Math.round(r.maxBottom)} ≤ ${Math.round(r.boxBottom)})`)
}
const shot = (page, f) => page.screenshot({ path: `${out}/${f}.png` })
const antwortenGeprueft = new Set()

/* ---------------- 1. Lobby ---------------- */
await anna.page.getByLabel(/Welches Wort/).fill('Planung'); await anna.page.getByRole('button', { name: 'Senden' }).click()
await screens[0].page.getByText('Planung').first().waitFor()
for (const s of screens) { await screenLayout(s, 'Lobby'); ok(await s.page.getByText(code).first().isVisible(), `Screen ${s.w}×${s.h} zeigt Raumcode`) }
await shot(screens[0].page, 'screen-lobby'); await shot(anna.page, 'phone-lobby'); await shot(host, 'host-lobby')
await ben.page.reload(); await ben.page.getByText('Du bist drin').waitFor()
ok(await ben.page.getByText('Ben').first().isVisible(), 'Refresh in der Lobby erhält Spieleridentität')
await host.getByRole('button', { name: /Spiel starten/ }).click()

/* ---------------- 2. Frage 1 (Matchmaker, 2 Paare, Echtzeit): Anna tippt, Ben zieht ---------------- */
await anna.page.getByText('Aufbauorganisation').first().waitFor()
await sleep(700)
for (const p of phones) await phoneLayout(p, 'Q1')
for (const s of screens) await screenLayout(s, 'Q1', { question: true })
await shot(screens[0].page, 'screen-q1'); await shot(anna.page, 'phone-q1')
ok(await submitBtn(anna.page).isDisabled(), 'Q1: Absenden gesperrt, solange nichts zugeordnet ist')
// Anna: Tippen (Begriff → Zielfeld)
await leftCard(anna.page, 'Aufbauorganisation').click(); await zoneBtn(anna.page, 'Zuständigkeiten und Hierarchien').click()
ok(await submitBtn(anna.page).isDisabled(), 'Q1: unvollständige Zuordnung (1 von 2) nicht absendbar')
ok((await matchState(anna.page))[0].includes('Zuständigkeiten'), 'Q1 Tippen: erste Zuordnung gesetzt')
// automatisch zum nächsten freien Begriff weitergesprungen → Zielfeld direkt antippen
await zoneBtn(anna.page, 'Arbeitsabläufe und Prozessreihenfolge').click()
ok((await matchState(anna.page))[1].includes('Arbeitsabläufe'), 'Q1 Tippen: Auto-Weiterschalten zum nächsten freien Begriff')
await shot(anna.page, 'phone-q1-filled')
// Ben: Ziehen per Maus (Aufbau → Zuständigkeiten) und per Touch (Ablauf → Arbeitsabläufe)
await mouseDrag(ben.page, leftCard(ben.page, 'Aufbauorganisation'), zone(ben.page, 'Zuständigkeiten und Hierarchien'))
ok((await matchState(ben.page))[0].includes('Zuständigkeiten'), 'Q1 Ziehen (Maus): Zuordnung gesetzt')
await touchDrag(ben, leftCard(ben.page, 'Ablauforganisation'), zone(ben.page, 'Arbeitsabläufe und Prozessreihenfolge'))
ok((await matchState(ben.page))[1].includes('Arbeitsabläufe'), 'Q1 Ziehen (Touch, Long-Press): Zuordnung gesetzt')
ok(await ben.page.locator('ul[aria-label="Zielfelder"] .badge-num').count() === 2, 'Q1: Zuordnungsnummern an den Zielfeldern sichtbar')
await shot(ben.page, 'phone-q1-dragged')
await submitBtn(anna.page).click()
await submitBtn(ben.page).click()
const a1 = await lockedAnswer(anna.page), b1 = await lockedAnswer(ben.page)
ok(a1 === b1 && a1.includes('Aufbauorganisation → Zuständigkeiten'), 'Q1: Tippen und Ziehen erzeugen identische, vom Server bestätigte Antwort')
ok(await anna.page.locator('.dropzone, [role=radio]').count() === 0, 'Q1: Eingabe nach Abgabe gesperrt (keine Eingabeelemente mehr)')
await shot(anna.page, 'phone-locked'); await shot(screens[0].page, 'screen-q1-answered')
await anna.page.getByText('Richtige Lösung').waitFor({ timeout: 25000 })
ok(await anna.page.getByText('Richtig!').isVisible() && await ben.page.getByText('Richtig!').isVisible(), 'Q1: beide richtig (Punkte nach Auflösung)')
for (const s of screens) await screenLayout(s, 'Q1-Auflösung')
await shot(anna.page, 'phone-reveal'); await shot(screens[0].page, 'screen-reveal')

/* ---------------- 3. Refresh/Reconnect während einer Frage + manueller Durchlauf ---------------- */
await host.getByLabel('Automatikmodus').click(); await host.waitForFunction(() => !document.querySelector('input[type=checkbox]').checked)
let reloaded = false
const specials = {}
const answeredOnce = new Set()

async function onQuestion(n) {
  // Zeit einfrieren, damit lange Interaktionstests nicht ablaufen
  await host.getByRole('button', { name: /Pause/ }).click(); await sleep(500)
  for (const p of phones) await phoneLayout(p, `Q${n}`)
  for (const s of screens) await screenLayout(s, `Q${n}`, { question: true })
  if (n === 2) { await shot(screens[0].page, 'screen-q2-mc'); await shot(w360.page, 'phone-q2-mc') }
  if (n === 3) { await shot(screens[0].page, 'screen-q3-tf'); await shot(w360.page, 'phone-q3-tf') }
  if (n === 4) { await shot(screens[0].page, 'screen-q4-who'); await shot(w360.page, 'phone-q4-who') }
  if (n === 2) await testMc()
  if (n === 3) await testTf()
  if (n === 8) await testOrder()
  if (n === 11) await testMatch()
  if (n === 14 || n === 16) { await shot(screens[0].page, `screen-q${n}`); await shot(w320.page, `phone-q${n}-320`) }
  if (n === 5 && !reloaded) { // Refresh während der Frage
    reloaded = true
    await w430.page.reload(); await w430.page.getByRole('button', { name: /Antwort abgeben/ }).waitFor()
    ok(await w430.page.getByText('W430').first().isVisible(), 'Refresh mitten in der Frage: Identität und Frage bleiben erhalten')
  }
  await host.getByRole('button', { name: /Fortsetzen/ }).click(); await sleep(400)
}

async function testMc() {
  const p = w360.page
  const radios = p.getByRole('radio')
  await radios.nth(0).click(); await radios.nth(2).click()
  await sleep(400)
  ok(await radios.nth(2).getAttribute('aria-checked') === 'true' && await radios.nth(0).getAttribute('aria-checked') === 'false', 'Q2 Quiz-Klassiker: Auswahl vor Abgabe korrigierbar')
  ok(await submitBtn(p).isEnabled() === false, 'Q2: Absenden während Pause gesperrt (Server würde ablehnen)')
  await shot(p, 'phone-q2-selected')
  // Antwortkarten verraten die Lösung nicht per Farbe: alle unselektierten Karten haben identischen Hintergrund
  const bgs = await p.evaluate(() => [...document.querySelectorAll('[role=radio][aria-checked=false]')].map((e) => getComputedStyle(e).backgroundColor))
  ok(new Set(bgs).size === 1, 'Q2: unselektierte Antworten farblich identisch')
}
async function testTf() {
  const p = w360.page
  const radios = p.getByRole('radio')
  ok(await radios.count() === 2 && /Fakt/i.test(await radios.nth(0).innerText()) && /Fake/i.test(await radios.nth(1).innerText()), 'Q3 Fakt/Fake: zwei Flächen mit Beschriftung FAKT und FAKE')
  const bgs = await p.evaluate(() => [...document.querySelectorAll('[role=radio]')].map((e) => getComputedStyle(e).backgroundColor))
  ok(new Set(bgs).size === 1, 'Q3: Fakt und Fake farblich neutral (keine Lösung durch Farbe)')
  await radios.nth(1).click()
  ok(await radios.nth(1).getAttribute('aria-checked') === 'true', 'Q3: Auswahl wird markiert')
}

async function testOrder() {
  const [pa, pb, pc] = [anna.page, ben.page, w390.page]
  ok(await submitBtn(pa).isDisabled(), 'Q8 Ordering: leer nicht absendbar')
  // Zurücksetzen + unvollständig (w390)
  await pool(pc, 'Aufschwung').click(); await pool(pc, 'Boom').click()
  ok((await orderList(pc)).length === 2 && await submitBtn(pc).isDisabled(), 'Q8: unvollständige Reihenfolge (2 von 4) nicht absendbar')
  await pc.getByRole('button', { name: /Reihenfolge zurücksetzen/ }).click()
  ok((await orderList(pc)).length === 0 && await pc.locator('ul[aria-label="Noch nicht eingeordnete Karten"] button').count() === 4, 'Q8: Reset leert die Reihenfolge, alle Karten wieder im Pool')
  // Touch am Griff (sofortiger Zug): Karte 2 auf Platz 1 ziehen
  for (const t of ['Boom', 'Aufschwung', 'Abschwung', 'Tiefstand']) await pool(pc, t).click()
  const g = (pos) => pc.getByRole('button', { name: new RegExp(`verschieben, Platz ${pos} von`) })
  await touchDrag(w390, g(2), await center(g(1)), { hold: 0 })
  ok((await orderList(pc))[0].startsWith('Aufschwung'), 'Q8 Ziehen (Touch am Griff): Karte verschoben')
  await pc.getByRole('button', { name: /Reihenfolge zurücksetzen/ }).click()
  // Anna: Tippen in der richtigen Reihenfolge
  for (const t of ['Aufschwung', 'Boom', 'Abschwung', 'Tiefstand']) await pool(pa, t).click()
  const ta = await orderList(pa)
  ok(ta.join('|') === 'Aufschwung (Expansion)|Boom (Hochkonjunktur)|Abschwung (Rezession)|Tiefstand (Depression)', 'Q8 Tippen: Reihenfolge gesetzt')
  // Ben: bewusst falsch tippen, dann per Ziehen, Tastatur und Pfeil korrigieren
  for (const t of ['Boom', 'Aufschwung', 'Tiefstand', 'Abschwung']) await pool(pb, t).click()
  // Ziehen (Maus): Karte 2 (Aufschwung) auf Platz 1
  await pb.evaluate(() => window.scrollTo(0, 0))
  const grip = (pos) => pb.getByRole('button', { name: new RegExp(`verschieben, Platz ${pos} von`) })
  await grip(2).scrollIntoViewIfNeeded(); await pb.evaluate(() => window.scrollBy(0, -140))
  await mouseDrag(pb, grip(2), await center(grip(1)))
  ok((await orderList(pb))[0].startsWith('Aufschwung'), `Q8 Ziehen (Maus): Karte verschoben (${(await orderList(pb)).map((t) => t.split(' ')[0])})`)
  await shot(pb, 'phone-q8-ordered')
  // Tastatur: Griff Platz 4 (Abschwung) fokussieren, Leertaste, ↑ ↑, Leertaste → Platz 3 -> 2? (Ziel: Boom, Abschwung vertauschen)
  await grip(4).focus(); await pb.keyboard.press('Space'); await sleep(150); await pb.keyboard.press('ArrowUp'); await sleep(250); await pb.keyboard.press('Space'); await sleep(500)
  const afterKbd = (await orderList(pb)).map((t) => t.split(' ')[0])
  ok(afterKbd.join() !== 'Aufschwung,Boom,Tiefstand,Abschwung', `Q8 Tastatur: Karte mit Leertaste/Pfeiltaste bewegt (${afterKbd})`)
  // Escape bricht Ziehen ab
  const before = (await orderList(pb)).join()
  await grip(1).focus(); await pb.keyboard.press('Space'); await sleep(150); await pb.keyboard.press('ArrowDown'); await sleep(150); await pb.keyboard.press('Escape'); await sleep(500)
  ok((await orderList(pb)).join() === before, 'Q8 Tastatur: Escape bricht das Verschieben ab (Reihenfolge unverändert)')
  // Pfeil-Buttons: Tiefstand nach oben (tauscht mit Abschwung) und wieder nach unten
  await pb.getByRole('button', { name: /^Tiefstand.* nach oben/ }).click(); await sleep(150)
  ok((await orderList(pb)).map((t) => t.split(' ')[0]).join() === 'Aufschwung,Boom,Tiefstand,Abschwung', 'Q8 Pfeil ▲: Karte um eine Position nach oben')
  await pb.getByRole('button', { name: /^Tiefstand.* nach unten/ }).click(); await sleep(150)
  const tb = await orderList(pb)
  ok(tb.join('|') === ta.join('|'), `Q8: nach Ziehen, Tastatur und Pfeilen entsteht dieselbe Reihenfolge wie beim Tippen (${tb.map((t) => t.split(' ')[0])})`)
  specials.order = { ta, tb }
  await shot(w320.page, 'phone-q8-320')
}

async function testMatch() {
  const [pa, pb] = [anna.page, ben.page]
  const L = ['Unklare', 'Reihenfolge', 'Berichtslinie'], R = ['Entscheidungszuständigkeit', 'Prozessgestaltung', 'Hierarchie']
  // Ben (390×844): alles per Ziehen + Korrekturen
  await pb.evaluate(() => window.scrollTo(0, 0))
  const fits = async () => (await inView(pb, leftCard(pb, L[0]))) && (await inView(pb, zone(pb, R[2])))
  ok(await fits(), 'Q11 (390×844): Begriffe und Zielfelder gleichzeitig im Blickfeld')
  // ungültiges Ziel: Karte auf die Überschrift "Zielfelder" fallen lassen
  const away = await center(pb.locator('main h1'))
  await mouseDrag(pb, leftCard(pb, L[0]), { x: away.x, y: away.y })
  ok((await matchState(pb)).every((s) => s === 'noch nicht zugeordnet'), 'Q11 ungültiges Drop-Ziel: Zustand unverändert')
  ok(await submitBtn(pb).isDisabled(), 'Q11: nichts zugeordnet → nicht absendbar')
  await mouseDrag(pb, leftCard(pb, L[0]), zone(pb, R[1]))          // erst falsch: Unklare → Prozessgestaltung
  ok((await matchState(pb))[0].includes('Prozessgestaltung'), 'Q11 Ziehen: Zuordnung gesetzt')
  await mouseDrag(pb, leftCard(pb, L[0]), zone(pb, R[0]))          // Karte einem anderen Zielfeld zuordnen
  let st = await matchState(pb)
  ok(st[0].includes('Entscheidungszuständigkeit') && st[1] === 'noch nicht zugeordnet', 'Q11: Zuordnung per Ziehen auf anderes Zielfeld verändert (Zielfeld davor wieder frei)')
  await mouseDrag(pb, leftCard(pb, L[1]), zone(pb, R[0]))          // belegtes Zielfeld: Begriff verdrängt den bisherigen
  st = await matchState(pb)
  ok(st[1].includes('Entscheidungszuständigkeit') && st[0] === 'noch nicht zugeordnet', 'Q11 belegtes Zielfeld: bisheriger Begriff wird frei, kein Doppelbelegen')
  const targets = st.filter((s) => s.startsWith('→'))
  ok(new Set(targets).size === targets.length, 'Q11: kein Zielfeld doppelt vergeben')
  await pb.getByRole('button', { name: /Zuordnung von .* lösen/ }).click()   // einzelne Zuordnung lösen
  ok((await matchState(pb)).every((s) => s === 'noch nicht zugeordnet'), 'Q11: einzelne Zuordnung lösen')
  await mouseDrag(pb, leftCard(pb, L[0]), zone(pb, R[2])); await mouseDrag(pb, leftCard(pb, L[1]), zone(pb, R[1]))
  await pb.getByRole('button', { name: /Alle zurücksetzen/ }).click()
  ok((await matchState(pb)).every((s) => s === 'noch nicht zugeordnet') && await submitBtn(pb).isDisabled(), 'Q11: Alle zurücksetzen')
  // richtig: Unklare→Entscheidung, Reihenfolge→Prozess, Berichtslinie→Hierarchie; zwei Paare per Maus, eines per Touch
  await mouseDrag(pb, leftCard(pb, L[0]), zone(pb, R[0])); await mouseDrag(pb, leftCard(pb, L[1]), zone(pb, R[1]))
  await touchDrag(ben, leftCard(pb, L[2]), zone(pb, R[2]))
  specials.matchBen = await matchState(pb)
  ok(specials.matchBen.every((s) => s.startsWith('→')), 'Q11: Ziehen (Maus + Touch) füllt alle Zielfelder')
  await shot(pb, 'phone-q11-dragged')
  // Anna (375×700): komplette Bedienung per Tippen, inkl. Korrektur und Tausch
  await leftCard(pa, L[0]).click(); await zoneBtn(pa, R[2]).click()   // falsch
  await leftCard(pa, L[0]).click(); await zoneBtn(pa, R[0]).click()   // korrigiert (Begriff 1 erneut gewählt)
  await zoneBtn(pa, R[1]).click()                                      // aktiver Begriff = nächster freier (2)
  await zoneBtn(pa, R[2]).click()
  specials.matchAnna = await matchState(pa)
  ok(JSON.stringify(specials.matchAnna) === JSON.stringify(specials.matchBen), 'Q11: Tippen und Ziehen führen zum selben Zustand/derselben Antwort')
  // 320 px: Zielfelder sichtbar, Tap-Alternative erkennbar
  ok(await w320.page.locator('.dropzone').first().isVisible() && /ablegen oder tippen/.test(await w320.page.locator('.dropzone').first().innerText()), 'Q11 (320 px): Zielfelder sichtbar, Tipp-Alternative beschriftet')
  // Drag/Scroll-Konflikt: normales Scrollen per Touch auf einer Karte darf nichts verändern
  const pe = w320.page
  const y0 = await pe.evaluate(() => scrollY)
  const c = await center(leftCard(pe, L[0]))
  const tt = (type, y) => w320.cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: c.x, y }] })
  await tt('touchStart', c.y)
  for (let i = 1; i <= 10; i++) { await tt('touchMove', c.y - i * 14); await sleep(16) }
  await tt('touchEnd'); await sleep(400)
  ok((await matchState(pe)).every((s) => s === 'noch nicht zugeordnet'), 'Q11: Wischen über eine Karte ordnet nichts zu (Scrollen statt Ziehen)')
  ok(await pe.evaluate(() => scrollY) > y0, 'Q11 (320 px): vertikales Scrollen über Karten bleibt möglich (Wischgeste scrollt die Seite)')
  await shot(w320.page, 'phone-q11-320'); await shot(screens[0].page, 'screen-q11')
  await shot(pa, 'phone-q11-tap')
}

let lastN = 0, phaseGuard = 0
const doneQ = new Set()
while (phaseGuard++ < 200) {
  const lab = await phaseLabel()
  if (/Finale/.test(lab)) break
  const m = lab.match(/Frage (\d+)\/20 läuft/)
  if (m && !doneQ.has(+m[1])) {
    const n = +m[1]; doneQ.add(n); lastN = n
    await sleep(300)
    await onQuestion(n)
    // Sonderfälle mit Abgabe (Zeit läuft wieder, Restzeit ≥ 10 s)
    if (n === 8) {
      await submitBtn(anna.page).click(); await submitBtn(ben.page).click()
      const a8 = await lockedAnswer(anna.page), b8 = await lockedAnswer(ben.page)
      ok(a8 === b8 && a8.startsWith('1. Aufschwung'), `Q8: Tippen und Ziehen/Tastatur/Pfeile erzeugen identische Serverantwort (${a8.replaceAll(' | ', ' / ').slice(0, 60)}…)`)
    }
    if (n === 11) {
      await submitBtn(anna.page).click(); await submitBtn(ben.page).click()
      const a11 = await lockedAnswer(anna.page), b11 = await lockedAnswer(ben.page)
      ok(a11 === b11 && a11.includes('Unklare Genehmigungsberechtigung → Entscheidungszuständigkeit'), 'Q11: identische, bestätigte Serverantwort bei Tippen und Ziehen')
    }
    if (n === 2) { // ehrliche Bestätigung: Antwort wird "verschluckt" → keine Sperransicht, klare Meldung, danach Wiederholung klappt
      dropAnswers = true
      await w320.page.getByRole('radio').nth(1).click(); await submitBtn(w320.page).click()
      ok(await w320.page.getByText(/wird an den Server gesendet/).isVisible(), 'Q2: Sendezustand wird angezeigt')
      await w320.page.getByText(/Noch keine Bestätigung vom Server/).waitFor({ timeout: 8000 })
      ok(!(await w320.page.getByText('Antwort gesperrt').isVisible()), 'Q2: ohne Serverbestätigung wird KEINE Sperransicht/Erfolg vorgetäuscht')
      dropAnswers = false
      await submitBtn(w320.page).click(); await w320.page.getByText('Antwort gesperrt').waitFor({ timeout: 8000 })
      ok(true, 'Q2: erneute Abgabe nach Verbindungsproblem wird vom Server bestätigt')
    }
    if (n === 3) { // Mehrfachabgabe: zweiter Klick auf Absenden nicht möglich (Button deaktiviert/Ansicht gesperrt)
      await w360.page.getByRole('radio').nth(0).click(); await submitBtn(w360.page).click()
      await w360.page.getByText('Antwort gesperrt').waitFor({ timeout: 8000 })
      ok(await submitBtn(w360.page).count() === 0, 'Q3: nach Abgabe kein zweites Absenden möglich')
    }
  }
  // Zwischenranking / Auflösung / Finale-Layouts
  if (/Zwischenranking/.test(lab) && !doneQ.has(`r${lastN}`)) {
    doneQ.add(`r${lastN}`); await sleep(1500)
    for (const s of screens) { await rankingFull(s.page, `Zwischenranking nach Q${lastN} ${s.w}×${s.h}`, 12); await screenLayout(s, `Zwischenranking Q${lastN}`) }
    for (const p of [anna, w320]) await rankingFull(p.page, `Handy-Zwischenstand ${p.w}px`, 12, { scrollable: true })
    await shot(screens[0].page, `screen-ranking-q${lastN}`); await shot(screens[1].page, `screen-ranking-q${lastN}-960`); await shot(anna.page, `phone-ranking-q${lastN}`)
  }
  if (/Auflösung/.test(lab) && !doneQ.has(`a${lastN}`)) {
    doneQ.add(`a${lastN}`); await sleep(900)
    for (const s of screens) await screenLayout(s, `Auflösung Q${lastN}`)
    if ([2, 8, 11].includes(lastN)) { await shot(screens[0].page, `screen-reveal-q${lastN}`); await shot(anna.page, `phone-reveal-q${lastN}`) }
  }
  await step()
}
ok(doneQ.size >= 20, `alle 20 Fragen im Durchlauf gesehen (${[...doneQ].filter((x) => typeof x === 'number').length})`)

/* ---------------- 4. Finale ---------------- */
await sleep(11500)
for (const s of screens) {
  await rankingFull(s.page, `Finale ${s.w}×${s.h}`, 12)
  await screenLayout(s, 'Finale')
  ok(await s.page.locator('section[aria-label="Champion"] h1').isVisible() && await s.page.getByLabel('Siegerpodest').isVisible(), `Finale ${s.w}×${s.h}: Champion-Bereich und Siegerpodest sichtbar`)
}
await shot(screens[0].page, 'screen-final'); await shot(screens[1].page, 'screen-final-960'); await shot(screens[4].page, 'screen-final-1080')
for (const p of phones) await rankingFull(p.page, `Handy-Finale ${p.name} ${p.w}px`, 12, { scrollable: true })
for (const p of phones) ok(await p.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Finale ${p.w}px: kein horizontaler Scroll`)
await shot(anna.page, 'phone-final'); await shot(ben.page, 'phone-final-ben')
const names = await screens[0].page.locator('ol[aria-label="Rangliste"] li .truncate').allInnerTexts()
ok(['Anna', 'Ben', 'W320', 'W360', 'W390', 'W430'].every((n) => names.includes(n)), 'Finale: kein Spieler aus dem Endergebnis ausgeblendet')
await browser.close()
console.log(fails ? `✗ ${fails} Fehler` : '✓ E2E erfolgreich')
process.exit(fails ? 1 : 0)
