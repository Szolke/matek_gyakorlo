// Állatkert-építő — tiszta, DOM-mentes rács-logika.
// Böngészőben <script src="garden-logic.js"> révén window.GardenLogic-ként,
// Node-ban require('./garden-logic.js')-ként egyaránt használható (lásd
// garden-selftest.js és CLAUDE.md "Állatkert-építő" szakaszát).
(function(){
'use strict';

const GARDEN_COLS = 10;
const GARDEN_ROWS = 8;
const GARDEN_ENTRANCE = { r: GARDEN_ROWS - 1, c: 4 };
const GARDEN_COSTS = { path: 4, enclosure: 36, decor: 6 };
const GARDEN_REFUND_RATE = 0.5;
const NEI = [[-1,0],[1,0],[0,-1],[0,1]];

function keyOf(r, c){ return r + ',' + c; }
function inBounds(r, c){ return r >= 0 && r < GARDEN_ROWS && c >= 0 && c < GARDEN_COLS; }
function isEntrance(r, c){ return r === GARDEN_ENTRANCE.r && c === GARDEN_ENTRANCE.c; }

function createEmptyGarden(){
  return {
    version: 1,
    entrance: { r: GARDEN_ENTRANCE.r, c: GARDEN_ENTRANCE.c },
    path: [],
    enclosures: [],
    decor: []
  };
}

// key -> {type:'entrance'|'path'|'enclosure'|'decor', enclosure?, decor?}
function occupancyMap(garden){
  const map = new Map();
  map.set(keyOf(garden.entrance.r, garden.entrance.c), { type:'entrance' });
  for(const k of garden.path) map.set(k, { type:'path' });
  for(const e of garden.enclosures){
    for(let dr=0; dr<2; dr++){
      for(let dc=0; dc<2; dc++){
        map.set(keyOf(e.r+dr, e.c+dc), { type:'enclosure', enclosure:e });
      }
    }
  }
  for(const d of garden.decor) map.set(keyOf(d.r, d.c), { type:'decor', decor:d });
  return map;
}

function isFreeGrass(garden, r, c, occ){
  if(!inBounds(r,c)) return false;
  occ = occ || occupancyMap(garden);
  return !occ.has(keyOf(r,c));
}

// Bejárattól indított bejárás (flood-fill) a bejárat + úthálózat cellákon —
// visszaadja az elérhető cellák kulcsainak halmazát (a bejárat kulcsával
// együtt). Ugyanaz a gráf-elv, mint a Matek-kirakónál, itt validálásra.
function computeConnectedPathSet(garden){
  const pset = new Set(garden.path);
  const startKey = keyOf(garden.entrance.r, garden.entrance.c);
  const visited = new Set([startKey]);
  const queue = [[garden.entrance.r, garden.entrance.c]];
  while(queue.length){
    const [cr, cc] = queue.shift();
    for(const [dr,dc] of NEI){
      const nr = cr+dr, nc = cc+dc;
      if(!inBounds(nr,nc)) continue;
      const k = keyOf(nr,nc);
      if(visited.has(k)) continue;
      if(pset.has(k)){ visited.add(k); queue.push([nr,nc]); }
    }
  }
  return visited;
}

function canPlacePathAt(garden, r, c){
  if(!inBounds(r,c)) return false;
  const occ = occupancyMap(garden);
  if(occ.has(keyOf(r,c))) return false;
  const connected = computeConnectedPathSet(garden);
  for(const [dr,dc] of NEI){
    const nr = r+dr, nc = c+dc;
    if(!inBounds(nr,nc)) continue;
    if(connected.has(keyOf(nr,nc))) return true;
  }
  return false;
}

function placePath(garden, coins, r, c){
  if(coins < GARDEN_COSTS.path) return { ok:false, reason:'funds' };
  if(!canPlacePathAt(garden, r, c)) return { ok:false, reason:'invalid' };
  garden.path.push(keyOf(r,c));
  return { ok:true, coins: coins - GARDEN_COSTS.path };
}

function enclosureBlockCells(e){
  return [[e.r,e.c],[e.r,e.c+1],[e.r+1,e.c],[e.r+1,e.c+1]];
}
function enclosureNeighborCells(e){
  const cells = enclosureBlockCells(e);
  const blockSet = new Set(cells.map(p=>keyOf(p[0],p[1])));
  const seen = new Set();
  const result = [];
  for(const [pr,pc] of cells){
    for(const [dr,dc] of NEI){
      const nr = pr+dr, nc = pc+dc;
      const k = keyOf(nr,nc);
      if(blockSet.has(k) || seen.has(k)) continue;
      seen.add(k);
      result.push([nr,nc]);
    }
  }
  return result;
}
function enclosureHasConnectedNeighbor(e, connectedSet){
  for(const [nr,nc] of enclosureNeighborCells(e)){
    if(!inBounds(nr,nc)) continue;
    if(connectedSet.has(keyOf(nr,nc))) return true;
  }
  return false;
}

// r,c: a kifutó bal-felső cellája. connectedSet/occ opcionális, ha a hívó
// már kiszámolta (elkerülve az ismételt BFS-t egy előnézet-pásztázásnál).
function canPlaceEnclosureAt(garden, r, c, occ, connectedSet){
  if(r<0 || c<0 || r+1>=GARDEN_ROWS || c+1>=GARDEN_COLS) return false;
  occ = occ || occupancyMap(garden);
  for(const [pr,pc] of enclosureBlockCells({r,c})){
    if(occ.has(keyOf(pr,pc))) return false;
  }
  const connected = connectedSet || computeConnectedPathSet(garden);
  return enclosureHasConnectedNeighbor({r,c}, connected);
}

// Megkeresi a koppintott (tr,tc) cellához legközelebbi ÉRVÉNYES 2×2-es
// kifutó-pozíciót, hogy a gyereknek ne kelljen a bal-felső sarkot eltalálnia.
function findBestEnclosurePlacement(garden, tr, tc){
  const occ = occupancyMap(garden);
  const connected = computeConnectedPathSet(garden);
  let best = null, bestDist = Infinity;
  for(let r=0; r<=GARDEN_ROWS-2; r++){
    for(let c=0; c<=GARDEN_COLS-2; c++){
      if(!canPlaceEnclosureAt(garden, r, c, occ, connected)) continue;
      const dist = Math.abs((r+0.5)-(tr+0.5)) + Math.abs((c+0.5)-(tc+0.5));
      if(dist < bestDist){ bestDist = dist; best = {r,c}; }
    }
  }
  return best;
}

function placeEnclosure(garden, coins, tr, tc, animal){
  if(coins < GARDEN_COSTS.enclosure) return { ok:false, reason:'funds' };
  const pos = findBestEnclosurePlacement(garden, tr, tc);
  if(!pos) return { ok:false, reason:'nospace' };
  garden.enclosures.push({ r:pos.r, c:pos.c, animal });
  return { ok:true, coins: coins - GARDEN_COSTS.enclosure, r:pos.r, c:pos.c };
}

function removeEnclosureAt(garden, coins, r, c){
  const idx = garden.enclosures.findIndex(e => r>=e.r && r<=e.r+1 && c>=e.c && c<=e.c+1);
  if(idx === -1) return { ok:false, reason:'notfound' };
  garden.enclosures.splice(idx,1);
  return { ok:true, coins: coins + Math.floor(GARDEN_COSTS.enclosure * GARDEN_REFUND_RATE) };
}

// Csak akkor engedi lebontani az adott (r,c) út-cellát, ha ez nem szakítja
// meg a MARADÉK út és a kifutók bejárattal való összefüggését — a gyerek
// így sosem tud véletlenül "elvágni" egy másik, már megépített részt.
function canRemovePathAt(garden, r, c){
  const k = keyOf(r,c);
  if(!garden.path.includes(k)) return false;
  const clone = { entrance:garden.entrance, path:garden.path.filter(x=>x!==k) };
  const connected = computeConnectedPathSet(clone);
  if(clone.path.some(pk => !connected.has(pk))) return false;
  for(const e of garden.enclosures){
    if(!enclosureHasConnectedNeighbor(e, connected)) return false;
  }
  return true;
}

function removePathAt(garden, coins, r, c){
  if(!canRemovePathAt(garden, r, c)) return { ok:false, reason:'blocked' };
  const k = keyOf(r,c);
  garden.path = garden.path.filter(x=>x!==k);
  return { ok:true, coins: coins + Math.floor(GARDEN_COSTS.path * GARDEN_REFUND_RATE) };
}

function canPlaceDecorAt(garden, r, c, occ){
  if(!inBounds(r,c)) return false;
  occ = occ || occupancyMap(garden);
  return !occ.has(keyOf(r,c));
}

function placeDecor(garden, coins, r, c, type){
  if(coins < GARDEN_COSTS.decor) return { ok:false, reason:'funds' };
  if(!canPlaceDecorAt(garden, r, c)) return { ok:false, reason:'invalid' };
  garden.decor.push({ r, c, type });
  return { ok:true, coins: coins - GARDEN_COSTS.decor };
}

function removeDecorAt(garden, coins, r, c){
  const idx = garden.decor.findIndex(d => d.r===r && d.c===c);
  if(idx === -1) return { ok:false, reason:'notfound' };
  garden.decor.splice(idx,1);
  return { ok:true, coins: coins + Math.floor(GARDEN_COSTS.decor * GARDEN_REFUND_RATE) };
}

// ---- Előnézet-halmazok (build-mód szaggatott kereteihez) ----
function getPathPreviewSet(garden){
  const occ = occupancyMap(garden);
  const connected = computeConnectedPathSet(garden);
  const result = new Set();
  for(const k of connected){
    const [r,c] = k.split(',').map(Number);
    for(const [dr,dc] of NEI){
      const nr=r+dr, nc=c+dc;
      if(!inBounds(nr,nc)) continue;
      const nk = keyOf(nr,nc);
      if(!occ.has(nk)) result.add(nk);
    }
  }
  return result;
}
function getEnclosurePreviewSet(garden){
  const occ = occupancyMap(garden);
  const connected = computeConnectedPathSet(garden);
  const result = new Set();
  for(let r=0; r<=GARDEN_ROWS-2; r++){
    for(let c=0; c<=GARDEN_COLS-2; c++){
      if(canPlaceEnclosureAt(garden, r, c, occ, connected)) result.add(keyOf(r,c));
    }
  }
  return result;
}
function getDecorPreviewSet(garden){
  const occ = occupancyMap(garden);
  const result = new Set();
  for(let r=0; r<GARDEN_ROWS; r++){
    for(let c=0; c<GARDEN_COLS; c++){
      const k = keyOf(r,c);
      if(!occ.has(k)) result.add(k);
    }
  }
  return result;
}

function serializeGarden(garden){ return JSON.stringify(garden); }

// Migrációbiztos: eldobja az érvénytelen/átfedő/be nem érkező bejegyzéseket,
// és sosem dobál hibát — hiányzó vagy sérült mentésnél üres kertet ad vissza.
function sanitizeGarden(raw){
  const g = createEmptyGarden();
  if(!raw || typeof raw !== 'object') return g;
  const entranceKey = keyOf(g.entrance.r, g.entrance.c);

  const encCells = new Set();
  if(Array.isArray(raw.enclosures)){
    for(const e of raw.enclosures){
      if(!e || typeof e.r!=='number' || typeof e.c!=='number' || typeof e.animal!=='string') continue;
      if(e.r<0 || e.c<0 || e.r+1>=GARDEN_ROWS || e.c+1>=GARDEN_COLS) continue;
      const keys = enclosureBlockCells({r:e.r,c:e.c}).map(p=>keyOf(p[0],p[1]));
      if(keys.includes(entranceKey)) continue;
      if(keys.some(k=>encCells.has(k))) continue;
      keys.forEach(k=>encCells.add(k));
      g.enclosures.push({ r:e.r, c:e.c, animal:e.animal });
    }
  }

  const pathSetLocal = new Set();
  if(Array.isArray(raw.path)){
    for(const k of raw.path){
      if(typeof k !== 'string') continue;
      const parts = k.split(',');
      if(parts.length !== 2) continue;
      const r = parseInt(parts[0],10), c = parseInt(parts[1],10);
      if(!inBounds(r,c)) continue;
      const kk = keyOf(r,c);
      if(kk === entranceKey) continue;
      if(encCells.has(kk)) continue;
      pathSetLocal.add(kk);
    }
  }
  g.path = Array.from(pathSetLocal);

  // Iteratívan levágjuk a bejárattól el nem érhető út-cellákat (lehet, hogy
  // egy vágás láncreakcióban több szakaszt is levág), majd a kifutókat is
  // leellenőrizzük a végleges összefüggő halmaz ellen.
  let changed = true;
  while(changed){
    changed = false;
    const connected = computeConnectedPathSet(g);
    const before = g.path.length;
    g.path = g.path.filter(k => connected.has(k));
    if(g.path.length !== before) changed = true;
  }
  const connectedFinal = computeConnectedPathSet(g);
  g.enclosures = g.enclosures.filter(e => enclosureHasConnectedNeighbor(e, connectedFinal));

  const occNow = occupancyMap(g);
  if(Array.isArray(raw.decor)){
    for(const d of raw.decor){
      if(!d || typeof d.r!=='number' || typeof d.c!=='number' || typeof d.type!=='string') continue;
      if(!inBounds(d.r,d.c)) continue;
      const k = keyOf(d.r,d.c);
      if(occNow.has(k)) continue;
      occNow.set(k, { type:'decor' });
      g.decor.push({ r:d.r, c:d.c, type:d.type });
    }
  }

  return g;
}

function deserializeGarden(json){
  let raw;
  try{ raw = JSON.parse(json); } catch(e){ return createEmptyGarden(); }
  return sanitizeGarden(raw);
}

const api = {
  GARDEN_COLS, GARDEN_ROWS, GARDEN_ENTRANCE, GARDEN_COSTS, GARDEN_REFUND_RATE,
  keyOf, inBounds, isEntrance,
  createEmptyGarden, occupancyMap, isFreeGrass,
  computeConnectedPathSet,
  canPlacePathAt, placePath, canRemovePathAt, removePathAt,
  enclosureBlockCells, enclosureNeighborCells, enclosureHasConnectedNeighbor,
  canPlaceEnclosureAt, findBestEnclosurePlacement, placeEnclosure, removeEnclosureAt,
  canPlaceDecorAt, placeDecor, removeDecorAt,
  getPathPreviewSet, getEnclosurePreviewSet, getDecorPreviewSet,
  serializeGarden, deserializeGarden, sanitizeGarden
};

if(typeof module !== 'undefined' && module.exports){
  module.exports = api;
} else {
  window.GardenLogic = api;
}
})();
