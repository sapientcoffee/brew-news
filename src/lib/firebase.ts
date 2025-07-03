import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator, type Firestore } from "firebase/firestore";
import { getAuth, connectAuthEmulator, type Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

// Only initialize Firebase if the project ID is available
if (firebaseConfig.projectId) {
  try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);

    if (process.env.NODE_ENV === 'development') {
      try {
        // These will throw errors if the emulators are already connected during hot-reloads.
        // We can safely ignore these errors.
        connectAuthEmulator(auth, 'http://localhost:9099');
        connectFirestoreEmulator(db, 'localhost', 8080);
      } catch (error: any) {
        const knownErrors = ['failed-precondition', 'auth/emulator-config-failed'];
        if (!knownErrors.includes(error.code)) {
          console.error("Error connecting to Firebase emulators:", error);
        }
      }
    }
  } catch (e) {
    console.error("Firebase initialization failed:", e);
    // Set to null if initialization fails for any reason
    app = null;
    db = null;
    auth = null;
  }
} else {
  console.warn("Firebase projectId is not set in .env. Firestore features will be disabled.");
}

export { app, db, auth };
