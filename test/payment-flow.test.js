const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { ObjectId } = require('mongodb');

process.env.RAZORPAY_KEY_ID = 'rzp_test_fixture';
process.env.RAZORPAY_KEY_SECRET = 'test-secret';
process.env.RAZORPAY_WEBHOOK_SECRET = 'test-webhook-secret';

const bookings = [];
const payments = [];
let currentOrderId = '';
let currentPaymentId = '';

const bookingCollection = {
  async insertOne(document) {
    document._id = new ObjectId();
    bookings.push(document);
    return { insertedId: document._id };
  },
  async findOne(filter) {
    return bookings.find((booking) => booking._id.equals(filter._id)) || null;
  },
  async updateOne(filter, update) {
    const booking = bookings.find((entry) => {
      if (!entry._id.equals(filter._id)) return false;
      return !filter.status?.$ne || entry.status !== filter.status.$ne;
    });
    if (!booking || filter.status?.$nin?.includes(booking.status)) return { matchedCount: 0 };
    if (filter.paymentOrderLockToken && booking.paymentOrderLockToken !== filter.paymentOrderLockToken) {
      return { matchedCount: 0 };
    }
    if (filter.$or && !filter.$or.some((condition) => {
      const lockUntil = booking.paymentOrderLockUntil;
      if (condition.paymentOrderLockUntil?.$exists === false) return lockUntil === undefined;
      return condition.paymentOrderLockUntil?.$lt && lockUntil < condition.paymentOrderLockUntil.$lt;
    })) {
      return { matchedCount: 0 };
    }
    if (!booking) return { matchedCount: 0 };
    Object.assign(booking, update.$set || {});
    for (const key of Object.keys(update.$unset || {})) delete booking[key];
    return { matchedCount: 1 };
  },
};

const paymentCollection = {
  async createIndex() {},
  async findOne(filter) {
    return payments.find((payment) => Object.entries(filter).every(([key, value]) => {
      if (key === 'bookingId' || key === '_id') return payment[key]?.equals(value);
      return payment[key] === value;
    })) || null;
  },
  async insertOne(document) {
    document._id = new ObjectId();
    payments.push(document);
    return { insertedId: document._id };
  },
  async updateOne(filter, update) {
    const payment = payments.find((entry) => (
      entry._id.equals(filter._id)
      && entry.verificationStatus === filter.verificationStatus
    ));
    if (!payment) return { matchedCount: 0 };
    Object.assign(payment, update.$set);
    return { matchedCount: 1 };
  },
};

const mongo = require('../lib/mongodb');
mongo.getDatabase = async () => ({
  collection(name) {
    return name === 'bookings' ? bookingCollection : paymentCollection;
  },
});

const createBooking = require('../server/handlers/bookings');
const createOrder = require('../server/handlers/order');
const reportPayment = require('../server/handlers/payment');
const reportPaymentFailure = require('../server/handlers/payment-failure');
const handleWebhook = require('../server/handlers/razorpay-webhook');

global.fetch = async (url, options = {}) => {
  if (url.endsWith('/orders')) {
    currentOrderId = `order_fixture${payments.length}`;
    return {
      ok: true,
      async json() {
        return { id: currentOrderId, amount: 100000, currency: 'INR', status: 'created' };
      },
    };
  }

  if (url.endsWith(`/payments/${currentPaymentId}/capture`)) {
    return {
      ok: true,
      async json() {
        return {
          id: currentPaymentId,
          order_id: currentOrderId,
          amount: 100000,
          currency: 'INR',
          status: 'captured',
          captured: true,
        };
      },
    };
  }

  if (url.endsWith(`/payments/${currentPaymentId}`)) {
    return {
      ok: true,
      async json() {
        return {
          id: currentPaymentId,
          order_id: currentOrderId,
          amount: 100000,
          currency: 'INR',
          status: 'authorized',
          captured: false,
        };
      },
    };
  }

  if (url.includes('web3forms.com')) {
    return {
      ok: true,
      async json() {
        return { success: true, message: 'Submission successful' };
      },
    };
  }

  throw new Error(`Unexpected Razorpay request: ${options.method || 'GET'} ${url}`);
};

function response() {
  return {
    statusCode: 200,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    get(name) { return this.headers?.[name.toLowerCase()]; },
  };
}

function signatureFor(orderId, paymentId) {
  return crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
}

