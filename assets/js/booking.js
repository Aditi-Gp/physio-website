/**
 * booking.js — Form validation, Condition Card sync, 50-minute Slot Selection,
 * Quick Date Selectors, Razorpay Payment, and Web3Forms/EmailJS notifications.
 *
 * WORKFLOW:
 *   1. Patient chooses date (next 7 days) and selects available 50-minute slot (10am–5pm IST)
 *   2. On submit, server verifies slot availability and stores booking in MongoDB
 *   3. Razorpay payment checkout modal opens
 *   4. On success, payment signature is verified, slot is locked as paid, and meeting link is generated
 *   5. Web3Forms sends the meeting link and booking details directly to Dr. Anchal Gupta
 */

// ─── Configuration ────────────────────────────────────────────────────────────

export const FORM_CONFIG = {
  emailjs: window.PHYSIO_CONFIG?.emailjs || {},
  tiers: {
    'Initial Consultation': { amount: 1000, label: 'Initial Consultation (50 min)' },
    'Follow-up Session':    { amount: 800, label: 'Follow-up Session (50 min)'   },
    default:                { amount: 1000, label: 'Consultation (50 min)'        }
  },
  whatsappNumber: '917042123365'
};

async function _postJson(url, payload) {
  const apiBaseUrl = window.PHYSIO_CONFIG?.apiBaseUrl || '';
  const response = await fetch(`${apiBaseUrl}${url}`, {
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

let _selectedTierName = 'Initial Consultation';
let _selectedSlot = '';

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

  // Ensure Web3Forms key is loaded for client notifications
  _ensureWeb3FormsKey();

  // ── 1. Date Picker & Quick Date Pills ────────────────────────────────────
  if (dateInput) {
    _setupDateLimitsAndSlots(dateInput, quickDateBtns);
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

  // ── 3. Pricing Tier Buttons ─────────────────────────────────────────────
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

  // ── 4. Submit: Validate slot, Save Booking → Razorpay → Verification ───
  bookingForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const fullName       = document.getElementById('bookFullName')?.value.trim();
    const email          = document.getElementById('bookEmail')?.value.trim();
    const whatsappNumber = whatsappInput?.value.trim();
    const issueDescription = issueInput?.value.trim();
    const sessionDate    = dateInput?.value;
    const timeSlot       = document.getElementById('bookTimeSlot')?.value || _selectedSlot;

    if (!fullName || !email || !whatsappNumber || !issueDescription || !sessionDate) {
      alert('Please fill out all patient fields to proceed.');
      return;
    }

    if (!timeSlot) {
      alert('Please select an available 50-minute time slot for your consultation.');
      document.getElementById('slots-grid')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
      submitBtn.textContent = 'Securing time slot...';
    }

    try {
      const booking = await _postJson('/api/bookings', {
        fullName,
        email,
        whatsappNumber,
        issueDescription,
        preferredDate: sessionDate,
        timeSlot,
        sessionType: _selectedTierName,
      });

      if (!booking.bookingId) {
        throw new Error('The booking service did not return a booking reference.');
      }

      if (submitBtn) submitBtn.textContent = 'Opening payment...';

      const order = await _postJson(
        `/api/bookings/${encodeURIComponent(booking.bookingId)}/order`,
        {}
      );

      if (typeof window.Razorpay === 'undefined') {
        await new Promise((resolve) => {
          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.onload = () => resolve();
          script.onerror = () => resolve();
          document.head.appendChild(script);
        });
      }

      if (typeof window.Razorpay === 'undefined') {
        throw new Error('Payment checkout is unavailable. Please check your internet connection or ad-blocker.');
      }

      const options = {
        key:         order.keyId,
        amount:      order.amount,
        currency:    order.currency,
        order_id:    order.orderId,
        name:        'Dr. Anchal Gupta',
        description: order.description,
        prefill: {
          name:    fullName,
          email:   email,
          contact: whatsappDigits,
        },
        theme: { color: '#0D5C63' },
        handler: async function (response) {
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Confirming booking...';
          }
          try {
            await _onPaymentSuccess(
              {
                bookingId: booking.bookingId,
                fullName,
                email,
                whatsappNumber,
                issueDescription,
                sessionDate,
                timeSlot,
                tierLabel: order.description,
                amountINR: order.amount / 100,
                paymentId: response.razorpay_payment_id,
                orderId: response.razorpay_order_id,
                signature: response.razorpay_signature,
              },
              feedbackCard,
              feedbackSummary,
              feedbackWABtn,
              bookingForm
            );
          } catch (error) {
            console.error('[Booking] Razorpay payment was not verified:', error);
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = originalButtonText;
            }
            alert(error instanceof Error
              ? error.message
              : 'Payment verification failed. Please contact support before retrying.');
            if (dateInput?.value) _loadSlotsForDate(dateInput.value);
          }
        },
        modal: {
          ondismiss: function () {
            console.log('[Razorpay] Payment modal closed by patient.');
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = originalButtonText;
            }
            if (dateInput?.value) _loadSlotsForDate(dateInput.value);
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (resp) {
        console.warn('[Razorpay] Payment failed:', resp?.error);
        const reason = resp?.error?.description || 'Payment was unsuccessful or declined by your bank.';
        alert(`Payment failed: ${reason}\n\nYour slot has not been booked. You can select the slot and try again.`);
        _postJson(`/api/bookings/${encodeURIComponent(booking.bookingId)}/fail`, {
          reason,
          code: resp?.error?.code,
          paymentId: resp?.error?.metadata?.payment_id,
        }).catch(() => {});
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalButtonText;
        }
        if (dateInput?.value) _loadSlotsForDate(dateInput.value);
      });
      rzp.open();
    } catch (error) {
      console.error('[Booking] Booking failed:', error);
      alert(error instanceof Error ? error.message : 'The booking request could not be completed.');
      // Refresh slots in case the selected slot was taken
      if (dateInput?.value) _loadSlotsForDate(dateInput.value);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalButtonText;
      }
    }
  });

  // ── 5. Book Another Slot ────────────────────────────────────────────────
  if (bookAgainBtn && feedbackCard) {
    bookAgainBtn.addEventListener('click', () => {
      bookingForm.reset();
      feedbackCard.classList.remove('active');
      bookingForm.style.display = '';
      _selectedTierName = 'Initial Consultation';
      _selectedSlot = '';
      if (dateInput) _setupDateLimitsAndSlots(dateInput, quickDateBtns);
    });
  }
}

