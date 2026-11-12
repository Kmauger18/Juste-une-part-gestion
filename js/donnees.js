// Données de référence et contenu du mode démo

export const CATEGORIES = {
  tartes: 'Tartes',
  choux: 'Choux & éclairs',
  entremets: 'Entremets',
  mignardises: 'Macarons & douceurs',
  glutenfree: 'Sans gluten',
  'sur-mesure': 'Sur mesure'
};

// Les 14 allergènes à déclarer (règlement européen INCO)
export const ALLERGENES = ['Gluten', 'Crustacés', 'Œufs', 'Poissons', 'Arachides', 'Soja', 'Lait', 'Fruits à coque', 'Céleri', 'Moutarde', 'Sésame', 'Sulfites', 'Lupin', 'Mollusques'];

// Tailles proposées sur le site pour les gâteaux « à tailles »
export const TAILLES = [
  { label: '4 parts', parts: 4, mult: 0.6 },
  { label: '6 à 8 parts', parts: 8, mult: 1 },
  { label: '10 à 12 parts', parts: 12, mult: 1.5 }
];
export const PARTS_BASE = 8; // le prix de base d'un gâteau à tailles correspond à 8 parts

export const STATUTS = {
  nouvelle:    { label: 'Nouvelle',       classe: 'bg-sky-100 text-sky-800 ring-sky-200',             point: 'bg-sky-500' },
  confirmee:   { label: 'Confirmée',      classe: 'bg-amber-100 text-amber-800 ring-amber-200',       point: 'bg-amber-500' },
  preparation: { label: 'En préparation', classe: 'bg-violet-100 text-violet-800 ring-violet-200',    point: 'bg-violet-500' },
  prete:       { label: 'Prête',          classe: 'bg-emerald-100 text-emerald-800 ring-emerald-200', point: 'bg-emerald-500' },
  retiree:     { label: 'Retirée',        classe: 'bg-stone-200 text-stone-700 ring-stone-300',       point: 'bg-stone-500' },
  annulee:     { label: 'Annulée',        classe: 'bg-red-100 text-red-700 ring-red-200',             point: 'bg-red-500' }
};
export const ORDRE_STATUTS = ['nouvelle', 'confirmee', 'preparation', 'prete', 'retiree', 'annulee'];
export const STATUTS_ACTIFS = ['confirmee', 'preparation', 'prete', 'retiree']; // comptent dans le chiffre d'affaires

export const CATEGORIES_MATERIEL = {
  moules: 'Moules et cercles',
  ustensiles: 'Ustensiles',
  appareils: 'Appareils',
  decoration: 'Décoration',
  emballage: 'Emballages',
  autre: 'Autre'
};

export const UNITES = {
  g: { label: 'g', prixLabel: '€ / kg', diviseur: 1000 },
  ml: { label: 'ml', prixLabel: '€ / L', diviseur: 1000 },
  piece: { label: 'pièce(s)', prixLabel: '€ / pièce', diviseur: 1 }
};

export const PARAMETRES_DEFAUT = {
  telephone: '06 81 17 45 92',
  email: '',
  adresse: 'Retrait sur rendez-vous',
  horairesSemaine: 'Mardi – Samedi : 09h30 – 18h30',
  horairesDimanche: 'Dimanche : 09h00 – 13h00',
  creneaux: '10h00 - 11h30\n11h30 - 13h00\n14h30 - 16h30\n16h30 - 18h30',
  commandesOuvertes: true,
  messageFermeture: 'Les commandes sont fermées pour le moment. Revenez bientôt !'
};

