# Myriad Green V3

A production-ready marketing site for Myriad Green, a Gauteng-based water systems specialist delivering irrigation, leak detection, drain jetting, and backup water services to premium estates and homeowners. The project uses semantic HTML, modular CSS, and lightweight vanilla JavaScript with partial injection to keep shared UI components consistent across pages.

## Technology Stack
- **HTML5** – semantic pages with reusable partials for navigation, footer, and booking modal.
- **CSS3** – layered styles split into design tokens, layout utilities, components, navigation/footer, and service-specific rules.
- **Vanilla JavaScript** – `site-init.js` handles partial injection, theme toggling, and contact form helpers; `booking.js` powers the booking modal UX.
- **Light/Dark Theme** – managed via CSS variables and `[data-theme="dark"]`.

## Running Locally
1. Clone the repository.
2. Install or use any simple local web server (e.g. `npx serve`, `python -m http.server`, or VS Code Live Server).
3. Serve the project root: the navigation, footer, and modal partials are fetched via `fetch()` so they **require HTTP**; opening `index.html` via `file://` will not load them.
4. Visit `http://localhost:<port>` in your browser.

## Folder Structure
```
myriad-green-v3/
├─ index.html
├─ services/
├─ partials/
├─ assets/
│  ├─ css/
│  ├─ js/
│  └─ images/
├─ MYRIAD_GREEN_V3_HOUSEKEEPING.md
└─ .github/
   └─ ISSUE_TEMPLATE/
```
- **index.html** – main landing page.
- **services/** – service-specific pages (irrigation, leak detection, drain unblocking, backup water).
- **partials/** – HTML fragments injected into every page (nav, footer, booking modal).
- **assets/css/** – `theme.css`, `layout.css`, `components.css`, `nav-footer.css`, `services.css`.
- **assets/js/** – `site-init.js`, `booking.js`.
- **assets/images/** – reserved for hero/service imagery (use SEO-friendly names per housekeeping doc).
- **MYRIAD_GREEN_V3_HOUSEKEEPING.md** – single source of truth for rules and roadmap.
- **.github/ISSUE_TEMPLATE/** – standard issue templates for bugs, features, and tasks.

## Deployment (GitHub Pages)
1. Push the `main` branch to GitHub.
2. In repository settings, enable GitHub Pages, pointing to the `main` branch (root folder).
3. Assets are relative-path friendly; partials load via `fetch()` using root-relative URLs, so GitHub Pages works out of the box.
4. Update the Pages URL in documentation and structured data once live.

## Contributing
1. Create a feature branch (`git checkout -b feature/awesome-update`).
2. Follow the rules in `MYRIAD_GREEN_V3_HOUSEKEEPING.md` for structure, accessibility, and SEO.
3. Run a local server and test responsive layouts plus the booking modal.
4. Commit changes with clear messages and open a pull request referencing relevant issues or tasks.

## Future Roadmap
- Add hero/service imagery using `<picture>` blocks with WebP fallbacks.
- Implement skip link, `id="main-content"`, and improved modal focus trapping.
- Add Open Graph, Twitter tags, and LocalBusiness JSON-LD structured data.
- Optimize font loading (move Google Fonts import to `<head>` links).
- Harden partial loading with better error handling and fallbacks.
- Integrate backend services (bookings, email, CRM) per the housekeeping guide.
