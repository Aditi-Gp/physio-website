const path = require('node:path');
require('dotenv').config({ path: '.env' });

const cors = require('cors');
const express = require('express');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const { getDatabase } = require('./lib/mongodb');
const createBooking = require('./server/handlers/bookings');
const createOrder = require('./server/handlers/order');
const reportPayment = require('./server/handlers/payment');
const reportPaymentFailure = require('./server/handlers/payment-failure');
const razorpayWebhook = require('./server/handlers/razorpay-webhook');
const getSlots = require('./server/handlers/slots');

const app = express();
const port = Number(process.env.PORT) || 10000;
const isProduction = process.env.NODE_ENV === 'production';

app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: isProduction ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        'https://checkout.razorpay.com',
        'https://*.razorpay.com',
        'https://cdn.jsdelivr.net',
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        'https://fonts.googleapis.com',
        'https://checkout.razorpay.com',
      ],
      fontSrc: [
        "'self'",
        'https://fonts.gstatic.com',
        'data:',
      ],
      imgSrc: [
        "'self'",
        'data:',
        'https:',
        'https://*.razorpay.com',
      ],
      connectSrc: [
        "'self'",
        'https://api.razorpay.com',
        'https://checkout.razorpay.com',
        'https://*.razorpay.com',
        'https://api.emailjs.com',
        'https://api.web3forms.com',
      ],
      frameSrc: [
        "'self'",
        'https://api.razorpay.com',
        'https://checkout.razorpay.com',
        'https://*.razorpay.com',
      ],
    },
  } : false,
}));

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (isProduction && (
  allowedOrigins.length === 0
  || allowedOrigins.some((origin) => {
    try {
      return new URL(origin).origin !== origin || new URL(origin).protocol !== 'https:';
    } catch {
      return true;
    }
  })
)) {
  throw new Error('Set ALLOWED_ORIGINS to exact HTTPS frontend origins before starting in production.');
}

if (!isProduction) {
  allowedOrigins.push('http://localhost:3000', 'http://127.0.0.1:3000');
}

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  maxAge: 600,
}));

function runHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res)).catch(next);
  };
}

app.post(
  '/api/webhooks/razorpay',
  express.raw({ type: 'application/json', limit: '10kb' }),
  runHandler(razorpayWebhook)
);

app.use(express.json({ limit: '10kb', strict: true }));

const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});
const bookingRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many booking attempts. Please try again later.' },
});

app.use('/api', apiRateLimit);

app.get('/healthz', async (req, res) => {
  try {
    const database = await getDatabase();
    await database.command({ ping: 1 });
    return res.status(200).json({ status: 'ok' });
  } catch {
    console.error('Health check failed because the database is unavailable.');
    return res.status(503).json({ status: 'unavailable' });
  }
});

app.get('/api/slots', runHandler(getSlots));
app.get('/api/config', (req, res) => {
  res.json({
    web3FormsKey: process.env.WEB3_FORMS_API_KEY ? process.env.WEB3_FORMS_API_KEY.trim() : '',
  });
});

app.post('/api/bookings', bookingRateLimit, runHandler(createBooking));
app.post('/api/bookings/:id/order', bookingRateLimit, runHandler(createOrder));
app.post('/api/bookings/:id/payment', bookingRateLimit, runHandler(reportPayment));
app.post('/api/bookings/:id/fail', bookingRateLimit, runHandler(reportPaymentFailure));

if (!isProduction) {
  app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
  app.use('/assets', express.static(path.join(__dirname, 'assets'), { dotfiles: 'deny' }));
}

app.use((req, res) => res.status(404).json({ error: 'Not found.' }));
app.use((error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof SyntaxError && Object.prototype.hasOwnProperty.call(error, 'body')) {
    res.status(400).json({ error: 'Request body must be valid JSON.' });
    return;
  }

  console.error('Unhandled API request error.');
  res.status(500).json({ error: 'The request could not be completed.' });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Physio API listening on port ${port}.`);
});
