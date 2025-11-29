# Myriad Green v3 – Architecture Notes

## 1. High-Level Architecture
- `index.html` is the landing page and source of truth for metadata, hero content, and shared sections. `/services/*.html` reuse the same asset pipeline while focusing on a specific offering (irrigation, leak detection, drain unblocking, backup water).
- Shared UI lives under `partials/` and is injected into placeholders (`#nav-placeholder`, `#footer-placeholder`, `#booking-modal-root`) on every page. Injection happens inside `assets/js/site-init.js`.
- `site-init.js` derives `baseUrl` by inspecting the path of the currently executing script. That base path is combined with relative partial URLs so nested pages (e.g., `/services/irrigation.html`) can still fetch `partials/nav.html`.
- The helper `loadPartial(selector, path, label)` fetches each partial, checks `response.ok`, injects the fetched HTML into the placeholder, and logs an error plus inserts a fallback comment if loading fails.
- `booking-modal.html` markup is injected once and then activated through `window.BookingModal.init()` so the modal can be triggered from any page via `data-book-service` buttons.

## 2. JavaScript Responsibilities
- **`assets/js/site-init.js`**
  - Loads navigation, footer, and booking modal partials via `loadPartial()`.
  - Initializes mobile navigation toggles, dropdown menus, and theme switching (persisted in `localStorage` under `myriad-theme`).
  - Applies smooth scrolling for links marked with `data-scroll-target`.
  - Handles contact form validation, displays inline status messages, and posts validated payloads to `/api/contact` via `sendContactEmail()`.
  - Applies the stored theme on page load and keeps ARIA attributes in sync (e.g., `aria-expanded`, `aria-pressed`).
- **`assets/js/booking.js`**
  - Encapsulates the booking modal UI, including open/close mechanics, service selection, and data prefilling when a `data-book-service` button is clicked.
  - Exposes `window.BookingModal.init()` so `site-init.js` can bootstrap it after the modal partial is injected.
- **`assets/js/email-handler.js`**
  - Wraps the `fetch('/api/contact')` call used by the contact form.
  - Throws descriptive errors when the Firebase emulator/hosted function responds with a failure or when the endpoint is unreachable.

## 3. CSS Responsibilities
- **`theme.css`** – Defines the global token set: color palette, font stacks, type scale, spacing system, radii, and shadow presets. All other styles reference these CSS variables.
- **`layout.css`** – Manages global layout primitives such as containers, grids, responsive columns, and utility spacing patterns.
- **`components.css`** – Contains reusable UI elements: cards, badges, CTA buttons, forms, testimonial blocks, and step lists.
- **`nav-footer.css`** – Dedicated styling for the header/navigation, dropdown menu, mobile drawer, footer, and theme-toggle button.
- **`services.css`** – Enhancements for the individual service pages, including hero banners, icon rows, and scoped typography adjustments.

## 4. Partial Files
- **`partials/nav.html`** – Global navigation with logo, desktop links, mobile hamburger toggle, theme toggle button, and optional dropdown for grouped links.
- **`partials/footer.html`** – Footer content with contact information, service highlights, and a `#footer-year` span that `site-init.js` auto-updates.
- **`partials/booking-modal.html`** – Hidden modal markup used by `booking.js`. Any element with `data-book-service` triggers this modal and optionally passes a service name.

## 5. Branching & Environments
- `main` – Stable, production-ready branch that mirrors the live site.
- `dev` – Active development branch. Feature branches should branch off `dev`, then merge back via pull requests.
- Recommended flow: feature branch → PR into `dev` → QA/staging → PR into `main` for deployment.

## 6. Extension Points
- **Contact Form Backend** – Customize `functions/index.js` (e.g., add CRM/webhook fan-out, spam filtering, or Firestore logging) while keeping the `/api/contact` interface stable for the frontend.
- **Payments / Booking Upgrades** – `booking.js` can integrate Stripe or other payment APIs after the modal captures service details.
- **Content Automation** – Introduce a blog or auto-generated area pages by feeding new HTML into `/services` or generating JSON that `site-init.js` can render.
- **Partial Resolution** – If deeper folder levels are introduced (e.g., `/services-pages/`, `/blog/posts/`), update the base path logic in `site-init.js` so it trims any new directory structure before resolving `partials/*.html`.
