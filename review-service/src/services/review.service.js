const { pool } = require('../config/db');
const { publishReviewCreated } = require('../utils/broker.util');

const storeRestaurant = async (restaurantData) => {
  await pool.query(
    `INSERT INTO restaurants (id, name) VALUES ($1, $2)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
    [restaurantData.id, restaurantData.name]
  );
};

const createReview = async ({ restaurantId, stars, comment, media = [] }, userId) => {
  const restaurantExists = await pool.query(
    'SELECT id FROM restaurants WHERE id = $1',
    [restaurantId]
  );
  if (restaurantExists.rows.length === 0) throw new Error('Restaurante no encontrado');

  const result = await pool.query(
    'INSERT INTO reviews (restaurant_id, user_id, stars, comment) VALUES ($1, $2, $3, $4) RETURNING *',
    [restaurantId, userId, stars, comment || '']
  );
  const review = result.rows[0];

  const savedMedia = [];
  for (const item of media) {
    const mediaResult = await pool.query(
      'INSERT INTO review_media (review_id, url, media_type, filename) VALUES ($1, $2, $3, $4) RETURNING *',
      [review.id, item.url, item.media_type, item.filename || '']
    );
    savedMedia.push(mediaResult.rows[0]);
  }

  await publishReviewCreated({ restaurantId, stars, userId, reviewId: review.id });

  return { ...review, media: savedMedia };
};

const getReviews = async ({ restaurantId, userId }) => {
  const conditions = ['r.hidden = FALSE'];
  const params = [];

  if (restaurantId) {
    params.push(restaurantId);
    conditions.push(`r.restaurant_id = $${params.length}`);
  }
  if (userId) {
    params.push(userId);
    conditions.push(`r.user_id = $${params.length}`);
  }

  const where = conditions.join(' AND ');
  const result = await pool.query(
    `SELECT r.*,
       COALESCE(json_agg(rm.*) FILTER (WHERE rm.id IS NOT NULL), '[]') AS media
     FROM reviews r
     LEFT JOIN review_media rm ON rm.review_id = r.id
     WHERE ${where}
     GROUP BY r.id
     ORDER BY r.created_at DESC`,
    params
  );
  return result.rows;
};

const addVote = async (reviewId, userId, voteType) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existingVote = await client.query(
      'SELECT vote_type FROM votes WHERE review_id = $1 AND user_id = $2',
      [reviewId, userId]
    );

    if (existingVote.rows.length > 0) {
      const currentVote = existingVote.rows[0].vote_type;
      if (currentVote === voteType) throw new Error('Ya votaste de esta forma');

      if (currentVote === 'up') {
        await client.query(
          'UPDATE reviews SET upvotes = upvotes - 1, downvotes = downvotes + 1 WHERE id = $1',
          [reviewId]
        );
      } else {
        await client.query(
          'UPDATE reviews SET downvotes = downvotes - 1, upvotes = upvotes + 1 WHERE id = $1',
          [reviewId]
        );
      }
      await client.query(
        'UPDATE votes SET vote_type = $1 WHERE review_id = $2 AND user_id = $3',
        [voteType, reviewId, userId]
      );
    } else {
      if (voteType === 'up') {
        await client.query('UPDATE reviews SET upvotes = upvotes + 1 WHERE id = $1', [reviewId]);
      } else {
        await client.query('UPDATE reviews SET downvotes = downvotes + 1 WHERE id = $1', [reviewId]);
      }
      await client.query(
        'INSERT INTO votes (review_id, user_id, vote_type) VALUES ($1, $2, $3)',
        [reviewId, userId, voteType]
      );
    }

    await client.query('COMMIT');
    const review = await client.query('SELECT * FROM reviews WHERE id = $1', [reviewId]);
    return review.rows[0];
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

const reportReview = async (reviewId, userId, reason) => {
  await pool.query(
    `INSERT INTO reports (review_id, user_id, reason) VALUES ($1, $2, $3)
     ON CONFLICT (review_id, user_id) DO NOTHING`,
    [reviewId, userId, reason || '']
  );
};

const getReportedReviews = async () => {
  const result = await pool.query(`
    SELECT r.*, COUNT(rp.id) AS report_count
    FROM reviews r
    JOIN reports rp ON rp.review_id = r.id
    GROUP BY r.id
    ORDER BY report_count DESC
  `);
  return result.rows;
};

const hideReview = async (reviewId) => {
  const result = await pool.query(
    'UPDATE reviews SET hidden = TRUE WHERE id = $1 RETURNING *',
    [reviewId]
  );
  if (result.rows.length === 0) throw new Error('Reseña no encontrada');
  return result.rows[0];
};

const deleteReview = async (reviewId) => {
  await pool.query('DELETE FROM votes WHERE review_id = $1', [reviewId]);
  await pool.query('DELETE FROM reports WHERE review_id = $1', [reviewId]);
  const result = await pool.query('DELETE FROM reviews WHERE id = $1 RETURNING id', [reviewId]);
  if (result.rows.length === 0) throw new Error('Reseña no encontrada');
};

module.exports = {
  storeRestaurant,
  createReview,
  getReviews,
  addVote,
  reportReview,
  getReportedReviews,
  hideReview,
  deleteReview,
};
