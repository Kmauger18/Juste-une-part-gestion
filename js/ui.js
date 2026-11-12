// Petits outils d'interface partagés par tous les écrans
import { STATUTS } from './donnees.js';

export const $ = (sel, racine = document) => racine.querySelector(sel);
export const $$ = (sel, racine = document) => [...racine.querySelectorAll(sel)];

export function esc(t) {
  return String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function euro(n, decimales = 2) {
  return (Number(n) || 0).toLocaleString('fr-FR', { minimumFractionDigits: decimales, maximumFractionDigits: decimales }) + ' €';
}
export function nombre(n, dec = 0) { return (Number(n) || 0).toLocaleString('fr-FR', { maximumFractionDigits: dec }); }

// ---------- Dates (format AAAA-MM-JJ, heure locale) ----------
export function isoJour(d = new Date()) {
  const z = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}
export function versDate(iso) { return new Date(iso + 'T12:00:00'); }
export function ajouterJours(iso, n) { const d = versDate(iso); d.setDate(d.getDate() + n); return isoJour(d); }
export function ecartJours(iso, depuis = isoJour()) { return Math.round((versDate(iso) - versDate(depuis)) / 86400000); }
export function dateCourte(iso) {
  if (!iso) return 'Date à définir';
  return versDate(iso).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}
export function dateLongue(iso) {
  if (!iso) return 'Date à définir';
  return versDate(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}
export function dateRelative(iso) {
  if (!iso) return 'Date à définir';
  const e = ecartJours(iso);
  if (e === 0) return 'Aujourd\'hui';
  if (e === 1) return 'Demain';
  if (e === -1) return 'Hier';
  if (e > 1 && e < 7) return dateLongue(iso).replace(/^./, c => c.toUpperCase());
  return dateCourte(iso);
}

export function badgeStatut(statut, petit = false) {
  const s = STATUTS[statut] || STATUTS.nouvelle;
  return `<span class="inline-flex items-center gap-1.5 ${petit ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'} rounded-full font-semibold ring-1 ring-inset ${s.classe} whitespace-nowrap"><span class="w-1.5 h-1.5 rounded-full ${s.point}"></span>${s.label}</span>`;
}

// ---------- Notifications ----------
let minuteurToast;
export function toast(message, type = 'ok') {
  const el = $('#toast');
  el.querySelector('span').textContent = message;
  el.querySelector('i').className = type === 'erreur' ? 'fa-solid fa-circle-exclamation text-red-300' : 'fa-solid fa-circle-check text-emerald-300';
  el.classList.remove('opacity-0', 'translate-y-4', 'pointer-events-none');
  clearTimeout(minuteurToast);
  minuteurToast = setTimeout(() => el.classList.add('opacity-0', 'translate-y-4', 'pointer-events-none'), 2800);
}

// ---------- Panneau latéral (plein écran sur mobile) ----------
let fermetureCourante = null;
export function ouvrirPanneau({ titre, contenu, pied = '', onOuvert, onFerme }) {
  const p = $('#panneau');
  $('#panneau-titre').textContent = titre;
  $('#panneau-corps').innerHTML = contenu;
  $('#panneau-pied').innerHTML = pied;
  $('#panneau-pied').classList.toggle('hidden', !pied);
  p.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
  requestAnimationFrame(() => p.classList.add('ouvert'));
  fermetureCourante = onFerme || null;
  if (onOuvert) onOuvert($('#panneau-corps'), $('#panneau-pied'));
  setTimeout(() => { const f = $('#panneau-corps input:not([type=hidden]), #panneau-corps select, #panneau-corps textarea'); if (f && matchMedia('(min-width: 768px)').matches) f.focus(); }, 60);
}
export function fermerPanneau() {
  const p = $('#panneau');
  if (p.classList.contains('hidden')) return;
  p.classList.remove('ouvert');
  document.body.classList.remove('overflow-hidden');
  setTimeout(() => p.classList.add('hidden'), 200);
  if (fermetureCourante) { const f = fermetureCourante; fermetureCourante = null; f(); }
}
export function panneauOuvert() { return !$('#panneau').classList.contains('hidden'); }

// ---------- Confirmation (fenêtre intégrée à la page) ----------
export function confirmer(message, { bouton = 'Confirmer', danger = false } = {}) {
  return new Promise(resolve => {
    const d = $('#dialogue');
    $('#dialogue-texte').textContent = message;
    const ok = $('#dialogue-ok');
    ok.textContent = bouton;
    ok.className = `px-4 py-2.5 rounded-xl font-semibold text-sm text-white ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-900 hover:bg-brand-800'}`;
    d.classList.remove('hidden');
    ok.focus();
    const fin = v => { d.classList.add('hidden'); ok.onclick = annuler.onclick = null; document.removeEventListener('keydown', clavier, true); resolve(v); };
    const annuler = $('#dialogue-annuler');
    ok.onclick = () => fin(true);
    annuler.onclick = () => fin(false);
    const clavier = e => { if (e.key === 'Escape') { e.stopPropagation(); fin(false); } };
    document.addEventListener('keydown', clavier, true);
  });
}

// ---------- Images : compression d'une photo prise au téléphone ----------
export function compresserImage(fichier, largeurMax = 1000, qualite = 0.72) {
  return new Promise((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onerror = () => reject(new Error('Lecture de la photo impossible.'));
    lecteur.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Ce fichier n\'est pas une image lisible.'));
      img.onload = () => {
        const ratio = Math.min(1, largeurMax / img.width);
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * ratio); c.height = Math.round(img.height * ratio);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        let q = qualite, url = c.toDataURL('image/jpeg', q);
        while (url.length > 350000 && q > 0.4) { q -= 0.08; url = c.toDataURL('image/jpeg', q); }
        resolve(url);
      };
      img.src = lecteur.result;
    };
    lecteur.readAsDataURL(fichier);
  });
}

