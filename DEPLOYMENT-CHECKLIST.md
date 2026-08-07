# Sellery Launch Checklist

## GitHub

- [ ] Create the repository.
- [ ] Upload every file and folder from this package to the repository root.
- [ ] Confirm `.env` files and private API keys are not committed.
- [ ] Run `npm test` before the first push.
- [ ] Confirm the GitHub Actions validation workflow passes.

## Resend

- [ ] Add `sellerydigital.com` as a sending domain.
- [ ] Publish the DNS records supplied by Resend.
- [ ] Wait until the domain shows as verified.
- [ ] Create an API key dedicated to this website.
- [ ] Use a sender such as `website@sellerydigital.com`.

## Vercel

- [ ] Import the GitHub repository.
- [ ] Use framework preset **Other**.
- [ ] Leave build command and output directory blank.
- [ ] Add `RESEND_API_KEY`.
- [ ] Add `CONTACT_FROM_EMAIL`.
- [ ] Add `CONTACT_TO_EMAIL=info@sellerydigital.com`.
- [ ] Redeploy after saving environment variables.
- [ ] Add `sellerydigital.com` and `www.sellerydigital.com`.

## Functional review

- [ ] Open every navigation link.
- [ ] Test the desktop and mobile menus.
- [ ] Switch between dark and light themes.
- [ ] Test all four Platform tabs.
- [ ] Open and close every portfolio system brief.
- [ ] Test the illustrative dashboard and product-interface controls.
- [ ] Click each acquisition, consulting, product, and partnership CTA.
- [ ] Confirm each CTA preselects the correct contact intent.
- [ ] Submit a real form inquiry.
- [ ] Confirm the success reference appears.
- [ ] Confirm the email arrives at `info@sellerydigital.com`.
- [ ] Open the PDF attachment and inspect every page.
- [ ] Reply to the email and confirm the visitor is the reply-to recipient.

## Visual and accessibility review

- [ ] Desktop Chrome
- [ ] Desktop Safari
- [ ] iPhone Safari
- [ ] Android Chrome
- [ ] Large desktop display
- [ ] Dark theme
- [ ] Light theme
- [ ] Reduced-motion mode
- [ ] Keyboard-only navigation
- [ ] Browser zoom at 125% and 200%
- [ ] No horizontal overflow at common mobile widths

## Final content review

- [ ] Confirm every public portfolio statement is approved.
- [ ] Confirm Malach naming and product positioning are final.
- [ ] Confirm acquisition criteria and consulting language are accurate.
- [ ] Review the Privacy Policy and Terms with legal counsel.
- [ ] Add analytics or consent tooling only when required.
- [ ] Confirm the social preview uses `assets/og-image.jpg`.
- [ ] Confirm the footer displays the current year automatically.
