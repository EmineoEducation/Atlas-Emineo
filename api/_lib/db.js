const { createClient } = require('@libsql/client/web');

let _client = null;

function getDB() {
  if (!_client) {
    const rawUrl = (process.env.TURSO_DATABASE_URL || '').trim();
    const rawToken = (process.env.TURSO_AUTH_TOKEN || '').trim();

    if (!rawUrl || !rawToken) {
      throw new Error('TURSO_DATABASE_URL et TURSO_AUTH_TOKEN doivent être définis dans Vercel.');
    }

    // Nettoyage : retire tout caractère avant "libsql://" et tout espace/tab
    let url = rawUrl;
    const idx = url.indexOf('libsql://');
    if (idx > 0) url = url.slice(idx);
    url = url.replace(/[\s\t\r\n]/g, '');

    const authToken = rawToken.replace(/[\s\t\r\n]/g, '');

    _client = createClient({ url, authToken });
  }
  return _client;
}

module.exports = { getDB };
