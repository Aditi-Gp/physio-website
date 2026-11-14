const test = require('node:test');
const assert = require('node:assert/strict');
const { validateBooking } = require('../lib/booking-validation');

const validBooking = {
  fullName: 'Test Patient',
  email: 'patient@example.com',
  whatsappNumber: '+91 98765 43210',
  issueDescription: 'Knee discomfort',
  preferredDate: new Date().toISOString().slice(0, 10),
  sessionType: 'Initial Consultation',
};

test('validates booking data and derives the session price on the server', () => {
  const result = validateBooking(validBooking);

  assert.equal(result.error, undefined);
  assert.equal(result.value.sessionType.amountINR, 1000);
  assert.equal(result.value.sessionTypeName, 'Initial Consultation');
});

test('rejects invalid patient contact, issue, date, and client-selected session types', () => {
  for (const changes of [
    { email: 'invalid' },
    { whatsappNumber: '123' },
    { issueDescription: '' },
    { issueDescription: 'x'.repeat(201) },
    { preferredDate: '2000-01-01' },
    { sessionType: 'Free Consultation' },
  ]) {
    assert.ok(validateBooking({ ...validBooking, ...changes }).error);
  }
});
