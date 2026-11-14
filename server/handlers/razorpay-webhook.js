const crypto = require('node:crypto');
const { getDatabase } = require('../../lib/mongodb');
const { generateMeetingLink } = require('../../lib/slots');
const { sendBookingNotification } = require('../../lib/web3forms');

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

    const targetBooking = await bookings.findOne({ _id: order.bookingId });
    if (targetBooking) {
      const conflictingBooking = await bookings.findOne({
        _id: { $ne: targetBooking._id },
        preferredDate: targetBooking.preferredDate,
        timeSlot: targetBooking.timeSlot,
        status: 'paid',
      });

      if (conflictingBooking) {
        console.error(`Webhook: Slot ${targetBooking.timeSlot} on ${targetBooking.preferredDate} was already paid by another patient.`);
        await bookings.updateOne(
          { _id: targetBooking._id },
          {
            $set: {
              status: 'paid_slot_conflict',
              paidAt: verifiedAt,
              updatedAt: verifiedAt,
              slotConflict: true,
            },
          }
        );
        return res.status(200).json({ received: true, slotConflict: true });
      }
    }

    const meetingLink = targetBooking?.meetingLink || generateMeetingLink(order.bookingId.toString());

    await bookings.updateOne(
      { _id: order.bookingId, status: { $ne: 'paid' } },
      { $set: { status: 'paid', paidAt: verifiedAt, updatedAt: verifiedAt, meetingLink } }
    );

    if (targetBooking && !targetBooking.web3formsSent) {
      sendBookingNotification({
        fullName: targetBooking.patient?.fullName,
        email: targetBooking.patient?.email,
        whatsappNumber: targetBooking.patient?.whatsappNumber,
        issueDescription: targetBooking.issueDescription,
        preferredDate: targetBooking.preferredDate,
        timeSlot: targetBooking.timeSlot,
        sessionType: targetBooking.sessionType?.label,
        amountINR: order.expectedAmountPaise / 100,
        paymentId: payment.id,
        meetingLink,
      }).then((notif) => {
        if (notif?.success) {
          bookings.updateOne(
            { _id: targetBooking._id },
            { $set: { web3formsSent: true, web3formsSentAt: new Date() } }
          ).catch(() => {});
        }
      }).catch((err) => {
        console.error('[Web3Forms] Error triggering notification from webhook:', err);
      });
    }

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
