'use strict';

const crypto = require('crypto');

const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX = 5;
const rateStore = global.__SELLERY_CONTACT_RATE_STORE__ || new Map();
global.__SELLERY_CONTACT_RATE_STORE__ = rateStore;

const INTENTS = new Set([
  'Sell my business',
  'Consulting engagement',
  'Strategic partnership',
  'Technology opportunity',
  'Investment or portfolio opportunity',
  'General inquiry'
]);

function clean(value, maxLength = 500) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .trim()
    .slice(0, maxLength);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function pdfSafe(value) {
  return String(value)
    .normalize('NFKD')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u2022/g, '*')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '?');
}

function pdfEscape(value) {
  return pdfSafe(value)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[\r\n]+/g, ' ');
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value);
}

function isHttpUrl(value) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded) return forwarded.split(',')[0].trim();
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

function checkRateLimit(ip) {
  const now = Date.now();
  for (const [key, value] of rateStore.entries()) {
    if (now - value.start > RATE_WINDOW_MS * 2) rateStore.delete(key);
  }

  const current = rateStore.get(ip);
  if (!current || now - current.start > RATE_WINDOW_MS) {
    rateStore.set(ip, { start: now, count: 1 });
    return { allowed: true, remaining: RATE_MAX - 1 };
  }

  current.count += 1;
  rateStore.set(ip, current);
  return {
    allowed: current.count <= RATE_MAX,
    remaining: Math.max(0, RATE_MAX - current.count),
    retryAfter: Math.ceil((RATE_WINDOW_MS - (now - current.start)) / 1000)
  };
}

function validatePayload(raw) {
  const payload = {
    intent: clean(raw.intent, 100),
    name: clean(raw.name, 100),
    email: clean(raw.email, 160).toLowerCase(),
    phone: clean(raw.phone, 40),
    company: clean(raw.company, 140),
    website: clean(raw.website, 240),
    companyType: clean(raw.companyType, 100),
    revenue: clean(raw.revenue, 100),
    message: clean(raw.message, 5000),
    consent: raw.consent === true || raw.consent === 'true' || raw.consent === 'on',
    startedAt: Number(raw.startedAt || 0),
    source: clean(raw.source, 400),
    userAgent: clean(raw.userAgent, 500),
    honeypot: clean(raw.fax_number, 200)
  };

  const errors = [];
  if (!INTENTS.has(payload.intent)) errors.push('Select a valid opportunity type.');
  if (payload.name.length < 2) errors.push('Enter your full name.');
  if (!isEmail(payload.email)) errors.push('Enter a valid email address.');
  if (payload.website && !isHttpUrl(payload.website)) errors.push('Enter a valid website URL.');
  if (payload.message.length < 20) errors.push('Provide at least 20 characters of detail.');
  if (!payload.consent) errors.push('Consent is required.');

  return { payload, errors };
}

function makeReference() {
  const now = new Date();
  const date = [now.getUTCFullYear(), String(now.getUTCMonth() + 1).padStart(2, '0'), String(now.getUTCDate()).padStart(2, '0')].join('');
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `SEL-${date}-${suffix}`;
}

function num(value) {
  return Number(value.toFixed(3)).toString();
}

function rgb(color, stroke = false) {
  const suffix = stroke ? 'RG' : 'rg';
  return `${num(color[0])} ${num(color[1])} ${num(color[2])} ${suffix}`;
}

function estimateTextWidth(text, size, bold = false) {
  let units = 0;
  for (const char of String(text)) {
    if (char === ' ') units += 0.28;
    else if ('ilI.,:;!|\'`'.includes(char)) units += 0.25;
    else if ('mwMW@%&QO'.includes(char)) units += 0.84;
    else if (/[A-Z]/.test(char)) units += 0.64;
    else if (/[0-9]/.test(char)) units += 0.56;
    else if (/[-_\/\\()\[\]]/.test(char)) units += 0.38;
    else units += 0.52;
  }
  return units * size * (bold ? 1.035 : 1);
}

