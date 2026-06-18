const TEMPLATE_WIDTH = 850
const TEMPLATE_HEIGHT = 1100

const TEMPLATE_FIELDS = [
  { label: 'Candidate Name', hint: 'Full legal name as registered in SafetyMate' },
  { label: 'Course / Competency', hint: 'e.g. Working at Heights, Fire Safety Level 1' },
  { label: 'Issue Date', hint: 'YYYY-MM-DD' },
  { label: 'Expiry Date', hint: 'YYYY-MM-DD (required for OCR registration)' },
  { label: 'Issuing Body', hint: 'SafetyMate Certified or accredited provider' },
]

function triggerDownload(href, filename) {
  const link = document.createElement('a')
  link.href = href
  link.download = filename
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

function drawTemplate(ctx) {
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, TEMPLATE_WIDTH, TEMPLATE_HEIGHT)

  ctx.strokeStyle = '#1e3a8a'
  ctx.lineWidth = 6
  ctx.strokeRect(28, 28, TEMPLATE_WIDTH - 56, TEMPLATE_HEIGHT - 56)

  ctx.strokeStyle = '#93c5fd'
  ctx.lineWidth = 2
  ctx.strokeRect(48, 48, TEMPLATE_WIDTH - 96, TEMPLATE_HEIGHT - 96)

  ctx.fillStyle = '#0f172a'
  ctx.textAlign = 'center'
  ctx.font = '700 42px Georgia, "Times New Roman", serif'
  ctx.fillText('CERTIFICATE OF COMPETENCY', TEMPLATE_WIDTH / 2, 130)

  ctx.font = '500 18px Arial, Helvetica, sans-serif'
  ctx.fillStyle = '#475569'
  ctx.fillText('SafetyMate Training & Compliance Layout Template', TEMPLATE_WIDTH / 2, 168)

  ctx.textAlign = 'left'
  let y = 240
  TEMPLATE_FIELDS.forEach(({ label, hint }) => {
    ctx.fillStyle = '#0f172a'
    ctx.font = '700 22px Arial, Helvetica, sans-serif'
    ctx.fillText(`${label}:`, 90, y)

    ctx.strokeStyle = '#cbd5e1'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(90, y + 18)
    ctx.lineTo(TEMPLATE_WIDTH - 90, y + 18)
    ctx.stroke()

    ctx.fillStyle = '#64748b'
    ctx.font = '400 14px Arial, Helvetica, sans-serif'
    ctx.fillText(hint, 90, y + 42)

    y += 92
  })

  ctx.fillStyle = '#334155'
  ctx.font = '600 16px Arial, Helvetica, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('Required for OCR bulk upload and scanned certificate registration', TEMPLATE_WIDTH / 2, TEMPLATE_HEIGHT - 120)

  ctx.font = '400 14px Arial, Helvetica, sans-serif'
  ctx.fillStyle = '#64748b'
  ctx.fillText('Supported upload formats: PDF, PNG, JPG', TEMPLATE_WIDTH / 2, TEMPLATE_HEIGHT - 92)
}

function renderTemplateCanvas() {
  const canvas = document.createElement('canvas')
  canvas.width = TEMPLATE_WIDTH
  canvas.height = TEMPLATE_HEIGHT
  const ctx = canvas.getContext('2d')
  drawTemplate(ctx)
  return canvas
}

function loadJsPDF() {
  return new Promise((resolve, reject) => {
    if (window.jspdf?.jsPDF) {
      resolve(window.jspdf.jsPDF)
      return
    }
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
    script.onload = () => {
      if (window.jspdf?.jsPDF) resolve(window.jspdf.jsPDF)
      else reject(new Error('jsPDF failed to load'))
    }
    script.onerror = () => reject(new Error('Could not load jsPDF'))
    document.body.appendChild(script)
  })
}

export async function downloadCertificateTemplate(format) {
  const canvas = renderTemplateCanvas()

  if (format === 'png') {
    triggerDownload(canvas.toDataURL('image/png'), 'SafetyMate-Certificate-Template.png')
    return
  }

  if (format === 'jpg') {
    triggerDownload(canvas.toDataURL('image/jpeg', 0.92), 'SafetyMate-Certificate-Template.jpg')
    return
  }

  if (format === 'pdf') {
    const jsPDF = await loadJsPDF()
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'px',
      format: [TEMPLATE_WIDTH, TEMPLATE_HEIGHT],
    })
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, TEMPLATE_WIDTH, TEMPLATE_HEIGHT)
    pdf.save('SafetyMate-Certificate-Template.pdf')
    return
  }

  throw new Error(`Unsupported template format: ${format}`)
}

export const CERTIFICATE_TEMPLATE_FORMATS = [
  { id: 'pdf', label: 'PDF Template' },
  { id: 'png', label: 'PNG Template' },
  { id: 'jpg', label: 'JPG Template' },
]
