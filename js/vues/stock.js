// Stock : ingrédients et matériel
import { liste, obtenir, creer, enregistrer, modifier, supprimer, supprimerPhoto, db } from '../store.js';
import { UNITES } from '../donnees.js';
import { $, esc, euro, isoJour, ajouterJours, toast, ouvrirPanneau, fermerPanneau, confirmer, copier, champ, selection, etatVide, BTN, vue } from '../ui.js';
import { formaterQuantite, coutIngredient, besoinsCommandes } from '../calculs.js';
import { renderMateriel } from './materiel.js';
import * as brouillon from '../brouillon.js';
import { editeurPhotos, vignette } from '../photos.js';

let filtre = 'tous';
let onglet = 'ingredients';

function barreOnglets() {
  const nbM = liste('materiel').length, nbI = liste('ingredients').length;
  return `<div class="flex items-center justify-between gap-3 mb-5"><h1 class="hidden lg:block font-display text-3xl">Stock</h1>
    <div class="flex p-1 bg-white border border-brand-200 rounded-2xl w-full lg:w-auto" role="tablist">${[['ingredients', 'Ingrédients', nbI, 'fa-solid fa-wheat-awn'], ['materiel', 'Matériel', nbM, 'fa-solid fa-whisk']].map(([k, l, n, ic]) => `<button type="button" role="tab" aria-selected="${k === onglet}" data-onglet="${k}" class="flex-1 lg:flex-none px-4 py-2 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 ${k === onglet ? 'bg-brand-900 text-white' : 'text-brand-700 hover:bg-brand-50'}"><i class="${ic}"></i>${l} <span class="${k === onglet ? 'text-brand-300' : 'text-brand-400'}">${n}</span></button>`).join('')}</div></div>`;
}
let recherche = '';

function etat(i) {
  const q = Number(i.quantite) || 0, s = Number(i.seuil) || 0;
  if (q <= 0) return { label: 'Épuisé', classe: 'bg-red-100 text-red-800', barre: 'bg-red-500' };
  if (q <= s) return { label: 'À racheter', classe: 'bg-amber-100 text-amber-800', barre: 'bg-amber-500' };
  return { label: 'OK', classe: 'bg-emerald-50 text-emerald-700', barre: 'bg-emerald-500' };
}

// Pas d'ajustement rapide selon l'unité
function pas(unite) { return unite === 'piece' ? 1 : unite === 'ml' ? 250 : 250; }

