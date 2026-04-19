const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const connectDB = async () => {
  const client = await pool.connect();
  await client.query('SELECT 1');
  client.release();
  console.log('✔ Restaurant-Service: PostgreSQL conectado');
};

module.exports = { pool, connectDB };
