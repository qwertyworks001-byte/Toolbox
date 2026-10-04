// Toolbox cloud sync settings (Firebase). Leave this as `null` and every tool simply saves on the device you're using.
//
// To turn sync on: create a free Firebase project, add a Web app, and paste the config it gives you over `null` below.
// It looks like:
//
// window.TOOLBOX_FIREBASE = {
//   apiKey: "AIza...",
//   authDomain: "your-project.firebaseapp.com",
//   projectId: "your-project",
//   appId: "1:123456789:web:abc123"
// };
//
// This config is safe to publish: it only identifies your project. What protects people's data is the Firestore
// security rules (each signed-in person can read and write only their own data), which the Habit Tracker's
// "Sign in to sync" window walks you through setting up.
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyD1fixFO0PlFAja96njXPoGnDDOfSZaYCg",
  authDomain: "toolbox-247f4.firebaseapp.com",
  projectId: "toolbox-247f4",
  storageBucket: "toolbox-247f4.firebasestorage.app",
  messagingSenderId: "529613952047",
  appId: "1:529613952047:web:84b1532e52366d5f62a2da",
  measurementId: "G-80EVM1MNJ1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);