export default {
  render(el, ctx = {}) {
    if (ctx.changementDeRoute) onglet = ctx.param === 'materiel' ? 'materiel' : 'ingredients';
    if (onglet === 'materiel') { renderMateriel(el, barreOnglets(), () => this.render(el)); return; }
    const tous = liste('ingredients').sort((a, b) => a.nom.localeCompare(b.nom));
    const aRacheter = tous.filter(i => (Number(i.quantite) || 0) <= (Number(i.seuil) || 0));
    const valeur = tous.reduce((s, i) => s + coutIngredient(i.id, i.quantite), 0);
    let visibles = filtre === 'racheter' ? aRacheter : tous;
    if (recherche) visibles = visibles.filter(i => (i.nom + ' ' + (i.fournisseur || '')).toLowerCase().includes(recherche.toLowerCase()));

    vue(el).innerHTML = `
      ${barreOnglets()}
      <div class="flex flex-wrap items-center justify-end gap-3 mb-5">
        <div class="flex gap-2 w-full sm:w-auto">
          <button type="button" data-s="courses" class="${BTN.secondaire} flex-1 sm:flex-none"><i class="fa-solid fa-basket-shopping"></i> Liste de courses</button>
          <button type="button" data-s="nouveau" class="${BTN.principal} flex-1 sm:flex-none"><i class="fa-solid fa-plus"></i> Ingrédient</button>
        </div>
      </div>
      <div class="grid grid-cols-3 gap-3 mb-5">
        <div class="bg-white rounded-2xl border border-brand-200 p-3 sm:p-4"><div class="text-xs text-brand-600">Ingrédients</div><div class="font-display text-2xl tabular-nums">${tous.length}</div></div>
        <div class="bg-white rounded-2xl border border-brand-200 p-3 sm:p-4"><div class="text-xs text-brand-600">À racheter</div><div class="font-display text-2xl tabular-nums ${aRacheter.length ? 'text-amber-700' : ''}">${aRacheter.length}</div></div>
        <div class="bg-white rounded-2xl border border-brand-200 p-3 sm:p-4"><div class="text-xs text-brand-600">Valeur du stock</div><div class="font-display text-2xl tabular-nums">${euro(valeur, 0)}</div></div>
      </div>
      <div class="flex flex-col sm:flex-row gap-3 mb-4">
        <div class="flex gap-2">${[['tous', 'Tout'], ['racheter', `À racheter (${aRacheter.length})`]].map(([k, l]) => `<button type="button" data-filtre="${k}" class="px-3.5 py-2 rounded-full text-sm font-semibold ${k === filtre ? 'bg-brand-900 text-white' : 'bg-white border border-brand-200 text-brand-700'}">${l}</button>`).join('')}</div>
        <label class="relative sm:ml-auto sm:w-64"><span class="sr-only">Rechercher</span><i class="fa-solid fa-magnifying-glass absolute left-3.5 top-3 text-brand-400 text-sm"></i>
          <input id="recherche-stock" type="search" value="${esc(recherche)}" placeholder="Rechercher un ingrédient" class="w-full rounded-full border border-brand-200 bg-white pl-10 pr-4 py-2 text-sm focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 focus:outline-none"></label>
      </div>
      ${visibles.length ? `<div class="bg-white rounded-2xl border border-brand-200 divide-y divide-brand-100 overflow-hidden">
        ${visibles.map(i => {
          const e = etat(i), q = Number(i.quantite) || 0, s = Number(i.seuil) || 0;
          const ratio = Math.min(1, s ? q / (s * 2) : q > 0 ? 1 : 0);
          return `<div class="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 sm:px-4 py-3">
            ${vignette(i)}
            <button type="button" data-editer="${i.id}" class="flex-1 min-w-[10rem] text-left">
              <div class="flex items-center gap-2"><span class="font-semibold truncate">${esc(i.nom)}</span><span class="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${e.classe} whitespace-nowrap">${e.label}</span></div>
              <div class="flex items-center gap-2 mt-1.5"><span class="h-1.5 w-20 sm:w-28 rounded-full bg-brand-100 overflow-hidden"><span class="block h-full ${e.barre}" style="width:${Math.round(ratio * 100)}%"></span></span>
                <span class="text-xs text-brand-500 truncate">alerte sous ${formaterQuantite(s, i.unite)}${i.prix ? ` · ${euro(i.prix)} ${UNITES[i.unite]?.prixLabel.replace('€ ', '') || ''}` : ''}</span></div>
            </button>
            <div class="flex items-center gap-1 flex-none ml-auto">
              <button type="button" data-ajuster="${i.id}" data-sens="-1" class="w-9 h-9 rounded-xl border border-brand-200 hover:bg-brand-50 font-bold" aria-label="Retirer ${pas(i.unite)} ${UNITES[i.unite]?.label} de ${esc(i.nom)}">−</button>
              <button type="button" data-mouvement="${i.id}" class="min-w-[5.5rem] px-2 h-9 rounded-xl font-semibold text-sm tabular-nums hover:bg-brand-50" title="Saisir une quantité">${formaterQuantite(q, i.unite)}</button>
              <button type="button" data-ajuster="${i.id}" data-sens="1" class="w-9 h-9 rounded-xl border border-brand-200 hover:bg-brand-50 font-bold" aria-label="Ajouter ${pas(i.unite)} ${UNITES[i.unite]?.label} de ${esc(i.nom)}">+</button>
            </div>
          </div>`;
        }).join('')}</div>
        <p class="text-xs text-brand-500 mt-3">Les boutons − et + changent la quantité de ${pas('g')} g, ${pas('ml')} ml ou 1 pièce. Touchez la quantité pour saisir une réception ou un inventaire.</p>`
      : etatVide({ icone: 'fa-solid fa-boxes-stacked', titre: recherche || filtre !== 'tous' ? 'Rien à afficher' : 'Stock vide', texte: recherche || filtre !== 'tous' ? 'Aucun ingrédient ne correspond.' : 'Ajoutez vos ingrédients avec leur prix : les recettes calculeront le coût de revient et le stock se mettra à jour avec les commandes.' })}`;

    el.onclick = async e => {
      const o = e.target.closest('[data-onglet]'); if (o) { location.hash = 'stock/' + o.dataset.onglet; return; }
      const f = e.target.closest('[data-filtre]'); if (f) { filtre = f.dataset.filtre; this.render(el); return; }
      const ed = e.target.closest('[data-editer]'); if (ed) { formulaireIngredient(obtenir('ingredients', ed.dataset.editer)); return; }
      const mv = e.target.closest('[data-mouvement]'); if (mv) { mouvement(obtenir('ingredients', mv.dataset.mouvement)); return; }
      const aj = e.target.closest('[data-ajuster]');
      if (aj) {
        const i = obtenir('ingredients', aj.dataset.ajuster);
        const n = Math.max(0, (Number(i.quantite) || 0) + Number(aj.dataset.sens) * pas(i.unite));
        await modifier('ingredients', i.id, { quantite: n });
        return;
      }
      const a = e.target.closest('[data-s]');
      if (a?.dataset.s === 'nouveau') formulaireIngredient(null);
      if (a?.dataset.s === 'courses') listeDeCourses();
    };
    $('#recherche-stock', el).oninput = e => { recherche = e.target.value; this.render(el); };
  }
};

