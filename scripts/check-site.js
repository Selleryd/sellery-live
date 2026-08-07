'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const htmlFiles = ['index.html', 'privacy.html', 'terms.html', '404.html'];
const errors = [];

for (const filename of htmlFiles) {
  const filePath = path.join(root, filename);
  if (!fs.existsSync(filePath)) {
    errors.push(`Missing ${filename}`);
    continue;
  }

  const html = fs.readFileSync(filePath, 'utf8');
  if (/href=["']#["']/.test(html)) errors.push(`${filename}: contains a dead href="#" link`);
  if (/\b(?:TODO|FIXME)\b|lorem\s+ipsum/i.test(html)) errors.push(`${filename}: contains unfinished copy`);

  const ids = new Set([...html.matchAll(/\sid=["']([^"']+)["']/g)].map((match) => match[1]));
  for (const match of html.matchAll(/href=["']#([^"']+)["']/g)) {
    if (!ids.has(match[1])) errors.push(`${filename}: missing anchor target #${match[1]}`);
  }

  for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
    const ref = match[1];
    if (/^(?:https?:|mailto:|tel:|#|data:)/.test(ref)) continue;
    const cleanRef = ref.split(/[?#]/)[0];
    if (!cleanRef || cleanRef.startsWith('/')) continue;
    const referencedPath = path.resolve(root, cleanRef);
    if (!fs.existsSync(referencedPath)) errors.push(`${filename}: missing referenced file ${cleanRef}`);
  }
}

const requiredFiles = [
  'styles.css', 'app.js', 'api/contact.js', 'vercel.json', '.env.example',
  'assets/sellery-logo-on-dark.png', 'assets/sellery-logo-on-light.png',
  'assets/og-image.jpg', 'assets/favicon.svg', 'site.webmanifest', 'robots.txt', 'sitemap.xml'
];
for (const filename of requiredFiles) {
  if (!fs.existsSync(path.join(root, filename))) errors.push(`Missing ${filename}`);
}

if (errors.length) {
  console.error(`Site check failed with ${errors.length} issue(s):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Site check passed: local links, anchor targets, and required files are present.');
