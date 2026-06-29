import sgMail from '@sendgrid/mail'

// Initialize SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY)

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { to, subject, html, text } = req.body

    if (!to || !subject || (!html && !text)) {
      return res.status(400).json({ error: 'Missing required fields: to, subject, and either html or text' })
    }

    const msg = {
      to,
      from: process.env.SENDGRID_FROM_EMAIL || 'alerts@safetymate.com',
      subject,
      text: text || '',
      html: html || text,
    }

    await sgMail.send(msg)
    res.status(200).json({ success: true, message: 'Email sent successfully' })
  } catch (error) {
    console.error('SendGrid error:', error)
    res.status(500).json({ error: 'Failed to send email', details: error.message })
  }
}
