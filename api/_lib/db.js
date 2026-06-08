const { createClient } = require('@libsql/client/web');

let _client = null;

function getDB() {
  if (!_client) {
    if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
      throw new Error('TURSO_DATABASE_URL et TURSO_AUTH_TOKEN doivent être définis dans les variables d\'environnement Vercel.');
    }
    _client = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return _client;
}

module.exports = { getDB };
