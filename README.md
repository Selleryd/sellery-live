# Sellery Website — Luxury Software Edition

A production-ready corporate website for Sellery: the operator-led parent company behind software, AI, technology, ecommerce businesses, acquisitions, and advisory work.

The interface has been rebuilt as a sophisticated software product rather than a conventional holding-company site. It combines restrained luxury typography, precise spacing, data-rich product interfaces, motion, and a coherent operating-system narrative.

The frontend is framework-free and dependency-free. The contact endpoint is also dependency-free and runs as a Vercel serverless function. Every valid submission is converted into a branded PDF and emailed to `info@sellerydigital.com` through Resend.

## Design and experience

- Responsive dark and light themes using the supplied Sellery logos
- Refined typography built around Inter Tight, Manrope, and IBM Plex Mono, with robust system-font fallbacks
- Animated starfield, ambient illumination, global network canvas, depth effects, scroll reveals, and restrained micro-interactions
- A cinematic hero built around the Sellery Control Plane
- Interactive operating-layer product interface with Intelligence, Automation, Commerce, and Capital views
- Flagship Malach product presentation using the supplied Malach identity
- Software-style portfolio cards, operating-system diagrams, acquisition criteria, service architecture, and global-footprint visualization
- Desktop, tablet, and mobile navigation with keyboard support
- Reduced-motion support and visible focus states
- No frontend framework and no client-side package dependencies

## Functional systems

- Working anchor navigation and mobile menu
- Persistent dark/light theme control
- Interactive platform tabs with keyboard navigation
- Portfolio system briefs in accessible dialogs
- Illustrative interface controls that return visible system feedback
- Acquisition, consulting, partnership, and product CTAs that preselect the correct contact path
- Contact form validation, loading, error, and success states
- Automatic copyright year: `© [current year] Sellery Brands`
- Privacy Policy, Terms of Use, 404 page, sitemap, robots file, manifest, favicons, and social-sharing image
- GitHub Actions validation on every push and pull request

## Repository structure

```text
sellery-website/
├── index.html
├── styles.css
├── app.js
├── privacy.html
├── terms.html
├── 404.html
├── api/
│   └── contact.js
├── assets/
│   ├── sellery-logo-on-dark.png
│   ├── sellery-logo-on-light.png
│   ├── sellery-logo-on-dark.webp
│   ├── sellery-logo-on-light.webp
│   ├── malach-logo.webp
│   ├── malach-mark.webp
│   ├── og-image.jpg
│   ├── favicon.svg
│   └── ...
├── scripts/
│   ├── check-site.js
│   ├── test-pdf.js
│   └── test-api.js
├── .github/workflows/validate.yml
├── .env.example
├── vercel.json
├── site.webmanifest
├── robots.txt
├── sitemap.xml
└── package.json
```

## Recommended deployment: GitHub + Vercel

### 1. Create the GitHub repository

1. Create a repository such as `sellery-website`.
2. Upload the contents of this folder to the repository root.
3. Commit and push.

There is no frontend build step.

### 2. Import the repository into Vercel

1. Sign in to Vercel.
2. Choose **Add New → Project**.
3. Import the GitHub repository.
4. Use framework preset **Other**.
5. Leave the build command and output directory blank.

Vercel serves the static site and exposes `api/contact.js` at `/api/contact`.

### 3. Configure PDF email delivery

Create a Resend account, add and verify `sellerydigital.com`, and create an API key. Add these environment variables to the Vercel project:

```dotenv
RESEND_API_KEY=re_your_private_key
CONTACT_FROM_EMAIL=Sellery Website <website@sellerydigital.com>
CONTACT_TO_EMAIL=info@sellerydigital.com
```

Optional:

```dotenv
CONTACT_BCC_EMAIL=operations@sellerydigital.com
```

`CONTACT_FROM_EMAIL` must use an address on the domain verified in Resend. Never put the API key in `app.js`, `index.html`, GitHub, or any browser-visible file.

Redeploy after saving the variables, then submit one real test inquiry.

### 4. Connect the production domain

In Vercel, open **Project Settings → Domains**, add `sellerydigital.com`, and follow the DNS instructions. Add `www.sellerydigital.com` as well and configure the preferred redirect.

## GitHub Pages limitation

GitHub Pages can host the visual frontend, but it cannot execute `api/contact.js`. The automatic PDF and email workflow requires a serverless runtime such as Vercel. The recommended setup is GitHub for source control and Vercel for deployment.

## Local preview

From the repository folder:

```bash
npm run preview
```

Open:

```text
http://localhost:4173
```

The visual site works locally. A plain static preview does not execute the Vercel contact function.

## Validation

Check local files, anchor targets, and required assets:

```bash
npm run check
```

Generate a sample branded contact PDF:

```bash
npm run test:pdf
```

Test validation, PDF creation, attachment routing, recipient, reply-to, and idempotency behavior without sending live email:

```bash
npm run test:api
```

Run the complete validation suite:

```bash
npm test
```

The PDF test writes:

```text
test-output/Sellery-Sample-Contact.pdf
```

## Contact workflow

1. The browser validates required fields and consent.
2. The form posts JSON to `/api/contact`.
3. The server validates the submission and applies anti-spam controls.
4. The server creates a branded multi-page PDF without an external PDF package.
5. Resend emails the form details and PDF to `info@sellerydigital.com`.
6. The sender is configured as the reply-to address.
7. The visitor sees a unique Sellery reference number.

## Security and resilience

- The Resend API key remains server-side.
- The endpoint validates inquiry type, email, URLs, lengths, consent, and request timing.
- A hidden honeypot absorbs obvious bot submissions.
- Basic rate limiting reduces repeated submissions.
- Resend idempotency protection helps prevent duplicate delivery.
- Security headers are configured in `vercel.json`.
- Static assets receive long-lived immutable caching.
- The form does not accept arbitrary file uploads.

For high-volume production traffic, add durable distributed rate limiting and managed bot protection.

## Primary editing locations

- Website copy and section structure: `index.html`
- Visual system and responsive behavior: `styles.css`
- Interactions and portfolio dialog data: `app.js`
- PDF, validation, recipient, and email logic: `api/contact.js`
- Search and social metadata: `<head>` in `index.html`
- Domain references: `index.html`, legal pages, `robots.txt`, and `sitemap.xml`

## Annual copyright behavior

Any element using:

```html
<span data-current-year></span>
```

is populated by `app.js` from the visitor's current calendar year. It updates automatically every January 1 without a manual edit.
