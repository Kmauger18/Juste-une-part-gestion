// Commandes : liste par date de retrait, détail, création et modification
import { liste, obtenir, parametres, creer, enregistrer, modifier, supprimer, lot, db } from '../store.js';
import { STATUTS, ORDRE_STATUTS, TAILLES } from '../donnees.js';
import { $, $$, esc, euro, isoJour, dateRelative, dateLongue, ecartJours, badgeStatut, toast, ouvrirPanneau, fermerPanneau, confirmer, copier, champ, selection, interrupteur, etatVide, BTN } from '../ui.js';
import { besoinsCommandes, operationsDeduction, totalCommande, formaterQuantite, prochainNumero } from '../calculs.js';

const FILTRES = {
  atraiter: { label: 'À confirmer', statuts: ['nouvelle'] },
  encours: { label: 'En cours', statuts: ['confirmee', 'preparation', 'prete'] },
  terminees: { label: 'Retirées', statuts: ['retiree'] },
  annulees: { label: 'Annulées', statuts: ['annulee'] },
  toutes: { label: 'Toutes', statuts: ORDRE_STATUTS }
};
let filtre = 'encours';
let recherche = '';
let filtreChoisi = false;

const ETAPE_SUIVANTE = {
  nouvelle: { statut: 'confirmee', label: 'Confirmer la commande', icone: 'fa-solid fa-check' },
  confirmee: { statut: 'preparation', label: 'Commencer la préparation', icone: 'fa-solid fa-mortar-pestle' },
  preparation: { statut: 'prete', label: 'Marquer comme prête', icone: 'fa-solid fa-box' },
  prete: { statut: 'retiree', label: 'Marquer comme retirée', icone: 'fa-solid fa-hand-holding-heart' }
};

function telLien(tel) { return String(tel || '').replace(/[^0-9+]/g, ''); }

function smsConfirmation(c) {
  const lignes = (c.lignes || []).map(l => `${l.qty} × ${l.titre}${l.taille && !l.titre.includes(l.taille) ? ` (${l.taille})` : ''}`).join(', ');
  const reste = Math.max(0, (Number(c.total) || 0) - (Number(c.acompte) || 0));
  return `Bonjour ${(c.client?.nom || '').replace(/^Exemple · /, '').split(' ')[0]}, c'est Élodie de « Juste une part, merci ! ». Votre commande ${c.numero || ''} est confirmée : ${lignes}. Retrait ${dateLongue(c.dateRetrait)}${c.heure ? ', ' + c.heure : ''}. Montant : ${euro(c.total)}${c.acompte ? ` (acompte reçu ${euro(c.acompte)}, reste ${euro(reste)})` : ''}. À bientôt !`;
}

function carte(c) {
  const e = c.dateRetrait ? ecartJours(c.dateRetrait) : null;
  const enRetard = e !== null && e < 0 && ['confirmee', 'preparation', 'prete', 'nouvelle'].includes(c.statut);
  return `<button type="button" data-ouvrir="${c.id}" class="min-w-0 w-full text-left bg-white rounded-2xl border ${c.statut === 'nouvelle' ? 'border-sky-300' : 'border-brand-200'} p-4 hover:shadow-md transition-shadow">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <div class="flex items-center gap-2 flex-wrap"><span class="font-semibold text-brand-950 truncate">${esc(c.client?.nom || 'Client')}</span><span class="text-xs text-brand-400">${esc(c.numero || '')}</span>${c.source === 'site' ? '<span class="text-[10px] font-bold uppercase tracking-wide text-brand-500 bg-brand-100 px-1.5 py-0.5 rounded">Site</span>' : ''}</div>
        <div class="text-sm text-brand-700 mt-1 line-clamp-2">${esc((c.lignes || []).map(l => `${l.qty} × ${l.titre}`).join(' · '))}</div>
      </div>
      ${badgeStatut(c.statut, true)}
    </div>
    <div class="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-brand-100 text-xs">
      <span class="${enRetard ? 'text-red-700 font-semibold' : 'text-brand-600'}"><i class="fa-regular fa-clock mr-1"></i>${esc(c.heure || 'Heure à définir')}${enRetard ? ' · en retard' : ''}</span>
      <span class="flex items-center gap-2">${c.paye ? '<span class="text-emerald-700 font-semibold"><i class="fa-solid fa-check"></i> Payée</span>' : c.acompte ? `<span class="text-brand-500">Acompte ${euro(c.acompte, 0)}</span>` : ''}<span class="font-bold text-sm text-brand-950 tabular-nums">${euro(c.total)}</span></span>
    </div>
    ${c.message ? `<div class="mt-2 text-xs text-sky-900 bg-sky-50 rounded-lg px-2.5 py-1.5 line-clamp-2"><i class="fa-regular fa-comment mr-1"></i>${esc(c.message)}</div>` : ''}
  </button>`;
}

