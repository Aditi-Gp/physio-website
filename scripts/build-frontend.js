const fs = require('node:fs');
const path = require('node:path');

const apiBaseUrl = (process.env.PUBLIC_API_BASE_URL || '').trim().replace(/\/+$/, '');
const isProduction = process.env.VERCEL_ENV
  ? process.env.VERCEL_ENV === 'production'
  : process.env.NODE_ENV === 'production';
const emailjs = {
  publicKey: (process.env.EMAILJS_PUBLIC_KEY || '').trim(),
  serviceId: (process.env.EMAILJS_SERVICE_ID || '').trim(),
  doctorTemplateId: (process.env.EMAILJS_DOCTOR_TEMPLATE_ID || '').trim(),
  patientTemplateId: (process.env.EMAILJS_PATIENT_TEMPLATE_ID || '').trim(),
  doctorEmail: (process.env.DOCTOR_EMAIL || '').trim(),
};
const web3FormsKey = (process.env.WEB3_FORMS_API_KEY || '').trim();

if (isProduction && !apiBaseUrl) {
  throw new Error('PUBLIC_API_BASE_URL must be set to the HTTPS Render API URL for production builds.');
}

if (isProduction && Object.values(emailjs).some((value) => !value)) {
  throw new Error('Set all EMAILJS_PUBLIC_KEY, EMAILJS_SERVICE_ID, EMAILJS_DOCTOR_TEMPLATE_ID, EMAILJS_PATIENT_TEMPLATE_ID, and DOCTOR_EMAIL values for production builds.');
}

if (apiBaseUrl) {
  let apiUrl;
  try {
    apiUrl = new URL(apiBaseUrl);
  } catch {
    throw new Error('PUBLIC_API_BASE_URL must be a valid absolute URL.');
  }

  if (apiUrl.protocol !== 'https:' || apiUrl.pathname !== '/' || apiUrl.search || apiUrl.hash) {
    throw new Error('PUBLIC_API_BASE_URL must be an HTTPS origin without a path, query, or fragment.');
  }
}

const outputDirectory = path.resolve(__dirname, '..', 'dist');
fs.rmSync(outputDirectory, { recursive: true, force: true });
fs.mkdirSync(outputDirectory, { recursive: true });
fs.copyFileSync(path.resolve(__dirname, '..', 'index.html'), path.join(outputDirectory, 'index.html'));
fs.cpSync(
  path.resolve(__dirname, '..', 'assets'),
  path.join(outputDirectory, 'assets'),
  { recursive: true }
);
fs.writeFileSync(
  path.join(outputDirectory, 'assets', 'js', 'config.js'),
  `window.PHYSIO_CONFIG = Object.freeze(${JSON.stringify({ apiBaseUrl, emailjs, web3FormsKey })});\n`
);