function wrapText(text, fontSize, maxWidth, bold = false) {
  const safe = pdfSafe(text);
  const paragraphs = safe.split(/\n/);
  const lines = [];

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      lines.push('');
      continue;
    }

    const words = paragraph.split(/\s+/);
    let line = '';

    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (estimateTextWidth(candidate, fontSize, bold) <= maxWidth) {
        line = candidate;
        continue;
      }

      if (line) lines.push(line);
      if (estimateTextWidth(word, fontSize, bold) <= maxWidth) {
        line = word;
        continue;
      }

      let chunk = '';
      for (const character of word) {
        const next = chunk + character;
        if (estimateTextWidth(next, fontSize, bold) > maxWidth && chunk) {
          lines.push(chunk);
          chunk = character;
        } else {
          chunk = next;
        }
      }
      line = chunk;
    }

    if (line) lines.push(line);
  }

  return lines;
}

class PdfObjectWriter {
  constructor() {
    this.objects = [null];
  }

  add(content = '') {
    this.objects.push(content);
    return this.objects.length - 1;
  }

  set(id, content) {
    this.objects[id] = content;
  }

  build(rootId, infoId) {
    const chunks = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'binary')];
    const offsets = [0];
    let position = chunks[0].length;

    for (let id = 1; id < this.objects.length; id += 1) {
      offsets[id] = position;
      const start = Buffer.from(`${id} 0 obj\n`, 'ascii');
      const content = Buffer.isBuffer(this.objects[id])
        ? this.objects[id]
        : Buffer.from(String(this.objects[id]), 'binary');
      const end = Buffer.from('\nendobj\n', 'ascii');
      chunks.push(start, content, end);
      position += start.length + content.length + end.length;
    }

    const xrefOffset = position;
    let xref = `xref\n0 ${this.objects.length}\n0000000000 65535 f \n`;
    for (let id = 1; id < this.objects.length; id += 1) {
      xref += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
    }
    xref += `trailer\n<< /Size ${this.objects.length} /Root ${rootId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
    chunks.push(Buffer.from(xref, 'ascii'));
    return Buffer.concat(chunks);
  }
}

class ContactPdfReport {
  constructor(payload, reference, submittedAt) {
    this.payload = payload;
    this.reference = reference;
    this.submittedAt = submittedAt;
    this.width = 612;
    this.height = 792;
    this.margin = 46;
    this.contentWidth = this.width - this.margin * 2;
    this.pages = [];
    this.page = null;
    this.y = 0;
    this.colors = {
      ink: [0.055, 0.075, 0.067],
      muted: [0.35, 0.40, 0.37],
      line: [0.84, 0.88, 0.85],
      paper: [0.975, 0.985, 0.978],
      white: [1, 1, 1],
      dark: [0.018, 0.035, 0.031],
      lime: [0.36, 0.93, 0],
      sage: [0.50, 0.65, 0.44],
      mint: [0.80, 1, 0.72]
    };
  }

  command(value) {
    this.page.push(value);
  }

  rect(x, y, width, height, fill, border = null, borderWidth = 0.6) {
    if (fill) this.command(rgb(fill));
    if (border) this.command(`${rgb(border, true)} ${num(borderWidth)} w`);
    this.command(`${num(x)} ${num(y)} ${num(width)} ${num(height)} re ${fill && border ? 'B' : fill ? 'f' : 'S'}`);
  }

  line(x1, y1, x2, y2, color, width = 1) {
    this.command(`${rgb(color, true)} ${num(width)} w ${num(x1)} ${num(y1)} m ${num(x2)} ${num(y2)} l S`);
  }

  text(text, x, y, size, font = 'F1', color = this.colors.ink) {
    this.command(`BT /${font} ${num(size)} Tf ${rgb(color)} 1 0 0 1 ${num(x)} ${num(y)} Tm (${pdfEscape(text)}) Tj ET`);
  }

  newPage() {
    this.page = [];
    this.pages.push(this.page);
    const pageNumber = this.pages.length;

    this.rect(0, 0, this.width, this.height, this.colors.paper);
    this.rect(0, this.height - 105, this.width, 105, this.colors.dark);

    this.line(44, this.height - 62, 202, this.height - 62, this.colors.lime, 4.5);
    this.line(54, this.height - 45, 202, this.height - 62, this.colors.sage, 2.5);
    this.line(82, this.height - 25, 202, this.height - 62, this.colors.mint, 3);
    this.text('SELLERY', 44, this.height - 89, 25, 'F2', this.colors.white);
    this.text('OPPORTUNITY INTAKE', 406, this.height - 51, 8, 'F2', this.colors.mint);
    this.text(this.reference, 406, this.height - 68, 8.5, 'F3', this.colors.white);

    this.line(this.margin, 36, this.width - this.margin, 36, this.colors.line, 0.6);
    this.text('Confidential submission - info@sellerydigital.com', this.margin, 22, 7, 'F1', this.colors.muted);
    this.text(`PAGE ${pageNumber}`, 520, 22, 7, 'F2', this.colors.muted);
    this.y = this.height - 137;
  }

  ensureSpace(height) {
    if (!this.page || this.y - height < 54) this.newPage();
  }

  title() {
    this.ensureSpace(80);
    this.text('Opportunity submission', this.margin, this.y, 24, 'F2', this.colors.ink);
    this.y -= 27;
    this.text(`Received ${this.submittedAt.toISOString()}`, this.margin, this.y, 9, 'F1', this.colors.muted);
    this.y -= 31;
  }

  sectionTitle(title) {
    this.ensureSpace(34);
    this.text(title.toUpperCase(), this.margin, this.y, 8, 'F2', this.colors.sage);
    this.line(this.margin + 112, this.y + 3, this.width - this.margin, this.y + 3, this.colors.line, 0.6);
    this.y -= 23;
  }

  field(label, value, fontSize = 10) {
    const text = value || 'Not provided';
    let lines = wrapText(text, fontSize, this.contentWidth - 24);
    if (!lines.length) lines = ['Not provided'];
    const lineHeight = fontSize * 1.42;
    let firstChunk = true;

    while (lines.length) {
      const minimum = 19 + lineHeight + 12;
      this.ensureSpace(minimum);
      const available = this.y - 54;
      const maxLines = Math.max(1, Math.floor((available - 31) / lineHeight));
      const chunk = lines.splice(0, maxLines);
      const boxHeight = 19 + chunk.length * lineHeight + 10;

      this.rect(this.margin, this.y - boxHeight + 9, this.contentWidth, boxHeight, this.colors.white, this.colors.line, 0.55);
      this.text(`${label}${firstChunk ? '' : ' (continued)'}`.toUpperCase(), this.margin + 12, this.y - 7, 7, 'F2', this.colors.muted);
      let textY = this.y - 23;
      for (const line of chunk) {
        if (line) this.text(line, this.margin + 12, textY, fontSize, 'F1', this.colors.ink);
        textY -= lineHeight;
      }
      this.y -= boxHeight + 7;
      firstChunk = false;
      if (lines.length) this.newPage();
    }
  }

  build() {
    this.newPage();
    this.title();

    this.sectionTitle('Conversation');
    this.field('Opportunity type', this.payload.intent);
    this.field('Essential details', this.payload.message, 10);

    this.sectionTitle('Contact');
    this.field('Name', this.payload.name);
    this.field('Email', this.payload.email);
    if (this.payload.phone) this.field('Phone', this.payload.phone);

    this.sectionTitle('Company');
    this.field('Company', this.payload.company);
    if (this.payload.website) this.field('Website', this.payload.website, 9);
    if (this.payload.companyType) this.field('Company type', this.payload.companyType);
    if (this.payload.revenue) this.field('Annual revenue range', this.payload.revenue);

    this.sectionTitle('Submission record');
    this.field('Reference', this.reference);
    this.field('Source page', this.payload.source || 'Website contact form', 8.5);
    this.field('Consent', this.payload.consent ? 'Confirmed' : 'Not confirmed');

    return this.serialize();
  }

  serialize() {
    const writer = new PdfObjectWriter();
    const catalogId = writer.add();
    const pagesId = writer.add();
    const regularFontId = writer.add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    const boldFontId = writer.add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    const monoFontId = writer.add('<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>');
    const pageIds = [];

    for (const commands of this.pages) {
      const stream = Buffer.from(commands.join('\n'), 'binary');
      const streamObject = Buffer.concat([
        Buffer.from(`<< /Length ${stream.length} >>\nstream\n`, 'ascii'),
        stream,
        Buffer.from('\nendstream', 'ascii')
      ]);
      const contentId = writer.add(streamObject);
      const pageId = writer.add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${this.width} ${this.height}] /Resources << /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R /F3 ${monoFontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
      pageIds.push(pageId);
    }

    writer.set(pagesId, `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`);
    writer.set(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

    const date = this.submittedAt;
    const pdfDate = `D:${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}${String(date.getUTCDate()).padStart(2, '0')}${String(date.getUTCHours()).padStart(2, '0')}${String(date.getUTCMinutes()).padStart(2, '0')}${String(date.getUTCSeconds()).padStart(2, '0')}Z`;
    const infoId = writer.add(`<< /Title (${pdfEscape(`Sellery Opportunity ${this.reference}`)}) /Author (Sellery) /Subject (${pdfEscape(this.payload.intent)}) /Creator (Sellery Website) /CreationDate (${pdfDate}) >>`);
    return writer.build(catalogId, infoId);
  }
}

function generateContactPDF(payload, reference, submittedAt) {
  return new ContactPdfReport(payload, reference, submittedAt).build();
}

function buildEmailHtml(payload, reference, submittedAt) {
  const row = (label, value) => value ? `
    <tr>
      <td style="padding:10px 0;color:#718078;font-size:12px;vertical-align:top;width:165px;border-bottom:1px solid #e7ece8;">${escapeHtml(label)}</td>
      <td style="padding:10px 0;color:#111a15;font-size:14px;line-height:1.55;border-bottom:1px solid #e7ece8;">${escapeHtml(value).replace(/\n/g, '<br>')}</td>
    </tr>` : '';

  return `<!doctype html>
  <html>
    <body style="margin:0;background:#f2f6f3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#111a15;">
      <div style="max-width:720px;margin:0 auto;padding:28px 14px;">
        <div style="background:#06100c;border-radius:22px 22px 0 0;padding:26px 30px;border-bottom:4px solid #61ef00;">
          <div style="color:#d9ffd0;font-size:12px;font-weight:700;letter-spacing:.16em;">SELLERY</div>
          <div style="color:#ffffff;font-size:28px;font-weight:700;margin-top:8px;">New opportunity received</div>
          <div style="color:#9fb1a7;font-size:13px;margin-top:8px;">${escapeHtml(payload.intent)} · ${escapeHtml(reference)}</div>
        </div>
        <div style="background:#ffffff;padding:28px 30px;border:1px solid #dfe7e2;border-top:0;border-radius:0 0 22px 22px;">
          <p style="margin:0 0 22px;color:#53635a;font-size:14px;line-height:1.65;">The website generated a branded PDF record and attached it to this message.</p>
          <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;">
            ${row('Opportunity type', payload.intent)}
            ${row('Name', payload.name)}
            ${row('Email', payload.email)}
            ${row('Phone', payload.phone)}
            ${row('Company', payload.company)}
            ${row('Website', payload.website)}
            ${row('Company type', payload.companyType)}
            ${row('Revenue range', payload.revenue)}
            ${row('Details', payload.message)}
            ${row('Received', submittedAt.toISOString())}
            ${row('Reference', reference)}
          </table>
          <div style="margin-top:24px;padding:16px 18px;background:#f2f8f1;border-left:3px solid #61ef00;border-radius:10px;color:#53635a;font-size:12px;line-height:1.6;">Reply directly to this email to respond to ${escapeHtml(payload.name)} at ${escapeHtml(payload.email)}.</div>
        </div>
      </div>
    </body>
  </html>`;
}

function buildEmailText(payload, reference, submittedAt) {
  return [
    'SELLERY - NEW OPPORTUNITY',
    `Reference: ${reference}`,
    `Received: ${submittedAt.toISOString()}`,
    '',
    `Opportunity: ${payload.intent}`,
    `Name: ${payload.name}`,
    `Email: ${payload.email}`,
    payload.phone ? `Phone: ${payload.phone}` : '',
    payload.company ? `Company: ${payload.company}` : '',
    payload.website ? `Website: ${payload.website}` : '',
    payload.companyType ? `Company type: ${payload.companyType}` : '',
    payload.revenue ? `Revenue range: ${payload.revenue}` : '',
    '',
    'DETAILS',
    payload.message,
    '',
    'A PDF record is attached.'
  ].filter(Boolean).join('\n');
}

async function sendWithResend({ payload, reference, submittedAt, pdf }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_FROM_EMAIL;
  const to = process.env.CONTACT_TO_EMAIL || 'info@sellerydigital.com';
  const bcc = clean(process.env.CONTACT_BCC_EMAIL, 240);

  if (!apiKey || !from) {
    const error = new Error('Email environment variables are not configured.');
    error.code = 'EMAIL_NOT_CONFIGURED';
    throw error;
  }

  const subjectEntity = (payload.company || payload.name).replace(/[\r\n]+/g, ' ');
  const emailPayload = {
    from,
    to: [to],
    reply_to: payload.email,
    subject: `[Sellery] ${payload.intent} - ${subjectEntity}`,
    html: buildEmailHtml(payload, reference, submittedAt),
    text: buildEmailText(payload, reference, submittedAt),
    attachments: [{
      filename: `Sellery-Opportunity-${reference}.pdf`,
      content: pdf.toString('base64')
    }],
    headers: {
      'X-Sellery-Reference': reference,
      'X-Sellery-Intent': payload.intent
    },
    tags: [
      { name: 'source', value: 'website' },
      { name: 'intent', value: payload.intent.toLowerCase().replace(/[^a-z0-9_-]+/g, '_').slice(0, 80) }
    ]
  };
  if (bcc) emailPayload.bcc = [bcc];

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': reference
    },
    body: JSON.stringify(emailPayload)
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.message || result.name || `Email service returned ${response.status}.`);
    error.status = response.status;
    error.details = result;
    throw error;
  }
  return result;
}

async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, message: 'Method not allowed.' });
  }

  let raw = req.body;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return res.status(400).json({ ok: false, message: 'Invalid request body.' });
    }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return res.status(400).json({ ok: false, message: 'Invalid request body.' });
  }

  const { payload, errors } = validatePayload(raw);

  // Quietly absorb obvious bot submissions.
  if (payload.honeypot) {
    return res.status(200).json({ ok: true, reference: makeReference() });
  }

  if (payload.startedAt && Date.now() - payload.startedAt < 1400) {
    return res.status(400).json({ ok: false, message: 'Please review the form before submitting.' });
  }

  if (errors.length) {
    return res.status(422).json({ ok: false, message: errors[0], errors });
  }

  const ip = getClientIp(req);
  const rate = checkRateLimit(ip);
  res.setHeader('X-RateLimit-Limit', String(RATE_MAX));
  res.setHeader('X-RateLimit-Remaining', String(rate.remaining));
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(rate.retryAfter));
    return res.status(429).json({ ok: false, message: 'Too many submissions. Please try again later or email info@sellerydigital.com.' });
  }

  const submittedAt = new Date();
  const reference = makeReference();

  try {
    const pdf = generateContactPDF(payload, reference, submittedAt);
    await sendWithResend({ payload, reference, submittedAt, pdf });
    return res.status(200).json({ ok: true, reference });
  } catch (error) {
    console.error('Sellery contact endpoint failed:', {
      message: error?.message,
      code: error?.code,
      status: error?.status,
      details: error?.details
    });
    if (error?.code === 'EMAIL_NOT_CONFIGURED') {
      return res.status(503).json({ ok: false, message: 'The contact channel is being configured. Please email info@sellerydigital.com.' });
    }
    return res.status(500).json({ ok: false, message: 'The transmission could not be completed. Please email info@sellerydigital.com.' });
  }
}

module.exports = handler;
module.exports.generateContactPDF = generateContactPDF;
module.exports.validatePayload = validatePayload;
module.exports.ContactPdfReport = ContactPdfReport;
