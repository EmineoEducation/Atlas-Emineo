const { createClient } = require('@libsql/client');

let _client = null;

function getDB() {
  if (!_client) {
    _client = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return _client;
}

module.exports = { getDB };
