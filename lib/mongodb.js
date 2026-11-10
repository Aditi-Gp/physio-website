require('dotenv').config({ path: '.env' });

const { MongoClient } = require('mongodb');

const CLIENT_PROMISE_KEY = '__physioMongoClientPromise';

function getMongoConfiguration() {
  const uri = process.env.MONGODB_URI?.trim();
  const username = process.env.MONGODB_USERNAME?.trim();
  const password = process.env.MONGODB_PASSWORD;

  if (!uri || !username || !password) {
    const error = new Error('MongoDB is not configured.');
    error.code = 'MONGODB_NOT_CONFIGURED';
    throw error;
  }

  let connectionUrl;
  try {
    connectionUrl = new URL(uri);
  } catch {
    const error = new Error('MongoDB URI is invalid.');
    error.code = 'MONGODB_NOT_CONFIGURED';
    throw error;
  }

  if (!['mongodb:', 'mongodb+srv:'].includes(connectionUrl.protocol)) {
    const error = new Error('MongoDB URI must use the mongodb or mongodb+srv protocol.');
    error.code = 'MONGODB_NOT_CONFIGURED';
    throw error;
  }

  connectionUrl.username = username;
  connectionUrl.password = password;

  return { uri: connectionUrl.toString() };
}

async function getDatabase() {
  const { uri } = getMongoConfiguration();

  if (!globalThis[CLIENT_PROMISE_KEY]) {
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });

    globalThis[CLIENT_PROMISE_KEY] = client.connect()
      .then(() => client)
      .catch((error) => {
        globalThis[CLIENT_PROMISE_KEY] = null;
        throw error;
      });
  }

  const client = await globalThis[CLIENT_PROMISE_KEY];
  return client.db();
}

module.exports = { getDatabase };
