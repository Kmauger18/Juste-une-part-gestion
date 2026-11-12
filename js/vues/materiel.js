// Matériel : moules, ustensiles, appareils, emballages
import { liste, obtenir, creer, enregistrer, modifier, supprimer, db } from '../store.js';
import { CATEGORIES_MATERIEL } from '../donnees.js';
import { $, esc, toast, ouvrirPanneau, fermerPanneau, confirmer, champ, selection, etatVide, BTN } from '../ui.js';
import { recettesUtilisantMateriel } from '../calculs.js';

let recherche = '';

export function renderMateriel(el, onglets, rerender) {
  const tous = liste('materiel').sort((a, b) => (a.categorie || '').localeCompare(b.categorie || '') || a.nom.localeCompare(b.nom));
  const visibles = recherche ? tous.filter(m => (m.nom + ' ' + (m.notes || '')).toLowerCase().includes(recherche.toLowerCase())) : tous;
  const groupes = {};
  visibles.forEach(m => { (groupes[m.categorie || 'autre'] = groupes[m.categorie || 'autre'] || []).push(m); });
  const manquants = tous.filter(m => (Number(m.quantite) || 0) <= 0).length;

  el.innerHTML = `
    ${onglets}
    <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
      <p class="text-sm text-brand-600 flex-1 min-w-[200px]">Indiquez le matériel utilisé par chaque recette : la fiche cuisine et les commandes vérifient alors que tout est disponible.</p>
      <button type="button" data-m="nouveau" class="${BTN.principal} w-full sm:w-auto"><i class="fa-solid fa-plus"></i> Matériel</button>
    </div>
    <div class="grid grid-cols-2 gap-3 mb-4">
      <div class="bg-white rounded-2xl border border-brand-200 p-3 sm:p-4"><div class="text-xs text-brand-600">Éléments</div><div class="font-display text-2xl tabular-nums">${tous.length}</div></div>
      <div class="bg-white rounded-2xl border border-brand-200 p-3 sm:p-4"><div class="text-xs text-brand-600">Indisponibles</div><div class="font-display text-2xl tabular-nums ${manquants ? 'text-red-700' : ''}">${manquants}</div></div>
    </div>
    <label class="relative block mb-4 sm:w-72"><span class="sr-only">Rechercher</span><i class="fa-solid fa-magnifying-glass absolute left-3.5 top-3 text-brand-400 text-sm"></i>
      <input id="recherche-materiel" type="search" value="${esc(recherche)}" placeholder="Rechercher du matériel" class="w-full rounded-full border border-brand-200 bg-white pl-10 pr-4 py-2 text-sm focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 focus:outline-none"></label>
    ${visibles.length ? Object.entries(groupes).map(([cat, items]) => `
      <section class="mb-5">
        <h2 class="text-xs font-bold uppercase tracking-wider text-brand-500 mb-2">${esc(CATEGORIES_MATERIEL[cat] || 'Autre')}</h2>
        <div class="bg-white rounded-2xl border border-brand-200 divide-y divide-brand-100 overflow-hidden">
          ${items.map(m => {
            const q = Number(m.quantite) || 0;
            const recettes = recettesUtilisantMateriel(m.id);
            return `<div class="flex items-center gap-3 px-3 sm:px-4 py-3">
              <button type="button" data-editer-m="${m.id}" class="flex-1 min-w-0 text-left">
                <div class="flex items-center gap-2"><span class="font-semibold truncate">${esc(m.nom)}</span>${q <= 0 ? '<span class="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-red-100 text-red-800 whitespace-nowrap">Indisponible</span>' : ''}</div>
                <div class="text-xs text-brand-500 truncate mt-0.5">${recettes.length ? `Utilisé dans ${recettes.length} recette${recettes.length > 1 ? 's' : ''}` : 'Dans aucune recette'}${m.notes ? ' · ' + esc(m.notes) : ''}</div>
              </button>
              <div class="flex items-center gap-1 flex-none">
                <button type="button" data-ajuster-m="${m.id}" data-sens="-1" class="w-9 h-9 rounded-xl border border-brand-200 hover:bg-brand-50 font-bold" aria-label="Un ${esc(m.nom)} de moins">−</button>
                <span class="min-w-[2.5rem] text-center font-semibold tabular-nums">${q}</span>
                <button type="button" data-ajuster-m="${m.id}" data-sens="1" class="w-9 h-9 rounded-xl border border-brand-200 hover:bg-brand-50 font-bold" aria-label="Un ${esc(m.nom)} de plus">+</button>
              </div>
            </div>`;
          }).join('')}
        </div>
      </section>`).join('')
    : etatVide({ icone: 'fa-solid fa-whisk', titre: recherche ? 'Aucun résultat' : 'Pas encore de matériel', texte: recherche ? 'Essayez un autre nom.' : 'Ajoutez vos moules, cercles, poches, appareils et boîtes, avec le nombre que vous possédez.' })}`;

  el.onclick = async e => {
    const o = e.target.closest('[data-onglet]'); if (o) { location.hash = 'stock/' + o.dataset.onglet; return; }
    const ed = e.target.closest('[data-editer-m]'); if (ed) { formulaireMateriel(obtenir('materiel', ed.dataset.editerM)); return; }
    const aj = e.target.closest('[data-ajuster-m]');
    if (aj) { const m = obtenir('materiel', aj.dataset.ajusterM); await modifier('materiel', m.id, { quantite: Math.max(0, (Number(m.quantite) || 0) + Number(aj.dataset.sens)) }); return; }
    if (e.target.closest('[data-m="nouveau"]')) formulaireMateriel(null);
  };
  $('#recherche-materiel', el).oninput = e => { recherche = e.target.value; rerender(); };
}

