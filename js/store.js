// Couche de données : Firebase (Firestore + Auth) ou mode démo (stockage du navigateur)
import { firebaseConfig, firebaseActif, ADMIN_EMAIL, FIREBASE_SDK } from '../firebase-config.js';
import { donneesDemo, CATALOGUE_SITE, PARAMETRES_DEFAUT } from './donnees.js';

export const COLLECTIONS = ['produits', 'commandes', 'ingredients', 'materiel', 'recettes', 'parametres'];
export const mode = firebaseActif ? 'firebase' : 'demo';

// Données en mémoire : { produits: { id: {...} }, ... }
export const db = Object.fromEntries(COLLECTIONS.map(c => [c, {}]));
const abonnes = new Set();
let notifPrevue = false;
function notifier() {
  if (notifPrevue) return;
  notifPrevue = true;
  queueMicrotask(() => { notifPrevue = false; abonnes.forEach(f => { try { f(); } catch (e) { console.error(e); } }); });
}
export function surChangement(f) { abonnes.add(f); return () => abonnes.delete(f); }

// ---------- Erreurs ----------
export let erreurLecture = null;          // dernière erreur de lecture (droits, réseau…)
let gestionnaireErreur = () => {};
export function surErreur(f) { gestionnaireErreur = f; }
export function utilisateurCourant() { return fb?.auth?.currentUser?.email || (mode === 'demo' ? 'mode démo' : ''); }
export function messageErreur(err) {
  const code = err?.code || '';
  if (code.includes('permission-denied')) {
    return `Firebase a refusé l'accès. Compte connecté : ${utilisateurCourant() || 'aucun'}. Les règles Firestore n'autorisent que ${ADMIN_EMAIL || 'l\'adresse indiquée dans firestore.rules'} : connectez-vous avec ce compte, ou mettez la bonne adresse dans les règles et republiez-les.`;
  }
  if (code.includes('unavailable') || code.includes('network')) return 'Firebase est injoignable (pas de réseau, ou un bloqueur de publicité bloque firestore.googleapis.com). Les modifications sont gardées sur l\'appareil et partiront dès que la connexion revient.';
  if (code.includes('unauthenticated')) return 'Session expirée : déconnectez-vous puis reconnectez-vous.';
  return 'Erreur Firebase : ' + (err?.message || code || 'inconnue');
}

// Attend la confirmation du serveur au plus 8 s ; au-delà, l'écriture reste
// en file d'attente sur l'appareil et une erreur éventuelle est signalée plus tard.
function suivre(promesse) {
  let regle = false;
  const delai = new Promise(res => setTimeout(() => { if (!regle) { regle = true; res('attente'); } }, 8000));
  const suivie = promesse.then(v => { regle = true; return v; }, e => { if (regle) gestionnaireErreur(e); regle = true; throw e; });
  suivie.catch(() => {});
  return Promise.race([suivie, delai]);
}

export function liste(col) { return Object.entries(db[col]).map(([id, v]) => ({ id, ...v })); }
export function obtenir(col, id) { const v = db[col][id]; return v ? { id, ...v } : null; }
export function parametres() { return { ...PARAMETRES_DEFAUT, ...(db.parametres.infos || {}) }; }

function idAleatoire() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
function nettoyer(obj) { return JSON.parse(JSON.stringify(obj)); } // retire les undefined

// =====================================================================
//  MODE DÉMO
// =====================================================================
const CLE_DEMO = 'jup-gestion-demo-v2';
const demo = {
  charger() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(CLE_DEMO)); } catch (e) { d = null; }
    if (!d) d = donneesDemo();
    if (!d.materiel) { const neuf = donneesDemo(); d.materiel = neuf.materiel; Object.entries(neuf.recettes).forEach(([id, r]) => { if (d.recettes?.[id] && !d.recettes[id].materiel) d.recettes[id].materiel = r.materiel; }); }
    COLLECTIONS.forEach(c => { db[c] = d[c] || {}; });
    this.sauver();
  },
  sauver() { try { localStorage.setItem(CLE_DEMO, JSON.stringify(db)); } catch (e) { /* stockage indisponible */ } },
  reinitialiser() { try { localStorage.removeItem(CLE_DEMO); localStorage.removeItem('jup-gestion-photos-v1'); } catch (e) {} this.charger(); notifier(); }
};

