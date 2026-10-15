# BRAIN BATTLE – Personalplanung Edition

Live-Multiplayer-Quizshow (20 Fragen, ~11:23 min). Cloudflare Worker + Durable Object (SQLite-Klasse) + React/Vite/Tailwind.

## Befehle
- `npm install` · `npm run dev` (Vite-Build + `wrangler dev` auf :8787, echtes Durable Object lokal)
- `npm test` – Vitest (Spiellogik, Fragenkatalog, Punkte, Ranking, Eingabelogik, Token-Kontraste)
- `npm run typecheck` · `npm run build` – `dist/client` (nur Frontend-Assets)
- Simulation (12+ Clients, kompletter 20-Fragen-Durchlauf, Pause/Reconnect/Manipulation):
  `npx wrangler dev --port 8788 --var TIME_SCALE:0.05` und dann `BASE=http://localhost:8788 npm run sim`
- Browser-E2E (Chromium; 6 Handys 320–430 px, 5 Präsentationsgrößen 960×540 … 1920×1080, 6 Bots = 12 Teilnehmende, alle 20 Fragen, Drag per Maus/Touch/Tastatur; dauert ca. 3 Min.): `npm run build`, `npx wrangler dev` (TIME_SCALE=1), `CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome npm run e2e` (Screenshots in `shots/`)
- Deployment: automatisch per Cloudflare Workers Builds nach Merge in `main` (Einstellungen: DEPLOY.md)

## Architektur
- `src/worker/index.ts`: `POST /api/rooms` (Code + Host-Token), `GET /api/rooms/:code/ws|info` → Durable Object `Room` (`idFromName(code)`). Alles andere liefert Static Assets (SPA-Fallback, `run_worker_first: /api/*`).
- `wrangler.jsonc` nutzt die deklarative `exports`-Registrierung (`Room`, `storage: sqlite`) statt `migrations`.
- `src/worker/room.ts`: server-autoritativer Zustand (`State`, wird nach jeder Mutation in DO-Storage gespeichert), Phasen `LOBBY→INTERMISSION(next)→QUESTION→REVEAL→(INTERMISSION ranking nach Frage 10/15)→…→FINAL`. Fristen sind absolute Serverzeiten (`endsAt`), Weiterschalten per DO-Alarm; `tick()` holt verpasste Fristen nach (Hibernation/Neustart). Pause friert `remainingMs` ein. Host-Befehle tragen `step` → veraltete Klicks sind wirkungslos (idempotent).
- `src/worker/game.ts`: reine Logik (Validierung, Punkte, Ranking). `src/worker/questions.ts`: **geheimer** Fragenkatalog, wird nie vom Client importiert. Antworten/Lösungen gehen erst im REVEAL-Snapshot raus.
- `src/shared/protocol.ts`: Nachrichten-/Snapshot-Typen (einzige geteilte Datei).
- Client: `Landing`, `Player` (/join/:code), `Host` (/host/:code), `Screen` (/screen/:code), `useRoom` (WebSocket + Auto-Reconnect; `send` liefert `false`, wenn nichts gesendet wurde).
- Eingaben (Handy): `Inputs.tsx` (Quiz/Fakt-Fake/Rätsel + Absenden-Leiste), `DragInputs.tsx` (Matchmaker + Ordering mit **@dnd-kit/react 0.5**), `inputLogic.ts` (reine Funktionen `placeMatch`/`moveSeq`/…). Tippen, Ziehen und Tastatur verändern denselben React-State und erzeugen dasselbe Antwortformat (Matching: Index je linkem Begriff; Ordering: Elementindizes in Reihenfolge). Server unverändert.
  - Matchmaker: Begriffskarten (draggable, `l{i}`) werden auf Zielfelder (droppable, `r{k}`) gezogen *oder* erst Begriff, dann Zielfeld getippt. Belegtes Zielfeld → bisheriger Begriff wird frei (bzw. Tausch); nie doppelt. Lösen je Zuordnung (✕) und „Alle zurücksetzen“.
  - Ordering: eingeordnete Karten sind sortierbar (Griff ziehen, Tastatur: Griff fokussieren → Leertaste → Pfeile → Leertaste, Esc = Abbruch) oder per ▲▼; nicht eingeordnete Karten werden angetippt. Absenden erst bei vollständiger Reihenfolge.
  - Touch: Karte erst nach 220 ms Halten aufnehmbar (Scrollen bleibt), am Griff sofort (`touch-action: none` nur dort). Konfiguration: `pointerSensor` in `DragInputs.tsx`.
  - „Abgegeben“ ist erst, wenn der Server-Snapshot `you.answered` meldet; bis dahin „Wird gesendet …“, nach 5 s ohne Bestätigung Fehlermeldung und erneutes Absenden möglich.
