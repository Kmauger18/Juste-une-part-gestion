// Recettes : liste, page recette (lecture, comme un site de recettes),
// page de modification (étapes avec leurs photos), coût de revient et marge
import { liste, enregistrer, supprimer, creer, db, lirePhoto, supprimerPhoto } from '../store.js';
import { UNITES, CATEGORIES, CATEGORIES_MATERIEL } from '../donnees.js';
import { $, $$, esc, euro, toast, confirmer, champ, selection, etatVide, BTN, vue } from '../ui.js';
import { coutRecette, coutIngredient, margeProduit, formaterQuantite } from '../calculs.js';
import * as brouillon from '../brouillon.js';
import { vignette, voirPhotos, editeurPhotos } from '../photos.js';
import { ouvrirImport } from '../import-recette.js';

let recherche = '';
let repriseEnAttente = null;   // saisie interrompue à remettre dans l'éditeur
let editionAffichee = null;    // recette ouverte en modification (ne pas l'effacer)
const etatFiches = {};         // parts choisies, ingrédients cochés, étapes faites

const nomRecette = id => db.produits[id]?.titre || db.recettes[id]?.titre || 'Recette';
const sansAccents = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const recetteRemplie = r => r && ((r.ingredients || []).length || (r.blocs || []).length || String(r.etapes || '').trim());

function dureeTexte(min) {
  min = Number(min) || 0; if (!min) return '';
  const h = Math.floor(min / 60), m = min % 60;
  return h ? `${h} h${m ? ' ' + String(m).padStart(2, '0') : ''}` : `${m} min`;
}

// ---------- Étapes ----------
// Les étapes sont des « blocs » : un titre de partie ou une étape (texte + photos).
// Les anciennes recettes (texte, une étape par ligne) sont converties à la lecture.
function analyserTexte(texte) {
  return String(texte || '').split('\n').map(s => s.trim()).filter(Boolean).map(s => {
    const t = s.replace(/^\s*(\d+[\.\)]|[-•*])\s*/, '');
    if (/:\s*$/.test(t) && t.length <= 60) return { type: 'titre', texte: t.replace(/\s*:\s*$/, ''), photos: [] };
    return { type: 'etape', texte: t, photos: [] };
  });
}
function blocsDe(r) {
  if (Array.isArray(r?.blocs) && r.blocs.length) return r.blocs.map(b => ({ type: b.type === 'titre' ? 'titre' : 'etape', texte: b.texte || '', photos: (b.photos || []).filter(Boolean) }));
  return analyserTexte(r?.etapes);
}
function numeroter(blocs) {
  let n = 0, partie = '';
  return blocs.filter(b => b.type === 'titre' ? b.texte : (b.texte || b.photos.length))
    .map(b => b.type === 'titre' ? (partie = b.texte, { ...b }) : { ...b, n: ++n, partie });
}

// Ingrédients cités dans une étape (nom complet, ou premier mot s'il est sans ambiguïté)
function ingredientsCites(texte, lignes) {
  const t = ' ' + sansAccents(texte).replace(/[^a-z0-9]+/g, ' ') + ' ';
  const premiers = lignes.map(l => sansAccents(db.ingredients[l.ingredientId]?.nom).split(/[^a-z0-9]+/).find(m => m.length >= 4) || '');
  return lignes.filter((l, i) => {
    const nom = sansAccents(db.ingredients[l.ingredientId]?.nom).replace(/[^a-z0-9]+/g, ' ').trim();
    if (!nom) return false;
    if (t.includes(' ' + nom + ' ')) return true;
    const p = premiers[i];
    if (!p || premiers.filter(x => x === p).length > 1) return false;
    return new RegExp(' ' + p + 's? ').test(t) || t.includes(' ' + p.replace(/s$/, '') + ' ');
  });
}

// Charger les photos d'une zone (balises img[data-photo-id])
function chargerPhotos(racine) {
  racine.querySelectorAll('img[data-photo-id]').forEach(img => {
    lirePhoto(img.dataset.photoId).then(d => { if (d) { img.src = d; img.classList.remove('opacity-0'); } }).catch(() => {});
  });
}
function photosHTML(ids, groupe, titre) {
  if (!ids.length) return '';
  const img = (id, i, classe) => `<button type="button" data-voir="${groupe}" data-index="${i}" data-titre="${esc(titre)}" class="block w-full overflow-hidden rounded-2xl bg-brand-100 ${classe}" aria-label="Agrandir la photo"><img data-photo-id="${esc(id)}" alt="" class="w-full h-full object-cover opacity-0 transition-opacity"></button>`;
  if (ids.length === 1) return `<div class="mt-4">${img(ids[0], 0, 'aspect-[4/3] sm:aspect-[16/9]')}</div>`;
  return `<div class="mt-4 grid grid-cols-2 gap-2">${ids.map((id, i) => img(id, i, ids.length === 3 && i === 0 ? 'col-span-2 aspect-[16/9]' : 'aspect-square')).join('')}</div>`;
}

// ---------- Navigation ----------
// Import d'une recette depuis un lien : on ouvre la modification déjà remplie
export function importerRecette(lien = '') {
  ouvrirImport({ lien, quandPret: reprise => editerRecette('r-' + Math.random().toString(36).slice(2, 9), true, reprise) });
}
export function ouvrirRecette(id) { location.hash = '#recettes/' + id; }
export function editerRecette(id, libre = false, reprise = null) {
  repriseEnAttente = reprise;
  const h = `#recettes/${id}/modifier`;
  if (location.hash === h) { editionAffichee = null; afficherEditeur($('#vue'), id); }
  else location.hash = h;
}

export default {
  render(el, { param }) {
    const [id, action] = String(param || '').split('/');
    if (id && action === 'modifier') {
      if (editionAffichee === id && el.querySelector('#page-recette-edition')) return; // saisie en cours : on n'y touche pas
      afficherEditeur(el, id);
      return;
    }
    editionAffichee = null;
    if (brouillon.estActif('recette')) brouillon.terminer();
    if (id) afficherFiche(el, id); else afficherListe(el, this);
  }
};

