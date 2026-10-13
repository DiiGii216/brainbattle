# BRAIN BATTLE – Personalplanung Edition

Live-Multiplayer-Quizshow (20 Fragen, ~11:23 min). Cloudflare Worker + Durable Object (SQLite-Klasse) + React/Vite/Tailwind.

## Befehle
- `npm install` · `npm run dev` (Vite-Build + `wrangler dev` auf :8787, echtes Durable Object lokal)
- `npm test` – Vitest (Spiellogik, Fragenkatalog, Punkte, Ranking)
- `npm run typecheck` · `npm run build` – `dist/client` (nur Frontend-Assets)
- Simulation (12+ Clients, kompletter 20-Fragen-Durchlauf, Pause/Reconnect/Manipulation):
  `npx wrangler dev --port 8788 --var TIME_SCALE:0.05` und dann `BASE=http://localhost:8788 npm run sim`
- Browser-E2E (Chromium, 375 px + 1920×1080): `wrangler dev` (TIME_SCALE=1), `CHROMIUM=/opt/pw-browsers/chromium-*/chrome… npm run e2e`
- Deployment: automatisch per Cloudflare Workers Builds nach Merge in `main` (Einstellungen: DEPLOY.md)

## Architektur
- `src/worker/index.ts`: `POST /api/rooms` (Code + Host-Token), `GET /api/rooms/:code/ws|info` → Durable Object `Room` (`idFromName(code)`). Alles andere liefert Static Assets (SPA-Fallback, `run_worker_first: /api/*`).
- `wrangler.jsonc` nutzt die deklarative `exports`-Registrierung (`Room`, `storage: sqlite`) statt `migrations`.
- `src/worker/room.ts`: server-autoritativer Zustand (`State`, wird nach jeder Mutation in DO-Storage gespeichert), Phasen `LOBBY→INTERMISSION(next)→QUESTION→REVEAL→(INTERMISSION ranking nach Frage 10/15)→…→FINAL`. Fristen sind absolute Serverzeiten (`endsAt`), Weiterschalten per DO-Alarm; `tick()` holt verpasste Fristen nach (Hibernation/Neustart). Pause friert `remainingMs` ein. Host-Befehle tragen `step` → veraltete Klicks sind wirkungslos (idempotent).
- `src/worker/game.ts`: reine Logik (Validierung, Punkte, Ranking). `src/worker/questions.ts`: **geheimer** Fragenkatalog, wird nie vom Client importiert. Antworten/Lösungen gehen erst im REVEAL-Snapshot raus.
- `src/shared/protocol.ts`: Nachrichten-/Snapshot-Typen (einzige geteilte Datei).
- Client: `Landing`, `Player` (/join/:code), `Host` (/host/:code), `Screen` (/screen/:code), `useRoom` (WebSocket + Auto-Reconnect).
- `TIME_SCALE` (Worker-Var, nur Tests; Produktion = 1) skaliert alle Dauern.

## Punkte
Basis: KNOW IT 100, PROVE IT 150 (max. 2.500). MC/Fakt/Rätsel: alles oder nichts. Matching/Ordering: `floor(max × korrekt / gesamt)`, Matching erzwingt 1:1-Zuordnung. Kein Tempo-Bonus, keine Minuspunkte. Tie-Break: mehr komplett richtige Praxisfragen → mehr komplett richtige Fragen → geteilter Rang.

## Fragen bearbeiten
`src/worker/questions.ts` editieren (Erklärung ≤ 25 Wörter, Test `npm test` prüft Struktur, 2500 Punkte und Zeitbudget).
**Quellenabgleich:** Folien 3–24 der PDF wurden gelesen und abgeglichen (Konjunkturphasen Folie 16, Kapitalsammelstelle Folie 12–13, BIP Folie 14–15, Industrie 4.0 Folie 19, Aufbau=Statik/Ablauf=Dynamik Folie 3). Als `extern` markiert (nur Namen auf Folie 24, Definitionen/Beispiele ergänzt): Fragen 10, 19, 20.

## Fortschritt
- [x] Schritt 1: Projekt, Durable Object, Räume, WebSockets, Lobby-Sync
- [x] Schritt 2: Quizmotor, Timer/Alarm, Punkte, Ranking
- [x] Schritt 3: 5 Formate, 20 Fragen, Pause, Zwischenrankings, Finale, Simulation
- [x] Schritt 4: Design, Präsentationsansicht, QR, Reconnect, Wortwolke, Tests
- [x] Quellenabgleich mit der Original-PDF (Folien 3–24)
- [x] Workers-Builds-Konfiguration vorbereitet (siehe DEPLOY.md)
- [ ] Cloudflare-Dashboard: GitHub verbinden, erster Deploy, Live-Test außerhalb des LAN (noch NICHT ausgeführt)
