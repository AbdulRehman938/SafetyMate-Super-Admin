import { useState, useEffect, useRef } from 'react'
import {
  collection,
  onSnapshot,
  query,
  updateDoc,
  doc,
  addDoc,
  setDoc,
  getDoc,
  serverTimestamp,
  getDocs,
  where,
  writeBatch,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../../../config/firebase.js'
import { useAuth } from '../../../app/providers/authContext.js'
import { createProviderNotification } from '../utils/notificationHelpers.js'

function slugPart(value, maxLen = 48) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, maxLen)
}

function buildCertificateDocId(workerId, course, expiry) {
  return `${slugPart(workerId, 64)}__${slugPart(course)}__${slugPart(expiry)}`
}

function mapTrainingRequest(d) {
  const data = d.data()
  return {
    id: d.id,
    firestoreId: d.id,
    company: data.company || data.clientName || '—',
    clientId: data.clientId || '',
    reqId: data.reqId || `#${d.id.slice(0, 8).toUpperCase()}`,
    course: data.course || data.courseName || '—',
    workers: data.workers || data.workerCount || 0,
    preferredDate: data.preferredDate || data.dates || 'TBD',
    startDate: data.startDate || '',
    endDate: data.endDate || '',
    timeDetail: data.timeDetail || data.time || '',
    status: data.status || 'pending',
    classroom: data.classroom || '',
    instructor: data.instructor || '',
    priority: data.priority || 'Active',
    source: data.source || 'client_request',
  }
}

