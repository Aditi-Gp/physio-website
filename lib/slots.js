const STANDARD_SLOTS = Object.freeze([
  { label: '10:00 AM - 10:50 AM', startTime: '10:00', endTime: '10:50' },
  { label: '11:00 AM - 11:50 AM', startTime: '11:00', endTime: '11:50' },
  { label: '12:00 PM - 12:50 PM', startTime: '12:00', endTime: '12:50' },
  { label: '01:00 PM - 01:50 PM', startTime: '13:00', endTime: '13:50' },
  { label: '02:00 PM - 02:50 PM', startTime: '14:00', endTime: '14:50' },
  { label: '03:00 PM - 03:50 PM', startTime: '15:00', endTime: '15:50' },
  { label: '04:00 PM - 04:50 PM', startTime: '16:00', endTime: '16:50' },
]);

const VALID_SLOT_LABELS = new Set(STANDARD_SLOTS.map((s) => s.label));

function getISTDateString(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function getISTTimeString(date = new Date()) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function getNextSevenDays(startDate = new Date()) {
  const dates = [];
  const baseTime = startDate.getTime();
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(baseTime + i * 24 * 60 * 60 * 1000);
    dates.push(getISTDateString(d));
  }
  return dates;
}

/**
 * Checks whether a date string is in the valid 1-week window [today, today + 6 days] in IST.
 */
function isValidBookingDate(dateStr) {
  if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false;
  }
  const allowed = getNextSevenDays();
  return allowed.includes(dateStr);
}

/**
 * Retrieves the slot availability for a specified date from MongoDB.
 */
async function getSlotsForDate(db, dateStr) {
  const todayIST = getISTDateString();
  const currentISTTime = getISTTimeString();
  const isToday = dateStr === todayIST;

  // Only completed, verified paid bookings lock the slot.
  // Unpaid, pending, or failed checkout attempts NEVER lock the slot.
  const bookings = await db.collection('bookings').find({
    preferredDate: dateStr,
    status: 'paid',
  }).toArray();

  const bookedSlots = new Set(bookings.map((b) => b.timeSlot).filter(Boolean));

  return STANDARD_SLOTS.map((slot) => {
    if (bookedSlots.has(slot.label)) {
      return {
        slot: slot.label,
        startTime: slot.startTime,
        endTime: slot.endTime,
        available: false,
        reason: 'booked',
      };
    }

    if (isToday && currentISTTime >= slot.startTime) {
      return {
        slot: slot.label,
        startTime: slot.startTime,
        endTime: slot.endTime,
        available: false,
        reason: 'past',
      };
    }

    return {
      slot: slot.label,
      startTime: slot.startTime,
      endTime: slot.endTime,
      available: true,
    };
  });
}

/**
 * Determines whether a specific slot is available for booking.
 */
async function isSlotAvailable(db, dateStr, slotLabel) {
  if (!VALID_SLOT_LABELS.has(slotLabel)) {
    return false;
  }
  if (!isValidBookingDate(dateStr)) {
    return false;
  }

  const slots = await getSlotsForDate(db, dateStr);
  const match = slots.find((s) => s.slot === slotLabel);
  return Boolean(match?.available);
}

/**
 * Generates a direct video consultation room link.
 */
function generateMeetingLink(bookingId) {
  const idSuffix = String(bookingId || '').replace(/[^a-zA-Z0-9]/g, '').slice(-8) || 'session';
  return `https://meet.jit.si/DrAnchalGupta-Consult-${idSuffix}`;
}

module.exports = {
  STANDARD_SLOTS,
  VALID_SLOT_LABELS,
  getISTDateString,
  getISTTimeString,
  getNextSevenDays,
  isValidBookingDate,
  getSlotsForDate,
  isSlotAvailable,
  generateMeetingLink,
};
