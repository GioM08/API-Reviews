const { pool } = require('../config/db');

const createTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS restaurants (
      id              SERIAL PRIMARY KEY,
      name            VARCHAR(255) NOT NULL,
      description     TEXT DEFAULT '',
      address         VARCHAR(500) DEFAULT '',
      category        VARCHAR(100) DEFAULT 'Restaurante',
      latitude        DECIMAL(10,7),
      longitude       DECIMAL(10,7),
      place_id        VARCHAR(255) UNIQUE,
      photo_reference TEXT,
      photo_url       TEXT,
      phone_number    VARCHAR(50),
      website         VARCHAR(500),
      price_level     INTEGER,
      opening_hours   JSONB,
      google_rating   DECIMAL(3,2),
      details_fetched BOOLEAN DEFAULT FALSE,
      score           DECIMAL(3,2) DEFAULT 0,
      review_count    INTEGER DEFAULT 0,
      created_at      TIMESTAMP DEFAULT NOW()
    )
  `);

  // Migración: agregar columnas nuevas si la tabla ya existía
  const migrations = [
    `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS place_id        VARCHAR(255)`,
    `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS photo_reference TEXT`,
    `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS photo_url       TEXT`,
    `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS phone_number    VARCHAR(50)`,
    `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS website         VARCHAR(500)`,
    `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS price_level     INTEGER`,
    `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS opening_hours   JSONB`,
    `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS google_rating   DECIMAL(3,2)`,
    `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS details_fetched BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS detailed_ratings_avg JSONB DEFAULT '{}'`,
    `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS amenities_stats      JSONB DEFAULT '{}'`,
  ];

  for (const sql of migrations) {
    await pool.query(sql);
  }

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS restaurants_place_id_idx
    ON restaurants(place_id) WHERE place_id IS NOT NULL
  `);
};

module.exports = { createTable };