export function formulaireMateriel(m) {
  const edition = !!m;
  m = m || { nom: '', quantite: 1, categorie: 'moules', notes: '' };
  const recettes = edition ? recettesUtilisantMateriel(m.id) : [];
  ouvrirPanneau({
    titre: edition ? 'Modifier le matériel' : 'Nouveau matériel',
    contenu: `<form id="form-materiel" class="space-y-4" novalidate>
      ${champ({ id: 'ma-nom', label: 'Nom', valeur: m.nom, attrs: 'required placeholder="ex. Cercle à tarte 24 cm"' })}
      <div class="grid grid-cols-2 gap-3">
        ${selection({ id: 'ma-categorie', label: 'Catégorie', options: Object.entries(CATEGORIES_MATERIEL), valeur: m.categorie })}
        ${champ({ id: 'ma-quantite', label: 'Nombre disponible', type: 'number', valeur: m.quantite, attrs: 'min="0" step="1"', aide: '0 si cassé, prêté ou à racheter.' })}
      </div>
      ${champ({ id: 'ma-notes', label: 'Notes', valeur: m.notes || '', attrs: 'placeholder="ex. prêté à maman, rayé…"' })}
      ${recettes.length ? `<p class="text-xs text-brand-500">Utilisé dans : ${esc(recettes.join(', '))}</p>` : ''}
    </form>`,
    pied: `<div class="flex gap-2">${edition ? `<button type="button" id="ma-supprimer" class="${BTN.danger}" aria-label="Supprimer"><i class="fa-regular fa-trash-can"></i></button>` : ''}<button type="button" data-action="fermer-panneau" class="${BTN.secondaire}">Annuler</button><button type="submit" form="form-materiel" class="${BTN.principal} flex-1">Enregistrer</button></div>`,
    onOuvert: (corps, pied) => {
      const sup = $('#ma-supprimer', pied);
      if (sup) sup.onclick = async () => {
        const msg = recettes.length ? `« ${m.nom} » est utilisé dans ${recettes.length} recette(s). Le supprimer quand même ?` : `Supprimer « ${m.nom} » ?`;
        if (await confirmer(msg, { bouton: 'Supprimer', danger: true })) { await supprimer('materiel', m.id); fermerPanneau(); toast('Matériel supprimé'); }
      };
      $('#form-materiel').onsubmit = async e => {
        e.preventDefault();
        const nom = $('#ma-nom').value.trim(); if (!nom) { $('#ma-nom').focus(); return; }
        const d = { nom, categorie: $('#ma-categorie').value, quantite: Math.max(0, parseInt($('#ma-quantite').value, 10) || 0), notes: $('#ma-notes').value.trim() };
        if (edition) await enregistrer('materiel', m.id, d); else await creer('materiel', d);
        fermerPanneau(); toast('Matériel enregistré');
      };
    }
  });
}
