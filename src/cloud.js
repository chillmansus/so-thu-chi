// Backup to the Google account. This file decides WHAT to send and fetch; the backend it is given
// (Firebase in the real app, a pretend server in tests) does the sending and fetching.
import { mergePart, samePart, isEmpty, localParts, applyParts } from './merge.js';

export function makeCloud(be) {
  let user = null;
  const uid = () => { if (!user) throw new Error('not signed in'); return user.uid; };
  return {
    enabled: !!be.enabled,
    onUser(cb) { be.onUser(u => { user = u; cb(u); }); },
    signIn: () => be.signIn(),
    signOut: () => be.signOut(),
    apply: applyParts,

    // Fetch the whole book, combine it with this phone's, and send back the parts the server lacks or has older.
    // Returns the combined parts; the caller applies them (the phone's book may have changed while this ran).
    async syncAll(D) {
      const id = uid(), remote = await be.getAll(id), local = localParts(D), out = {}, jobs = [];
      for (const k of new Set([...Object.keys(remote), ...Object.keys(local)])) {
        const m = mergePart(local[k], remote[k]);
        out[k] = m;
        if (remote[k] ? !samePart(m, remote[k]) : !isEmpty(m)) jobs.push(be.setPart(id, k, m));
      }
      await Promise.all(jobs);
      return out;
    },

    // Send only the parts that changed. Each one is read first so a change made on another phone is not overwritten.
    async pushKeys(D, keys) {
      const id = uid(), out = {};
      await Promise.all(keys.map(async k => {
        const remote = await be.getPart(id, k);
        const m = mergePart(localParts(D)[k], remote);
        out[k] = m;
        if (remote ? !samePart(m, remote) : !isEmpty(m)) await be.setPart(id, k, m);
      }));
      return out;
    },
  };
}
