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
- `sortsSolved` (szám), `sortPref.table` (`'1'..'10'`), `sortStats` (`{1..10: {correct,attempts}}`) — Hernyó-sorakozó mód, lásd lent, **teljesen külön** a fenti `stats`-tól.
- `trainsSolved` (szám) — Vonatos szorzótábla mód, lásd lent. Nincs `trainPref`: a táblát minden induláskor egy külön választóképernyőn kell megadni, nincs mit perzisztálni.

## Matek-kirakó (matek-keresztrejtvény mód)

**v2 (jelenlegi):** szabálytalan, elágazó egyenlet-fa. Sok kis háromtagú egyenlet (`a op b = c`, `+/−/×/÷`) kapcsolódik közös cellákon, vízszintes/függőleges "karokkal" (`buildEquationTree()` az index.html-ben). A szerkezet mindig **körmentes (fa)**: minden új egyenlet pontosan EGY meglévő cellán csatlakozik, a másik két cellája szabad — ezért a feltöltés tisztán konstruktív (a közös cella értéke már ismert, csak a másik két számot/a műveletet kell megválasztani, lásd `tryConstructEquation()`), nincs globális visszalépés, csak egy mindig működő +/− tartalék (`tryAttachUniversalFallback()`). Emiatt fér bele a × és ÷ is — a v1-es szabályos 3×3 rácsnál (lásd lentebb) ez nem ment volna megbízhatóan. `PUZZLE_LEVELS.maxSpan` egy "puha" méretkorlát (9/11/13 cella), hogy a forma jellemzően kompakt maradjon iPadon; ritka, nagyon elágazó esetben a rács vízszintesen görgethető.

**v1 (lecserélve, csak történeti jegyzetként):** szabályos 3×3 rács volt, ahol minden SOR egy közös műveletet, minden OSZLOP egy másikat használt. Ott a × azért nem fért bele: a "sarok" cellának két irányból (sor és oszlop felől is) pontosan ugyanazt kellett volna adnia, ami ×-nél csak elvétve jött volna ki a 100-as korláton belül. Ha valaha vissza kellene állítani, ez a korlátozás ugyanúgy fennáll.

## Hernyó-sorakozó (szorzótábla sorbarakó mód)

A gyerek kiválaszt egy szorzótáblát (1–10), megkapja a tábla 10 szorzatát (`table*1..table*10`) összekeverve, és KOPPINTÁSSAL, növekvő sorrendben kell kijelölnie őket (mindig a soron következő legkisebb hátralévő számra kell koppintani — nincs drag & drop, mert az iPad mini-n megbízhatóbb). `buildSortPuzzle()`/`onTapSortChip()` az index.html-ben. Legfeljebb 4 hiba engedélyezett (`sortState.mistakes`, jelezve 4 db 🐾 ikonnal); az 5. hibánál a feladat újraindul (`setTimeout`-tal új keverés ugyanazzal a táblával, hibaszámláló nullázódik) — pont csakis a hiba nélküli vagy legfeljebb 4 hibás teljesítésért jár (`sortWin()`, fix `SORT_REWARD`). Mivel egy tábla mind a 10 szorzata (1-10-szeres) különböző, nincs szükség duplikátum-kezelésre az egyeztetésnél. Jelvények: 🐛 (1. megoldás), 🦋 (10. megoldás) — a hernyó-pillangó pár szándékosan utal az átalakulásra.

**Statisztika — szándékosan KÜLÖN a súlyozott feladatválasztástól.** A sorbarakás a növekvő sorrend felismerését méri, NEM a szorzat felidézését — ezért a koppintások a `state.sortStats` (`{1..10: {correct,attempts}}`, `logSortAttempt()`) mezőbe íródnak, és **soha nem** érintik a `state.stats.mulN` kategóriákat vagy a `categoryWeight()`/`weightedPick()` súlyozást. Ha ez bekeveredne, a helyes koppintások mesterségesen feljebb vinnék az adott tábla accuracy-jét → lejjebb a súlyát (`weight = 1 + 3*(1-accuracy)`) → a fő gyakorlóban RITKÁBBAN jönne elő pont az a tábla, amit a gyerek esetleg fejből nem tud, csak sorba rakni. A `sortStats` a szülői nézetben KÜLÖN kártyaként ("🐛 Hernyó-sorakozó") jelenik meg, táblánkénti pontossággal, hogy ne keveredjen a "Műveletenkénti pontosság"/"Legtöbb gyakorlást igénylő területek" felidézés-alapú mutatóival. Az 1-es táblának (ami a fő szorzás-gyakorlóban nem létezik, mert ott `b=rnd(2,10)`) itt MÉGIS van saját `sortStats[1]` bucketje, mert ez a nyomkövetés független attól, mely táblák léteznek a felidézés oldalon.