test('creates server-priced orders, verifies captured payments, and handles signed webhooks', async () => {
  const validBooking = {
    fullName: 'Test Patient',
    email: 'patient@example.com',
    whatsappNumber: '+91 98765 43210',
    issueDescription: 'Knee discomfort',
    preferredDate: new Date().toISOString().slice(0, 10),
    sessionType: 'Initial Consultation',
  };

  const invalidResponse = response();
  await createBooking({ body: { ...validBooking, email: 'invalid' } }, invalidResponse);
  assert.equal(invalidResponse.statusCode, 400);

  const bookingResponse = response();
  await createBooking({ body: validBooking }, bookingResponse);
  assert.equal(bookingResponse.statusCode, 201);
  const bookingId = bookingResponse.body.bookingId;

  const orderResponse = response();
  await createOrder({ params: { id: bookingId } }, orderResponse);
  assert.equal(orderResponse.statusCode, 201);
  assert.equal(orderResponse.body.amount, 100000);
  const orderId = orderResponse.body.orderId;

  currentPaymentId = 'pay_fixture123';
  const invalidSignatureResponse = response();
  await reportPayment({
    params: { id: bookingId },
    body: { paymentId: currentPaymentId, orderId, signature: '0'.repeat(64) },
  }, invalidSignatureResponse);
  assert.equal(invalidSignatureResponse.statusCode, 400);

  const verifiedResponse = response();
  await reportPayment({
    params: { id: bookingId },
    body: { paymentId: currentPaymentId, orderId, signature: signatureFor(orderId, currentPaymentId) },
  }, verifiedResponse);
  assert.equal(verifiedResponse.statusCode, 200);
  assert.equal(verifiedResponse.body.verified, true);
  assert.equal(bookings[0].status, 'paid');
  assert.equal(payments[0].verificationStatus, 'verified');
  assert.equal(payments[0].verificationMethod, 'checkout_signature');

  const duplicateOrderResponse = response();
  await createOrder({ params: { id: bookingId } }, duplicateOrderResponse);
  assert.equal(duplicateOrderResponse.statusCode, 409);

  const concurrentBookingResponse = response();
  await createBooking({ body: validBooking }, concurrentBookingResponse);
  const concurrentBookingId = concurrentBookingResponse.body.bookingId;
  const concurrentOrderResponses = [response(), response()];
  await Promise.all(concurrentOrderResponses.map((res) => createOrder(
    { params: { id: concurrentBookingId } },
    res
  )));
  assert.equal(concurrentOrderResponses.filter((res) => [200, 201].includes(res.statusCode)).length, 1);
  assert.equal(concurrentOrderResponses.filter((res) => res.statusCode === 409).length, 1);
  assert.equal(payments.filter((payment) => (
    payment.bookingId.toString() === concurrentBookingId
    && payment.verificationStatus === 'order_created'
  )).length, 1);

  const webhookBookingResponse = response();
  await createBooking({ body: validBooking }, webhookBookingResponse);
  const webhookBookingId = webhookBookingResponse.body.bookingId;
  const webhookOrderResponse = response();
  await createOrder({ params: { id: webhookBookingId } }, webhookOrderResponse);
  const webhookOrderId = webhookOrderResponse.body.orderId;
  const webhookPaymentId = 'pay_webhook123';
  const payload = Buffer.from(JSON.stringify({
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: webhookPaymentId,
          order_id: webhookOrderId,
          amount: 100000,
          currency: 'INR',
          status: 'captured',
          captured: true,
        },
      },
    },
  }));
  const webhookSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
  const webhookResponse = response();
  await handleWebhook({
    body: payload,
    get: (name) => name === 'x-razorpay-signature' ? webhookSignature : undefined,
  }, webhookResponse);
  assert.equal(webhookResponse.statusCode, 200);
  assert.equal(bookings.find((booking) => booking._id.toString() === webhookBookingId).status, 'paid');
  assert.equal(payments.find((payment) => payment.razorpayOrderId === webhookOrderId).verificationMethod, 'razorpay_webhook');

  const replayResponse = response();
  await handleWebhook({
    body: payload,
    get: (name) => name === 'x-razorpay-signature' ? webhookSignature : undefined,
  }, replayResponse);
  assert.equal(replayResponse.statusCode, 200);

  // Test recording payment failure
  const failedBookingResponse = response();
  await createBooking({ body: validBooking }, failedBookingResponse);
  const failedBookingId = failedBookingResponse.body.bookingId;
  const failureReqResponse = response();
  await reportPaymentFailure({
    params: { id: failedBookingId },
    body: { reason: 'Card declined by issuing bank', code: 'BAD_REQUEST_ERROR' },
  }, failureReqResponse);
  assert.equal(failureReqResponse.statusCode, 200);
  const failedBookingRecord = bookings.find((b) => b._id.toString() === failedBookingId);
  assert.equal(failedBookingRecord.status, 'payment_failed');
  assert.equal(failedBookingRecord.failureReason, 'Card declined by issuing bank');
});
