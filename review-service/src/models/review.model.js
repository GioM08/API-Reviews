const { pool } = require('../config/db');

const createTables = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS restaurants (
      id INTEGER PRIMARY KEY,
      name VARCHAR(255) NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reviews (
      id SERIAL PRIMARY KEY,
      restaurant_id INTEGER NOT NULL REFERENCES restaurants(id),
      user_id VARCHAR(255) NOT NULL,
      stars INTEGER NOT NULL CHECK (stars >= 1 AND stars <= 5),
      comment TEXT DEFAULT '',
      upvotes INTEGER DEFAULT 0,
      downvotes INTEGER DEFAULT 0,
      hidden BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS votes (
      id SERIAL PRIMARY KEY,
      review_id INTEGER NOT NULL REFERENCES reviews(id),
      user_id VARCHAR(255) NOT NULL,
      vote_type VARCHAR(10) NOT NULL CHECK (vote_type IN ('up', 'down')),
      UNIQUE (review_id, user_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reports (
      id SERIAL PRIMARY KEY,
      review_id INTEGER NOT NULL REFERENCES reviews(id),
      user_id VARCHAR(255) NOT NULL,
      reason TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (review_id, user_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS review_media (
      id SERIAL PRIMARY KEY,
      review_id INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      media_type VARCHAR(10) NOT NULL CHECK (media_type IN ('image', 'video')),
      filename VARCHAR(255) DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Por si las tablas ya existían sin las columnas nuevas
  await pool.query(`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS hidden BOOLEAN DEFAULT FALSE`);
};

module.exports = { createTables };
