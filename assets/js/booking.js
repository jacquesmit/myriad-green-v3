/* Booking modal module manages open/close, service preselection, and placeholder submit logic. */
const BookingModal = (() => {
  let backdrop;
  let modal;
  let form;
  let successBanner;
  let statusText;
  let previouslyFocused;
  let focusableElements = [];
  let firstFocusable;
  let lastFocusable;

  const focusableSelector = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

  const selectors = {
    backdrop: '#booking-modal-backdrop',
    form: '[data-booking-form]',
    close: '[data-close-modal]',
    status: '[data-booking-status]',
    trigger: '[data-book-service]'
  };

  function cacheElements() {
    backdrop = document.querySelector(selectors.backdrop);
    if (!backdrop) return false;
    modal = backdrop.querySelector('.modal');
    form = backdrop.querySelector(selectors.form);
    successBanner = backdrop.querySelector('.booking-success');
    statusText = backdrop.querySelector(selectors.status);
    return true;
  }

  function open(serviceName = 'General Consultation') {
    if (!modal) return;
    previouslyFocused = document.activeElement;
    setServiceValue(serviceName);
    backdrop.classList.add('is-open');
    backdrop.setAttribute('aria-hidden', 'false');
    setFocusableElements();
    (firstFocusable || modal).focus({ preventScroll: true });
  }

  function close() {
    backdrop?.classList.remove('is-open');
    backdrop?.setAttribute('aria-hidden', 'true');
    focusableElements = [];
    firstFocusable = undefined;
    lastFocusable = undefined;
    if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
      previouslyFocused.focus();
    }
  }

  function setServiceValue(value) {
    const select = form?.querySelector('select[name="service"]');
    if (select) {
      select.value = value;
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    event.stopImmediatePropagation();

    if (!form) return;

    const submitButton = form.querySelector('button[type="submit"], [type="submit"]');
    const formData = new FormData(form);
    const rawName = formData.get('name') || formData.get('fullName') || '';
    const payload = {
      name: String(rawName).trim(),
      email: String(formData.get('email') || '').trim(),
      phone: String(formData.get('phone') || '').trim(),
      service: String(formData.get('service') || '').trim(),
      preferredDate: String(formData.get('preferredDate') || '').trim(),
      preferredTime: String(formData.get('preferredTime') || '').trim(),
      address: String(formData.get('address') || '').trim(),
      notes: String(formData.get('notes') || '').trim()
    };

    const requiredValid = payload.name && payload.email && payload.phone && payload.service;
    if (!requiredValid) {
      if (statusText) {
        statusText.textContent = "Please fill in your name, email, phone, and service.";
      }
      return;
    }

    submitButton?.setAttribute('disabled', 'true');
    if (statusText) {
      statusText.textContent = 'Sending your booking...';
    }

    const preservedService = payload.service;

    try {
      const response = await fetch(
        'https://africa-south1-myriad-green-v3.cloudfunctions.net/createBooking',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }
      );

      let data;
      try {
        data = await response.json();
      } catch (_) {
        data = {};
      }

      if (response.ok && data && data.ok === true) {
        if (statusText) {
          statusText.textContent = "Thank you! Your booking has been received. We'll confirm shortly.";
        }
        form.reset();
        const serviceField = form.querySelector('select[name="service"]');
        if (serviceField) {
          serviceField.value = preservedService;
        }
        setTimeout(() => {
          close();
        }, 2000);
      } else if (statusText) {
        statusText.textContent = 'Sorry, something went wrong. Please try again.';
      }
    } catch (error) {
      if (statusText) {
        statusText.textContent = 'Sorry, something went wrong. Please try again.';
      }
    } finally {
      submitButton?.removeAttribute('disabled');
    }
  }

  function setFocusableElements() {
    if (!modal) return;
    focusableElements = Array.from(modal.querySelectorAll(focusableSelector)).filter(
      (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true'
    );
    firstFocusable = focusableElements[0];
    lastFocusable = focusableElements[focusableElements.length - 1];
  }

  /*
    Focus trap: keep Tab navigation inside the modal. Add new selectors to
    `focusableSelector` whenever more interactive elements are introduced.
  */
  function handleKeydown(event) {
    if (!backdrop?.classList.contains('is-open')) return;
    if (event.key === 'Tab' && focusableElements.length) {
      // Trap focus within the modal so keyboard users stay in context.
      if (event.shiftKey) {
        if (document.activeElement === firstFocusable) {
          event.preventDefault();
          (lastFocusable || firstFocusable).focus();
        }
      } else if (document.activeElement === lastFocusable) {
        event.preventDefault();
        (firstFocusable || lastFocusable).focus();
      }
    }
    if (event.key === 'Escape') {
      close();
    }
  }

  function bindEvents() {
    document.addEventListener('click', (event) => {
      const trigger = event.target.closest(selectors.trigger);
      if (trigger) {
        const service = trigger.getAttribute('data-book-service');
        open(service);
      }
    });

    backdrop?.addEventListener('click', (event) => {
      if (event.target === backdrop) {
        close();
      }
    });

    backdrop?.querySelector(selectors.close)?.addEventListener('click', close);

    document.addEventListener('keydown', handleKeydown);

    if (form) {
      form.addEventListener('submit', handleSubmit);
    }
  }

  function init() {
    if (!cacheElements()) return;
    modal.setAttribute('tabindex', '-1');
    bindEvents();
  }

  return { init };
})();

if (typeof window !== 'undefined') {
  window.BookingModal = BookingModal;
}
