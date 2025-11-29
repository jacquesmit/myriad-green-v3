# MYRIAD GREEN V3 – Housekeeping, Procedures & Implementation Guide

## 📌 Purpose of This Document
This document defines the rules, standards, procedures, checklists, and prompts required to build, maintain, and upgrade **Myriad Green V3** to a fully production-ready state.

Use this as the master reference for all improvement tasks.

---

# 1. Codebase Housekeeping Rules

## 1.1 Folder & File Standards
- `/partials/` = all injected HTML components (nav, footer, booking modal, etc.)
- `/assets/css/` = theme, layout, components, navigation, services
- `/assets/js/` = initialization scripts, booking logic, helpers
- `/services/` = irrigation, leak detection, drain unblocking, backup water
- `/assets/images/` = use SEO-friendly filenames, all lowercase, hyphens

**Image filename style examples:**
- `myriadgreen-irrigation-hero-gauteng.webp`
- `myriadgreen-leak-detection-technician.webp`
- `myriadgreen-backup-water-tank-install.webp`

## 1.2 HTML Rules
- Exactly **one `<h1>` per page**.
- Use semantic structure: `<header>`, `<main>`, `<section>`, `<footer>`.
- Avoid inline styles.
- Keep structure consistent across all service pages.
- All images should use `<picture>` with WebP-first and lazy loading (`loading="lazy"`, `decoding="async"`).

## 1.3 CSS Rules
- All **design tokens** (colors, typography, spacing, radii, shadows, transitions) live in `theme.css`.
- Layout CSS:
  - responsive grid utilities
  - `.container` and section spacing
  - avoid fixed pixel layouts where possible
- Components CSS:
  - buttons
  - cards
  - forms
  - modals
  - badges/tags
- Navigation and footer styling should live in a dedicated nav/footer CSS file only (e.g. `nav-footer.css`).

## 1.4 JavaScript Rules
- No inline JS in HTML.
- `site-init.js` is responsible for:
  - partial injection (nav, footer, booking modal)
  - theme toggle
  - mobile navigation behaviors
  - smooth scroll helpers (if used)
- `booking.js` is responsible for:
  - opening/closing the booking modal
  - pre-selecting service type based on data attributes
  - basic frontend validation and success/error messaging
- Add comments at all integration points (where backend, Firebase, payment, or calendar APIs will plug in).

---

# 2. Accessibility Requirements

- A **“Skip to main content”** link must be available and visible on focus.
- `<main>` must have `id="main-content"` on all pages.
- The booking modal must:
  - trap focus while open
  - close on ESC key
  - restore focus to the previously focused element on close
- All interactive elements (buttons, toggles) should have clear labels and `aria-*` attributes where appropriate.

---

# 3. SEO Requirements

## 3.1 Meta Tags
Each page must have:
- A unique `<title>`
- A `<meta name="description">` matching the page’s intent
- (Later) A canonical URL once the production domain is final
- On the home page, Open Graph and Twitter meta tags will be added (see Upgrade Roadmap Step 3).

## 3.2 Structured Data
- Use JSON-LD for:
  - `LocalBusiness` on the home page
  - `Service` / `Offer` where appropriate
  - `FAQPage` on service pages, once FAQs are finalized

---

# 4. Performance Standards

- Use **WebP-first images** with `<picture>` and appropriate fallbacks.
- Load fonts via `<link>` in the `<head>`, not via `@import` in CSS.
- Lazy-load images (`loading="lazy"`) and use `decoding="async"`.
- Defer all JS (`<script src="..." defer>`).
- Navigation and footer are injected via JS to keep HTML DRY and modular.

---

# 5. Audit Summary (Current Baseline)

## 5.1 Strengths
- Good semantic HTML structure.
- Modular partials for nav, footer, booking modal.
- Clean design system using CSS variables (colors, spacing, typography).
- Mobile-first layout and responsive grids.
- Working booking modal with basic validation and UX.
- Consistent service page structure:
  - hero
  - overview
  - benefits
  - workflow
  - pricing guidance
  - FAQs
  - final CTA
- Light & dark mode support via `[data-theme="dark"]`.
- Real-world copy tailored to Gauteng / estate homeowners (not lorem ipsum).

## 5.2 Weaknesses / Gaps
- Missing hero and service images using proper `<picture>` blocks.
- No skip link or full focus trap for the booking modal.
- Missing Open Graph tags and JSON-LD structured data.
- Google Fonts are loaded using `@import` in CSS (suboptimal).
- Partial loading JS lacks robust error handling or user-friendly fallback messaging.

---

# 6. Upgrade Roadmap (Step-by-Step)

The following steps represent the housekeeping and improvement plan.  
Each step can be run through Copilot or another assistant using a dedicated prompt.

## 🔹 Step 1 – Add Hero & Service Images with `<picture>`

**Goal:**  
Add production-ready hero images using `<picture>` with WebP + fallback to:

- `index.html` (main hero)
- `/services/irrigation.html`
- `/services/leak-detection.html`
- `/services/drain-unblocking.html`
- `/services/backup-water.html`

