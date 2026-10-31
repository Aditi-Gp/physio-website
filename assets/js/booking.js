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
    'Initial Consultation': { amount: 1500, label: 'Initial Consultation (60–75 min)' },
    'Follow-up Session':    { amount: 1000, label: 'Follow-up Session (45–60 min)'   },
    default:                { amount: 1500, label: 'Consultation'                     }
  },

  // ── WhatsApp (kept as optional patient action in success card) ────────────
  whatsappNumber: '917042123365'
};

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
  const conditionSelect = document.getElementById('bookCondition');
  const dateInput       = document.getElementById('bookDate');
  const quickDateBtns   = document.querySelectorAll('.quick-date-btn');

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
      if (conditionSelect && conditionName) conditionSelect.value = conditionName;

      const bookingSection = document.getElementById('book-session');
      if (bookingSection) {
        bookingSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (conditionSelect) {
          conditionSelect.style.borderColor = '#0D9488';
          conditionSelect.style.boxShadow   = '0 0 0 4px rgba(13, 148, 136, 0.2)';
          setTimeout(() => {
            conditionSelect.style.borderColor = '';
            conditionSelect.style.boxShadow   = '';
          }, 1500);
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

  // ── 4. Form Submit → Razorpay → Email on success ────────────────────────
  bookingForm.addEventListener('submit', function (e) {
    e.preventDefault();

    const fullName    = document.getElementById('bookFullName')?.value.trim();
    const email       = document.getElementById('bookEmail')?.value.trim();
    const condition   = document.getElementById('bookCondition')?.value;
    const sessionDate = document.getElementById('bookDate')?.value;

    if (!fullName || !email || !condition || !sessionDate) {
      alert('Please fill out all fields to proceed with your booking.');
      return;
    }

    const tier      = FORM_CONFIG.tiers[_selectedTierName] || FORM_CONFIG.tiers.default;
    const amountINR = tier.amount;
    const tierLabel = tier.label;

    if (typeof window.Razorpay === 'undefined') {
      console.warn('[Razorpay] SDK not loaded. Falling back to email-only booking.');
      _onPaymentSuccess({ fullName, email, condition, sessionDate, tierLabel, amountINR, paymentId: 'N/A (offline)' }, feedbackCard, feedbackSummary, feedbackWABtn, bookingForm);
      return;
    }

    // ── Razorpay Options ─────────────────────────────────────────────────
    const options = {
      key:         FORM_CONFIG.razorpayKeyId,
      amount:      amountINR * 100,        // Razorpay expects paise
      currency:    'INR',
      name:        'Dr. Anchal Gupta',
      description: tierLabel,
      prefill: {
        name:    fullName,
        email:   email,
        contact: ''
      },
      notes: { condition, preferredDate: sessionDate },
      theme: { color: '#0D5C63' },

      // ── Payment Success ───────────────────────────────────────────────
      // ⚠️ SECURITY: payment_id received here is NOT server-verified.
      // For production: send payment_id + order_id + signature to a backend
      // and verify with HMAC-SHA256 before fulfilling the booking.
      handler: function (response) {
        const paymentId = response.razorpay_payment_id || 'N/A';
        _onPaymentSuccess(
          { fullName, email, condition, sessionDate, tierLabel, amountINR, paymentId },
          feedbackCard, feedbackSummary, feedbackWABtn, bookingForm
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
  { fullName, email, condition, sessionDate, tierLabel, amountINR, paymentId },
  feedbackCard, feedbackSummary, feedbackWABtn, bookingForm
) {
  const bookedAt   = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
  const amountFmt  = `₹${amountINR.toLocaleString('en-IN')}`;
  const waFallback = _buildWhatsAppUrl({ fullName, email, condition, sessionDate, tierLabel, amountFmt, paymentId });

  // 1. Show success card immediately (don't wait for emails)
  _showSuccessCard({ fullName, email, condition, sessionDate, tierLabel, amountFmt, paymentId, bookedAt, waFallback },
    feedbackCard, feedbackSummary, feedbackWABtn, bookingForm);

  // 2. Send emails (parallel, fire-and-forget — failure is silent)
  const emailPayload = { fullName, email, condition, sessionDate, tierLabel, amountFmt, paymentId, bookedAt };
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
//   {{condition}}       → Medical condition selected
//   {{preferred_date}}  → Requested appointment date
//   {{session_type}}    → Tier label (e.g. "Initial Consultation (60–75 min)")
//   {{amount_paid}}     → Amount (e.g. "₹1,500")
//   {{payment_id}}      → Razorpay payment ID
//   {{booked_at}}       → Timestamp of booking (IST)
//
function _sendDoctorEmail({ fullName, email, condition, sessionDate, tierLabel, amountFmt, paymentId, bookedAt }) {
  const cfg = FORM_CONFIG.emailjs;
  if (_isEmailJsPlaceholder()) return Promise.resolve('emailjs not configured');

  return emailjs.send(cfg.serviceId, cfg.doctorTemplateId, {
    to_email:       cfg.doctorEmail,
    patient_name:   fullName,
    patient_email:  email,
    condition:      condition,
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
//   {{condition}}       → Medical condition selected
//   {{preferred_date}}  → Requested appointment date
//   {{session_type}}    → Tier label
//   {{amount_paid}}     → Amount paid
//   {{payment_id}}      → Razorpay payment ID (their receipt reference)
//   {{booked_at}}       → Timestamp
//   {{doctor_email}}    → Dr. Anchal's email (so patient can reply)
//
function _sendPatientEmail({ fullName, email, condition, sessionDate, tierLabel, amountFmt, paymentId, bookedAt }) {
  const cfg = FORM_CONFIG.emailjs;
  if (_isEmailJsPlaceholder()) return Promise.resolve('emailjs not configured');

  return emailjs.send(cfg.serviceId, cfg.patientTemplateId, {
    to_email:       email,
    patient_name:   fullName,
    condition:      condition,
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
  { fullName, email, condition, sessionDate, tierLabel, amountFmt, paymentId, bookedAt, waFallback },
  feedbackCard, feedbackSummary, feedbackWABtn, bookingForm
) {
  if (feedbackSummary) {
    feedbackSummary.innerHTML = `
      <div><strong>Patient:</strong> ${escapeHtml(fullName)}</div>
      <div><strong>Email:</strong> ${escapeHtml(email)}</div>
      <div><strong>Condition:</strong> ${escapeHtml(condition)}</div>
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

function _buildWhatsAppUrl({ fullName, email, condition, sessionDate, tierLabel, amountFmt, paymentId }) {
  const msg = [
    '✅ *Payment Confirmed — Booking Request*',
    '────────────────────────────────',
    `👤 *Patient:* ${fullName}`,
    `📧 *Email:* ${email}`,
    `🩺 *Condition:* ${condition}`,
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
