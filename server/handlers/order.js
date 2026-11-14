const crypto = require('node:crypto');
const { ObjectId } = require('mongodb');
const { getDatabase } = require('../../lib/mongodb');
const { getCredentials, razorpayRequest } = require('../../lib/razorpay');

function isObjectId(value) {
  return typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
}

async function ensurePaymentIndexes(payments) {
  await Promise.all([
    payments.createIndex({ razorpayOrderId: 1 }, { unique: true, sparse: true }),
    payments.createIndex({ razorpayPaymentId: 1 }, { unique: true, sparse: true }),
    payments.createIndex({ bookingId: 1, createdAt: -1 }),
  ]);
}

module.exports = async function createOrder(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const bookingId = req.params?.id;
  if (!isObjectId(bookingId)) {
    return res.status(400).json({ error: 'A valid booking reference is required.' });
  }

  try {
    const { keyId } = getCredentials();
    const db = await getDatabase();
    const bookings = db.collection('bookings');
    const payments = db.collection('payments');
    const bookingObjectId = new ObjectId(bookingId);
    const booking = await bookings.findOne({ _id: bookingObjectId });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }
    if (booking.status === 'paid' || booking.status === 'payment_reported_unverified') {
      return res.status(409).json({
        error: 'This booking has a payment already recorded. Contact support before attempting another payment.',
      });
    }

    await ensurePaymentIndexes(payments);
    const pendingOrder = await payments.findOne({
      bookingId: bookingObjectId,
      verificationStatus: 'order_created',
    }, { sort: { createdAt: -1 } });

    if (pendingOrder) {
      return res.status(200).json({
        keyId,
        orderId: pendingOrder.razorpayOrderId,
        amount: pendingOrder.expectedAmountPaise,
        currency: pendingOrder.currency,
        description: booking.sessionType.label,
      });
    }

    const verifiedPayment = await payments.findOne({
      bookingId: bookingObjectId,
      verificationStatus: 'verified',
    });
    if (verifiedPayment) {
      return res.status(409).json({
        error: 'This booking has a payment already recorded. Contact support before attempting another payment.',
      });
    }

    const lockToken = crypto.randomUUID();
    const now = new Date();
    const lock = await bookings.updateOne({
      _id: bookingObjectId,
      status: { $nin: ['paid', 'payment_reported_unverified'] },
      $or: [
        { paymentOrderLockUntil: { $exists: false } },
        { paymentOrderLockUntil: { $lt: now } },
      ],
    }, {
      $set: {
        paymentOrderLockToken: lockToken,
        paymentOrderLockUntil: new Date(now.getTime() + 60_000),
      },
    });

    if (lock.matchedCount !== 1) {
      const currentPendingOrder = await payments.findOne({
        bookingId: bookingObjectId,
        verificationStatus: 'order_created',
      });
      if (currentPendingOrder) {
        return res.status(200).json({
          keyId,
          orderId: currentPendingOrder.razorpayOrderId,
          amount: currentPendingOrder.expectedAmountPaise,
          currency: currentPendingOrder.currency,
          description: booking.sessionType.label,
        });
      }

      return res.status(409).json({ error: 'Payment checkout is already being prepared. Please retry shortly.' });
    }

    const amount = booking.sessionType.expectedAmountINR * 100;
    try {
      const order = await razorpayRequest('orders', {
        method: 'POST',
        body: {
          amount,
          currency: 'INR',
          receipt: bookingId,
          notes: { bookingId },
        },
      });

      if (
        typeof order.id !== 'string'
        || order.amount !== amount
        || order.currency !== 'INR'
        || order.status !== 'created'
      ) {
        console.error('Razorpay order response did not match the stored booking.');
        return res.status(502).json({ error: 'Payment checkout could not be prepared.' });
      }

      await payments.insertOne({
        bookingId: bookingObjectId,
        provider: 'razorpay',
        razorpayOrderId: order.id,
        expectedAmountPaise: amount,
        currency: 'INR',
        verificationStatus: 'order_created',
        createdAt: now,
        updatedAt: now,
      });

      return res.status(201).json({
        keyId,
        orderId: order.id,
        amount,
        currency: 'INR',
        description: booking.sessionType.label,
      });
    } finally {
      await bookings.updateOne(
        { _id: bookingObjectId, paymentOrderLockToken: lockToken },
        { $unset: { paymentOrderLockToken: '', paymentOrderLockUntil: '' } }
      );
    }
  } catch (error) {
    if (error.code === 'MONGODB_NOT_CONFIGURED') {
      console.error('Razorpay order could not be saved because MongoDB is not configured.');
      return res.status(503).json({ error: 'Payment storage is not configured.' });
    }
    if (error.code === 'RAZORPAY_NOT_CONFIGURED') {
      console.error('Razorpay order could not be created because Razorpay is not configured.');
      return res.status(503).json({ error: 'Payment checkout is not configured.' });
    }

    console.error('Unable to prepare a Razorpay order:', error);
    return res.status(502).json({ error: 'Payment checkout could not be prepared. Please try again.' });
  }
};
