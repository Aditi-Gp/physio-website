function getCredentials() {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    const error = new Error('Razorpay is not configured.');
    error.code = 'RAZORPAY_NOT_CONFIGURED';
    throw error;
  }
  return { keyId, keySecret };
}

async function razorpayRequest(path, { method = 'GET', body } = {}) {
  const { keyId, keySecret } = getCredentials();
  const authorization = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const response = await fetch(`https://api.razorpay.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Basic ${authorization}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    signal: AbortSignal.timeout(15_000),
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  let result;
  try {
    result = await response.json();
  } catch {
    const error = new Error('Razorpay returned an invalid response.');
    error.code = 'RAZORPAY_INVALID_RESPONSE';
    throw error;
  }

  if (!response.ok) {
    const error = new Error('Razorpay request failed.');
    error.code = 'RAZORPAY_REQUEST_FAILED';
    error.status = response.status;
    throw error;
  }

  return result;
}

module.exports = { getCredentials, razorpayRequest };
