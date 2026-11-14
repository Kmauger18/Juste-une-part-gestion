// Brouillon automatique : garde la saisie en cours si l'application est
// quittée (recherche d'une recette sur internet, appel, appareil photo…)
// puis rouverte, même si Android a fermé l'application entre-temps.
//
// Chaque formulaire appelle demarrer() à son ouverture. La saisie est
// enregistrée sur l'appareil à chaque modification. Le brouillon est effacé
// quand le formulaire est enregistré ou fermé volontairement.

const CLE = 'jup-brouillon-v1';
const DUREE_MAX = 3 * 24 * 3600 * 1000; // un brouillon de plus de 3 jours est ignoré

let actif = null;   // { type, args, racine, extra }
let minuteur = null;

export function champsDe(racine) {
  const champs = {};
  racine.querySelectorAll('input[id], select[id], textarea[id]').forEach(el => {
    if (el.type === 'file' || el.type === 'password') return;
    champs[el.id] = (el.type === 'checkbox' || el.type === 'radio') ? { c: el.checked } : { v: el.value };
  });
  // groupes de cases sans id (allergènes, type de mouvement…)
  racine.querySelectorAll('input[name]:not([id])').forEach(el => {
    if (el.type !== 'checkbox' && el.type !== 'radio') return;
    const cle = `@${el.name}=${el.value}`;
    champs[cle] = { c: el.checked };
  });
  return champs;
}

function ecrire() {
  if (!actif || !actif.racine.isConnected) return;
  const donnees = { type: actif.type, args: actif.args, hash: location.hash, t: Date.now(), champs: champsDe(actif.racine) };
  try { donnees.extra = actif.extra ? actif.extra() : null; } catch (e) { donnees.extra = null; }
  try { localStorage.setItem(CLE, JSON.stringify(donnees)); }
  catch (e) {
    // Plus de place (photos lourdes) : on garde au moins les champs texte
    try { delete donnees.extra?.photos; localStorage.setItem(CLE, JSON.stringify(donnees)); } catch (e2) {}
  }
}

// Enregistrer tout de suite quand l'appli passe en arrière-plan
// (Android peut la fermer ensuite sans prévenir)
function maintenant() { if (actif) { clearTimeout(minuteur); ecrire(); } }
document.addEventListener('visibilitychange', () => { if (document.hidden) maintenant(); });
window.addEventListener('pagehide', maintenant);
window.addEventListener('blur', maintenant);

export function planifier() {
  if (!actif) return;
  clearTimeout(minuteur);
  minuteur = setTimeout(ecrire, 300);
}

// À appeler dans onOuvert d'un formulaire.
// type : nom du formulaire ; args : de quoi le rouvrir (identifiant…) ;
// racine : élément qui contient les champs ; extra() : état interne (lignes, photos…)
export function demarrer({ type, args = {}, racine, extra = null }) {
  actif = { type, args, racine, extra };
  const ecoute = () => planifier();
  racine.addEventListener('input', ecoute);
  racine.addEventListener('change', ecoute);
  racine.addEventListener('click', ecoute);
  planifier();
}

// Saisie enregistrée ou abandonnée volontairement
export function terminer() {
  clearTimeout(minuteur);
  actif = null;
  try { localStorage.removeItem(CLE); } catch (e) {}
}

// Formulaire fermé sans enregistrer (croix, Annuler, Échap, autre page)
export function abandonner(type) {
  if (actif && (!type || actif.type === type)) terminer();
}

export function lire() {
  try {
    const b = JSON.parse(localStorage.getItem(CLE));
    if (!b || Date.now() - b.t > DUREE_MAX) return null;
    return b;
  } catch (e) { return null; }
}

// Remet les valeurs saisies dans les champs du formulaire rouvert
export function appliquerChamps(racine, champs = {}) {
  Object.entries(champs).forEach(([cle, val]) => {
    let el;
    if (cle.startsWith('@')) {
      const [nom, valeur] = cle.slice(1).split('=');
      el = [...racine.querySelectorAll(`input[name="${CSS.escape(nom)}"]`)].find(x => x.value === valeur);
    } else {
      el = racine.querySelector('#' + CSS.escape(cle));
    }
    if (!el) return;
    if ('c' in val) el.checked = val.c; else el.value = val.v;
  });
  // Laisser les formulaires recalculer ce qui dépend des champs (prix, tailles…)
  racine.querySelectorAll('input, select, textarea').forEach(el => {
    if (el.type === 'file') return;
    if (el.closest('[data-ligne], [data-mligne]')) return;
    el.dispatchEvent(new Event('change', { bubbles: false }));
  });
}

export function estActif(type) { return !!actif && actif.type === type; }