// ─── Slot Management ─────────────────────────────────────────────────────────

function _setupDateLimitsAndSlots(dateInput, quickDateBtns) {
  const now = new Date();
  const formatISO = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);

  const todayStr = formatISO(now);
  const maxDate = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000);
  const maxStr = formatISO(maxDate);

  dateInput.min = todayStr;
  dateInput.max = maxStr;
  if (!dateInput.value || dateInput.value < todayStr || dateInput.value > maxStr) {
    dateInput.value = todayStr;
  }

  _loadSlotsForDate(dateInput.value);

  quickDateBtns?.forEach((btn) => {
    btn.addEventListener('click', () => {
      quickDateBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const offset = btn.dataset.offset;
      if (offset === '0') {
        dateInput.value = todayStr;
      } else if (offset === '1') {
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        dateInput.value = formatISO(tomorrow);
      } else if (offset === 'custom') {
        dateInput.focus();
        if (typeof dateInput.showPicker === 'function') dateInput.showPicker();
      }
      _loadSlotsForDate(dateInput.value);
    });
  });

  dateInput.addEventListener('change', () => {
    if (dateInput.value < todayStr) dateInput.value = todayStr;
    if (dateInput.value > maxStr) dateInput.value = maxStr;
    quickDateBtns?.forEach((b) => b.classList.remove('active'));
    _loadSlotsForDate(dateInput.value);
  });
}

