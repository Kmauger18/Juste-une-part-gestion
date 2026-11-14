// Photos des ingrédients et du matériel : ajout, aperçu, visionneuse
import { lirePhoto, creerPhoto, supprimerPhoto } from './store.js';
import * as brouillon from './brouillon.js';
import { esc, compresserImage, toast, BTN } from './ui.js';

export const MAX_PHOTOS = 6;

// Réduit une image (data URL) à une petite miniature carrée pour les listes
export function miniature(dataUrl, taille = 160) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = taille;
      const cote = Math.min(img.width, img.height);
      c.getContext('2d').drawImage(img, (img.width - cote) / 2, (img.height - cote) / 2, cote, cote, 0, 0, taille, taille);
      resolve(c.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => resolve('');
    img.src = dataUrl;
  });
}

// Vignette affichée dans une liste ; ouvre la visionneuse si l'élément a des photos
export function vignette(element, classe = 'w-11 h-11') {
  const n = (element.photos || []).length;
  if (!element.miniature) return `<span class="${classe} flex-none rounded-xl bg-brand-100 grid place-items-center text-brand-300"><i class="fa-regular fa-image"></i></span>`;
  return `<button type="button" data-voir-photos="${esc((element.photos || []).join(','))}" data-titre="${esc(element.nom || '')}" class="${classe} flex-none rounded-xl overflow-hidden relative ring-1 ring-brand-200" aria-label="Voir ${n > 1 ? 'les ' + n + ' photos' : 'la photo'} de ${esc(element.nom || '')}">
    <img src="${element.miniature}" alt="" class="w-full h-full object-cover">${n > 1 ? `<span class="absolute bottom-0 right-0 bg-brand-950/80 text-white text-[9px] font-bold px-1 rounded-tl">${n}</span>` : ''}</button>`;
}

// ---------- Visionneuse plein écran ----------
let visionneuse;
export async function voirPhotos(ids, titre = '', depart = 0) {
  ids = (ids || []).filter(Boolean);
  if (!ids.length) return;
  if (!visionneuse) {
    visionneuse = document.createElement('div');
    visionneuse.className = 'fixed inset-0 z-[60] bg-black/90 flex flex-col hidden';
    visionneuse.setAttribute('role', 'dialog'); visionneuse.setAttribute('aria-modal', 'true');
    visionneuse.innerHTML = `<div class="flex items-center gap-3 px-4 h-14 text-white flex-none" style="margin-top:env(safe-area-inset-top,0px)"><span id="vis-titre" class="flex-1 truncate font-semibold"></span><span id="vis-compteur" class="text-sm text-white/70"></span><button type="button" id="vis-fermer" class="w-10 h-10 grid place-items-center rounded-xl hover:bg-white/10" aria-label="Fermer"><i class="fa-solid fa-xmark text-xl"></i></button></div>
      <div class="flex-1 min-h-0 relative grid place-items-center px-4 pb-6"><img id="vis-image" alt="" class="max-w-full max-h-full object-contain rounded-xl">
        <button type="button" id="vis-prec" class="absolute left-2 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/15 text-white" aria-label="Photo précédente"><i class="fa-solid fa-chevron-left"></i></button>
        <button type="button" id="vis-suiv" class="absolute right-2 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/15 text-white" aria-label="Photo suivante"><i class="fa-solid fa-chevron-right"></i></button></div>`;
    document.body.appendChild(visionneuse);
    visionneuse.querySelector('#vis-fermer').onclick = () => fermer();
    visionneuse.addEventListener('click', e => { if (e.target === visionneuse || e.target.classList.contains('grid')) fermer(); });
    document.addEventListener('keydown', e => {
      if (visionneuse.classList.contains('hidden')) return;
      if (e.key === 'Escape') { e.stopPropagation(); fermer(); }
      if (e.key === 'ArrowRight') visionneuse.querySelector('#vis-suiv').click();
      if (e.key === 'ArrowLeft') visionneuse.querySelector('#vis-prec').click();
    }, true);
  }
  const fermer = () => visionneuse.classList.add('hidden');
  let i = Math.min(Math.max(0, depart), ids.length - 1);
  const afficher = async () => {
    visionneuse.querySelector('#vis-compteur').textContent = ids.length > 1 ? `${i + 1} / ${ids.length}` : '';
    const img = visionneuse.querySelector('#vis-image');
    img.style.opacity = '.3';
    const data = String(ids[i]).startsWith('data:') ? ids[i] : await lirePhoto(ids[i]).catch(() => null);
    img.src = data || ''; img.style.opacity = '1';
    img.alt = titre;
  };
  visionneuse.querySelector('#vis-titre').textContent = titre;
  visionneuse.querySelector('#vis-prec').classList.toggle('hidden', ids.length < 2);
  visionneuse.querySelector('#vis-suiv').classList.toggle('hidden', ids.length < 2);
  visionneuse.querySelector('#vis-prec').onclick = e => { e.stopPropagation(); i = (i - 1 + ids.length) % ids.length; afficher(); };
  visionneuse.querySelector('#vis-suiv').onclick = e => { e.stopPropagation(); i = (i + 1) % ids.length; afficher(); };
  visionneuse.classList.remove('hidden');
  afficher();
}

// Brancher l'ouverture des vignettes sur tout l'écran
document.addEventListener('click', e => {
  const b = e.target.closest('[data-voir-photos]');
  if (!b) return;
  e.preventDefault(); e.stopPropagation();
  voirPhotos(b.dataset.voirPhotos.split(','), b.dataset.titre);
}, true);

