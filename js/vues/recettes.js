// Recettes : fiches cuisine, coût de revient et marge
import { liste, obtenir, enregistrer, supprimer, creer, db, lirePhoto, supprimerPhoto } from '../store.js';
import { UNITES, CATEGORIES_MATERIEL } from '../donnees.js';
import { $, $$, esc, euro, nombre, toast, ouvrirPanneau, fermerPanneau, confirmer, champ, selection, etatVide, BTN, vue } from '../ui.js';
import { coutRecette, coutIngredient, margeProduit, formaterQuantite } from '../calculs.js';
import * as brouillon from '../brouillon.js';
import { vignette, voirPhotos, editeurPhotos } from '../photos.js';

let recherche = '';

function nomRecette(id) { return db.produits[id]?.titre || db.recettes[id]?.titre || 'Recette'; }

export default {
  render(el, { param, changementDeRoute }) {
    const produits = liste('produits').sort((a, b) => (a.ordre || 99) - (b.ordre || 99));
    const libres = liste('recettes').filter(r => !db.produits[r.id]);
    const elements = [
      ...produits.map(p => ({ id: p.id, titre: p.titre, image: db.recettes[p.id]?.miniature || p.image, recette: db.recettes[p.id] || null, produit: true })),
      ...libres.map(r => ({ id: r.id, titre: r.titre || 'Recette', image: r.miniature || '', recette: r, produit: false }))
    ].filter(x => !recherche || x.titre.toLowerCase().includes(recherche.toLowerCase()));
    const avec = elements.filter(x => x.recette && (x.recette.ingredients || []).length).length;

    vue(el).innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-3 mb-2">
        <h1 class="hidden lg:block font-display text-3xl">Recettes</h1>
        <button type="button" data-r="libre" class="${BTN.secondaire} w-full sm:w-auto"><i class="fa-solid fa-plus"></i> Recette de base (pâte, crème…)</button>
      </div>
      <p class="text-sm text-brand-600 mb-4">${avec} recette${avec > 1 ? 's' : ''} renseignée${avec > 1 ? 's' : ''}. Avec les recettes, le coût de revient, la marge et les besoins en ingrédients sont calculés tout seuls.</p>
      <label class="relative block mb-5 sm:w-72"><span class="sr-only">Rechercher</span><i class="fa-solid fa-magnifying-glass absolute left-3.5 top-3 text-brand-400 text-sm"></i>
        <input id="recherche-recettes" type="search" value="${esc(recherche)}" placeholder="Rechercher une recette" class="w-full rounded-full border border-brand-200 bg-white pl-10 pr-4 py-2 text-sm focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 focus:outline-none"></label>
      ${elements.length ? `<div class="grid gap-3 md:grid-cols-2">${elements.map(x => {
        const r = x.recette, ok = r && (r.ingredients || []).length;
        const cout = ok ? coutRecette(r) : null, m = x.produit && ok ? margeProduit(x.id) : null;
        return `<button type="button" data-ouvrir="${x.id}" class="min-w-0 text-left bg-white rounded-2xl border ${ok ? 'border-brand-200' : 'border-dashed border-brand-300'} p-3 flex gap-3 items-center hover:shadow-md transition-shadow">
          <span class="w-16 h-16 rounded-xl bg-brand-100 overflow-hidden flex-none grid place-items-center text-brand-300 text-xl">${x.image ? `<img src="${esc(x.image)}" alt="" loading="lazy" class="w-full h-full object-cover">` : '<i class="fa-solid fa-book-open"></i>'}</span>
          <span class="min-w-0 flex-1">
            <span class="block font-semibold truncate">${esc(x.titre)}</span>
            ${ok ? `<span class="block text-xs text-brand-600 mt-0.5">${r.rendement} parts · ${r.ingredients.length} ingrédient${r.ingredients.length > 1 ? 's' : ''}${r.tempsMin ? ` · ${Math.floor(r.tempsMin / 60) ? Math.floor(r.tempsMin / 60) + ' h ' : ''}${r.tempsMin % 60 ? (r.tempsMin % 60) + ' min' : ''}` : ''}</span>
              <span class="block text-xs mt-1"><strong class="tabular-nums">${euro(cout.parPart)}</strong> la part${m ? ` · marge <strong class="${m.taux >= 0.6 ? 'text-emerald-700' : m.taux >= 0.4 ? 'text-amber-700' : 'text-red-700'}">${Math.round(m.taux * 100)} %</strong>` : ''}</span>`
            : `<span class="block text-xs text-terracotta font-semibold mt-1"><i class="fa-solid fa-plus"></i> Ajouter la recette</span>`}
          </span>
          <i class="fa-solid fa-chevron-right text-brand-300 text-sm"></i></button>`;
      }).join('')}</div>` : etatVide({ icone: 'fa-solid fa-book-open', titre: 'Aucune recette', texte: 'Ajoutez d\'abord des gâteaux dans « Produits », puis leurs recettes ici.' })}`;

    el.onclick = e => {
      const o = e.target.closest('[data-ouvrir]'); if (o) { ouvrirRecette(o.dataset.ouvrir); return; }
      if (e.target.closest('[data-r="libre"]')) editerRecette('r-' + Math.random().toString(36).slice(2, 9), true);
    };
    $('#recherche-recettes', el).oninput = e => { recherche = e.target.value; this.render(el, {}); };
    if (changementDeRoute && param) ouvrirRecette(param);
  }
};

// ---------- Lecture des étapes ----------
// Une ligne par étape ; une ligne qui finit par « : » devient un titre de partie.
function analyserEtapes(texte) {
  let n = 0;
  return String(texte || '').split('\n').map(s => s.trim()).filter(Boolean).map(s => {
    const t = s.replace(/^\s*(\d+[\.\)]|[-•*])\s*/, '');
    if (/:\s*$/.test(t) && t.length <= 60) return { titre: t.replace(/\s*:\s*$/, '') };
    return { n: ++n, texte: t };
  });
}
const sansAccents = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

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

function dureeTexte(min) {
  min = Number(min) || 0; if (!min) return '';
  const h = Math.floor(min / 60), m = min % 60;
  return h ? `${h} h${m ? ' ' + String(m).padStart(2, '0') : ''}` : `${m} min`;
}

// Fiche cuisine (lecture), grande et lisible, avec calcul pour un autre nombre de parts
export function ouvrirRecette(id) {
  const r = db.recettes[id];
  if (!r || !(r.ingredients || []).length) { editerRecette(id, !db.produits[id]); return; }
  const rendement = Number(r.rendement) || 1;
  let parts = rendement;
  const coches = new Set();      // ingrédients déjà préparés
  const faites = new Set();      // étapes terminées
  const etapes = analyserEtapes(r.etapes);
  const nbEtapes = etapes.filter(e => e.n).length;
  const m = db.produits[id] ? margeProduit(id) : null;
  const photos = (r.photos || []).filter(Boolean);
  const imageProduit = db.produits[id]?.image || '';
  const quantite = l => (Number(l.quantite) || 0) * parts / rendement;
  const puce = l => { const ing = db.ingredients[l.ingredientId]; return `<span class="inline-flex items-center gap-1.5 rounded-full bg-brand-100 text-brand-800 px-3 py-1 text-sm"><strong class="tabular-nums">${formaterQuantite(quantite(l), ing?.unite)}</strong> ${esc(ing?.nom || '')}</span>`; };

  const materiel = (r.materiel || []).map(l => { const mt = db.materiel[l.materielId]; return { nom: mt?.nom || 'Matériel supprimé', besoin: Number(l.quantite) || 1, dispo: Number(mt?.quantite) || 0, mt }; });
  const materielOk = materiel.every(l => l.dispo >= l.besoin);

  const dessinerIngredients = () => {
    let manque = 0;
    $('#fiche-ingredients').innerHTML = r.ingredients.map((l, i) => {
      const ing = db.ingredients[l.ingredientId];
      const q = quantite(l), insuffisant = ing && q > (Number(ing.quantite) || 0), fait = coches.has(i);
      if (insuffisant) manque++;
      return `<li><button type="button" data-cocher="${i}" aria-pressed="${fait}" class="w-full flex items-center gap-3 py-3 text-left ${fait ? 'opacity-45' : ''}">
        <span class="w-7 h-7 rounded-full border-2 flex-none grid place-items-center ${fait ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-brand-300'}">${fait ? '<i class="fa-solid fa-check text-xs"></i>' : ''}</span>
        ${ing?.miniature ? `<img src="${ing.miniature}" alt="" class="w-11 h-11 rounded-xl object-cover flex-none">` : ''}
        <span class="flex-1 min-w-0 text-[17px] leading-snug ${fait ? 'line-through' : ''}">${esc(ing?.nom || 'Ingrédient supprimé')}${insuffisant ? `<span class="block text-xs text-red-700 font-semibold mt-0.5"><i class="fa-solid fa-triangle-exclamation"></i> Stock : ${formaterQuantite(ing.quantite, ing.unite)}</span>` : ''}</span>
        <span class="font-display text-xl tabular-nums whitespace-nowrap ${insuffisant ? 'text-red-700' : 'text-brand-950'}">${formaterQuantite(q, ing?.unite)}</span></button></li>`;
    }).join('');
    $('#fiche-stock').innerHTML = manque ? `<span class="text-red-700"><i class="fa-solid fa-triangle-exclamation"></i> ${manque} ingrédient${manque > 1 ? 's' : ''} à racheter</span>` : '<span class="text-emerald-700"><i class="fa-solid fa-circle-check"></i> Tout est en stock</span>';
    $('#fiche-cout').textContent = euro(coutRecette(r).parPart * parts);
    $('#fiche-parts-titre').textContent = `pour ${parts} part${parts > 1 ? 's' : ''}`;
  };
  const dessinerEtapes = () => {
    $('#fiche-etapes').innerHTML = etapes.map(e => e.titre
      ? `<li class="pt-3"><h4 class="font-display text-xl text-terracotta">${esc(e.titre)}</h4></li>`
      : (() => { const fait = faites.has(e.n), cites = ingredientsCites(e.texte, r.ingredients);
        return `<li><button type="button" data-etape="${e.n}" aria-pressed="${fait}" class="w-full text-left flex gap-4 bg-white rounded-2xl border border-brand-200 p-4 ${fait ? 'opacity-50' : ''}">
          <span class="w-10 h-10 rounded-full ${fait ? 'bg-emerald-600' : 'bg-terracotta'} text-white font-display text-lg grid place-items-center flex-none">${fait ? '<i class="fa-solid fa-check text-base"></i>' : e.n}</span>
          <span class="flex-1 min-w-0"><span class="block text-[17px] leading-relaxed text-brand-950 ${fait ? 'line-through' : ''}">${esc(e.texte)}</span>
          ${cites.length ? `<span class="flex flex-wrap gap-1.5 mt-2.5">${cites.map(puce).join('')}</span>` : ''}</span></button></li>`; })()).join('');
  };

  ouvrirPanneau({
    titre: nomRecette(id),
    large: true,
    contenu: `<div class="space-y-6 -mx-5 -mt-5">
      ${photos.length || imageProduit ? `<div>
        <button type="button" id="fiche-photo" class="block w-full aspect-[4/3] sm:aspect-[16/9] bg-brand-100 overflow-hidden relative" ${photos.length ? '' : 'disabled'} aria-label="Agrandir la photo">
          <img id="fiche-photo-img" src="${esc(r.miniature || imageProduit)}" alt="" class="w-full h-full object-cover">
          ${photos.length > 1 ? `<span class="absolute bottom-3 right-3 bg-brand-950/80 text-white text-xs font-semibold px-2.5 py-1 rounded-full"><i class="fa-regular fa-images"></i> ${photos.length} photos</span>` : ''}
        </button>
        ${photos.length > 1 ? `<div id="fiche-galerie" class="flex gap-2 overflow-x-auto px-5 pt-3">${photos.map((p, i) => `<button type="button" data-photo="${i}" class="w-16 h-16 flex-none rounded-xl overflow-hidden bg-brand-100 ring-1 ring-brand-200" aria-label="Photo ${i + 1}"><img alt="" class="w-full h-full object-cover"></button>`).join('')}</div>` : ''}
      </div>` : ''}
      <div class="px-5 space-y-6 ${photos.length || imageProduit ? '' : 'pt-5'}">
        <div class="grid grid-cols-3 gap-2 text-center">
          <div class="bg-white rounded-2xl border border-brand-200 py-3"><i class="fa-regular fa-clock text-terracotta"></i><div class="font-semibold mt-1">${dureeTexte(r.tempsMin) || '—'}</div><div class="text-[11px] text-brand-500">temps total</div></div>
          <div class="bg-white rounded-2xl border border-brand-200 py-3"><i class="fa-solid fa-list-ol text-terracotta"></i><div class="font-semibold mt-1">${nbEtapes || '—'}</div><div class="text-[11px] text-brand-500">étape${nbEtapes > 1 ? 's' : ''}</div></div>
          <div class="bg-white rounded-2xl border border-brand-200 py-3"><i class="fa-solid fa-coins text-terracotta"></i><div id="fiche-cout" class="font-semibold mt-1 tabular-nums"></div><div class="text-[11px] text-brand-500">d'ingrédients</div></div>
        </div>

        <div class="bg-white rounded-2xl border border-brand-200 p-3 flex items-center justify-between gap-3">
          <span class="font-semibold pl-1">Nombre de parts</span>
          <div class="flex items-center gap-1 bg-brand-50 rounded-xl border border-brand-200">
            <button type="button" id="parts-moins" class="w-12 h-12 text-xl font-bold" aria-label="Moins de parts">−</button>
            <input id="parts-fiche" type="number" min="1" value="${parts}" class="w-14 text-center bg-transparent font-display text-2xl tabular-nums" aria-label="Nombre de parts">
            <button type="button" id="parts-plus" class="w-12 h-12 text-xl font-bold" aria-label="Plus de parts">+</button>
          </div>
        </div>

        ${nbEtapes ? `<button type="button" id="fiche-pas-a-pas" class="${BTN.principal} w-full py-4 text-base"><i class="fa-solid fa-play"></i> Cuisiner pas à pas</button>` : ''}

        <section>
          <div class="flex items-end justify-between gap-3 mb-1">
            <h3 class="font-display text-2xl">Ingrédients <span id="fiche-parts-titre" class="text-base text-brand-500 font-sans"></span></h3>
          </div>
          <p id="fiche-stock" class="text-sm font-semibold mb-1"></p>
          <p class="text-xs text-brand-500 mb-1">Touchez un ingrédient pour le cocher quand il est pesé.</p>
          <ul id="fiche-ingredients" class="bg-white rounded-2xl border border-brand-200 px-4 divide-y divide-brand-100"></ul>
        </section>

        ${materiel.length ? `<section>
          <h3 class="font-display text-2xl mb-1">Matériel</h3>
          <p class="text-sm font-semibold mb-2 ${materielOk ? 'text-emerald-700' : 'text-red-700'}">${materielOk ? '<i class="fa-solid fa-circle-check"></i> Tout est disponible' : '<i class="fa-solid fa-triangle-exclamation"></i> Il manque du matériel'}</p>
          <ul class="bg-white rounded-2xl border ${materielOk ? 'border-brand-200' : 'border-red-300'} px-4 divide-y divide-brand-100">${materiel.map(l => `<li class="flex items-center gap-3 py-3">
            ${l.mt?.miniature ? vignette({ ...l.mt }, 'w-11 h-11') : `<span class="w-11 h-11 rounded-xl bg-brand-100 grid place-items-center text-brand-400 flex-none"><i class="fa-solid fa-whisk"></i></span>`}
            <span class="flex-1 min-w-0 text-[17px]">${esc(l.nom)}${l.besoin > 1 ? ` <span class="text-brand-500">× ${l.besoin}</span>` : ''}</span>
            <span class="text-sm font-semibold whitespace-nowrap ${l.dispo >= l.besoin ? 'text-emerald-700' : 'text-red-700'}"><i class="fa-solid ${l.dispo >= l.besoin ? 'fa-check' : 'fa-xmark'}"></i> ${l.dispo} dispo.</span></li>`).join('')}</ul>
        </section>` : ''}

        ${nbEtapes ? `<section>
          <h3 class="font-display text-2xl mb-1">Préparation</h3>
          <p class="text-xs text-brand-500 mb-3">Touchez une étape pour la marquer comme faite.</p>
          <ol id="fiche-etapes" class="space-y-3"></ol>
        </section>` : `<p class="text-sm text-brand-500 bg-white rounded-2xl border border-dashed border-brand-300 p-4">Aucune étape écrite pour l'instant. Touchez « Modifier la recette » pour les ajouter.</p>`}

        ${m ? `<section class="pb-2">
          <h3 class="text-xs font-bold uppercase tracking-wider text-brand-500 mb-2">Coût et marge (${m.parts} parts)</h3>
          <div class="grid grid-cols-3 gap-2 text-center">
            <div class="bg-white rounded-xl border border-brand-200 p-3"><div class="text-[11px] text-brand-500">Coût</div><div class="font-semibold tabular-nums">${euro(m.cout)}</div></div>
            <div class="bg-white rounded-xl border border-brand-200 p-3"><div class="text-[11px] text-brand-500">Prix de vente</div><div class="font-semibold tabular-nums">${euro(m.prix)}</div></div>
            <div class="rounded-xl p-3 ${m.taux >= 0.6 ? 'bg-emerald-50 text-emerald-800' : m.taux >= 0.4 ? 'bg-amber-50 text-amber-800' : 'bg-red-50 text-red-800'}"><div class="text-[11px]">Marge</div><div class="font-semibold tabular-nums">${Math.round(m.taux * 100)} %</div></div>
          </div></section>` : ''}
      </div>
    </div>`,
    pied: `<button type="button" id="fiche-modifier" class="${BTN.sombre} w-full"><i class="fa-solid fa-pen"></i> Modifier la recette</button>`,
    onOuvert: (corps, pied) => {
      dessinerIngredients();
      if (nbEtapes) dessinerEtapes();
      const maj = n => { parts = Math.max(1, n || 1); $('#parts-fiche').value = parts; dessinerIngredients(); if (nbEtapes) dessinerEtapes(); };
      $('#parts-moins').onclick = () => maj(parts - 1);
      $('#parts-plus').onclick = () => maj(parts + 1);
      $('#parts-fiche').oninput = e => { const n = parseInt(e.target.value, 10); if (n > 0) { parts = n; dessinerIngredients(); if (nbEtapes) dessinerEtapes(); } };
      $('#fiche-ingredients').onclick = e => { const b = e.target.closest('[data-cocher]'); if (!b) return; const i = +b.dataset.cocher; coches.has(i) ? coches.delete(i) : coches.add(i); dessinerIngredients(); };
      if (nbEtapes) $('#fiche-etapes').onclick = e => { const b = e.target.closest('[data-etape]'); if (!b) return; const n = +b.dataset.etape; faites.has(n) ? faites.delete(n) : faites.add(n); dessinerEtapes(); };
      // Photos : grande photo, puis les autres en miniature
      if (photos.length) {
        lirePhoto(photos[0]).then(d => { if (d && $('#fiche-photo-img')) $('#fiche-photo-img').src = d; }).catch(() => {});
        $('#fiche-photo').onclick = () => voirPhotos(photos, nomRecette(id), 0);
        $$('#fiche-galerie [data-photo]').forEach(b => {
          lirePhoto(photos[+b.dataset.photo]).then(d => { if (d) b.querySelector('img').src = d; }).catch(() => {});
          b.onclick = () => voirPhotos(photos, nomRecette(id), +b.dataset.photo);
        });
      }
      const pas = $('#fiche-pas-a-pas');
      if (pas) pas.onclick = () => cuisinerPasAPas({ titre: nomRecette(id), r, etapes, parts, rendement, faites, apres: dessinerEtapes });
      $('#fiche-modifier', pied).onclick = () => editerRecette(id, !db.produits[id]);
    }
  });
}

// ---------- Mode « pas à pas » : une étape à la fois, en grand ----------
// L'écran reste allumé pendant la préparation (si le téléphone le permet).
function cuisinerPasAPas({ titre, r, etapes, parts, rendement, faites, apres }) {
  const liste = [{ prep: true }];
  let partie = '';
  etapes.forEach(e => { if (e.titre) partie = e.titre; else liste.push({ ...e, partie }); });
  let i = 0, verrou = null;
  const quantite = l => (Number(l.quantite) || 0) * parts / rendement;
  const ecran = document.createElement('div');
  ecran.className = 'fixed inset-0 z-[55] bg-brand-50 flex flex-col';
  ecran.setAttribute('role', 'dialog'); ecran.setAttribute('aria-modal', 'true'); ecran.setAttribute('aria-label', 'Recette pas à pas');
  ecran.innerHTML = `
    <div class="flex-none bg-white border-b border-brand-200" style="padding-top:env(safe-area-inset-top,0px)">
      <div class="flex items-center gap-3 px-4 h-14"><span class="flex-1 min-w-0 truncate font-display text-lg">${esc(titre)}</span>
        <button type="button" data-pas="fermer" class="w-11 h-11 grid place-items-center rounded-xl hover:bg-brand-100" aria-label="Quitter le pas à pas"><i class="fa-solid fa-xmark text-xl"></i></button></div>
      <div class="h-1.5 bg-brand-100"><div id="pas-barre" class="h-full bg-terracotta transition-all"></div></div>
    </div>
    <div id="pas-contenu" class="flex-1 overflow-y-auto px-5 py-6 max-w-2xl w-full mx-auto"></div>
    <div class="flex-none bg-white border-t border-brand-200 px-4 py-3 flex gap-3 max-w-2xl w-full mx-auto" style="padding-bottom:calc(.75rem + env(safe-area-inset-bottom,0px))">
      <button type="button" data-pas="prec" class="${BTN.secondaire} flex-1 py-4 text-base"><i class="fa-solid fa-arrow-left"></i> Précédente</button>
      <button type="button" data-pas="suiv" class="${BTN.principal} flex-[2] py-4 text-base"></button>
    </div>`;
  const dessiner = () => {
    const e = liste[i], total = liste.length - 1;
    ecran.querySelector('#pas-barre').style.width = `${(i / total) * 100}%`;
    ecran.querySelector('#pas-contenu').innerHTML = e.prep
      ? `<p class="text-sm font-bold uppercase tracking-wider text-terracotta">Avant de commencer</p>
         <h2 class="font-display text-3xl mt-1 mb-5">Sortez les ingrédients <span class="text-brand-500 text-xl">· ${parts} part${parts > 1 ? 's' : ''}</span></h2>
         <ul class="bg-white rounded-2xl border border-brand-200 px-4 divide-y divide-brand-100">${r.ingredients.map(l => { const ing = db.ingredients[l.ingredientId]; return `<li class="flex items-center justify-between gap-3 py-3.5"><span class="text-xl">${esc(ing?.nom || 'Ingrédient supprimé')}</span><span class="font-display text-2xl tabular-nums whitespace-nowrap">${formaterQuantite(quantite(l), ing?.unite)}</span></li>`; }).join('')}</ul>`
      : `<p class="text-sm font-bold uppercase tracking-wider text-terracotta">Étape ${e.n} sur ${total}${e.partie ? ` · ${esc(e.partie)}` : ''}</p>
         <p class="text-[26px] leading-snug text-brand-950 mt-4">${esc(e.texte)}</p>
         ${(() => { const c = ingredientsCites(e.texte, r.ingredients); return c.length ? `<div class="mt-6 space-y-2">${c.map(l => { const ing = db.ingredients[l.ingredientId]; return `<div class="flex items-center justify-between gap-3 bg-white rounded-2xl border border-brand-200 px-4 py-3"><span class="text-lg">${esc(ing?.nom || '')}</span><span class="font-display text-2xl tabular-nums">${formaterQuantite(quantite(l), ing?.unite)}</span></div>`; }).join('')}</div>` : ''; })()}`;
    ecran.querySelector('#pas-contenu').scrollTop = 0;
    ecran.querySelector('[data-pas="prec"]').disabled = i === 0;
    ecran.querySelector('[data-pas="prec"]').classList.toggle('opacity-40', i === 0);
    ecran.querySelector('[data-pas="suiv"]').innerHTML = i === 0 ? 'C\'est parti <i class="fa-solid fa-arrow-right"></i>' : i === total ? '<i class="fa-solid fa-check"></i> Terminé' : 'Suivante <i class="fa-solid fa-arrow-right"></i>';
  };
  const aller = d => {
    if (d > 0 && liste[i].n) faites.add(liste[i].n);
    if (d > 0 && i === liste.length - 1) { fermer(); toast('Bonne dégustation !'); return; }
    i = Math.min(Math.max(0, i + d), liste.length - 1); dessiner();
  };
  const clavier = e => {
    if (e.key === 'Escape') { e.stopPropagation(); fermer(); }
    if (e.key === 'ArrowRight') aller(1);
    if (e.key === 'ArrowLeft') aller(-1);
  };
  const reveil = () => { if (document.visibilityState === 'visible' && 'wakeLock' in navigator) navigator.wakeLock.request('screen').then(v => verrou = v).catch(() => {}); };
  function fermer() {
    document.removeEventListener('keydown', clavier, true);
    document.removeEventListener('visibilitychange', reveil);
    try { verrou?.release(); } catch (e) {}
    ecran.remove(); apres();
  }
  ecran.addEventListener('click', e => {
    const b = e.target.closest('[data-pas]'); if (!b) return;
    if (b.dataset.pas === 'fermer') fermer(); else aller(b.dataset.pas === 'suiv' ? 1 : -1);
  });
  // Glisser vers la gauche ou la droite pour changer d'étape
  let x0 = null;
  ecran.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
  ecran.addEventListener('touchend', e => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 70) aller(dx < 0 ? 1 : -1); });
  document.addEventListener('keydown', clavier, true);
  document.addEventListener('visibilitychange', reveil);
  document.body.appendChild(ecran);
  reveil();
  dessiner();
}

// Édition d'une recette
export function editerRecette(id, libre = false, reprise = null) {
  const existante = db.recettes[id];
  const r = JSON.parse(JSON.stringify(existante || { rendement: db.produits[id]?.tailles ? 8 : 1, tempsMin: 60, ingredients: [], materiel: [], etapes: '', titre: '' }));
  if (!r.materiel) r.materiel = [];
  if (reprise?.extra) { r.ingredients = reprise.extra.ingredients || r.ingredients; r.materiel = reprise.extra.materiel || r.materiel; }
  if (!r.ingredients.length) r.ingredients.push({ ingredientId: '', quantite: 0 });

  const optionsIngredients = sel => `<option value="">Choisir…</option>` + liste('ingredients').sort((a, b) => a.nom.localeCompare(b.nom)).map(i => `<option value="${i.id}" ${i.id === sel ? 'selected' : ''}>${esc(i.nom)}</option>`).join('') + '<option value="__nouveau">+ Nouvel ingrédient…</option>';

  const optionsMateriel = sel => `<option value="">Choisir…</option>` + liste('materiel').sort((a, b) => a.nom.localeCompare(b.nom)).map(m => `<option value="${m.id}" ${m.id === sel ? 'selected' : ''}>${esc(m.nom)}</option>`).join('') + '<option value="__nouveau">+ Nouveau matériel…</option>';
  const dessinerMateriel = () => {
    $('#rec-materiel').innerHTML = r.materiel.length ? r.materiel.map((l, i) => {
      const mt = db.materiel[l.materielId];
      const manque = mt && (Number(mt.quantite) || 0) < (Number(l.quantite) || 1);
      return `<div class="grid grid-cols-[1fr_4.5rem_2.25rem] gap-2 items-center" data-mligne="${i}">
        <select data-mchamp="materielId" class="min-w-0 rounded-lg border ${manque ? 'border-red-300' : 'border-brand-200'} px-2 py-2 text-sm bg-white" aria-label="Matériel">${optionsMateriel(l.materielId)}</select>
        <input data-mchamp="quantite" type="number" min="1" step="1" value="${l.quantite || 1}" class="w-full rounded-lg border border-brand-200 px-2 py-2 text-sm tabular-nums text-center" aria-label="Nombre nécessaire">
        <button type="button" data-msuppr="${i}" class="${BTN.icone}" aria-label="Retirer"><i class="fa-regular fa-trash-can"></i></button>
        ${manque ? `<span class="col-span-3 -mt-1 text-[11px] text-red-700">Seulement ${Number(mt.quantite) || 0} disponible(s)</span>` : ''}
      </div>`;
    }).join('') : '<p class="text-sm text-brand-500">Aucun matériel indiqué.</p>';
  };
  const dessinerLignes = () => {
    $('#rec-lignes').innerHTML = r.ingredients.map((l, i) => {
      const ing = db.ingredients[l.ingredientId];
      return `<div class="grid grid-cols-[1fr_6.5rem_2.25rem] gap-2 items-center" data-ligne="${i}">
        <select data-champ="ingredientId" class="min-w-0 rounded-lg border border-brand-200 px-2 py-2 text-sm bg-white" aria-label="Ingrédient">${optionsIngredients(l.ingredientId)}</select>
        <span class="relative"><input data-champ="quantite" type="number" min="0" step="any" value="${l.quantite || ''}" class="w-full rounded-lg border border-brand-200 pl-2 pr-9 py-2 text-sm tabular-nums" aria-label="Quantité"><span class="absolute right-2 top-2 text-xs text-brand-500">${ing ? (ing.unite === 'piece' ? 'pc' : ing.unite) : ''}</span></span>
        <button type="button" data-suppr="${i}" class="${BTN.icone}" aria-label="Retirer"><i class="fa-regular fa-trash-can"></i></button>
        ${ing && l.quantite ? `<span class="col-span-3 -mt-1 text-[11px] text-brand-500 text-right">${euro(coutIngredient(l.ingredientId, l.quantite))}</span>` : ''}
      </div>`;
    }).join('');
    majCout();
  };
  const majCout = () => {
    const c = coutRecette({ ...r, rendement: Number($('#rec-rendement')?.value) || r.rendement });
    $('#rec-cout').innerHTML = `Coût total <strong class="tabular-nums">${euro(c.total)}</strong> · <strong class="tabular-nums">${euro(c.parPart)}</strong> la part`;
  };

  ouvrirPanneau({
    titre: existante ? `Recette · ${nomRecette(id)}` : `Nouvelle recette${db.produits[id] ? ' · ' + db.produits[id].titre : ''}`,
    contenu: `<form id="form-recette" class="space-y-5" novalidate>
      ${libre ? champ({ id: 'rec-titre', label: 'Nom de la recette', valeur: r.titre || '', attrs: 'required placeholder="ex. Pâte sablée"' }) : ''}
      <div class="grid grid-cols-2 gap-3">
        ${champ({ id: 'rec-rendement', label: 'Nombre de parts obtenues', type: 'number', valeur: r.rendement, attrs: 'min="1" step="1"' })}
        ${champ({ id: 'rec-temps', label: 'Temps total (min)', type: 'number', valeur: r.tempsMin || '', attrs: 'min="0" step="5"' })}
      </div>
      <div><span class="block text-xs font-semibold text-brand-700 mb-1.5">Photos de la recette</span><div id="rec-photos"></div></div>
      <section class="space-y-2">
        <h3 class="text-xs font-bold uppercase tracking-wider text-brand-500">Ingrédients</h3>
        <div id="rec-lignes" class="space-y-2"></div>
        <button type="button" id="rec-ajout" class="${BTN.secondaire} w-full"><i class="fa-solid fa-plus"></i> Ajouter un ingrédient</button>
        <p id="rec-cout" class="text-sm text-brand-700 bg-brand-100 rounded-xl px-3 py-2"></p>
      </section>
      <section class="space-y-2">
        <h3 class="text-xs font-bold uppercase tracking-wider text-brand-500">Matériel nécessaire</h3>
        <div id="rec-materiel" class="space-y-2"></div>
        <button type="button" id="rec-ajout-materiel" class="${BTN.secondaire} w-full"><i class="fa-solid fa-plus"></i> Ajouter du matériel</button>
      </section>
      <div id="nouveau-materiel" class="hidden bg-white rounded-2xl border-2 border-terracotta/40 p-4 space-y-3">
        <h3 class="font-semibold text-sm">Nouveau matériel</h3>
        ${champ({ id: 'nm-nom', label: 'Nom', attrs: 'placeholder="ex. Cercle à tarte 24 cm"' })}
        <div class="grid grid-cols-2 gap-3">${selection({ id: 'nm-categorie', label: 'Catégorie', options: Object.entries(CATEGORIES_MATERIEL) })}${champ({ id: 'nm-quantite', label: 'Nombre que vous avez', type: 'number', valeur: 1, attrs: 'min="0" step="1"' })}</div>
        <div class="flex gap-2"><button type="button" id="nm-annuler" class="${BTN.secondaire}">Annuler</button><button type="button" id="nm-creer" class="${BTN.sombre} flex-1">Ajouter au matériel</button></div>
      </div>
      <div id="nouvel-ingredient" class="hidden bg-white rounded-2xl border-2 border-terracotta/40 p-4 space-y-3">
        <h3 class="font-semibold text-sm">Nouvel ingrédient</h3>
        ${champ({ id: 'ni-nom', label: 'Nom', attrs: 'placeholder="ex. Pistaches"' })}
        <div class="grid grid-cols-2 gap-3">${selection({ id: 'ni-unite', label: 'Unité', options: Object.entries(UNITES).map(([k, u]) => [k, u.label]) })}${champ({ id: 'ni-prix', label: 'Prix (€ / kg, L ou pièce)', type: 'number', attrs: 'min="0" step="0.01"' })}</div>
        <div class="flex gap-2"><button type="button" id="ni-annuler" class="${BTN.secondaire}">Annuler</button><button type="button" id="ni-creer" class="${BTN.sombre} flex-1">Ajouter au stock</button></div>
      </div>
      ${champ({ id: 'rec-etapes', label: 'Étapes', type: 'textarea', valeur: r.etapes || '', attrs: 'rows="8" placeholder="Pâte sablée :\nSabler le beurre avec la farine.\nAjouter le sucre glace et l\'œuf.\nCuisson :\nCuire 20 min à 170 °C."', aide: 'Une étape par ligne. Une ligne qui finit par « : » devient le titre d\'une partie (ex. « Pâte sablée : »). Les ingrédients cités sont affichés avec leur quantité dans la fiche.' })}
    </form>`,
    pied: `<div class="flex gap-2">${existante ? `<button type="button" id="rec-supprimer" class="${BTN.danger}" aria-label="Supprimer la recette"><i class="fa-regular fa-trash-can"></i></button>` : ''}<button type="button" data-action="fermer-panneau" class="${BTN.secondaire}">Annuler</button><button type="submit" form="form-recette" class="${BTN.principal} flex-1">Enregistrer</button></div>`,
    onOuvert: (corps, pied) => {
      let ligneEnAttente = null, mLigneEnAttente = null;
      const photos = editeurPhotos($('#rec-photos'), r.photos || [], reprise?.extra?.photos);
      brouillon.demarrer({ type: 'recette', args: { id, libre }, racine: corps, extra: () => ({ ingredients: r.ingredients, materiel: r.materiel, photos: photos.etat() }) });
      if (reprise) brouillon.appliquerChamps(corps, reprise.champs);
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
      const sup = $('#rec-supprimer', pied);
      if (sup) sup.onclick = async () => {
        if (await confirmer(`Supprimer la recette de « ${nomRecette(id)} » ?`, { bouton: 'Supprimer', danger: true })) { brouillon.terminer(); const ph = db.recettes[id]?.photos || []; await supprimer('recettes', id); ph.forEach(p => supprimerPhoto(p).catch(() => {})); fermerPanneau(); toast('Recette supprimée'); }
      };
      $('#form-recette').onsubmit = async e => {
        e.preventDefault();
        if (libre && !$('#rec-titre').value.trim()) { $('#rec-titre').focus(); return; }
        const donnees = {
          rendement: Math.max(1, Number($('#rec-rendement').value) || 1), tempsMin: Number($('#rec-temps').value) || 0,
          ingredients: r.ingredients.filter(l => l.ingredientId && l.quantite > 0),
          materiel: r.materiel.filter(l => l.materielId).map(l => ({ materielId: l.materielId, quantite: Math.max(1, Number(l.quantite) || 1) })),
          etapes: $('#rec-etapes').value.trim()
        };
        if (libre) donnees.titre = $('#rec-titre').value.trim();
        const bouton = pied.querySelector('button[type=submit]'); bouton.disabled = true; bouton.textContent = 'Enregistrement…';
        try { Object.assign(donnees, await photos.enregistrer()); } catch (err) { toast(err.message, 'erreur'); bouton.disabled = false; bouton.textContent = 'Enregistrer'; return; }
        await enregistrer('recettes', id, donnees);
        toast('Recette enregistrée');
        brouillon.terminer();
        ouvrirRecette(id);
      };
    }
  });
}
