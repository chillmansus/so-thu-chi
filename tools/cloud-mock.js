// A pretend Google account and server for trying the sign-in and backup flow on this computer:
//   node build.mjs --mock
// The "server" is kept in this browser's localStorage under mock.remote, the signed-in user under mock.user.
// window.MOCK lets a test take the network away or make the server fail.
import { makeCloud } from '../src/cloud.js';

const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const wait = ms => new Promise(r => setTimeout(r, ms));
const M = window.MOCK = { fail: false, delay: 150, calls: [], failSignIn: null };
let listener = null;
const net = async name => { M.calls.push(name); await wait(M.delay); if (M.fail) throw new Error('mock: server unreachable'); };

window.Cloud = makeCloud({
  enabled: true,
  onUser(cb) { listener = cb; setTimeout(() => cb(read('mock.user', null)), 60); },
  async signIn() {
    await wait(M.delay);
    if (M.failSignIn) { const e = new Error(M.failSignIn); e.code = M.failSignIn; throw e; }
    const u = { uid: 'u-me', email: 'me@example.com', name: 'Mẹ' };
    write('mock.user', u); listener(u);
  },
  async signOut() { localStorage.removeItem('mock.user'); listener(null); },
  async getAll(uid) { await net('getAll'); return read('mock.remote', {})[uid] || {}; },
  async getPart(uid, key) { await net('get ' + key); return (read('mock.remote', {})[uid] || {})[key] || null; },
  async setPart(uid, key, part) {
    await net('set ' + key);
    const all = read('mock.remote', {});
    (all[uid] = all[uid] || {})[key] = JSON.parse(JSON.stringify(part));
    write('mock.remote', all);
  },
});
