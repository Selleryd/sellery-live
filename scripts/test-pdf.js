'use strict';

const fs = require('fs');
const path = require('path');
const { generateContactPDF } = require('../api/contact');

const submittedAt = new Date('2026-08-06T20:30:00.000Z');
const payload = {
  intent: 'Sell my business',
  name: 'Jordan Founder',
  email: 'jordan@example.com',
  phone: '+1 555 010 2026',
  company: 'Constellation Commerce, Inc.',
  website: 'https://example.com',
  companyType: 'Ecommerce / Brand',
  revenue: '$2M–$10M',
  message: 'We have built a profitable ecommerce company with a loyal customer base, differentiated products, and meaningful room for operational improvement. We are exploring a thoughtful transition to a long-term owner that can preserve the brand while strengthening technology, customer acquisition, data visibility, and execution.\n\nThe company has been operating for several years, has repeat customers, and would benefit from a more sophisticated operating system. We are looking for a confidential, direct conversation with an operator rather than a generic broker process.',
  consent: true,
  source: 'https://sellerydigital.com/#contact'
};

const outputDir = path.join(__dirname, '..', 'test-output');
fs.mkdirSync(outputDir, { recursive: true });
const outputPath = path.join(outputDir, 'Sellery-Sample-Contact.pdf');
const pdf = generateContactPDF(payload, 'SEL-20260806-A1B2C3', submittedAt);
fs.writeFileSync(outputPath, pdf);
console.log(`Wrote ${outputPath} (${pdf.length.toLocaleString()} bytes)`);