// =====================================================================
//  FIREBASE
// =====================================================================
let fb = null; // { auth, fs, api }
async function chargerFirebase() {
  const [appMod, authMod, fsMod] = await Promise.all([
    import(`${FIREBASE_SDK}/firebase-app.js`),
    import(`${FIREBASE_SDK}/firebase-auth.js`),
    import(`${FIREBASE_SDK}/firebase-firestore.js`)
  ]);
  const app = appMod.initializeApp(firebaseConfig);
  const auth = authMod.getAuth(app);
  let fs;
  try {
    // Cache hors ligne : la gestion reste utilisable sans réseau, puis se synchronise
    fs = fsMod.initializeFirestore(app, { localCache: fsMod.persistentLocalCache({ tabManager: fsMod.persistentMultipleTabManager() }) });
  } catch (e) {
    fs = fsMod.getFirestore(app);
  }
  fb = { auth, fs, a: authMod, f: fsMod };
}

let desabonnements = [];
function ecouterTout() {
  desabonnements.forEach(u => u());
  desabonnements = COLLECTIONS.map(c => fb.f.onSnapshot(fb.f.collection(fb.fs, c), snap => {
    const m = {};
    snap.forEach(d => { m[d.id] = d.data(); });
    db[c] = m;
    if (erreurLecture) erreurLecture = null;
    notifier();
  }, err => { console.error('Lecture ' + c, err); erreurLecture = err; notifier(); }));
}

// =====================================================================
//  API commune
// =====================================================================
export async function initialiser() {
  if (mode === 'demo') { demo.charger(); return; }
  await chargerFirebase();
}

export function surConnexion(cb) {
  if (mode === 'demo') {
    let connecte = false;
    try { connecte = sessionStorage.getItem('jup-demo-session') === '1'; } catch (e) {}
    cb(connecte ? { email: 'demo@exemple.fr', demo: true } : null);
    return;
  }
  fb.a.onAuthStateChanged(fb.auth, user => {
    if (user && ADMIN_EMAIL && user.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      fb.a.signOut(fb.auth);
      cb(null, 'Ce compte n\'a pas accès à l\'espace de gestion.');
      return;
    }
    if (user) ecouterTout(); else { desabonnements.forEach(u => u()); desabonnements = []; }
    cb(user);
  });
}

export async function connexion(email, motDePasse) {
  if (mode === 'demo') {
    try { sessionStorage.setItem('jup-demo-session', '1'); } catch (e) {}
    return { email: 'demo@exemple.fr', demo: true };
  }
  await fb.a.setPersistence(fb.auth, fb.a.browserLocalPersistence);
  const r = await fb.a.signInWithEmailAndPassword(fb.auth, email, motDePasse);
  return r.user;
}

export async function motDePasseOublie(email) {
  if (mode === 'demo') return;
  await fb.a.sendPasswordResetEmail(fb.auth, email);
}

export async function deconnexion() {
  if (mode === 'demo') { try { sessionStorage.removeItem('jup-demo-session'); } catch (e) {} location.reload(); return; }
  await fb.a.signOut(fb.auth);
}

export async function creer(col, donnees, id) {
  const data = nettoyer(donnees);
  if (mode === 'demo') {
    const nouvelId = id || idAleatoire();
    db[col][nouvelId] = data; demo.sauver(); notifier();
    return nouvelId;
  }
  const ref = id ? fb.f.doc(fb.fs, col, id) : fb.f.doc(fb.f.collection(fb.fs, col));
  await suivre(fb.f.setDoc(ref, data));
  return ref.id;
}

export async function enregistrer(col, id, donnees) {
  const data = nettoyer(donnees);
  if (mode === 'demo') { db[col][id] = data; demo.sauver(); notifier(); return; }
  await suivre(fb.f.setDoc(fb.f.doc(fb.fs, col, id), data));
}

