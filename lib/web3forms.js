/**
 * lib/web3forms.js — Automated Web3Forms notification service.
 * Delivers booking notification emails with all patient details (including patient email ID)
 * directly to Dr. Anchal Gupta upon verified payment.
 */

async function sendBookingNotification({
  fullName,
  email,
  whatsappNumber,
  issueDescription,
  preferredDate,
  timeSlot,
  sessionType,
  amountINR,
  paymentId,
  meetingLink,
}) {
  const apiKey = (process.env.WEB3_FORMS_API_KEY || '').trim();
  if (!apiKey) {
    console.warn('[Web3Forms] WEB3_FORMS_API_KEY is not configured on the server.');
    return { success: false, reason: 'missing_key' };
  }

  const cleanPhone = String(whatsappNumber || '').replace(/\D/g, '');
  const amountFormatted = `₹${Number(amountINR || 0).toLocaleString('en-IN')}`;

  const payload = {
    access_key: apiKey,
    subject: `🚨 New Paid Consultation: ${fullName} (${email}) - ${preferredDate} [${timeSlot}]`,
    from_name: 'Dr. Anchal Gupta Consultations',
    name: fullName,
    email: email, // Sets patient email ID as the submitter email
    replyto: email, // Allows Dr. Anchal to reply directly to the patient's email
    'Patient Full Name': fullName,
    'Patient Email ID': email,
    'Patient WhatsApp / Phone': whatsappNumber,
    'Medical Issue / Condition': issueDescription,
    'Consultation Date': preferredDate,
    'Scheduled Time Slot': `${timeSlot} (50 Minutes IST)`,
    'Session Type': sessionType,
    'Amount Paid': amountFormatted,
    'Razorpay Payment ID': paymentId,
    'Video Meeting Link': meetingLink,
    message: [
      `A new 50-minute physiotherapy session has been confirmed and paid.`,
      ``,
      `--- PATIENT INFORMATION ---`,
      `Patient Name: ${fullName}`,
      `Patient Email ID: ${email}`,
      `Patient WhatsApp: +91 ${cleanPhone}`,
      `Issue / Medical Description: ${issueDescription}`,
      ``,
      `--- APPOINTMENT DETAILS ---`,
      `Date: ${preferredDate}`,
      `Time Slot: ${timeSlot} (50 Minutes IST)`,
      `Session Type: ${sessionType}`,
      `Amount Paid: ${amountFormatted}`,
      `Payment ID: ${paymentId}`,
      `Meeting Link: ${meetingLink}`,
      ``,
      `Please contact the patient via WhatsApp at +91 ${cleanPhone} or reply to this email at ${email} at the scheduled time.`,
    ].join('\n'),
  };

  try {
    const response = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (data.success) {
      console.log(`[Web3Forms] Successfully delivered booking notification to Dr. Anchal Gupta for patient ${email}.`);
      return { success: true };
    }

    console.warn('[Web3Forms] API returned error:', data.message);
    return { success: false, reason: data.message };
  } catch (error) {
    console.error('[Web3Forms] Failed to send email via Web3Forms:', error);
    return { success: false, reason: error.message };
  }
}

module.exports = { sendBookingNotification };