export function useTrainingData() {
  const { authUser } = useAuth()
  const confirmingRegistrationRef = useRef(false)
  const [requests, setRequests] = useState([])
  const [sessions, setSessions] = useState([])
  const [competencies, setCompetencies] = useState([])
  const [employees, setEmployees] = useState([])
  const [organizations, setOrganizations] = useState([])
  const [loading, setLoading] = useState(true)

  // ── Sync training_requests from Firestore ─────────────────
  useEffect(() => {
    const q = query(collection(db, 'training_requests'))
    const unsub = onSnapshot(
      q,
      (snap) => {
        setRequests(snap.docs.map(mapTrainingRequest))
        setLoading(false)
      },
      (err) => {
        console.warn('Firestore training_requests unavailable:', err.message)
        setLoading(false)
      },
    )
    return () => unsub()
  }, [])

  // ── Sync training_sessions from Firestore (provider-scheduled) ─────────────────
  useEffect(() => {
    const q = query(collection(db, 'training_sessions'))
    const unsub = onSnapshot(
      q,
      (snap) => {
        setSessions(snap.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            company: data.company || data.clientName || '—',
            clientId: data.clientId || '',
            course: data.course || data.courseName || '—',
            workers: data.workers || data.workerCount || 0,
            preferredDate: data.preferredDate || data.dates || 'TBD',
            startDate: data.startDate || '',
            endDate: data.endDate || '',
            timeDetail: data.timeDetail || data.time || '',
            status: data.status || 'approved',
            classroom: data.classroom || '',
            instructor: data.instructor || '',
            priority: data.priority || 'Active',
          }
        }))
      },
      (err) => {
        console.warn('Firestore training_sessions unavailable:', err.message)
      },
    )
    return () => unsub()
  }, [])

  // ── Sync provider-issued certificates only (not company/client certs) ──
  useEffect(() => {
    const certsQ = query(
      collection(db, 'certificates'),
      where('source', 'in', ['ocr_bulk_upload', 'manual_issuance']),
    )
    const unsubCerts = onSnapshot(
      certsQ,
      (snap) => {
        const list = snap.docs.map((docSnap) => {
          const data = docSnap.data()
          return {
            id: docSnap.id,
            name: data.workerName || '—',
            course: data.certificateName || '—',
            expiry: data.expiryDate
              ? data.expiryDate.toDate
                ? new Date(data.expiryDate.toDate()).toLocaleDateString()
                : new Date(data.expiryDate).toLocaleDateString()
              : '—',
            status: 'Certified',
            registeredAt: data.createdAt
              ? data.createdAt.toDate
                ? data.createdAt.toDate()
                : new Date(data.createdAt)
              : new Date(),
            organizationId: data.organizationId || '',
            workerId: data.workerId || '',
            storageUrl: data.storageUrl || '',
            issueDate: data.issueDate || '',
            issuingBody: data.issuingBody || '',
          }
        })
        list.sort((a, b) => b.registeredAt - a.registeredAt)
        setCompetencies(list)
      },
      (err) => {
        console.warn('Firestore certificates unavailable:', err.message)
        setCompetencies([])
      },
    )
    return () => unsubCerts()
  }, [])

  // ── Load Reference Data ─────────────────────────────────
  useEffect(() => {
    async function loadReferenceData() {
      try {
        const empSnap = await getDocs(collection(db, 'user_profiles'))
        const empList = empSnap.docs.map((docSnap) => ({
          uid: docSnap.id,
          ...docSnap.data(),
        }))
        setEmployees(empList)

        const orgSnap = await getDocs(collection(db, 'organizations'))
        const orgList = orgSnap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }))
        setOrganizations(orgList)
      } catch (err) {
        console.error('Failed to load OCR reference data:', err)
      }
    }
    loadReferenceData()
  }, [])

  // ── Actions ─────────────────────────────────────────────
  async function markRequestNotificationsRead(requestId) {
    const uid = authUser?.uid
    if (!uid || !requestId) return

    try {
      const q = query(collection(db, 'notifications'), where('sourceId', '==', requestId))
      const snap = await getDocs(q)
      if (snap.empty) return

      const batch = writeBatch(db)
      snap.docs.forEach((d) => {
        batch.update(d.ref, { [`readBy.${uid}`]: serverTimestamp() })
      })
      await batch.commit()
    } catch (err) {
      console.warn('Could not mark request notifications read:', err.message)
    }
  }

  const handleAccept = async (id) => {
    try {
      await updateDoc(doc(db, 'training_requests', id), { status: 'approved' })
      await markRequestNotificationsRead(id)
    } catch (err) {
      console.warn('Could not update status to approved:', err.message)
      throw err
    }
  }

  const handleReject = async (id) => {
    try {
      await updateDoc(doc(db, 'training_requests', id), { status: 'rejected' })
      await markRequestNotificationsRead(id)
    } catch (err) {
      console.warn('Could not update status to rejected:', err.message)
      throw err
    }
  }

  const handleBulkApprove = async (selectedIds) => {
    let successCount = 0
    let failureCount = 0
    const errors = []

    for (const id of selectedIds) {
      try {
        await updateDoc(doc(db, 'training_requests', id), { status: 'approved' })
        await markRequestNotificationsRead(id)
        successCount++
      } catch (err) {
        failureCount++
        errors.push({ id, error: err.message })
        console.warn('Bulk approve error for ' + id + ':', err.message)
      }
    }

    return { successCount, failureCount, errors }
  }

  const handleBulkReject = async (selectedIds) => {
    let successCount = 0
    let failureCount = 0
    const errors = []

    for (const id of selectedIds) {
      try {
        await updateDoc(doc(db, 'training_requests', id), { status: 'rejected' })
        await markRequestNotificationsRead(id)
        successCount++
      } catch (err) {
        failureCount++
        errors.push({ id, error: err.message })
        console.warn('Bulk reject error for ' + id + ':', err.message)
      }
    }

    return { successCount, failureCount, errors }
  }

  const handleCreateDeployment = async (deployment) => {
    try {
      const docRef = await addDoc(collection(db, 'training_sessions'), {
        company: deployment.company,
        clientId: deployment.clientId || '',
        course: deployment.course,
        workers: parseInt(deployment.workers || 1, 10),
        preferredDate: deployment.preferredDate,
        startDate: deployment.startDate || '',
        endDate: deployment.endDate || '',
        timeDetail: deployment.timeDetail || '09:00 - 17:00 EST',
        status: 'approved',
        classroom: deployment.classroom || '',
        instructor: deployment.instructor || '',
        priority: deployment.priority || 'Active',
        createdAt: serverTimestamp(),
      })

      await createProviderNotification({
        type: 'session_scheduled',
        title: 'Session Scheduled',
        message: `${deployment.course} scheduled for ${deployment.company} (${deployment.workers || 0} workers).`,
        meta: deployment.preferredDate || 'TBD',
        navigateTo: '/training/calendar',
        sourceId: docRef.id,
      })

      return docRef.id
    } catch (err) {
      console.error('Failed to create deployment:', err)
      throw err
    }
  }

  const handleUpdateDeployment = async (id, updates) => {
    try {
      // Try to update in training_sessions first (provider-scheduled)
      const sessionRef = doc(db, 'training_sessions', id)
      const sessionSnap = await getDoc(sessionRef)
      
      if (sessionSnap.exists()) {
        await updateDoc(sessionRef, updates)
      } else {
        // Fall back to training_requests (client requests)
        await updateDoc(doc(db, 'training_requests', id), updates)
      }
    } catch (err) {
      console.error('Failed to update deployment:', err)
      throw err
    }
  }

  const handleConfirmRegistration = async (pendingRegistration) => {
    if (!pendingRegistration) return
    if (confirmingRegistrationRef.current) {
      throw new Error('Registration already in progress. Please wait.')
    }

    const { file, ...registration } = pendingRegistration
    if (!file) {
      const err = new Error('No certificate file attached for upload')
      console.error('Certificate registration failed:', err.message)
      throw err
    }

    confirmingRegistrationRef.current = true

    let storageUrl
    try {
      const safeName = String(file.name || 'certificate').replace(/[^a-zA-Z0-9._-]/g, '_')
      const objectPath = `certificates/${Date.now()}_${safeName}`
      const objectRef = ref(storage, objectPath)
      await uploadBytes(objectRef, file, { contentType: file.type || undefined })
      storageUrl = await getDownloadURL(objectRef)
    } catch (err) {
      console.error('Certificate file upload failed:', err)
      confirmingRegistrationRef.current = false
      throw err
    }

    try {
      const certDocId = buildCertificateDocId(registration.uid, registration.course, registration.expiry)
      const certRef = doc(db, 'certificates', certDocId)
      const existingSnap = await getDoc(certRef)
      const isNewCertificate = !existingSnap.exists()

      // Deterministic doc ID prevents duplicate rows from repeated confirm clicks.
      await setDoc(
        certRef,
        {
          organizationId: registration.orgId || '',
          workerId: registration.uid || '',
          workerName: registration.name,
          certificateName: registration.course,
          issueDate: new Date().toLocaleDateString(),
          expiryDate: registration.expiry,
          storageUrl,
          fileName: file.name,
          contentType: file.type || '',
          source: 'ocr_bulk_upload',
          registeredBy: authUser?.uid || '',
          updatedAt: serverTimestamp(),
          ...(registration.trainingRequestId ? { trainingRequestId: registration.trainingRequestId } : {}),
          ...(isNewCertificate ? { createdAt: serverTimestamp() } : {}),
        },
        { merge: true },
      )

      if (isNewCertificate) {
        await createProviderNotification({
          type: 'certificate_registered',
          title: 'Certificate Registered',
          message: `${registration.name} — ${registration.course} registered via bulk upload.`,
          meta: registration.course,
          navigateTo: '/training/certificates',
        })
      }

      return certDocId
    } catch (err) {
      console.error('Failed to register certificate in Firestore:', err)
      throw err
    } finally {
      confirmingRegistrationRef.current = false
    }
  }

  const handleManualIssueCertificate = async (certificateData) => {
    if (!certificateData) return
    try {
      await addDoc(collection(db, 'certificates'), {
        organizationId: certificateData.orgId || '',
        workerId: certificateData.workerId || '',
        workerName: certificateData.workerName,
        certificateName: certificateData.certificateName,
        issuingBody: certificateData.issuingBody || '',
        issueDate: certificateData.issueDate,
        expiryDate: certificateData.expiryDate,
        source: 'manual_issuance',
        createdAt: serverTimestamp(),
      })

      await createProviderNotification({
        type: 'certificate_issued',
        title: 'Certificate Issued',
        message: `${certificateData.workerName} — ${certificateData.certificateName} issued successfully.`,
        meta: certificateData.certificateName,
        navigateTo: '/training/certificates',
      })
    } catch (err) {
      console.error('Failed to issue certificate:', err)
      throw err
    }
  }

  return {
    requests,
    sessions,
    competencies,
    employees,
    organizations,
    loading,
    handleAccept,
    handleReject,
    handleBulkApprove,
    handleBulkReject,
    handleCreateDeployment,
    handleUpdateDeployment,
    handleConfirmRegistration,
    handleManualIssueCertificate,
  }
}
