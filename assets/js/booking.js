/**
 * booking.js - Form validation, FormBaas (FormBold / Static Forms) submission via fetch(),
 * payment method toggle, and WhatsApp fast-track integration.
 */

// ==============================================================================
// 1. Form Provider Configuration
// Configure FormBold or Static Forms endpoints and access keys below.
// Placeholders correspond to environment variables documented in .env.example
// ==============================================================================
export const FORM_CONFIG = {
  // Active provider: 'formbold' | 'staticforms'
  activeProvider: 'formbold',

  // FormBold Configuration (https://formbold.com)
  formbold: {
    // Replace with your FormBold Form ID or endpoint URL
    endpoint: 'https://formbold.com/s/your_formbold_form_id_here'
  },

  // Static Forms Configuration (https://www.staticforms.xyz)
  staticforms: {
    endpoint: 'https://api.staticforms.xyz/submit',
    // Replace with your Static Forms access key from .env.local
    accessKey: 'your_static_forms_access_key_here'
  },

  // WhatsApp Contact for Direct Fast-Track Booking
  whatsappNumber: '917042123365'
};

export function initBookingForm() {
  const bookingForm = document.getElementById('physio-booking-form');
  const submitBtn = bookingForm?.querySelector('.form-submit-btn');
  const paymentOptions = document.querySelectorAll('.payment-option');
  const doctorConsultRadios = document.querySelectorAll('input[name="consulted_doctor"]');
  const fileUploadWrapper = document.getElementById('doctor-report-upload');
  const pricingTabBtns = document.querySelectorAll('.pricing-tab-btn');
  const domesticPricingCards = document.querySelectorAll('.pricing-card.domestic');
  const internationalPricingCards = document.querySelectorAll('.pricing-card.international');

  const successContainer = document.getElementById('booking-success-container');
  const summaryDetails = document.getElementById('booking-summary-details');
  const errorBanner = document.getElementById('booking-error-banner');
  const errorMessageEl = document.getElementById('booking-error-message');
  const errorWhatsAppBtn = document.getElementById('error-whatsapp-btn');
  const successWhatsAppBtn = document.getElementById('success-whatsapp-btn');
  const dismissErrorBtn = document.getElementById('dismiss-error-btn');
  const bookAnotherBtn = document.getElementById('book-another-btn');

  // --------------------------------------------------------------------------
  // Toggle Doctor Upload Input based on Yes/No
  // --------------------------------------------------------------------------
  if (doctorConsultRadios.length && fileUploadWrapper) {
    doctorConsultRadios.forEach((radio) => {
      radio.addEventListener('change', (e) => {
        if (e.target.value === 'yes') {
          fileUploadWrapper.style.display = 'block';
        } else {
          fileUploadWrapper.style.display = 'none';
        }
      });
    });
  }

  // --------------------------------------------------------------------------
  // Domestic vs International Payment Toggle in Form
  // --------------------------------------------------------------------------
  if (paymentOptions.length) {
    paymentOptions.forEach((opt) => {
      opt.addEventListener('click', function () {
        paymentOptions.forEach((o) => o.classList.remove('active'));
        this.classList.add('active');
        const radio = this.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;

        const selectedType = this.dataset.paymentType;
        const razorpayInfo = document.getElementById('domestic-payment-details');
        const paypalInfo = document.getElementById('intl-payment-details');

        if (razorpayInfo && paypalInfo) {
          if (selectedType === 'domestic') {
            razorpayInfo.style.display = 'block';
            paypalInfo.style.display = 'none';
          } else {
            razorpayInfo.style.display = 'none';
            paypalInfo.style.display = 'block';
          }
        }
      });
    });
  }

  // --------------------------------------------------------------------------
  // Pricing Section Tabs (Domestic vs International)
  // --------------------------------------------------------------------------
  if (pricingTabBtns.length) {
    pricingTabBtns.forEach((btn) => {
      btn.addEventListener('click', function () {
        pricingTabBtns.forEach((b) => b.classList.remove('active'));
        this.classList.add('active');

        const tab = this.dataset.pricingTab;
        if (tab === 'domestic') {
          domesticPricingCards.forEach((c) => (c.style.display = 'flex'));
          internationalPricingCards.forEach((c) => (c.style.display = 'none'));
        } else {
          domesticPricingCards.forEach((c) => (c.style.display = 'none'));
          internationalPricingCards.forEach((c) => (c.style.display = 'flex'));
        }
      });
    });
  }

  // --------------------------------------------------------------------------
  // Dismiss Error Banner
  // --------------------------------------------------------------------------
  if (dismissErrorBtn && errorBanner) {
    dismissErrorBtn.addEventListener('click', () => {
      errorBanner.style.display = 'none';
    });
  }

  // --------------------------------------------------------------------------
  // Book Another Consultation Button (Reset & Show Form)
  // --------------------------------------------------------------------------
  if (bookAnotherBtn && successContainer && bookingForm) {
    bookAnotherBtn.addEventListener('click', () => {
      bookingForm.reset();
      if (fileUploadWrapper) fileUploadWrapper.style.display = 'none';
      successContainer.classList.remove('active');
      bookingForm.style.display = 'block';
      if (errorBanner) errorBanner.style.display = 'none';

      // Scroll to form smoothly
      const bookingSection = document.getElementById('booking');
      if (bookingSection) {
        bookingSection.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  // --------------------------------------------------------------------------
  // Intercept Form Submit & Submit via fetch()
  // --------------------------------------------------------------------------
  if (bookingForm) {
    bookingForm.addEventListener('submit', async function (e) {
      e.preventDefault();

      if (errorBanner) errorBanner.style.display = 'none';

      // Extract field values
      const fullName = document.getElementById('fullName')?.value.trim();
      const phoneNumber = document.getElementById('phoneNumber')?.value.trim();
      const city = document.getElementById('city')?.value.trim();
      const complaint = document.getElementById('complaint')?.value.trim();
      const duration = document.getElementById('duration')?.value;
      const consultedDoctor = document.querySelector('input[name="consulted_doctor"]:checked')?.value || 'no';
      const preferredTime = document.getElementById('preferredTime')?.value.trim();
      const referralSource = document.getElementById('referralSource')?.value;
      const paymentMethod = document.querySelector('input[name="payment_type"]:checked')?.value || 'domestic';

      // Client-side validation checks
      if (!fullName || !phoneNumber || !city || !complaint || !duration || !consultedDoctor || !preferredTime || !referralSource) {
        alert('Please fill in all required fields marked with * to proceed.');
        return;
      }

      if (phoneNumber.length < 10) {
        alert('Please provide a valid 10+ digit contact number.');
        return;
      }

      // Build structured WhatsApp message text
      const whatsAppSummary = `
*Physiotherapy Consultation Request*
------------------------------------
*Patient Name:* ${fullName}
*Contact Number:* ${phoneNumber}
*City:* ${city}
*Issue / Symptoms:* ${complaint}
*Duration of Pain:* ${duration}
*Consulted Doctor Before:* ${consultedDoctor.toUpperCase()}
*Preferred Schedule:* ${preferredTime}
*Referral Source:* ${referralSource}
*Payment Method:* ${paymentMethod === 'domestic' ? 'UPI / Domestic Cards (₹700)' : 'PayPal / Global Cards (~$25-$30)'}
      `.trim();

      const encodedWhatsAppUrl = `https://wa.me/${FORM_CONFIG.whatsappNumber}?text=${encodeURIComponent(whatsAppSummary)}`;

      // Construct FormData object
      const formData = new FormData(bookingForm);

      // Append metadata
      formData.set('subject', `New Online Consultation Booking - ${fullName}`);
      formData.set('payment_preference', paymentMethod === 'domestic' ? 'UPI / Domestic (₹700)' : 'PayPal / International (~$25-$30)');

      // If using Static Forms, append accessKey
      if (FORM_CONFIG.activeProvider === 'staticforms') {
        formData.append('accessKey', FORM_CONFIG.staticforms.accessKey);
        formData.append('apiKey', FORM_CONFIG.staticforms.accessKey);
      }

      // Determine target endpoint
      const targetEndpoint =
        FORM_CONFIG.activeProvider === 'staticforms'
          ? FORM_CONFIG.staticforms.endpoint
          : FORM_CONFIG.formbold.endpoint;

      // Update submit button to loading state
      const originalBtnHtml = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> Submitting Request...`;

      try {
        let isSuccess = false;

        // Check if endpoint is still a placeholder (e.g. in local/demo environment)
        const isPlaceholderEndpoint =
          targetEndpoint.includes('your_formbold_form_id_here') ||
          targetEndpoint.includes('your_static_forms_access_key_here');

        if (isPlaceholderEndpoint) {
          // Simulate slight network latency for realistic local testing experience
          await new Promise((resolve) => setTimeout(resolve, 800));
          console.info(
            '[Booking Form] Form submitted with placeholder keys. Form payload:',
            Object.fromEntries(formData.entries())
          );
          isSuccess = true;
        } else {
          // Send actual fetch request to the provider
          const response = await fetch(targetEndpoint, {
            method: 'POST',
            body: formData,
            headers: {
              Accept: 'application/json'
            }
          });

          if (response.ok) {
            isSuccess = true;
          } else {
            const result = await response.json().catch(() => ({}));
            throw new Error(result.message || `Server responded with HTTP ${response.status}`);
          }
        }

        if (isSuccess) {
          // Render dynamic summary details inside the inline success card
          if (summaryDetails) {
            summaryDetails.innerHTML = `
              <div class="summary-row">
                <span class="summary-label">Patient Name</span>
                <span class="summary-value">${escapeHtml(fullName)}</span>
              </div>
              <div class="summary-row">
                <span class="summary-label">Phone (WhatsApp)</span>
                <span class="summary-value">${escapeHtml(phoneNumber)}</span>
              </div>
              <div class="summary-row">
                <span class="summary-label">City</span>
                <span class="summary-value">${escapeHtml(city)}</span>
              </div>
              <div class="summary-row">
                <span class="summary-label">Preferred Time</span>
                <span class="summary-value">${escapeHtml(preferredTime)}</span>
              </div>
              <div class="summary-row">
                <span class="summary-label">Payment Preference</span>
                <span class="summary-value">${paymentMethod === 'domestic' ? 'UPI / Domestic (₹700)' : 'PayPal / International (~$25-$30)'}</span>
              </div>
            `;
          }

          // Link WhatsApp fast-track button
          if (successWhatsAppBtn) {
            successWhatsAppBtn.href = encodedWhatsAppUrl;
          }

          // Hide form and display inline success card
          bookingForm.style.display = 'none';
          if (successContainer) {
            successContainer.classList.add('active');
          }

          // Scroll smoothly to booking card
          document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' });
        }
      } catch (error) {
        console.error('[Booking Form Error]:', error);

        // Display inline error banner with direct WhatsApp recovery option
        if (errorBanner) {
          if (errorMessageEl) {
            errorMessageEl.textContent = `Unable to connect to the booking server (${error.message || 'Network error'}). You can complete your consultation booking directly on WhatsApp!`;
          }
          if (errorWhatsAppBtn) {
            errorWhatsAppBtn.href = encodedWhatsAppUrl;
          }
          errorBanner.style.display = 'flex';
          errorBanner.scrollIntoView({ behavior: 'smooth' });
        }
      } finally {
        // Reset submit button state
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHtml;
      }
    });
  }
}

/**
 * Basic HTML escaping helper to prevent XSS in rendered summaries
 */
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
