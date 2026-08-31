/**
 * booking.js - Form validation and submission for the updated Book Your Session UI
 * Completely removes any file upload logic as requested.
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

  if (!bookingForm) return;

  // Handle Form Submission
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
