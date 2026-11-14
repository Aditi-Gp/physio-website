const test = require('node:test');
const assert = require('node:assert/strict');
const {
  STANDARD_SLOTS,
  VALID_SLOT_LABELS,
  getNextSevenDays,
  getISTDateString,
  isValidBookingDate,
  getSlotsForDate,
  isSlotAvailable,
  generateMeetingLink,
} = require('../lib/slots');

test('defines 7 standard 50-minute slots between 10:00 AM and 05:00 PM IST', () => {
  assert.equal(STANDARD_SLOTS.length, 7);
  assert.equal(STANDARD_SLOTS[0].label, '10:00 AM - 10:50 AM');
  assert.equal(STANDARD_SLOTS[0].startTime, '10:00');
  assert.equal(STANDARD_SLOTS[0].endTime, '10:50');
  assert.equal(STANDARD_SLOTS[6].label, '04:00 PM - 04:50 PM');
  assert.equal(STANDARD_SLOTS[6].startTime, '16:00');
  assert.equal(STANDARD_SLOTS[6].endTime, '16:50');
  assert.equal(VALID_SLOT_LABELS.has('10:00 AM - 10:50 AM'), true);
  assert.equal(VALID_SLOT_LABELS.has('05:00 PM - 05:50 PM'), false);
});

test('generates next 7 rolling days in IST and validates date range', () => {
  const dates = getNextSevenDays();
  assert.equal(dates.length, 7);
  assert.equal(isValidBookingDate(dates[0]), true);
  assert.equal(isValidBookingDate(dates[6]), true);
  assert.equal(isValidBookingDate('2000-01-01'), false);
  assert.equal(isValidBookingDate('invalid-date'), false);
});

test('identifies booked and available slots for a date in MongoDB', async () => {
  const tomorrow = getNextSevenDays()[1];
  const mockBookings = [
    { preferredDate: tomorrow, timeSlot: '11:00 AM - 11:50 AM', status: 'paid' },
  ];

  const mockDb = {
    collection: () => ({
      find: () => ({
        toArray: async () => mockBookings,
      }),
    }),
  };

  const slots = await getSlotsForDate(mockDb, tomorrow);
  assert.equal(slots.length, 7);

  const slot10 = slots.find((s) => s.slot === '10:00 AM - 10:50 AM');
  assert.equal(slot10.available, true);

  const slot11 = slots.find((s) => s.slot === '11:00 AM - 11:50 AM');
  assert.equal(slot11.available, false);
  assert.equal(slot11.reason, 'booked');

  const available10 = await isSlotAvailable(mockDb, tomorrow, '10:00 AM - 10:50 AM');
  const available11 = await isSlotAvailable(mockDb, tomorrow, '11:00 AM - 11:50 AM');
  assert.equal(available10, true);
  assert.equal(available11, false);
});

test('does NOT mark slot as booked if payment failed or is pending/awaiting_payment', async () => {
  const tomorrow = getNextSevenDays()[1];
  const allStoredBookings = [
    { preferredDate: tomorrow, timeSlot: '10:00 AM - 10:50 AM', status: 'awaiting_payment', createdAt: new Date() },
    { preferredDate: tomorrow, timeSlot: '11:00 AM - 11:50 AM', status: 'payment_failed', createdAt: new Date() },
    { preferredDate: tomorrow, timeSlot: '12:00 PM - 12:50 PM', status: 'cancelled', createdAt: new Date() },
    { preferredDate: tomorrow, timeSlot: '02:00 PM - 02:50 PM', status: 'paid', createdAt: new Date() },
  ];

  const mockDb = {
    collection: () => ({
      find: (query) => ({
        toArray: async () => allStoredBookings.filter((b) => {
          if (query.preferredDate && b.preferredDate !== query.preferredDate) return false;
          if (query.status && b.status !== query.status) return false;
          return true;
        }),
      }),
    }),
  };

  const slots = await getSlotsForDate(mockDb, tomorrow);

  // 10:00 AM (awaiting_payment) must still be AVAILABLE
  const slot10 = slots.find((s) => s.slot === '10:00 AM - 10:50 AM');
  assert.equal(slot10.available, true);

  // 11:00 AM (payment_failed) must still be AVAILABLE
  const slot11 = slots.find((s) => s.slot === '11:00 AM - 11:50 AM');
  assert.equal(slot11.available, true);

  // 12:00 PM (cancelled) must still be AVAILABLE
  const slot12 = slots.find((s) => s.slot === '12:00 PM - 12:50 PM');
  assert.equal(slot12.available, true);

  // 02:00 PM (paid) must be BOOKED
  const slot02 = slots.find((s) => s.slot === '02:00 PM - 02:50 PM');
  assert.equal(slot02.available, false);
  assert.equal(slot02.reason, 'booked');

  // isSlotAvailable must return true for failed/pending slots
  assert.equal(await isSlotAvailable(mockDb, tomorrow, '10:00 AM - 10:50 AM'), true);
  assert.equal(await isSlotAvailable(mockDb, tomorrow, '11:00 AM - 11:50 AM'), true);
  assert.equal(await isSlotAvailable(mockDb, tomorrow, '02:00 PM - 02:50 PM'), false);
});

test('generates a direct meeting consultation link', () => {
  const link = generateMeetingLink('6af82d8be25e6a1786aebdd9');
  assert.match(link, /^https:\/\/meet\.jit\.si\/DrAnchalGupta-Consult-[a-zA-Z0-9]+$/);
});
