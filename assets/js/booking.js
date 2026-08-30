/**
 * booking.js - Form validation, payment method toggle, and WhatsApp booking integration
 */
export function initBookingForm() {
  const bookingForm = document.getElementById('physio-booking-form');
  const paymentOptions = document.querySelectorAll('.payment-option');
  const doctorConsultRadios = document.querySelectorAll('input[name="consulted_doctor"]');
  const fileUploadWrapper = document.getElementById('doctor-report-upload');
  const pricingTabBtns = document.querySelectorAll('.pricing-tab-btn');
  const domesticPricingCards = document.querySelectorAll('.pricing-card.domestic');
  const internationalPricingCards = document.querySelectorAll('.pricing-card.international');

  // Toggle Doctor Upload Input based on Yes/No
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

  // Domestic vs International Payment Toggle in Form
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

  // Pricing Section Tabs (Domestic vs International)
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

  // Form Submission & Client-side Validation
  if (bookingForm) {
    bookingForm.addEventListener('submit', function (e) {
      e.preventDefault();

      const fullName = document.getElementById('fullName')?.value.trim();
      const phoneNumber = document.getElementById('phoneNumber')?.value.trim();
      const city = document.getElementById('city')?.value.trim();
      const complaint = document.getElementById('complaint')?.value.trim();
      const duration = document.getElementById('duration')?.value;
      const consultedDoctor = document.querySelector('input[name="consulted_doctor"]:checked')?.value;
      const preferredTime = document.getElementById('preferredTime')?.value.trim();
      const referralSource = document.getElementById('referralSource')?.value;
      const paymentMethod = document.querySelector('input[name="payment_type"]:checked')?.value || 'domestic';

      if (!fullName || !phoneNumber || !city || !complaint || !duration || !consultedDoctor || !preferredTime || !referralSource) {
        alert('Please fill in all required fields to proceed with your booking.');
        return;
      }

      // Basic phone number validation
      if (phoneNumber.length < 10) {
        alert('Please enter a valid phone number.');
        return;
      }

      // Prepare booking summary
      const bookingSummary = `
*New Consultation Booking Request*
----------------------------------
*Name:* ${fullName}
*Phone:* ${phoneNumber}
*City:* ${city}
*Issue:* ${complaint}
*Duration:* ${duration}
*Doctor Consulted:* ${consultedDoctor}
*Preferred Time:* ${preferredTime}
*Referred via:* ${referralSource}
*Payment Preference:* ${paymentMethod === 'domestic' ? 'UPI / Razorpay (Domestic)' : 'PayPal (International)'}
      `.trim();

      // Show confirmation dialog with options to proceed to WhatsApp or online payment
      const proceedWhatsApp = confirm(
        `Thank you, ${fullName}!\n\nWould you like to send this booking directly to Dr. Anchal Gupta via WhatsApp (+91 70421 23365) to confirm your slot?`
      );

      if (proceedWhatsApp) {
        const encodedText = encodeURIComponent(bookingSummary);
        window.open(`https://wa.me/917042123365?text=${encodedText}`, '_blank');
      }

      // Reset form
      bookingForm.reset();
      if (fileUploadWrapper) fileUploadWrapper.style.display = 'none';
    });
  }
}
