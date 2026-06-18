import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  limit,
  doc,
  updateDoc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../../../config/firebase.js'

/**
 * Real-time notification hook for training provider dashboard.
 *
 * Reads from the Firestore `notifications` collection.
 * Per-user read state is stored in `readBy.{uid}` on each document.
 *
 * @param {{ uid: string|null, role: string|null }} params
 */
export function useNotifications({ uid, role }) {
  const [roleNotifs, setRoleNotifs] = useState([])
  const [userNotifs, setUserNotifs] = useState([])

  // ── Stream: role-targeted notifications ───────────────────────
  useEffect(() => {
    if (!role) {
      setRoleNotifs([])
      return
    }

    const q = query(
      collection(db, 'notifications'),
      where('recipientRole', '==', role),
      orderBy('createdAt', 'desc'),
      limit(30),
    )

    const unsub = onSnapshot(
      q,
      (snap) => {
        setRoleNotifs(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      },
      (err) => {
        console.warn('Notifications stream unavailable:', err.message)
        setRoleNotifs([])
      },
    )
    return () => unsub()
  }, [role])

  // ── Stream: user-targeted notifications ───────────────────────
  useEffect(() => {
    if (!uid) {
      setUserNotifs([])
      return
    }

    const q = query(
      collection(db, 'notifications'),
      where('recipientUid', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(20),
    )

    const unsub = onSnapshot(
      q,
      (snap) => {
        setUserNotifs(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      },
      () => {
        setUserNotifs([])
      },
    )
    return () => unsub()
  }, [uid])

  const rawNotifications = useMemo(() => {
    const seen = new Set()
    const merged = []
    for (const n of [...roleNotifs, ...userNotifs]) {
      if (seen.has(n.id)) continue
      seen.add(n.id)
      merged.push(n)
    }
    merged.sort((a, b) => tsMillis(b.createdAt) - tsMillis(a.createdAt))
    return merged
  }, [roleNotifs, userNotifs])

  const notifications = useMemo(
    () =>
      rawNotifications.map((n) => ({
        ...n,
        read: Boolean(uid && n.readBy?.[uid]),
        navigateTo: n.navigateTo || defaultNavigateTo(n.type),
      })),
    [rawNotifications, uid],
  )

  const unreadCount = notifications.filter((n) => !n.read).length

  const markRead = useCallback(
    async (id) => {
      if (!uid || !id) return
      const target = rawNotifications.find((n) => n.id === id)
      if (!target || target.readBy?.[uid]) return

      try {
        await updateDoc(doc(db, 'notifications', id), {
          [`readBy.${uid}`]: serverTimestamp(),
        })
      } catch (err) {
        console.warn('Could not mark notification read:', err.message)
      }
    },
    [uid, rawNotifications],
  )

  const markAllRead = useCallback(async () => {
    if (!uid) return
    const unread = rawNotifications.filter((n) => !n.readBy?.[uid])
    if (unread.length === 0) return

    try {
      const batch = writeBatch(db)
      unread.forEach((n) => {
        batch.update(doc(db, 'notifications', n.id), {
          [`readBy.${uid}`]: serverTimestamp(),
        })
      })
      await batch.commit()
    } catch (err) {
      console.warn('Could not mark all notifications read:', err.message)
    }
  }, [uid, rawNotifications])

  return { notifications, unreadCount, markRead, markAllRead }
}

function defaultNavigateTo(type) {
  switch (type) {
    case 'training_request':
      return '/training/requests'
    case 'certificate_registered':
    case 'certificate_issued':
      return '/training/certificates'
    case 'session_scheduled':
      return '/training/calendar'
    default:
      return '/training/dashboard'
  }
}

function tsMillis(val) {
  if (!val) return 0
  if (typeof val.toMillis === 'function') return val.toMillis()
  if (val instanceof Date) return val.getTime()
  if (typeof val === 'number') return val
  return 0
}
