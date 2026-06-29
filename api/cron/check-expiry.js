import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

// Initialize Firebase Admin
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
const app = initializeApp({
  credential: cert(serviceAccount),
})
const db = getFirestore(app)

export default async function handler(req, res) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = req.headers.authorization
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    // Fetch compliance configuration
    const configDoc = await db.collection('fe_compliance_config').doc('default').get()
    const config = configDoc.exists() ? configDoc.data() : null

    if (!config || !config.channels.email) {
      return res.status(200).json({ success: true, message: 'Email notifications disabled' })
    }

    // Fetch all assets
    const assetsSnapshot = await db.collection('fe_assets').get()
    const assets = assetsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))

    const now = new Date()
    const notificationsSent = []

    for (const asset of assets) {
      if (!asset.certExpiry) continue

      const expiryDate = asset.certExpiry.toDate ? asset.certExpiry.toDate() : new Date(asset.certExpiry)
      const daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24))

      // Check which alert interval applies
      let alertType = null
      if (daysUntilExpiry <= 0 && config.intervals.alert_expired) {
        alertType = 'expired'
      } else if (daysUntilExpiry <= 7 && config.intervals.alert_7day) {
        alertType = '7day'
      } else if (daysUntilExpiry <= 30 && config.intervals.alert_30day) {
        alertType = '30day'
      } else if (daysUntilExpiry <= 90 && config.intervals.alert_90day) {
        alertType = '90day'
      }

      if (alertType) {
        // Prepare email content
        const emailContent = prepareEmailContent(asset, alertType, expiryDate, config.emailTemplate)
        
        // Send email notification
        await sendEmailNotification(asset, emailContent)
        
        notificationsSent.push({
          assetId: asset.id,
          alertType,
          daysUntilExpiry,
        })
      }
    }

    res.status(200).json({ 
      success: true, 
      message: `Processed ${assets.length} assets, sent ${notificationsSent.length} notifications`,
      notificationsSent 
    })
  } catch (error) {
    console.error('Cron job error:', error)
    res.status(500).json({ error: 'Cron job failed', details: error.message })
  }
}

function prepareEmailContent(asset, alertType, expiryDate, template) {
  const placeholders = {
    '[Client Name]': asset.clientName || 'Valued Customer',
    '[Location]': asset.location || 'Your Facility',
    '[Asset ID]': asset.unitId || asset.id,
    '[Extinguisher Type]': asset.type || 'Fire Extinguisher',
    '[Expiry Date]': expiryDate.toLocaleDateString(),
  }

  let content = template || getDefaultTemplate()
  
  // Replace placeholders
  Object.entries(placeholders).forEach(([key, value]) => {
    content = content.replace(new RegExp(key, 'g'), value)
  })

  return content
}

function getDefaultTemplate() {
  return `COMPLIANCE ALERT: Fire Extinguisher Expiry

Dear [Client Name],

This is an automated notification regarding fire extinguisher compliance at [Location].

Asset Details:
• Unit ID: [Asset ID]
• Type: [Extinguisher Type]
• Expiry Date: [Expiry Date]

Please ensure inspection and certification are completed before the expiry date to maintain compliance.

Best regards,
SafetyMate Compliance Team`
}

async function sendEmailNotification(asset, content) {
  const response = await fetch(`${process.env.VERCEL_URL}/api/notifications/send-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: asset.notificationEmail || process.env.DEFAULT_NOTIFICATION_EMAIL,
      subject: 'COMPLIANCE ALERT: Fire Extinguisher Expiry',
      html: content.replace(/\n/g, '<br>'),
      text: content,
    }),
  })

  if (!response.ok) {
    throw new Error(`Failed to send email: ${response.statusText}`)
  }
}
