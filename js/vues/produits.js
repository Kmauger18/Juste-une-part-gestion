// Produits : le catalogue affiché sur le site
import { liste, obtenir, creer, enregistrer, modifier, supprimer, importerCatalogueSite, mode, db, messageErreur } from '../store.js';
import { CATEGORIES, ALLERGENES, TAILLES, categorieActuelle } from '../donnees.js';
import { $, $$, esc, euro, toast, ouvrirPanneau, fermerPanneau, confirmer, champ, selection, interrupteur, etatVide, compresserImage, BTN } from '../ui.js';
import { margeProduit } from '../calculs.js';
import * as brouillon from '../brouillon.js';

let categorie = 'toutes';

function slug(t) {
  return String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 28) || 'gateau';
}

function badgeMarge(id) {
  const m = margeProduit(id);
  if (!m) return '<span class="text-[11px] text-brand-400">Pas de recette</span>';
  const couleur = m.taux >= 0.6 ? 'text-emerald-700 bg-emerald-50' : m.taux >= 0.4 ? 'text-amber-700 bg-amber-50' : 'text-red-700 bg-red-50';
  return `<span class="text-[11px] font-semibold px-2 py-0.5 rounded-full ${couleur}" title="Coût de revient ${euro(m.cout)} pour ${m.parts} parts">Marge ${Math.round(m.taux * 100)} %</span>`;
}

