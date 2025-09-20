// Import the functions you need from the SDKs you need
import { initializeApp, getApp, getApps} from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth"
import {getFirestore} from "firebase/firestore"

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app;

// Initialize Firebase
if(getApps().length===0){
    app = initializeApp(firebaseConfig);
}
else {
    app = getApp();
}

export const db = getFirestore(app);

export const auth = getAuth(app);

try {
    setPersistence(auth, browserLocalPersistence)
}
catch(e) {
    console.error(e)
}




console.log(import.meta.env.VITE_FIREBASE_PROJECT_ID)