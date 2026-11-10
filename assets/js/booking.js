/**
 * booking.js — Form validation, Condition Card sync, Quick Date Selectors,
 * Razorpay Payment, and EmailJS notification.
 *
 * PAYMENT & NOTIFICATION FLOW:
 *   Patient fills form → "Proceed to Payment"
 *     → Razorpay modal opens (amount based on selected tier)
 *       → On payment success:
 *           1. Email to Dr. Anchal  (all booking + payment details)
 *           2. Email to Patient     (booking confirmation receipt)
 *           3. Success card shown on page
 *       → On payment dismiss: form stays open, patient can retry
 *
 * EMAIL SETUP (EmailJS — https://emailjs.com):
 *   1. Sign up at emailjs.com (free: 200 emails/month)
 *   2. Add Email Service: connect your Gmail / Outlook
 *   3. Create TWO email templates (see EMAILJS_CONFIG below for variable names)
 *   4. Copy Public Key, Service ID, and both Template IDs here.
 *
 * ⚠️ SECURITY NOTE (flagged per deny-rules.md):
 *   This is a client-side Razorpay Standard Checkout integration.
 *   The razorpay_payment_id is NOT server-verified here.
 *   For production, verify the signature server-side using HMAC-SHA256
 *   with your Razorpay Key Secret before treating any payment as confirmed.
 */

// ─── Configuration ────────────────────────────────────────────────────────────

export const FORM_CONFIG = {

  // ── EmailJS ───────────────────────────────────────────────────────────────
  // All values from https://dashboard.emailjs.com/
  emailjs: {
    serviceId:           'YOUR_SERVICE_ID',        // e.g. 'service_abc123'
    doctorTemplateId:    'YOUR_DOCTOR_TEMPLATE_ID', // notifies Dr. Anchal
    patientTemplateId:   'YOUR_PATIENT_TEMPLATE_ID',// confirms to patient
    doctorEmail:         'your.email@gmail.com',    // Dr. Anchal's email address
  },

  // ── Razorpay ──────────────────────────────────────────────────────────────
  // Replace with your actual Key ID from https://dashboard.razorpay.com/
  razorpayKeyId: 'rzp_test_TucP6igly7jzXG',

  // ── Pricing (INR) ─────────────────────────────────────────────────────────
  tiers: {
    'Initial Consultation': { amount: 1000, label: 'Initial Consultation (60–75 min)' },
    'Follow-up Session':    { amount: 800, label: 'Follow-up Session (45–60 min)'   },
    default:                { amount: 1000, label: 'Consultation'                     }
  },

  // ── WhatsApp (kept as optional patient action in success card) ────────────
  whatsappNumber: '917042123365'
};

async function _postJson(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error('The booking service returned an invalid response.');
  }

  if (!response.ok) {
    throw new Error(result?.error || 'The booking request could not be completed.');
  }

  return result;
}

// ─── Tier selection tracker ───────────────────────────────────────────────────
let _selectedTierName = 'Initial Consultation';

// ─── Main Init ───────────────────────────────────────────────────────────────

