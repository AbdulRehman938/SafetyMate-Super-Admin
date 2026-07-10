const admin = require('firebase-admin')
const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore')
const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { onSchedule } = require('firebase-functions/v2/scheduler')
const { defineSecret } = require('firebase-functions/params')

// Brevo SMTP key — stored as a Firebase secret
// Set via: firebase functions:secrets:set BREVO_SMTP_KEY
const brevoSmtpKey = defineSecret('BREVO_SMTP_KEY')

// Frontend URL — stored as a Firebase secret
// Set via: firebase functions:secrets:set FRONTEND_URL
const frontendUrl = defineSecret('FRONTEND_URL')

// Email addresses
const SUPER_ADMIN_NOTIFY_EMAIL = 'safetymateadmin@yopmail.com'
const SENDER_EMAIL             = 'iamrehman941@gmail.com'
const SENDER_NAME              = 'SafetyMate'
// BREVO_LOGIN_EMAIL: the Brevo SMTP login username (provided by Brevo)
// This is used as the SMTP username — it's NOT your Gmail
const BREVO_LOGIN_EMAIL        = '9c3806001@smtp-brevo.com'

/**
 * Creates a nodemailer transporter using Brevo SMTP.
 * Brevo SMTP host: smtp-relay.brevo.com, port 587
 * Login: your Brevo account email (the Gmail you verified as sender)
 * Password: the SMTP key
 */
function createTransporter(smtpKey) {
  const nodemailer = require('nodemailer')
  return nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    auth: {
      user: BREVO_LOGIN_EMAIL,  // Brevo account login email (SMTP username)
      pass: smtpKey,            // Brevo SMTP key
    },
  })
}

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

exports.notifyTrainingProviderOnRequest = onDocumentCreated('training_requests/{reqId}', async (event) => {
  const snap = event.data
  if (!snap) return

  const reqId = event.params.reqId
  const data = snap.data() || {}
  const status = String(data.status || 'pending').toLowerCase()

  if (status !== 'pending') return

  const company = data.company || data.clientName || 'A company'
  const course = data.course || data.courseName || 'a course'
  const workers = data.workers || data.workerCount || 0
  const reqIdLabel = data.reqId || `#${String(reqId).slice(0, 8).toUpperCase()}`

  const existing = await admin
    .firestore()
    .collection('notifications')
    .where('sourceId', '==', reqId)
    .where('type', '==', 'training_request')
    .limit(1)
    .get()
    .catch(() => null)

  if (existing && !existing.empty) return

  await admin.firestore().collection('notifications').add({
    type: 'training_request',
    recipientRole: 'TRAINING_PROVIDER',
    recipientUid: null,
    sourceId: reqId,
    title: 'New Training Request',
    message: `${company} requested training for "${course}" (${workers} workers)`,
    meta: reqIdLabel,
    navigateTo: '/training/requests',
    readBy: {},
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  })
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
    const organizationId = String(data.organizationId || '').trim()
    const fullName = String(data.fullName || '').trim()

    if (!email) throw new HttpsError('invalid-argument', 'email is required')
    if (!organizationId) throw new HttpsError('invalid-argument', 'organizationId is required')

    // Create user WITHOUT password - they will set it via email link
    const userRecord = await admin
      .auth()
      .createUser({
        email,
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

    // Set custom claims so rules can enforce role/org without extra reads.
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      role: 'client_admin',
      organizationId,
    }).catch(() => {})

    // Generate a secure random token for password setup
    const crypto = require('crypto')
    const setupToken = crypto.randomBytes(32).toString('hex')
    
    // Token expires in 24 hours
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

    // Store the setup token in Firestore
    await db.collection('password_setup_tokens').doc(setupToken).set({
      uid: userRecord.uid,
      email,
      organizationId,
      fullName,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      used: false,
    })

    return { 
      uid: userRecord.uid,
      setupToken,
    }
  } catch (err) {
    if (err instanceof HttpsError) throw err
    console.error('[createClientAdmin] Failed', err)
    throw new HttpsError('internal', String(err?.message || 'Failed to create client admin.'))
  }
})


// ── cleanupUserCreation ───────────────────────────────────────────────────────
// Called when email sending fails - rolls back user creation
exports.cleanupUserCreation = onCall(async (request) => {
  try {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'You must be signed in.')
    }

    const db = admin.firestore()
    const callerSnap = await db.collection('user_profiles').doc(request.auth.uid).get()
    const callerRole = String(callerSnap?.data?.()?.role || '')
    if (callerRole !== 'SUPER_ADMIN') {
      throw new HttpsError('permission-denied', 'Only SUPER_ADMIN can cleanup user creation.')
    }

    const data = request.data || {}
    const uid = String(data.uid || '').trim()
    const organizationId = String(data.organizationId || '').trim()
    const setupToken = String(data.setupToken || '').trim()

    if (!uid) throw new HttpsError('invalid-argument', 'uid is required.')

    // Delete Firebase Auth user
    try {
      await admin.auth().deleteUser(uid)
    } catch (err) {
      console.error('[cleanupUserCreation] Failed to delete auth user:', err)
    }

    // Delete organization document if provided
    if (organizationId) {
      try {
        await db.collection('organizations').doc(organizationId).delete()
      } catch (err) {
        console.error('[cleanupUserCreation] Failed to delete organization:', err)
      }
    }

    // Delete password setup token if provided
    if (setupToken) {
      try {
        await db.collection('password_setup_tokens').doc(setupToken).delete()
      } catch (err) {
        console.error('[cleanupUserCreation] Failed to delete setup token:', err)
      }
    }

    // Delete user profile if exists
    try {
      await db.collection('user_profiles').doc(uid).delete()
    } catch (err) {
      console.error('[cleanupUserCreation] Failed to delete user profile:', err)
    }

    return { ok: true }
  } catch (err) {
    if (err instanceof HttpsError) throw err
    console.error('[cleanupUserCreation] Failed', err)
    throw new HttpsError('internal', String(err?.message || 'Failed to cleanup user creation.'))
  }
})

