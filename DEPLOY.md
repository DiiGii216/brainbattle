# Deployment über Cloudflare Workers Builds (GitHub → Cloudflare)

Kein lokaler Rechner und kein `wrangler login` nötig. Einmalig im Cloudflare-Dashboard:

1. **Workers & Pages → Create → Import a repository** (bzw. *Workers → Create application → Connect to Git*), GitHub verbinden und das Repository `diigii216/brainbattle` auswählen.
2. Einstellungen:
   | Feld | Wert |
   |---|---|
   | Project / Worker name | `brainbattle` (muss dem `name` in `wrangler.jsonc` entsprechen) |
   | Production branch | `main` |
   | Root directory | `/` |
   | Build command | `npm run build` |
   | Deploy command | `npx wrangler deploy` |
   | Non-production branch deploy command | `npx wrangler versions upload` (optional) |
   | Build-Variable (optional) | `NODE_VERSION=22` |
3. **Save and Deploy.** Danach deployt jeder Merge in `main` automatisch. Die Durable-Object-Klasse `Room` (SQLite) und die Static Assets (`dist/client`) kommen komplett aus `wrangler.jsonc` – keine weiteren Bindings/Secrets nötig. Läuft auf dem Workers-Free-Tarif.
4. Die URL steht danach unter **Workers → brainbattle → Settings → Domains & Routes** (`https://brainbattle.<dein-subdomain>.workers.dev`).

## Live-Smoke-Test (nach dem ersten Deploy)
```
BASE=https://brainbattle.<subdomain>.workers.dev npx vite-node scripts/sim.ts   # braucht TIME_SCALE=1 → ~11,5 min; für einen Kurztest die Lobby/Beitritt manuell prüfen
```
Manuell: `/` öffnen → „Neuen Spielraum erstellen“ → Präsentationsansicht öffnen → mit dem Handy QR scannen → Spiel starten.
Deep Links `/join/:code`, `/host/:code`, `/screen/:code` werden per SPA-Fallback der Static Assets ausgeliefert.

## Hinweise
- `TIME_SCALE` in `wrangler.jsonc` bleibt `"1"` (nur für Tests verändern).
- Es werden nur Build-Ausgaben (`dist/client`) als Assets veröffentlicht – keine PDF, keine Rohdateien.
