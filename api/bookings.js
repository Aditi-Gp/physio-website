const { getDatabase } = require('../lib/mongodb');
const { validateBooking } = require('../lib/booking-validation');

function readBody(body) {
  if (typeof body !== 'string') return body;
  if (body.length > 10000) return null;

  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function hasJsonContentType(req) {
  const contentType = req.headers?.['content-type'];
  return typeof contentType === 'string'
    && contentType.split(';', 1)[0].trim().toLowerCase() === 'application/json';
}

module.exports = async function createBooking(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  if (!hasJsonContentType(req)) {
    return res.status(415).json({ error: 'Content-Type must be application/json.' });
  }

  const result = validateBooking(readBody(req.body));
  if (result.error) {
    return res.status(400).json({ error: result.error });
  }

  try {
    const db = await getDatabase();
    const now = new Date();
    const {
      fullName,
      email,
      whatsappNumber,
      issueDescription,
      preferredDate,
      sessionTypeName,
      sessionType,
    } = result.value;
    const inserted = await db.collection('bookings').insertOne({
      patient: { fullName, email, whatsappNumber },
      issueDescription,
      preferredDate,
      sessionType: {
        name: sessionTypeName,
        label: sessionType.label,
        expectedAmountINR: sessionType.amountINR,
      },
      status: 'awaiting_payment',
      createdAt: now,
      updatedAt: now,
    });

    return res.status(201).json({ bookingId: inserted.insertedId.toString() });
  } catch (error) {
    if (error.code === 'MONGODB_NOT_CONFIGURED') {
      console.error('Booking could not be saved because MongoDB is not configured.');
      return res.status(503).json({ error: 'Booking storage is not configured. Please try again later.' });
    }

    console.error('Unable to save booking to MongoDB.');
    return res.status(503).json({ error: 'Booking could not be saved. Please try again.' });
  }
};
