# Mettre en service la base de données (Firebase, gratuit)

Tant que ces étapes ne sont pas faites, l'espace de gestion fonctionne en **mode démo** (données d'exemple sur l'appareil) et le site garde son catalogue intégré. Compter environ 20 minutes.

Formule utilisée : **Spark (gratuite)**. Aucune carte bancaire n'est demandée, aucun service payant n'est utilisé.

## 1. Créer le projet

1. Va sur <https://console.firebase.google.com> avec le compte Google qui gérera le projet.
2. **Ajouter un projet** → nom : `juste-une-part` → tu peux désactiver Google Analytics → **Créer**.

## 2. Créer le compte d'Élodie

1. Menu **Créer → Authentication → Commencer**.
2. Onglet **Sign-in method** → **E-mail/Mot de passe** → activer (seulement la première option) → **Enregistrer**.
3. Onglet **Users** → **Ajouter un utilisateur** → l'adresse e-mail d'Élodie et un mot de passe solide.
4. Onglet **Paramètres → Actions de l'utilisateur** → **décocher « Activer la création (inscription) »**. Personne d'autre ne pourra se créer un compte.
5. Onglet **Paramètres → Domaines autorisés** → **Ajouter un domaine** → `kmauger18.github.io`.

## 3. Créer la base

1. Menu **Créer → Firestore Database → Créer une base de données**.
2. Emplacement : **eur3 (Europe)**. Mode : **production** → **Créer**.
3. Onglet **Règles** : remplace tout par le contenu du fichier [`firestore.rules`](firestore.rules) → **Publier**.

## 4. Récupérer la configuration

1. Roue dentée → **Paramètres du projet** → en bas, **Vos applications** → icône **`</>`** (Web).
2. Nom : `site` → **Enregistrer l'application** (pas besoin de Firebase Hosting).
3. Firebase affiche un bloc `const firebaseConfig = { apiKey: "...", ... }`. Garde-le sous la main.

## 5. Coller la configuration dans les deux dépôts

Dans **`firebase-config.js`** de chaque dépôt (`Juste-une-part-gestion` et `Juste-une-part-merci-`), sur GitHub (crayon → modifier) :

- recopie les valeurs `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId` ;
- laisse `ADMIN_EMAIL` vide : tout compte créé dans Authentication a accès.

Ces valeurs ne sont pas secrètes : elles identifient seulement le projet. La protection vient des règles de l'étape 3 et du mot de passe d'Élodie.

## 6. Mettre en ligne l'espace de gestion

1. Dépôt `Juste-une-part-gestion` → **Settings → Pages** → branche **main**, dossier **/ (root)** → **Save**.
2. Après une minute, l'espace est à l'adresse <https://kmauger18.github.io/Juste-une-part-gestion/>.
3. Élodie se connecte avec son e-mail et son mot de passe.

## 7. Premier démarrage

1. **Paramètres → Importer le catalogue d'origine du site** : les 8 gâteaux actuels arrivent dans la base.
2. **Paramètres → Infos affichées sur le site** : vérifier le téléphone, ajouter l'e-mail, **Enregistrer**.
3. **Stock** : ajouter les ingrédients avec leur prix, puis **Recettes** pour chaque gâteau.

À partir de là :

- le site affiche les gâteaux et les infos de la base (le fichier `infos.txt` ne sert plus que de secours) ;
- les commandes passées sur le site arrivent dans **Commandes**, avec le statut « Nouvelle ».

## Sur le téléphone d'Élodie

Ouvrir l'adresse de l'espace de gestion dans Safari ou Chrome, puis **Partager → Sur l'écran d'accueil** (iPhone) ou **⋮ → Ajouter à l'écran d'accueil** (Android). L'espace s'ouvre alors comme une application.

## Limites de la formule gratuite

Largement suffisantes pour une pâtisserie : 50 000 lectures et 20 000 écritures par jour, 1 Go de données. Les photos de gâteaux sont réduites automatiquement pour rester légères.

## Donner accès à quelqu'un d'autre

Firebase → **Authentication → Users → Ajouter un utilisateur** (adresse e-mail et mot de passe). Le compte a accès à l'espace de gestion immédiatement, sur le site comme dans l'application Android, sans rien modifier d'autre.

Pour retirer un accès : dans la même liste, menu **⋮** du compte → **Désactiver le compte** ou **Supprimer le compte**.

L'inscription libre doit rester **désactivée** (Authentication → Paramètres → Actions de l'utilisateur) : c'est elle qui garantit que seuls les comptes ajoutés à la main ont accès.