**Napi cél — 1 kör = 1 feladat.** Egy teljesített sorbarakó kör 10 számot fed le, de a `daily.correctToday` számlálót csak **+1**-gyel növeli (`sortWin()`), nem +10-zel. Ez tudatos döntés: a napi cél a hagyományos módokban is "1 esemény = 1 egység" elven számol (egy helyes válasz = +1), és egy sorbarakó kör — bármennyi számot is tartalmaz — egyetlen, egységes gyakorlási eseménynek számít, nem tíz különálló feladatnak. Ellenkező esetben egyetlen sorbarakó kör önmagában kiütné a napi 10-es célt, ami aránytalanul felértékelné ezt a módot a többihez (pl. Matek-kirakó, ami egyáltalán NEM érinti a napi célt) képest.

## Vonatos szorzótábla mód

A gyerek egy külön táblaválasztó képernyőn (`trainSelectScreen`, `goTrainSelect()`/`renderTrainSelect()`) kiválaszt egy szorzótáblát (1–10), majd egy mozdony + 10 üres vagon jelenik meg (`trainScreen`). A vagonokba FEJBŐL, sorban kell beírni a tábla szorzatait (N×1, N×2, … N×10) a meglévő numerikus billentyűzet-UI-val (`trainPress()`/`trainDel()`/`trainSubmit()` — a `press()`/`del()`/`check()` főgyakorló-függvényektől függetlenek, hogy ne zavarják egymást). A szorzás sosem látszik, csak a vagon pozíciója; az aktív vagon kiemelve, és automatikusan látótérbe görgetve (`scrollIntoView`) a vízszintesen görgethető sínen. 5 élet van (`TRAIN_LIVES`); minden hibás beírás −1 élet, a vagon nem lép tovább. A 0. életnél (5. hiba) a tábla ELÖLRŐL indul ugyanazzal a táblával (`buildTrainPuzzle()`, `setTimeout`-tal, barátságos "kisiklás" szöveggel, NEM büntető hangvétellel). Csak a teljes, 5 életből legalább 1-gyel befejezett kör ér pontot (`trainWin()`, fix `TRAIN_REWARD`), ekkor a sín "beér az állomásra" animációval (`.train-track.arrived`) jelzi a sikert. Jelvények: 🚂 Mozdonyvezető (1. megoldás), 🚉 Vasútmester (10. megoldás).

**Statisztika — szándékosan NEM írja a `state.stats.mulN` kategóriákat.** Ugyanaz az indoklás, mint a Hernyó-sorakozónál: a vagonok SORBAN, fejből történő feltöltése részben az összeadásos felépítést (N, N+N, N+N+N, …) is gyakoroltatja, ami eltér a fő gyakorló véletlen-sorrendű, egyetlen szorzatot kérő felidézésétől — torzítaná a súlyozott feladatválasztást (`categoryWeight()`/`weightedPick()`) és a szülői nézet felidézés-alapú pontosságát. A mód csak a pont-/jelvényrendszerbe és a napi célba illeszkedik, KÜLÖN per-tábla statisztikát (a Hernyó-sorakozó `sortStats`-jához hasonlót) szándékosan NEM kapott — alacsony prioritású, nem triviális haszonnal járt volna, ezért a `sortStats`-mintát itt nem másoltuk le feleslegesen.

**Napi cél — 1 kör = 1 feladat.** A Hernyó-sorakozóval konzisztensen: egy teljesített vonat-kör (mind a 10 vagon kitöltve) a `daily.correctToday` számlálót csak **+1**-gyel növeli, nem +10-zel — lásd a Hernyó-sorakozó szakasz "Napi cél" indoklását, ugyanaz vonatkozik ide is.

## Mindig így

- A felület szövege magyar, gyerekbarát, játékos hangnem
- A meglévő kinézetet (állatkert téma, színek, animációk) és a játékmenetet ne törd el
- Ne vezess be build lépést, keretrendszert vagy felesleges függőséget
