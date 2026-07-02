const admin = require('firebase-admin')
const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore')
const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { defineSecret } = require('firebase-functions/params')

// Brevo SMTP key — stored as a Firebase secret
// Set via: firebase functions:secrets:set BREVO_SMTP_KEY
const brevoSmtpKey = defineSecret('BREVO_SMTP_KEY')

// Email addresses
const SUPER_ADMIN_NOTIFY_EMAIL = 'safetymateadmin@yopmail.com'
const SENDER_EMAIL             = 'iamrehman941@gmail.com'
const SENDER_NAME              = 'SafetyMate'
// BREVO_LOGIN_EMAIL: the SMTP login shown in Brevo dashboard → SMTP & API → SMTP tab
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
                To grant or revoke access, open the Super Admin dashboard, navigate to
                <strong style="color: #7ab5ff;">Companies → ${organizationName}</strong>
                and use the <strong style="color: #7ab5ff;">Module Access</strong> toggles.
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
