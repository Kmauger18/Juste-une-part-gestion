// Importer une recette depuis un lien (Marmiton, 750g, Cuisine AZ, Journal
// des Femmes, Ricardo, blogs…) ou depuis un texte collé.
//
// La plupart des sites de recettes décrivent leur recette dans un bloc
// standard (schema.org « Recipe ») : nom, parts, temps, ingrédients, étapes,
// photo. On le lit, on rapproche chaque ingrédient du stock, puis on ouvre la
// page de modification déjà remplie : rien n'est enregistré sans validation.
import { liste, creer, db } from './store.js';
import { $, $$, esc, toast, ouvrirPanneau, fermerPanneau, compresserImage, BTN } from './ui.js';

// ---------- Téléchargement de la page ----------
// Dans l'application Android : requête directe par le téléphone (aucune limite).
// Dans un navigateur : les sites bloquent la lecture directe, on passe par un relais public.
const RELAIS = [
  u => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u),
  u => 'https://corsproxy.io/?url=' + encodeURIComponent(u),
  u => 'https://api.codetabs.com/v1/proxy/?quest=' + encodeURIComponent(u)
];
const AGENT = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36';
const httpNatif = () => { const c = window.Capacitor; return c?.isNativePlatform?.() && c.Plugins?.CapacitorHttp ? c.Plugins.CapacitorHttp : null; };
const delai = ms => (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) ? AbortSignal.timeout(ms) : undefined;

async function telechargerTexte(url) {
  const natif = httpNatif();
  if (natif) {
    try {
      const r = await natif.request({ url, method: 'GET', headers: { 'User-Agent': AGENT, 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'fr-FR,fr;q=0.9' }, responseType: 'text', connectTimeout: 15000, readTimeout: 20000 });
      if (r.status >= 200 && r.status < 400 && typeof r.data === 'string' && r.data.length > 200) return r.data;
    } catch (e) { /* on essaie les relais */ }
  }
  for (const relais of RELAIS) {
    try {
      const res = await fetch(relais(url), { signal: delai(15000) });
      if (res.ok) { const t = await res.text(); if (t.length > 200) return t; }
    } catch (e) { /* relais suivant */ }
  }
  throw new Error('Impossible d\'ouvrir cette page. Vérifiez le lien et la connexion internet, ou collez le texte de la recette.');
}

async function telechargerImage(url) {
  try {
    let blob = null;
    const natif = httpNatif();
    if (natif) {
      const r = await natif.request({ url, method: 'GET', headers: { 'User-Agent': AGENT }, responseType: 'blob', connectTimeout: 15000, readTimeout: 20000 });
      if (r.status < 400 && r.data) blob = await (await fetch('data:image/jpeg;base64,' + String(r.data).replace(/^data:[^,]*,/, ''))).blob();
    }
    if (!blob) {
      for (const relais of [u => u, ...RELAIS]) {
        try { const res = await fetch(relais(url), { signal: delai(15000) }); if (res.ok) { const b = await res.blob(); if (b.size > 1000 && /^image\//.test(b.type || 'image/')) { blob = b; break; } } } catch (e) {}
      }
    }
    if (!blob) return '';
    return await compresserImage(new File([blob], 'photo.jpg', { type: blob.type || 'image/jpeg' }), 1000, 0.72);
  } catch (e) { return ''; }
}

// ---------- Lecture de la recette dans la page ----------
const texteBrut = s => { const t = document.createElement('textarea'); t.innerHTML = String(s ?? ''); return t.value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); };
const estRecette = o => o && [].concat(o['@type'] || []).some(t => String(t).toLowerCase() === 'recipe');

function trouverRecette(objet) {
  if (!objet || typeof objet !== 'object') return null;
  if (Array.isArray(objet)) { for (const o of objet) { const r = trouverRecette(o); if (r) return r; } return null; }
  if (estRecette(objet)) return objet;
  for (const cle of ['@graph', 'mainEntity', 'mainEntityOfPage', 'itemListElement', 'item']) { const r = trouverRecette(objet[cle]); if (r) return r; }
  return null;
}

function dureeMinutes(iso) {
  const m = String(iso || '').match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i);
  if (!m) return 0;
  return (Number(m[1]) || 0) * 1440 + (Number(m[2]) || 0) * 60 + (Number(m[3]) || 0);
}

function etapesDepuis(instructions) {
  const blocs = [];
  const ajouter = x => {
    if (!x) return;
    if (typeof x === 'string') { texteBrut(x).split(/\n+|(?<=\.)\s+(?=\d+[\.\)]\s)/).map(s => s.trim()).filter(Boolean).forEach(s => blocs.push({ type: 'etape', texte: s.replace(/^\d+[\.\)]\s*/, '') })); return; }
    if (Array.isArray(x)) { x.forEach(ajouter); return; }
    const type = [].concat(x['@type'] || []).join(' ').toLowerCase();
    if (type.includes('section')) {
      if (x.name) blocs.push({ type: 'titre', texte: texteBrut(x.name) });
      ajouter(x.itemListElement || x.steps);
      return;
    }
    const t = texteBrut(x.text || x.description || x.name || '');
    if (t) blocs.push({ type: 'etape', texte: t });
    else ajouter(x.itemListElement);
  };
  ajouter(instructions);
  return blocs;
}

