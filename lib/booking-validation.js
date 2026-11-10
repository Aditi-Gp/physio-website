const SESSION_TYPES = Object.freeze({
  'Initial Consultation': Object.freeze({
    amountINR: 1000,
    label: 'Initial Consultation (60–75 min)',
  }),
  'Follow-up Session': Object.freeze({
    amountINR: 800,
    label: 'Follow-up Session (45–60 min)',
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

  const parsedDate = new Date(`${preferredDate}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(preferredDate)
    || Number.isNaN(parsedDate.getTime())
    || parsedDate.toISOString().slice(0, 10) !== preferredDate
    || preferredDate < new Date().toISOString().slice(0, 10)
  ) {
    return { error: 'Choose a valid date that is not in the past.' };
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
      sessionTypeName: body.sessionType,
      sessionType,
    },
  };
}

module.exports = { SESSION_TYPES, validateBooking };
