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

## Parancsok

- Helyi teszt: `npx wrangler pages dev .`
- Telepítés: `git push origin main` → Cloudflare Pages automatikusan újratelepít

## Fontos tények

- GitHub repo: `Szolke/matek_gyakorlo`
- Élő cím: `matek-gyakorlo.pages.dev`
- KV namespace: `matek-gyakorlo-progress`, binding neve `PROGRESS_KV` (Production és Preview környezethez külön kötve a Cloudflare dashboardon)

## Mindig így

- A felület szövege magyar, gyerekbarát, játékos hangnem
- A meglévő kinézetet (állatkert téma, színek, animációk) és a játékmenetet ne törd el
- Ne vezess be build lépést, keretrendszert vagy felesleges függőséget
