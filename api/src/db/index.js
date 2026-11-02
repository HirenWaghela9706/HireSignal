const { Pool } = require('pg');
const { initSchema } = require('./schema');

let pool;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
  }
  return pool;
}

async function initDb() {
  const p = getPool();
  await initSchema(p);
}

module.exports = { getPool, initDb };
