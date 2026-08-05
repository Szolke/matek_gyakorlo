// Önteszt az Állatkert-építőhöz — böngésző nélkül, Node-dal futtatható:
//   node garden-selftest.js
// Sok véletlen építési szekvenciát generál, és minden lépés után ellenőrzi:
//   - minden út összefügg a bejárattal
//   - minden kifutó szabad volt lerakáskor ÉS összefüggő út mellé került
//   - nincs átfedés (bejárat / út / kifutó / dísz között)
//   - az elkölthető egyenleg sosem negatív
//   - a mentés→visszatöltés (serialize→deserialize) ugyanazt az állapotot adja
'use strict';

const G = require('./garden-logic.js');

const SEQUENCES = 700;

function randInt(min, max){ return Math.floor(Math.random()*(max-min+1))+min; }
function choice(arr){ return arr[randInt(0, arr.length-1)]; }

function canonical(garden){
  return JSON.stringify({
    entrance: garden.entrance,
    path: garden.path.slice().sort(),
    enclosures: garden.enclosures.slice()
      .sort((a,b)=>(a.r-b.r)||(a.c-b.c))
      .map(e=>({r:e.r,c:e.c,animal:e.animal})),
    decor: garden.decor.slice()
      .sort((a,b)=>(a.r-b.r)||(a.c-b.c))
      .map(d=>({r:d.r,c:d.c,type:d.type}))
  });
}

function checkInvariants(garden, coins, label){
  if(coins < 0) throw new Error(label+': negatív egyenleg ('+coins+')');

  const connected = G.computeConnectedPathSet(garden);
  for(const k of garden.path){
    if(!connected.has(k)) throw new Error(label+': nem összefüggő út-cella: '+k);
  }

  const seen = new Map();
  const claim = (k, what) => {
    if(seen.has(k)) throw new Error(label+': átfedés itt: '+k+' ('+seen.get(k)+' és '+what+')');
    seen.set(k, what);
  };
  claim(G.keyOf(garden.entrance.r, garden.entrance.c), 'entrance');
  for(const k of garden.path) claim(k, 'path');
  for(const e of garden.enclosures){
    if(e.r<0 || e.c<0 || e.r+1>=G.GARDEN_ROWS || e.c+1>=G.GARDEN_COLS){
      throw new Error(label+': kifutó a rácson kívül: '+e.r+','+e.c);
    }
    for(const [pr,pc] of G.enclosureBlockCells(e)) claim(G.keyOf(pr,pc), 'enclosure');
    if(!G.enclosureHasConnectedNeighbor(e, connected)){
      throw new Error(label+': kifutó nincs összefüggő út mellett: '+e.r+','+e.c);
    }
  }
  for(const d of garden.decor) claim(G.keyOf(d.r,d.c), 'decor');

  const restored = G.deserializeGarden(G.serializeGarden(garden));
  if(canonical(restored) !== canonical(garden)){
    throw new Error(label+': mentés→visszatöltés eltérő állapotot adott');
  }
}

const ANIMALS = ['start','turtle','bunny','koala','lion','owl','caterpillar'];
const DECOR_TYPES = ['tree','bush','bench','fountain'];
const ACTIONS = ['path','path','enclosure','decor','demolish','demolish','noop'];

function runRandomSequence(seqIndex){
  const garden = G.createEmptyGarden();
  let coins = randInt(0, 1500);
  const actionCount = randInt(10, 60);

  checkInvariants(garden, coins, 'seq'+seqIndex+' init');

  for(let step=0; step<actionCount; step++){
    coins += randInt(0, 20); // fokozatos pontgyűjtés lépések között, mint élesben
    const action = choice(ACTIONS);
    const r = randInt(0, G.GARDEN_ROWS-1);
    const c = randInt(0, G.GARDEN_COLS-1);

    if(action === 'path'){
      const res = G.placePath(garden, coins, r, c);
      if(res.ok) coins = res.coins;
    } else if(action === 'enclosure'){
      const res = G.placeEnclosure(garden, coins, r, c, choice(ANIMALS));
      if(res.ok) coins = res.coins;
    } else if(action === 'decor'){
      const res = G.placeDecor(garden, coins, r, c, choice(DECOR_TYPES));
      if(res.ok) coins = res.coins;
    } else if(action === 'demolish'){
      const occ = G.occupancyMap(garden);
      const info = occ.get(G.keyOf(r,c));
      if(info && info.type === 'path'){
        const res = G.removePathAt(garden, coins, r, c);
        if(res.ok) coins = res.coins;
      } else if(info && info.type === 'enclosure'){
        const res = G.removeEnclosureAt(garden, coins, info.enclosure.r, info.enclosure.c);
        if(res.ok) coins = res.coins;
      } else if(info && info.type === 'decor'){
        const res = G.removeDecorAt(garden, coins, r, c);
        if(res.ok) coins = res.coins;
      }
    }
    // 'noop' — szándékosan nem csinál semmit ebben a lépésben

    checkInvariants(garden, coins, 'seq'+seqIndex+' step'+step+' ('+action+' @'+r+','+c+')');
  }
}

let ran = 0;
try{
  for(let i=0; i<SEQUENCES; i++){
    runRandomSequence(i);
    ran++;
  }
  console.log('OK: ' + ran + '/' + SEQUENCES + ' véletlen építési szekvencia lefutott, minden invariáns teljesült.');
  process.exit(0);
} catch(err){
  console.error('SIKERTELEN ' + ran + ' lefutott szekvencia után: ' + err.message);
  process.exit(1);
}