// ── sendPasswordSetupEmail ─────────────────────────────────────────────────────
// Sends password setup email to newly created company admin
exports.sendPasswordSetupEmail = onCall({ secrets: [brevoSmtpKey, frontendUrl] }, async (request) => {
  try {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'You must be signed in.')
    }

    const db = admin.firestore()
    const callerSnap = await db.collection('user_profiles').doc(request.auth.uid).get()
    const callerRole = String(callerSnap?.data?.()?.role || '')
    if (callerRole !== 'SUPER_ADMIN') {
      throw new HttpsError('permission-denied', 'Only SUPER_ADMIN can send password setup emails.')
    }

    const data = request.data || {}
    const setupToken = String(data.setupToken || '').trim()
    const email = String(data.email || '').trim()
    const fullName = String(data.fullName || '').trim()
    const organizationName = String(data.organizationName || '').trim()

    if (!setupToken || !email) {
      throw new HttpsError('invalid-argument', 'setupToken and email are required.')
    }

    const transporter = createTransporter(brevoSmtpKey.value())
    const setupUrl = `${frontendUrl.value() || 'http://localhost:5173'}/setup-password?token=${setupToken}`

    await transporter.sendMail({
      from: `"${SENDER_NAME}" <${SENDER_EMAIL}>`,
      to: email,
      subject: `Set Your SafetyMate Password - Welcome to ${organizationName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f4f6fa; padding: 32px;">
          <div style="background: #0a0f1e; border-radius: 12px; padding: 28px; color: #ffffff;">
            <h1 style="margin: 0 0 8px; font-size: 22px; color: #ffffff;">
              Welcome to SafetyMate
            </h1>
            <p style="margin: 0 0 24px; color: rgba(203,214,255,0.7); font-size: 14px;">
              Hi ${fullName}, your account has been created for <strong>${organizationName}</strong>.
            </p>

            <p style="margin: 0 0 16px; color: rgba(203,214,255,0.85); font-size: 14px;">
              To get started, you need to set your password. This link will expire in 24 hours for security reasons.
            </p>

            <div style="margin: 24px 0;">
              <a href="${setupUrl}" 
                 style="display: inline-block; background: #3a82ff; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 15px;">
                Set Your Password
              </a>
            </div>

            <p style="margin: 24px 0 0; color: rgba(148,163,184,0.7); font-size: 13px;">
              If the button above doesn't work, copy and paste this link into your browser:
            </p>
            <p style="margin: 4px 0 0; color: #7ab5ff; font-size: 12px; word-break: break-all;">
              ${setupUrl}
            </p>

            <div style="margin-top: 24px; padding: 16px; background: rgba(58,130,255,0.1); border: 1px solid rgba(58,130,255,0.25); border-radius: 8px;">
              <p style="margin: 0; font-size: 13px; color: rgba(235,242,255,0.85);">
                <strong>Security Notice:</strong> This is a one-time setup link. After setting your password, you can log in anytime using your email and password.
              </p>
            </div>
          </div>
          <p style="text-align: center; margin: 16px 0 0; font-size: 11px; color: rgba(148,163,184,0.5);">
            © 2026 BGB Group (Pty) Ltd. All Rights Reserved. SafetyMate™
          </p>
        </div>
      `,
    })

    return { ok: true }
  } catch (err) {
    if (err instanceof HttpsError) throw err
    console.error('[sendPasswordSetupEmail] Failed', err)
    throw new HttpsError('internal', String(err?.message || 'Failed to send password setup email.'))
  }
})