async function _loadSlotsForDate(dateStr) {
  const slotsGrid = document.getElementById('slots-grid');
  const timeSlotInput = document.getElementById('bookTimeSlot');
  const helpText = document.getElementById('slots-help-text');
  if (!slotsGrid) return;

  slotsGrid.innerHTML = '<div class="slots-loading-placeholder">Checking available slots...</div>';
  if (helpText) helpText.textContent = '';
  if (timeSlotInput) timeSlotInput.value = '';
  _selectedSlot = '';

  const apiBaseUrl = window.PHYSIO_CONFIG?.apiBaseUrl || '';
  try {
    const res = await fetch(`${apiBaseUrl}/api/slots?date=${encodeURIComponent(dateStr)}&_t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    });
    if (!res.ok) throw new Error('Could not load slots');
    const data = await res.json();

    slotsGrid.innerHTML = '';
    let hasAvailable = false;

    data.slots.forEach((s) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `slot-btn${s.available ? '' : ' is-unavailable'}`;
      btn.dataset.slot = s.slot;

      if (!s.available) {
        btn.disabled = true;
        const tag = s.reason === 'booked' ? 'Booked' : 'Passed';
        btn.innerHTML = `<span>${s.slot}</span><span class="slot-status-tag" style="color:#94A3B8;">(${tag})</span>`;
      } else {
        hasAvailable = true;
        btn.innerHTML = `<span>${s.slot}</span><span class="slot-status-tag" style="color:var(--primary-teal);">Available (50 min)</span>`;
        btn.addEventListener('click', () => {
          document.querySelectorAll('.slot-btn').forEach((b) => b.classList.remove('is-selected'));
          btn.classList.add('is-selected');
          _selectedSlot = s.slot;
          if (timeSlotInput) timeSlotInput.value = s.slot;
          if (helpText) {
            helpText.innerHTML = `<span style="color:var(--primary-teal);font-weight:600;">✓ Selected:</span> ${s.slot} on ${dateStr}`;
          }
        });
      }
      slotsGrid.appendChild(btn);
    });

    if (!hasAvailable && helpText) {
      helpText.innerHTML = '<span style="color:#DC2626;font-weight:600;">All slots for this day are booked or have passed. Please select another date.</span>';
    }
  } catch (err) {
    console.error('Failed to load slots:', err);
    slotsGrid.innerHTML = '<div class="slots-loading-placeholder" style="color:#DC2626;">Unable to load slots. Please refresh the page.</div>';
  }
}

// ─── Post-Payment Success Handler ─────────────────────────────────────────────

async function _onPaymentSuccess(
  { bookingId, fullName, email, whatsappNumber, issueDescription, sessionDate, timeSlot, tierLabel, amountINR, paymentId, orderId, signature },
  feedbackCard, feedbackSummary, feedbackWABtn, bookingForm
) {
  const bookedAt   = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
  const amountFmt  = `₹${amountINR.toLocaleString('en-IN')}`;
  const waFallback = _buildWhatsAppUrl({ fullName, email, whatsappNumber, issueDescription, sessionDate, timeSlot, tierLabel, amountFmt, paymentId });

  const verification = await _postJson(
    `/api/bookings/${encodeURIComponent(bookingId)}/payment`,
    { paymentId, orderId, signature }
  );

  if (verification.verificationStatus !== 'verified' || verification.verified !== true) {
    throw new Error('Payment could not be verified. Please contact support before retrying.');
  }

  const meetingLink = verification.meetingLink || `https://meet.jit.si/DrAnchalGupta-Consult-${bookingId.slice(-6)}`;

  // 1. Show confirmed booking card
  _showSuccessCard({
    fullName,
    email,
    whatsappNumber,
    issueDescription,
    sessionDate,
    timeSlot,
    tierLabel,
    amountFmt,
    paymentId,
    bookedAt,
    waFallback,
    meetingLink,
  }, feedbackCard, feedbackSummary, feedbackWABtn, bookingForm);

  // 2. Send notification to doctor via Web3Forms (using WEB3_FORMS_API_KEY)
  const notificationPayload = {
    fullName,
    email,
    whatsappNumber,
    issueDescription,
    condition: issueDescription,
    sessionDate,
    timeSlot,
    tierLabel,
    amountFmt,
    paymentId,
    bookedAt,
    meetingLink,
  };

  _sendWeb3FormsNotification(notificationPayload);

  // 3. Send emails via EmailJS in parallel
  Promise.allSettled([
    _sendDoctorEmail(notificationPayload),
    _sendPatientEmail(notificationPayload),
  ]).catch(() => {});
}

// ─── Web3Forms Notification to Doctor ────────────────────────────────────────

async function _sendWeb3FormsNotification({
  fullName,
  email,
  whatsappNumber,
  issueDescription,
  sessionDate,
  timeSlot,
  tierLabel,
  amountFmt,
  paymentId,
  meetingLink,
}) {
  const key = window.PHYSIO_CONFIG?.web3FormsKey || await _ensureWeb3FormsKey();
  if (!key) {
    console.warn('[Web3Forms] API key is not configured.');
    return;
  }

  try {
    const response = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        access_key: key,
        subject: `🚨 New Paid Consultation: ${fullName} (${email}) - ${sessionDate} [${timeSlot}]`,
        from_name: 'Dr. Anchal Gupta Consultations',
        name: fullName,
        email: email, // Patient Email ID sets the submitter and reply-to in doctor's inbox
        replyto: email,
        'Patient Full Name': fullName,
        'Patient Email ID': email,
        'Patient WhatsApp / Phone': whatsappNumber,
        'Medical Issue / Condition': issueDescription,
        'Consultation Date': sessionDate,
        'Scheduled Time Slot': `${timeSlot} (50 Minutes IST)`,
        'Session Type': tierLabel,
        'Amount Paid': amountFmt,
        'Razorpay Payment ID': paymentId,
        'Video Meeting Link': meetingLink,
        message: [
          `A new 50-minute physiotherapy session has been confirmed and paid.`,
          ``,
          `--- PATIENT INFORMATION ---`,
          `Patient Name: ${fullName}`,
          `Patient Email ID: ${email}`,
          `Patient WhatsApp: +91 ${String(whatsappNumber).replace(/\D/g, '')}`,
          `Issue / Condition: ${issueDescription}`,
          ``,
          `--- APPOINTMENT DETAILS ---`,
          `Date: ${sessionDate}`,
          `Time Slot: ${timeSlot} (50 Minutes IST)`,
          `Session Type: ${tierLabel}`,
          `Amount Paid: ${amountFmt}`,
          `Payment ID: ${paymentId}`,
          `Meeting Link: ${meetingLink}`,
          ``,
          `Please contact the patient via WhatsApp or reply to this email at ${email} at the scheduled time.`,
        ].join('\n'),
      }),
    });

    const data = await response.json();
    if (data.success) {
      console.log('[Web3Forms] Notification sent to doctor successfully.');
    } else {
      console.warn('[Web3Forms] Submission status:', data.message);
    }
  } catch (err) {
    console.warn('[Web3Forms] Could not send notification:', err.message);
  }
}