export async function modifier(col, id, champs) {
  const data = nettoyer(champs);
  if (mode === 'demo') { db[col][id] = { ...(db[col][id] || {}), ...data }; demo.sauver(); notifier(); return; }
  await suivre(fb.f.setDoc(fb.f.doc(fb.fs, col, id), data, { merge: true }));
}

export async function supprimer(col, id) {
  if (mode === 'demo') { delete db[col][id]; demo.sauver(); notifier(); return; }
  await suivre(fb.f.deleteDoc(fb.f.doc(fb.fs, col, id)));
}

// Plusieurs écritures en une fois : [{ type: 'set'|'merge'|'delete', col, id, data }]
export async function lot(operations) {
  if (mode === 'demo') {
    operations.forEach(o => {
      if (o.type === 'delete') delete db[o.col][o.id];
      else if (o.type === 'merge') db[o.col][o.id] = { ...(db[o.col][o.id] || {}), ...nettoyer(o.data) };
      else db[o.col][o.id] = nettoyer(o.data);
    });
    demo.sauver(); notifier(); return;
  }
  for (let i = 0; i < operations.length; i += 400) {
    const b = fb.f.writeBatch(fb.fs);
    operations.slice(i, i + 400).forEach(o => {
      const ref = fb.f.doc(fb.fs, o.col, o.id);
      if (o.type === 'delete') b.delete(ref);
      else if (o.type === 'merge') b.set(ref, nettoyer(o.data), { merge: true });
      else b.set(ref, nettoyer(o.data));
    });
    const r = await suivre(b.commit());
    if (r === 'attente') return 'attente';
  }
}

export async function importerCatalogueSite() {
  const ops = Object.entries(CATALOGUE_SITE).map(([id, data]) => ({ type: 'set', col: 'produits', id, data }));
  if (!db.parametres.infos) ops.push({ type: 'set', col: 'parametres', id: 'infos', data: PARAMETRES_DEFAUT });
  return lot(ops);
}

export function reinitialiserDemo() { demo.reinitialiser(); }

// ---------- Photos (stockées à part, chargées à la demande) ----------
const CLE_PHOTOS_DEMO = 'jup-gestion-photos-v1';
const cachePhotos = new Map();
function photosDemo() { try { return JSON.parse(localStorage.getItem(CLE_PHOTOS_DEMO)) || {}; } catch (e) { return {}; } }

export async function lirePhoto(id) {
  if (cachePhotos.has(id)) return cachePhotos.get(id);
  let data = null;
  if (mode === 'demo') data = photosDemo()[id] || null;
  else { const snap = await fb.f.getDoc(fb.f.doc(fb.fs, 'photos', id)); data = snap.exists() ? snap.data().data : null; }
  if (data) cachePhotos.set(id, data);
  return data;
}

export async function creerPhoto(data) {
  const id = 'ph' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  if (mode === 'demo') {
    const toutes = photosDemo(); toutes[id] = data;
    try { localStorage.setItem(CLE_PHOTOS_DEMO, JSON.stringify(toutes)); }
    catch (e) { throw Object.assign(new Error('Plus de place pour les photos en mode démo sur cet appareil.'), { code: 'quota' }); }
  } else {
    await suivre(fb.f.setDoc(fb.f.doc(fb.fs, 'photos', id), { data, creeLe: Date.now() }));
  }
  cachePhotos.set(id, data);
  return id;
}

export async function supprimerPhoto(id) {
  cachePhotos.delete(id);
  if (mode === 'demo') { const t = photosDemo(); delete t[id]; try { localStorage.setItem(CLE_PHOTOS_DEMO, JSON.stringify(t)); } catch (e) {} return; }
  await suivre(fb.f.deleteDoc(fb.f.doc(fb.fs, 'photos', id)));
}

export function exporterTout() {
  return JSON.stringify({ exporteLe: new Date().toISOString(), ...db }, null, 2);
}

export async function importerSauvegarde(texte) {
  const d = JSON.parse(texte);
  const ops = [];
  COLLECTIONS.forEach(c => Object.entries(d[c] || {}).forEach(([id, data]) => ops.push({ type: 'set', col: c, id, data })));
  if (!ops.length) throw new Error('Le fichier ne contient aucune donnée reconnue.');
  await lot(ops);
  return ops.length;
}
