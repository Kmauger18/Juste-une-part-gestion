// Tableau de bord
import { liste, parametres } from '../store.js';
import { esc, euro, isoJour, ajouterJours, ecartJours, versDate, badgeStatut, BTN } from '../ui.js';
import { chiffreAffaires, caParSemaine, produitsLesPlusVendus, stockBas, besoinsCommandes, resteAEncaisser, formaterQuantite, alertesMateriel } from '../calculs.js';
import { ouvrirCommande } from './commandes.js';

function dateCourteJ(iso) { return versDate(iso).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }); }

function jourCourt(iso) {
  if (!iso) return '—';
  const e = ecartJours(iso);
  if (e === 0) return 'Auj.';
  if (e === 1) return 'Demain';
  return versDate(iso).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
}

function tuile({ libelle, valeur, detail = '', icone, lien = '', accent = false }) {
  const balise = lien ? 'a' : 'div';
  return `<${balise} ${lien ? `href="${lien}"` : ''} class="block rounded-2xl p-4 sm:p-5 ${accent ? 'bg-brand-900 text-white' : 'bg-white border border-brand-200'} ${lien ? 'hover:shadow-md transition-shadow' : ''}">
    <div class="flex items-start justify-between gap-2">
      <span class="text-xs font-semibold ${accent ? 'text-brand-300' : 'text-brand-600'}">${libelle}</span>
      <i class="${icone} ${accent ? 'text-gold' : 'text-terracotta'}"></i>
    </div>
    <div class="font-display text-2xl sm:text-3xl mt-2 tabular-nums">${valeur}</div>
    ${detail ? `<div class="text-xs mt-1 ${accent ? 'text-brand-300' : 'text-brand-500'}">${detail}</div>` : ''}
  </${balise}>`;
}

function graphique(semaines) {
  const max = Math.max(...semaines.map(s => s.total), 1);
  const H = 140, L = 40, W = 32 * semaines.length + 8;
  const p10 = Math.pow(10, Math.floor(Math.log10(max)));
  const haut = [1, 2, 2.5, 5, 10].map(m => m * p10).find(v => v >= max);
  const y = v => H - (v / haut) * H;
  const lignes = [0, haut / 2, haut].map(v => `<line x1="${L}" x2="${L + W}" y1="${y(v) + 10}" y2="${y(v) + 10}" stroke="currentColor" class="text-brand-200" stroke-dasharray="${v ? '3 4' : ''}"/><text x="${L - 6}" y="${y(v) + 14}" text-anchor="end" class="fill-brand-500" font-size="10">${Math.round(v)} €</text>`).join('');
  const barres = semaines.map((s, i) => {
    const x = L + 8 + i * 32, h = Math.max(s.total ? 3 : 0, (s.total / haut) * H);
    const derniere = i === semaines.length - 1;
    const dd = new Date(s.debut + 'T12:00'); const etiquette = `${dd.getDate()}/${dd.getMonth() + 1}`;
    return `<g><title>Semaine du ${dd.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} : ${euro(s.total)}</title>
      <rect x="${x}" y="${H - h + 10}" width="22" height="${h}" rx="5" class="${derniere ? 'fill-terracotta' : 'fill-brand-300'}"/>
      ${derniere && s.total ? `<text x="${x + 11}" y="${H - h + 4}" text-anchor="middle" font-size="10" font-weight="700" class="fill-brand-900">${Math.round(s.total)} €</text>` : ''}
      <text x="${x + 11}" y="${H + 26}" text-anchor="middle" font-size="9.5" class="fill-brand-500">${etiquette}</text></g>`;
  }).join('');
  return `<div class="overflow-x-auto"><svg viewBox="0 0 ${L + W + 4} ${H + 34}" class="w-full h-auto max-h-60 mx-auto" role="img" aria-label="Chiffre d'affaires des 8 dernières semaines">${lignes}${barres}</svg></div>`;
}

