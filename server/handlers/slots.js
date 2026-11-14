const { getDatabase } = require('../../lib/mongodb');
const {
  getSlotsForDate,
  getNextSevenDays,
  getISTDateString,
  isValidBookingDate,
} = require('../../lib/slots');

module.exports = async function getSlotsHandler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const todayIST = getISTDateString();
  const dateQuery = typeof req.query?.date === 'string' ? req.query.date.trim() : todayIST;

  if (!isValidBookingDate(dateQuery)) {
    return res.status(400).json({
      error: 'Please specify a date within the next 7 days (YYYY-MM-DD).',
      availableDates: getNextSevenDays(),
    });
  }

  try {
    const db = await getDatabase();
    const slots = await getSlotsForDate(db, dateQuery);

    return res.status(200).json({
      date: dateQuery,
      today: todayIST,
      availableDates: getNextSevenDays(),
      slots,
    });
  } catch (error) {
    console.error('Error fetching slots from MongoDB:', error);
    return res.status(500).json({ error: 'Unable to retrieve available slots at this time.' });
  }
};