export function initBookingForm() {
  const bookingForm     = document.getElementById('session-booking-form');
  const submitBtn       = bookingForm?.querySelector('.btn-submit-payment');
  const feedbackCard    = document.getElementById('form-feedback-card');
  const feedbackSummary = document.getElementById('feedback-summary-content');
  const feedbackWABtn   = document.getElementById('feedback-whatsapp-btn');
  const bookAgainBtn    = document.getElementById('book-again-btn');
  const issueInput      = document.getElementById('bookIssue');
  const whatsappInput   = document.getElementById('bookWhatsApp');
  const dateInput       = document.getElementById('bookDate');
  const quickDateBtns   = document.querySelectorAll('.quick-date-btn');

  whatsappInput?.addEventListener('input', () => whatsappInput.setCustomValidity(''));

  // ── 1. Quick Date Pills ─────────────────────────────────────────────────
  if (dateInput) {
    const today      = new Date();
    const formatDate = (d) => d.toISOString().split('T')[0];
    dateInput.value  = formatDate(today);
    dateInput.min    = formatDate(today);

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
          if (typeof dateInput.showPicker === 'function') dateInput.showPicker();
        }
      });
    });

    dateInput.addEventListener('change', () => {
      quickDateBtns.forEach((b) => b.classList.remove('active'));
    });
  }

  // ── 2. Condition Cards → auto-select in form ────────────────────────────
  document.querySelectorAll('.condition-box').forEach((box) => {
    box.addEventListener('click', () => {
      const conditionName = box.dataset.condition;
      if (issueInput && conditionName) issueInput.value = conditionName;

      const bookingSection = document.getElementById('book-session');
      if (bookingSection) {
        bookingSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (issueInput) {
          issueInput.style.borderColor = '#0D9488';
          issueInput.style.boxShadow   = '0 0 0 4px rgba(13, 148, 136, 0.2)';
          setTimeout(() => {
            issueInput.style.borderColor = '';
            issueInput.style.boxShadow   = '';
          }, 1000);
        }
      }
    });
  });

  // ── 3. Pricing Tier Buttons → track selected tier ───────────────────────
  document.querySelectorAll('.btn-select-tier').forEach((btn) => {
    btn.addEventListener('click', () => {
      _selectedTierName = btn.dataset.tierName || 'Initial Consultation';

      document.querySelectorAll('.fee-tier-box').forEach((box) => box.classList.remove('selected'));
      btn.closest('.fee-tier-box')?.classList.add('selected');

      const bookingSection = document.getElementById('book-session');
      if (bookingSection) {
        bookingSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        document.getElementById('bookFullName')?.focus();
      }
    });
  });

  if (!bookingForm) return;

  // ── 4. Save booking → Razorpay → Email on success ──────────────────────
  bookingForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const fullName    = document.getElementById('bookFullName')?.value.trim();
    const email       = document.getElementById('bookEmail')?.value.trim();
    const whatsappNumber = whatsappInput?.value.trim();
    const issueDescription = issueInput?.value.trim();
    const sessionDate = document.getElementById('bookDate')?.value;

    if (!fullName || !email || !whatsappNumber || !issueDescription || !sessionDate) {
      alert('Please fill out all fields to proceed with your booking.');
      return;
    }

    const whatsappDigits = whatsappNumber.replace(/\D/g, '');
    if (whatsappDigits.length < 8 || whatsappDigits.length > 15) {
      whatsappInput.setCustomValidity('Enter a valid WhatsApp number.');
      whatsappInput.reportValidity();
      return;
    }
    whatsappInput.setCustomValidity('');

    const tier = FORM_CONFIG.tiers[_selectedTierName];
    if (!tier) {
      alert('Please select a valid consultation type.');
      return;
    }

    const originalButtonText = submitBtn?.textContent;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving booking...';
    }

    try {
      const booking = await _postJson('/api/bookings', {
        fullName,
        email,
        whatsappNumber,
        issueDescription,
        preferredDate: sessionDate,
        sessionType: _selectedTierName
      });

      if (!booking.bookingId) {
        throw new Error('The booking service did not return a booking reference.');
      }

      if (typeof window.Razorpay === 'undefined') {
        throw new Error('Your booking was saved, but payment checkout is unavailable. Please try again later.');
      }

      // The payment reference is persisted after checkout but remains unverified
      // until a server-side Razorpay signature check is configured.
      const options = {
        key:         FORM_CONFIG.razorpayKeyId,
        amount:      tier.amount * 100,
        currency:    'INR',
        name:        'Dr. Anchal Gupta',
        description: tier.label,
        prefill: {
          name:    fullName,
          email:   email,
          contact: whatsappDigits
        },
        notes: { issueDescription, whatsappNumber, preferredDate: sessionDate },
        theme: { color: '#0D5C63' },
        handler: async function (response) {
          const paymentId = response.razorpay_payment_id || 'N/A';
          await _onPaymentSuccess(
            {
              bookingId: booking.bookingId,
              fullName,
              email,
              whatsappNumber,
              issueDescription,
              sessionDate,
              tierLabel: tier.label,
              amountINR: tier.amount,
              paymentId
            },
            feedbackCard,
            feedbackSummary,
            feedbackWABtn,
            bookingForm
          );
        },
        modal: {
          ondismiss: function () {
            console.log('[Razorpay] Payment modal closed by patient.');
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (error) {
      console.error('[Booking] Unable to save booking or open checkout.');
      alert(error instanceof Error ? error.message : 'The booking request could not be completed.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalButtonText;
      }
    }
  });

  // ── 5. Book Again ───────────────────────────────────────────────────────
  if (bookAgainBtn && feedbackCard) {
    bookAgainBtn.addEventListener('click', () => {
      bookingForm.reset();
      feedbackCard.classList.remove('active');
      bookingForm.style.display = '';
      _selectedTierName = 'Initial Consultation';
    });
  }
}

// ─── Post-Payment Success Handler ─────────────────────────────────────────────

async function _onPaymentSuccess(
  { bookingId, fullName, email, whatsappNumber, issueDescription, sessionDate, tierLabel, amountINR, paymentId },
  feedbackCard, feedbackSummary, feedbackWABtn, bookingForm
) {
  const bookedAt   = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
  const amountFmt  = `₹${amountINR.toLocaleString('en-IN')}`;
  const waFallback = _buildWhatsAppUrl({ fullName, email, whatsappNumber, issueDescription, sessionDate, tierLabel, amountFmt, paymentId });

  if (bookingId && paymentId !== 'N/A') {
    try {
      await _postJson(`/api/bookings/${encodeURIComponent(bookingId)}/payment`, { paymentId });
    } catch (error) {
      console.error('[Booking] Unable to save the Razorpay payment reference.');
      alert('Your payment may have succeeded, but its reference could not be saved. Please do not pay again. Contact Dr. Anchal and share your Razorpay payment ID.');
    }
  }

  // 1. Show success card immediately (don't wait for emails)
  _showSuccessCard({ fullName, email, whatsappNumber, issueDescription, sessionDate, tierLabel, amountFmt, paymentId, bookedAt, waFallback },
    feedbackCard, feedbackSummary, feedbackWABtn, bookingForm);

  // 2. Send emails (parallel, fire-and-forget — failure is silent)
  const emailPayload = { fullName, email, whatsappNumber, issueDescription, condition: issueDescription, sessionDate, tierLabel, amountFmt, paymentId, bookedAt };
  await Promise.allSettled([
    _sendDoctorEmail(emailPayload),
    _sendPatientEmail(emailPayload)
  ]).then((results) => {
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.warn(`[EmailJS] Email ${i === 0 ? 'to doctor' : 'to patient'} failed:`, r.reason);
      } else {
        console.log(`[EmailJS] Email ${i === 0 ? 'to doctor' : 'to patient'} sent successfully.`);
      }
    });
  });
}