export default {
  render(el, { param, changementDeRoute }) {
    const toutes = liste('commandes');
    const nbNouvelles = toutes.filter(c => c.statut === 'nouvelle').length;
    if (!filtreChoisi && changementDeRoute) filtre = nbNouvelles ? 'atraiter' : 'encours';

    const statuts = FILTRES[filtre].statuts;
    const q = recherche.toLowerCase();
    const visibles = toutes.filter(c => statuts.includes(c.statut))
      .filter(c => !q || [c.client?.nom, c.client?.tel, c.numero, ...(c.lignes || []).map(l => l.titre)].join(' ').toLowerCase().includes(q));
    const decroissant = ['terminees', 'annulees', 'toutes'].includes(filtre);
    visibles.sort((a, b) => ((a.dateRetrait || '9999') + (a.heure || '')).localeCompare((b.dateRetrait || '9999') + (b.heure || '')) * (decroissant ? -1 : 1));

    const groupes = [];
    visibles.forEach(c => {
      const cle = c.dateRetrait || '';
      let g = groupes[groupes.length - 1];
      if (!g || g.cle !== cle) { g = { cle, commandes: [] }; groupes.push(g); }
      g.commandes.push(c);
    });

    const compte = f => toutes.filter(c => FILTRES[f].statuts.includes(c.statut)).length;

    el.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h1 class="hidden lg:block font-display text-3xl">Commandes</h1>
        <button type="button" data-action-c="nouvelle" class="${BTN.principal} w-full sm:w-auto"><i class="fa-solid fa-plus"></i> Nouvelle commande</button>
      </div>
      <div class="flex flex-col sm:flex-row gap-3 mb-5">
        <div class="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0" role="tablist">
          ${Object.entries(FILTRES).map(([k, f]) => `<button type="button" role="tab" aria-selected="${k === filtre}" data-filtre="${k}" class="flex-none px-3.5 py-2 rounded-full text-sm font-semibold transition-colors ${k === filtre ? 'bg-brand-900 text-white' : 'bg-white border border-brand-200 text-brand-700 hover:border-brand-400'}">${f.label}${k !== 'toutes' ? ` <span class="${k === filtre ? 'text-brand-300' : 'text-brand-400'}">${compte(k)}</span>` : ''}</button>`).join('')}
        </div>
        <label class="relative sm:ml-auto sm:w-64"><span class="sr-only">Rechercher</span><i class="fa-solid fa-magnifying-glass absolute left-3.5 top-3 text-brand-400 text-sm"></i>
          <input id="recherche-commandes" type="search" value="${esc(recherche)}" placeholder="Client, téléphone, gâteau…" class="w-full rounded-full border border-brand-200 bg-white pl-10 pr-4 py-2 text-sm focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 focus:outline-none"></label>
      </div>
      ${groupes.length ? groupes.map(g => `
        <section class="mb-6">
          <h2 class="sticky top-14 lg:top-0 z-10 bg-brand-50/95 backdrop-blur py-2 text-sm font-bold text-brand-800 flex items-center gap-2">${esc(dateRelative(g.cle))}${g.cle && Math.abs(ecartJours(g.cle)) < 7 && Math.abs(ecartJours(g.cle)) > 1 ? '' : g.cle ? `<span class="font-normal text-brand-500">${esc(dateLongue(g.cle))}</span>` : ''}<span class="ml-auto text-xs font-semibold text-brand-500">${g.commandes.length} commande${g.commandes.length > 1 ? 's' : ''} · ${euro(g.commandes.reduce((s, c) => s + (Number(c.total) || 0), 0), 0)}</span></h2>
          <div class="grid gap-3 md:grid-cols-2">${g.commandes.map(carte).join('')}</div>
        </section>`).join('')
      : etatVide({ icone: 'fa-solid fa-receipt', titre: q ? 'Aucun résultat' : 'Aucune commande ici', texte: q ? 'Essayez un autre nom ou numéro.' : 'Les commandes passées sur le site apparaîtront ici automatiquement. Vous pouvez aussi en ajouter une reçue par téléphone.' })}`;

    el.onclick = e => {
      const f = e.target.closest('[data-filtre]');
      if (f) { filtre = f.dataset.filtre; filtreChoisi = true; this.render(el, {}); return; }
      const o = e.target.closest('[data-ouvrir]');
      if (o) { ouvrirCommande(o.dataset.ouvrir); return; }
      if (e.target.closest('[data-action-c="nouvelle"]')) formulaireCommande();
    };
    $('#recherche-commandes', el).oninput = e => { recherche = e.target.value; this.render(el, {}); };

    if (changementDeRoute && param) {
      if (param === 'nouvelle') formulaireCommande();
      else if (obtenir('commandes', param)) ouvrirCommande(param);
    }
  }
};

// ---------------------------------------------------------------
//  Détail d'une commande
// ---------------------------------------------------------------
export function ouvrirCommande(id) {
  const dessiner = () => {
    const c = obtenir('commandes', id);
    if (!c) { fermerPanneau(); return; }
    const suivante = ETAPE_SUIVANTE[c.statut];
    const { lignes: besoins, sansRecette } = besoinsCommandes([c]);
    const reste = Math.max(0, (Number(c.total) || 0) - (Number(c.acompte) || 0));
    const tel = telLien(c.client?.tel);

    const corps = `
      <div class="space-y-5">
        <div class="flex items-center justify-between gap-3">
          <div><div class="text-xs text-brand-500">${esc(c.numero || '')} · ${c.source === 'site' ? 'commande du site' : 'saisie manuelle'}</div>
            <div class="font-display text-2xl mt-0.5">${esc(dateRelative(c.dateRetrait))}</div>
            <div class="text-sm text-brand-600">${esc(dateLongue(c.dateRetrait))}${c.heure ? ' · ' + esc(c.heure) : ''}</div></div>
          ${badgeStatut(c.statut)}
        </div>

        ${suivante ? `<button type="button" data-statut="${suivante.statut}" class="${BTN.principal} w-full py-3"><i class="${suivante.icone}"></i> ${suivante.label}</button>` : ''}
        <div class="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">${ORDRE_STATUTS.map(s => `<button type="button" data-statut="${s}" class="flex-none px-2.5 py-1.5 rounded-lg text-xs font-semibold border ${s === c.statut ? 'bg-brand-900 text-white border-brand-900' : 'bg-white border-brand-200 text-brand-700 hover:border-brand-400'}">${STATUTS[s].label}</button>`).join('')}</div>

        <section class="bg-white rounded-2xl border border-brand-200 p-4">
          <h3 class="text-xs font-bold uppercase tracking-wider text-brand-500 mb-2">Client</h3>
          <div class="font-semibold text-lg">${esc(c.client?.nom || '—')}</div>
          ${c.client?.tel ? `<div class="flex flex-wrap items-center gap-2 mt-2">
            <span class="font-medium tabular-nums select-all">${esc(c.client.tel)}</span>
            <a href="tel:${tel}" class="${BTN.secondaire} !py-1.5 !px-3"><i class="fa-solid fa-phone"></i> Appeler</a>
            <a href="sms:${tel}?&body=${encodeURIComponent(smsConfirmation(c))}" class="${BTN.secondaire} !py-1.5 !px-3"><i class="fa-solid fa-comment-sms"></i> SMS de confirmation</a>
            <button type="button" data-copier="${esc(c.client.tel)}" class="${BTN.icone}" aria-label="Copier le numéro"><i class="fa-regular fa-copy"></i></button></div>` : ''}
          ${c.client?.email ? `<div class="mt-2 text-sm"><a href="mailto:${esc(c.client.email)}" class="text-terracotta hover:underline break-all">${esc(c.client.email)}</a></div>` : ''}
          ${c.message ? `<div class="mt-3 text-sm bg-sky-50 text-sky-900 rounded-xl p-3"><div class="text-[11px] font-bold uppercase tracking-wider text-sky-700 mb-1">Message du client</div>${esc(c.message).replace(/\n/g, '<br>')}</div>` : ''}
        </section>

        <section class="bg-white rounded-2xl border border-brand-200 overflow-hidden">
          <h3 class="text-xs font-bold uppercase tracking-wider text-brand-500 px-4 pt-4 pb-2">Gâteaux</h3>
          <ul class="divide-y divide-brand-100">${(c.lignes || []).map(l => `<li class="flex items-start justify-between gap-3 px-4 py-2.5 text-sm"><span><span class="font-semibold">${l.qty} ×</span> ${esc(l.titre)}${l.taille && !l.titre.includes(l.taille) ? `<span class="block text-xs text-brand-500">${esc(l.taille)}</span>` : ''}</span><span class="tabular-nums whitespace-nowrap">${euro(l.prix * l.qty)}</span></li>`).join('')}</ul>
          <div class="px-4 py-3 bg-brand-50 border-t border-brand-100 space-y-1 text-sm">
            <div class="flex justify-between font-bold text-base"><span>Total</span><span class="tabular-nums">${euro(c.total)}</span></div>
            ${c.acompte ? `<div class="flex justify-between text-brand-600"><span>Acompte reçu</span><span class="tabular-nums">− ${euro(c.acompte)}</span></div>` : ''}
            ${!c.paye ? `<div class="flex justify-between text-brand-900 font-semibold"><span>Reste à payer</span><span class="tabular-nums">${euro(reste)}</span></div>` : ''}
          </div>
          <div class="px-4 py-2 border-t border-brand-100">${interrupteur({ id: 'cmd-paye', label: 'Payée en totalité', coche: !!c.paye })}</div>
        </section>

        <section class="bg-white rounded-2xl border border-brand-200 overflow-hidden">
          <div class="px-4 pt-4 pb-2 flex items-center justify-between gap-2"><h3 class="text-xs font-bold uppercase tracking-wider text-brand-500">Ingrédients nécessaires</h3>
            ${c.stockDeduit ? '<span class="text-[11px] font-semibold text-emerald-700"><i class="fa-solid fa-check"></i> Déduits du stock</span>' : ''}</div>
          ${besoins.length ? `<ul class="divide-y divide-brand-100 text-sm">${besoins.map(b => `<li class="flex items-center justify-between gap-3 px-4 py-2"><span>${esc(b.nom)}</span><span class="tabular-nums whitespace-nowrap ${!c.stockDeduit && b.manque > 0 ? 'text-red-700 font-semibold' : 'text-brand-700'}">${formaterQuantite(b.besoin, b.unite)}${!c.stockDeduit && b.manque > 0 ? ` <span class="text-xs">(stock ${formaterQuantite(b.stock, b.unite)})</span>` : ''}</span></li>`).join('')}</ul>` : '<p class="px-4 pb-3 text-sm text-brand-500">Aucune recette renseignée pour ces gâteaux.</p>'}
          ${sansRecette.length && besoins.length ? `<p class="px-4 py-2 text-xs text-brand-500">Sans recette : ${esc(sansRecette.join(', '))}</p>` : ''}
          ${besoins.length ? `<div class="px-4 py-3 border-t border-brand-100"><button type="button" data-stock="${c.stockDeduit ? 'rendre' : 'deduire'}" class="${BTN.secondaire} w-full">${c.stockDeduit ? '<i class="fa-solid fa-rotate-left"></i> Remettre les ingrédients en stock' : '<i class="fa-solid fa-minus"></i> Déduire les ingrédients du stock'}</button>
            ${!c.stockDeduit ? '<p class="text-xs text-brand-500 mt-2">Se fait automatiquement quand la commande passe à « Prête ».</p>' : ''}</div>` : ''}
        </section>

        <section>${champ({ id: 'cmd-notes', label: 'Notes pour moi', type: 'textarea', valeur: c.notes || '', attrs: 'placeholder="Décor, allergie, à rappeler…"' })}</section>
      </div>`;

    const pied = `<div class="flex gap-2">
      <button type="button" data-cmd="modifier" class="${BTN.sombre} flex-1"><i class="fa-solid fa-pen"></i> Modifier</button>
      <button type="button" data-cmd="dupliquer" class="${BTN.secondaire}" aria-label="Dupliquer"><i class="fa-regular fa-clone"></i></button>
      <button type="button" data-cmd="supprimer" class="${BTN.danger}" aria-label="Supprimer"><i class="fa-regular fa-trash-can"></i></button></div>`;

    ouvrirPanneau({ titre: `Commande ${c.numero || ''}`, contenu: corps, pied, onOuvert: (corpsEl, piedEl) => {
      corpsEl.onclick = async e => {
        const s = e.target.closest('[data-statut]');
        if (s) { await changerStatut(c, s.dataset.statut); dessiner(); return; }
        const cp = e.target.closest('[data-copier]');
        if (cp) { copier(cp.dataset.copier); return; }
        const st = e.target.closest('[data-stock]');
        if (st) {
          const deduire = st.dataset.stock === 'deduire';
          await lot([...operationsDeduction(c, deduire ? -1 : 1), { type: 'merge', col: 'commandes', id, data: { stockDeduit: deduire } }]);
          toast(deduire ? 'Ingrédients déduits du stock' : 'Ingrédients remis en stock');
          dessiner();
        }
      };
      $('#cmd-paye', corpsEl).onchange = async e => { await modifier('commandes', id, { paye: e.target.checked }); toast(e.target.checked ? 'Commande marquée payée' : 'Paiement retiré'); dessiner(); };
      $('#cmd-notes', corpsEl).onchange = async e => { await modifier('commandes', id, { notes: e.target.value }); toast('Note enregistrée'); };
      piedEl.onclick = async e => {
        const b = e.target.closest('[data-cmd]'); if (!b) return;
        if (b.dataset.cmd === 'modifier') formulaireCommande(c);
        if (b.dataset.cmd === 'dupliquer') { const { id: _, ...copie } = c; formulaireCommande({ ...copie, numero: '', statut: 'confirmee', dateRetrait: '', paye: false, acompte: 0, stockDeduit: false, source: 'manuel' }, true); }
        if (b.dataset.cmd === 'supprimer' && await confirmer(`Supprimer définitivement la commande ${c.numero || ''} de ${c.client?.nom || ''} ?`, { bouton: 'Supprimer', danger: true })) {
          await supprimer('commandes', id); fermerPanneau(); toast('Commande supprimée');
        }
      };
    } });
  };
  dessiner();
}

async function changerStatut(c, statut) {
  if (statut === c.statut) return;
  const ops = [{ type: 'merge', col: 'commandes', id: c.id, data: { statut } }];
  let message = `Commande : ${STATUTS[statut].label.toLowerCase()}`;
  // Déduction automatique du stock quand le gâteau est fait
  if (['prete', 'retiree'].includes(statut) && !c.stockDeduit) {
    const ded = operationsDeduction(c, -1);
    if (ded.length) { ops.push(...ded); ops[0].data.stockDeduit = true; message += ' · stock mis à jour'; }
  }
  // Annulation : on rend le stock s'il avait été déduit
  if (statut === 'annulee' && c.stockDeduit) {
    ops.push(...operationsDeduction(c, 1)); ops[0].data.stockDeduit = false; message += ' · ingrédients remis en stock';
  }
  if (statut === 'retiree' && !c.paye) ops[0].data.paye = true;
  await lot(ops);
  toast(message);
}

// ---------------------------------------------------------------
//  Formulaire création / modification
// ---------------------------------------------------------------
function formulaireCommande(existante = null, copie = false) {
  const p = parametres();
  const produits = liste('produits').sort((a, b) => (a.ordre || 99) - (b.ordre || 99));
  const creneaux = String(p.creneaux || '').split('\n').map(s => s.trim()).filter(Boolean);
  const edition = existante && !copie;
  let lignes = JSON.parse(JSON.stringify(existante?.lignes || [{ produitId: produits[0]?.id || null, titre: produits[0]?.titre || '', taille: produits[0]?.tailles ? TAILLES[1].label : (produits[0]?.unite || ''), parts: produits[0]?.tailles ? 8 : 1, qty: 1, prix: Number(produits[0]?.prix) || 0 }]));

  const optionsProduits = sel => [...produits.map(pr => `<option value="${pr.id}" ${pr.id === sel ? 'selected' : ''}>${esc(pr.titre)}</option>`), `<option value="" ${!sel ? 'selected' : ''}>Autre / sur mesure…</option>`].join('');

  const dessinerLignes = () => {
    $('#lignes').innerHTML = lignes.map((l, i) => {
      const pr = l.produitId ? db.produits[l.produitId] : null;
      return `<div class="bg-white rounded-xl border border-brand-200 p-3 space-y-2" data-ligne="${i}">
        <div class="flex gap-2">
          <select data-champ="produitId" class="flex-1 min-w-0 rounded-lg border border-brand-200 px-2.5 py-2 text-sm bg-white">${optionsProduits(l.produitId)}</select>
          <button type="button" data-suppr="${i}" class="${BTN.icone}" aria-label="Retirer ce gâteau" ${lignes.length < 2 ? 'disabled' : ''}><i class="fa-regular fa-trash-can"></i></button>
        </div>
        ${!pr ? `<input data-champ="titre" value="${esc(l.titre)}" placeholder="Description (ex. Gâteau licorne 20 parts)" class="w-full rounded-lg border border-brand-200 px-2.5 py-2 text-sm">` : ''}
        <div class="grid grid-cols-3 gap-2">
          ${pr?.tailles ? `<select data-champ="taille" class="col-span-3 sm:col-span-1 rounded-lg border border-brand-200 px-2 py-2 text-sm bg-white">${TAILLES.map(t => `<option ${t.label === l.taille ? 'selected' : ''}>${t.label}</option>`).join('')}</select>`
            : `<label class="col-span-3 sm:col-span-1 text-[11px] text-brand-500">Parts<input data-champ="parts" type="number" min="1" value="${l.parts || 1}" class="w-full rounded-lg border border-brand-200 px-2.5 py-2 text-sm text-brand-950"></label>`}
          <label class="text-[11px] text-brand-500 ${pr?.tailles ? 'col-span-1' : ''}">Quantité<input data-champ="qty" type="number" min="1" value="${l.qty}" class="w-full rounded-lg border border-brand-200 px-2.5 py-2 text-sm text-brand-950"></label>
          <label class="text-[11px] text-brand-500 col-span-2 sm:col-span-1">Prix unitaire (€)<input data-champ="prix" type="number" min="0" step="0.5" value="${l.prix}" class="w-full rounded-lg border border-brand-200 px-2.5 py-2 text-sm text-brand-950"></label>
        </div></div>`;
    }).join('');
    $('#total-form').textContent = euro(totalCommande(lignes));
  };

  const corps = `<form id="form-commande" class="space-y-5" novalidate>
    <section class="space-y-3">
      <h3 class="text-xs font-bold uppercase tracking-wider text-brand-500">Client</h3>
      ${champ({ id: 'f-nom', label: 'Nom', valeur: existante?.client?.nom || '', attrs: 'required autocomplete="off"' })}
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        ${champ({ id: 'f-tel', label: 'Téléphone', type: 'tel', valeur: existante?.client?.tel || '' })}
        ${champ({ id: 'f-email', label: 'E-mail', type: 'email', valeur: existante?.client?.email || '' })}
      </div>
    </section>
    <section class="space-y-3">
      <h3 class="text-xs font-bold uppercase tracking-wider text-brand-500">Retrait</h3>
      <div class="grid grid-cols-2 gap-3">
        ${champ({ id: 'f-date', label: 'Date', type: 'date', valeur: existante?.dateRetrait || '' })}
        ${champ({ id: 'f-heure', label: 'Créneau', valeur: existante?.heure || '', attrs: 'list="liste-creneaux" placeholder="ex. 10h00 - 11h30"' })}
      </div>
      <datalist id="liste-creneaux">${creneaux.map(c => `<option value="${esc(c)}"></option>`).join('')}</datalist>
    </section>
    <section class="space-y-3">
      <div class="flex items-center justify-between"><h3 class="text-xs font-bold uppercase tracking-wider text-brand-500">Gâteaux</h3><span class="text-sm">Total <strong id="total-form" class="tabular-nums"></strong></span></div>
      <div id="lignes" class="space-y-2"></div>
      <button type="button" id="ajout-ligne" class="${BTN.secondaire} w-full"><i class="fa-solid fa-plus"></i> Ajouter un gâteau</button>
    </section>
    <section class="space-y-3">
      <h3 class="text-xs font-bold uppercase tracking-wider text-brand-500">Suivi</h3>
      <div class="grid grid-cols-2 gap-3">
        ${selection({ id: 'f-statut', label: 'Statut', options: ORDRE_STATUTS.map(s => [s, STATUTS[s].label]), valeur: existante?.statut || 'confirmee' })}
        ${champ({ id: 'f-acompte', label: 'Acompte reçu (€)', type: 'number', valeur: existante?.acompte || 0, attrs: 'min="0" step="1"' })}
      </div>
      ${champ({ id: 'f-message', label: 'Demande du client', type: 'textarea', valeur: existante?.message || '', attrs: 'placeholder="Thème, inscription, allergies…"' })}
      ${champ({ id: 'f-notes', label: 'Notes pour moi', type: 'textarea', valeur: existante?.notes || '' })}
    </section>
    <p id="f-erreur" class="hidden text-sm text-red-700 bg-red-50 rounded-xl px-3 py-2"></p>
  </form>`;

  ouvrirPanneau({
    titre: edition ? `Modifier ${existante.numero || 'la commande'}` : 'Nouvelle commande',
    contenu: corps,
    pied: `<div class="flex gap-2"><button type="button" data-action="fermer-panneau" class="${BTN.secondaire}">Annuler</button><button type="submit" form="form-commande" class="${BTN.principal} flex-1">${edition ? 'Enregistrer' : 'Créer la commande'}</button></div>`,
    onOuvert: corpsEl => {
      dessinerLignes();
      $('#lignes').addEventListener('input', e => {
        const bloc = e.target.closest('[data-ligne]'); if (!bloc) return;
        const i = +bloc.dataset.ligne, champNom = e.target.dataset.champ, l = lignes[i];
        if (champNom === 'produitId') {
          const pr = db.produits[e.target.value];
          lignes[i] = pr ? { produitId: e.target.value, titre: pr.titre, taille: pr.tailles ? TAILLES[1].label : (pr.unite || ''), parts: pr.tailles ? 8 : (Number(db.recettes[e.target.value]?.rendement) || 1), qty: l.qty, prix: Number(pr.prix) || 0 }
            : { produitId: null, titre: '', taille: '', parts: 8, qty: l.qty, prix: 0 };
          dessinerLignes(); return;
        }
        if (champNom === 'taille') {
          const t = TAILLES.find(x => x.label === e.target.value); const pr = db.produits[l.produitId];
          l.taille = t.label; l.parts = t.parts; l.prix = Math.round((Number(pr?.prix) || 0) * t.mult * 2) / 2;
          dessinerLignes(); return;
        }
        if (['qty', 'parts', 'prix'].includes(champNom)) l[champNom] = Number(e.target.value) || 0;
        if (champNom === 'titre') l.titre = e.target.value;
        if (champNom === 'parts' && !l.produitId) l.taille = `${l.parts} parts`;
        $('#total-form').textContent = euro(totalCommande(lignes));
      });
      $('#lignes').addEventListener('click', e => {
        const s = e.target.closest('[data-suppr]'); if (!s || lignes.length < 2) return;
        lignes.splice(+s.dataset.suppr, 1); dessinerLignes();
      });
      $('#ajout-ligne').onclick = () => {
        const pr = produits[0];
        lignes.push(pr ? { produitId: pr.id, titre: pr.titre, taille: pr.tailles ? TAILLES[1].label : (pr.unite || ''), parts: pr.tailles ? 8 : 1, qty: 1, prix: Number(pr.prix) || 0 } : { produitId: null, titre: '', taille: '', parts: 8, qty: 1, prix: 0 });
        dessinerLignes();
      };
      $('#form-commande').onsubmit = async e => {
        e.preventDefault();
        const v = id => $('#' + id).value.trim();
        const err = $('#f-erreur');
        const lignesValides = lignes.filter(l => l.titre && l.qty > 0);
        const probleme = !v('f-nom') ? 'Indiquez le nom du client.' : !lignesValides.length ? 'Ajoutez au moins un gâteau avec une description.' : '';
        if (probleme) { err.textContent = probleme; err.classList.remove('hidden'); return; }
        const donnees = {
          ...(edition ? existante : {}),
          numero: edition ? existante.numero : prochainNumero(),
          client: { nom: v('f-nom'), tel: v('f-tel'), email: v('f-email') },
          dateRetrait: v('f-date'), heure: v('f-heure'),
          lignes: lignesValides, total: totalCommande(lignesValides),
          statut: v('f-statut'), acompte: Number(v('f-acompte')) || 0,
          message: v('f-message'), notes: v('f-notes'),
          source: edition ? (existante.source || 'manuel') : 'manuel',
          paye: edition ? !!existante.paye : false,
          stockDeduit: edition ? !!existante.stockDeduit : false,
          creeLe: edition ? (existante.creeLe || Date.now()) : Date.now()
        };
        delete donnees.id;
        let id;
        if (edition) { id = existante.id; await enregistrer('commandes', id, donnees); toast('Commande enregistrée'); }
        else { id = await creer('commandes', donnees); toast(`Commande ${donnees.numero} créée`); }
        ouvrirCommande(id);
      };
    }
  });
}