export function mouvement(i, reprise = null) {
  const u = UNITES[i.unite] || UNITES.g;
  ouvrirPanneau({
    titre: i.nom,
    contenu: `<div class="space-y-5">
      <div class="text-center bg-white rounded-2xl border border-brand-200 py-5"><div class="text-xs text-brand-500">En stock</div><div class="font-display text-4xl tabular-nums mt-1">${formaterQuantite(i.quantite, i.unite)}</div></div>
      <div class="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Type de mouvement">
        ${[['entree', 'Réception', 'fa-truck-ramp-box'], ['sortie', 'Utilisation', 'fa-mortar-pestle'], ['inventaire', 'Inventaire', 'fa-clipboard-check']].map(([k, l, ic], n) => `<label class="cursor-pointer"><input type="radio" name="mvt" value="${k}" class="peer sr-only" ${n === 0 ? 'checked' : ''}><span class="flex flex-col items-center gap-1 py-3 rounded-xl border-2 border-brand-200 bg-white text-sm font-semibold peer-checked:border-terracotta peer-checked:bg-terracotta/5"><i class="fa-solid ${ic} text-terracotta"></i>${l}</span></label>`).join('')}
      </div>
      <label class="block"><span id="mvt-label" class="block text-xs font-semibold text-brand-700 mb-1.5">Quantité reçue (${u.label})</span>
        <input id="mvt-quantite" type="number" min="0" step="any" inputmode="decimal" class="w-full rounded-xl border border-brand-200 px-3.5 py-3 text-xl tabular-nums focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 focus:outline-none"></label>
      <div id="mvt-prix-bloc">${champ({ id: 'mvt-prix', label: `Nouveau prix (${u.prixLabel}), si changé`, type: 'number', valeur: '', attrs: `min="0" step="0.01" placeholder="${i.prix || ''}"` })}</div>
      <p id="mvt-resultat" class="text-sm text-brand-600"></p>
    </div>`,
    pied: `<button type="button" id="mvt-valider" class="${BTN.principal} w-full">Valider</button>`,
    onOuvert: (corps, pied) => {
      const type = () => corps.querySelector('input[name=mvt]:checked').value;
      const calc = () => {
        const v = Number($('#mvt-quantite').value) || 0, q = Number(i.quantite) || 0, t = type();
        $('#mvt-label').textContent = (t === 'entree' ? 'Quantité reçue' : t === 'sortie' ? 'Quantité utilisée ou jetée' : 'Quantité comptée') + ` (${u.label})`;
        $('#mvt-prix-bloc').classList.toggle('hidden', t !== 'entree');
        const n = t === 'entree' ? q + v : t === 'sortie' ? Math.max(0, q - v) : v;
        $('#mvt-resultat').innerHTML = $('#mvt-quantite').value === '' ? '' : `Nouveau stock : <strong>${formaterQuantite(n, i.unite)}</strong>`;
        return n;
      };
      corps.addEventListener('input', calc); corps.addEventListener('change', calc);
      brouillon.demarrer({ type: 'mouvement', args: { id: i.id }, racine: corps });
      if (reprise) brouillon.appliquerChamps(corps, reprise.champs);
      calc();
      $('#mvt-quantite').focus();
      $('#mvt-valider', pied).onclick = async () => {
        if ($('#mvt-quantite').value === '') { $('#mvt-quantite').focus(); return; }
        const data = { quantite: Math.round(calc() * 100) / 100 };
        const prix = $('#mvt-prix').value; if (type() === 'entree' && prix !== '') data.prix = Number(prix) || 0;
        await modifier('ingredients', i.id, data);
        brouillon.terminer(); fermerPanneau(); toast(`${i.nom} : ${formaterQuantite(data.quantite, i.unite)}`);
      };
    }
  });
}

