const { ObjectId } = require('mongodb');
const { getDatabase } = require('../../lib/mongodb');

function isObjectId(value) {
  return typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
}

module.exports = async function reportPaymentFailure(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const bookingId = req.params?.id || req.query?.id;
  if (!isObjectId(bookingId)) {
    return res.status(400).json({ error: 'A valid booking reference is required.' });
  }

  const reason = typeof req.body?.reason === 'string' ? req.body.reason.slice(0, 500) : 'Payment failed';
  const code = typeof req.body?.code === 'string' ? req.body.code.slice(0, 100) : '';

  try {
    const db = await getDatabase();
    const bookings = db.collection('bookings');
    const bookingObjectId = new ObjectId(bookingId);

    await bookings.updateOne(
      { _id: bookingObjectId, status: { $ne: 'paid' } },
      {
        $set: {
          status: 'payment_failed',
          failureReason: reason,
          failureCode: code,
          failedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    return res.status(200).json({ recorded: true });
  } catch (error) {
    if (error.code === 'MONGODB_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'Database not configured.' });
    }
    console.error('Failed to record payment failure:', error);
    return res.status(500).json({ error: 'Could not record payment failure.' });
  }
};
