# Myriad Green v3

## 1. Project Overview
Myriad Green provides smart irrigation, leak detection, drain unblocking, and backup water systems for premium properties across Gauteng. This repository hosts their static marketing site built with modular HTML, layered CSS, and vanilla JavaScript. Shared UI such as the navigation, footer, and booking modal are maintained as partials that are injected at runtime, while the design system relies on theme tokens defined in CSS.

## 2. Tech Stack
- **HTML5** for the landing page (`index.html`) and service detail pages under `/services`.
- **CSS3** with a token system (`assets/css/theme.css`) plus layout, component, navigation/footer, and service-specific layers.
- **Vanilla JavaScript** for all interactivity:
   - `assets/js/site-init.js` bootstraps the UI, loads partials, wires the nav, smooth scroll, contact form, and theme toggle.
   - `assets/js/booking.js` controls the booking modal and service selection workflows.
- **Firebase Cloud Functions (Node 20 + Nodemailer)** handle `/api/contact` requests, sending form submissions via Gmail SMTP using environment-stored credentials.
- **Git Workflow** with `main` (stable) and `dev` (active development) branches.

## 3. Project Structure
- `index.html` – primary landing page that references all shared assets.
- `assets/css/`
   - `theme.css` – design tokens (colors, typography, spacing, radii, shadows).
   - `layout.css` – grid helpers, containers, responsive spacing rules.
   - `components.css` – cards, buttons, forms, testimonials, etc.
   - `nav-footer.css` – header/footer styles.
   - `services.css` – service-specific layouts and callouts.
- `assets/js/`
   - `site-init.js` – detects the base path, fetches partials, and initializes global behaviours.
   - `booking.js` – booking modal state, service selection buttons (`data-book-service`).
- `partials/`
   - `nav.html`, `footer.html`, `booking-modal.html` – injected into placeholders such as `#nav-placeholder` using the helper `loadPartial()` from `site-init.js`.
- `services/` – standalone pages (`irrigation.html`, `leak-detection.html`, `drain-unblocking.html`, `backup-water.html`).
- `MYRIAD_GREEN_V3_HOUSEKEEPING.md` – internal content rules and conventions.
- `.github/ISSUE_TEMPLATE/` – project issue templates.

The partial loader uses a `baseUrl` derived from the location of `site-init.js`, allowing the same script to resolve paths correctly even when pages are nested deeper (e.g., `/services/irrigation.html`).

## 4. Development Workflow
1. Clone the repo: `git clone https://github.com/jacquesmit/myriad-green-v3.git && cd myriad-green-v3`.
2. Checkout the active branch: `git checkout dev`.
3. Make your changes, then stage/commit/push:
    ```bash
    git add .
    git commit -m "Describe your change"
    git push
    ```
4. Open a pull request from `dev` (or a feature branch branched off `dev`) into `main` when the work is production-ready.
5. `main` should only contain stable, deployable releases.

## 5. Running & Previewing Locally
This is a static site. Any simple HTTP server works:
- VS Code Live Server extension.
- `npx serve .`
- `python -m http.server`

> Important: partials are fetched via `fetch()` in `site-init.js`, so you must use `http://localhost` and cannot rely on `file://` URLs.

If you want to exercise the contact form against the backend locally, run the Firebase emulator or deploy the function first:
- `cd functions && npm install`
- `firebase emulators:start --only functions,hosting` (requires a configured Firebase project and CLI login)
- Otherwise, deploy the function (`firebase deploy --only functions,hosting`) and test against the hosted site.

## 6. Contact Form Backend
- `/api/contact` is routed (via `firebase.json` rewrites) to the Cloud Function `sendContactEmail`.
- `functions/index.js` validates the POST body, boots Nodemailer with Gmail SMTP credentials, and sends formatted emails to the configured recipient.
- Secrets are stored as Firebase environment variables (preferred command: `firebase functions:secrets:set GMAIL_USER="name@example.com"`, plus `GMAIL_PASS` for the app password and optional `GMAIL_TO`).
- Local testing requires the Firebase emulator or deployed functions; otherwise the fetch will return a 404.
- Frontend requests are made through `assets/js/email-handler.js`, which exports `sendContactEmail(payload)` for `site-init.js` to call after form validation.

## 7. Theming & Design Tokens
`assets/css/theme.css` defines CSS variables for brand colors, typography scales, spacing steps, radii, and shadows. All new components should consume these tokens (e.g., `var(--color-primary)`, `var(--space-lg)`) instead of hard-coded values to keep the experience consistent across the site and future themes.

## 8. Accessibility & SEO
- `main` content is wrapped in `<main id="main-content">` to support skip links.
- Navigation and theme toggle include ARIA attributes for state (`aria-expanded`, `aria-pressed`).
- `index.html` ships with comprehensive Open Graph and Twitter card metadata plus `LocalBusiness` JSON-LD structured data.
- Images rely on descriptive `alt` text and `<picture>` elements for responsive delivery.

## 9. TODO / Roadmap
- Configure real Firebase project ID in `.firebaserc`, set Gmail secrets via `firebase functions:config:set`, and deploy `sendContactEmail`.
- Wire booking modal submissions to a backend (CRM, calendar, or Firebase Function) and add analytics tracking.
- Add a blog or API-driven insights section to replace the "Coming Soon" cards.
- Run a Lighthouse/performance pass and tune asset loading.
- Set up automated deployments (GitHub Actions → Firebase Hosting or preferred provider).
- Document an end-to-end content update process in `MYRIAD_GREEN_V3_HOUSEKEEPING.md`.
