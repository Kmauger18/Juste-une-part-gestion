// ============================================================
//  Configuration Firebase — partagée par le site et l'espace de gestion
// ============================================================
//  1. Crée le projet Firebase (voir GUIDE-FIREBASE.md).
//  2. Colle ici les valeurs de « firebaseConfig » données par Firebase.
//  3. Les comptes qui ont accès à l'espace de gestion se créent dans
//     Firebase → Authentication → Users : chaque compte ajouté y a accès.
//
//  Tant que apiKey est vide, le site garde son catalogue actuel
//  et l'espace de gestion fonctionne en MODE DÉMO (données d'exemple
//  enregistrées seulement dans le navigateur).
//  Ces valeurs ne sont pas secrètes : la sécurité vient des règles
//  Firestore (firestore.rules) et du compte d'Élodie.
// ============================================================

export const firebaseConfig = {
  apiKey: "AIzaSyD2OPOGWMFpg5D7kLY2Ueyzh6ZN4meARw0",
  authDomain: "juste-une-part-merci.firebaseapp.com",
  projectId: "juste-une-part-merci",
  storageBucket: "juste-une-part-merci.firebasestorage.app",
  messagingSenderId: "348762982440",
  appId: "1:348762982440:web:bfa8612da9dad745368d1d"
};

// Laisser vide : tout compte créé dans Firebase Authentication a accès.
// (Mettre une adresse ici limiterait l'espace de gestion à ce seul compte.)
export const ADMIN_EMAIL = "";

export const firebaseActif = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

// Version du SDK Firebase chargée depuis le CDN officiel de Google
export const FIREBASE_SDK = "https://www.gstatic.com/firebasejs/10.12.2";