function imageDepuis(img) {
  if (!img) return '';
  if (typeof img === 'string') return img;
  if (Array.isArray(img)) return imageDepuis(img[img.length > 1 ? 1 : 0]) || imageDepuis(img[0]);
  return img.url || img.contentUrl || '';
}

export function extraireRecette(html, adresse = '') {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  let r = null;
  for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try { r = trouverRecette(JSON.parse(s.textContent.trim().replace(/^[^\[{]*/, ''))); } catch (e) { r = null; }
    if (r) break;
  }
  if (r) {
    const parts = parseInt([].concat(r.recipeYield || []).map(String).find(x => /\d/.test(x)) || '', 10);
    const temps = dureeMinutes(r.totalTime) || (dureeMinutes(r.prepTime) + dureeMinutes(r.cookTime) + dureeMinutes(r.performTime));
    let image = imageDepuis(r.image);
    if (image && adresse) try { image = new URL(image, adresse).href; } catch (e) {}
    return {
      titre: texteBrut(r.name) || doc.querySelector('meta[property="og:title"]')?.content || '',
      parts: parts > 0 ? parts : 0, temps,
      ingredients: [].concat(r.recipeIngredient || r.ingredients || []).map(texteBrut).filter(Boolean),
      blocs: etapesDepuis(r.recipeInstructions),
      image: image || doc.querySelector('meta[property="og:image"]')?.content || ''
    };
  }
  // Pages sans bloc standard : balises « microdata »
  const ing = [...doc.querySelectorAll('[itemprop="recipeIngredient"], [itemprop="ingredients"]')].map(e => texteBrut(e.textContent)).filter(Boolean);
  if (ing.length) {
    return {
      titre: texteBrut(doc.querySelector('[itemprop="name"]')?.textContent || doc.querySelector('meta[property="og:title"]')?.content || doc.title),
      parts: parseInt(doc.querySelector('[itemprop="recipeYield"]')?.textContent || '', 10) || 0,
      temps: dureeMinutes(doc.querySelector('[itemprop="totalTime"]')?.getAttribute('content')),
      ingredients: ing,
      blocs: [...doc.querySelectorAll('[itemprop="recipeInstructions"]')].flatMap(e => etapesDepuis(e.textContent)),
      image: doc.querySelector('meta[property="og:image"]')?.content || ''
    };
  }
  return null;
}

// Texte collé : « Ingrédients » … « Préparation » …, sinon on devine ligne par ligne
export function lireTexteColle(texte) {
  const lignes = String(texte || '').split('\n').map(s => s.replace(/^[\s•*·\-–—]+/, '').trim()).filter(Boolean);
  const titreIng = /^(ingr[ée]dients?)\b/i, titrePrep = /^(pr[ée]paration|[ée]tapes|instructions|recette|m[ée]thode)\b/i;
  let zone = null, titre = '';
  const ingredients = [], blocs = [];
  lignes.forEach((l, i) => {
    if (titreIng.test(l) && l.length < 40) { zone = 'ing'; return; }
    if (titrePrep.test(l) && l.length < 40) { zone = 'prep'; return; }
    if (zone === null && i === 0 && !/\d/.test(l) && l.length < 80) { titre = l; return; }
    const ressembleIngredient = /^(\d|[½¼¾⅓]|une?\s|quelques|un peu|sel\b|poivre\b)/i.test(l) && l.length < 90;
    if (zone === 'ing' || (zone === null && ressembleIngredient)) ingredients.push(l);
    else if (/:\s*$/.test(l) && l.length <= 60) blocs.push({ type: 'titre', texte: l.replace(/\s*:\s*$/, '') });
    else blocs.push({ type: 'etape', texte: l.replace(/^(étape\s*)?\d+\s*[\.\):-]\s*/i, '') });
  });
  return { titre, parts: 0, temps: 0, ingredients, blocs, image: '' };
}