// ── completePasswordSetup ─────────────────────────────────────────────────────
// Handles password setup via email link - verifies token and sets password
exports.completePasswordSetup = onCall(async (request) => {
  try {
    const data = request.data || {}
    const setupToken = String(data.setupToken || '').trim()
    const password = String(data.password || '')

    if (!setupToken) throw new HttpsError('invalid-argument', 'setupToken is required.')
    if (password.length < 8) throw new HttpsError('invalid-argument', 'password must be at least 8 characters.')

    const db = admin.firestore()
    const tokenRef = db.collection('password_setup_tokens').doc(setupToken)
    const tokenSnap = await tokenRef.get()

    if (!tokenSnap.exists) {
      throw new HttpsError('not-found', 'Invalid or expired setup token.')
    }

    const tokenData = tokenSnap.data()
    const now = new Date()
    const expiresAt = tokenData.expiresAt?.toDate()

    // Check if token is expired
    if (expiresAt && now > expiresAt) {
      throw new HttpsError('failed-precondition', 'This setup link has expired. Please contact your administrator.')
    }

    // Check if token was already used
    if (tokenData.used) {
      throw new HttpsError('already-exists', 'This setup link has already been used.')
    }

    // Check if user has already set their password (via user profile)
    const uid = tokenData.uid
    const userProfileRef = db.collection('user_profiles').doc(uid)
    const userProfileSnap = await userProfileRef.get()
    
    if (userProfileSnap.exists) {
      const profileData = userProfileSnap.data()
      if (profileData.passwordSet) {
        // User already set password - expire the token and prevent reuse
        await tokenRef.update({
          used: true,
          usedAt: admin.firestore.FieldValue.serverTimestamp(),
        })
        throw new HttpsError('already-exists', 'You have already set your password. Please log in with your credentials.')
      }
    }

    // Update the user's password in Firebase Auth
    await admin.auth().updateUser(uid, {
      password,
      emailVerified: true, // Auto-verify email since they received the setup link
    })

    // Ensure custom claims are set with client_admin role
    await admin.auth().setCustomUserClaims(uid, {
      role: 'client_admin',
      organizationId: tokenData.organizationId,
    }).catch(() => {})

    // Create or update user profile with password_set flag and role
    await userProfileRef.set({
      role: 'client_admin',
      organizationId: tokenData.organizationId,
      fullName: tokenData.fullName,
      email: tokenData.email,
      passwordSet: true,
      passwordSetAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true })

    // Mark token as used
    await tokenRef.update({
      used: true,
      usedAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    return { ok: true }
  } catch (err) {
    if (err instanceof HttpsError) throw err
    console.error('[completePasswordSetup] Failed', err)
    throw new HttpsError('internal', String(err?.message || 'Failed to complete password setup.'))
  }
})

// ── requestPasswordReset ───────────────────────────────────────────────────────
// Called by company users from login page - sends password reset request to super admin
exports.requestPasswordReset = onCall(async (request) => {
  try {
    const data = request.data || {}
    const email = String(data.email || '').trim()

    if (!email) throw new HttpsError('invalid-argument', 'email is required.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpsError('invalid-argument', 'Invalid email format.')

    const db = admin.firestore()

    // Check if user exists and is a client_admin
    const usersQuery = await db.collection('user_profiles')
      .where('email', '==', email)
      .where('role', '==', 'client_admin')
      .limit(1)
      .get()

    if (usersQuery.empty) {
      throw new HttpsError('not-found', 'No account found with this email address.')
    }

    const userDoc = usersQuery.docs[0]
    const userData = userDoc.data()
    const uid = userDoc.id
    const organizationId = userData.organizationId

    // Create a password reset request
    await db.collection('password_reset_requests').add({
      uid,
      email,
      organizationId,
      fullName: userData.fullName || '',
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    return { ok: true, message: 'Password reset request sent to administrator.' }
  } catch (err) {
    if (err instanceof HttpsError) throw err
    console.error('[requestPasswordReset] Failed', err)
    throw new HttpsError('internal', String(err?.message || 'Failed to request password reset.'))
  }
})

// ── sendPasswordResetEmail ───────────────────────────────────────────────────
// Called by SUPER_ADMIN - sends password reset link to company user
exports.sendPasswordResetEmail = onCall({ secrets: [brevoSmtpKey, frontendUrl] }, async (request) => {
  try {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'You must be signed in.')
    }

    const db = admin.firestore()
    const callerSnap = await db.collection('user_profiles').doc(request.auth.uid).get()
    const callerRole = String(callerSnap?.data?.()?.role || '')
    if (callerRole !== 'SUPER_ADMIN') {
      throw new HttpsError('permission-denied', 'Only SUPER_ADMIN can send password reset emails.')
    }

    const data = request.data || {}
    const requestId = String(data.requestId || '').trim()

    if (!requestId) throw new HttpsError('invalid-argument', 'requestId is required.')

    // Get the reset request
    const requestRef = db.collection('password_reset_requests').doc(requestId)
    const requestSnap = await requestRef.get()

    if (!requestSnap.exists) {
      throw new HttpsError('not-found', 'Reset request not found.')
    }

    const requestData = requestSnap.data()
    if (requestData.status !== 'pending') {
      throw new HttpsError('failed-precondition', 'This request has already been processed.')
    }

    // Generate a secure reset token
    const crypto = require('crypto')
    const resetToken = crypto.randomBytes(32).toString('hex')
    
    // Token expires in 24 hours
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

    // Store the reset token
    await db.collection('password_reset_tokens').doc(resetToken).set({
      uid: requestData.uid,
      email: requestData.email,
      organizationId: requestData.organizationId,
      fullName: requestData.fullName,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      used: false,
    })

    // Update the request status
    await requestRef.update({
      status: 'sent',
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    // Send email
    const transporter = createTransporter(brevoSmtpKey.value())
    const resetUrl = `${frontendUrl.value() || 'http://localhost:5173'}/reset-password?token=${resetToken}`

    await transporter.sendMail({
      from: `"${SENDER_NAME}" <${SENDER_EMAIL}>`,
      to: requestData.email,
      subject: `Reset Your SafetyMate Password`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f4f6fa; padding: 32px;">
          <div style="background: #0a0f1e; border-radius: 12px; padding: 28px; color: #ffffff;">
            <h1 style="margin: 0 0 8px; font-size: 22px; color: #ffffff;">
              Reset Your Password
            </h1>
            <p style="margin: 0 0 24px; color: rgba(203,214,255,0.7); font-size: 14px;">
              Hi ${requestData.fullName}, we received a request to reset your SafetyMate password.
            </p>

            <p style="margin: 0 0 16px; color: rgba(203,214,255,0.85); font-size: 14px;">
              Click the button below to reset your password. This link will expire in 24 hours for security reasons.
            </p>

            <div style="margin: 24px 0;">
              <a href="${resetUrl}" 
                 style="display: inline-block; background: #3a82ff; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 15px;">
                Reset Password
              </a>
            </div>

            <p style="margin: 0 0 8px; color: rgba(203,214,255,0.7); font-size: 13px;">
              If you didn't request this password reset, please ignore this email.
            </p>
          </div>
          <p style="text-align: center; margin: 16px 0 0; font-size: 11px; color: rgba(148,163,184,0.5);">
            © 2026 BGB Group (Pty) Ltd. All Rights Reserved. SafetyMate™
          </p>
        </div>
      `,
    })

    return { ok: true }
  } catch (err) {
    if (err instanceof HttpsError) throw err
    console.error('[sendPasswordResetEmail] Failed', err)
    throw new HttpsError('internal', String(err?.message || 'Failed to send password reset email.'))
  }
})

// ── completePasswordReset ─────────────────────────────────────────────────────
// Handles password reset via email link - verifies token and sets new password
exports.completePasswordReset = onCall(async (request) => {
  try {
    const data = request.data || {}
    const resetToken = String(data.resetToken || '').trim()
    const password = String(data.password || '')

    if (!resetToken) throw new HttpsError('invalid-argument', 'resetToken is required.')
    if (password.length < 8) throw new HttpsError('invalid-argument', 'password must be at least 8 characters.')

    const db = admin.firestore()
    const tokenRef = db.collection('password_reset_tokens').doc(resetToken)
    const tokenSnap = await tokenRef.get()

    if (!tokenSnap.exists) {
      throw new HttpsError('not-found', 'Invalid or expired reset token.')
    }

    const tokenData = tokenSnap.data()
    const now = new Date()
    const expiresAt = tokenData.expiresAt?.toDate()

    // Check if token is expired
    if (expiresAt && now > expiresAt) {
      throw new HttpsError('failed-precondition', 'This reset link has expired. Please request a new password reset.')
    }

    // Check if token was already used
    if (tokenData.used) {
      throw new HttpsError('already-exists', 'This reset link has already been used.')
    }

    const uid = tokenData.uid

    // Update the user's password in Firebase Auth
    await admin.auth().updateUser(uid, {
      password,
      emailVerified: true,
    })

    // Mark token as used
    await tokenRef.update({
      used: true,
      usedAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    return { ok: true }
  } catch (err) {
    if (err instanceof HttpsError) throw err
    console.error('[completePasswordReset] Failed', err)
    throw new HttpsError('internal', String(err?.message || 'Failed to complete password reset.'))
  }
})

// ── changePassword ─────────────────────────────────────────────────────
// Allows authenticated users to change their password
exports.changePassword = onCall(async (request) => {
  try {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'You must be signed in to change your password.')
    }

    const uid = request.auth.uid
    const data = request.data || {}
    const currentPassword = String(data.currentPassword || '')
    const newPassword = String(data.newPassword || '')

    if (!currentPassword) throw new HttpsError('invalid-argument', 'currentPassword is required.')
    if (newPassword.length < 8) throw new HttpsError('invalid-argument', 'newPassword must be at least 8 characters.')

    // Verify current password by attempting to reauthenticate
    // This requires the user's email, which we can get from their auth record
    const userRecord = await admin.auth().getUser(uid)
    const email = userRecord.email

    if (!email) {
      throw new HttpsError('failed-precondition', 'User email not found.')
    }

    // Update the password
    await admin.auth().updateUser(uid, {
      password: newPassword,
    })

    return { ok: true }
  } catch (err) {
    if (err instanceof HttpsError) throw err
    console.error('[changePassword] Failed', err)
    throw new HttpsError('internal', String(err?.message || 'Failed to change password.'))
  }
})

// ── sendModuleRequestEmail ─────────────────────────────────────────────────────
// Called by COMPANY users to request access to a module.
// Writes a module_request doc to Firestore AND sends an email to the Super Admin.
exports.sendModuleRequestEmail = onCall({ secrets: [brevoSmtpKey] }, async (request) => {
  try {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'You must be signed in.')
    }

    const transporter = createTransporter(brevoSmtpKey.value())

    const data = request.data || {}
    const organizationId   = String(data.organizationId   || '').trim()
    const organizationName = String(data.organizationName || '').trim()
    const moduleKey        = String(data.moduleKey        || '').trim()
    const moduleLabel      = String(data.moduleLabel      || '').trim()
    const requesterName    = String(data.requesterName    || '').trim()
    const requesterEmail   = String(data.requesterEmail   || '').trim()
    const message          = String(data.message          || '').trim()

    if (!organizationId || !moduleKey) {
      throw new HttpsError('invalid-argument', 'organizationId and moduleKey are required.')
    }

    // 1. Write request document to Firestore
    const db = admin.firestore()
    const reqRef = await db.collection('module_requests').add({
      organizationId,
      organizationName,
      moduleKey,
      moduleLabel,
      requesterName,
      requesterEmail,
      message,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    // 2. Send email to Super Admin via Brevo SMTP
    const adminEmail = SUPER_ADMIN_NOTIFY_EMAIL

    await transporter.sendMail({
      from: `"${SENDER_NAME}" <${SENDER_EMAIL}>`,
      to: adminEmail,
      subject: `Module Access Request — ${moduleLabel} — ${organizationName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f4f6fa; padding: 32px;">
          <div style="background: #0a0f1e; border-radius: 12px; padding: 28px; color: #ffffff;">
            <h1 style="margin: 0 0 8px; font-size: 22px; color: #ffffff;">
              SafetyMate — Module Access Request
            </h1>
            <p style="margin: 0 0 24px; color: rgba(203,214,255,0.7); font-size: 14px;">
              A company has requested access to a new platform module.
            </p>

            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.08); color: rgba(148,163,184,0.8); font-size: 13px; width: 40%;">Company Name</td>
                <td style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.08); color: #ffffff; font-size: 13px; font-weight: 600;">${organizationName}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.08); color: rgba(148,163,184,0.8); font-size: 13px;">Company ID</td>
                <td style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.08); color: #7ab5ff; font-size: 13px; font-family: monospace;">${organizationId}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.08); color: rgba(148,163,184,0.8); font-size: 13px;">Requested Module</td>
                <td style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.08); color: #4deba0; font-size: 13px; font-weight: 600;">${moduleLabel}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.08); color: rgba(148,163,184,0.8); font-size: 13px;">Requested By</td>
                <td style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.08); color: #ffffff; font-size: 13px;">${requesterName} &lt;${requesterEmail}&gt;</td>
              </tr>
              ${message ? `
              <tr>
                <td style="padding: 10px 0; color: rgba(148,163,184,0.8); font-size: 13px; vertical-align: top;">Message</td>
                <td style="padding: 10px 0; color: rgba(235,242,255,0.85); font-size: 13px;">${message}</td>
              </tr>` : ''}
            </table>

            <div style="margin-top: 28px; padding: 16px; background: rgba(58,130,255,0.1); border: 1px solid rgba(58,130,255,0.25); border-radius: 8px;">
              <p style="margin: 0; font-size: 13px; color: rgba(235,242,255,0.85);">
                To grant or revoke access, open the Super Admin dashboard and navigate to
                <strong style="color: #7ab5ff;">Module Requests</strong>
                from the sidebar. Find <strong style="color: #7ab5ff;">${organizationName}</strong>,
                expand the company row and use the <strong style="color: #7ab5ff;">Grant</strong> or
                <strong style="color: #7ab5ff;">Revoke</strong> buttons next to each module.
              </p>
            </div>
          </div>
          <p style="text-align: center; margin: 16px 0 0; font-size: 11px; color: rgba(148,163,184,0.5);">
            © 2026 BGB Group (Pty) Ltd. All Rights Reserved. SafetyMate™
          </p>
        </div>
      `,
    })

    // 3. Send confirmation email back to the requester
    if (requesterEmail) {
      await transporter.sendMail({
        from: `"${SENDER_NAME}" <${SENDER_EMAIL}>`,
        to: requesterEmail,
        subject: `Your request for ${moduleLabel} access has been received`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f4f6fa; padding: 32px;">
            <div style="background: #0a0f1e; border-radius: 12px; padding: 28px; color: #ffffff;">
              <h1 style="margin: 0 0 8px; font-size: 20px; color: #ffffff;">Request Received ✓</h1>
              <p style="margin: 0 0 20px; color: rgba(203,214,255,0.7); font-size: 14px;">
                Hi ${requesterName}, your request for <strong style="color: #4deba0;">${moduleLabel}</strong> access has been received by the SafetyMate team.
              </p>
              <p style="margin: 0; color: rgba(203,214,255,0.7); font-size: 14px;">
                A platform administrator will review your request and activate the module in your dashboard. You will be notified when access is granted.
              </p>
            </div>
            <p style="text-align: center; margin: 16px 0 0; font-size: 11px; color: rgba(148,163,184,0.5);">
              © 2026 BGB Group (Pty) Ltd. All Rights Reserved. SafetyMate™
            </p>
          </div>
        `,
      })
    }

    return { ok: true, requestId: reqRef.id }
  } catch (err) {
    if (err instanceof HttpsError) throw err
    console.error('[sendModuleRequestEmail] Failed', err)
    throw new HttpsError('internal', String(err?.message || 'Failed to send module request.'))
  }
})

