import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getFirestore, initializeFirestore, type Firestore } from "firebase/firestore";
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
    auth = getAuth(app);
    initializeApp(firebaseConfig);

    // Initialize Firestore. We need to do this differently for dev vs. prod
    // to support the emulator's proxied URL in Firebase Studio.
    try {
        if (process.env.NODE_ENV === 'development') {
            const firestoreHost = "8080-firebase-new-prototype-1751567115953.cluster-2xfkbshw5rfguuk5qupw267afs.cloudworkstations.dev";
            // Use initializeFirestore to connect to the emulator with a custom URL.
            // connectFirestoreEmulator is not suitable for this.
            db = initializeFirestore(app, {
                host: firestoreHost,
                ssl: true,
                experimentalForceLongPolling: true,
            });
        } else {
            db = getFirestore(app);
        }
    } catch(e: any) {
        // This can happen on hot-reload if firestore is already initialized.
        if (e.code === 'failed-precondition' || e.code === 'invalid-argument') {
            db = getFirestore(app);
        } else {
            throw e;
        }
    }
    
    // Connect Auth emulator in dev mode
    if (process.env.NODE_ENV === 'development') {
      try {
        connectAuthEmulator(auth, 'https://9099-firebase-new-prototype-1751567115953.cluster-2xfkbshw5rfguuk5qupw267afs.cloudworkstations.dev');
      } catch (error: any) {
        // Ignore the 'failed-precondition' error which is thrown when the emulators are already running.
        if (error.code !== 'failed-precondition') {
          console.error("Error connecting to Auth emulator:", error);
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
