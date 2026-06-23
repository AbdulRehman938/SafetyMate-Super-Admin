import { initializeApp } from 'firebase/app'
import { getAnalytics, isSupported } from 'firebase/analytics'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

function requiredEnv(name) {
  const value = import.meta.env[name]
  if (!value || String(value).trim() === '') {
    throw new Error(
      `[Firebase] Missing ${name}. Create a .env file in the project root and add ${name}=... then restart \`npm run dev\` (Vite only loads env on startup).`,
    )
  }
  return value
}

export const firebaseConfig = {
  apiKey: requiredEnv('VITE_FIREBASE_API_KEY'),
  authDomain: requiredEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: requiredEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: requiredEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: requiredEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: requiredEnv('VITE_FIREBASE_APP_ID'),
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)

export const analytics = (() => {
  if (!import.meta.env.VITE_FIREBASE_MEASUREMENT_ID) return null
  if (typeof window === 'undefined') return null

  isSupported()
    .then((supported) => {
      if (supported) {
        try { getAnalytics(app) } catch { /* blocked by ad-blocker — safe to ignore */ }
      }
    })
    .catch(() => {})

  return null
})()

