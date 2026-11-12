// Calculs métier : coûts de revient, besoins en ingrédients, chiffre d'affaires
import { db, liste, obtenir } from './store.js';
import { UNITES, PARTS_BASE, STATUTS_ACTIFS } from './donnees.js';
import { isoJour, ajouterJours, versDate } from './ui.js';

// Coût d'une quantité d'ingrédient (prix au kg / L / pièce)
export function coutIngredient(ingredientId, quantite) {
  const ing = db.ingredients[ingredientId];
  if (!ing) return 0;
  const u = UNITES[ing.unite] || UNITES.g;
  return (Number(quantite) || 0) / u.diviseur * (Number(ing.prix) || 0);
}

// Coût total d'une recette pour son rendement
export function coutRecette(recette) {
  if (!recette) return { total: 0, parPart: 0 };
  const total = (recette.ingredients || []).reduce((s, l) => s + coutIngredient(l.ingredientId, l.quantite), 0);
  const rendement = Number(recette.rendement) || 1;
  return { total, parPart: total / rendement };
}

// Nombre de parts correspondant au prix de base d'un produit
export function partsBaseProduit(produit, recette) {
  if (produit?.tailles) return PARTS_BASE;
  return Number(recette?.rendement) || 1;
}

// Coût de revient et marge d'un produit (pour son format de base)
export function margeProduit(produitId) {
  const produit = db.produits[produitId];
  const recette = db.recettes[produitId];
  if (!produit || !recette || !(recette.ingredients || []).length) return null;
  const { parPart } = coutRecette(recette);
  const parts = partsBaseProduit(produit, recette);
  const cout = parPart * parts;
  const prix = Number(produit.prix) || 0;
  return { cout, prix, marge: prix - cout, taux: prix ? (prix - cout) / prix : 0, parts };
}

// Ingrédients nécessaires pour une ligne de commande
export function besoinsLigne(ligne) {
  const recette = ligne.produitId ? db.recettes[ligne.produitId] : null;
  if (!recette || !(recette.ingredients || []).length) return null;
  const rendement = Number(recette.rendement) || 1;
  const parts = Number(ligne.parts) || rendement;
  const facteur = (parts / rendement) * (Number(ligne.qty) || 1);
  const m = {};
  recette.ingredients.forEach(l => { m[l.ingredientId] = (m[l.ingredientId] || 0) + (Number(l.quantite) || 0) * facteur; });
  return m;
}

// Total des besoins pour plusieurs commandes + lignes sans recette
export function besoinsCommandes(commandes) {
  const total = {}; const sansRecette = new Set();
  commandes.forEach(c => (c.lignes || []).forEach(l => {
    const b = besoinsLigne(l);
    if (!b) { sansRecette.add(l.titre); return; }
    Object.entries(b).forEach(([id, q]) => { total[id] = (total[id] || 0) + q; });
  }));
  const lignes = Object.entries(total).map(([id, besoin]) => {
    const ing = db.ingredients[id] || { nom: 'Ingrédient supprimé', unite: 'g', quantite: 0 };
    const stock = Number(ing.quantite) || 0;
    return { id, nom: ing.nom, unite: ing.unite, besoin, stock, manque: Math.max(0, besoin - stock) };
  }).sort((a, b) => b.manque - a.manque || a.nom.localeCompare(b.nom));
  return { lignes, sansRecette: [...sansRecette] };
}

// Opérations pour retirer du stock les ingrédients d'une commande
export function operationsDeduction(commande, sens = -1) {
  const { lignes } = besoinsCommandes([commande]);
  return lignes.filter(l => db.ingredients[l.id]).map(l => ({
    type: 'merge', col: 'ingredients', id: l.id,
    data: { quantite: Math.max(0, Math.round(((Number(db.ingredients[l.id].quantite) || 0) + sens * l.besoin) * 100) / 100) }
  }));
}

export function totalCommande(lignes) {
  return Math.round((lignes || []).reduce((s, l) => s + (Number(l.prix) || 0) * (Number(l.qty) || 0), 0) * 100) / 100;
}

export function commandesActives() { return liste('commandes').filter(c => STATUTS_ACTIFS.includes(c.statut)); }

export function chiffreAffaires(debutIso, finIso) {
  return commandesActives().filter(c => c.dateRetrait >= debutIso && c.dateRetrait <= finIso).reduce((s, c) => s + (Number(c.total) || 0), 0);
}

