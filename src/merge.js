// How the book on this phone and the copy in the Google account are combined.
// The book is cut into parts: "meta" (the categories) and one part per month ("m-2026-11").
// A part is { items: { id: thing }, del: { id: time it was deleted } }.
// Every item carries `u`, the time it was last changed. The newer change wins; a deletion wins over
// an older change and loses to a newer one (so "undo" brings an entry back).

const empty = () => ({ items: {}, del: {} });
const plain = x => JSON.parse(JSON.stringify(x)); // drops undefined fields, which the server refuses

export function mergePart(a, b) {
  a = a || empty(); b = b || empty();
  const del = { ...a.del };
  for (const [id, t] of Object.entries(b.del || {})) del[id] = Math.max(del[id] || 0, t);
  const items = {};
  for (const src of [a.items || {}, b.items || {}]) {
    for (const [id, it] of Object.entries(src)) {
      const cur = items[id];
      if (!cur || (it.u || 0) > (cur.u || 0)) items[id] = it;
    }
  }
  for (const id of Object.keys(items)) if (del[id] != null && del[id] >= (items[id].u || 0)) delete items[id];
  return { items, del };
}

const canon = v => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map(n => [n, x[n]])) : x));
export const samePart = (a, b) => canon(a || empty()) === canon(b || empty());
export const isEmpty = p => !p || (!Object.keys(p.items || {}).length && !Object.keys(p.del || {}).length);

// the book on this phone, cut into parts
export function localParts(D) {
  const parts = { meta: { items: {}, del: { ...(D.delCats || {}) } } };
  const part = m => parts['m-' + m] || (parts['m-' + m] = empty());
  for (const c of D.cats) parts.meta.items[c.id] = plain({ ...c, u: c.u || 0 });
  for (const t of D.tx) part(t.date.slice(0, 7)).items[t.id] = plain({ ...t, u: t.u || 0 });
  for (const [m, del] of Object.entries(D.del || {})) if (Object.keys(del).length) Object.assign(part(m).del, del);
  return parts;
}

// take parts that came from the server into the book on this phone, keeping anything newer written here
export function applyParts(D, incoming) {
  const local = localParts(D);
  for (const [k, p] of Object.entries(incoming)) local[k] = mergePart(local[k], p);
  D.cats = Object.values(local.meta.items).sort((a, b) => (a.ts || 0) - (b.ts || 0) || (a.id < b.id ? -1 : 1));
  D.delCats = local.meta.del;
  D.del = {};
  const tx = new Map();
  for (const [k, p] of Object.entries(local)) {
    if (k === 'meta') continue;
    if (Object.keys(p.del).length) D.del[k.slice(2)] = p.del;
    for (const t of Object.values(p.items)) {
      const cur = tx.get(t.id);
      if (!cur || (t.u || 0) > (cur.u || 0)) tx.set(t.id, t);
    }
  }
  D.tx = [...tx.values()].sort((a, b) => (a.ts || 0) - (b.ts || 0) || (a.id < b.id ? -1 : 1));
  return D;
}
