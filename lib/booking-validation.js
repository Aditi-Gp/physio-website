const { VALID_SLOT_LABELS, getISTDateString, getNextSevenDays } = require('./slots');

const SESSION_TYPES = Object.freeze({
  'Initial Consultation': Object.freeze({
    amountINR: 1000,
    label: 'Initial Consultation (50 min)',
  }),
  'Follow-up Session': Object.freeze({
    amountINR: 800,
    label: 'Follow-up Session (50 min)',
  }),
});

function validateBooking(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Booking details are required.' };
  }

  const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const whatsappNumber = typeof body.whatsappNumber === 'string'
    ? body.whatsappNumber.trim()
    : '';
  const issueDescription = typeof body.issueDescription === 'string'
    ? body.issueDescription.trim()
    : '';
  const preferredDate = typeof body.preferredDate === 'string'
    ? body.preferredDate.trim()
    : '';
  const timeSlot = typeof body.timeSlot === 'string' && body.timeSlot.trim()
    ? body.timeSlot.trim()
    : '10:00 AM - 10:50 AM';
  const sessionType = typeof body.sessionType === 'string'
    ? SESSION_TYPES[body.sessionType]
    : null;

  if (!fullName || fullName.length > 120) {
    return { error: 'Enter a name up to 120 characters.' };
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Enter a valid email address.' };
  }
  if (!/^\+?[0-9][0-9\s()-]{7,19}$/.test(whatsappNumber)) {
    return { error: 'Enter a valid WhatsApp number.' };
  }
  const whatsappDigits = whatsappNumber.replace(/\D/g, '');
  if (whatsappDigits.length < 8 || whatsappDigits.length > 15) {
    return { error: 'Enter a valid WhatsApp number.' };
  }
  if (!issueDescription || issueDescription.length > 200) {
    return { error: 'Describe your issue in 200 characters or fewer.' };
  }

  const todayIso = getISTDateString();
  const allowedDates = new Set(getNextSevenDays());
  const parsedDate = new Date(`${preferredDate}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(preferredDate)
    || Number.isNaN(parsedDate.getTime())
    || parsedDate.toISOString().slice(0, 10) !== preferredDate
    || preferredDate < todayIso
    || !allowedDates.has(preferredDate)
  ) {
    return { error: 'Please choose a date within the next 7 days.' };
  }

  if (!VALID_SLOT_LABELS.has(timeSlot)) {
    return { error: 'Please select a valid 50-minute consultation slot between 10:00 AM and 05:00 PM.' };
  }

  if (!sessionType) {
    return { error: 'Choose a valid consultation type.' };
  }

  return {
    value: {
      fullName,
      email,
      whatsappNumber,
      issueDescription,
      preferredDate,
      timeSlot,
      sessionTypeName: body.sessionType,
      sessionType,
    },
  };
}

module.exports = { SESSION_TYPES, validateBooking };