export default {
  render(el) {
    const auj = isoJour();
    const d = new Date();
    const debutMois = isoJour(new Date(d.getFullYear(), d.getMonth(), 1));
    const finMois = isoJour(new Date(d.getFullYear(), d.getMonth() + 1, 0));
    const debutMoisPrec = isoJour(new Date(d.getFullYear(), d.getMonth() - 1, 1));
    const finMoisPrec = isoJour(new Date(d.getFullYear(), d.getMonth(), 0));
    const caMois = chiffreAffaires(debutMois, finMois);
    const caPrec = chiffreAffaires(debutMoisPrec, finMoisPrec);
    const evolution = caPrec ? Math.round((caMois - caPrec) / caPrec * 100) : null;

    const toutes = liste('commandes');
    const nouvelles = toutes.filter(c => c.statut === 'nouvelle').sort((a, b) => (a.dateRetrait || '').localeCompare(b.dateRetrait || ''));
    const dans7 = ajouterJours(auj, 7);
    const aVenir = toutes.filter(c => ['confirmee', 'preparation', 'prete'].includes(c.statut) && c.dateRetrait && c.dateRetrait <= dans7)
      .sort((a, b) => (a.dateRetrait + (a.heure || '')).localeCompare(b.dateRetrait + (b.heure || '')));
    const aujourdHui = aVenir.filter(c => c.dateRetrait <= auj);
    const besoins = besoinsCommandes(aVenir.filter(c => c.statut !== 'prete'));
    const manques = besoins.lignes.filter(l => l.manque > 0);
    const bas = stockBas();
    const alertesMat = alertesMateriel(7);
    const horsService = liste('materiel').filter(m => (Number(m.quantite) || 0) <= 0);
    const top = produitsLesPlusVendus(90, 5);
    const nomMois = d.toLocaleDateString('fr-FR', { month: 'long' });
    const salut = d.getHours() < 18 ? 'Bonjour' : 'Bonsoir';
    const p = parametres();

    const ligneCommande = c => `
      <button type="button" data-ouvrir="${c.id}" class="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-brand-50 transition-colors">
        <div class="w-12 flex-none text-center"><div class="text-[11px] font-semibold text-brand-500">${esc(jourCourt(c.dateRetrait))}</div><div class="text-xs font-bold text-brand-900">${esc((c.heure || '').split(' ')[0] || '—')}</div></div>
        <div class="min-w-0 flex-1"><div class="font-semibold text-sm truncate">${esc(c.client?.nom || 'Client')}</div><div class="text-xs text-brand-600 truncate">${esc((c.lignes || []).map(l => `${l.qty} × ${l.titre}`).join(', '))}</div></div>
        <div class="flex flex-col items-end gap-1 flex-none">${badgeStatut(c.statut, true)}<span class="text-xs font-semibold tabular-nums">${euro(c.total)}</span></div>
      </button>`;

    el.innerHTML = `
      <div class="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <p class="text-sm text-brand-600">${salut} Élodie,</p>
          <h1 class="font-display text-3xl sm:text-4xl text-brand-950">${aujourdHui.length ? `${aujourdHui.length} retrait${aujourdHui.length > 1 ? 's' : ''} aujourd'hui` : 'Rien à remettre aujourd\'hui'}</h1>
        </div>
        <a href="#commandes/nouvelle" class="${BTN.principal}"><i class="fa-solid fa-plus"></i> Nouvelle commande</a>
      </div>

      ${p.commandesOuvertes === false ? `<div class="mb-5 rounded-2xl bg-red-50 border border-red-200 text-red-800 px-4 py-3 text-sm flex items-center gap-3"><i class="fa-solid fa-store-slash"></i><span class="flex-1">Les commandes sont <strong>fermées</strong> sur le site.</span><a href="#parametres" class="font-semibold underline">Modifier</a></div>` : ''}

      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        ${tuile({ libelle: `Chiffre d'affaires de ${nomMois}`, valeur: euro(caMois, 0), detail: evolution === null ? 'Commandes confirmées' : `${evolution >= 0 ? '+' : ''}${evolution} % par rapport au mois dernier`, icone: 'fa-solid fa-euro-sign', accent: true })}
        ${tuile({ libelle: 'Nouvelles demandes', valeur: nouvelles.length, detail: nouvelles.length ? 'À confirmer' : 'Tout est traité', icone: 'fa-solid fa-inbox', lien: '#commandes' })}
        ${tuile({ libelle: 'Retraits sur 7 jours', valeur: aVenir.length, detail: euro(aVenir.reduce((s, c) => s + (Number(c.total) || 0), 0), 0) + ' au total', icone: 'fa-solid fa-calendar-day', lien: '#commandes' })}
        ${tuile({ libelle: 'Reste à encaisser', valeur: euro(resteAEncaisser(), 0), detail: 'Commandes en cours non payées', icone: 'fa-solid fa-wallet' })}
      </div>

      <div class="grid lg:grid-cols-5 gap-4 sm:gap-5 mt-5">
        <section class="lg:col-span-3 space-y-5 min-w-0">
          ${nouvelles.length ? `
          <div class="bg-white rounded-2xl border-2 border-sky-200 overflow-hidden">
            <div class="flex items-center justify-between px-4 py-3 bg-sky-50 border-b border-sky-100">
              <h2 class="font-semibold text-sky-900 flex items-center gap-2"><i class="fa-solid fa-bell"></i> À confirmer</h2>
              <a href="#commandes" class="text-xs font-semibold text-sky-800 hover:underline">Tout voir</a>
            </div>
            <div class="divide-y divide-brand-100">${nouvelles.slice(0, 5).map(ligneCommande).join('')}</div>
          </div>` : ''}

          <div class="bg-white rounded-2xl border border-brand-200 overflow-hidden">
            <div class="flex items-center justify-between px-4 py-3 border-b border-brand-100">
              <h2 class="font-semibold">Prochains retraits</h2>
              <a href="#commandes" class="text-xs font-semibold text-terracotta hover:underline">Toutes les commandes</a>
            </div>
            ${aVenir.length ? `<div class="divide-y divide-brand-100">${aVenir.slice(0, 8).map(ligneCommande).join('')}</div>` : '<p class="px-4 py-8 text-sm text-center text-brand-500">Aucun retrait prévu dans les 7 prochains jours.</p>'}
          </div>

          <div class="bg-white rounded-2xl border border-brand-200 p-4 sm:p-5">
            <div class="flex items-baseline justify-between mb-3"><h2 class="font-semibold">Chiffre d'affaires par semaine</h2><span class="text-xs text-brand-500">8 dernières semaines</span></div>
            ${graphique(caParSemaine(8))}
          </div>
        </section>

        <section class="lg:col-span-2 space-y-5 min-w-0">
          <div class="bg-white rounded-2xl border border-brand-200 overflow-hidden">
            <div class="px-4 py-3 border-b border-brand-100"><h2 class="font-semibold">À acheter pour la semaine</h2><p class="text-xs text-brand-500">D'après les recettes des commandes à préparer</p></div>
            ${manques.length ? `<ul class="divide-y divide-brand-100">${manques.map(m => `<li class="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"><span class="font-medium">${esc(m.nom)}</span><span class="text-red-700 font-semibold tabular-nums whitespace-nowrap">manque ${formaterQuantite(m.manque, m.unite)}</span></li>`).join('')}</ul>`
              : `<p class="px-4 py-5 text-sm text-emerald-700 flex items-center gap-2"><i class="fa-solid fa-circle-check"></i> Le stock couvre les commandes à venir.</p>`}
            ${besoins.sansRecette.length ? `<p class="px-4 py-2.5 text-xs text-brand-500 bg-brand-50 border-t border-brand-100">Sans recette, non comptés : ${esc(besoins.sansRecette.join(', '))}</p>` : ''}
          </div>

          ${alertesMat.length || horsService.length ? `<div class="bg-white rounded-2xl border border-red-200 overflow-hidden">
            <div class="flex items-center justify-between px-4 py-3 border-b border-red-100 bg-red-50"><h2 class="font-semibold text-red-900 flex items-center gap-2"><i class="fa-solid fa-whisk"></i> Matériel</h2><a href="#stock/materiel" class="text-xs font-semibold text-red-800 hover:underline">Voir le matériel</a></div>
            <ul class="divide-y divide-brand-100 text-sm">
              ${alertesMat.map(a => `<li class="px-4 py-2.5"><span class="font-medium">${esc(a.nom)}</span><span class="block text-xs text-red-700">${esc(dateCourteJ(a.jour))} : ${a.besoin} nécessaires, ${a.dispo} disponible${a.dispo > 1 ? 's' : ''}</span></li>`).join('')}
              ${horsService.filter(m => !alertesMat.some(a => a.id === m.id)).map(m => `<li class="flex items-center justify-between gap-3 px-4 py-2.5"><span class="font-medium">${esc(m.nom)}</span><span class="text-xs text-brand-500 whitespace-nowrap">indisponible</span></li>`).join('')}
            </ul></div>` : ''}

          <div class="bg-white rounded-2xl border border-brand-200 overflow-hidden">
            <div class="flex items-center justify-between px-4 py-3 border-b border-brand-100"><h2 class="font-semibold">Stock bas</h2><a href="#stock" class="text-xs font-semibold text-terracotta hover:underline">Gérer le stock</a></div>
            ${bas.length ? `<ul class="divide-y divide-brand-100">${bas.map(i => `<li class="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"><span class="font-medium">${esc(i.nom)}</span><span class="text-amber-700 font-semibold tabular-nums whitespace-nowrap">${formaterQuantite(i.quantite, i.unite)}</span></li>`).join('')}</ul>`
              : '<p class="px-4 py-5 text-sm text-brand-500">Aucun ingrédient sous son seuil d\'alerte.</p>'}
          </div>

          <div class="bg-white rounded-2xl border border-brand-200 overflow-hidden">
            <div class="px-4 py-3 border-b border-brand-100"><h2 class="font-semibold">Meilleures ventes</h2><p class="text-xs text-brand-500">3 derniers mois</p></div>
            ${top.length ? `<ol class="divide-y divide-brand-100">${top.map((t, i) => `<li class="flex items-center gap-3 px-4 py-2.5 text-sm"><span class="w-6 h-6 rounded-full ${i === 0 ? 'bg-gold text-brand-950' : 'bg-brand-100 text-brand-700'} text-xs font-bold grid place-items-center flex-none">${i + 1}</span><span class="flex-1 min-w-0 truncate">${esc(t.titre)}</span><span class="text-xs text-brand-500 whitespace-nowrap">${t.qty} vendu${t.qty > 1 ? 's' : ''}</span><span class="font-semibold tabular-nums whitespace-nowrap">${euro(t.total, 0)}</span></li>`).join('')}</ol>`
              : '<p class="px-4 py-5 text-sm text-brand-500">Pas encore de ventes sur la période.</p>'}
          </div>
        </section>
      </div>`;

    el.onclick = e => {
      const b = e.target.closest('[data-ouvrir]');
      if (b) ouvrirCommande(b.dataset.ouvrir);
    };
  }
};
