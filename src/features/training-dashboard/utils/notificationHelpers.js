import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../../../config/firebase.js'

/**
 * Create an in-app notification for training provider dashboard users.
 */
export async function createProviderNotification({
  type,
  title,
  message,
  meta = '',
  navigateTo = '/training/dashboard',
  sourceId = null,
  recipientUid = null,
}) {
  return addDoc(collection(db, 'notifications'), {
    type,
    recipientRole: recipientUid ? null : 'TRAINING_PROVIDER',
    recipientUid: recipientUid || null,
    sourceId,
    title,
    message,
    meta,
    navigateTo,
    readBy: {},
    createdAt: serverTimestamp(),
  })
}