async function _ensureWeb3FormsKey() {
  if (window.PHYSIO_CONFIG?.web3FormsKey) return window.PHYSIO_CONFIG.web3FormsKey;
  try {
    const apiBaseUrl = window.PHYSIO_CONFIG?.apiBaseUrl || '';
    const res = await fetch(`${apiBaseUrl}/api/config`);
    if (res.ok) {
      const data = await res.json();
      if (data.web3FormsKey) {
        window.PHYSIO_CONFIG = { ...window.PHYSIO_CONFIG, web3FormsKey: data.web3FormsKey };
        return data.web3FormsKey;
      }
    }
  } catch {}
  return '';
}

// ─── EmailJS: Optional Backup Notifications ──────────────────────────────────

function _sendDoctorEmail({ fullName, email, whatsappNumber, condition, sessionDate, timeSlot, tierLabel, amountFmt, paymentId, bookedAt, meetingLink }) {
  const cfg = FORM_CONFIG.emailjs;
  if (_isEmailJsPlaceholder()) return Promise.resolve('emailjs not configured');

  return emailjs.send(cfg.serviceId, cfg.doctorTemplateId, {
    to_email:       cfg.doctorEmail,
    patient_name:     fullName,
    patient_email:    email,
    patient_whatsapp: whatsappNumber,
    condition:        condition,
    preferred_date: `${sessionDate} at ${timeSlot}`,
    session_type:   `${tierLabel} (50 min)`,
    amount_paid:    amountFmt,
    payment_id:     paymentId,
    booked_at:      bookedAt,
    meeting_link:   meetingLink,
    reply_to:       email,
  });
}

