// Recettes : fiches cuisine, coût de revient et marge
import { liste, obtenir, enregistrer, supprimer, creer, db } from '../store.js';
import { UNITES, CATEGORIES_MATERIEL } from '../donnees.js';
import { $, $$, esc, euro, nombre, toast, ouvrirPanneau, fermerPanneau, confirmer, champ, selection, etatVide, BTN } from '../ui.js';
import { coutRecette, coutIngredient, margeProduit, formaterQuantite } from '../calculs.js';
import * as brouillon from '../brouillon.js';
import { vignette } from '../photos.js';

let recherche = '';

function nomRecette(id) { return db.produits[id]?.titre || db.recettes[id]?.titre || 'Recette'; }

export default {
  render(el, { param, changementDeRoute }) {
    const produits = liste('produits').sort((a, b) => (a.ordre || 99) - (b.ordre || 99));
    const libres = liste('recettes').filter(r => !db.produits[r.id]);
    const elements = [
      ...produits.map(p => ({ id: p.id, titre: p.titre, image: p.image, recette: db.recettes[p.id] || null, produit: true })),
      ...libres.map(r => ({ id: r.id, titre: r.titre || 'Recette', image: '', recette: r, produit: false }))
    ].filter(x => !recherche || x.titre.toLowerCase().includes(recherche.toLowerCase()));
    const avec = elements.filter(x => x.recette && (x.recette.ingredients || []).length).length;

    el.innerHTML = `
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

// Fiche cuisine (lecture), avec calcul pour un autre nombre de parts
export function ouvrirRecette(id) {
  const r = db.recettes[id];
  if (!r || !(r.ingredients || []).length) { editerRecette(id, !db.produits[id]); return; }
  let parts = Number(r.rendement) || 1;
  const dessinerQuantites = () => {
    const f = parts / (Number(r.rendement) || 1);
    $('#fiche-ingredients').innerHTML = r.ingredients.map(l => {
      const ing = db.ingredients[l.ingredientId];
      const q = (Number(l.quantite) || 0) * f;
      const manque = ing && q > (Number(ing.quantite) || 0);
      return `<li class="flex items-center justify-between gap-3 py-2"><span class="flex items-center gap-2.5 min-w-0 text-[15px]">${ing?.miniature ? vignette({ ...ing }, 'w-9 h-9') : ''}<span class="truncate">${esc(ing?.nom || 'Ingrédient supprimé')}</span></span><span class="font-semibold tabular-nums text-[15px] whitespace-nowrap ${manque ? 'text-red-700' : ''}">${formaterQuantite(q, ing?.unite)}${manque ? ' <i class="fa-solid fa-triangle-exclamation text-xs" title="Stock insuffisant"></i>' : ''}</span></li>`;
    }).join('');
    const c = coutRecette(r);
    $('#fiche-cout').textContent = euro(c.parPart * parts);
  };
  const etapes = String(r.etapes || '').split('\n').map(s => s.trim()).filter(Boolean);
  const m = db.produits[id] ? margeProduit(id) : null;
  ouvrirPanneau({
    titre: nomRecette(id),
    contenu: `<div class="space-y-5">
      <div class="bg-white rounded-2xl border border-brand-200 p-4 flex items-center justify-between gap-3">
        <span class="text-sm font-semibold">Pour</span>
        <div class="flex items-center gap-1 bg-brand-50 rounded-xl border border-brand-200">
          <button type="button" id="parts-moins" class="w-10 h-10 text-lg font-bold" aria-label="Moins de parts">−</button>
          <input id="parts-fiche" type="number" min="1" value="${parts}" class="w-14 text-center bg-transparent font-display text-xl tabular-nums" aria-label="Nombre de parts">
          <button type="button" id="parts-plus" class="w-10 h-10 text-lg font-bold" aria-label="Plus de parts">+</button>
        </div>
        <span class="text-sm">parts</span>
      </div>
      <section class="bg-white rounded-2xl border border-brand-200 px-4 py-2">
        <h3 class="text-xs font-bold uppercase tracking-wider text-brand-500 pt-2">Ingrédients</h3>
        <ul id="fiche-ingredients" class="divide-y divide-brand-100"></ul>
        <div class="flex justify-between text-sm border-t border-brand-200 py-2.5 text-brand-600"><span>Coût des ingrédients</span><strong id="fiche-cout" class="tabular-nums text-brand-900"></strong></div>
      </section>
      ${(r.materiel || []).length ? (() => {
        const lignes = r.materiel.map(l => { const mt = db.materiel[l.materielId]; const dispo = Number(mt?.quantite) || 0; return { nom: mt?.nom || 'Matériel supprimé', besoin: Number(l.quantite) || 1, dispo, mt }; });
        const ok = lignes.every(l => l.dispo >= l.besoin);
        return `<section class="bg-white rounded-2xl border ${ok ? 'border-brand-200' : 'border-red-300'} px-4 py-2">
          <div class="flex items-center justify-between pt-2"><h3 class="text-xs font-bold uppercase tracking-wider text-brand-500">Matériel</h3>
            <span class="text-xs font-semibold ${ok ? 'text-emerald-700' : 'text-red-700'}">${ok ? '<i class="fa-solid fa-circle-check"></i> Tout est disponible' : '<i class="fa-solid fa-triangle-exclamation"></i> Il manque du matériel'}</span></div>
          <ul class="divide-y divide-brand-100">${lignes.map(l => `<li class="flex items-center justify-between gap-3 py-2"><span class="flex items-center gap-2.5 min-w-0 text-[15px]"><i class="fa-solid ${l.dispo >= l.besoin ? 'fa-check text-emerald-600' : 'fa-xmark text-red-600'} w-4 flex-none"></i>${l.mt?.miniature ? vignette({ ...l.mt }, 'w-9 h-9') : ''}<span class="truncate">${esc(l.nom)}</span></span><span class="text-sm tabular-nums whitespace-nowrap ${l.dispo >= l.besoin ? 'text-brand-600' : 'text-red-700 font-semibold'}">${l.besoin > 1 ? l.besoin + ' nécessaires · ' : ''}${l.dispo} dispo.</span></li>`).join('')}</ul></section>`;
      })() : ''}
      ${m ? `<section class="grid grid-cols-3 gap-2 text-center">
        <div class="bg-white rounded-xl border border-brand-200 p-3"><div class="text-[11px] text-brand-500">Coût (${m.parts} parts)</div><div class="font-semibold tabular-nums">${euro(m.cout)}</div></div>
        <div class="bg-white rounded-xl border border-brand-200 p-3"><div class="text-[11px] text-brand-500">Prix de vente</div><div class="font-semibold tabular-nums">${euro(m.prix)}</div></div>
        <div class="rounded-xl p-3 ${m.taux >= 0.6 ? 'bg-emerald-50 text-emerald-800' : m.taux >= 0.4 ? 'bg-amber-50 text-amber-800' : 'bg-red-50 text-red-800'}"><div class="text-[11px]">Marge</div><div class="font-semibold tabular-nums">${Math.round(m.taux * 100)} %</div></div>
      </section>` : ''}
      ${etapes.length ? `<section class="bg-white rounded-2xl border border-brand-200 p-4"><h3 class="text-xs font-bold uppercase tracking-wider text-brand-500 mb-3">Étapes${r.tempsMin ? ` · ${r.tempsMin} min` : ''}</h3>
        <ol class="space-y-3">${etapes.map((s, i) => `<li class="flex gap-3"><span class="w-7 h-7 rounded-full bg-terracotta text-white text-sm font-bold grid place-items-center flex-none">${i + 1}</span><span class="text-[15px] pt-0.5">${esc(s)}</span></li>`).join('')}</ol></section>` : ''}
    </div>`,
    pied: `<button type="button" id="fiche-modifier" class="${BTN.sombre} w-full"><i class="fa-solid fa-pen"></i> Modifier la recette</button>`,
    onOuvert: (corps, pied) => {
      dessinerQuantites();
      const maj = n => { parts = Math.max(1, n || 1); $('#parts-fiche').value = parts; dessinerQuantites(); };
      $('#parts-moins').onclick = () => maj(parts - 1);
      $('#parts-plus').onclick = () => maj(parts + 1);
      $('#parts-fiche').oninput = e => { const n = parseInt(e.target.value, 10); if (n > 0) { parts = n; dessinerQuantites(); } };
      $('#fiche-modifier', pied).onclick = () => editerRecette(id, !db.produits[id]);
    }
  });
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
      ${champ({ id: 'rec-etapes', label: 'Étapes (une par ligne)', type: 'textarea', valeur: r.etapes || '', attrs: 'rows="6"' })}
    </form>`,
    pied: `<div class="flex gap-2">${existante ? `<button type="button" id="rec-supprimer" class="${BTN.danger}" aria-label="Supprimer la recette"><i class="fa-regular fa-trash-can"></i></button>` : ''}<button type="button" data-action="fermer-panneau" class="${BTN.secondaire}">Annuler</button><button type="submit" form="form-recette" class="${BTN.principal} flex-1">Enregistrer</button></div>`,
    onOuvert: (corps, pied) => {
      let ligneEnAttente = null, mLigneEnAttente = null;
      brouillon.demarrer({ type: 'recette', args: { id, libre }, racine: corps, extra: () => ({ ingredients: r.ingredients, materiel: r.materiel }) });
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
        if (await confirmer(`Supprimer la recette de « ${nomRecette(id)} » ?`, { bouton: 'Supprimer', danger: true })) { brouillon.terminer(); await supprimer('recettes', id); fermerPanneau(); toast('Recette supprimée'); }
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
        await enregistrer('recettes', id, donnees);
        toast('Recette enregistrée');
        brouillon.terminer();
        ouvrirRecette(id);
      };
    }
  });
}
