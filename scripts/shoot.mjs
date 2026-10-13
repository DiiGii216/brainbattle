// Hilfsskript: macht Screenshots der Präsentationsansicht an Schlüsselmomenten einer laufenden Simulation.
import { chromium } from 'playwright-core'
const [, , base, code] = process.argv
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined })
const p = await (await b.newContext({ viewport: { width: 1920, height: 1080 } })).newPage()
await p.goto(`${base}/screen/${code}`)
const want = { zwischenstand: 'screen-ranking', 'auflösung': 'screen-reveal2', 'champion:': 'screen-final' }
const done = new Set()
for (let i = 0; i < 900 && done.size < 3; i++) {
  const t = (await p.locator('body').innerText()).toLowerCase()
  for (const [k, f] of Object.entries(want)) if (t.includes(k) && !done.has(k)) { await p.waitForTimeout(k === 'champion:' ? 4500 : 1200); await p.screenshot({ path: `shots/${f}.png` }); done.add(k) }
  await p.waitForTimeout(200)
}
await b.close()
