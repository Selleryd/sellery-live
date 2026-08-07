'use strict';

const assert = require('assert');
const handler = require('../api/contact');

function mockResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
    end() { return this; }
  };
}

async function invoke(method, body, ip = '203.0.113.10') {
  const req = {
    method,
    body,
    headers: { 'x-forwarded-for': ip },
    socket: { remoteAddress: ip }
  };
  const res = mockResponse();
  await handler(req, res);
  return res;
}

(async () => {
  const getResponse = await invoke('GET');
  assert.strictEqual(getResponse.statusCode, 405);
  assert.strictEqual(getResponse.body.ok, false);

  const invalidResponse = await invoke('POST', {
    intent: '', name: '', email: 'invalid', message: 'too short', consent: false,
    startedAt: Date.now() - 5000
  }, '203.0.113.11');
  assert.strictEqual(invalidResponse.statusCode, 422);
  assert.ok(Array.isArray(invalidResponse.body.errors));

  process.env.RESEND_API_KEY = 're_test_key';
  process.env.CONTACT_FROM_EMAIL = 'Sellery Website <website@sellerydigital.com>';
  process.env.CONTACT_TO_EMAIL = 'info@sellerydigital.com';

  const originalFetch = global.fetch;
  let capturedRequest;
  global.fetch = async (url, options) => {
    capturedRequest = { url, options, payload: JSON.parse(options.body) };
    return {
      ok: true,
      status: 200,
      async json() { return { id: 'email_test_123' }; }
    };
  };

  try {
    const validResponse = await invoke('POST', {
      intent: 'Sell my business',
      name: 'Jordan Founder',
      email: 'Jordan@example.com',
      phone: '+1 555 010 2026',
      company: 'Constellation Commerce, Inc.',
      website: 'https://example.com',
      companyType: 'Ecommerce / Brand',
      revenue: '$2M-$10M',
      message: 'We have built a profitable ecommerce company and would like a confidential conversation about a thoughtful transition.',
      consent: true,
      startedAt: Date.now() - 5000,
      source: 'https://sellerydigital.com/#contact',
      userAgent: 'Sellery automated test'
    }, '203.0.113.12');

    assert.strictEqual(validResponse.statusCode, 200);
    assert.strictEqual(validResponse.body.ok, true);
    assert.match(validResponse.body.reference, /^SEL-\d{8}-[A-F0-9]{6}$/);
    assert.strictEqual(capturedRequest.url, 'https://api.resend.com/emails');
    assert.strictEqual(capturedRequest.payload.to[0], 'info@sellerydigital.com');
    assert.strictEqual(capturedRequest.payload.reply_to, 'jordan@example.com');
    assert.strictEqual(capturedRequest.payload.attachments.length, 1);
    const pdf = Buffer.from(capturedRequest.payload.attachments[0].content, 'base64');
    assert.strictEqual(pdf.subarray(0, 5).toString('ascii'), '%PDF-');
    assert.strictEqual(capturedRequest.options.headers['Idempotency-Key'], validResponse.body.reference);
  } finally {
    global.fetch = originalFetch;
  }

  console.log('API test passed: validation, PDF attachment, recipient, reply-to, and idempotency behavior are correct.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