**Key requirements:**
- SEO-friendly filenames (e.g. `myriadgreen-irrigation-hero-gauteng.webp`).
- Real, descriptive alt text.
- `loading="lazy"` and `decoding="async"`.
- Responsive CSS that works on mobile and desktop.

**Reference:** Use a prompt like “Myriad Green – Step 1 hero `<picture>` implementation” when asking Copilot to help.

---

## 🔹 Step 2 – Accessibility Polish (Skip Link + Modal Behavior)

**Goal:**  
Improve keyboard and screen reader experience.

**Key tasks:**
- Add a skip link (`"Skip to main content"`) at the top of `<body>`.
- Ensure `<main>` has `id="main-content"` on all pages.
- Upgrade booking modal to:
  - trap focus inside while open
  - close on ESC
  - restore previously focused element

**Reference:** Use a prompt like “Myriad Green – Step 2 accessibility (skip link + modal focus trap)” for Copilot.

---

## 🔹 Step 3 – SEO Enhancements (OG Tags + JSON-LD)

**Goal:**  
Improve SEO and social preview for the main landing page.

**Key tasks on `index.html`:**
- Add Open Graph tags:
  - `og:title`
  - `og:description`
  - `og:type`
  - `og:url`
  - `og:image`
- Add Twitter Card tags:
  - `twitter:card`
  - `twitter:title`
  - `twitter:description`
  - `twitter:image`
- Add a `LocalBusiness` JSON-LD block with:
  - `name`, `url`, `description`
  - `address` (country = ZA, region = Gauteng)
  - `areaServed`: Gauteng cities/areas
  - `serviceType`: list of main services

**Reference:** Use a prompt like “Myriad Green – Step 3 SEO (OG + JSON-LD)” for Copilot.

---

## 🔹 Step 4 – Font Loading Optimization

**Goal:**  
Improve performance and follow best practice for Google Fonts.

**Key tasks:**
- Remove `@import` of fonts from CSS files.
- In each HTML `<head>` (index + services), load fonts via:
  - `<link rel="preconnect" ...>`
  - `<link rel="stylesheet" ...>` using the Google Fonts URL.
- Keep font-family declarations in `theme.css` using variables; do not change the design system.

**Reference:** Use a prompt like “Myriad Green – Step 4 font loading optimization” when working with Copilot.

---

## 🔹 Step 5 – JS Robustness & Error Handling for Partials

**Goal:**  
Make partial injection more robust and debuggable.

**Key tasks in `site-init.js`:**
- Wrap `fetch` calls for partials with proper error handling.
- If a partial fails to load:
  - log a clear error message to the console (which partial, which path).
  - optionally insert a small, unobtrusive fallback message in the DOM.
- Add short comments explaining how to adapt base paths if the site is hosted under a subdirectory.

**Reference:** Use a prompt like “Myriad Green – Step 5 JS robustness for partials” when editing this logic.

---

# 7. Developer Checklist

Use this checklist to track housekeeping and improvements.

| Task | Status |
|------|--------|
| Add hero `<picture>` images to index | ⬜ |
| Add `<picture>` hero images to all service pages | ⬜ |
| Add skip link and `id="main-content"` to all pages | ⬜ |
| Implement focus trap + ESC close for booking modal | ⬜ |
| Confirm booking modal restores focus correctly | ⬜ |
| Add Open Graph + Twitter tags to index | ⬜ |
| Add LocalBusiness JSON-LD to index | ⬜ |
| Fix Google Fonts loading (no `@import`) | ⬜ |
| Add basic error handling for partial loading | ⬜ |
| Add fallback messaging for partial failures | ⬜ |
| Re-test mobile responsiveness after changes | ⬜ |
| Run a final accessibility/SEO/performance pass | ⬜ |

---

# 8. Future Roadmap (Post V3)

These items are **outside** the core housekeeping, but should be noted for future phases.

## 8.1 Integrations (Phase 1)
- Firestore or backend to persist bookings.
- Email sending (Gmail API / SMTP / transactional provider).
- Google Calendar integration via OAuth.
- Basic CRM pipeline.

## 8.2 Automation & Marketing (Phase 2+)
- Webhooks for payments (when a gateway is integrated).
- Integration with Google Ads landing experiments.
- Automation of blog content via an external generator (if desired).
- Scripted generation of suburb-specific service pages.

---

# 9. Versioning

Use a simple semantic-like versioning for the site:

- **V3.0.0** – Current baseline (initial static site from generator/Copilot).
- **V3.1.0** – Images and accessibility improvements (Steps 1–2).
- **V3.2.0** – SEO enhancements and structured data (Step 3).
- **V3.3.0** – JS robustness and error handling (Step 5).
- **V3.4.0** – Future integrations (Firebase/Calendar/CRM).

Update this section when major milestones are completed.

---

# 10. Maintenance Notes

- This document should be updated every time:
  - A new housekeeping rule is added.
  - An audit finds a recurring issue.
  - A new integration or major feature is added.
- Treat this file as the **engineering hub** for Myriad Green V3:
  - What exists now
  - What needs doing
  - How to do it
  - How to track progress