// ---------- Éditeur de photos dans un formulaire ----------
// Retourne { enregistrer(), etat() } : enregistrer() à l'enregistrement du
// formulaire ; etat() sert au brouillon (saisie gardée si l'appli est quittée).
// initial : état repris d'un brouillon { elements: [{id}|{data}], retires }.
export function editeurPhotos(conteneur, idsExistants = [], initial = null) {
  const elements = initial?.elements
    ? initial.elements.map(p => ({ id: p.id || null, data: p.id ? null : (p.data || '') })).filter(p => p.id || p.data)
    : idsExistants.map(id => ({ id, data: null }));
  const retires = initial?.retires ? [...initial.retires] : [];

  const dessiner = () => {
    conteneur.innerHTML = `
      <div class="grid grid-cols-3 sm:grid-cols-4 gap-2">
        ${elements.map((p, i) => `<div class="relative aspect-square rounded-xl overflow-hidden bg-brand-100 ring-1 ring-brand-200">
          ${p.data ? `<button type="button" data-ouvrir-photo="${i}" class="block w-full h-full" aria-label="Agrandir la photo ${i + 1}"><img src="${p.data}" alt="" class="w-full h-full object-cover"></button>` : '<span class="absolute inset-0 grid place-items-center text-brand-300"><i class="fa-solid fa-spinner fa-spin"></i></span>'}
          ${i === 0 ? '<span class="absolute bottom-1 left-1 bg-brand-950/80 text-white text-[9px] font-bold uppercase px-1.5 py-0.5 rounded">Principale</span>' : ''}
          <button type="button" data-retirer-photo="${i}" class="absolute top-1 right-1 w-7 h-7 rounded-full bg-white/90 text-red-700 grid place-items-center shadow" aria-label="Retirer la photo ${i + 1}"><i class="fa-solid fa-xmark text-sm"></i></button>
          ${i > 0 ? `<button type="button" data-principale="${i}" class="absolute bottom-1 right-1 w-7 h-7 rounded-full bg-white/90 text-brand-800 grid place-items-center shadow" aria-label="Mettre en photo principale" title="Mettre en principale"><i class="fa-regular fa-star text-xs"></i></button>` : ''}
        </div>`).join('')}
        ${elements.length < MAX_PHOTOS ? `<label class="aspect-square rounded-xl border-2 border-dashed border-brand-300 bg-white hover:border-terracotta text-brand-600 hover:text-terracotta grid place-items-center text-center cursor-pointer text-xs font-semibold p-2">
          <span class="flex flex-col items-center gap-1"><i class="fa-solid fa-camera text-xl"></i>Prendre une photo</span>
          <input type="file" accept="image/*" capture="environment" class="sr-only" data-ajout-photos></label>
        <label class="aspect-square rounded-xl border-2 border-dashed border-brand-300 bg-white hover:border-terracotta text-brand-600 hover:text-terracotta grid place-items-center text-center cursor-pointer text-xs font-semibold p-2">
          <span class="flex flex-col items-center gap-1"><i class="fa-regular fa-images text-xl"></i>Galerie</span>
          <input type="file" accept="image/*" multiple class="sr-only" data-ajout-photos></label>` : ''}
      </div>
      <p class="text-xs text-brand-500 mt-2">${elements.length}/${MAX_PHOTOS} photo${elements.length > 1 ? 's' : ''}. La première sert de vignette dans les listes. Prenez la photo de près, avec l'étiquette ou la marque si possible.</p>`;
  };

  // Charger les photos existantes
  elements.forEach((p, i) => p.id && lirePhoto(p.id).then(d => { p.data = d || ''; dessiner(); }).catch(() => { p.data = ''; dessiner(); }));
  dessiner();

  conteneur.addEventListener('change', async e => {
    if (!e.target.matches('[data-ajout-photos]')) return;
    const fichiers = [...e.target.files].slice(0, MAX_PHOTOS - elements.length);
    for (const f of fichiers) {
      try { elements.push({ id: null, data: await compresserImage(f, 900, 0.7) }); dessiner(); }
      catch (err) { toast(err.message, 'erreur'); }
    }
    if (e.target.files.length > fichiers.length) toast(`${MAX_PHOTOS} photos au maximum`, 'erreur');
    e.target.value = '';
    brouillon.planifier();
  });
  conteneur.addEventListener('click', e => {
    const r = e.target.closest('[data-retirer-photo]');
    if (r) { const [p] = elements.splice(+r.dataset.retirerPhoto, 1); if (p.id) retires.push(p.id); dessiner(); return; }
    const pr = e.target.closest('[data-principale]');
    if (pr) { const [p] = elements.splice(+pr.dataset.principale, 1); elements.unshift(p); dessiner(); return; }
    const o = e.target.closest('[data-ouvrir-photo]');
    if (o) voirPhotos(elements.map(x => x.data || x.id), '', +o.dataset.ouvrirPhoto);
  });

  return {
    etat() {
      return { elements: elements.map(p => p.id ? { id: p.id } : { data: p.data }), retires: [...retires] };
    },
    async enregistrer() {
      const ids = [];
      for (const p of elements) { if (!p.id && p.data) p.id = await creerPhoto(p.data); if (p.id) ids.push(p.id); }
      for (const id of retires) await supprimerPhoto(id).catch(() => {});
      const premiere = elements.find(p => p.data);
      return { photos: ids, miniature: premiere ? await miniature(premiere.data) : '' };
    }
  };
}