export function formulaireIngredient(i, reprise = null) {
  const edition = !!i;
  i = i || { nom: '', unite: 'g', quantite: 0, seuil: 0, prix: 0, fournisseur: '' };
  const utilisee = edition ? Object.entries(db.recettes).filter(([, r]) => (r.ingredients || []).some(l => l.ingredientId === i.id)).map(([id, r]) => db.produits[id]?.titre || r.titre || id) : [];
  ouvrirPanneau({
    titre: edition ? 'Modifier l\'ingrédient' : 'Nouvel ingrédient',
    contenu: `<form id="form-ingredient" class="space-y-4" novalidate>
      ${champ({ id: 'in-nom', label: 'Nom', valeur: i.nom, attrs: 'required' })}
      ${selection({ id: 'in-unite', label: 'Unité', options: Object.entries(UNITES).map(([k, u]) => [k, u.label === 'g' ? 'Grammes (g)' : u.label === 'ml' ? 'Millilitres (ml)' : 'Pièces']), valeur: i.unite })}
      <div class="grid grid-cols-2 gap-3">
        ${champ({ id: 'in-quantite', label: 'Quantité en stock', type: 'number', valeur: i.quantite, attrs: 'min="0" step="any"' })}
        ${champ({ id: 'in-seuil', label: 'Alerte en dessous de', type: 'number', valeur: i.seuil, attrs: 'min="0" step="any"' })}
      </div>
      ${champ({ id: 'in-prix', label: 'Prix d\'achat', type: 'number', valeur: i.prix, attrs: 'min="0" step="0.01"', aide: 'En € par kg pour les grammes, par litre pour les millilitres, par pièce sinon.' })}
      ${champ({ id: 'in-fournisseur', label: 'Fournisseur', valeur: i.fournisseur || '' })}
      <div><span class="block text-xs font-semibold text-brand-700 mb-1.5">Photos</span><div id="in-photos"></div></div>
      ${utilisee.length ? `<p class="text-xs text-brand-500">Utilisé dans : ${esc(utilisee.join(', '))}</p>` : ''}
    </form>`,
    pied: `<div class="flex gap-2">${edition ? `<button type="button" id="in-supprimer" class="${BTN.danger}" aria-label="Supprimer"><i class="fa-regular fa-trash-can"></i></button>` : ''}<button type="button" data-action="fermer-panneau" class="${BTN.secondaire}">Annuler</button><button type="submit" form="form-ingredient" class="${BTN.principal} flex-1">Enregistrer</button></div>`,
    onOuvert: (corps, pied) => {
      const photos = editeurPhotos($('#in-photos'), i.photos || [], reprise?.extra?.photos);
      brouillon.demarrer({ type: 'ingredient', args: { id: edition ? i.id : null }, racine: corps, extra: () => ({ photos: photos.etat() }) });
      if (reprise) brouillon.appliquerChamps(corps, reprise.champs);
      const sup = $('#in-supprimer', pied);
      if (sup) sup.onclick = async () => {
        const msg = utilisee.length ? `« ${i.nom} » est utilisé dans ${utilisee.length} recette(s). Le supprimer quand même ?` : `Supprimer « ${i.nom} » ?`;
        if (await confirmer(msg, { bouton: 'Supprimer', danger: true })) { brouillon.terminer(); await supprimer('ingredients', i.id); (i.photos || []).forEach(id => supprimerPhoto(id).catch(() => {})); fermerPanneau(); toast('Ingrédient supprimé'); }
      };
      $('#form-ingredient').onsubmit = async e => {
        e.preventDefault();
        const v = id => $('#' + id).value.trim();
        if (!v('in-nom')) { $('#in-nom').focus(); return; }
        const d = { nom: v('in-nom'), unite: v('in-unite'), quantite: Number(v('in-quantite')) || 0, seuil: Number(v('in-seuil')) || 0, prix: Number(v('in-prix')) || 0, fournisseur: v('in-fournisseur') };
        const bouton = pied.querySelector('button[type=submit]'); bouton.disabled = true; bouton.textContent = 'Enregistrement…';
        try { Object.assign(d, await photos.enregistrer()); } catch (err) { toast(err.message, 'erreur'); bouton.disabled = false; bouton.textContent = 'Enregistrer'; return; }
        if (edition) await enregistrer('ingredients', i.id, d); else await creer('ingredients', d);
        brouillon.terminer(); fermerPanneau(); toast('Ingrédient enregistré');
      };
    }
  });
}

