const crypto = require('node:crypto');
const { getDatabase } = require('../../lib/mongodb');

function isValidWebhookSignature(body, signature, secret) {
  if (!Buffer.isBuffer(body) || typeof signature !== 'string' || !/^[a-f\d]{64}$/i.test(signature)) {
    return false;
  }

  const expected = crypto.createHmac('sha256', secret).update(body).digest();
  const supplied = Buffer.from(signature, 'hex');
  return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
}

module.exports = async function handleRazorpayWebhook(req, res) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = req.get('x-razorpay-signature');

  if (!secret) {
    console.error('Razorpay webhook secret is not configured.');
    return res.status(503).json({ error: 'Payment webhook is not configured.' });
  }
  if (!isValidWebhookSignature(req.body, signature, secret)) {
    return res.status(400).json({ error: 'Invalid Razorpay webhook signature.' });
  }

  let event;
  try {
    event = JSON.parse(req.body.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Invalid webhook payload.' });
  }

  if (event.event !== 'payment.captured') {
    return res.status(200).json({ received: true });
  }

  const payment = event.payload?.payment?.entity;
  if (
    typeof payment?.id !== 'string'
    || typeof payment.order_id !== 'string'
    || payment.status !== 'captured'
    || payment.captured !== true
  ) {
    return res.status(400).json({ error: 'Invalid captured-payment event.' });
  }

  try {
    const db = await getDatabase();
    const bookings = db.collection('bookings');
    const payments = db.collection('payments');
    const order = await payments.findOne({ razorpayOrderId: payment.order_id });

    if (!order) {
      return res.status(404).json({ error: 'Payment order was not found.' });
    }
    if (
      payment.amount !== order.expectedAmountPaise
      || payment.currency !== order.currency
    ) {
      console.error('Razorpay webhook amount or currency did not match the stored order.');
      return res.status(400).json({ error: 'Payment does not match the stored order.' });
    }

    if (order.verificationStatus === 'verified') {
      if (order.razorpayPaymentId === payment.id) {
        return res.status(200).json({ received: true, verified: true });
      }
      return res.status(409).json({ error: 'A different payment is already verified for this order.' });
    }

    const verifiedAt = new Date();
    const updated = await payments.updateOne(
      { _id: order._id, verificationStatus: 'order_created' },
      {
        $set: {
          razorpayPaymentId: payment.id,
          verificationStatus: 'verified',
          verificationMethod: 'razorpay_webhook',
          verifiedAt,
          updatedAt: verifiedAt,
        },
      }
    );

    if (updated.matchedCount !== 1) {
      const current = await payments.findOne({ _id: order._id });
      if (current?.verificationStatus !== 'verified' || current.razorpayPaymentId !== payment.id) {
        return res.status(409).json({ error: 'This payment order has already been processed.' });
      }
    }

    await bookings.updateOne(
      { _id: order.bookingId, status: { $ne: 'paid' } },
      { $set: { status: 'paid', paidAt: verifiedAt, updatedAt: verifiedAt } }
    );

    return res.status(200).json({ received: true, verified: true });
  } catch (error) {
    if (error.code === 'MONGODB_NOT_CONFIGURED') {
      console.error('Razorpay webhook could not be processed because MongoDB is not configured.');
      return res.status(503).json({ error: 'Payment storage is not configured.' });
    }
    console.error('Unable to process Razorpay payment webhook.');
    return res.status(503).json({ error: 'Payment webhook could not be processed.' });
  }
};
