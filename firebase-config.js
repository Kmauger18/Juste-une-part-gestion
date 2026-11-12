// ============================================================
//  Configuration Firebase — partagée par le site et l'espace de gestion
// ============================================================
//  1. Crée le projet Firebase (voir GUIDE-FIREBASE.md).
//  2. Colle ici les valeurs de « firebaseConfig » données par Firebase.
//  3. Écris l'adresse e-mail du compte d'Élodie dans ADMIN_EMAIL
//     (la même que dans firestore.rules).
//
//  Tant que apiKey est vide, le site garde son catalogue actuel
//  et l'espace de gestion fonctionne en MODE DÉMO (données d'exemple
//  enregistrées seulement dans le navigateur).
//  Ces valeurs ne sont pas secrètes : la sécurité vient des règles
//  Firestore (firestore.rules) et du compte d'Élodie.
// ============================================================

export const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

export const ADMIN_EMAIL = "";

export const firebaseActif = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

// Version du SDK Firebase chargée depuis le CDN officiel de Google
export const FIREBASE_SDK = "https://www.gstatic.com/firebasejs/10.12.2";