- `TIME_SCALE` (Worker-Var, nur Tests; Produktion = 1) skaliert alle Dauern.

## Design (Broadcast Gold)
Tokens zentral in `src/client/index.css` (`@theme`): `bg panel surface deep ink mute gold gold-light violet violet-soft ok bad line line-strong`. Gold = Auswahl/Akzent (nie fachliche Richtigkeit), `ok`/`bad` nur für Ergebnisse nach der Auflösung. Komponentenklassen (`.choice`, `.dropzone`, `.btn-gold`, `.field` …) liegen in `@layer components`, damit Tailwind-Utilities sie überschreiben können. Kontrast der Token-Paare wird in `tests/ui.test.ts` geprüft.
Präsentationsansicht: keine globale `html`-Schriftgröße mehr; Größen über begrenzte Klassen `.s-question/.s-answer/.s-info/.s-title` (clamp mit vw/vh). Rangliste (`RankList`) nimmt eine CSS-Zeilenhöhe (`rowH`), zeigt immer **alle** Teilnehmenden und hebt Aufstiege ≥ 2 Plätze kurz hervor.

## Punkte
Basis: KNOW IT 100, PROVE IT 150 (max. 2.500). MC/Fakt/Rätsel: alles oder nichts. Matching/Ordering: `floor(max × korrekt / gesamt)`, Matching erzwingt 1:1-Zuordnung. Kein Tempo-Bonus, keine Minuspunkte. Tie-Break: mehr komplett richtige Praxisfragen → mehr komplett richtige Fragen → geteilter Rang.

## Fragen bearbeiten
`src/worker/questions.ts` editieren (Erklärung ≤ 25 Wörter, Test `npm test` prüft Struktur, 2500 Punkte und Zeitbudget).
**Katalog V3 (Schwerpunkt Personalfachwirt):** 20 Fragen neu eingespielt (Schwierigkeit 1–10 je Frage, Q13/Q16 mit 32 s). Format-Verteilung, Punkte und Zeitbudget unverändert. Der frühere Folienabgleich (`source: 'folien'/'extern'`) gilt für V3 nicht mehr und ist offen.

## Fortschritt
- [x] Schritt 1: Projekt, Durable Object, Räume, WebSockets, Lobby-Sync
- [x] Schritt 2: Quizmotor, Timer/Alarm, Punkte, Ranking
- [x] Schritt 3: 5 Formate, 20 Fragen, Pause, Zwischenrankings, Finale, Simulation
- [x] Schritt 4: Design, Präsentationsansicht, QR, Reconnect, Wortwolke, Tests
- [x] Quellenabgleich mit der Original-PDF (Folien 3–24)
- [x] Workers-Builds-Konfiguration vorbereitet (siehe DEPLOY.md)
- [x] Upgrade Branch `feature/interactive-games-broadcast-gold`: dnd-kit (Matchmaker + Ordering), Broadcast-Gold-Theme, Mobile-/Präsentationslayout, Rangliste für 12+, Finale (nicht auf echten Smartphones getestet)
- [ ] Cloudflare-Dashboard: GitHub verbinden, erster Deploy, Live-Test außerhalb des LAN (noch NICHT ausgeführt)
