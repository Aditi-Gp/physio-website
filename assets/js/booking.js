/**
 * booking.js - Form validation, Condition Card sync, Quick Date Selectors & Submission
 * Strictly without file upload logic as requested.
 */

export const FORM_CONFIG = {
  // Active provider: 'formbold' | 'staticforms'
  activeProvider: 'formbold',

  // FormBold Configuration (https://formbold.com)
  formbold: {
    endpoint: 'https://formbold.com/s/your_formbold_form_id_here'
  },

  // Static Forms Configuration (https://www.staticforms.xyz)
  staticforms: {
    endpoint: 'https://api.staticforms.xyz/submit',
    accessKey: 'your_static_forms_access_key_here'
  },

  // WhatsApp Contact for Direct Fast-Track Booking
  whatsappNumber: '917042123365'
};

export function initBookingForm() {
  const bookingForm = document.getElementById('session-booking-form');
  const submitBtn = bookingForm?.querySelector('.btn-submit-payment');
  const feedbackCard = document.getElementById('form-feedback-card');
  const feedbackSummary = document.getElementById('feedback-summary-content');
  const feedbackWhatsAppBtn = document.getElementById('feedback-whatsapp-btn');
  const bookAgainBtn = document.getElementById('book-again-btn');
  const conditionSelect = document.getElementById('bookCondition');
  const dateInput = document.getElementById('bookDate');
  const quickDateBtns = document.querySelectorAll('.quick-date-btn');

  // 1. Initialize Quick Date Pills (Today / Tomorrow / Pick Date)
  if (dateInput) {
    // Set default date to today in YYYY-MM-DD
    const today = new Date();
    const formatDate = (d) => d.toISOString().split('T')[0];
    dateInput.value = formatDate(today);
    dateInput.min = formatDate(today);

    quickDateBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        quickDateBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        const offset = btn.dataset.offset;
        if (offset === '0') {
          dateInput.value = formatDate(new Date());
        } else if (offset === '1') {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          dateInput.value = formatDate(tomorrow);
        } else if (offset === 'custom') {
          dateInput.focus();
          if (typeof dateInput.showPicker === 'function') {
            dateInput.showPicker();
          }
        }
      });
    });

    dateInput.addEventListener('change', () => {
      quickDateBtns.forEach((b) => b.classList.remove('active'));
    });
  }

  // 2. Condition Cards Interactive Sync
  const conditionBoxes = document.querySelectorAll('.condition-box');
  conditionBoxes.forEach((box) => {
    box.addEventListener('click', () => {
      const conditionName = box.dataset.condition;
      if (conditionSelect && conditionName) {
        conditionSelect.value = conditionName;
      }
      const bookingSection = document.getElementById('book-session');
      if (bookingSection) {
        bookingSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (conditionSelect) {
          conditionSelect.style.borderColor = '#0D9488';
          conditionSelect.style.boxShadow = '0 0 0 4px rgba(13, 148, 136, 0.2)';
          setTimeout(() => {
            conditionSelect.style.borderColor = '';
            conditionSelect.style.boxShadow = '';
          }, 1500);
        }
      }
    });
  });

  // 3. Pricing Tier Buttons Sync
  const tierBtns = document.querySelectorAll('.btn-select-tier');
  tierBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tierName = btn.dataset.tierName;
      const bookingSection = document.getElementById('book-session');
      if (bookingSection) {
        bookingSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const nameInput = document.getElementById('bookFullName');
        if (nameInput) nameInput.focus();
      }
    });
  });

  if (!bookingForm) return;

  // 4. Form Submission Handler
  bookingForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const fullName = document.getElementById('bookFullName')?.value.trim();
    const email = document.getElementById('bookEmail')?.value.trim();
    const condition = document.getElementById('bookCondition')?.value;
    const sessionDate = document.getElementById('bookDate')?.value;

    if (!fullName || !email || !condition || !sessionDate) {
      alert('Please fill out all fields to proceed with your booking.');
      return;
    }

    // Build structured WhatsApp message
    const whatsAppMessage = `
*Telephysiotherapy Session Request*
-----------------------------------
*Patient Name:* ${fullName}
*Email:* ${email}
*Condition:* ${condition}
*Preferred Date:* ${sessionDate}
*Doctor:* Dr. Anchal Gupta (CVRS)
    `.trim();

    const encodedWhatsAppUrl = `https://wa.me/${FORM_CONFIG.whatsappNumber}?text=${encodeURIComponent(whatsAppMessage)}`;

    // Build FormData (strictly without file upload)
    const formData = new FormData();
    formData.append('fullName', fullName);
    formData.append('email', email);
    formData.append('condition', condition);
    formData.append('preferredDate', sessionDate);
    formData.append('subject', `New Session Booking Request - ${fullName}`);

    if (FORM_CONFIG.activeProvider === 'staticforms') {
      formData.append('accessKey', FORM_CONFIG.staticforms.accessKey);
    }

    const targetEndpoint =
      FORM_CONFIG.activeProvider === 'staticforms'
        ? FORM_CONFIG.staticforms.endpoint
        : FORM_CONFIG.formbold.endpoint;

    // Loading State
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span>Processing Booking...</span>`;

    try {
      const isPlaceholder =
        targetEndpoint.includes('your_formbold_form_id_here') ||
        targetEndpoint.includes('your_static_forms_access_key_here');

      if (isPlaceholder) {
        // Local simulation
        await new Promise((resolve) => setTimeout(resolve, 600));
      } else {
        const response = await fetch(targetEndpoint, {
          method: 'POST',
          body: formData,
          headers: { Accept: 'application/json' }
        });

        if (!response.ok) {
          throw new Error('Submission server error');
        }
      }

      // Render Inline Feedback
      if (feedbackSummary) {
        feedbackSummary.innerHTML = `
          <div><strong>Patient:</strong> ${escapeHtml(fullName)}</div>
          <div><strong>Email:</strong> ${escapeHtml(email)}</div>
          <div><strong>Condition:</strong> ${escapeHtml(condition)}</div>
          <div><strong>Requested Date:</strong> ${escapeHtml(sessionDate)}</div>
        `;
      }

      if (feedbackWhatsAppBtn) {
        feedbackWhatsAppBtn.href = encodedWhatsAppUrl;
      }

      bookingForm.style.display = 'none';
      if (feedbackCard) feedbackCard.classList.add('active');

    } catch (err) {
      console.warn('[Booking Error]:', err);
      // Fallback directly to WhatsApp
      const confirmWA = confirm('Could not reach booking server directly. Would you like to confirm via WhatsApp with Dr. Anchal Gupta?');
      if (confirmWA) {
        window.open(encodedWhatsAppUrl, '_blank');
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
    }
  });

  // Book Again Handler
  if (bookAgainBtn && feedbackCard) {
    bookAgainBtn.addEventListener('click', () => {
      bookingForm.reset();
      feedbackCard.classList.remove('active');
      bookingForm.style.display = 'block';
    });
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