export default {
  render(el, { param, changementDeRoute }) {
    const tous = liste('produits').sort((a, b) => (a.ordre || 99) - (b.ordre || 99) || a.titre.localeCompare(b.titre));
    const produits = categorie === 'toutes' ? tous : categorie === 'moment' ? tous.filter(p => p.vedette) : tous.filter(p => categorieActuelle(p.categorie) === categorie);
    const cats = Object.keys(CATEGORIES).filter(c => tous.some(p => categorieActuelle(p.categorie) === c));

    el.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-3 mb-2">
        <h1 class="hidden lg:block font-display text-3xl">Produits</h1>
        <button type="button" data-p="nouveau" class="${BTN.principal} w-full sm:w-auto"><i class="fa-solid fa-plus"></i> Nouveau gâteau</button>
      </div>
      ${mode === 'demo' ? `<div class="mb-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 text-sm flex gap-3"><i class="fa-solid fa-triangle-exclamation mt-0.5"></i><span><strong>Mode démo :</strong> les modifications restent sur cet appareil et <strong>n'apparaissent pas sur le site</strong>. Elles s'afficheront sur le site une fois Firebase configuré (voir GUIDE-FIREBASE.md).</span></div>` : ''}
      <p class="text-sm text-brand-600 mb-5">Ce qui est visible ici apparaît sur le site, dans cet ordre. <i class="fa-solid fa-star text-gold"></i> = dans la famille « En ce moment » de la page d'accueil.</p>
      ${tous.length ? `
      <div class="flex gap-2 overflow-x-auto pb-1 mb-5 -mx-4 px-4 sm:mx-0 sm:px-0">
        ${[['toutes', 'Tous'], ['moment', 'En ce moment'], ...cats.map(c => [c, CATEGORIES[c]])].map(([k, l]) => `<button type="button" data-cat="${k}" class="flex-none px-3.5 py-2 rounded-full text-sm font-semibold ${k === categorie ? 'bg-brand-900 text-white' : 'bg-white border border-brand-200 text-brand-700'}">${esc(l)}</button>`).join('')}
      </div>
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        ${produits.map(p => `
        <article class="min-w-0 bg-white rounded-2xl border border-brand-200 overflow-hidden flex flex-col ${p.visible === false ? 'opacity-60' : ''}">
          <button type="button" data-editer="${p.id}" class="relative block aspect-[16/10] bg-brand-100" aria-label="Modifier ${esc(p.titre)}">
            ${p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy" class="w-full h-full object-cover">` : '<span class="absolute inset-0 grid place-items-center text-brand-300 text-4xl"><i class="fa-solid fa-image"></i></span>'}
            ${p.badge ? `<span class="absolute top-2 left-2 bg-brand-950/85 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full">${esc(p.badge)}</span>` : ''}
            ${p.visible === false ? '<span class="absolute top-2 right-2 bg-white text-brand-800 text-[11px] font-bold px-2 py-1 rounded-full"><i class="fa-regular fa-eye-slash"></i> Masqué</span>' : ''}
          </button>
          <div class="p-4 flex-1 flex flex-col gap-2">
            <div class="flex items-start justify-between gap-2">
              <button type="button" data-editer="${p.id}" class="text-left font-semibold leading-snug hover:text-terracotta">${esc(p.titre)}</button>
              <button type="button" data-vedette="${p.id}" class="${BTN.icone} -mt-1 -mr-1 flex-none" aria-label="${p.vedette ? 'Retirer de' : 'Ajouter à'} « En ce moment »" title="${p.vedette ? 'Dans « En ce moment »' : 'Ajouter à « En ce moment »'}"><i class="${p.vedette ? 'fa-solid text-gold' : 'fa-regular'} fa-star"></i></button>
            </div>
            <div class="text-xs text-brand-500">${esc(CATEGORIES[categorieActuelle(p.categorie)])}</div>
            <div class="mt-auto pt-2 flex items-center justify-between gap-2">
              <span class="font-display text-xl tabular-nums">${p.tailles ? '<span class="text-xs font-sans text-brand-500">dès </span>' + euro(p.prix * TAILLES[0].mult) : euro(p.prix)}</span>
              ${badgeMarge(p.id)}
            </div>
            <div class="flex items-center justify-between gap-2 pt-2 border-t border-brand-100">
              <label class="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" data-visible="${p.id}" ${p.visible !== false ? 'checked' : ''} class="w-4 h-4 accent-terracotta"> Visible sur le site</label>
              <a href="#recettes/${p.id}" class="text-xs font-semibold text-terracotta hover:underline">Recette</a>
            </div>
          </div>
        </article>`).join('')}
      </div>` : etatVide({ icone: 'fa-solid fa-cake-candles', titre: 'Aucun gâteau pour l\'instant', texte: 'Importez les gâteaux déjà présents sur le site pour démarrer, puis modifiez-les à votre goût.', action: `<button type="button" data-p="importer" class="${BTN.principal}"><i class="fa-solid fa-file-import"></i> Importer le catalogue du site</button>` })}`;

    el.onclick = async e => {
      const t = e.target;
      const c = t.closest('[data-cat]'); if (c) { categorie = c.dataset.cat; this.render(el, {}); return; }
      const ed = t.closest('[data-editer]'); if (ed) { formulaireProduit(obtenir('produits', ed.dataset.editer)); return; }
      const v = t.closest('[data-vedette]');
      if (v) { const p = obtenir('produits', v.dataset.vedette); await modifier('produits', p.id, { vedette: !p.vedette }); toast(p.vedette ? 'Retiré de « En ce moment »' : 'Ajouté à « En ce moment »'); return; }
      const a = t.closest('[data-p]');
      if (a?.dataset.p === 'nouveau') formulaireProduit(null);
      if (a?.dataset.p === 'importer') {
        a.disabled = true; a.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Import en cours…';
        try { const r = await importerCatalogueSite(); toast(r === 'attente' ? 'Catalogue enregistré sur l\'appareil, synchronisation en cours…' : 'Catalogue d\'origine importé'); }
        catch (err) { toast(messageErreur(err), 'erreur'); a.disabled = false; a.innerHTML = '<i class="fa-solid fa-file-import"></i> Importer le catalogue du site'; }
      }
    };
    el.onchange = async e => {
      const v = e.target.closest('[data-visible]');
      if (v) { await modifier('produits', v.dataset.visible, { visible: v.checked }); toast(v.checked ? 'Visible sur le site' : 'Masqué du site'); }
    };

    if (changementDeRoute && param) {
      if (param === 'nouveau') formulaireProduit(null);
      else if (obtenir('produits', param)) formulaireProduit(obtenir('produits', param));
    }
  }
};

export function formulaireProduit(p, reprise = null) {
  const edition = !!p;
  p = p || { titre: '', categorie: 'tartes', prix: 25, badge: '', image: '', accroche: '', description: '', ingredients: '', allergenes: [], tailles: true, unite: '', conservation: '', delai: 'À commander 48 h à l\'avance.', sansGluten: false, visible: true, vedette: false, ordre: liste('produits').length + 1 };
  let image = reprise?.extra?.image ?? (p.image || '');

  const corps = `<form id="form-produit" class="space-y-6" novalidate>
    <section class="space-y-3">
      <div class="relative aspect-[16/10] rounded-2xl overflow-hidden bg-brand-100 border border-brand-200">
        <img id="apercu-image" src="${esc(image)}" alt="" class="w-full h-full object-cover ${image ? '' : 'hidden'}">
        <div id="sans-image" class="absolute inset-0 grid place-items-center text-brand-400 text-sm ${image ? 'hidden' : ''}"><span><i class="fa-solid fa-image text-3xl block text-center mb-2"></i>Pas encore de photo</span></div>
      </div>
      <div class="flex gap-2">
        <label class="${BTN.sombre} flex-1 cursor-pointer"><i class="fa-solid fa-camera"></i> Appareil photo<input type="file" id="pr-camera" accept="image/*" capture="environment" class="sr-only"></label>
        <label class="${BTN.secondaire} flex-1 cursor-pointer"><i class="fa-regular fa-images"></i> Galerie<input type="file" id="pr-fichier" accept="image/*" class="sr-only"></label>
        <button type="button" id="pr-retirer-image" class="${BTN.secondaire}">Retirer</button>
      </div>
      <details class="text-sm"><summary class="cursor-pointer text-brand-600">Ou coller l'adresse d'une image</summary><div class="mt-2">${champ({ id: 'pr-url', label: 'Adresse de l\'image (https://…)', type: 'url', valeur: image.startsWith('data:') ? '' : image })}</div></details>
      <p class="text-xs text-brand-500">Les photos prises au téléphone sont réduites automatiquement pour que le site reste rapide.</p>
    </section>

    <section class="space-y-3">
      ${champ({ id: 'pr-titre', label: 'Nom du gâteau', valeur: p.titre, attrs: 'required' })}
      ${champ({ id: 'pr-accroche', label: 'Phrase d\'accroche', valeur: p.accroche, attrs: 'placeholder="ex. La tarte renversée, comme à la maison"' })}
      <div class="grid grid-cols-2 gap-3">
        ${selection({ id: 'pr-categorie', label: 'Catégorie', options: Object.entries(CATEGORIES), valeur: categorieActuelle(p.categorie) })}
        ${champ({ id: 'pr-badge', label: 'Étiquette', valeur: p.badge, attrs: 'placeholder="ex. Nouveauté"' })}
      </div>
      ${champ({ id: 'pr-description', label: 'Description', type: 'textarea', valeur: p.description })}
    </section>

    <section class="space-y-3 bg-white rounded-2xl border border-brand-200 p-4">
      <h3 class="text-xs font-bold uppercase tracking-wider text-brand-500">Prix et format</h3>
      ${interrupteur({ id: 'pr-tailles', label: 'Proposer 3 tailles', coche: !!p.tailles, aide: '4 parts, 6 à 8 parts et 10 à 12 parts. Le prix ci-dessous est celui pour 6 à 8 parts.' })}
      <div class="grid grid-cols-2 gap-3">
        ${champ({ id: 'pr-prix', label: 'Prix (€)', type: 'number', valeur: p.prix, attrs: 'min="0" step="0.5" required' })}
        <div id="bloc-unite" class="${p.tailles ? 'hidden' : ''}">${champ({ id: 'pr-unite', label: 'Format vendu', valeur: p.unite, attrs: 'placeholder="ex. le coffret de 12"' })}</div>
      </div>
      <div id="prix-tailles" class="text-xs text-brand-600 ${p.tailles ? '' : 'hidden'}"></div>
      <div id="info-marge" class="text-xs"></div>
    </section>

    <section class="space-y-3">
      <h3 class="text-xs font-bold uppercase tracking-wider text-brand-500">Composition</h3>
      ${champ({ id: 'pr-ingredients', label: 'Ingrédients (texte affiché sur le site)', type: 'textarea', valeur: p.ingredients })}
      <fieldset><legend class="text-xs font-semibold text-brand-700 mb-2">Allergènes</legend>
        <div class="flex flex-wrap gap-2">${ALLERGENES.map(a => `<label class="cursor-pointer"><input type="checkbox" name="allergene" value="${esc(a)}" class="peer sr-only" ${(p.allergenes || []).includes(a) ? 'checked' : ''}><span class="inline-block px-3 py-1.5 rounded-full border text-sm border-brand-200 bg-white text-brand-700 peer-checked:bg-amber-100 peer-checked:border-amber-300 peer-checked:text-amber-900 peer-focus-visible:ring-2 peer-focus-visible:ring-terracotta">${esc(a)}</span></label>`).join('')}</div>
      </fieldset>
      ${interrupteur({ id: 'pr-sansgluten', label: 'Recette sans gluten', coche: !!p.sansGluten, aide: 'Le gâteau apparaît dans le filtre « Sans gluten » du site.' })}
    </section>

    <section class="space-y-3">
      <h3 class="text-xs font-bold uppercase tracking-wider text-brand-500">Infos pratiques</h3>
      ${champ({ id: 'pr-conservation', label: 'Conservation et service', type: 'textarea', valeur: p.conservation })}
      ${champ({ id: 'pr-delai', label: 'Délai de commande', valeur: p.delai })}
    </section>

    <section class="space-y-1 bg-white rounded-2xl border border-brand-200 px-4 py-2">
      ${interrupteur({ id: 'pr-visible', label: 'Visible sur le site', coche: p.visible !== false })}
      ${interrupteur({ id: 'pr-vedette', label: 'En ce moment', coche: !!p.vedette, aide: 'Apparaît aussi dans la famille « En ce moment » de la page d\'accueil.' })}
      <div class="py-2">${champ({ id: 'pr-ordre', label: 'Position dans la carte', type: 'number', valeur: p.ordre || 1, attrs: 'min="1" step="1"', aide: '1 = en premier.' })}</div>
    </section>
    <p id="pr-erreur" class="hidden text-sm text-red-700 bg-red-50 rounded-xl px-3 py-2"></p>
  </form>`;

  ouvrirPanneau({
    titre: edition ? 'Modifier le gâteau' : 'Nouveau gâteau',
    contenu: corps,
    pied: `<div class="flex gap-2">${edition ? `<button type="button" id="pr-supprimer" class="${BTN.danger}" aria-label="Supprimer"><i class="fa-regular fa-trash-can"></i></button>` : ''}<button type="button" data-action="fermer-panneau" class="${BTN.secondaire}">Annuler</button><button type="submit" form="form-produit" class="${BTN.principal} flex-1">Enregistrer</button></div>`,
    onOuvert: (corpsEl, piedEl) => {
      const majImage = url => {
        image = url || '';
        $('#apercu-image').src = image; $('#apercu-image').classList.toggle('hidden', !image); $('#sans-image').classList.toggle('hidden', !!image);
      };
      const majPrix = () => {
        const prix = Number($('#pr-prix').value) || 0, tailles = $('#pr-tailles').checked;
        $('#prix-tailles').classList.toggle('hidden', !tailles); $('#bloc-unite').classList.toggle('hidden', tailles);
        $('#prix-tailles').innerHTML = TAILLES.map(t => `${t.label} : <strong>${euro(Math.round(prix * t.mult * 2) / 2)}</strong>`).join(' · ');
        const m = edition ? margeProduit(p.id) : null;
        $('#info-marge').innerHTML = m ? `Coût de revient (recette) : <strong>${euro(m.cout)}</strong> pour ${m.parts} parts · marge <strong>${euro(prix - m.cout)}</strong> (${prix ? Math.round((prix - m.cout) / prix * 100) : 0} %)` : (edition ? `<a href="#recettes/${p.id}" class="text-terracotta font-semibold hover:underline">Ajouter la recette</a> pour calculer le coût de revient.` : '');
      };
      majPrix();
      $('#pr-prix').oninput = majPrix; $('#pr-tailles').onchange = majPrix;
      $('#pr-fichier').onchange = $('#pr-camera').onchange = async e => {
        const f = e.target.files[0]; if (!f) return;
        try { majImage(await compresserImage(f)); toast('Photo ajoutée'); brouillon.planifier(); } catch (err) { toast(err.message, 'erreur'); }
        e.target.value = '';
      };
      $('#pr-url').oninput = e => majImage(e.target.value.trim());
      $('#pr-retirer-image').onclick = () => { majImage(''); $('#pr-url').value = ''; };
      brouillon.demarrer({ type: 'produit', args: { id: edition ? p.id : null }, racine: corpsEl, extra: () => ({ image }) });
      if (reprise) { brouillon.appliquerChamps(corpsEl, reprise.champs); majImage(image); majPrix(); }
      const sup = $('#pr-supprimer', piedEl);
      if (sup) sup.onclick = async () => {
        if (await confirmer(`Supprimer « ${p.titre} » du catalogue ? Il disparaîtra du site. Les commandes passées ne sont pas modifiées.`, { bouton: 'Supprimer', danger: true })) {
          brouillon.terminer(); await supprimer('produits', p.id); fermerPanneau(); toast('Gâteau supprimé');
        }
      };
      $('#form-produit').onsubmit = async e => {
        e.preventDefault();
        const v = id => $('#' + id).value.trim();
        if (!v('pr-titre')) { $('#pr-erreur').textContent = 'Donnez un nom au gâteau.'; $('#pr-erreur').classList.remove('hidden'); return; }
        const donnees = {
          titre: v('pr-titre'), accroche: v('pr-accroche'), categorie: v('pr-categorie'), badge: v('pr-badge'),
          description: v('pr-description'), prix: Number(v('pr-prix')) || 0, tailles: $('#pr-tailles').checked, unite: v('pr-unite'),
          ingredients: v('pr-ingredients'), allergenes: $$('input[name=allergene]:checked').map(i => i.value),
          sansGluten: $('#pr-sansgluten').checked, conservation: v('pr-conservation'), delai: v('pr-delai'),
          visible: $('#pr-visible').checked, vedette: $('#pr-vedette').checked, ordre: Number(v('pr-ordre')) || 99, image
        };
        if (JSON.stringify(donnees).length > 900000) { toast('La photo est trop lourde, choisissez-en une autre.', 'erreur'); return; }
        if (edition) { await enregistrer('produits', p.id, donnees); toast('Gâteau enregistré'); }
        else { let id = slug(donnees.titre); if (db.produits[id]) id += '-' + Math.random().toString(36).slice(2, 5); await creer('produits', donnees, id); toast('Gâteau ajouté au catalogue'); }
        brouillon.terminer(); fermerPanneau();
      };
    }
  });
}
