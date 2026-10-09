// Toolbox cloud sync settings (Firebase).
// This config is safe to publish: it only identifies the project. What protects people's data is the Firestore
// security rules (each signed-in person can read and write only their own data).
window.TOOLBOX_FIREBASE = {
  apiKey: "AIzaSyD1fixFO0PlFAja96njXPoGnDDOfSZaYCg",
  authDomain: "toolbox-247f4.firebaseapp.com",
  projectId: "toolbox-247f4",
  storageBucket: "toolbox-247f4.firebasestorage.app",
  messagingSenderId: "529613952047",
  appId: "1:529613952047:web:84b1532e52366d5f62a2da",
  measurementId: "G-80EVM1MNJ1"
};

// App Check: proves requests come from the real Toolbox site. The site key is public, like the settings above.
window.TOOLBOX_APPCHECK_KEY = "6LcxLOYtAAAAAH-YVP-z3F7V-hHF5iBvcA4FBjd7";
// Every page that starts Firebase calls this right after firebase.initializeApp(...). It does nothing if the App Check
// library isn't loaded, so a problem here can never stop a page from working.
window.toolboxActivateAppCheck = function () {
  try {
    if (window.__toolboxAppCheckOn || !window.TOOLBOX_APPCHECK_KEY || !window.firebase || !firebase.appCheck) return;
    // On your own computer (localhost) App Check uses a debug token, printed in the browser console, which you add in
    // Firebase -> App Check -> Apps -> Manage debug tokens.
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    firebase.appCheck().activate(new firebase.appCheck.ReCaptchaEnterpriseProvider(window.TOOLBOX_APPCHECK_KEY), true);
    window.__toolboxAppCheckOn = true;
  } catch (e) { console.warn('App Check is not active:', e); }
};