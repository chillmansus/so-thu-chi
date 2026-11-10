// node --test tools/
import test from 'node:test';
import assert from 'node:assert/strict';
import { mergePart, samePart, localParts, applyParts } from '../src/merge.js';
import { makeCloud } from '../src/cloud.js';

const book = () => ({ cats: [{ id: 'c1', name: 'Đồ ăn', type: 'chi', color: 0, hidden: false, ts: 0, u: 0 }], tx: [], del: {}, delCats: {}, dirty: {} });
const tx = (id, date, amt, u) => ({ id, cat: 'c1', amt, date, note: '', ts: u, u });

// a pretend server holding parts per user
function server(start = {}) {
  const store = JSON.parse(JSON.stringify(start));
  let cb;
  return {
    store, enabled: true,
    onUser(f) { cb = f; f({ uid: 'u' }); },
    getAll: async () => JSON.parse(JSON.stringify(store)),
    getPart: async (uid, k) => (store[k] ? JSON.parse(JSON.stringify(store[k])) : null),
    setPart: async (uid, k, p) => { store[k] = JSON.parse(JSON.stringify(p)); },
  };
}
const cloud = be => { const c = makeCloud(be); c.onUser(() => { }); return c; };

test('the newer change wins, whichever side has it', () => {
  const a = { items: { x: { u: 5, amt: 1 } }, del: {} }, b = { items: { x: { u: 9, amt: 2 } }, del: {} };
  assert.equal(mergePart(a, b).items.x.amt, 2);
  assert.equal(mergePart(b, a).items.x.amt, 2);
});

test('a deletion removes an older entry and loses to a newer one', () => {
  const kept = mergePart({ items: { x: { u: 20 } }, del: {} }, { items: {}, del: { x: 10 } });
  assert.ok(kept.items.x);
  const gone = mergePart({ items: { x: { u: 5 } }, del: {} }, { items: {}, del: { x: 10 } });
  assert.equal(gone.items.x, undefined);
  assert.equal(gone.del.x, 10);
});

test('samePart ignores key order', () => {
  assert.ok(samePart({ items: { a: { u: 1, n: 2 } }, del: {} }, { del: {}, items: { a: { n: 2, u: 1 } } }));
});

test('the book is cut by month and put back together unchanged', () => {
  const D = book();
  D.tx.push(tx('a', '2026-10-30', 50000, 1), tx('b', '2026-11-02', 70000, 2));
  const parts = localParts(D);
  assert.deepEqual(Object.keys(parts).sort(), ['m-2026-10', 'm-2026-11', 'meta']);
  const E = applyParts(book(), parts);
  assert.deepEqual(E.tx.map(t => t.id), ['a', 'b']);
});

test('first backup sends everything; a second phone gets the whole book', async () => {
  const be = server(), D = book();
  D.tx.push(tx('a', '2026-11-02', 70000, 2));
  applyParts(D, await cloud(be).syncAll(D));
  assert.ok(be.store['m-2026-11'].items.a);
  assert.ok(be.store.meta.items.c1);

  const phone2 = book(); // fresh install: default categories only
  applyParts(phone2, await cloud(be).syncAll(phone2));
  assert.deepEqual(phone2.tx.map(t => t.amt), [70000]);
  assert.equal(phone2.cats.length, 1, 'default categories are not doubled');
});

test('a renamed category survives a fresh install', async () => {
  const be = server(), D = book();
  D.cats[0].name = 'Ăn uống'; D.cats[0].u = 50;
  await cloud(be).syncAll(D);
  const phone2 = book();
  applyParts(phone2, await cloud(be).syncAll(phone2));
  assert.equal(phone2.cats[0].name, 'Ăn uống');
});

test('deleting an entry reaches the server, and undo brings it back', async () => {
  const be = server(), D = book(), c = cloud(be);
  const t = tx('a', '2026-11-02', 70000, 2);
  D.tx.push(t);
  applyParts(D, await c.syncAll(D));
  // delete
  D.tx = []; D.del['2026-11'] = { a: 100 };
  applyParts(D, await c.pushKeys(D, ['m-2026-11']));
  assert.equal(be.store['m-2026-11'].items.a, undefined);
  // undo: the entry comes back with a newer time
  delete D.del['2026-11'].a; D.tx.push({ ...t, u: 200 });
  applyParts(D, await c.pushKeys(D, ['m-2026-11']));
  assert.ok(be.store['m-2026-11'].items.a);
  assert.equal(D.tx.length, 1);
});

test('moving an entry to another month leaves one copy', async () => {
  const be = server(), D = book(), c = cloud(be);
  D.tx.push(tx('a', '2026-10-30', 50000, 1));
  applyParts(D, await c.syncAll(D));
  D.tx[0] = { ...D.tx[0], date: '2026-11-01', u: 300 }; D.del['2026-10'] = { a: 300 };
  applyParts(D, await c.pushKeys(D, ['m-2026-10', 'm-2026-11']));
  assert.equal(be.store['m-2026-10'].items.a, undefined);
  assert.equal(be.store['m-2026-11'].items.a.date, '2026-11-01');
  const phone2 = book();
  applyParts(phone2, await cloud(be).syncAll(phone2));
  assert.deepEqual(phone2.tx.map(t => t.date), ['2026-11-01']);
});

test('an entry written while a backup is running is not lost', async () => {
  const be = server(), D = book(), c = cloud(be);
  D.tx.push(tx('a', '2026-11-02', 70000, 2));
  const running = c.syncAll(D);
  D.tx.push(tx('b', '2026-11-03', 20000, 3)); // written before the answer comes back
  applyParts(D, await running);
  assert.deepEqual(D.tx.map(t => t.id), ['a', 'b']);
});

test('changes from two phones in the same month are both kept', async () => {
  const be = server(), p1 = book(), p2 = book();
  p1.tx.push(tx('a', '2026-11-02', 70000, 2));
  applyParts(p1, await cloud(be).syncAll(p1));
  p2.tx.push(tx('b', '2026-11-04', 10000, 4));
  applyParts(p2, await cloud(be).pushKeys(p2, ['m-2026-11']));
  assert.deepEqual(Object.keys(be.store['m-2026-11'].items).sort(), ['a', 'b']);
  assert.deepEqual(p2.tx.map(t => t.id), ['a', 'b']);
});
