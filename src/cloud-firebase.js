// The real backend: Google sign-in through Firebase Auth, the book in Firestore under users/<uid>/book/<part>.
// Firestore "lite" is used on purpose: plain requests, no background connection. The app keeps its own
// copy on the phone and its own list of what still has to be sent, so nothing more is needed.
import { initializeApp } from 'firebase/app';
import {
  initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, browserPopupRedirectResolver,
  GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut,
} from 'firebase/auth';
import { getFirestore, collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore/lite';

export function firebaseBackend(cfg) {
  if (!cfg || !cfg.apiKey) return { enabled: false, onUser: cb => cb(null) };
  const app = initializeApp(cfg);
  // "local" persistence: the phone stays signed in until someone signs out
  const auth = initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence], popupRedirectResolver: browserPopupRedirectResolver });
  auth.languageCode = 'vi';
  const db = getFirestore(app);
  const book = uid => collection(db, 'users', uid, 'book');
  const toPart = d => ({ items: d.items || {}, del: d.del || {} });
  return {
    enabled: true,
    onUser: cb => onAuthStateChanged(auth, u => cb(u ? { uid: u.uid, email: u.email, name: u.displayName } : null)),
    signIn() {
      const p = new GoogleAuthProvider();
      p.setCustomParameters({ prompt: 'select_account' });
      return signInWithPopup(auth, p);
    },
    signOut: () => signOut(auth),
    async getAll(uid) {
      const out = {};
      (await getDocs(book(uid))).forEach(d => { out[d.id] = toPart(d.data()); });
      return out;
    },
    async getPart(uid, key) {
      const s = await getDoc(doc(book(uid), key));
      return s.exists() ? toPart(s.data()) : null;
    },
    setPart: (uid, key, part) => setDoc(doc(book(uid), key), { items: part.items, del: part.del, u: Date.now() }),
  };
}
