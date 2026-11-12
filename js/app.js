// Point d'entrée : connexion, navigation, affichage des écrans
import * as store from './store.js';
import { $, $$, esc, fermerPanneau, panneauOuvert, toast } from './ui.js';
import tableau from './vues/tableau.js';
import commandes from './vues/commandes.js';
import produits from './vues/produits.js';
import recettes from './vues/recettes.js';
import stock from './vues/stock.js';
import parametres from './vues/parametres.js';

export const URL_SITE = 'https://kmauger18.github.io/Juste-une-part-merci-/';

const VUES = {
  tableau:    { vue: tableau,    titre: 'Tableau de bord', court: 'Accueil',   icone: 'fa-solid fa-chart-pie' },
  commandes:  { vue: commandes,  titre: 'Commandes',       court: 'Commandes', icone: 'fa-solid fa-receipt' },
  produits:   { vue: produits,   titre: 'Produits',        court: 'Produits',  icone: 'fa-solid fa-cake-candles' },
  recettes:   { vue: recettes,   titre: 'Recettes',        court: 'Recettes',  icone: 'fa-solid fa-book-open' },
  stock:      { vue: stock,      titre: 'Stock',           court: 'Stock',     icone: 'fa-solid fa-boxes-stacked' },
  parametres: { vue: parametres, titre: 'Paramètres',      court: 'Réglages',  icone: 'fa-solid fa-gear' }
};
const ONGLETS_MOBILE = ['tableau', 'commandes', 'produits', 'recettes', 'stock'];

let routeCourante = null;

function routeDepuisAdresse() {
  const h = decodeURIComponent(location.hash.slice(1));
  const [nom, ...reste] = h.split('/');
  return { nom: VUES[nom] ? nom : 'tableau', param: reste.join('/') || null };
}

function compteurNouvelles() {
  return store.liste('commandes').filter(c => c.statut === 'nouvelle').length;
}

function dessinerNavigation(actif) {
  const n = compteurNouvelles();
  const pastille = cle => cle === 'commandes' && n ? `<span class="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-terracotta text-white text-[11px] font-bold grid place-items-center">${n}</span>` : '';
  $('#nav-laterale').innerHTML = Object.entries(VUES).map(([cle, v]) => `
    <a href="#${cle}" ${cle === actif ? 'aria-current="page"' : ''} class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${cle === actif ? 'bg-white/10 text-white' : 'text-brand-300 hover:text-white hover:bg-white/5'}">
      <i class="${v.icone} w-5 text-center ${cle === actif ? 'text-terracotta-light' : ''}"></i>${v.titre}${pastille(cle)}</a>`).join('');
  $('#nav-bas').innerHTML = ONGLETS_MOBILE.map(cle => {
    const v = VUES[cle]; const a = cle === actif;
    return `<a href="#${cle}" ${a ? 'aria-current="page"' : ''} class="relative flex flex-col items-center justify-center gap-1 h-16 text-[11px] font-semibold ${a ? 'text-terracotta' : 'text-brand-500'}">
      <i class="${v.icone} text-lg"></i>${v.court}${cle === 'commandes' && n ? `<span class="absolute top-2 left-1/2 ml-2 min-w-[18px] h-[18px] px-1 rounded-full bg-terracotta text-white text-[10px] font-bold grid place-items-center">${n}</span>` : ''}</a>`;
  }).join('');
}

function afficher(changementDeRoute) {
  const { nom, param } = routeDepuisAdresse();
  const def = VUES[nom];
  const el = $('#vue');

  // Garder le champ en cours de saisie quand les données se mettent à jour
  const actif = document.activeElement;
  const idFocus = actif && el.contains(actif) && actif.id ? actif.id : null;
  const selection = idFocus && 'selectionStart' in actif ? [actif.selectionStart, actif.selectionEnd] : null;
  const defilement = window.scrollY;

  document.title = `${def.titre} | Gestion Juste une part`;
  $('#titre-mobile').textContent = def.titre;
  dessinerNavigation(nom);
  def.vue.render(el, { param, changementDeRoute });

  if (changementDeRoute) {
    window.scrollTo(0, 0);
  } else {
    window.scrollTo(0, defilement);
    if (idFocus) {
      const f = document.getElementById(idFocus);
      if (f) { f.focus(); if (selection) try { f.setSelectionRange(...selection); } catch (e) {} }
    }
  }
  routeCourante = nom;
}

