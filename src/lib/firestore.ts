// src/lib/firestore.ts
import { cert, getApps, initializeApp } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"

// 1. Define your credentials
const adminConfig = {
    credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
};

// 2. Initialize the app singleton
const app = getApps().length === 0 ? initializeApp(adminConfig) : getApps()[0];

// 3. CRITICAL FIX: Pass "quikresume" as the second parameter to explicitly target it
export const db = getFirestore(app, "quikresume");