// ---------- Liste des recettes ----------
function afficherListe(el, vueRecettes) {
  const produits = liste('produits').sort((a, b) => (a.ordre || 99) - (b.ordre || 99));
  const libres = liste('recettes').filter(r => !db.produits[r.id]);
  const elements = [
    ...produits.map(p => ({ id: p.id, titre: p.titre, image: db.recettes[p.id]?.miniature || p.image, recette: db.recettes[p.id] || null, produit: true })),
    ...libres.map(r => ({ id: r.id, titre: r.titre || 'Recette', image: r.miniature || '', recette: r, produit: false }))
  ].filter(x => !recherche || x.titre.toLowerCase().includes(recherche.toLowerCase()));
  const avec = elements.filter(x => recetteRemplie(x.recette)).length;

  vue(el).innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-3 mb-2">
      <h1 class="hidden lg:block font-display text-3xl">Recettes</h1>
      <div class="grid grid-cols-2 sm:flex gap-2 w-full sm:w-auto">
        <button type="button" data-r="importer" class="${BTN.principal}"><i class="fa-solid fa-link"></i> Importer d'un lien</button>
        <button type="button" data-r="libre" class="${BTN.secondaire}"><i class="fa-solid fa-plus"></i> Recette de base</button>
      </div>
    </div>
    <p class="text-sm text-brand-600 mb-4">${avec} recette${avec > 1 ? 's' : ''} renseignée${avec > 1 ? 's' : ''}. Avec les recettes, le coût de revient, la marge et les besoins en ingrédients sont calculés tout seuls.</p>
    <label class="relative block mb-5 sm:w-72"><span class="sr-only">Rechercher</span><i class="fa-solid fa-magnifying-glass absolute left-3.5 top-3 text-brand-400 text-sm"></i>
      <input id="recherche-recettes" type="search" value="${esc(recherche)}" placeholder="Rechercher une recette" class="w-full rounded-full border border-brand-200 bg-white pl-10 pr-4 py-2 text-sm focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 focus:outline-none"></label>
    ${elements.length ? `<div class="grid gap-3 md:grid-cols-2">${elements.map(x => {
      const r = x.recette, ok = recetteRemplie(r), avecIng = r && (r.ingredients || []).length;
      const cout = avecIng ? coutRecette(r) : null, m = x.produit && avecIng ? margeProduit(x.id) : null;
      const nbEtapes = ok ? numeroter(blocsDe(r)).filter(b => b.n).length : 0;
      return `<a href="#recettes/${x.id}" class="min-w-0 text-left bg-white rounded-2xl border ${ok ? 'border-brand-200' : 'border-dashed border-brand-300'} p-3 flex gap-3 items-center hover:shadow-md transition-shadow">
        <span class="w-16 h-16 rounded-xl bg-brand-100 overflow-hidden flex-none grid place-items-center text-brand-300 text-xl">${x.image ? `<img src="${esc(x.image)}" alt="" loading="lazy" class="w-full h-full object-cover">` : '<i class="fa-solid fa-book-open"></i>'}</span>
        <span class="min-w-0 flex-1">
          <span class="block font-semibold truncate">${esc(x.titre)}</span>
          ${ok ? `<span class="block text-xs text-brand-600 mt-0.5">${r.rendement || 1} parts${avecIng ? ` · ${r.ingredients.length} ingrédient${r.ingredients.length > 1 ? 's' : ''}` : ''}${nbEtapes ? ` · ${nbEtapes} étape${nbEtapes > 1 ? 's' : ''}` : ''}${r.tempsMin ? ` · ${dureeTexte(r.tempsMin)}` : ''}</span>
            ${cout ? `<span class="block text-xs mt-1"><strong class="tabular-nums">${euro(cout.parPart)}</strong> la part${m ? ` · marge <strong class="${m.taux >= 0.6 ? 'text-emerald-700' : m.taux >= 0.4 ? 'text-amber-700' : 'text-red-700'}">${Math.round(m.taux * 100)} %</strong>` : ''}</span>` : ''}`
          : `<span class="block text-xs text-terracotta font-semibold mt-1"><i class="fa-solid fa-plus"></i> Écrire la recette</span>`}
        </span>
        <i class="fa-solid fa-chevron-right text-brand-300 text-sm"></i></a>`;
    }).join('')}</div>` : etatVide({ icone: 'fa-solid fa-book-open', titre: 'Aucune recette', texte: 'Ajoutez d\'abord des gâteaux dans « Produits », puis leurs recettes ici.' })}`;

  el.onclick = e => {
    if (e.target.closest('[data-r="libre"]')) editerRecette('r-' + Math.random().toString(36).slice(2, 9), true);
    if (e.target.closest('[data-r="importer"]')) importerRecette();
  };
  $('#recherche-recettes', el).oninput = e => { recherche = e.target.value; vueRecettes.render(el, {}); };
}

// ---------- Page recette (lecture) ----------
function barreHaut(gauche, titre, droite) {
  return `<div class="sticky top-14 lg:top-0 z-20 -mx-4 sm:-mx-6 lg:-mx-8 -mt-5 lg:-mt-8 px-4 sm:px-6 lg:px-8 py-2.5 bg-brand-50/95 backdrop-blur border-b border-brand-200 flex items-center gap-2">
    ${gauche}<span class="flex-1 min-w-0 truncate font-semibold text-brand-800">${esc(titre)}</span>${droite}</div>`;
}

function afficherFiche(el, id) {
  const r = db.recettes[id];
  const produit = db.produits[id];
  const retour = `<a href="#recettes" class="${BTN.icone} flex-none" aria-label="Retour aux recettes"><i class="fa-solid fa-arrow-left text-lg"></i></a>`;
  const modifier = `<a href="#recettes/${id}/modifier" class="${BTN.sombre} flex-none"><i class="fa-solid fa-pen"></i> Modifier</a>`;

  if (!recetteRemplie(r)) {
    el.onclick = null;
    el.innerHTML = `${barreHaut(retour, nomRecette(id), '')}
      <div class="max-w-xl mx-auto text-center py-14">
        ${produit?.image ? `<img src="${esc(produit.image)}" alt="" class="w-28 h-28 rounded-3xl object-cover mx-auto shadow">` : '<i class="fa-solid fa-book-open text-5xl text-brand-300"></i>'}
        <h1 class="font-display text-3xl mt-5">${esc(nomRecette(id))}</h1>
        <p class="text-brand-600 mt-2">La recette n'est pas encore écrite.</p>
        <a href="#recettes/${id}/modifier" class="${BTN.principal} mt-6"><i class="fa-solid fa-pen"></i> Écrire la recette</a>
      </div>`;
    return;
  }

  const rendement = Number(r.rendement) || 1;
  const etat = etatFiches[id] || (etatFiches[id] = { parts: rendement, coches: new Set(), faites: new Set() });
  const quantite = l => (Number(l.quantite) || 0) * etat.parts / rendement;
  const blocs = numeroter(blocsDe(r));
  const nbEtapes = blocs.filter(b => b.n).length;
  const photos = (r.photos || []).filter(Boolean);
  const imagePrincipale = r.miniature || produit?.image || '';
  const m = produit && (r.ingredients || []).length ? margeProduit(id) : null;
  const materiel = (r.materiel || []).map(l => { const mt = db.materiel[l.materielId]; return { nom: mt?.nom || 'Matériel supprimé', besoin: Number(l.quantite) || 1, dispo: Number(mt?.quantite) || 0, mt }; });
  const materielOk = materiel.every(l => l.dispo >= l.besoin);
  const surtitre = produit ? (CATEGORIES[produit.categorie]?.label || CATEGORIES[produit.categorie] || 'Pâtisserie') : 'Recette de base';
  const groupes = { principale: photos };
  blocs.forEach(b => { if (b.n) groupes['e' + b.n] = b.photos; });

  const puce = l => { const ing = db.ingredients[l.ingredientId]; return `<span class="inline-flex items-center gap-1.5 rounded-full bg-brand-100 text-brand-800 px-3 py-1 text-sm"><strong class="tabular-nums">${formaterQuantite(quantite(l), ing?.unite)}</strong> ${esc(ing?.nom || '')}</span>`; };

  const ingredientsHTML = () => {
    let manque = 0;
    const lignes = (r.ingredients || []).map((l, i) => {
      const ing = db.ingredients[l.ingredientId];
      const q = quantite(l), insuffisant = ing && q > (Number(ing.quantite) || 0), fait = etat.coches.has(i);
      if (insuffisant) manque++;
      return `<li><button type="button" data-cocher="${i}" aria-pressed="${fait}" class="w-full flex items-center gap-3 py-3 text-left ${fait ? 'opacity-45' : ''}">
        <span class="w-7 h-7 rounded-full border-2 flex-none grid place-items-center ${fait ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-brand-300'}">${fait ? '<i class="fa-solid fa-check text-xs"></i>' : ''}</span>
        <span class="flex-1 min-w-0 text-[17px] leading-snug ${fait ? 'line-through' : ''}">${esc(ing?.nom || 'Ingrédient supprimé')}${insuffisant ? `<span class="block text-xs text-red-700 font-semibold mt-0.5 no-underline"><i class="fa-solid fa-triangle-exclamation"></i> En stock : ${formaterQuantite(ing.quantite, ing.unite)}</span>` : ''}</span>
        <span class="font-display text-xl tabular-nums whitespace-nowrap ${insuffisant ? 'text-red-700' : 'text-brand-950'}">${formaterQuantite(q, ing?.unite)}</span></button></li>`;
    }).join('');
    return { lignes, manque };
  };

  const etapesHTML = () => blocs.map(b => b.type === 'titre'
    ? `<h3 class="font-display text-2xl sm:text-3xl text-terracotta pt-4 first:pt-0">${esc(b.texte)}</h3>`
    : (() => {
      const fait = etat.faites.has(b.n), cites = ingredientsCites(b.texte, r.ingredients || []);
      return `<article class="bg-white rounded-3xl border border-brand-200 p-5 sm:p-6 ${fait ? 'opacity-60' : ''}">
        <div class="flex items-center gap-3">
          <span class="w-11 h-11 rounded-full ${fait ? 'bg-emerald-600' : 'bg-terracotta'} text-white font-display text-xl grid place-items-center flex-none">${fait ? '<i class="fa-solid fa-check text-base"></i>' : b.n}</span>
          <h4 class="font-display text-xl flex-1">Étape ${b.n}</h4>
          <button type="button" data-etape="${b.n}" aria-pressed="${fait}" class="text-xs font-semibold px-3 py-1.5 rounded-full border ${fait ? 'border-emerald-600 text-emerald-700 bg-emerald-50' : 'border-brand-200 text-brand-600'}">${fait ? '<i class="fa-solid fa-check"></i> Faite' : 'Marquer faite'}</button>
        </div>
        ${b.texte ? `<p class="mt-3 text-[17px] sm:text-lg leading-relaxed text-brand-950 whitespace-pre-line">${esc(b.texte)}</p>` : ''}
        ${cites.length ? `<div class="flex flex-wrap gap-1.5 mt-3">${cites.map(puce).join('')}</div>` : ''}
        ${photosHTML(b.photos, 'e' + b.n, `${nomRecette(id)} · étape ${b.n}`)}
      </article>`;
    })()).join('');

  const dessiner = () => {
    const ing = ingredientsHTML();
    el.onclick = null;
    el.innerHTML = `${barreHaut(retour, nomRecette(id), modifier)}
      <article id="page-recette" class="max-w-6xl mx-auto pb-6">
        <header class="pt-5">
          <p class="text-xs font-bold uppercase tracking-wider text-terracotta">${esc(surtitre)}</p>
          <h1 class="font-display text-4xl sm:text-5xl leading-tight mt-1">${esc(nomRecette(id))}</h1>
          ${r.source ? `<a href="${esc(r.source)}" target="_blank" rel="noopener" class="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:text-terracotta mt-2"><i class="fa-solid fa-link text-xs"></i> D'après ${esc((() => { try { return new URL(r.source).hostname.replace(/^www\./, ''); } catch (e) { return 'le site d\'origine'; } })())}</a>` : ''}
        </header>

        <div class="mt-5 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-5 items-start">
          ${imagePrincipale ? `<div class="-mx-4 sm:mx-0">
            <button type="button" data-voir="principale" data-index="0" data-titre="${esc(nomRecette(id))}" class="block w-full aspect-[4/3] sm:rounded-3xl overflow-hidden bg-brand-100" ${photos.length ? '' : 'disabled'} aria-label="Agrandir la photo">
              <img ${photos.length ? `data-photo-id="${esc(photos[0])}"` : ''} src="${esc(imagePrincipale)}" alt="" class="w-full h-full object-cover"></button>
            ${photos.length > 1 ? `<div class="flex gap-2 overflow-x-auto px-4 sm:px-0 pt-2">${photos.slice(1).map((p, i) => `<button type="button" data-voir="principale" data-index="${i + 1}" data-titre="${esc(nomRecette(id))}" class="w-20 h-20 flex-none rounded-xl overflow-hidden bg-brand-100" aria-label="Photo ${i + 2}"><img data-photo-id="${esc(p)}" alt="" class="w-full h-full object-cover opacity-0 transition-opacity"></button>`).join('')}</div>` : ''}
          </div>` : ''}
          <div class="grid grid-cols-2 gap-2 ${imagePrincipale ? '' : 'lg:col-span-2 sm:grid-cols-4'}">
            ${[['fa-regular fa-clock', dureeTexte(r.tempsMin) || '—', 'temps total'], ['fa-solid fa-chart-pie', `${rendement}`, `part${rendement > 1 ? 's' : ''}`], ['fa-solid fa-list-ol', nbEtapes || '—', `étape${nbEtapes > 1 ? 's' : ''}`], ['fa-solid fa-coins', (r.ingredients || []).length ? euro(coutRecette(r).parPart) : '—', 'coût par part']]
              .map(([ic, v, l]) => `<div class="bg-white rounded-2xl border border-brand-200 p-4"><i class="${ic} text-terracotta text-lg"></i><div class="font-display text-2xl mt-2 tabular-nums">${v}</div><div class="text-xs text-brand-500">${l}</div></div>`).join('')}
            ${nbEtapes ? `<button type="button" id="fiche-pas-a-pas" class="${BTN.principal} col-span-2 ${imagePrincipale ? '' : 'sm:col-span-4'} py-4 text-base"><i class="fa-solid fa-play"></i> Cuisiner pas à pas</button>` : ''}
          </div>
        </div>

        <div class="mt-8 grid lg:grid-cols-[22rem_minmax(0,1fr)] gap-8 lg:gap-10 items-start">
          <aside class="space-y-8 lg:sticky lg:top-20">
            ${(r.ingredients || []).length ? `<section>
              <h2 class="font-display text-3xl">Ingrédients</h2>
              <div class="mt-3 bg-white rounded-2xl border border-brand-200 p-2 flex items-center justify-between gap-2">
                <span class="font-semibold pl-2">Pour</span>
                <div class="flex items-center gap-1 bg-brand-50 rounded-xl border border-brand-200">
                  <button type="button" id="parts-moins" class="w-11 h-11 text-xl font-bold" aria-label="Moins de parts">−</button>
                  <input id="parts-fiche" type="number" min="1" value="${etat.parts}" class="w-12 text-center bg-transparent font-display text-2xl tabular-nums" aria-label="Nombre de parts">
                  <button type="button" id="parts-plus" class="w-11 h-11 text-xl font-bold" aria-label="Plus de parts">+</button>
                </div>
                <span class="pr-2">parts</span>
              </div>
              <p class="text-sm font-semibold mt-3 ${ing.manque ? 'text-red-700' : 'text-emerald-700'}">${ing.manque ? `<i class="fa-solid fa-triangle-exclamation"></i> ${ing.manque} ingrédient${ing.manque > 1 ? 's' : ''} à racheter` : '<i class="fa-solid fa-circle-check"></i> Tout est en stock'}</p>
              <ul id="fiche-ingredients" class="mt-2 bg-white rounded-2xl border border-brand-200 px-4 divide-y divide-brand-100">${ing.lignes}</ul>
              <p class="text-xs text-brand-500 mt-2">Touchez un ingrédient pour le cocher quand il est pesé.</p>
            </section>` : ''}
            ${materiel.length ? `<section>
              <h2 class="font-display text-3xl">Matériel</h2>
              <p class="text-sm font-semibold mt-2 ${materielOk ? 'text-emerald-700' : 'text-red-700'}">${materielOk ? '<i class="fa-solid fa-circle-check"></i> Tout est disponible' : '<i class="fa-solid fa-triangle-exclamation"></i> Il manque du matériel'}</p>
              <ul class="mt-2 bg-white rounded-2xl border ${materielOk ? 'border-brand-200' : 'border-red-300'} px-4 divide-y divide-brand-100">${materiel.map(l => `<li class="flex items-center gap-3 py-3">
                ${l.mt?.miniature ? vignette({ ...l.mt }, 'w-10 h-10') : `<span class="w-10 h-10 rounded-xl bg-brand-100 grid place-items-center text-brand-400 flex-none"><i class="fa-solid fa-whisk"></i></span>`}
                <span class="flex-1 min-w-0 text-[16px]">${esc(l.nom)}${l.besoin > 1 ? ` <span class="text-brand-500">× ${l.besoin}</span>` : ''}</span>
                <span class="text-sm font-semibold whitespace-nowrap ${l.dispo >= l.besoin ? 'text-emerald-700' : 'text-red-700'}"><i class="fa-solid ${l.dispo >= l.besoin ? 'fa-check' : 'fa-xmark'}"></i> ${l.dispo}</span></li>`).join('')}</ul>
            </section>` : ''}
          </aside>

          <section>
            <h2 class="font-display text-3xl mb-4">Préparation</h2>
            ${nbEtapes ? `<div class="space-y-5">${etapesHTML()}</div>`
              : `<div class="bg-white rounded-2xl border border-dashed border-brand-300 p-6 text-center text-brand-600">Aucune étape écrite pour l'instant.<br><a href="#recettes/${id}/modifier" class="text-terracotta font-semibold hover:underline">Ajouter les étapes</a></div>`}
          </section>
        </div>

        ${m ? `<section class="mt-10 pt-6 border-t border-brand-200">
          <h2 class="text-xs font-bold uppercase tracking-wider text-brand-500 mb-3">Coût et marge (${m.parts} parts)</h2>
          <div class="grid grid-cols-3 gap-2 text-center max-w-xl">
            <div class="bg-white rounded-xl border border-brand-200 p-3"><div class="text-[11px] text-brand-500">Coût</div><div class="font-semibold tabular-nums">${euro(m.cout)}</div></div>
            <div class="bg-white rounded-xl border border-brand-200 p-3"><div class="text-[11px] text-brand-500">Prix de vente</div><div class="font-semibold tabular-nums">${euro(m.prix)}</div></div>
            <div class="rounded-xl p-3 ${m.taux >= 0.6 ? 'bg-emerald-50 text-emerald-800' : m.taux >= 0.4 ? 'bg-amber-50 text-amber-800' : 'bg-red-50 text-red-800'}"><div class="text-[11px]">Marge</div><div class="font-semibold tabular-nums">${Math.round(m.taux * 100)} %</div></div>
          </div></section>` : ''}
      </article>`;

    chargerPhotos(el);
    const majParts = n => { etat.parts = Math.max(1, n || 1); dessiner(); };
    const moins = $('#parts-moins', el);
    if (moins) {
      moins.onclick = () => majParts(etat.parts - 1);
      $('#parts-plus', el).onclick = () => majParts(etat.parts + 1);
      $('#parts-fiche', el).onchange = e => majParts(parseInt(e.target.value, 10));
    }
    el.onclick = e => {
      const c = e.target.closest('[data-cocher]');
      if (c) { const i = +c.dataset.cocher; etat.coches.has(i) ? etat.coches.delete(i) : etat.coches.add(i); dessiner(); return; }
      const f = e.target.closest('[data-etape]');
      if (f) { const n = +f.dataset.etape; etat.faites.has(n) ? etat.faites.delete(n) : etat.faites.add(n); dessiner(); return; }
      const v = e.target.closest('[data-voir]');
      if (v && !v.disabled) { voirPhotos(groupes[v.dataset.voir] || [], v.dataset.titre, +v.dataset.index); return; }
      if (e.target.closest('#fiche-pas-a-pas')) cuisinerPasAPas({ titre: nomRecette(id), r, blocs, etat, rendement, apres: dessiner });
    };
  };
  const defilement = window.scrollY;
  dessiner();
  window.scrollTo(0, defilement);
}

// ---------- Mode « pas à pas » : une étape à la fois, en grand ----------
// L'écran reste allumé pendant la préparation (si le téléphone le permet).
function cuisinerPasAPas({ titre, r, blocs, etat, rendement, apres }) {
  const pages = [{ prep: true }, ...blocs.filter(b => b.n)];
  let i = 0, verrou = null;
  const quantite = l => (Number(l.quantite) || 0) * etat.parts / rendement;
  const ecran = document.createElement('div');
  ecran.className = 'fixed inset-0 z-[55] bg-brand-50 flex flex-col';
  ecran.setAttribute('role', 'dialog'); ecran.setAttribute('aria-modal', 'true'); ecran.setAttribute('aria-label', 'Recette pas à pas');
  ecran.innerHTML = `
    <div class="flex-none bg-white border-b border-brand-200" style="padding-top:env(safe-area-inset-top,0px)">
      <div class="flex items-center gap-3 px-4 h-14"><span class="flex-1 min-w-0 truncate font-display text-lg">${esc(titre)}</span>
        <button type="button" data-pas="fermer" class="w-11 h-11 grid place-items-center rounded-xl hover:bg-brand-100" aria-label="Quitter le pas à pas"><i class="fa-solid fa-xmark text-xl"></i></button></div>
      <div class="h-1.5 bg-brand-100"><div id="pas-barre" class="h-full bg-terracotta transition-all"></div></div>
    </div>
    <div id="pas-contenu" class="flex-1 overflow-y-auto"></div>
    <div class="flex-none bg-white border-t border-brand-200" style="padding-bottom:env(safe-area-inset-bottom,0px)"><div class="px-4 py-3 flex gap-3 max-w-2xl mx-auto">
      <button type="button" data-pas="prec" class="${BTN.secondaire} flex-1 py-4 text-base"><i class="fa-solid fa-arrow-left"></i> Précédente</button>
      <button type="button" data-pas="suiv" class="${BTN.principal} flex-[2] py-4 text-base"></button>
    </div></div>`;
  const dessiner = () => {
    const e = pages[i], total = pages.length - 1;
    ecran.querySelector('#pas-barre').style.width = `${(i / total) * 100}%`;
    const c = ecran.querySelector('#pas-contenu');
    c.innerHTML = `<div class="max-w-2xl mx-auto px-5 py-6">${e.prep
      ? `<p class="text-sm font-bold uppercase tracking-wider text-terracotta">Avant de commencer</p>
         <h2 class="font-display text-3xl mt-1 mb-5">Sortez les ingrédients <span class="text-brand-500 text-xl">· ${etat.parts} part${etat.parts > 1 ? 's' : ''}</span></h2>
         <ul class="bg-white rounded-2xl border border-brand-200 px-4 divide-y divide-brand-100">${(r.ingredients || []).map(l => { const ing = db.ingredients[l.ingredientId]; return `<li class="flex items-center justify-between gap-3 py-3.5"><span class="text-xl">${esc(ing?.nom || 'Ingrédient supprimé')}</span><span class="font-display text-2xl tabular-nums whitespace-nowrap">${formaterQuantite(quantite(l), ing?.unite)}</span></li>`; }).join('')}</ul>`
      : `<p class="text-sm font-bold uppercase tracking-wider text-terracotta">Étape ${e.n} sur ${total}${e.partie ? ` · ${esc(e.partie)}` : ''}</p>
         ${e.texte ? `<p class="text-[26px] leading-snug text-brand-950 mt-4 whitespace-pre-line">${esc(e.texte)}</p>` : ''}
         ${(() => { const cites = ingredientsCites(e.texte, r.ingredients || []); return cites.length ? `<div class="mt-6 space-y-2">${cites.map(l => { const ing = db.ingredients[l.ingredientId]; return `<div class="flex items-center justify-between gap-3 bg-white rounded-2xl border border-brand-200 px-4 py-3"><span class="text-lg">${esc(ing?.nom || '')}</span><span class="font-display text-2xl tabular-nums">${formaterQuantite(quantite(l), ing?.unite)}</span></div>`; }).join('')}</div>` : ''; })()}
         ${photosHTML(e.photos, 'pas', `Étape ${e.n}`)}`}</div>`;
    chargerPhotos(c);
    c.scrollTop = 0;
    const prec = ecran.querySelector('[data-pas="prec"]');
    prec.disabled = i === 0; prec.classList.toggle('opacity-40', i === 0);
    ecran.querySelector('[data-pas="suiv"]').innerHTML = i === 0 ? 'C\'est parti <i class="fa-solid fa-arrow-right"></i>' : i === total ? '<i class="fa-solid fa-check"></i> Terminé' : 'Suivante <i class="fa-solid fa-arrow-right"></i>';
  };
  const aller = d => {
    if (d > 0 && pages[i].n) etat.faites.add(pages[i].n);
    if (d > 0 && i === pages.length - 1) { fermer(); toast('Bonne dégustation !'); return; }
    i = Math.min(Math.max(0, i + d), pages.length - 1); dessiner();
  };
  const clavier = e => {
    if (!document.querySelector('#vis-image')?.closest('.hidden') && document.querySelector('#vis-image')) return; // visionneuse ouverte
    if (e.key === 'Escape') { e.stopPropagation(); fermer(); }
    if (e.key === 'ArrowRight') aller(1);
    if (e.key === 'ArrowLeft') aller(-1);
  };
  const reveil = () => { if (document.visibilityState === 'visible' && 'wakeLock' in navigator) navigator.wakeLock.request('screen').then(v => verrou = v).catch(() => {}); };
  const quitterSiNavigation = () => fermer();
  function fermer() {
    document.removeEventListener('keydown', clavier, true);
    document.removeEventListener('visibilitychange', reveil);
    window.removeEventListener('hashchange', quitterSiNavigation);
    try { verrou?.release(); } catch (e) {}
    if (ecran.isConnected) { ecran.remove(); apres(); }
  }
  ecran.addEventListener('click', e => {
    const v = e.target.closest('[data-voir]');
    if (v) { voirPhotos(pages[i].photos || [], v.dataset.titre, +v.dataset.index); return; }
    const b = e.target.closest('[data-pas]'); if (!b) return;
    if (b.dataset.pas === 'fermer') fermer(); else aller(b.dataset.pas === 'suiv' ? 1 : -1);
  });
  // Glisser vers la gauche ou la droite pour changer d'étape
  let x0 = null;
  ecran.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
  ecran.addEventListener('touchend', e => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 70) aller(dx < 0 ? 1 : -1); });
  document.addEventListener('keydown', clavier, true);
  document.addEventListener('visibilitychange', reveil);
  window.addEventListener('hashchange', quitterSiNavigation);
  document.body.appendChild(ecran);
  reveil();
  dessiner();
}

// ---------- Page de modification ----------
function afficherEditeur(el, id, force = false) {
  // Données pas encore arrivées (ouverture directe de l'adresse) : patienter un peu
  if (!force && !db.recettes[id] && !liste('produits').length && !liste('ingredients').length) {
    el.onclick = null;
    el.innerHTML = '<p class="text-center text-brand-500 py-16"><i class="fa-solid fa-spinner fa-spin"></i> Chargement…</p>';
    setTimeout(() => { if (!el.querySelector('#page-recette-edition') && location.hash.endsWith(`${id}/modifier`)) afficherEditeur(el, id, true); }, 3000);
    return;
  }
  const reprise = repriseEnAttente; repriseEnAttente = null;
  editionAffichee = id;
  const existante = db.recettes[id];
  const libre = !db.produits[id];
  const r = JSON.parse(JSON.stringify(existante || { rendement: db.produits[id]?.tailles ? 8 : 1, tempsMin: 60, ingredients: [], materiel: [], etapes: '', titre: '' }));
  if (!r.materiel) r.materiel = [];
  if (!r.ingredients) r.ingredients = [];
  if (reprise?.extra) { r.ingredients = reprise.extra.ingredients || r.ingredients; r.materiel = reprise.extra.materiel || r.materiel; if (reprise.extra.source) r.source = reprise.extra.source; }
  if (!r.ingredients.length) r.ingredients.push({ ingredientId: '', quantite: 0 });
  const photosASupprimer = [...(reprise?.extra?.photosASupprimer || [])];
  const titre = existante ? nomRecette(id) : (db.produits[id] ? db.produits[id].titre : 'Nouvelle recette');

  const optionsIngredients = sel => `<option value="">Choisir…</option>` + liste('ingredients').sort((a, b) => a.nom.localeCompare(b.nom)).map(i => `<option value="${i.id}" ${i.id === sel ? 'selected' : ''}>${esc(i.nom)}</option>`).join('') + '<option value="__nouveau">+ Nouvel ingrédient…</option>';
  const optionsMateriel = sel => `<option value="">Choisir…</option>` + liste('materiel').sort((a, b) => a.nom.localeCompare(b.nom)).map(m => `<option value="${m.id}" ${m.id === sel ? 'selected' : ''}>${esc(m.nom)}</option>`).join('') + '<option value="__nouveau">+ Nouveau matériel…</option>';
  const section = (t, contenu, aide = '') => `<section class="space-y-3"><div><h2 class="font-display text-2xl">${t}</h2>${aide ? `<p class="text-sm text-brand-600">${aide}</p>` : ''}</div>${contenu}</section>`;

  el.onclick = null;
  el.innerHTML = `${barreHaut(`<button type="button" id="rec-annuler" class="${BTN.secondaire} flex-none">Annuler</button>`, existante ? 'Modifier la recette' : 'Nouvelle recette',
      `<button type="submit" form="form-recette" class="${BTN.principal} flex-none"><i class="fa-solid fa-check"></i> Enregistrer</button>`)}
    <div id="page-recette-edition" class="max-w-3xl mx-auto">
      <h1 class="font-display text-3xl sm:text-4xl pt-5">${esc(titre)}</h1>
      <form id="form-recette" class="space-y-10 pt-6 pb-10" novalidate>
        ${section('Présentation', `
          ${libre ? champ({ id: 'rec-titre', label: 'Nom de la recette', valeur: r.titre || '', attrs: 'required placeholder="ex. Pâte sablée"' }) : ''}
          <div class="grid grid-cols-2 gap-3">
            ${champ({ id: 'rec-rendement', label: 'Nombre de parts obtenues', type: 'number', valeur: r.rendement, attrs: 'min="1" step="1"' })}
            ${champ({ id: 'rec-temps', label: 'Temps total (min)', type: 'number', valeur: r.tempsMin || '', attrs: 'min="0" step="5"' })}
          </div>
          <div><span class="block text-xs font-semibold text-brand-700 mb-1.5">Photo du gâteau terminé</span><div id="rec-photos"></div></div>`)}

        ${section('Ingrédients', `
          <div id="rec-lignes" class="space-y-2"></div>
          <button type="button" id="rec-ajout" class="${BTN.secondaire} w-full"><i class="fa-solid fa-plus"></i> Ajouter un ingrédient</button>
          <div id="nouvel-ingredient" class="hidden bg-white rounded-2xl border-2 border-terracotta/40 p-4 space-y-3">
            <h3 class="font-semibold text-sm">Nouvel ingrédient</h3>
            ${champ({ id: 'ni-nom', label: 'Nom', attrs: 'placeholder="ex. Pistaches"' })}
            <div class="grid grid-cols-2 gap-3">${selection({ id: 'ni-unite', label: 'Unité', options: Object.entries(UNITES).map(([k, u]) => [k, u.label]) })}${champ({ id: 'ni-prix', label: 'Prix (€ / kg, L ou pièce)', type: 'number', attrs: 'min="0" step="0.01"' })}</div>
            <div class="flex gap-2"><button type="button" id="ni-annuler" class="${BTN.secondaire}">Annuler</button><button type="button" id="ni-creer" class="${BTN.sombre} flex-1">Ajouter au stock</button></div>
          </div>
          <p id="rec-cout" class="text-sm text-brand-700 bg-brand-100 rounded-xl px-3 py-2"></p>`)}

        ${section('Matériel nécessaire', `
          <div id="rec-materiel" class="space-y-2"></div>
          <button type="button" id="rec-ajout-materiel" class="${BTN.secondaire} w-full"><i class="fa-solid fa-plus"></i> Ajouter du matériel</button>
          <div id="nouveau-materiel" class="hidden bg-white rounded-2xl border-2 border-terracotta/40 p-4 space-y-3">
            <h3 class="font-semibold text-sm">Nouveau matériel</h3>
            ${champ({ id: 'nm-nom', label: 'Nom', attrs: 'placeholder="ex. Cercle à tarte 24 cm"' })}
            <div class="grid grid-cols-2 gap-3">${selection({ id: 'nm-categorie', label: 'Catégorie', options: Object.entries(CATEGORIES_MATERIEL) })}${champ({ id: 'nm-quantite', label: 'Nombre que vous avez', type: 'number', valeur: 1, attrs: 'min="0" step="1"' })}</div>
            <div class="flex gap-2"><button type="button" id="nm-annuler" class="${BTN.secondaire}">Annuler</button><button type="button" id="nm-creer" class="${BTN.sombre} flex-1">Ajouter au matériel</button></div>
          </div>`)}

        ${section('Préparation', `
          <div id="rec-blocs" class="space-y-4"></div>
          <div class="grid sm:grid-cols-2 gap-2">
            <button type="button" id="rec-ajout-etape" class="${BTN.sombre}"><i class="fa-solid fa-plus"></i> Ajouter une étape</button>
            <button type="button" id="rec-ajout-titre" class="${BTN.secondaire}"><i class="fa-solid fa-heading"></i> Ajouter un titre de partie</button>
          </div>`, 'Une carte par étape, avec ses photos juste en dessous. Un titre de partie (ex. « Pâte sablée », « Cuisson ») sépare les grandes parties de la recette.')}

        <div class="flex flex-col sm:flex-row gap-2 pt-4 border-t border-brand-200">
          ${existante ? `<button type="button" id="rec-supprimer" class="${BTN.danger}"><i class="fa-regular fa-trash-can"></i> Supprimer la recette</button>` : ''}
          <button type="submit" class="${BTN.principal} sm:ml-auto sm:min-w-[14rem] py-3"><i class="fa-solid fa-check"></i> Enregistrer la recette</button>
        </div>
      </form>
    </div>`;

  const page = $('#page-recette-edition', el);
  const photosPrincipales = editeurPhotos($('#rec-photos'), r.photos || [], reprise?.extra?.photos, { aide: 'Elle s\'affiche en haut de la recette et dans la liste.' });

  // ----- Étapes (cartes déplaçables, chacune avec ses photos) -----
  const blocs = [];
  const conteneurBlocs = $('#rec-blocs');
  const renumeroter = () => {
    let n = 0;
    blocs.forEach((b, i) => {
      if (b.type === 'etape') { n++; b.el.querySelector('[data-num]').textContent = n; b.el.querySelector('[data-libelle]').textContent = `Étape ${n}`; }
      b.el.querySelector('[data-monter]').disabled = i === 0;
      b.el.querySelector('[data-descendre]').disabled = i === blocs.length - 1;
    });
    if (!blocs.length) conteneurBlocs.innerHTML = '<p data-vide class="text-sm text-brand-500 bg-white rounded-2xl border border-dashed border-brand-300 p-4 text-center">Aucune étape pour l\'instant.</p>';
    else conteneurBlocs.querySelector('[data-vide]')?.remove();
  };
  const ajouterBloc = (b, { focus = false } = {}) => {
    const bloc = { type: b.type, el: document.createElement('div') };
    const outils = `<button type="button" data-monter class="${BTN.icone} disabled:opacity-30" aria-label="Monter"><i class="fa-solid fa-arrow-up"></i></button>
      <button type="button" data-descendre class="${BTN.icone} disabled:opacity-30" aria-label="Descendre"><i class="fa-solid fa-arrow-down"></i></button>
      <button type="button" data-retirer class="${BTN.icone} text-red-700" aria-label="Supprimer"><i class="fa-regular fa-trash-can"></i></button>`;
    if (b.type === 'titre') {
      bloc.el.className = 'flex items-center gap-2 pt-2';
      bloc.el.innerHTML = `<i class="fa-solid fa-heading text-terracotta"></i>
        <input type="text" value="${esc(b.texte || '')}" placeholder="Titre de partie, ex. Pâte sablée" aria-label="Titre de partie" class="flex-1 min-w-0 bg-transparent border-b-2 border-terracotta/40 focus:border-terracotta focus:outline-none font-display text-2xl text-terracotta py-1">${outils}`;
    } else {
      bloc.el.className = 'bg-white rounded-2xl border border-brand-200 p-4 space-y-3';
      bloc.el.innerHTML = `<div class="flex items-center gap-2"><span data-num class="w-9 h-9 rounded-full bg-terracotta text-white font-display text-lg grid place-items-center flex-none"></span>
          <span data-libelle class="font-semibold flex-1"></span>${outils}</div>
        <textarea rows="4" placeholder="Décrivez ce qu'il faut faire à cette étape…" aria-label="Texte de l'étape" class="w-full rounded-xl border border-brand-200 px-3.5 py-3 text-[16px] leading-relaxed focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 focus:outline-none">${esc(b.texte || '')}</textarea>
        <div data-photos-etape></div>`;
      const initial = b.photosEtat || null;
      bloc.editeur = editeurPhotos(bloc.el.querySelector('[data-photos-etape]'), initial ? [] : (b.photos || []), initial, { max: 4, aide: 'Photos de cette étape (pour voir le geste ou le résultat attendu).' });
    }
    bloc.champ = bloc.el.querySelector(b.type === 'titre' ? 'input' : 'textarea');
    blocs.push(bloc);
    conteneurBlocs.appendChild(bloc.el);
    renumeroter();
    if (focus) { bloc.el.scrollIntoView({ block: 'center', behavior: 'smooth' }); setTimeout(() => bloc.champ.focus(), 250); }
    return bloc;
  };
  const blocsDepart = reprise?.extra?.blocs || blocsDe(r);
  blocsDepart.forEach(b => ajouterBloc(b));
  if (!blocs.length) ajouterBloc({ type: 'etape' });

  conteneurBlocs.addEventListener('click', async e => {
    const btn = e.target.closest('[data-monter], [data-descendre], [data-retirer]'); if (!btn) return;
    const i = blocs.findIndex(b => b.el.contains(btn)); if (i < 0) return;
    if (btn.hasAttribute('data-retirer')) {
      const b = blocs[i];
      const vide = !b.champ.value.trim() && !(b.editeur && b.editeur.etat().elements.length);
      if (!vide && !await confirmer(b.type === 'titre' ? 'Supprimer ce titre de partie ?' : 'Supprimer cette étape et ses photos ?', { bouton: 'Supprimer', danger: true })) return;
      if (b.editeur) { const et = b.editeur.etat(); photosASupprimer.push(...et.elements.filter(x => x.id).map(x => x.id), ...et.retires); }
      b.el.remove(); blocs.splice(i, 1);
    } else {
      const j = btn.hasAttribute('data-monter') ? i - 1 : i + 1;
      if (j < 0 || j >= blocs.length) return;
      [blocs[i], blocs[j]] = [blocs[j], blocs[i]];
      blocs.forEach(b => conteneurBlocs.appendChild(b.el));
    }
    renumeroter(); brouillon.planifier();
  });
  $('#rec-ajout-etape').onclick = () => { ajouterBloc({ type: 'etape' }, { focus: true }); brouillon.planifier(); };
  $('#rec-ajout-titre').onclick = () => { ajouterBloc({ type: 'titre' }, { focus: true }); brouillon.planifier(); };

  // ----- Ingrédients et matériel -----
  let ligneEnAttente = null, mLigneEnAttente = null;
  const majCout = () => {
    const c = coutRecette({ ...r, rendement: Number($('#rec-rendement')?.value) || r.rendement });
    $('#rec-cout').innerHTML = `Coût total <strong class="tabular-nums">${euro(c.total)}</strong> · <strong class="tabular-nums">${euro(c.parPart)}</strong> la part`;
  };
  const dessinerLignes = () => {
    $('#rec-lignes').innerHTML = r.ingredients.map((l, i) => {
      const ing = db.ingredients[l.ingredientId];
      return `<div class="grid grid-cols-[1fr_6.5rem_2.25rem] gap-2 items-center" data-ligne="${i}">
        <select data-champ="ingredientId" class="min-w-0 rounded-lg border border-brand-200 px-2 py-2.5 text-[15px] bg-white" aria-label="Ingrédient">${optionsIngredients(l.ingredientId)}</select>
        <span class="relative"><input data-champ="quantite" type="number" min="0" step="any" inputmode="decimal" value="${l.quantite || ''}" class="w-full rounded-lg border border-brand-200 pl-2 pr-9 py-2.5 text-[15px] tabular-nums" aria-label="Quantité"><span class="absolute right-2 top-3 text-xs text-brand-500">${ing ? (ing.unite === 'piece' ? 'pc' : ing.unite) : ''}</span></span>
        <button type="button" data-suppr="${i}" class="${BTN.icone}" aria-label="Retirer"><i class="fa-regular fa-trash-can"></i></button>
        ${ing && l.quantite ? `<span class="col-span-3 -mt-1 text-[11px] text-brand-500 text-right">${euro(coutIngredient(l.ingredientId, l.quantite))}</span>` : ''}
      </div>`;
    }).join('');
    majCout();
  };
  const dessinerMateriel = () => {
    $('#rec-materiel').innerHTML = r.materiel.length ? r.materiel.map((l, i) => {
      const mt = db.materiel[l.materielId];
      const manque = mt && (Number(mt.quantite) || 0) < (Number(l.quantite) || 1);
      return `<div class="grid grid-cols-[1fr_4.5rem_2.25rem] gap-2 items-center" data-mligne="${i}">
        <select data-mchamp="materielId" class="min-w-0 rounded-lg border ${manque ? 'border-red-300' : 'border-brand-200'} px-2 py-2.5 text-[15px] bg-white" aria-label="Matériel">${optionsMateriel(l.materielId)}</select>
        <input data-mchamp="quantite" type="number" min="1" step="1" value="${l.quantite || 1}" class="w-full rounded-lg border border-brand-200 px-2 py-2.5 text-[15px] tabular-nums text-center" aria-label="Nombre nécessaire">
        <button type="button" data-msuppr="${i}" class="${BTN.icone}" aria-label="Retirer"><i class="fa-regular fa-trash-can"></i></button>
        ${manque ? `<span class="col-span-3 -mt-1 text-[11px] text-red-700">Seulement ${Number(mt.quantite) || 0} disponible(s)</span>` : ''}
      </div>`;
    }).join('') : '<p class="text-sm text-brand-500">Aucun matériel indiqué.</p>';
  };

  brouillon.demarrer({ type: 'recette', args: { id, libre }, racine: page, extra: () => ({
    ingredients: r.ingredients, materiel: r.materiel, photos: photosPrincipales.etat(), photosASupprimer, source: r.source || '',
    blocs: blocs.map(b => ({ type: b.type, texte: b.champ.value, photosEtat: b.editeur ? b.editeur.etat() : null }))
  }) });
  if (reprise) brouillon.appliquerChamps(page, reprise.champs);
  dessinerLignes();
  dessinerMateriel();

  $('#rec-materiel').addEventListener('change', e => {
    const b = e.target.closest('[data-mligne]'); if (!b) return;
    const i = +b.dataset.mligne;
    if (e.target.dataset.mchamp === 'materielId') {
      if (e.target.value === '__nouveau') { mLigneEnAttente = i; $('#nouveau-materiel').classList.remove('hidden'); $('#nm-nom').focus(); return; }
      r.materiel[i].materielId = e.target.value;
    }
    if (e.target.dataset.mchamp === 'quantite') r.materiel[i].quantite = Math.max(1, parseInt(e.target.value, 10) || 1);
    dessinerMateriel();
  });
  $('#rec-materiel').addEventListener('click', e => { const s = e.target.closest('[data-msuppr]'); if (!s) return; r.materiel.splice(+s.dataset.msuppr, 1); dessinerMateriel(); });
  $('#rec-ajout-materiel').onclick = () => { r.materiel.push({ materielId: '', quantite: 1 }); dessinerMateriel(); };
  $('#nm-annuler').onclick = () => { $('#nouveau-materiel').classList.add('hidden'); dessinerMateriel(); };
  $('#nm-creer').onclick = async () => {
    const nom = $('#nm-nom').value.trim(); if (!nom) { $('#nm-nom').focus(); return; }
    const nid = await creer('materiel', { nom, categorie: $('#nm-categorie').value, quantite: Math.max(0, parseInt($('#nm-quantite').value, 10) || 0), notes: '' });
    if (mLigneEnAttente !== null && r.materiel[mLigneEnAttente]) r.materiel[mLigneEnAttente].materielId = nid;
    $('#nouveau-materiel').classList.add('hidden'); $('#nm-nom').value = '';
    toast(`${nom} ajouté au matériel`); dessinerMateriel();
  };
  $('#rec-rendement').oninput = majCout;
  $('#rec-lignes').addEventListener('change', e => {
    const b = e.target.closest('[data-ligne]'); if (!b) return;
    const i = +b.dataset.ligne;
    if (e.target.dataset.champ === 'ingredientId') {
      if (e.target.value === '__nouveau') { ligneEnAttente = i; $('#nouvel-ingredient').classList.remove('hidden'); $('#ni-nom').focus(); return; }
      r.ingredients[i].ingredientId = e.target.value; dessinerLignes();
    }
  });
  $('#rec-lignes').addEventListener('input', e => {
    const b = e.target.closest('[data-ligne]'); if (!b || e.target.dataset.champ !== 'quantite') return;
    r.ingredients[+b.dataset.ligne].quantite = Number(e.target.value) || 0; majCout();
  });
  $('#rec-lignes').addEventListener('focusout', e => { if (e.target.dataset.champ === 'quantite') dessinerLignes(); });
  $('#rec-lignes').addEventListener('click', e => {
    const s = e.target.closest('[data-suppr]'); if (!s) return;
    r.ingredients.splice(+s.dataset.suppr, 1);
    if (!r.ingredients.length) r.ingredients.push({ ingredientId: '', quantite: 0 });
    dessinerLignes();
  });
  $('#rec-ajout').onclick = () => { r.ingredients.push({ ingredientId: '', quantite: 0 }); dessinerLignes(); };
  $('#ni-annuler').onclick = () => { $('#nouvel-ingredient').classList.add('hidden'); dessinerLignes(); };
  $('#ni-creer').onclick = async () => {
    const nom = $('#ni-nom').value.trim(); if (!nom) { $('#ni-nom').focus(); return; }
    const nid = await creer('ingredients', { nom, unite: $('#ni-unite').value, prix: Number($('#ni-prix').value) || 0, quantite: 0, seuil: 0, fournisseur: '' });
    if (ligneEnAttente !== null) r.ingredients[ligneEnAttente].ingredientId = nid;
    $('#nouvel-ingredient').classList.add('hidden'); $('#ni-nom').value = ''; $('#ni-prix').value = '';
    toast(`${nom} ajouté au stock`); dessinerLignes();
  };

  // ----- Annuler, supprimer, enregistrer -----
  $('#rec-annuler').onclick = () => { brouillon.terminer(); editionAffichee = null; location.hash = existante ? `#recettes/${id}` : '#recettes'; };
  const sup = $('#rec-supprimer');
  if (sup) sup.onclick = async () => {
    if (!await confirmer(`Supprimer la recette de « ${nomRecette(id)} » et ses photos ?`, { bouton: 'Supprimer', danger: true })) return;
    brouillon.terminer();
    const ids = [...(existante.photos || []), ...blocsDe(existante).flatMap(b => b.photos)];
    await supprimer('recettes', id);
    ids.forEach(p => supprimerPhoto(p).catch(() => {}));
    editionAffichee = null; location.hash = '#recettes'; toast('Recette supprimée');
  };
  $('#form-recette').onsubmit = async e => {
    e.preventDefault();
    if (libre && !$('#rec-titre').value.trim()) { $('#rec-titre').focus(); toast('Donnez un nom à la recette.', 'erreur'); return; }
    const boutons = $$('button[type=submit][form=form-recette], #form-recette button[type=submit]');
    const occupe = v => boutons.forEach(b => { b.disabled = v; b.classList.toggle('opacity-60', v); });
    occupe(true);
    try {
      const blocsFinal = [];
      for (const b of blocs) {
        const texte = b.champ.value.trim();
        if (b.type === 'titre') { if (texte) blocsFinal.push({ type: 'titre', texte }); continue; }
        const { photos } = await b.editeur.enregistrer();
        if (texte || photos.length) blocsFinal.push({ type: 'etape', texte, photos });
      }
      const principales = await photosPrincipales.enregistrer();
      const donnees = {
        rendement: Math.max(1, Number($('#rec-rendement').value) || 1), tempsMin: Number($('#rec-temps').value) || 0,
        ingredients: r.ingredients.filter(l => l.ingredientId && l.quantite > 0),
        materiel: r.materiel.filter(l => l.materielId).map(l => ({ materielId: l.materielId, quantite: Math.max(1, Number(l.quantite) || 1) })),
        blocs: blocsFinal,
        etapes: blocsFinal.map(b => b.type === 'titre' ? b.texte + ' :' : b.texte.replace(/\n+/g, ' ')).filter(Boolean).join('\n'),
        photos: principales.photos, miniature: principales.miniature
      };
      if (libre) donnees.titre = $('#rec-titre').value.trim();
      if (r.source) donnees.source = r.source;
      if (JSON.stringify(donnees).length > 900000) throw new Error('La recette est trop lourde à enregistrer.');
      await enregistrer('recettes', id, donnees);
      photosASupprimer.forEach(p => supprimerPhoto(p).catch(() => {}));
      brouillon.terminer();
      editionAffichee = null;
      toast('Recette enregistrée');
      location.hash = `#recettes/${id}`;
    } catch (err) { toast(err.message, 'erreur'); occupe(false); }
  };
}