function listeDeCourses() {
  const auj = isoJour();
  const commandes = liste('commandes').filter(c => ['nouvelle', 'confirmee', 'preparation'].includes(c.statut) && c.dateRetrait && c.dateRetrait <= ajouterJours(auj, 7) && !c.stockDeduit);
  const { lignes } = besoinsCommandes(commandes);
  const items = {};
  lignes.filter(l => l.manque > 0).forEach(l => { items[l.id] = { nom: l.nom, unite: l.unite, qte: l.manque, raison: 'commandes' }; });
  liste('ingredients').filter(i => (Number(i.quantite) || 0) <= (Number(i.seuil) || 0)).forEach(i => {
    const reappro = Math.max((Number(i.seuil) || 0) * 2 - (Number(i.quantite) || 0), 0);
    if (items[i.id]) items[i.id].qte = Math.max(items[i.id].qte, reappro); else items[i.id] = { nom: i.nom, unite: i.unite, qte: reappro, raison: 'stock' };
    items[i.id].fournisseur = i.fournisseur;
  });
  const liste_ = Object.values(items).sort((a, b) => (a.fournisseur || '').localeCompare(b.fournisseur || '') || a.nom.localeCompare(b.nom));
  const texte = "Courses – Féelodie's\n" + liste_.map(x => `☐ ${x.nom} : ${formaterQuantite(x.qte, x.unite)}${x.fournisseur ? ` (${x.fournisseur})` : ''}`).join('\n');
  ouvrirPanneau({
    titre: 'Liste de courses',
    contenu: liste_.length ? `<p class="text-sm text-brand-600 mb-4">Ce qui manque pour les commandes des 7 prochains jours, plus les ingrédients sous leur seuil d'alerte (quantité conseillée : de quoi revenir au double du seuil).</p>
      <ul class="bg-white rounded-2xl border border-brand-200 divide-y divide-brand-100">${liste_.map(x => `<li><label class="flex items-center gap-3 px-4 py-3 cursor-pointer"><input type="checkbox" class="w-5 h-5 accent-terracotta"><span class="flex-1"><span class="font-medium">${esc(x.nom)}</span>${x.fournisseur ? `<span class="block text-xs text-brand-500">${esc(x.fournisseur)}</span>` : ''}</span><span class="font-semibold tabular-nums whitespace-nowrap">${formaterQuantite(x.qte, x.unite)}</span></label></li>`).join('')}</ul>`
      : etatVide({ icone: 'fa-solid fa-basket-shopping', titre: 'Rien à acheter', texte: 'Le stock couvre les commandes à venir et aucun ingrédient n\'est sous son seuil.' }),
    pied: liste_.length ? `<button type="button" id="copier-courses" class="${BTN.sombre} w-full"><i class="fa-regular fa-copy"></i> Copier la liste</button>` : '',
    onOuvert: (c, pied) => { const b = $('#copier-courses', pied); if (b) b.onclick = () => copier(texte); }
  });
}
