/* Booking modal module manages open/close, service preselection, and placeholder submit logic. */
const BookingModal = (() => {
  let backdrop;
  let modal;
  let form;
  let successBanner;
  let statusText;
  let paymentBlock;
  let paymentCta;
  let paymentStatus;
  let submitButton;
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
    paymentBlock = backdrop.querySelector('[data-payment-block]');
    paymentCta = backdrop.querySelector('[data-payment-cta]');
    paymentStatus = backdrop.querySelector('[data-payment-status]');
    submitButton = form ? form.querySelector('button[type="submit"], [type="submit"]') : null;
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
    // ensure payment UI reflects selected service
    handleServiceChange();
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

  const EMERGENCY_LOOKUP = {
    "Leak Detection": 1650,
    "Drain Unblocking": 1350
  };

  async function handleSubmit(event) {
    event.preventDefault();
    event.stopImmediatePropagation();

    if (!form) return;

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
    const emergencyServices = ["Leak Detection", "Drain Unblocking"];
    if (emergencyServices.includes(payload.service)) {
      if (statusText) {
        statusText.textContent = 'Please complete the call‑out payment using the button above before submitting.';
      }
      return;
    }

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

  function handleServiceChange() {
    if (!form) return;
    const service = form.querySelector('select[name="service"]').value;
    const isEmergency = Object.prototype.hasOwnProperty.call(EMERGENCY_LOOKUP, service);
    if (isEmergency) {
      if (paymentBlock) {
        paymentBlock.removeAttribute('hidden');
        const copy = paymentBlock.querySelector('[data-payment-copy]');
        if (copy) {
          const price = EMERGENCY_LOOKUP[service];
          copy.textContent = `A R ${price.toFixed(2)} call‑out fee is required before we can confirm your booking.`;
        }
      }
      submitButton?.setAttribute('disabled', 'true');
    } else {
      paymentBlock?.setAttribute('hidden', 'true');
      submitButton?.removeAttribute('disabled');
      if (paymentStatus) paymentStatus.textContent = '';
    }
  }

  async function handlePayClick(event) {
    event.preventDefault();
    if (!form) return;

    const formData = new FormData(form);
    const rawName = formData.get('name') || formData.get('fullName') || '';
    const payload = {
      service: String(formData.get('service') || '').trim(),
      name: String(rawName).trim(),
      email: String(formData.get('email') || '').trim(),
      phone: String(formData.get('phone') || '').trim(),
      notes: String(formData.get('notes') || '').trim(),
      preferredDate: String(formData.get('preferredDate') || '').trim(),
    };
    const required = [payload.service, payload.name, payload.email, payload.phone];
    const allValid = required.every((v) => typeof v === 'string' && v.trim().length);
    if (!allValid) {
      if (paymentStatus) paymentStatus.textContent = 'Please complete the required fields above before paying.';
      return;
    }

    paymentCta?.setAttribute('disabled', 'true');
    if (paymentStatus) paymentStatus.textContent = 'Redirecting to Stripe...';

    try {
      const resp = await fetch('https://africa-south1-myriad-green-v3.cloudfunctions.net/createCheckoutSession', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      if (paymentStatus) paymentStatus.textContent = 'Unable to start payment. Please try again later.';
    } catch (err) {
      if (paymentStatus) paymentStatus.textContent = 'Unable to start payment. Please try again later.';
    } finally {
      paymentCta?.removeAttribute('disabled');
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
      const serviceSelect = form.querySelector('select[name="service"]');
      if (serviceSelect) {
        serviceSelect.addEventListener('change', handleServiceChange);
      }
    }
    if (paymentCta) {
      paymentCta.addEventListener('click', handlePayClick);
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
