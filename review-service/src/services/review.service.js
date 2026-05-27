const { pool } = require('../config/db');
const { publishReviewCreated, publishInteractionEvent } = require('../utils/broker.util');

const enrichWithUsers = async (reviews) => {
  if (reviews.length === 0) return reviews;
  const ids = [...new Set(reviews.map((r) => r.user_id))];
  try {
    const res = await fetch(`${process.env.USER_SERVICE_URL}/api/users/internal/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) return reviews;
    const usersMap = await res.json();
    return reviews.map((r) => ({  
      ...r,
      user_name: usersMap[r.user_id]?.name || '',
      user_avatar: usersMap[r.user_id]?.avatar || '',
    }));
  } catch {
    return reviews;
  }
};

const getUsername = async (userId) => {
  try {
    const res = await fetch(`${process.env.USER_SERVICE_URL}/api/users/internal/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [userId] }),
    });
    if (!res.ok) return 'Alguien';
    const map = await res.json();
    return map[userId]?.name || 'Alguien';
  } catch {
    return 'Alguien';
  }
};

const storeRestaurant = async (restaurantData) => {
  await pool.query(
    `INSERT INTO restaurants (id, name) VALUES ($1, $2)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
    [restaurantData.id, restaurantData.name]
  );
};

const computeRestaurantStats = async (restaurantId) => {
  const result = await pool.query(
    `SELECT detailed_ratings, amenities
     FROM reviews
     WHERE restaurant_id = $1 AND hidden = FALSE`,
    [restaurantId]
  );

  const total = result.rows.length;
  if (total === 0) return { detailed_ratings_avg: {}, amenities_stats: {} };

  const ratingTotals = {};
  const ratingCounts = {};
  for (const row of result.rows) {
    if (row.detailed_ratings) {
      for (const [key, val] of Object.entries(row.detailed_ratings)) {
        ratingTotals[key] = (ratingTotals[key] || 0) + Number(val);
        ratingCounts[key] = (ratingCounts[key] || 0) + 1;
      }
    }
  }
  const detailed_ratings_avg = {};
  for (const key of Object.keys(ratingTotals)) {
    detailed_ratings_avg[key] = Math.round((ratingTotals[key] / ratingCounts[key]) * 10) / 10;
  }

  const amenityCounts = {};
  for (const row of result.rows) {
    if (Array.isArray(row.amenities)) {
      for (const amenity of row.amenities) {
        amenityCounts[amenity] = (amenityCounts[amenity] || 0) + 1;
      }
    }
  }
  const amenities_stats = {};
  for (const [key, count] of Object.entries(amenityCounts)) {
    amenities_stats[key] = Math.round((count / total) * 100) / 100;
  }

  return { detailed_ratings_avg, amenities_stats };
};

const createReview = async ({ restaurantId, stars, comment, context = {}, planId = null, media = [], detailed_ratings, amenities = [] }, userId) => {
  const restaurantExists = await pool.query(
    'SELECT id FROM restaurants WHERE id = $1',
    [restaurantId]
  );
  if (restaurantExists.rows.length === 0) throw new Error('Restaurante no encontrado');

  const recentReview = await pool.query(
    `SELECT id FROM reviews
     WHERE user_id = $1 AND restaurant_id = $2
       AND created_at > NOW() - INTERVAL '7 days'
     LIMIT 1`,
    [userId, restaurantId]
  );
  if (recentReview.rows.length > 0) {
    throw new Error('Solo puedes reseñar este restaurante una vez por semana');
  }

  let finalStars = stars;
  if (detailed_ratings && Object.keys(detailed_ratings).length > 0) {
    const vals = Object.values(detailed_ratings).map(Number);
    finalStars = Math.min(5, Math.max(1, Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)));
  }

  const result = await pool.query(
    `INSERT INTO reviews (restaurant_id, user_id, stars, comment, context, plan_id, detailed_ratings, amenities)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [
      restaurantId, userId, finalStars, comment || '',
      JSON.stringify(context), planId,
      detailed_ratings ? JSON.stringify(detailed_ratings) : null,
      JSON.stringify(amenities),
    ]
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

  const stats = await computeRestaurantStats(restaurantId);
  await publishReviewCreated({
    restaurantId, stars: finalStars, userId, reviewId: review.id, context,
    detailed_ratings_avg: stats.detailed_ratings_avg,
    amenities_stats: stats.amenities_stats,
  });

  return { ...review, media: savedMedia };
};

const getSegmentedScores = async (restaurantId) => {
  const result = await pool.query(
    `SELECT
       context->>'moment'  AS moment,
       context->>'company' AS company,
       context->>'when'    AS "when",
       context->>'price_range' AS price_range,
       ROUND(AVG(stars), 1) AS avg_score,
       COUNT(*)::int        AS review_count
     FROM reviews
     WHERE restaurant_id = $1
       AND hidden = FALSE
       AND context != '{}'
     GROUP BY
       context->>'moment',
       context->>'company',
       context->>'when',
       context->>'price_range'
     ORDER BY review_count DESC`,
    [restaurantId]
  );
  return result.rows;
};

const getReviews = async ({ restaurantId, userId }, viewerId = null) => {
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

  let viewerJoins = '';
  let viewerSelect = `NULL::varchar AS user_vote, FALSE AS liked`;
  let viewerGroup = '';

  if (viewerId) {
    params.push(viewerId);
    const p = `$${params.length}`;
    viewerJoins = `
      LEFT JOIN votes v  ON v.review_id  = r.id AND v.user_id = ${p}
      LEFT JOIN likes lk ON lk.review_id = r.id AND lk.user_id = ${p}`;
    viewerSelect = `v.vote_type AS user_vote, (lk.user_id IS NOT NULL) AS liked`;
    viewerGroup  = `, v.vote_type, lk.user_id`;
  }

  const result = await pool.query(
    `SELECT r.*,
       COALESCE(json_agg(rm.*) FILTER (WHERE rm.id IS NOT NULL), '[]') AS media,
       ${viewerSelect}
     FROM reviews r
     LEFT JOIN review_media rm ON rm.review_id = r.id
     ${viewerJoins}
     WHERE ${where}
     GROUP BY r.id${viewerGroup}
     ORDER BY r.created_at DESC`,
    params
  );
  return enrichWithUsers(result.rows);
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
    const row = review.rows[0];

    const isNewUpvote = existingVote.rows.length === 0 && voteType === 'up';
    if (isNewUpvote && userId !== row.user_id) {
      getUsername(userId).then((actorName) =>
        publishInteractionEvent('review_upvoted', { reviewId, ownerId: row.user_id, actorId: userId, actorName, restaurantId: row.restaurant_id })
      ).catch(() => {});
    }

    return row;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

const VALID_REPORT_REASONS = [
  'inappropriate_content',
  'misleading_content',
  'false_information',
  'spam',
  'hate_speech',
  'harassment',
  'other',
];

const reportReview = async (reviewId, userId, reason, comment) => {
  const normalizedReason = VALID_REPORT_REASONS.includes(reason) ? reason : 'other';
  await pool.query(
    `INSERT INTO reports (review_id, user_id, reason, comment)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (review_id, user_id) DO UPDATE
       SET reason = EXCLUDED.reason, comment = EXCLUDED.comment`,
    [reviewId, userId, normalizedReason, comment || null]
  );
};

const getReportedReviews = async () => {
  const result = await pool.query(`
    SELECT
      r.*,
      COUNT(rp.id)::int AS report_count,
      json_agg(json_build_object(
        'id', rp.id,
        'user_id', rp.user_id,
        'reason', rp.reason,
        'comment', rp.comment,
        'created_at', rp.created_at
      ) ORDER BY rp.created_at DESC) AS reports,
      json_object_agg(rp.reason, reason_counts.cnt) AS reason_breakdown
    FROM reviews r
    JOIN reports rp ON rp.review_id = r.id
    JOIN (
      SELECT review_id, reason, COUNT(*)::int AS cnt
      FROM reports GROUP BY review_id, reason
    ) reason_counts ON reason_counts.review_id = r.id AND reason_counts.reason = rp.reason
    GROUP BY r.id
    ORDER BY report_count DESC
  `);
  return enrichWithUsers(result.rows);
};

const getReviewReports = async (reviewId) => {
  const reviewResult = await pool.query('SELECT * FROM reviews WHERE id = $1', [reviewId]);
  if (reviewResult.rows.length === 0) throw new Error('Reseña no encontrada');

  const reportsResult = await pool.query(`
    SELECT id, user_id, reason, comment, created_at
    FROM reports WHERE review_id = $1 ORDER BY created_at DESC
  `, [reviewId]);

  const reports = reportsResult.rows;
  const reasonBreakdown = {};
  for (const rp of reports) {
    reasonBreakdown[rp.reason] = (reasonBreakdown[rp.reason] || 0) + 1;
  }

  const enriched = await enrichWithUsers(reports.map((rp) => ({ ...rp, user_id: rp.user_id })));

  return {
    review: reviewResult.rows[0],
    total_reports: reports.length,
    reason_breakdown: reasonBreakdown,
    reports: enriched,
  };
};

const hideReview = async (reviewId) => {
  const result = await pool.query(
    'UPDATE reviews SET hidden = TRUE WHERE id = $1 RETURNING *',
    [reviewId]
  );
  if (result.rows.length === 0) throw new Error('Reseña no encontrada');
  return result.rows[0];
};

const unhideReview = async (reviewId) => {
  const result = await pool.query(
    'UPDATE reviews SET hidden = FALSE WHERE id = $1 RETURNING *',
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

const getAdminStats = async () => {
  const [
    reviewTotals,
    starDist,
    reviewsByMonth,
    reportTotals,
    reasonDist,
    topReported,
    topRestaurants,
    moderationStatus,
  ] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS total, ROUND(AVG(stars), 2) AS avg_stars FROM reviews`),

    pool.query(`
      SELECT stars, COUNT(*)::int AS count
      FROM reviews GROUP BY stars ORDER BY stars
    `),

    pool.query(`
      SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
             COUNT(*)::int AS count
      FROM reviews
      WHERE created_at >= NOW() - INTERVAL '12 months'
      GROUP BY month ORDER BY month
    `),

    pool.query(`
      SELECT COUNT(*)::int AS total_reports,
             COUNT(DISTINCT review_id)::int AS reported_reviews,
             COUNT(DISTINCT user_id)::int AS reporters
      FROM reports
    `),

    pool.query(`
      SELECT reason, COUNT(*)::int AS count
      FROM reports GROUP BY reason ORDER BY count DESC
    `),

    pool.query(`
      SELECT r.id, r.restaurant_id, r.user_id, r.stars, r.comment, r.hidden,
             COUNT(rp.id)::int AS report_count
      FROM reviews r
      JOIN reports rp ON rp.review_id = r.id
      GROUP BY r.id ORDER BY report_count DESC LIMIT 10
    `),

    pool.query(`
      SELECT r.restaurant_id,
             rs.name AS restaurant_name,
             COUNT(*)::int AS review_count,
             ROUND(AVG(r.stars), 2) AS avg_stars,
             SUM(r.likes_count)::int AS total_likes
      FROM reviews r
      JOIN restaurants rs ON rs.id = r.restaurant_id
      WHERE r.hidden = FALSE
      GROUP BY r.restaurant_id, rs.name ORDER BY review_count DESC LIMIT 10
    `),

    pool.query(`
      SELECT
        COUNT(*)::int AS total,
        SUM(CASE WHEN hidden = TRUE THEN 1 ELSE 0 END)::int AS hidden,
        SUM(CASE WHEN hidden = FALSE THEN 1 ELSE 0 END)::int AS visible
      FROM reviews
    `),
  ]);

  const enrichedTopReported = await enrichWithUsers(topReported.rows);

  return {
    reviews: {
      total: reviewTotals.rows[0].total,
      avg_stars: Number(reviewTotals.rows[0].avg_stars),
      by_stars: starDist.rows,
      by_month: reviewsByMonth.rows,
      moderation: moderationStatus.rows[0],
    },
    reports: {
      total_reports: reportTotals.rows[0].total_reports,
      reported_reviews: reportTotals.rows[0].reported_reviews,
      unique_reporters: reportTotals.rows[0].reporters,
      by_reason: reasonDist.rows,
      top_reported_reviews: enrichedTopReported,
    },
    restaurants: {
      top_by_reviews: topRestaurants.rows,
    },
  };
};

const toggleLike = async (reviewId, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query(
      'SELECT id FROM likes WHERE review_id = $1 AND user_id = $2',
      [reviewId, userId]
    );

    let liked;
    if (existing.rows.length > 0) {
      await client.query('DELETE FROM likes WHERE review_id = $1 AND user_id = $2', [reviewId, userId]);
      await client.query('UPDATE reviews SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = $1', [reviewId]);
      liked = false;
    } else {
      await client.query('INSERT INTO likes (review_id, user_id) VALUES ($1, $2)', [reviewId, userId]);
      await client.query('UPDATE reviews SET likes_count = likes_count + 1 WHERE id = $1', [reviewId]);
      liked = true;
    }

    await client.query('COMMIT');
    const review = await client.query('SELECT user_id, restaurant_id, likes_count FROM reviews WHERE id = $1', [reviewId]);
    const { user_id: ownerId, restaurant_id: restaurantId, likes_count } = review.rows[0];

    if (liked && userId !== ownerId) {
      getUsername(userId).then((actorName) =>
        publishInteractionEvent('review_liked', { reviewId, ownerId, actorId: userId, actorName, restaurantId })
      ).catch(() => {});
    }

    return { liked, likes_count };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

const getComments = async (reviewId) => {
  const result = await pool.query(
    `SELECT c.*, '' AS user_name, '' AS user_avatar
     FROM comments c
     WHERE c.review_id = $1
     ORDER BY c.created_at ASC`,
    [reviewId]
  );
  const comments = result.rows;
  if (comments.length === 0) return comments;

  const ids = [...new Set(comments.map((c) => c.user_id))];
  try {
    const res = await fetch(`${process.env.USER_SERVICE_URL}/api/users/internal/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) return comments;
    const usersMap = await res.json();
    return comments.map((c) => ({
      ...c,
      user_name: usersMap[c.user_id]?.name || '',
      user_avatar: usersMap[c.user_id]?.avatar || '',
    }));
  } catch {
    return comments;
  }
};

const addComment = async (reviewId, userId, text) => {
  const reviewExists = await pool.query(
    'SELECT id, user_id, restaurant_id FROM reviews WHERE id = $1 AND hidden = FALSE',
    [reviewId]
  );
  if (reviewExists.rows.length === 0) throw new Error('Reseña no encontrada');

  const result = await pool.query(
    'INSERT INTO comments (review_id, user_id, text) VALUES ($1, $2, $3) RETURNING *',
    [reviewId, userId, text]
  );

  const { user_id: ownerId, restaurant_id: restaurantId } = reviewExists.rows[0];
  if (userId !== ownerId) {
    getUsername(userId).then((actorName) =>
      publishInteractionEvent('review_commented', { reviewId, ownerId, actorId: userId, actorName, restaurantId, text })
    ).catch(() => {});
  }

  return result.rows[0];
};

const deleteComment = async (commentId, userId) => {
  const result = await pool.query(
    'DELETE FROM comments WHERE id = $1 AND user_id = $2 RETURNING id',
    [commentId, userId]
  );
  if (result.rows.length === 0) throw new Error('Comentario no encontrado o no tienes permiso');
};

module.exports = {
  storeRestaurant,
  createReview,
  getReviews,
  getSegmentedScores,
  computeRestaurantStats,
  addVote,
  toggleLike,
  getComments,
  addComment,
  deleteComment,
  reportReview,
  getReportedReviews,
  getReviewReports,
  hideReview,
  unhideReview,
  deleteReview,
  getAdminStats,
  VALID_REPORT_REASONS,
};
