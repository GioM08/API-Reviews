const service = require('../services/review.service');
const { z } = require('zod');

const mediaItemSchema = z.object({
  url: z.string().url('La URL del archivo no es válida'),
  media_type: z.enum(['image', 'video'], { error: 'media_type debe ser "image" o "video"' }),
  filename: z.string().optional(),
});

const contextSchema = z.object({
  moment: z.enum(['breakfast', 'lunch', 'dinner']).optional(),
  company: z.enum(['alone', 'couple', 'family', 'friends', 'work']).optional(),
  when: z.enum(['weekday', 'weekend']).optional(),
  price_range: z.enum(['0-50', '50-100', '100-200', '200+']).optional(),
}).optional().default({});

const createSchema = z.object({
  restaurantId: z.number().int().positive('El restaurantId debe ser un número positivo'),
  stars: z.number().int().min(1).max(5, 'Las estrellas deben estar entre 1 y 5').optional(),
  comment: z.string().optional(),
  context: contextSchema,
  planId: z.string().optional().nullable(),
  media: z.array(mediaItemSchema).optional().default([]),
  detailed_ratings: z.record(z.string(), z.number().int().min(1).max(5)).optional(),
  amenities: z.array(z.string()).optional().default([]),
}).refine(
  (d) => d.stars !== undefined || (d.detailed_ratings && Object.keys(d.detailed_ratings).length > 0),
  { message: 'Se requiere stars o detailed_ratings' }
);

const voteSchema = z.object({
  voteType: z.enum(['up', 'down'], { error: 'El voto debe ser "up" o "down"' }),
});

const reportSchema = z.object({
  reason: z.string().optional(),
});

const healthCheck = (req, res) => {
  res.json({ status: 'ok' });
};

const createReview = async (req, res) => {
  try {
    const data = createSchema.parse(req.body);
    const review = await service.createReview(data, req.user.id);
    res.status(201).json(review);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const getReviews = async (req, res) => {
  try {
    const restaurantId = req.query.restaurantId ? parseInt(req.query.restaurantId) : null;
    const userId = req.query.userId || null;
    const viewerId = req.user?.id || null;

    if (!restaurantId && !userId) {
      return res.status(400).json({ error: 'Se requiere restaurantId o userId' });
    }

    const reviews = await service.getReviews({ restaurantId, userId }, viewerId);
    res.json(reviews);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

const voteReview = async (req, res) => {
  try {
    const { voteType } = voteSchema.parse(req.body);
    const reviewId = parseInt(req.params.id);
    const review = await service.addVote(reviewId, req.user.id, voteType);
    res.json(review);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const reportReview = async (req, res) => {
  try {
    const { reason } = reportSchema.parse(req.body);
    const reviewId = parseInt(req.params.id);
    await service.reportReview(reviewId, req.user.id, reason);
    res.json({ message: 'Reseña reportada' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

// Admin
const getReportedReviews = async (req, res) => {
  try {
    const reviews = await service.getReportedReviews();
    res.json(reviews);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

const hideReview = async (req, res) => {
  try {
    const reviewId = parseInt(req.params.id);
    const review = await service.hideReview(reviewId);
    res.json(review);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const deleteReview = async (req, res) => {
  try {
    const reviewId = parseInt(req.params.id);
    await service.deleteReview(reviewId);
    res.json({ message: 'Reseña eliminada' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const getRestaurantStats = async (req, res) => {
  try {
    const restaurantId = parseInt(req.params.id);
    if (isNaN(restaurantId)) return res.status(400).json({ error: 'restaurantId inválido' });
    const stats = await service.computeRestaurantStats(restaurantId);
    res.json(stats);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

const getSegmentedScores = async (req, res) => {
  try {
    const restaurantId = parseInt(req.params.id);
    if (isNaN(restaurantId)) return res.status(400).json({ error: 'restaurantId inválido' });
    const scores = await service.getSegmentedScores(restaurantId);
    res.json(scores);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

const toggleLike = async (req, res) => {
  try {
    const reviewId = parseInt(req.params.id);
    const result = await service.toggleLike(reviewId, req.user.id);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const commentSchema = z.object({
  text: z.string().min(1, 'El comentario no puede estar vacío').max(500),
});

const getComments = async (req, res) => {
  try {
    const reviewId = parseInt(req.params.id);
    const comments = await service.getComments(reviewId);
    res.json(comments);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

const addComment = async (req, res) => {
  try {
    const { text } = commentSchema.parse(req.body);
    const reviewId = parseInt(req.params.id);
    const comment = await service.addComment(reviewId, req.user.id, text);
    res.status(201).json(comment);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const deleteComment = async (req, res) => {
  try {
    const commentId = parseInt(req.params.commentId);
    await service.deleteComment(commentId, req.user.id);
    res.json({ message: 'Comentario eliminado' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

module.exports = {
  healthCheck,
  createReview,
  getReviews,
  getRestaurantStats,
  getSegmentedScores,
  voteReview,
  reportReview,
  getReportedReviews,
  hideReview,
  deleteReview,
  toggleLike,
  getComments,
  addComment,
  deleteComment,
};