// ---------- Ingrédients : quantité, unité, nom ----------
const normaliser = s => String(s || '').toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae').normalize('NFD').replace(/[̀-ͯ]/g, '');
const FRACTIONS = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125 };
// [expression, unité de base, multiplicateur]
const UNITES_TEXTE = [
  [/^(kg|kilos?|kilogrammes?)\b/, 'g', 1000], [/^(mg|milligrammes?)\b/, 'g', 0.001], [/^(g|gr|grs|grammes?)\b/, 'g', 1],
  [/^(l|litres?)\b/, 'ml', 1000], [/^(dl|decilitres?)\b/, 'ml', 100], [/^(cl|centilitres?)\b/, 'ml', 10], [/^(ml|millilitres?)\b/, 'ml', 1],
  [/^(c\.?\s*(a\.?\s*)?soupe|cuil\w*\.?\s+(a\s+)?soupe|c\.?\s*a\.?\s*s\b\.?|cas|cs)(?=[\s.]|$)\.?/, 'g', 15],
  [/^(c\.?\s*(a\.?\s*)?cafe|cuil\w*\.?\s+(a\s+)?cafe|c\.?\s*a\.?\s*c\b\.?|cac|cc)(?=[\s.]|$)\.?/, 'g', 5],
  [/^(pincees?)\b/, 'g', 1], [/^(sachets?)\b/, 'g', 10], [/^(noix)\b(?=\s+de\s+beurre)/, 'g', 15],
  [/^(verres?)\b/, 'ml', 200], [/^(tasses?)\b/, 'ml', 250], [/^(bols?)\b/, 'ml', 350]
];
const MOTS_PIECE = /^(gousses?|tranches?|feuilles?|brins?|zestes?|morceaux?|boites?|pots?|branches?|bottes?|tablettes?|carres?|baton(net)?s?|pieces?|grosses?|gros|petites?|petits?|moyennes?|moyens?)\b/;

