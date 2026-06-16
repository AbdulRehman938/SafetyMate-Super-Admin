const admin = require('firebase-admin')
const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore')
const { onCall, HttpsError } = require('firebase-functions/v2/https')

admin.initializeApp()

function chunk(array, size) {
  const out = []
  for (let i = 0; i < array.length; i += size) out.push(array.slice(i, i + size))
  return out
}

function uniqNonEmptyStrings(values) {
  const set = new Set()
  for (const v of values || []) {
    const s = typeof v === 'string' ? v.trim() : ''
    if (s) set.add(s)
  }
  return Array.from(set)
}

async function fetchTokensForTarget(target) {
  const db = admin.firestore()
  const profiles = db.collection('user_profiles')

  const type = String(target?.type || '')
  const values = Array.isArray(target?.values) ? target.values : []

  // Firestore `in` queries allow max 10 values.
  if (type === 'industries') {
    const industries = uniqNonEmptyStrings(values)
    if (industries.length === 0) return []

    const snaps = await Promise.all(
      chunk(industries, 10).map((vals) =>
        profiles.where('industry', 'in', vals).select('fcmToken').get().catch(() => null),
      ),
    )

    const tokens = []
    for (const snap of snaps) {
      if (!snap) continue
      snap.forEach((doc) => tokens.push(doc.get('fcmToken')))
    }
    return uniqNonEmptyStrings(tokens)
  }

  if (type === 'companies') {
    const orgIds = uniqNonEmptyStrings(values)
    if (orgIds.length === 0) return []

    const snaps = await Promise.all(
      chunk(orgIds, 10).map((vals) =>
        profiles.where('organizationId', 'in', vals).select('fcmToken').get().catch(() => null),
      ),
    )

    const tokens = []
    for (const snap of snaps) {
      if (!snap) continue
      snap.forEach((doc) => tokens.push(doc.get('fcmToken')))
    }
    return uniqNonEmptyStrings(tokens)
  }

  // platform: fetch all users that have a non-empty token.
  // Assumes fcmToken is a string. This query may require an index depending on your schema.
  if (type === 'platform') {
    const snap = await profiles.where('fcmToken', '>', '').orderBy('fcmToken').select('fcmToken').get().catch(() => null)
    if (!snap) return []
    const tokens = []
    snap.forEach((doc) => tokens.push(doc.get('fcmToken')))
    return uniqNonEmptyStrings(tokens)
  }

  return []
}

exports.processAnnouncement = onDocumentCreated('announcements/{announcementId}', async (event) => {
  const snap = event.data
  if (!snap) return

  const announcementId = event.params.announcementId
  const announcement = snap.data() || {}

  const status = String(announcement.status || '').toLowerCase()
  if (status !== 'scheduled' && status !== 'immediate') return

  const target = announcement.target || {}
  const subject = String(announcement?.content?.subject || '').trim()
  const body = String(announcement?.content?.body || '').trim()

  const tokens = await fetchTokensForTarget(target)
  if (!tokens || tokens.length === 0) {
    await snap.ref.set(
      {
        status: 'sent',
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        stats: {
          totalReach: 0,
        },
      },
      { merge: true },
    )
    return
  }

  const multicastBatches = chunk(tokens, 500)
  let successCount = 0

  try {
    for (const batch of multicastBatches) {
      const message = {
        tokens: batch,
        notification: {
          title: subject || 'SafetyMate Announcement',
          body: body || 'You have a new announcement.',
        },
        data: {
          announcementId: String(announcementId),
          type: String(target?.type || ''),
        },
      }

      const res = await admin.messaging().sendEachForMulticast(message)
      successCount += res.successCount || 0
    }

    await snap.ref.set(
      {
        status: 'sent',
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        stats: {
          totalReach: successCount,
        },
      },
      { merge: true },
    )
  } catch (err) {
    // Don’t crash the function (and don’t retry forever on permanent errors).
    console.error('[processAnnouncement] Failed', { announcementId, err })
    await snap.ref.set(
      {
        status: 'error',
        error: {
          message: String(err?.message || err || 'Unknown error'),
          at: admin.firestore.FieldValue.serverTimestamp(),
        },
      },
      { merge: true },
    )
  }
})

function isTruthyToken(value) {
  return typeof value === 'string' && value.trim().length > 0
}

async function fetchTokensForSosAlert(alertAfter) {
  const db = admin.firestore()
  const profiles = db.collection('user_profiles')

  const stakeholderIds = Array.isArray(alertAfter?.stakeholderIds) ? alertAfter.stakeholderIds : []
  const orgId = String(alertAfter?.organizationId || '').trim()

  // Preferred: explicit stakeholder IDs on the alert.
  const ids = uniqNonEmptyStrings(stakeholderIds)
  if (ids.length > 0) {
    const snaps = await Promise.all(
      chunk(ids, 10).map((vals) =>
        profiles.where('uid', 'in', vals).select('fcmToken').get().catch(() => null),
      ),
    )
    const tokens = []
    for (const snap of snaps) {
      if (!snap) continue
      snap.forEach((doc) => tokens.push(doc.get('fcmToken')))
    }
    return uniqNonEmptyStrings(tokens).filter(isTruthyToken)
  }

  // Fallback: notify admins/supervisors in the organization.
  if (!orgId) return []

  const roles = ['ADMIN', 'MANAGER', 'SUPERVISOR', 'OWNER']
  const snaps = await Promise.all(
    chunk(roles, 10).map((vals) =>
      profiles
        .where('organizationId', '==', orgId)
        .where('role', 'in', vals)
        .select('fcmToken')
        .get()
        .catch(() => null),
    ),
  )
  const tokens = []
  for (const snap of snaps) {
    if (!snap) continue
    snap.forEach((doc) => tokens.push(doc.get('fcmToken')))
  }
  return uniqNonEmptyStrings(tokens).filter(isTruthyToken)
}

