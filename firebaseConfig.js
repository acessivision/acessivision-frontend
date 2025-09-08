// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBx8geRig1gBwqwWRZ9YH-PNZ0EY3WSl0I",
  authDomain: "acessivision-db.firebaseapp.com",
  projectId: "acessivision-db",
  storageBucket: "acessivision-db.firebasestorage.app",
  messagingSenderId: "1069221387475",
  appId: "1:1069221387475:web:233cfa085f9acb556a8826",
  measurementId: "G-BBH9ZGQY7N"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app); 

export { db };