export function telecharger(texte, nomFichier, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([texte], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = nomFichier;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copier(texte) {
  try { await navigator.clipboard.writeText(texte); toast('Copié'); }
  catch (e) { toast('Copie impossible sur cet appareil', 'erreur'); }
}

// Champs de formulaire réutilisables
export function champ({ id, label, type = 'text', valeur = '', attrs = '', aide = '', classe = '' }) {
  const base = 'w-full rounded-xl border border-brand-200 bg-white px-3.5 py-2.5 text-[15px] text-brand-950 placeholder:text-brand-400 focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 focus:outline-none';
  const control = type === 'textarea'
    ? `<textarea id="${id}" name="${id}" rows="3" class="${base}" ${attrs}>${esc(valeur)}</textarea>`
    : `<input id="${id}" name="${id}" type="${type}" value="${esc(valeur)}" class="${base}" ${attrs}>`;
  return `<label class="block ${classe}"><span class="block text-xs font-semibold text-brand-700 mb-1.5">${label}</span>${control}${aide ? `<span class="block text-xs text-brand-500 mt-1">${aide}</span>` : ''}</label>`;
}
export function selection({ id, label, options, valeur = '', classe = '', attrs = '' }) {
  const opts = options.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${String(v) === String(valeur) ? 'selected' : ''}>${esc(l)}</option>`; }).join('');
  return `<label class="block ${classe}"><span class="block text-xs font-semibold text-brand-700 mb-1.5">${label}</span><select id="${id}" name="${id}" class="w-full rounded-xl border border-brand-200 bg-white px-3 py-2.5 text-[15px] text-brand-950 focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 focus:outline-none" ${attrs}>${opts}</select></label>`;
}
export function interrupteur({ id, label, coche = false, aide = '' }) {
  return `<label class="flex items-start justify-between gap-4 py-2 cursor-pointer"><span><span class="block text-sm font-semibold text-brand-900">${label}</span>${aide ? `<span class="block text-xs text-brand-500 mt-0.5">${aide}</span>` : ''}</span>
    <span class="relative flex-none mt-0.5"><input type="checkbox" id="${id}" name="${id}" class="peer sr-only" ${coche ? 'checked' : ''}><span class="block w-11 h-6 rounded-full bg-brand-200 peer-checked:bg-terracotta transition-colors"></span><span class="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5"></span></span></label>`;
}

export function etatVide({ icone, titre, texte, action = '' }) {
  return `<div class="text-center py-14 px-6 bg-white rounded-2xl border border-dashed border-brand-300">
    <div class="w-14 h-14 mx-auto rounded-2xl bg-brand-100 text-terracotta grid place-items-center text-2xl mb-4"><i class="${icone}"></i></div>
    <h3 class="font-display text-xl text-brand-950">${titre}</h3>
    <p class="text-sm text-brand-600 mt-1.5 max-w-sm mx-auto">${texte}</p>${action ? `<div class="mt-5">${action}</div>` : ''}</div>`;
}

export const BTN = {
  principal: 'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-terracotta hover:bg-terracotta-dark text-white font-semibold text-sm shadow-sm transition-colors',
  sombre: 'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand-900 hover:bg-brand-800 text-white font-semibold text-sm transition-colors',
  secondaire: 'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-brand-200 hover:border-brand-400 text-brand-900 font-semibold text-sm transition-colors',
  danger: 'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-red-200 text-red-700 hover:bg-red-50 font-semibold text-sm transition-colors',
  icone: 'inline-grid place-items-center w-9 h-9 rounded-xl text-brand-700 hover:bg-brand-100 hover:text-brand-950 transition-colors'
};