export function analyserIngredient(ligne) {
  let s = normaliser(ligne).replace(/[½¼¾⅓⅔⅛]/g, m => ' ' + FRACTIONS[m]).replace(/\s+/g, ' ').trim();
  s = s.replace(/^(environ|env\.?)\s+/, '');
  let quantite = 0;
  const q = s.match(/^(\d+(?:[.,]\d+)?)(?:\s*(?:a|-|à)\s*\d+(?:[.,]\d+)?)?(?:\s+(\d+(?:\.\d+)?)|\s*\/\s*(\d+))?\s*/);
  if (q) {
    quantite = parseFloat(q[1].replace(',', '.'));
    if (q[3]) quantite = quantite / Number(q[3]);
    else if (q[2] && Number(q[2]) < 1) quantite += Number(q[2]);
    s = s.slice(q[0].length);
  } else if (/^(une?|un)\s/.test(s)) { quantite = 1; s = s.replace(/^une?\s+/, ''); }
  let unite = 'piece', mult = 1, uniteTrouvee = false;
  for (const [re, u, m] of UNITES_TEXTE) {
    const x = s.match(re);
    if (x) { unite = u; mult = m; uniteTrouvee = true; s = s.slice(x[0].length).replace(/^\.\s*/, ''); break; }
  }
  if (!uniteTrouvee) { const x = s.match(MOTS_PIECE); if (x) s = s.slice(x[0].length); }
  let nom = s.replace(/^\s*(de|d'|d’|du|des)\s*/, '').replace(/\(.*?\)/g, '').split(/,|\s+ou\s+|\s+pour\s+/)[0].trim();
  nom = nom.replace(/\s+(bien|environ|a temperature ambiante)$/, '').trim();
  // nom affiché : on reprend l'écriture d'origine (accents), sans la quantité
  const original = String(ligne).replace(/\(.*?\)/g, '').trim();
  const motsNom = nom.split(' ').filter(Boolean);
  let joli = nom;
  if (motsNom.length) {
    const idx = normaliser(original).lastIndexOf(motsNom[0]);
    if (idx >= 0) joli = original.slice(idx, idx + nom.length).split(/,|\s+ou\s+/)[0].trim();
  }
  joli = joli ? joli[0].toUpperCase() + joli.slice(1) : '';
  return { texte: ligne, nom: joli || ligne, cle: nom, quantite: Math.round(quantite * mult * 100) / 100, unite };
}

// Rapprocher du stock : même nom, ou nom principal identique (farine → Farine T55)
const MOTS_VIDES = new Set(['de', 'd', 'du', 'des', 'la', 'le', 'les', 'en', 'au', 'aux', 'a', 'et', 'bien', 'tres', 'entier', 'entiers', 'entiere', 'non', 'sale', 'doux', 'demi', 'bio', 'aop', 'type', 'fin', 'fine']);
const mots = s => normaliser(s).split(/[^a-z0-9]+/).filter(m => m.length >= 2 && !MOTS_VIDES.has(m)).map(m => m.length > 3 ? m.replace(/(s|x)$/, '') : m);

export function rapprocher(cle) {
  const m = mots(cle);
  if (!m.length) return null;
  let meilleur = null, ecart = Infinity;
  for (const i of liste('ingredients')) {
    const n = mots(i.nom);
    if (!n.length) continue;
    // « farine » ↔ « Farine T55 », « pommes golden » ↔ « Pommes », mais pas « crème fraîche » ↔ « crème liquide »
    const inclus = m.every(x => n.includes(x)) || n.every(x => m.includes(x));
    if (!inclus) continue;
    const e = Math.abs(n.length - m.length) + (n[0] === m[0] ? 0 : 0.5);
    if (e < ecart) { ecart = e; meilleur = i; }
  }
  return meilleur;
}

// ---------- Fenêtre d'import ----------
const UNITE_LIB = { g: 'g', ml: 'ml', piece: 'pc' };

export function ouvrirImport({ quandPret, lien = '' }) {
  ouvrirPanneau({
    titre: 'Importer une recette',
    contenu: `<div id="imp-etape1" class="space-y-5">
        <p class="text-sm text-brand-700">Copiez le lien d'une recette (Marmiton, 750g, Cuisine AZ, un blog…) et collez-le ici. Les ingrédients, les étapes et la photo sont repris, puis vous vérifiez avant d'enregistrer.</p>
        <label class="block"><span class="block text-xs font-semibold text-brand-700 mb-1.5">Lien de la recette</span>
          <span class="flex gap-2"><input id="imp-lien" type="url" inputmode="url" placeholder="https://www.marmiton.org/recettes/…" class="flex-1 min-w-0 rounded-xl border border-brand-200 px-3.5 py-3 text-[15px] focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 focus:outline-none">
          <button type="button" id="imp-coller" class="${BTN.secondaire} flex-none" aria-label="Coller le lien"><i class="fa-regular fa-paste"></i></button></span></label>
        <button type="button" id="imp-lire" class="${BTN.principal} w-full py-3"><i class="fa-solid fa-wand-magic-sparkles"></i> Importer la recette</button>
        <p id="imp-erreur" class="hidden text-sm text-red-800 bg-red-50 rounded-xl px-3 py-2"></p>
        <details id="imp-texte-bloc" class="bg-white rounded-2xl border border-brand-200 p-4">
          <summary class="cursor-pointer font-semibold text-sm">Ou coller le texte de la recette</summary>
          <p class="text-xs text-brand-500 mt-2">Collez tout le texte (titre, ingrédients, préparation). Si les mots « Ingrédients » et « Préparation » y sont, c'est encore mieux.</p>
          <textarea id="imp-texte" rows="8" class="mt-2 w-full rounded-xl border border-brand-200 px-3 py-2 text-sm" placeholder="Tarte aux pommes&#10;Ingrédients&#10;250 g de farine&#10;125 g de beurre&#10;…&#10;Préparation&#10;Mélanger la farine et le beurre…"></textarea>
          <button type="button" id="imp-lire-texte" class="${BTN.sombre} w-full mt-2">Lire ce texte</button>
        </details>
      </div>
      <div id="imp-etape2" class="hidden"></div>`,
    onOuvert: () => {
      let recette = null, source = '';
      const erreur = m => { $('#imp-erreur').textContent = m; $('#imp-erreur').classList.toggle('hidden', !m); };
      const occupe = (b, v, t) => { b.disabled = v; b.classList.toggle('opacity-60', v); if (t) b.innerHTML = t; };
      $('#imp-coller').onclick = async () => {
        try { const t = await navigator.clipboard.readText(); if (t) $('#imp-lien').value = t.trim(); }
        catch (e) { toast('Appuyez longuement dans la case puis « Coller ».'); $('#imp-lien').focus(); }
      };
      if (lien) { $('#imp-lien').value = lien; setTimeout(() => $('#imp-lire').click(), 50); }
      $('#imp-lien').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('#imp-lire').click(); } });
      $('#imp-lire').onclick = async () => {
        erreur('');
        let lien = $('#imp-lien').value.trim();
        const trouve = lien.match(/https?:\/\/\S+/); if (trouve) lien = trouve[0];
        if (!/^https?:\/\//i.test(lien)) { erreur('Collez un lien qui commence par https://'); return; }
        const b = $('#imp-lire'), avant = b.innerHTML;
        occupe(b, true, '<i class="fa-solid fa-spinner fa-spin"></i> Lecture de la page…');
        try {
          const html = await telechargerTexte(lien);
          recette = extraireRecette(html, lien);
          if (!recette || (!recette.ingredients.length && !recette.blocs.length)) throw new Error('Aucune recette reconnue sur cette page. Collez plutôt le texte de la recette ci-dessous.');
          source = lien;
          if (recette.image) { b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Récupération de la photo…'; recette.photo = await telechargerImage(recette.image); }
          verifier();
        } catch (err) {
          erreur(err.message); $('#imp-texte-bloc').open = /texte/.test(err.message);
        } finally { occupe(b, false, avant); }
      };
      $('#imp-lire-texte').onclick = () => {
        erreur('');
        recette = lireTexteColle($('#imp-texte').value);
        if (!recette.ingredients.length && !recette.blocs.length) { erreur('Rien à lire : collez le texte de la recette.'); return; }
        source = '';
        verifier();
      };

      // Étape 2 : vérifier les ingrédients avant de créer la recette
      function verifier() {
        const lignes = recette.ingredients.map(analyserIngredient).map(l => {
          const trouve = rapprocher(l.cle);
          return { ...l, choix: trouve ? trouve.id : (l.cle && !/^(sel|poivre)$/.test(l.cle) || l.quantite ? '__creer' : '__ignorer') };
        });
        const options = l => `<option value="__creer" ${l.choix === '__creer' ? 'selected' : ''}>+ Créer « ${esc(l.nom)} »</option>
          <option value="__ignorer" ${l.choix === '__ignorer' ? 'selected' : ''}>Ne pas reprendre</option>
          <optgroup label="Dans mon stock">${liste('ingredients').sort((a, b) => a.nom.localeCompare(b.nom)).map(i => `<option value="${i.id}" ${l.choix === i.id ? 'selected' : ''}>${esc(i.nom)}</option>`).join('')}</optgroup>`;
        const nbEtapes = recette.blocs.filter(b => b.type === 'etape').length;
        $('#imp-etape1').classList.add('hidden');
        const z = $('#imp-etape2'); z.classList.remove('hidden');
        z.innerHTML = `<div class="space-y-5">
          <div class="flex gap-3 items-center bg-white rounded-2xl border border-brand-200 p-3">
            ${recette.photo ? `<img src="${recette.photo}" alt="" class="w-20 h-20 rounded-xl object-cover flex-none">` : '<span class="w-20 h-20 rounded-xl bg-brand-100 grid place-items-center text-brand-300 text-2xl flex-none"><i class="fa-solid fa-book-open"></i></span>'}
            <div class="min-w-0"><p class="font-display text-xl leading-tight">${esc(recette.titre || 'Recette importée')}</p>
              <p class="text-xs text-brand-600 mt-1">${recette.ingredients.length} ingrédient${recette.ingredients.length > 1 ? 's' : ''} · ${nbEtapes} étape${nbEtapes > 1 ? 's' : ''}${recette.parts ? ` · ${recette.parts} parts` : ''}${source ? ` · ${esc(new URL(source).hostname.replace(/^www\./, ''))}` : ''}</p></div>
          </div>
          <div>
            <h3 class="font-display text-2xl">Ingrédients</h3>
            <p class="text-sm text-brand-600 mt-1">Vérifiez chaque ligne : ingrédient de votre stock, nouvel ingrédient à créer, ou à ne pas reprendre. Les quantités sont converties en grammes, millilitres ou pièces.</p>
          </div>
          <div id="imp-lignes" class="space-y-3">${lignes.map((l, i) => `<div class="bg-white rounded-2xl border border-brand-200 p-3 space-y-2" data-imp="${i}">
            <p class="text-sm text-brand-800"><i class="fa-solid fa-quote-left text-brand-300 text-xs"></i> ${esc(l.texte)}</p>
            <div class="grid grid-cols-[1fr_6.5rem] gap-2">
              <select data-imp-choix class="min-w-0 rounded-lg border border-brand-200 px-2 py-2.5 text-[15px] bg-white" aria-label="Ingrédient">${options(l)}</select>
              <span class="relative"><input data-imp-qte type="number" min="0" step="any" inputmode="decimal" value="${l.quantite || ''}" class="w-full rounded-lg border border-brand-200 pl-2 pr-10 py-2.5 text-[15px] tabular-nums" aria-label="Quantité"><span data-imp-unite class="absolute right-2 top-3 text-xs text-brand-500"></span></span>
            </div>
            <p data-imp-alerte class="hidden text-xs font-semibold text-amber-800 bg-amber-50 rounded-lg px-2 py-1"></p>
          </div>`).join('')}</div>
          <div class="flex gap-2 pt-2">
            <button type="button" id="imp-retour" class="${BTN.secondaire}"><i class="fa-solid fa-arrow-left"></i> Retour</button>
            <button type="button" id="imp-creer" class="${BTN.principal} flex-1 py-3"><i class="fa-solid fa-check"></i> Continuer</button>
          </div>
          <p class="text-xs text-brand-500 text-center">La recette s'ouvre ensuite en modification : vous pouvez tout corriger avant d'enregistrer.</p>
        </div>`;
        const majUnite = i => {
          const bloc = z.querySelector(`[data-imp="${i}"]`), l = lignes[i];
          const ing = db.ingredients[l.choix];
          bloc.querySelector('[data-imp-unite]').textContent = UNITE_LIB[ing ? ing.unite : l.unite] || '';
          const autreUnite = ing && l.quantite && (ing.unite === 'piece') !== (l.unite === 'piece');
          bloc.querySelector('[data-imp-alerte]').classList.toggle('hidden', !autreUnite);
          if (autreUnite) bloc.querySelector('[data-imp-alerte]').textContent = `« ${ing.nom} » se compte en ${UNITE_LIB[ing.unite]} : vérifiez la quantité.`;
          bloc.classList.toggle('opacity-50', l.choix === '__ignorer');
        };
        lignes.forEach((l, i) => majUnite(i));
        z.addEventListener('change', e => {
          const bloc = e.target.closest('[data-imp]'); if (!bloc) return;
          const i = +bloc.dataset.imp;
          if (e.target.matches('[data-imp-choix]')) { lignes[i].choix = e.target.value; majUnite(i); }
        });
        z.addEventListener('input', e => {
          const bloc = e.target.closest('[data-imp]'); if (!bloc || !e.target.matches('[data-imp-qte]')) return;
          lignes[+bloc.dataset.imp].quantite = Number(e.target.value) || 0;
        });
        $('#imp-retour').onclick = () => { z.classList.add('hidden'); $('#imp-etape1').classList.remove('hidden'); };
        $('#imp-creer').onclick = async () => {
          const b = $('#imp-creer'); occupe(b, true, '<i class="fa-solid fa-spinner fa-spin"></i> Préparation…');
          try {
            const crees = {};
            const ingredients = [];
            for (const l of lignes) {
              if (l.choix === '__ignorer') continue;
              let id = l.choix;
              if (id === '__creer') {
                const cle = normaliser(l.nom);
                id = crees[cle] || (crees[cle] = await creer('ingredients', { nom: l.nom, unite: l.unite, prix: 0, quantite: 0, seuil: 0, fournisseur: '' }));
              }
              const existant = ingredients.find(x => x.ingredientId === id);
              if (existant) existant.quantite = Math.round((existant.quantite + l.quantite) * 100) / 100;
              else ingredients.push({ ingredientId: id, quantite: l.quantite });
            }
            const n = Object.keys(crees).length;
            fermerPanneau();
            if (n) toast(`${n} nouvel${n > 1 ? 's' : ''} ingrédient${n > 1 ? 's' : ''} ajouté${n > 1 ? 's' : ''} au stock (prix à compléter)`);
            quandPret({
              type: 'recette', t: Date.now(),
              champs: { 'rec-titre': { v: recette.titre || '' }, 'rec-rendement': { v: String(recette.parts || 6) }, 'rec-temps': { v: recette.temps ? String(recette.temps) : '' } },
              extra: {
                ingredients: ingredients.length ? ingredients : [{ ingredientId: '', quantite: 0 }], materiel: [], photosASupprimer: [], source,
                photos: recette.photo ? { elements: [{ data: recette.photo }], retires: [] } : null,
                blocs: recette.blocs.map(bl => ({ type: bl.type, texte: bl.texte, photosEtat: null }))
              }
            });
          } catch (err) { toast(err.message || 'Import impossible', 'erreur'); occupe(b, false, '<i class="fa-solid fa-check"></i> Continuer'); }
        };
      }
    }
  });
}
