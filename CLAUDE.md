# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Mi ez

Magyar nyelvű, gyerekeknek szóló matek-gyakorló app (3. osztály, 100-as számkör, szorzótábla). Statikus webapp, Cloudflare Pages-en, GitHubról auto-deployolva.

## Tech

Sima HTML/CSS/JS, nincs keretrendszer, nincs build lépés, nincs npm/package.json. A backend Cloudflare Pages Functions + Workers KV.

## Fájlok

- `index.html` — a teljes app (stílus + játéklogika egy fájlban)
- `manifest.json`, `icon-180.png`, `icon-512.png` — PWA/kezdőképernyő ikon
- `functions/api/progress.js` — Pages Function: GET/POST `/api/progress?profile=NÉV`, olvasás/írás a `PROGRESS_KV`-ból
- `wrangler.toml` — KV namespace binding config (`PROGRESS_KV`); a Cloudflare Pages build ezt is beolvassa, a namespace ID-nak érvényes hex ID-nak kell lennie, placeholder nem működik
- `_headers` — Cloudflare Pages cache-szabályok: `/`, `/index.html`, `/manifest.json` = `no-cache, must-revalidate` (mindig friss deploy látszódjon, pl. iPados kezdőképernyős PWA-nál is), az ikonokra hosszú cache. Nem vonatkozik a `/api/*` Functions-válaszokra.

## Parancsok

- Helyi teszt: `npx wrangler pages dev .`
- Telepítés: `git push origin main` → Cloudflare Pages automatikusan újratelepít

## Fontos tények

- GitHub repo: `Szolke/matek_gyakorlo`
- Élő cím: `matek-gyakorlo.pages.dev`
- KV namespace: `matek-gyakorlo-progress`, binding neve `PROGRESS_KV` (Production és Preview környezethez külön kötve a Cloudflare dashboardon)

## Adatmodell (state, profilonként a KV-ban)

- `stats`: kategóriánkénti `{correct,attempts}` — `add_nocarry`/`add_carry`, `sub_nocarry`/`sub_carry`, `mul2..mul10`, `div2..div10`. Súlyozott feladatválasztás ebből: `weight = 1 + 3*(1-pontosság)`, 3 próbálkozás alatt 0,5 (semleges) pontosságot feltételezünk.
- `tablePref.{mul,div}`: `'all'` vagy `'2'..'10'` — a menü szorzótábla-választója.
- `daily`: `{date,correctToday,streak,goalMetToday}` — napi cél 10 helyes válasz, a naptári nap mindig a HELYI időzóna szerint (nem UTC!).
- `dailyHistory`: `{'YYYY-MM-DD': szám}`, max 14 napra metszve — a szülői nézet 7 napos grafikonjához.
- Szülői nézet kapukódja: "Mennyi 7×8?" → 56 (`checkParentGate()` az index.html-ben).
- Új mezők betöltésekor mindig legyen alapérték régi mentésekhez (lásd `mergeStats`, `load()`).
- `puzzlesSolved` (szám), `puzzlePref.difficulty` (`'easy'|'medium'|'hard'`) — Matek-kirakó mód.

## Matek-kirakó (matek-keresztrejtvény mód)

3x3 számrács (5x5 megjelenítő rács fix +/− és = jelekkel): minden SOR ugyanazt a műveletet használja, minden OSZLOP egy másikat (`a opRow b = c`, ..., `a opCol d = g`, ...). Ha `opRow`/`opCol` csak `+`/`−`, a rács **algebrailag mindig konzisztens** bármilyen kezdőszámból — ezért a generálás (`generatePuzzle()` az index.html-ben) egyszerű elutasításos mintavétel, nincs visszalépéses keresés. A × **szándékosan nincs** ebben a rácsban (a garancia rá nem áll, lásd kód-kommentár `tryBuildSolvedGrid()` fölött) — a nehézséget az üres cellák száma (3/5/7), számnagyság és elterelő számok adják (`PUZZLE_LEVELS`). Ha ezt a döntést felül akarod írni, előbb olvasd el a kód-kommentárt.

## Mindig így

- A felület szövege magyar, gyerekbarát, játékos hangnem
- A meglévő kinézetet (állatkert téma, színek, animációk) és a játékmenetet ne törd el
- Ne vezess be build lépést, keretrendszert vagy felesleges függőséget
