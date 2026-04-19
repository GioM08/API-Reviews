const { pool } = require('../config/db');

const createTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS restaurants (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT DEFAULT '',
      address VARCHAR(255) DEFAULT '',
      category VARCHAR(100) DEFAULT 'Restaurante',
      latitude DECIMAL(10,7),
      longitude DECIMAL(10,7),
      osm_id BIGINT UNIQUE,
      score DECIMAL(3,2) DEFAULT 0,
      review_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Por si la tabla ya existía sin las columnas nuevas
  await pool.query(`ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT 'Restaurante'`);
  await pool.query(`ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,7)`);
  await pool.query(`ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS longitude DECIMAL(10,7)`);
  await pool.query(`ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS osm_id BIGINT`);

  // PostgreSQL permite múltiples NULLs en índices únicos, no necesita ser parcial
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS restaurants_osm_id_idx
    ON restaurants(osm_id)
  `);
};

module.exports = { createTable };
