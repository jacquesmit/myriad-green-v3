import { sendContactEmail } from './email-handler.js';

/* Site bootstrap: inject shared partials, wire navigation, theme toggle, and contact form behaviors. */
(function () {
  // baseUrl lets partials resolve correctly from nested folders; extend this logic if pages move deeper (e.g. /services-pages/ or /blog/posts/)
  const baseUrl = import.meta.url.replace(/assets\/js\/site-init\.js.*$/, '');

  const partials = [
    { selector: '#nav-placeholder', path: 'partials/nav.html', label: 'Navigation', callback: initNavigation },
    { selector: '#footer-placeholder', path: 'partials/footer.html', label: 'Footer', callback: initFooter },
    { selector: '#booking-modal-root', path: 'partials/booking-modal.html', label: 'Booking Modal', callback: initBooking }
  ];

  document.addEventListener('DOMContentLoaded', () => {
    partials.forEach(({ selector, path, label, callback }) => {
      loadPartial(selector, path, label).then((host) => {
        if (host && typeof callback === 'function') {
          callback(host);
        }
      });
    });
    initSmoothScroll();
    initContactForm();
  });

  async function loadPartial(selector, url, label) {
    const host = document.querySelector(selector);
    if (!host) return null;
    try {
      const response = await fetch(new URL(url, baseUrl));
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      host.innerHTML = await response.text();
      return host;
    } catch (error) {
      console.error('[MyriadGreen] Failed to load', label, 'from', url, error);
      host.innerHTML = `<!-- ${label} failed to load -->`;
      return null;
    }
  }

  function initNavigation(root) {
    const nav = root.querySelector('.site-nav');
    const toggle = root.querySelector('[data-nav-toggle]');
    const dropdown = root.querySelector('[data-nav-dropdown]');
    const dropdownButton = dropdown?.querySelector('button');

    toggle?.addEventListener('click', () => {
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!expanded));
      nav?.classList.toggle('open');
    });

    root.querySelectorAll('.site-nav a').forEach((link) => {
      link.addEventListener('click', () => {
        if (nav?.classList.contains('open')) {
          nav.classList.remove('open');
          toggle?.setAttribute('aria-expanded', 'false');
        }
      });
    });

    dropdownButton?.addEventListener('click', () => {
      const isOpen = dropdown.classList.toggle('open');
      dropdownButton.setAttribute('aria-expanded', String(isOpen));
    });

    const themeToggle = root.querySelector('[data-theme-toggle]');
    if (themeToggle) {
      themeToggle.addEventListener('click', toggleTheme);
      const prefersDark = document.documentElement.getAttribute('data-theme') === 'dark';
      themeToggle.setAttribute('aria-pressed', String(prefersDark));
    }
  }

  function initFooter(root) {
    const yearEl = root.querySelector('#footer-year');
    if (yearEl) {
      yearEl.textContent = new Date().getFullYear();
    }
  }

  function initBooking() {
    if (window.BookingModal) {
      window.BookingModal.init();
    }
  }

  function initSmoothScroll() {
    document.addEventListener('click', (event) => {
      const link = event.target.closest('a[href^="#"][data-scroll-target]');
      if (!link) return;
      const targetId = link.getAttribute('href').replace('#', '');
      const el = document.getElementById(targetId);
      if (el) {
        event.preventDefault();
        el.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  function initContactForm() {
    const form = document.querySelector('[data-contact-form]');
    if (!form) return;
    const status = form.querySelector('[data-contact-status]');

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const requiredFields = ['name', 'phone', 'email', 'service', 'message'];
      const missing = requiredFields.filter((field) => !data.get(field));
      if (missing.length) {
        updateStatus('Please fill in all fields so we can respond promptly.', 'error');
        return;
      }

      if (!isValidEmail(data.get('email'))) {
        updateStatus('Please enter a valid email address so we can reply.', 'error');
        return;
      }

      if (!isValidPhone(data.get('phone'))) {
        updateStatus('Please enter a phone number with at least 8 digits.', 'error');
        return;
      }

      updateStatus('Sending your message...', 'info');

      const subjectValue = (data.get('subject') || data.get('service') || '').toString().trim();
      const payload = {
        name: data.get('name'),
        phone: data.get('phone'),
        email: data.get('email'),
        subject: subjectValue || 'General enquiry',
        message: data.get('message')
      };

      try {
        await sendContactEmail(payload);
        updateStatus('Thanks! We received your message and will contact you shortly.', 'success');
        form.reset();
      } catch (error) {
        console.error('Contact email failed:', error);
        updateStatus('Something went wrong sending your message. Please try again or WhatsApp us.', 'error');
      }
    });

    function updateStatus(message, variant) {
      if (!status) return;
      status.textContent = message;
      status.className = `form-status ${variant}`;
    }

    function isValidEmail(value) {
      return typeof value === 'string' && value.includes('@');
    }

    function isValidPhone(value) {
      if (typeof value !== 'string') return false;
      const digits = value.replace(/\D/g, '');
      return digits.length >= 8;
    }
  }

  function toggleTheme(event) {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next === 'dark' ? 'dark' : '');
    localStorage.setItem('myriad-theme', next);
    if (event?.currentTarget) {
      event.currentTarget.setAttribute('aria-pressed', String(next === 'dark'));
    }
  }

  (function applyStoredTheme() {
    const stored = localStorage.getItem('myriad-theme');
    if (stored === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  })();
})();
