const crypto = require('node:crypto');
const { ObjectId } = require('mongodb');
const { getDatabase } = require('../../lib/mongodb');
const { getCredentials, razorpayRequest } = require('../../lib/razorpay');

function isValidSignature(orderId, paymentId, signature, keySecret) {
  if (typeof signature !== 'string' || !/^[a-f\d]{64}$/i.test(signature)) return false;
  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest();
  const supplied = Buffer.from(signature, 'hex');
  return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
}

function isObjectId(value) {
  return typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
}

module.exports = async function reportPayment(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const bookingId = req.params?.id || req.query?.id;
  const paymentId = typeof req.body?.paymentId === 'string' ? req.body.paymentId.trim() : '';
  const orderId = typeof req.body?.orderId === 'string' ? req.body.orderId.trim() : '';
  const signature = typeof req.body?.signature === 'string' ? req.body.signature.trim() : '';

  if (
    !isObjectId(bookingId)
    || !/^pay_[A-Za-z0-9]{1,120}$/.test(paymentId)
    || !/^order_[A-Za-z0-9]{1,120}$/.test(orderId)
  ) {
    return res.status(400).json({ error: 'A valid booking and Razorpay payment response are required.' });
  }

  try {
    const { keySecret } = getCredentials();
    if (!isValidSignature(orderId, paymentId, signature, keySecret)) {
      return res.status(400).json({ error: 'Razorpay payment signature verification failed.' });
    }

    const db = await getDatabase();
    const bookings = db.collection('bookings');
    const payments = db.collection('payments');
    const bookingObjectId = new ObjectId(bookingId);
    const booking = await bookings.findOne({ _id: bookingObjectId });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    const order = await payments.findOne({
      bookingId: bookingObjectId,
      razorpayOrderId: orderId,
    });
    if (!order) {
      return res.status(404).json({ error: 'Razorpay order was not found for this booking.' });
    }

    if (order.verificationStatus === 'verified') {
      if (order.razorpayPaymentId === paymentId) {
        return res.status(200).json({ verified: true, verificationStatus: 'verified' });
      }
      return res.status(409).json({ error: 'A different payment is already verified for this order.' });
    }

    const payment = await razorpayRequest(`payments/${encodeURIComponent(paymentId)}`);
    if (
      payment.order_id !== orderId
      || payment.amount !== order.expectedAmountPaise
      || payment.currency !== order.currency
    ) {
      return res.status(400).json({ error: 'Razorpay payment details do not match this booking.' });
    }

    let capturedPayment = payment;
    if (payment.status === 'authorized' && payment.captured !== true) {
      capturedPayment = await razorpayRequest(`payments/${encodeURIComponent(paymentId)}/capture`, {
        method: 'POST',
        body: { amount: order.expectedAmountPaise, currency: order.currency },
      });
    }

    if (
      capturedPayment.id !== paymentId
      || capturedPayment.order_id !== orderId
      || capturedPayment.amount !== order.expectedAmountPaise
      || capturedPayment.currency !== order.currency
      || capturedPayment.status !== 'captured'
      || capturedPayment.captured !== true
    ) {
      return res.status(409).json({ error: 'Razorpay has not confirmed a captured payment yet.' });
    }

    const verifiedAt = new Date();
    const updatedPayment = await payments.updateOne(
      { _id: order._id, verificationStatus: 'order_created' },
      {
        $set: {
          razorpayPaymentId: paymentId,
          verificationStatus: 'verified',
          verificationMethod: 'checkout_signature',
          verifiedAt,
          updatedAt: verifiedAt,
        },
      }
    );

    if (updatedPayment.matchedCount !== 1) {
      const current = await payments.findOne({ _id: order._id });
      if (current?.verificationStatus !== 'verified' || current.razorpayPaymentId !== paymentId) {
        return res.status(409).json({ error: 'This payment order has already been processed.' });
      }
    }

    await bookings.updateOne(
      { _id: bookingObjectId, status: { $ne: 'paid' } },
      { $set: { status: 'paid', paidAt: verifiedAt, updatedAt: verifiedAt } }
    );

    return res.status(200).json({ verified: true, verificationStatus: 'verified' });
  } catch (error) {
    if (error.code === 'MONGODB_NOT_CONFIGURED') {
      console.error('Razorpay payment could not be verified because MongoDB is not configured.');
      return res.status(503).json({ error: 'Payment storage is not configured.' });
    }
    if (error.code === 'RAZORPAY_NOT_CONFIGURED') {
      console.error('Razorpay payment verification is not configured.');
      return res.status(503).json({ error: 'Payment verification is not configured.' });
    }
    if (error.code === 'RAZORPAY_REQUEST_FAILED') {
      console.error(`Razorpay payment verification request failed with status ${error.status}.`);
      return res.status(502).json({ error: 'Razorpay payment could not be verified. Please contact support before retrying.' });
    }

    console.error('Unable to verify Razorpay payment:', error);
    return res.status(503).json({ error: 'Payment could not be verified. Please contact support before retrying.' });
  }
};