exports.notifyStakeholderOnSosUpdate = onDocumentUpdated('sos_alerts/{alertId}', async (event) => {
  const before = event.data?.before?.data?.() || {}
  const after = event.data?.after?.data?.() || {}

  const beforeStatus = String(before.status || '').toLowerCase()
  const afterStatus = String(after.status || '').toLowerCase()

  // Only notify when the status changes.
  if (!afterStatus || beforeStatus === afterStatus) return

  const alertId = event.params.alertId
  const tokens = await fetchTokensForSosAlert(after)
  if (!tokens || tokens.length === 0) return

  const title = 'SOS Alert Update'
  const body =
    afterStatus === 'resolved'
      ? 'An SOS alert has been resolved.'
      : afterStatus === 'acknowledged'
        ? 'An SOS alert has been acknowledged.'
        : `SOS alert status changed to ${afterStatus}.`

  const batches = chunk(tokens, 500)
  try {
    for (const batch of batches) {
      await admin.messaging().sendEachForMulticast({
        tokens: batch,
        notification: { title, body },
        data: {
          type: 'sos_update',
          alertId: String(alertId),
          status: String(afterStatus),
          organizationId: String(after.organizationId || ''),
        },
      })
    }
  } catch (err) {
    console.error('[notifyStakeholderOnSosUpdate] Failed', { alertId, err })
  }
})

const WORKFORCE_ROLES = ['Safety Officer', 'SHE Representative', 'Manager', 'General Worker']

exports.deleteWorkforceMember = onCall(async (request) => {
  try {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'You must be signed in.')
    }

    const callerUid = request.auth.uid
    const targetUid = String(request.data?.targetUid || '').trim()
    if (!targetUid) throw new HttpsError('invalid-argument', 'targetUid is required.')
    if (targetUid === callerUid) {
      throw new HttpsError('invalid-argument', 'You cannot remove your own account here.')
    }

    const db = admin.firestore()
    const callerSnap = await db.collection('user_profiles').doc(callerUid).get()
    const caller = callerSnap.data() || {}
    const callerRole = String(caller.role || '')
    if (callerRole !== 'client_admin' && callerRole !== 'SUPER_ADMIN') {
      throw new HttpsError('permission-denied', 'Only organization administrators can remove workforce members.')
    }

    const targetRef = db.collection('user_profiles').doc(targetUid)
    const targetSnap = await targetRef.get()
    if (!targetSnap.exists) {
      throw new HttpsError('not-found', 'User profile not found.')
    }

    const tgt = targetSnap.data() || {}
    const tgtRole = String(tgt.role || '')
    if (!WORKFORCE_ROLES.includes(tgtRole)) {
      throw new HttpsError('permission-denied', 'This account cannot be removed from Workforce.')
    }

    const callerOrg = String(caller.organizationId || '').trim()
    const tgtOrg = String(tgt.organizationId || '').trim()
    if (!callerOrg || callerOrg !== tgtOrg) {
      throw new HttpsError('permission-denied', 'Not allowed to remove users outside your organization.')
    }

    await admin
      .auth()
      .deleteUser(targetUid)
      .catch((err) => {
        const code = String(err?.code || '')
        if (code.includes('user-not-found')) return
        throw err
      })

    await targetRef.delete()
    return { ok: true }
  } catch (err) {
    if (err instanceof HttpsError) throw err
    console.error('[deleteWorkforceMember] Failed', err)
    throw new HttpsError('internal', String(err?.message || 'Failed to delete workforce member.'))
  }
})

exports.createClientAdmin = onCall(async (request) => {
  // Callable functions handle CORS automatically. If you see a CORS error in the browser,
  // it usually means this function crashed before sending headers.
  try {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'You must be signed in to create client admins.')
    }

    const callerUid = request.auth.uid
    const db = admin.firestore()
    const callerProfileSnap = await db.collection('user_profiles').doc(callerUid).get().catch(() => null)
    const callerRole = String(callerProfileSnap?.data?.()?.role || '')
    if (callerRole !== 'SUPER_ADMIN') {
      throw new HttpsError('permission-denied', 'Only SUPER_ADMIN can create client admins.')
    }

    const data = request.data || {}
    const email = String(data.email || '').trim().toLowerCase()
    const password = String(data.password || '')
    const organizationId = String(data.organizationId || '').trim()
    const fullName = String(data.fullName || '').trim()

    if (!email) throw new HttpsError('invalid-argument', 'email is required')
    if (password.length < 8) throw new HttpsError('invalid-argument', 'password must be at least 8 characters')
    if (!organizationId) throw new HttpsError('invalid-argument', 'organizationId is required')

    const userRecord = await admin
      .auth()
      .createUser({
        email,
        password,
        displayName: fullName || undefined,
        emailVerified: false,
        disabled: false,
      })
      .catch((err) => {
        const code = String(err?.code || '')
        if (code.includes('email-already-exists')) {
          throw new HttpsError('already-exists', 'A user with this email already exists.')
        }
        throw err
      })

    // Optional but helpful: set custom claims so rules can enforce role/org without extra reads.
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      role: 'client_admin',
      organizationId,
    }).catch(() => {})

    return { uid: userRecord.uid }
  } catch (err) {
    if (err instanceof HttpsError) throw err
    console.error('[createClientAdmin] Failed', err)
    throw new HttpsError('internal', String(err?.message || 'Failed to create client admin.'))
  }
})