// Chiffre d'affaires par semaine (lundi → dimanche), des plus anciennes aux plus récentes
export function caParSemaine(nbSemaines = 8) {
  const auj = versDate(isoJour());
  const decalageLundi = (auj.getDay() + 6) % 7;
  const lundi = ajouterJours(isoJour(auj), -decalageLundi);
  const semaines = [];
  for (let i = nbSemaines - 1; i >= 0; i--) {
    const debut = ajouterJours(lundi, -7 * i);
    const fin = ajouterJours(debut, 6);
    semaines.push({ debut, fin, total: chiffreAffaires(debut, fin) });
  }
  return semaines;
}

export function produitsLesPlusVendus(jours = 90, n = 5) {
  const depuis = ajouterJours(isoJour(), -jours);
  const m = {};
  commandesActives().filter(c => c.dateRetrait >= depuis).forEach(c => (c.lignes || []).forEach(l => {
    const cle = l.produitId || l.titre;
    m[cle] = m[cle] || { titre: obtenir('produits', l.produitId)?.titre || l.titre, qty: 0, total: 0 };
    m[cle].qty += Number(l.qty) || 0;
    m[cle].total += (Number(l.prix) || 0) * (Number(l.qty) || 0);
  }));
  return Object.values(m).sort((a, b) => b.total - a.total).slice(0, n);
}

export function stockBas() {
  return liste('ingredients').filter(i => (Number(i.quantite) || 0) <= (Number(i.seuil) || 0)).sort((a, b) => a.nom.localeCompare(b.nom));
}

export function resteAEncaisser() {
  return liste('commandes').filter(c => ['confirmee', 'preparation', 'prete'].includes(c.statut) && !c.paye)
    .reduce((s, c) => s + Math.max(0, (Number(c.total) || 0) - (Number(c.acompte) || 0)), 0);
}

export function formaterQuantite(q, unite) {
  const n = Number(q) || 0;
  if (unite === 'g' && Math.abs(n) >= 1000) return (n / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' kg';
  if (unite === 'ml' && Math.abs(n) >= 1000) return (n / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' L';
  if (unite === 'piece') return n.toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + (Math.abs(n) > 1 ? ' pièces' : ' pièce');
  return n.toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' ' + (unite || 'g');
}

export function prochainNumero() {
  const nums = liste('commandes').filter(c => /^C-\d+$/.test(c.numero || '')).map(c => parseInt(c.numero.slice(2), 10));
  return 'C-' + (nums.length ? Math.max(...nums) + 1 : 1001);
}

// ---------- Matériel ----------
export function recettesUtilisantMateriel(materielId) {
  return Object.entries(db.recettes).filter(([, r]) => (r.materiel || []).some(l => l.materielId === materielId)).map(([id, r]) => db.produits[id]?.titre || r.titre || id);
}

// Matériel nécessaire pour des commandes (préparées en même temps) comparé au matériel disponible
export function besoinsMateriel(commandes) {
  const total = {};
  commandes.forEach(c => (c.lignes || []).forEach(l => {
    const r = l.produitId ? db.recettes[l.produitId] : null;
    (r?.materiel || []).forEach(m => { total[m.materielId] = (total[m.materielId] || 0) + (Number(m.quantite) || 1) * (Number(l.qty) || 1); });
  }));
  return Object.entries(total).map(([id, besoin]) => {
    const m = db.materiel[id] || { nom: 'Matériel supprimé', quantite: 0 };
    const dispo = Number(m.quantite) || 0;
    return { id, nom: m.nom, besoin, dispo, manque: Math.max(0, besoin - dispo) };
  }).sort((a, b) => b.manque - a.manque || a.nom.localeCompare(b.nom));
}

// Jours à venir où le matériel ne suffit pas pour les commandes du jour
export function alertesMateriel(jours = 7) {
  const auj = isoJour(), fin = ajouterJours(auj, jours);
  const parJour = {};
  liste('commandes').filter(c => ['nouvelle', 'confirmee', 'preparation'].includes(c.statut) && c.dateRetrait && c.dateRetrait >= auj && c.dateRetrait <= fin)
    .forEach(c => { (parJour[c.dateRetrait] = parJour[c.dateRetrait] || []).push(c); });
  const alertes = [];
  Object.entries(parJour).sort().forEach(([jour, cmds]) => besoinsMateriel(cmds).filter(b => b.manque > 0).forEach(b => alertes.push({ jour, ...b })));
  return alertes;
}