function _sendPatientEmail({ fullName, email, whatsappNumber, condition, sessionDate, timeSlot, tierLabel, amountFmt, paymentId, bookedAt }) {
  const cfg = FORM_CONFIG.emailjs;
  if (_isEmailJsPlaceholder()) return Promise.resolve('emailjs not configured');

  return emailjs.send(cfg.serviceId, cfg.patientTemplateId, {
    to_email:       email,
    patient_name:     fullName,
    patient_whatsapp: whatsappNumber,
    condition:        condition,
    preferred_date: `${sessionDate} at ${timeSlot}`,
    session_type:   `${tierLabel} (50 min)`,
    amount_paid:    amountFmt,
    payment_id:     paymentId,
    booked_at:      bookedAt,
    doctor_email:   cfg.doctorEmail,
    reply_to:       cfg.doctorEmail,
  });
}

// ─── Success Card ─────────────────────────────────────────────────────────────

function _showSuccessCard(
  { fullName, email, whatsappNumber, issueDescription, sessionDate, timeSlot, tierLabel, amountFmt, paymentId, bookedAt, waFallback, meetingLink },
  feedbackCard, feedbackSummary, feedbackWABtn, bookingForm
) {
  if (feedbackSummary) {
    feedbackSummary.innerHTML = `
      <div><strong>Patient:</strong> ${escapeHtml(fullName)}</div>
      <div><strong>WhatsApp:</strong> ${escapeHtml(whatsappNumber)}</div>
      <div><strong>Email:</strong> ${escapeHtml(email)}</div>
      <div><strong>Issue:</strong> ${escapeHtml(issueDescription)}</div>
      <div><strong>Booked Session:</strong> ${escapeHtml(sessionDate)} at <span style="color:var(--primary-teal);font-weight:700;">${escapeHtml(timeSlot)} (50 min)</span></div>
      <div><strong>Session Type:</strong> ${escapeHtml(tierLabel)}</div>
      <div><strong>Amount Paid:</strong> ${escapeHtml(amountFmt)}</div>
      <div><strong>Payment ID:</strong> <code style="font-size:0.78em;word-break:break-all">${escapeHtml(paymentId)}</code></div>
      <div style="margin-top:0.75rem;padding:0.85rem;background:#E8F5F6;border-radius:6px;font-size:0.86rem;color:var(--accent);text-align:left;line-height:1.45;">
        <strong>✓ 50-Minute Slot Confirmed:</strong> Your consultation is confirmed and locked. The video meeting link has been shared directly with Dr. Anchal Gupta. She will contact you directly on WhatsApp (+91 ${escapeHtml(whatsappNumber.replace(/\D/g, ''))}) at your scheduled time.
      </div>
    `;
  }

  if (feedbackWABtn) feedbackWABtn.href = waFallback;

  bookingForm.style.display = 'none';
  if (feedbackCard) {
    feedbackCard.classList.add('active');
    feedbackCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// ─── WhatsApp Fallback URL ───────────────────────────────────────────────────

function _buildWhatsAppUrl({ fullName, email, whatsappNumber, issueDescription, sessionDate, timeSlot, tierLabel, amountFmt, paymentId }) {
  const msg = [
    '✅ *Payment Confirmed — Consultation Slot Booked*',
    '────────────────────────────────',
    `👤 *Patient:* ${fullName}`,
    `📧 *Email:* ${email}`,
    `📱 *WhatsApp:* ${whatsappNumber}`,
    `🩺 *Issue:* ${issueDescription}`,
    `📅 *Date:* ${sessionDate}`,
    `⏰ *Time Slot:* ${timeSlot} (50 min)`,
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
    typeof serviceId !== 'string' || !serviceId ||
    typeof doctorTemplateId !== 'string' || !doctorTemplateId ||
    typeof patientTemplateId !== 'string' || !patientTemplateId ||
    typeof doctorEmail !== 'string' || !doctorEmail
  );
}

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
