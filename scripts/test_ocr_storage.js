import fs from 'fs'
import path from 'path'
import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { getFirestore, collection, addDoc, getDocs, serverTimestamp } from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes, getStorage } from 'firebase/storage'

const envPath = path.resolve(process.cwd(), '.env')
const envContent = fs.readFileSync(envPath, 'utf-8')
const env = {}
envContent.split(/\r?\n/).forEach((line) => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
  if (match) env[match[1]] = (match[2] || '').trim()
})

const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
})

const auth = getAuth(app)
const db = getFirestore(app)
const storage = getStorage(app)

const email = process.argv[2]
const password = process.argv[3]

if (!email || !password) {
  console.error('Usage: node scripts/test_ocr_storage.js <email> <password>')
  process.exit(1)
}

async function main() {
  console.log('Authenticating...')
  await signInWithEmailAndPassword(auth, email, password)
  console.log('Authenticated as', auth.currentUser.email)

  const empSnap = await getDocs(collection(db, 'user_profiles'))
  const employee = empSnap.docs.map((d) => ({ uid: d.id, ...d.data() })).find((e) => e.fullName)
  if (!employee) throw new Error('No employee with fullName found in user_profiles')

  const fileContent = Buffer.from('fake certificate bytes for pipeline test')
  const fileName = `${employee.fullName} - Fire Safety Level 1 - 2028-12-31.jpg`
  const objectPath = `certificates/${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const objectRef = ref(storage, objectPath)

  console.log('Uploading to Storage:', objectPath)
  await uploadBytes(objectRef, fileContent, { contentType: 'image/jpeg' })
  const storageUrl = await getDownloadURL(objectRef)
  console.log('Storage upload OK:', storageUrl)

  const docRef = await addDoc(collection(db, 'certificates'), {
    organizationId: employee.organizationId || '',
    workerId: employee.uid,
    workerName: employee.fullName,
    certificateName: 'Fire Safety Level 1',
    issueDate: new Date().toLocaleDateString(),
    expiryDate: 'Dec 31, 2028',
    storageUrl,
    fileName,
    contentType: 'image/jpeg',
    source: 'ocr_bulk_upload',
    createdAt: serverTimestamp(),
  })

  console.log('Firestore write OK:', docRef.id)
  await signOut(auth)
}

main().catch((err) => {
  console.error('Pipeline test failed:', err.message || err)
  process.exit(1)
})
