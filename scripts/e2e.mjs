// Browser-E2E (Playwright + vorinstalliertes Chromium): Host, Präsentationsansicht (16:9) und 2 Handys (375 px).
// Voraussetzung: Worker läuft (wrangler dev, TIME_SCALE=1) und dist/client ist gebaut.
import { chromium } from 'playwright-core'
import fs from 'node:fs'
const BASE = process.env.BASE ?? 'http://localhost:8787'
const out = 'shots'; fs.mkdirSync(out, { recursive: true })
let fails = 0
const ok = (c, m) => { if (!c) { fails++; console.error('✗', m) } else console.log('✓', m) }
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined })
const host = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage()
await host.goto(BASE + '/')
await host.getByRole('button', { name: /Spielraum erstellen/ }).click()
await host.waitForURL(/\/host\/\d{6}/)
const code = host.url().match(/host\/(\d{6})/)[1]
const screen = await (await browser.newContext({ viewport: { width: 1920, height: 1080 } })).newPage()
await screen.goto(`${BASE}/screen/${code}`)
const phones = []
for (const name of ['Anna', 'Ben']) {
  const p = await (await browser.newContext({ viewport: { width: 375, height: 700 }, isMobile: true, hasTouch: true })).newPage()
  await p.goto(`${BASE}/join/${code}`)
  await p.getByLabel('Wie heißt du?').fill(name)
  await p.getByRole('button', { name: /Los geht/ }).click()
  await p.getByText('Du bist drin').waitFor()
  phones.push(p)
}
await phones[0].getByLabel(/Welches Wort/).fill('Planung'); await phones[0].getByRole('button', { name: 'Senden' }).click()
await screen.getByText('Planung').first().waitFor()
await screen.screenshot({ path: `${out}/screen-lobby.png` })
await phones[0].screenshot({ path: `${out}/phone-lobby.png` })
await host.screenshot({ path: `${out}/host-lobby.png` })
ok(await screen.getByText(code).first().isVisible(), 'Screen zeigt Raumcode')
await phones[1].reload()
await phones[1].getByText('Du bist drin').waitFor()
ok(await phones[1].getByText('Ben').first().isVisible(), 'Refresh erhält Spieleridentität')
await host.getByRole('button', { name: /Spiel starten/ }).click()
await phones[0].getByText('Aufbauorganisation').waitFor()
await screen.waitForTimeout(600)
await screen.screenshot({ path: `${out}/screen-q1.png` })
await phones[0].screenshot({ path: `${out}/phone-q1.png` })
const pick = async (p, a, b) => {
  await p.getByRole('button', { name: new RegExp('^' + a) }).click()
  await p.getByRole('button', { name: new RegExp('^' + b) }).click()
}
// Anna (Aufbau → Zuständigkeiten, Ablauf → Arbeitsabläufe) richtig, Ben vertauscht
await pick(phones[0], 'Zuständigkeiten und Hierarchien', 'Arbeitsabläufe und Prozessreihenfolge')
await phones[0].screenshot({ path: `${out}/phone-q1-filled.png` })
await phones[0].getByRole('button', { name: /Antwort abgeben/ }).click()
await phones[0].getByText('Antwort gesperrt').waitFor()
await pick(phones[1], 'Arbeitsabläufe und Prozessreihenfolge', 'Zuständigkeiten und Hierarchien')
await phones[1].getByRole('button', { name: /Antwort abgeben/ }).click()
await phones[0].screenshot({ path: `${out}/phone-locked.png` })
await screen.screenshot({ path: `${out}/screen-q1-answered.png` })
await phones[0].getByText('Richtige Lösung').waitFor({ timeout: 25000 })
ok(await phones[0].getByText('Richtig!').isVisible(), 'Anna: richtig')
ok(await phones[1].getByText('Leider falsch').isVisible(), 'Ben: falsch')
await phones[0].screenshot({ path: `${out}/phone-reveal.png` })
await screen.screenshot({ path: `${out}/screen-reveal.png` })
ok(await phones[0].evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), '375 px: kein horizontaler Scroll')
await browser.close()
console.log(fails ? `✗ ${fails} Fehler` : '✓ E2E erfolgreich')
process.exit(fails ? 1 : 0)
