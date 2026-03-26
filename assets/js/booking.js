/* Booking modal module manages open/close, service preselection, and placeholder submit logic. */
// payments are currently frozen while provider onboarding is pending
const PAYMENTS_ENABLED = false;
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
  let paymentInitFailed = false;
  let previouslyFocused;
  let lockedScrollY = 0;
  let isScrollLocked = false;
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

  const serviceMap = {
    "leak-detection": "Leak Detection",
    "irrigation-repair": "Irrigation Repair",
    "drain-unblocking": "Drain Unblocking",
    "borehole-pump-systems": "Borehole Pump Systems"
  };

  const serviceAliases = {
    "Irrigation Repair": "Irrigation Systems",
    "Borehole Pump Systems": "Backup Water Systems"
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
    paymentInitFailed = false;
    previouslyFocused = document.activeElement;
    setServiceValue(serviceName);
    backdrop.classList.add('is-open');
    backdrop.setAttribute('aria-hidden', 'false');
    lockBodyScroll();
    setFocusableElements();
    (firstFocusable || modal).focus({ preventScroll: true });
    // ensure payment UI reflects selected service
    handleServiceChange();
  }

  function close() {
    backdrop?.classList.remove('is-open');
    backdrop?.setAttribute('aria-hidden', 'true');
    unlockBodyScroll();
    focusableElements = [];
    firstFocusable = undefined;
    lastFocusable = undefined;
    if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
      previouslyFocused.focus();
    }
  }

  function lockBodyScroll() {
    if (isScrollLocked) return;
    lockedScrollY = window.scrollY || window.pageYOffset || 0;
    document.body.classList.add('modal-open');
    document.body.style.position = 'fixed';
    document.body.style.top = `-${lockedScrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    isScrollLocked = true;
  }

  function unlockBodyScroll() {
    if (!isScrollLocked) return;
    const topValue = document.body.style.top;
    document.body.classList.remove('modal-open');
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    const restoredScrollY = topValue ? Math.abs(parseInt(topValue, 10)) : lockedScrollY;
    window.scrollTo(0, restoredScrollY);
    isScrollLocked = false;
  }

  function resolveServiceValue(value, select) {
    const normalizedValue = typeof value === 'string' ? value.trim() : '';
    const mappedValue = serviceMap[normalizedValue] || normalizedValue;
    const candidates = [
      mappedValue,
      serviceAliases[mappedValue],
      serviceAliases[normalizedValue],
      normalizedValue
    ].filter(Boolean);

    const matchedOption = candidates.find((candidate) =>
      Array.from(select.options).some((option) => option.value === candidate)
    );

    return matchedOption || mappedValue;
  }

  function setServiceValue(value) {
    const select = form?.querySelector('select[name="service"]');
    if (select) {
      select.value = resolveServiceValue(value, select);
    }
  }

  const EMERGENCY_LOOKUP = {
    "Leak Detection": 1650,
    "Drain Unblocking": 1350
  };
  const EMERGENCY_SERVICES = Object.keys(EMERGENCY_LOOKUP);

  function setFallbackEmergencyStatus() {
    if (!statusText) return;
    statusText.className = 'form-status';
    statusText.textContent = 'Online payment temporarily unavailable. We’ll contact you shortly to finalise.';
  }

  function setEmergencyContactStatus() {
    if (!statusText) return;
    statusText.className = 'form-status error';
    statusText.innerHTML = 'We could not confirm this emergency booking online right now. Please <a href="https://wa.me/27629233952" target="_blank" rel="noopener">WhatsApp</a> or <a href="tel:+27629233952">Call 062 923 3952</a> for immediate assistance.';
  }

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
    const isEmergency = EMERGENCY_SERVICES.includes(payload.service);
    if (isEmergency && PAYMENTS_ENABLED && !paymentInitFailed) {
      if (statusText) {
        statusText.className = 'form-status error';
        statusText.textContent = 'Please complete payment to confirm emergency dispatch.';
      }
      return;
    }

    if (isEmergency && (!PAYMENTS_ENABLED || paymentInitFailed)) {
      setFallbackEmergencyStatus();
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
      } else {
        const backendMessage = String(data?.error || data?.message || '').toLowerCase();
        const emergencyRejected = isEmergency && (
          backendMessage.includes('payment') ||
          backendMessage.includes('emergency') ||
          response.status === 400 ||
          response.status === 403
        );
        if (emergencyRejected) {
          setEmergencyContactStatus();
        } else if (statusText) {
          statusText.textContent = 'Sorry, something went wrong. Please try again.';
        }
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
    const serviceSelect = form.querySelector('select[name="service"]');
    if (!serviceSelect) return;
    const service = serviceSelect.value;
    const isEmergency = Object.prototype.hasOwnProperty.call(EMERGENCY_LOOKUP, service);
    if (isEmergency) {
      if (!PAYMENTS_ENABLED || paymentInitFailed) {
        paymentBlock?.setAttribute('hidden', 'true');
        submitButton?.removeAttribute('disabled');
        setFallbackEmergencyStatus();
        if (paymentStatus) paymentStatus.textContent = '';
        if (paymentCta) paymentCta.removeAttribute('disabled');
        return;
      }

      if (paymentBlock) {
        paymentBlock.removeAttribute('hidden');
        const copy = paymentBlock.querySelector('[data-payment-copy]');
        if (copy) {
          const price = EMERGENCY_LOOKUP[service];
          copy.textContent = `A R ${price.toFixed(2)} call‑out fee is required before we can confirm your booking.`;
        }
      }
      submitButton?.setAttribute('disabled', 'true');
      if (statusText) {
        statusText.className = 'booking-status';
        statusText.textContent = '';
      }
    } else {
      paymentBlock?.setAttribute('hidden', 'true');
      submitButton?.removeAttribute('disabled');
      if (statusText) {
        statusText.className = 'booking-status';
        statusText.textContent = '';
      }
      if (paymentStatus) paymentStatus.textContent = '';
      if (paymentCta) paymentCta.removeAttribute('disabled');
    }
  }

  async function handlePayClick(event) {
    event.preventDefault();
    if (!form) return;

    if (!PAYMENTS_ENABLED) {
      if (paymentStatus) paymentStatus.textContent = 'Payments temporarily unavailable — WhatsApp us';
      return;
    }

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
      paymentInitFailed = true;
      if (paymentStatus) paymentStatus.textContent = 'Unable to start payment. You can still submit your booking and we will finalise payment with you.';
      handleServiceChange();
    } catch (err) {
      paymentInitFailed = true;
      if (paymentStatus) paymentStatus.textContent = 'Unable to start payment. You can still submit your booking and we will finalise payment with you.';
      handleServiceChange();
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
        const mappedService = serviceMap[service] || service;
        open(mappedService);
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
