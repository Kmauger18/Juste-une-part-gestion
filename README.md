# Gestion · Juste une part, merci !

Espace de gestion de la pâtisserie d'Élodie, réservé à son compte. Il pilote le site [Juste une part, merci !](https://github.com/Kmauger18/Juste-une-part-merci-).

En ligne (une fois GitHub Pages activé) : https://kmauger18.github.io/Juste-une-part-gestion/

**Mise en service : suivre [GUIDE-FIREBASE.md](GUIDE-FIREBASE.md).** Avant cela, l'espace fonctionne en mode démo avec des données d'exemple.

## Ce qu'on peut faire

| Écran | Rôle |
|---|---|
| **Tableau de bord** | Chiffre d'affaires du mois, demandes à confirmer, retraits des 7 prochains jours, ingrédients à acheter, stock bas, meilleures ventes |
| **Commandes** | Commandes du site et saisies à la main, classées par date de retrait. Statuts : nouvelle → confirmée → en préparation → prête → retirée. Appel et SMS de confirmation pré-rédigé, acompte, paiement, notes |
| **Produits** | Le catalogue du site : photo (prise au téléphone), prix, tailles, allergènes, visible ou masqué, mis en avant sur l'accueil, ordre |
| **Recettes** | Fiche cuisine recalculée pour n'importe quel nombre de parts, coût de revient, marge |
| **Stock** | Ingrédients, alertes de seuil, réceptions, inventaire, liste de courses |
| **Paramètres** | Téléphone, e-mail, adresse, horaires et créneaux affichés sur le site, ouverture ou fermeture des commandes, sauvegarde |

Le stock se met à jour tout seul : quand une commande passe à « Prête », les ingrédients de ses recettes sont déduits ; si elle est annulée, ils sont remis.

## Sécurité

- Connexion par e-mail et mot de passe (Firebase Authentication), inscription désactivée.
- Règles Firestore ([`firestore.rules`](firestore.rules)) : seul le compte d'Élodie lit et modifie commandes, stock et recettes. Les visiteurs du site peuvent seulement lire les gâteaux visibles et les infos, et envoyer une nouvelle demande de commande.
- La page n'est pas référencée par les moteurs de recherche.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Structure de l'application |
| `firebase-config.js` | Configuration Firebase (même contenu que dans le dépôt du site, plus `ADMIN_EMAIL`) |
| `js/store.js` | Lecture et écriture des données (Firebase ou mode démo) |
| `js/calculs.js` | Coûts de revient, besoins en ingrédients, chiffre d'affaires |
| `js/vues/*.js` | Un fichier par écran |
| `js/donnees.js` | Catégories, allergènes, statuts, catalogue d'origine, données de démo |
| `css/style.css` | Styles compilés (ne pas modifier à la main) |

## Régénérer les styles

Seulement si de nouvelles classes Tailwind sont ajoutées dans le code :

```bash
npx tailwindcss@3.4.17 -c tailwind.config.js -i css/source.css -o css/style.css --minify
```