function demarrerApp(utilisateur) {
  $('#ecran-connexion').classList.add('hidden');
  $('#app').classList.remove('hidden');
  $('#utilisateur').textContent = utilisateur.email || '';
  $('#bandeau-demo').classList.toggle('hidden', store.mode !== 'demo');
  $('#lien-site').href = URL_SITE;
  afficher(true);
}

function montrerConnexion(erreur) {
  $('#app').classList.add('hidden');
  $('#ecran-connexion').classList.remove('hidden');
  const demo = store.mode === 'demo';
  $('#connexion-demo').classList.toggle('hidden', !demo);
  $('#connexion-champs').classList.toggle('hidden', demo);
  $('#cx-oubli').classList.toggle('hidden', demo);
  $('#cx-bouton').textContent = demo ? 'Ouvrir la démo' : 'Se connecter';
  const e = $('#cx-erreur');
  e.textContent = erreur || ''; e.classList.toggle('hidden', !erreur);
}

function messageErreurConnexion(err) {
  const code = err?.code || '';
  if (/invalid-credential|wrong-password|user-not-found|invalid-email/.test(code)) return 'Adresse e-mail ou mot de passe incorrect.';
  if (/too-many-requests/.test(code)) return 'Trop d\'essais. Patientez quelques minutes avant de réessayer.';
  if (/network/.test(code)) return 'Pas de connexion internet. Vérifiez le réseau et réessayez.';
  return 'Connexion impossible : ' + (err?.message || 'erreur inconnue');
}

function brancherConnexion() {
  $('#cx-voir').addEventListener('click', () => {
    const i = $('#cx-mdp'); const visible = i.type === 'text';
    i.type = visible ? 'password' : 'text';
    $('#cx-voir i').className = visible ? 'fa-regular fa-eye' : 'fa-regular fa-eye-slash';
  });
  $('#form-connexion').addEventListener('submit', async e => {
    e.preventDefault();
    const b = $('#cx-bouton'); b.disabled = true; b.classList.add('opacity-60');
    try {
      const u = await store.connexion($('#cx-email').value.trim(), $('#cx-mdp').value);
      if (store.mode === 'demo') demarrerApp(u);
    } catch (err) {
      montrerConnexion(messageErreurConnexion(err));
    } finally { b.disabled = false; b.classList.remove('opacity-60'); }
  });
  $('#cx-oubli').addEventListener('click', async () => {
    const email = $('#cx-email').value.trim();
    if (!email) { montrerConnexion('Écrivez d\'abord votre adresse e-mail, puis cliquez à nouveau sur « Mot de passe oublié ».'); return; }
    try { await store.motDePasseOublie(email); montrerConnexion(); toast('E-mail de réinitialisation envoyé'); }
    catch (err) { montrerConnexion(messageErreurConnexion(err)); }
  });
}

async function demarrer() {
  brancherConnexion();
  document.addEventListener('click', async e => {
    const a = e.target.closest('[data-action]');
    if (!a) return;
    if (a.dataset.action === 'fermer-panneau') fermerPanneau();
    if (a.dataset.action === 'deconnexion') await store.deconnexion();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && panneauOuvert()) fermerPanneau(); });
  window.addEventListener('hashchange', () => { fermerPanneau(); if (!$('#app').classList.contains('hidden')) afficher(true); });
  store.surChangement(() => { if (!$('#app').classList.contains('hidden')) afficher(false); });

  try {
    await store.initialiser();
  } catch (err) {
    $('#ecran-chargement').innerHTML = `<div class="max-w-sm text-center px-6"><p class="font-semibold text-brand-900">Impossible de charger Firebase.</p><p class="text-sm text-brand-600 mt-2">Vérifiez la connexion internet et la configuration dans firebase-config.js.</p><p class="text-xs text-brand-400 mt-3">${esc(err.message)}</p></div>`;
    return;
  }
  $('#ecran-chargement').classList.add('hidden');
  store.surConnexion((utilisateur, erreur) => {
    if (utilisateur) demarrerApp(utilisateur); else montrerConnexion(erreur);
  });
}

demarrer();
