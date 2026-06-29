import twilio from 'twilio'

// Initialize Twilio client
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { to, body } = req.body

    if (!to || !body) {
      return res.status(400).json({ error: 'Missing required fields: to and body' })
    }

    const message = await client.messages.create({
      body,
      from: process.env.TWILIO_PHONE_NUMBER,
      to,
    })

    res.status(200).json({ success: true, message: 'SMS sent successfully', sid: message.sid })
  } catch (error) {
    console.error('Twilio error:', error)
    res.status(500).json({ error: 'Failed to send SMS', details: error.message })
  }
}
