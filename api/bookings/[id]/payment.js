const { ObjectId } = require('mongodb');
const { getDatabase } = require('../../../lib/mongodb');

function readBody(body) {
  if (typeof body !== 'string') return body;
  if (body.length > 2000) return null;

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

module.exports = async function reportPayment(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  if (!hasJsonContentType(req)) {
    return res.status(415).json({ error: 'Content-Type must be application/json.' });
  }

  const bookingId = typeof req.query?.id === 'string' ? req.query.id : '';
  const body = readBody(req.body);
  const paymentId = typeof body?.paymentId === 'string' ? body.paymentId.trim() : '';

  if (!/^[a-f\d]{24}$/i.test(bookingId) || !/^pay_[A-Za-z0-9]{1,120}$/.test(paymentId)) {
    return res.status(400).json({ error: 'A valid booking and payment reference are required.' });
  }

  try {
    const db = await getDatabase();
    const bookings = db.collection('bookings');
    const payments = db.collection('payments');
    const bookingObjectId = new ObjectId(bookingId);
    const booking = await bookings.findOne({ _id: bookingObjectId });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    const existing = await payments.findOne({ bookingId: bookingObjectId });
    if (existing) {
      if (existing.razorpayPaymentId === paymentId) {
        await bookings.updateOne(
          { _id: bookingObjectId },
          { $set: { status: 'payment_reported_unverified', updatedAt: new Date() } }
        );
        return res.status(200).json({ saved: true, verificationStatus: 'unverified' });
      }
      return res.status(409).json({ error: 'A payment reference is already recorded for this booking.' });
    }

    await payments.createIndex({ bookingId: 1 }, { unique: true });
    await payments.createIndex({ razorpayPaymentId: 1 }, { unique: true });
    await payments.insertOne({
      bookingId: bookingObjectId,
      provider: 'razorpay',
      razorpayPaymentId: paymentId,
      expectedAmountPaise: booking.sessionType.expectedAmountINR * 100,
      currency: 'INR',
      verificationStatus: 'unverified_client_report',
      clientReportedAt: new Date(),
    });
    await bookings.updateOne(
      { _id: bookingObjectId },
      { $set: { status: 'payment_reported_unverified', updatedAt: new Date() } }
    );

    return res.status(201).json({ saved: true, verificationStatus: 'unverified' });
  } catch (error) {
    if (error.code === 'MONGODB_NOT_CONFIGURED') {
      console.error('Payment reference could not be saved because MongoDB is not configured.');
      return res.status(503).json({ error: 'Payment storage is not configured.' });
    }
    if (error.code === 11000) {
      return res.status(409).json({ error: 'This payment reference is already recorded.' });
    }

    console.error('Unable to save payment reference to MongoDB.');
    return res.status(503).json({ error: 'Payment reference could not be saved.' });
  }
};
