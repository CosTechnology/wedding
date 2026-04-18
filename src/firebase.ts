// ========================================
// Firebase Configuration
// ========================================
// INSTRUÇÕES:
// 1. Vá em https://console.firebase.google.com/
// 2. Crie um novo projeto (ex: "casamento-ray-gabriel")
// 3. Ative o Firestore Database (modo de produção)
// 4. Em configurações do projeto > seus apps > Web, registre um app
// 5. Copie o firebaseConfig e cole abaixo
// 6. Configure as regras do Firestore (veja README.md)

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDhs36P_CMxicoKinhlR0UkOgH7AMhi7mA",
  authDomain: "wedding-60654.firebaseapp.com",
  projectId: "wedding-60654",
  storageBucket: "wedding-60654.firebasestorage.app",
  messagingSenderId: "9308589526",
  appId: "1:9308589526:web:44fd9272f7564756dea877",
  measurementId: "G-GKMDLWGTSX"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