// ─── EmailJS: Email to Dr. Anchal ─────────────────────────────────────────────
// Template variables used (set these up in your EmailJS template):
//
//   {{to_email}}        → Doctor's email  (set in FORM_CONFIG.emailjs.doctorEmail)
//   {{patient_name}}    → Patient's full name
//   {{patient_email}}   → Patient's email address
//   {{condition}}       → Patient's issue description (kept for existing templates)
//   {{patient_whatsapp}}→ Patient's WhatsApp number
//   {{preferred_date}}  → Requested appointment date
//   {{session_type}}    → Tier label (e.g. "Initial Consultation (60–75 min)")
//   {{amount_paid}}     → Amount (e.g. "₹1,500")
//   {{payment_id}}      → Razorpay payment ID
//   {{booked_at}}       → Timestamp of booking (IST)
//
function _sendDoctorEmail({ fullName, email, whatsappNumber, condition, sessionDate, tierLabel, amountFmt, paymentId, bookedAt }) {
  const cfg = FORM_CONFIG.emailjs;
  if (_isEmailJsPlaceholder()) return Promise.resolve('emailjs not configured');

  return emailjs.send(cfg.serviceId, cfg.doctorTemplateId, {
    to_email:       cfg.doctorEmail,
    patient_name:     fullName,
    patient_email:    email,
    patient_whatsapp: whatsappNumber,
    condition:        condition,
    preferred_date: sessionDate,
    session_type:   tierLabel,
    amount_paid:    amountFmt,
    payment_id:     paymentId,
    booked_at:      bookedAt,
    reply_to:       email          // allows Dr. Anchal to reply directly to patient
  });
}

