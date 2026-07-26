// Cloudflare Pages Function: /api/progress
// GET  -> beolvassa a profil mentett állapotát a Workers KV-ból
// POST -> elmenti a body-ban kapott állapotot ugyanazzal a kulccsal

const NAME_RE = /^[\p{L}\p{N}]{1,20}$/u;

const EMPTY_STATE = {
  points: 0,
  streak: 0,
  bestStreak: 0,
  totalCorrect: 0,
  perOp: { add: 0, sub: 0, mul: 0, div: 0 },
  badges: {},
  sound: true
};

function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

function keyFor(profile) {
  return 'progress:' + profile;
}

function getProfileOrNull(request) {
  const url = new URL(request.url);
  const profile = url.searchParams.get('profile') || '';
  if (!NAME_RE.test(profile)) return null;
  return profile;
}

export async function onRequestGet(context) {
  const profile = getProfileOrNull(context.request);
  if (!profile) {
    return jsonResponse({ error: 'Érvénytelen profilnév.' }, 400);
  }

  try {
    const raw = await context.env.PROGRESS_KV.get(keyFor(profile));
    if (!raw) {
      return jsonResponse(EMPTY_STATE, 200);
    }
    return new Response(raw, {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return jsonResponse({ error: 'Nem sikerült beolvasni az állapotot.' }, 500);
  }
}

export async function onRequestPost(context) {
  const profile = getProfileOrNull(context.request);
  if (!profile) {
    return jsonResponse({ error: 'Érvénytelen profilnév.' }, 400);
  }

  let bodyText;
  try {
    bodyText = await context.request.text();
    JSON.parse(bodyText);
  } catch (err) {
    return jsonResponse({ error: 'Érvénytelen JSON.' }, 400);
  }

  try {
    await context.env.PROGRESS_KV.put(keyFor(profile), bodyText);
    return jsonResponse({ ok: true }, 200);
  } catch (err) {
    return jsonResponse({ error: 'Nem sikerült menteni az állapotot.' }, 500);
  }
}
