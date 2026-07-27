import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCIV934K1BzcyajCRjj4xCfvdH6jGJki2M",
  authDomain: "analisador-estoriausuario.firebaseapp.com",
  projectId: "analisador-estoriausuario",
  storageBucket: "analisador-estoriausuario.firebasestorage.app",
  messagingSenderId: "345001619520",
  appId: "1:345001619520:web:6ca060e90909cd6dbc6fa5"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