// Catalogue actuel du site principal (sert à l'import et au mode démo)
const U = (id, w = 800) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&q=75&w=${w}`;
export const CATALOGUE_SITE = {
  'tat-1': { ordre: 1, vedette: true, visible: true, titre: 'Tarte Tatin aux Pommes du Verger', categorie: 'tartes', prix: 28, badge: 'Top Vente', image: U('1568571780765-9276ac8b75a2'), accroche: 'La tarte renversée, comme à la maison', description: 'Pommes caramélisées fondantissimes cuites au beurre demi-sel AOP et pâte feuilletée inversée croustillante.', ingredients: 'Pommes Bio, Beurre Charentes-Poitou AOP, Sucre de canne, Farine locale, Sel de Guérande.', allergenes: ['Gluten', 'Lait'], tailles: true, unite: '', conservation: 'Au frais, jusqu\'à 2 jours. À sortir 30 minutes avant de servir, ou à tiédir quelques minutes au four.', delai: 'À commander 48 h à l\'avance.', sansGluten: false },
  'pbr-2': { ordre: 2, vedette: true, visible: true, titre: 'Paris-Brest Praliné Noisette', categorie: 'choux', prix: 30, badge: 'Incontournable', image: U('1509440159596-0249088772ff'), accroche: 'La couronne au praliné noisette', description: 'Couronne de pâte à choux craquelin garnie d\'une crémeuse mousseline au praliné maison et éclats d\'amandes.', ingredients: 'Noisettes du Piémont, Pâte à choux, Beurre frais, Œufs plein air, Sucre glace.', allergenes: ['Gluten', 'Œufs', 'Lait', 'Fruits à coque'], tailles: true, unite: '', conservation: 'Au réfrigérateur, à consommer dans les 24 h. À sortir 15 minutes avant de servir.', delai: 'À commander 48 h à l\'avance.', sansGluten: false },
  'ecl-3': { ordre: 3, vedette: true, visible: true, titre: 'Duo d\'Éclairs Vanille & Caramel', categorie: 'choux', prix: 9.5, badge: 'Format Duo', image: U('1603532648955-039310d9ed75'), accroche: 'Un à la vanille, un au caramel', description: 'Deux grands éclairs garnis d\'une crème pâtissière à la vanille de Madagascar et cœur caramel coulant.', ingredients: 'Gousses de vanille entière, Caramel salé, Pâte à choux artisanale.', allergenes: ['Gluten', 'Œufs', 'Lait'], tailles: false, unite: 'le duo', conservation: 'Au réfrigérateur, à déguster le jour même pour un choux bien croustillant.', delai: 'À commander 24 h à l\'avance.', sansGluten: false },
  'cit-4': { ordre: 4, vedette: false, visible: true, titre: 'Tarte Citron Meringuée & Basilic', categorie: 'tartes', prix: 26, badge: 'Fraîcheur', image: U('1519869325930-281384150729'), accroche: 'Acidulée, fondante, meringue dorée', description: 'Crémeux citron bio de Sicile rafraîchi d\'une pointe de basilic et surmonté d\'une meringue italienne dorée.', ingredients: 'Citrons bio, Pâte sablée, Meringue italienne, Beurre AOP.', allergenes: ['Gluten', 'Œufs', 'Lait'], tailles: true, unite: '', conservation: 'Au réfrigérateur, jusqu\'à 2 jours. La meringue est meilleure le premier jour.', delai: 'À commander 48 h à l\'avance.', sansGluten: false },
  'ent-5': { ordre: 5, vedette: false, visible: true, titre: 'Entremets Chocolat Grand Cru 70%', categorie: 'entremets', prix: 34, badge: 'Gourmand', image: U('1578985545062-69928b1d9587'), accroche: 'Pour les amoureux de chocolat', description: 'Mousse légère au chocolat 70%, biscuit dacquoise et croustillant praliné feuilletine.', ingredients: 'Chocolat 70% pure origine, Crème fleurette, Praliné amande-noisette.', allergenes: ['Gluten', 'Œufs', 'Lait', 'Fruits à coque', 'Soja'], tailles: true, unite: '', conservation: 'Au réfrigérateur, jusqu\'à 3 jours. À sortir 20 minutes avant de servir.', delai: 'À commander 72 h à l\'avance.', sansGluten: false },
  'mil-6': { ordre: 6, vedette: false, visible: true, titre: 'Mille-Feuille Caramélisé Vanille', categorie: 'entremets', prix: 29, badge: 'Tradition', image: U('1587314168485-3236d6710814'), accroche: 'Feuilletage croustillant et vanille', description: 'Trois couches de feuilletage croustillant caramélisé et crème diplomate onctueuse à la gousse de vanille.', ingredients: 'Feuilletage inversé, Vanille de Tahiti, Beurre sec.', allergenes: ['Gluten', 'Œufs', 'Lait'], tailles: true, unite: '', conservation: 'Au réfrigérateur, à consommer dans les 24 h pour garder le feuilletage croustillant.', delai: 'À commander 48 h à l\'avance.', sansGluten: false },
  'mac-7': { ordre: 7, vedette: false, visible: true, titre: 'Coffret Macarons d\'Élodie (12 pièces)', categorie: 'mignardises', prix: 24, badge: 'Sans Gluten', image: U('1569864358642-9d1684040f43'), accroche: 'Six parfums, douze bouchées', description: 'Assortiment de 12 macarons faits main : Pistache, Framboise, Chocolat, Caramel, Citron et Vanille.', ingredients: 'Poudre d\'amande fine, Blancs d\'œufs, Ganaches pure origine.', allergenes: ['Œufs', 'Lait', 'Fruits à coque'], tailles: false, unite: 'le coffret de 12', conservation: 'Au réfrigérateur dans leur boîte, jusqu\'à 4 jours.', delai: 'À commander 72 h à l\'avance.', sansGluten: true },
  'pav-8': { ordre: 8, vedette: false, visible: true, titre: 'Pavlova aux Fruits Rouges de Saison', categorie: 'glutenfree', prix: 31, badge: '100% Sans Gluten', image: U('1565958011703-44f9829ba187'), accroche: 'Meringue croquante et fruits frais', description: 'Coque de meringue suisse crousti-fondante, chantilly mascarpone vanillée et fruits frais.', ingredients: 'Meringue suisse, Fruits rouges bio, Mascarpone, Crème entière.', allergenes: ['Œufs', 'Lait'], tailles: true, unite: '', conservation: 'Au réfrigérateur, à consommer le jour même.', delai: 'À commander 48 h à l\'avance.', sansGluten: true }
};

// ---------- Exemples pour le mode démo ----------
function jour(decalage) {
  const d = new Date(); d.setDate(d.getDate() + decalage);
  return d.toISOString().slice(0, 10);
}

export function donneesDemo() {
  const ingredients = {
    farine: { nom: 'Farine T55', unite: 'g', quantite: 6500, seuil: 2000, prix: 1.2, fournisseur: 'Moulin local' },
    beurre: { nom: 'Beurre doux AOP', unite: 'g', quantite: 1800, seuil: 2000, prix: 11.5, fournisseur: 'Crèmerie' },
    sucre: { nom: 'Sucre en poudre', unite: 'g', quantite: 5000, seuil: 1500, prix: 1.4, fournisseur: 'Grossiste' },
    oeufs: { nom: 'Œufs plein air', unite: 'piece', quantite: 42, seuil: 24, prix: 0.35, fournisseur: 'Ferme du coin' },
    lait: { nom: 'Lait entier', unite: 'ml', quantite: 4000, seuil: 2000, prix: 1.15, fournisseur: 'Crèmerie' },
    creme: { nom: 'Crème liquide 35 %', unite: 'ml', quantite: 1500, seuil: 1000, prix: 4.8, fournisseur: 'Crèmerie' },
    pommes: { nom: 'Pommes', unite: 'g', quantite: 4000, seuil: 2000, prix: 2.6, fournisseur: 'Verger' },
    chocolat: { nom: 'Chocolat noir 70 %', unite: 'g', quantite: 450, seuil: 1000, prix: 18, fournisseur: 'Grossiste' },
    praline: { nom: 'Praliné noisette', unite: 'g', quantite: 900, seuil: 500, prix: 22, fournisseur: 'Grossiste' },
    citrons: { nom: 'Citrons bio', unite: 'piece', quantite: 12, seuil: 6, prix: 0.6, fournisseur: 'Primeur' },
    amande: { nom: 'Poudre d\'amande', unite: 'g', quantite: 1200, seuil: 500, prix: 14, fournisseur: 'Grossiste' },
    vanille: { nom: 'Gousses de vanille', unite: 'piece', quantite: 8, seuil: 4, prix: 2.5, fournisseur: 'Épicerie fine' },
    mascarpone: { nom: 'Mascarpone', unite: 'g', quantite: 500, seuil: 500, prix: 9, fournisseur: 'Crèmerie' },
    fruits: { nom: 'Fruits rouges', unite: 'g', quantite: 800, seuil: 500, prix: 12, fournisseur: 'Primeur' }
  };
  const materiel = {
    cercle24: { nom: 'Cercle à tarte 24 cm', categorie: 'moules', quantite: 2, notes: '' },
    moule24: { nom: 'Moule à manqué 24 cm', categorie: 'moules', quantite: 1, notes: '' },
    cercleEntremets: { nom: 'Cercle à entremets 20 cm', categorie: 'moules', quantite: 1, notes: '' },
    poche: { nom: 'Poche à douille + douille 12 mm', categorie: 'ustensiles', quantite: 3, notes: '' },
    chalumeau: { nom: 'Chalumeau', categorie: 'ustensiles', quantite: 0, notes: 'En panne, à racheter' },
    thermometre: { nom: 'Thermomètre à sucre', categorie: 'ustensiles', quantite: 1, notes: '' },
    robot: { nom: 'Robot pâtissier', categorie: 'appareils', quantite: 1, notes: '' },
    boite: { nom: 'Boîte à gâteau 26 cm', categorie: 'emballage', quantite: 4, notes: '' }
  };
  const M = (materielId, quantite = 1) => ({ materielId, quantite });
  const L = (ingredientId, quantite) => ({ ingredientId, quantite });
  const recettes = {
    'tat-1': { rendement: 8, tempsMin: 90, ingredients: [L('pommes', 1500), L('beurre', 150), L('sucre', 200), L('farine', 250)], materiel: [M('moule24'), M('boite')], etapes: 'Faire un caramel à sec avec le sucre, ajouter le beurre.\nDisposer les pommes en quartiers serrés.\nCuire 45 min à 180 °C, couvrir de pâte feuilletée.\nCuire encore 30 min, refroidir avant de démouler.' },
    'pbr-2': { rendement: 8, tempsMin: 120, ingredients: [L('farine', 150), L('beurre', 300), L('oeufs', 5), L('lait', 500), L('praline', 200), L('sucre', 100)], materiel: [M('poche'), M('robot'), M('boite')], etapes: 'Pâte à choux : pocher une couronne, parsemer d\'amandes, cuire 40 min à 170 °C.\nCrème mousseline au praliné.\nGarnir la couronne refroidie.' },
    'cit-4': { rendement: 8, tempsMin: 100, ingredients: [L('farine', 250), L('beurre', 225), L('sucre', 280), L('oeufs', 6), L('citrons', 4)], materiel: [M('cercle24'), M('thermometre'), M('chalumeau'), M('poche'), M('boite')], etapes: 'Pâte sablée, cuire à blanc.\nCrème citron, couler sur le fond.\nMeringue italienne, pocher et dorer au chalumeau.' },
    'ent-5': { rendement: 8, tempsMin: 150, ingredients: [L('chocolat', 300), L('creme', 500), L('oeufs', 4), L('sucre', 120), L('amande', 120), L('praline', 120)], materiel: [M('cercleEntremets'), M('robot'), M('boite')], etapes: 'Biscuit dacquoise.\nCroustillant praliné.\nMousse chocolat, montage en cercle, congeler.\nGlaçage et décor.' },
    'pav-8': { rendement: 8, tempsMin: 180, ingredients: [L('oeufs', 4), L('sucre', 240), L('mascarpone', 250), L('creme', 250), L('fruits', 400), L('vanille', 1)], materiel: [M('robot'), M('poche'), M('boite')], etapes: 'Meringue suisse, cuire 2 h à 100 °C.\nChantilly mascarpone vanillée.\nDresser avec les fruits au dernier moment.' }
  };
  const produits = JSON.parse(JSON.stringify(CATALOGUE_SITE));
  const ligne = (id, taille, parts, qty) => {
    const p = CATALOGUE_SITE[id]; const t = TAILLES.find(x => x.label === taille);
    return { produitId: id, titre: p.titre, taille: taille || p.unite || '', parts, qty, prix: Math.round(p.prix * (t ? t.mult : 1) * 2) / 2 };
  };
  const cmd = (numero, nom, tel, decalage, heure, statut, lignes, extra = {}) => {
    const total = lignes.reduce((s, l) => s + l.prix * l.qty, 0);
    return { numero, client: { nom, tel, email: '' }, lignes, total, dateRetrait: jour(decalage), heure, statut, source: 'site', notes: '', message: '', acompte: 0, paye: statut === 'retiree', stockDeduit: ['prete', 'retiree'].includes(statut), creeLe: Date.now() - (10 - decalage) * 86400000, ...extra };
  };
  const commandes = {
    d1: cmd('C-1042', 'Exemple · Camille M.', '06 12 34 56 78', 0, '16h30 - 18h30', 'prete', [ligne('tat-1', '6 à 8 parts', 8, 1)]),
    d2: cmd('C-1043', 'Exemple · Julien R.', '06 98 76 54 32', 1, '10h00 - 11h30', 'preparation', [ligne('pbr-2', '10 à 12 parts', 12, 1), ligne('ecl-3', '', 2, 2)]),
    d3: cmd('C-1044', 'Exemple · Sophie T.', '07 11 22 33 44', 2, '14h30 - 16h30', 'confirmee', [ligne('ent-5', '6 à 8 parts', 8, 1)], { acompte: 10 }),
    d4: cmd('C-1045', 'Exemple · Marc P.', '06 55 44 33 22', 4, '11h30 - 13h00', 'nouvelle', [ligne('cit-4', '6 à 8 parts', 8, 1), ligne('mac-7', '', 12, 1)], { message: 'Une personne allergique aux fruits à coque : possible sans praliné ?' }),
    d5: cmd('C-1046', 'Exemple · Léa B.', '06 01 02 03 04', 6, '14h30 - 16h30', 'nouvelle', [{ produitId: null, titre: 'Gâteau sur mesure (20 parts · Anniversaire)', taille: '20 parts', parts: 20, qty: 1, prix: 120 }], { message: 'Thème licorne, rose et doré, « Joyeux anniversaire Lou ».' }),
    d6: cmd('C-1038', 'Exemple · Paul C.', '06 66 77 88 99', -3, '10h00 - 11h30', 'retiree', [ligne('pav-8', '6 à 8 parts', 8, 1)]),
    d7: cmd('C-1035', 'Exemple · Nina D.', '06 23 45 67 89', -8, '16h30 - 18h30', 'retiree', [ligne('tat-1', '10 à 12 parts', 12, 1), ligne('ecl-3', '', 2, 3)]),
    d8: cmd('C-1031', 'Exemple · Hugo L.', '07 98 12 34 56', -15, '11h30 - 13h00', 'retiree', [ligne('ent-5', '10 à 12 parts', 12, 1)]),
    d9: cmd('C-1027', 'Exemple · Emma F.', '06 45 12 78 90', -22, '14h30 - 16h30', 'retiree', [ligne('pbr-2', '6 à 8 parts', 8, 2)]),
    d10: cmd('C-1022', 'Exemple · Tom G.', '06 32 14 25 36', -33, '10h00 - 11h30', 'retiree', [ligne('mil-6', '6 à 8 parts', 8, 1), ligne('mac-7', '', 12, 1)]),
    d11: cmd('C-1020', 'Exemple · Zoé K.', '06 74 85 96 12', -40, '16h30 - 18h30', 'annulee', [ligne('cit-4', '4 parts', 4, 1)])
  };
  return { produits, ingredients, materiel, recettes, commandes, parametres: { infos: { ...PARAMETRES_DEFAUT } } };
}