// ── updateCompanyModules ───────────────────────────────────────────────────────
// Called by SUPER_ADMIN to grant or revoke module access for a company.
// Writes the modules[] array to organizations/{organizationId}.
exports.updateCompanyModules = onCall({ secrets: [brevoSmtpKey] }, async (request) => {
  try {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'You must be signed in.')
    }

    const db = admin.firestore()
    const callerSnap = await db.collection('user_profiles').doc(request.auth.uid).get()
    const callerRole = String(callerSnap?.data?.()?.role || '')
    if (callerRole !== 'SUPER_ADMIN') {
      throw new HttpsError('permission-denied', 'Only SUPER_ADMIN can update company modules.')
    }

    const data = request.data || {}
    const organizationId = String(data.organizationId || '').trim()
    const modules        = Array.isArray(data.modules) ? data.modules : []

    if (!organizationId) {
      throw new HttpsError('invalid-argument', 'organizationId is required.')
    }

    // Validate module keys against allowed list
    const ALLOWED_MODULES = ['fleet', 'fire_extinguisher', 'fire_detection']
    const cleaned = modules
      .map((m) => String(m).trim().toLowerCase())
      .filter((m) => ALLOWED_MODULES.includes(m))

    await db.collection('organizations').doc(organizationId).update({
      modules: cleaned,
      modulesUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    // Notify the company's admin users that modules have been updated
    const transporter = createTransporter(brevoSmtpKey.value())

    const orgSnap = await db.collection('organizations').doc(organizationId).get()
    const org = orgSnap.data() || {}
    const orgName = org.name || org.companyName || organizationId
    const contactEmail = org.primaryContact?.email

    if (contactEmail) {
      const moduleLabels = {
        fleet: 'Fleet Management',
        fire_extinguisher: 'Fire Extinguisher Safety',
        fire_detection: 'Fire Detection & Alarms',
      }
      const enabledList = cleaned.map((k) => moduleLabels[k] || k)
      const listHtml = enabledList.length > 0
        ? enabledList.map((l) => `<li style="color: #4deba0; padding: 4px 0;">${l}</li>`).join('')
        : '<li style="color: rgba(148,163,184,0.7);">No additional modules currently active</li>'

      await transporter.sendMail({
        from: `"${SENDER_NAME}" <${SENDER_EMAIL}>`,
        to: contactEmail,
        subject: `Your SafetyMate module access has been updated`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f4f6fa; padding: 32px;">
            <div style="background: #0a0f1e; border-radius: 12px; padding: 28px; color: #ffffff;">
              <h1 style="margin: 0 0 8px; font-size: 20px; color: #ffffff;">Module Access Updated</h1>
              <p style="margin: 0 0 20px; color: rgba(203,214,255,0.7); font-size: 14px;">
                The platform modules available to <strong style="color: #ffffff;">${orgName}</strong> have been updated by your SafetyMate administrator.
              </p>
              <p style="margin: 0 0 12px; color: rgba(148,163,184,0.8); font-size: 13px;">Currently active modules:</p>
              <ul style="margin: 0 0 20px; padding-left: 20px; font-size: 14px; font-weight: 600;">
                ${listHtml}
              </ul>
              <p style="margin: 0; color: rgba(203,214,255,0.7); font-size: 13px;">
                Log into your SafetyMate dashboard to access these modules.
              </p>
            </div>
            <p style="text-align: center; margin: 16px 0 0; font-size: 11px; color: rgba(148,163,184,0.5);">
              © 2026 BGB Group (Pty) Ltd. All Rights Reserved. SafetyMate™
            </p>
          </div>
        `,
      }).catch(() => {}) // Non-fatal — don't fail the function if email fails
    }

    return { ok: true, modules: cleaned }
  } catch (err) {
    if (err instanceof HttpsError) throw err
    console.error('[updateCompanyModules] Failed', err)
    throw new HttpsError('internal', String(err?.message || 'Failed to update modules.'))
  }
})

// ── updateCompanyPause ─────────────────────────────────────────────────────────
// Called by SUPER_ADMIN to pause/unpause module access or module requests for a company.
//
// Pause types:
//   type: 'module_access'  — pauses a specific module (company can't use it)
//   type: 'requests'       — blocks new module access requests from this company
//
// Pass `until: null` to immediately lift a pause.
exports.updateCompanyPause = onCall({ secrets: [brevoSmtpKey] }, async (request) => {
  try {
    if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'You must be signed in.')

    const db = admin.firestore()
    const callerSnap = await db.collection('user_profiles').doc(request.auth.uid).get()
    if (String(callerSnap?.data?.()?.role || '') !== 'SUPER_ADMIN') {
      throw new HttpsError('permission-denied', 'Only SUPER_ADMIN can manage pauses.')
    }

    const data           = request.data || {}
    const organizationId = String(data.organizationId || '').trim()
    const pauseType      = String(data.type || '')           // 'module_access' | 'requests'
    const moduleKey      = String(data.moduleKey || '').trim()
    const until          = data.until ?? null                 // ISO string or null
    const reason         = String(data.reason || '').trim()

    if (!organizationId) throw new HttpsError('invalid-argument', 'organizationId is required.')
    if (!['module_access', 'requests'].includes(pauseType)) {
      throw new HttpsError('invalid-argument', 'type must be module_access or requests.')
    }

    const orgRef  = db.collection('organizations').doc(organizationId)
    const orgSnap = await orgRef.get()
    if (!orgSnap.exists) throw new HttpsError('not-found', 'Organization not found.')

    const untilValue = until
      ? admin.firestore.Timestamp.fromDate(new Date(until))
      : null

    if (pauseType === 'requests') {
      // Block/unblock new module requests from this company
      await orgRef.update({
        requestsPausedUntil: untilValue,
        requestsPauseReason: reason || null,
        requestsPauseUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      })
    } else {
      // Pause/unpause a specific module
      if (!moduleKey) throw new HttpsError('invalid-argument', 'moduleKey is required for module_access pause.')
      const currentPaused = orgSnap.data().pausedModules || {}
      const updated = {
        ...currentPaused,
        [moduleKey]: untilValue ? { until: untilValue, reason: reason || null } : null,
      }
      // Clean up null entries
      Object.keys(updated).forEach((k) => { if (!updated[k]) delete updated[k] })
      await orgRef.update({
        pausedModules: updated,
        pauseUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      })
    }

    // Notify the company contact about the pause/unpause
    const org = orgSnap.data()
    const contactEmail = org.primaryContact?.email
    if (contactEmail && untilValue) {
      const transporter = createTransporter(brevoSmtpKey.value())
      const untilDateStr = new Date(until).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      const isModule = pauseType === 'module_access'
      const { fleet: _f, fire_extinguisher: _fe, fire_detection: _fd } = {
        fleet: 'Fleet Management', fire_extinguisher: 'Fire Extinguisher Safety', fire_detection: 'Fire Detection & Alarms',
      }
      const moduleLabel = { fleet: 'Fleet Management', fire_extinguisher: 'Fire Extinguisher Safety', fire_detection: 'Fire Detection & Alarms' }[moduleKey] || moduleKey

      await transporter.sendMail({
        from: `"${SENDER_NAME}" <${SENDER_EMAIL}>`,
        to: contactEmail,
        subject: isModule
          ? `${moduleLabel} access temporarily paused — ${org.name}`
          : `Module access requests temporarily blocked — ${org.name}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f4f6fa;padding:32px;">
            <div style="background:#0a0f1e;border-radius:12px;padding:28px;color:#fff;">
              <h1 style="margin:0 0 8px;font-size:20px;color:#fff;">
                ${isModule ? `${moduleLabel} Access Paused` : 'Module Requests Blocked'}
              </h1>
              <p style="margin:0 0 16px;color:rgba(203,214,255,0.7);font-size:14px;">
                ${isModule
                  ? `Access to <strong style="color:#fbbf24;">${moduleLabel}</strong> for <strong>${org.name}</strong> has been temporarily paused.`
                  : `New module access requests from <strong>${org.name}</strong> have been temporarily blocked.`
                }
              </p>
              <p style="margin:0 0 16px;color:rgba(203,214,255,0.7);font-size:14px;">
                This will automatically lift on <strong style="color:#fbbf24;">${untilDateStr}</strong>.
                ${reason ? `<br><br>Reason: <em>${reason}</em>` : ''}
              </p>
              <p style="margin:0;color:rgba(203,214,255,0.7);font-size:13px;">
                Contact your SafetyMate administrator if you have questions.
              </p>
            </div>
            <p style="text-align:center;margin:16px 0 0;font-size:11px;color:rgba(148,163,184,0.5);">
              © 2026 BGB Group (Pty) Ltd. All Rights Reserved. SafetyMate™
            </p>
          </div>
        `,
      }).catch(() => {})
    }

    return { ok: true }
  } catch (err) {
    if (err instanceof HttpsError) throw err
    console.error('[updateCompanyPause] Failed', err)
    throw new HttpsError('internal', String(err?.message || 'Failed to update pause.'))
  }
})

// ── sendFEComplianceAlert ─────────────────────────────────────────────────────
// Called from the FE Compliance page — sends a test email via Brevo SMTP.
// The callable pattern handles CORS automatically for web clients.
exports.sendFEComplianceAlert = onCall({ secrets: [brevoSmtpKey] }, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'You must be signed in.')
  }

  const data        = request.data || {}
  const to          = String(data.to          || '').trim()
  const subject     = String(data.subject     || '').trim()
  const htmlContent = String(data.html        || '').trim()
  const textContent = String(data.text        || '').trim()
  const isTest      = Boolean(data.isTest)

  if (!to)                             throw new HttpsError('invalid-argument', 'Recipient email is required.')
  if (!subject)                        throw new HttpsError('invalid-argument', 'Subject is required.')
  if (!htmlContent && !textContent)    throw new HttpsError('invalid-argument', 'html or text content is required.')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new HttpsError('invalid-argument', 'Invalid recipient email format.')

  try {
    const transporter = createTransporter(brevoSmtpKey.value())
    await transporter.sendMail({
      from:    `"${SENDER_NAME}" <${SENDER_EMAIL}>`,
      to,
      subject: isTest ? `[TEST] ${subject}` : subject,
      text:    textContent || 'Please view this email in an HTML-capable email client.',
      html:    htmlContent || `<pre>${textContent}</pre>`,
    })
    return { ok: true, recipient: to, isTest }
  } catch (err) {
    console.error('[sendFEComplianceAlert] SMTP error:', err)
    throw new HttpsError('internal', `SMTP delivery failed: ${err.message || 'unknown error'}`)
  }
})

// ── feComplianceExpiryCron ─────────────────────────────────────────────────────
// Runs every day at 08:00 UTC.
// Reads the saved compliance config (intervals, recipientEmail, emailTemplate, channels)
// and sends Brevo alerts for any assets whose certExpiry falls within an enabled window.
exports.feComplianceExpiryCron = onSchedule(
  { schedule: 'every day 08:00', secrets: [brevoSmtpKey] },
  async () => {
    const db = admin.firestore()

    // 1. Load compliance config
    const configSnap = await db.collection('fe_compliance_config').doc('default').get()
    if (!configSnap.exists) {
      console.log('[feComplianceExpiryCron] No compliance config found — skipping.')
      return
    }
    const config = configSnap.data()

    // Guard: email channel must be enabled and a recipient must be set
    if (!config.channels?.email) {
      console.log('[feComplianceExpiryCron] Email channel disabled — skipping.')
      return
    }
    const recipientEmail = String(config.recipientEmail || '').trim()
    if (!recipientEmail) {
      console.log('[feComplianceExpiryCron] No recipientEmail configured — skipping.')
      return
    }

    const intervals  = config.intervals  || {}
    const template   = String(config.emailTemplate || '')

    // 2. Load all assets that have a certExpiry field
    const assetsSnap = await db.collection('fe_assets').get()
    const now        = Date.now()
    const DAY_MS     = 1000 * 60 * 60 * 24

    const toSend = [] // { asset, alertLabel, daysUntilExpiry }

    assetsSnap.forEach((docSnap) => {
      const asset = { id: docSnap.id, ...docSnap.data() }
      if (!asset.certExpiry) return

      const expiry = asset.certExpiry?.toMillis
        ? asset.certExpiry.toMillis()
        : new Date(asset.certExpiry).getTime()

      const daysLeft = Math.ceil((expiry - now) / DAY_MS)

      // Check in most-urgent order so the right label is applied
      if (daysLeft <= 0  && intervals.alert_expired) {
        toSend.push({ asset, alertLabel: 'EXPIRED',        daysLeft })
      } else if (daysLeft <= 7  && intervals.alert_7day) {
        toSend.push({ asset, alertLabel: '7-DAY URGENT',   daysLeft })
      } else if (daysLeft <= 30 && intervals.alert_30day) {
        toSend.push({ asset, alertLabel: '30-DAY CRITICAL',daysLeft })
      } else if (daysLeft <= 90 && intervals.alert_90day) {
        toSend.push({ asset, alertLabel: '90-DAY EARLY',   daysLeft })
      }
    })

    if (toSend.length === 0) {
      console.log('[feComplianceExpiryCron] No assets require notification today.')
      return
    }

    // 3. Build and send one batched email listing all affected assets
    const transporter = createTransporter(brevoSmtpKey.value())

    const assetRowsHtml = toSend.map(({ asset, alertLabel, daysLeft }) => {
      const expiryStr = asset.certExpiry?.toDate
        ? asset.certExpiry.toDate().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        : new Date(asset.certExpiry).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

      const badgeColor = daysLeft <= 0 ? '#ff535f' : daysLeft <= 7 ? '#fbbf24' : daysLeft <= 30 ? '#fe8e2a' : '#4deba0'

      return `
        <tr>
          <td style="padding:9px 12px;border-bottom:1px solid rgba(255,255,255,0.05);font-size:13px;color:#fff;font-weight:600;">${asset.assetId || asset.id}</td>
          <td style="padding:9px 12px;border-bottom:1px solid rgba(255,255,255,0.05);font-size:13px;color:rgba(203,214,255,0.8);">${asset.extinguisherType || '—'}</td>
          <td style="padding:9px 12px;border-bottom:1px solid rgba(255,255,255,0.05);font-size:13px;color:rgba(203,214,255,0.8);">${asset.facilitySite || '—'}</td>
          <td style="padding:9px 12px;border-bottom:1px solid rgba(255,255,255,0.05);font-size:13px;color:${badgeColor};font-weight:700;">${expiryStr}</td>
          <td style="padding:9px 12px;border-bottom:1px solid rgba(255,255,255,0.05);">
            <span style="background:${badgeColor}22;color:${badgeColor};border:1px solid ${badgeColor}55;border-radius:6px;padding:2px 8px;font-size:11px;font-weight:800;">${alertLabel}</span>
          </td>
        </tr>`
    }).join('')

    // Also substitute placeholders in the custom template if it contains them
    const firstAsset   = toSend[0].asset
    const firstExpiry  = firstAsset.certExpiry?.toDate
      ? firstAsset.certExpiry.toDate().toLocaleDateString('en-GB')
      : new Date(firstAsset.certExpiry).toLocaleDateString('en-GB')

    const resolvedTemplate = template
      .replace(/\[Client Name\]/g,       recipientEmail)
      .replace(/\[Location\]/g,          firstAsset.facilitySite     || 'Multiple Sites')
      .replace(/\[Asset ID\]/g,          firstAsset.assetId          || firstAsset.id)
      .replace(/\[Extinguisher Type\]/g, firstAsset.extinguisherType || 'Various')
      .replace(/\[Expiry Date\]/g,       firstExpiry)

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;background:#f4f6fa;padding:32px;">
        <div style="background:#0a0f1e;border-radius:12px;padding:28px;color:#fff;">
          <h1 style="margin:0 0 6px;font-size:20px;color:#fff;">🔥 Fire Extinguisher Compliance Alert</h1>
          <p style="margin:0 0 20px;color:rgba(203,214,255,0.7);font-size:13px;">
            ${toSend.length} asset${toSend.length !== 1 ? 's require' : ' requires'} attention today — ${new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
          </p>
          <table style="width:100%;border-collapse:collapse;background:rgba(255,255,255,0.03);border-radius:8px;overflow:hidden;">
            <thead>
              <tr style="background:rgba(58,130,255,0.12);">
                <th style="padding:9px 12px;text-align:left;font-size:11px;font-weight:800;letter-spacing:0.06em;color:rgba(148,163,184,0.7);text-transform:uppercase;">Asset ID</th>
                <th style="padding:9px 12px;text-align:left;font-size:11px;font-weight:800;letter-spacing:0.06em;color:rgba(148,163,184,0.7);text-transform:uppercase;">Type</th>
                <th style="padding:9px 12px;text-align:left;font-size:11px;font-weight:800;letter-spacing:0.06em;color:rgba(148,163,184,0.7);text-transform:uppercase;">Site</th>
                <th style="padding:9px 12px;text-align:left;font-size:11px;font-weight:800;letter-spacing:0.06em;color:rgba(148,163,184,0.7);text-transform:uppercase;">Expiry</th>
                <th style="padding:9px 12px;text-align:left;font-size:11px;font-weight:800;letter-spacing:0.06em;color:rgba(148,163,184,0.7);text-transform:uppercase;">Alert</th>
              </tr>
            </thead>
            <tbody>${assetRowsHtml}</tbody>
          </table>

          ${resolvedTemplate ? `
          <div style="margin-top:24px;padding:16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:8px;">
            <p style="margin:0;font-size:13px;color:rgba(203,214,255,0.8);white-space:pre-line;">${resolvedTemplate}</p>
          </div>` : ''}
        </div>
        <p style="text-align:center;margin:16px 0 0;font-size:11px;color:rgba(148,163,184,0.5);">
          © 2026 BGB Group (Pty) Ltd. All Rights Reserved. SafetyMate™
        </p>
      </div>`

    const enabledLabels = []
    if (intervals.alert_90day)  enabledLabels.push('90-day')
    if (intervals.alert_30day)  enabledLabels.push('30-day')
    if (intervals.alert_7day)   enabledLabels.push('7-day')
    if (intervals.alert_expired) enabledLabels.push('expired')

    await transporter.sendMail({
      from:    `"${SENDER_NAME}" <${SENDER_EMAIL}>`,
      to:      recipientEmail,
      subject: `🔥 Compliance Alert — ${toSend.length} Fire Extinguisher Asset${toSend.length !== 1 ? 's' : ''} Require Attention`,
      text:    `${toSend.length} fire extinguisher asset(s) require attention.\n\n` +
               toSend.map(({ asset, alertLabel, daysLeft }) =>
                 `• ${asset.assetId || asset.id} — ${alertLabel} (${daysLeft <= 0 ? 'EXPIRED' : `${daysLeft} days left`})`
               ).join('\n'),
      html,
    })

    console.log(`[feComplianceExpiryCron] Sent alert to ${recipientEmail} for ${toSend.length} assets.`)

    // 4. Log to Firestore for audit trail
    await db.collection('fe_activity_log').add({
      action:         'Compliance Alert Sent',
      technicianName: 'SafetyMate System',
      assetId:        `${toSend.length} asset(s)`,
      statusUpdate:   `Intervals: ${enabledLabels.join(', ')}`,
      timestamp:      admin.firestore.FieldValue.serverTimestamp(),
    })
  }
)