// ─── EmailJS: Confirmation to Patient ─────────────────────────────────────────
// Template variables used (set these up in your EmailJS template):
//
//   {{to_email}}        → Patient's email
//   {{patient_name}}    → Patient's full name
//   {{condition}}       → Patient's issue description (kept for existing templates)
//   {{patient_whatsapp}}→ Patient's WhatsApp number
//   {{preferred_date}}  → Requested appointment date
//   {{session_type}}    → Tier label
//   {{amount_paid}}     → Amount paid
//   {{payment_id}}      → Razorpay payment ID (their receipt reference)
//   {{booked_at}}       → Timestamp
//   {{doctor_email}}    → Dr. Anchal's email (so patient can reply)
//
function _sendPatientEmail({ fullName, email, whatsappNumber, condition, sessionDate, tierLabel, amountFmt, paymentId, bookedAt }) {
  const cfg = FORM_CONFIG.emailjs;
  if (_isEmailJsPlaceholder()) return Promise.resolve('emailjs not configured');

  return emailjs.send(cfg.serviceId, cfg.patientTemplateId, {
    to_email:       email,
    patient_name:     fullName,
    patient_whatsapp: whatsappNumber,
    condition:        condition,
    preferred_date: sessionDate,
    session_type:   tierLabel,
    amount_paid:    amountFmt,
    payment_id:     paymentId,
    booked_at:      bookedAt,
    doctor_email:   cfg.doctorEmail,
    reply_to:       cfg.doctorEmail  // patient's reply goes to Dr. Anchal
  });
}

// ─── Success Card ─────────────────────────────────────────────────────────────

function _showSuccessCard(
  { fullName, email, whatsappNumber, issueDescription, sessionDate, tierLabel, amountFmt, paymentId, bookedAt, waFallback },
  feedbackCard, feedbackSummary, feedbackWABtn, bookingForm
) {
  if (feedbackSummary) {
    feedbackSummary.innerHTML = `
      <div><strong>Patient:</strong> ${escapeHtml(fullName)}</div>
      <div><strong>Email:</strong> ${escapeHtml(email)}</div>
      <div><strong>WhatsApp:</strong> ${escapeHtml(whatsappNumber)}</div>
      <div><strong>Issue:</strong> ${escapeHtml(issueDescription)}</div>
      <div><strong>Preferred Date:</strong> ${escapeHtml(sessionDate)}</div>
      <div><strong>Session:</strong> ${escapeHtml(tierLabel)}</div>
      <div><strong>Amount Paid:</strong> ${escapeHtml(amountFmt)}</div>
      <div><strong>Payment ID:</strong> <code style="font-size:0.78em;word-break:break-all">${escapeHtml(paymentId)}</code></div>
      <div style="margin-top:0.5rem;font-size:0.82rem;color:var(--text-muted)">
        A confirmation email has been sent to <strong>${escapeHtml(email)}</strong>.<br>
        Dr. Anchal will confirm your slot within a few hours.
      </div>
    `;
  }

  // Keep WhatsApp as a manual fallback in the success card
  if (feedbackWABtn) feedbackWABtn.href = waFallback;

  bookingForm.style.display = 'none';
  if (feedbackCard) feedbackCard.classList.add('active');
}

// ─── WhatsApp Fallback URL (used in success card button only) ─────────────────

function _buildWhatsAppUrl({ fullName, email, whatsappNumber, issueDescription, sessionDate, tierLabel, amountFmt, paymentId }) {
  const msg = [
    '✅ *Payment Confirmed — Booking Request*',
    '────────────────────────────────',
    `👤 *Patient:* ${fullName}`,
    `📧 *Email:* ${email}`,
    `📱 *WhatsApp:* ${whatsappNumber}`,
    `🩺 *Issue:* ${issueDescription}`,
    `📅 *Preferred Date:* ${sessionDate}`,
    `💳 *Session:* ${tierLabel}`,
    `💰 *Amount Paid:* ${amountFmt}`,
    `🔖 *Payment ID:* ${paymentId}`,
    '────────────────────────────────',
    'Sent from DrAnchalGupta.com'
  ].join('\n');

  return `https://wa.me/${FORM_CONFIG.whatsappNumber}?text=${encodeURIComponent(msg)}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _isEmailJsPlaceholder() {
  const { serviceId, doctorTemplateId, patientTemplateId, doctorEmail } = FORM_CONFIG.emailjs;
  return (
    serviceId.startsWith('YOUR_') ||
    doctorTemplateId.startsWith('YOUR_') ||
    patientTemplateId.startsWith('YOUR_') ||
    doctorEmail.includes('your.email')
  );
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#039;');
}
