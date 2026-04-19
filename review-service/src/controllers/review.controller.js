const service = require('../services/review.service');
const { z } = require('zod');

const mediaItemSchema = z.object({
  url: z.string().url('La URL del archivo no es válida'),
  media_type: z.enum(['image', 'video'], { error: 'media_type debe ser "image" o "video"' }),
  filename: z.string().optional(),
});

const createSchema = z.object({
  restaurantId: z.number().int().positive('El restaurantId debe ser un número positivo'),
  stars: z.number().int().min(1).max(5, 'Las estrellas deben estar entre 1 y 5'),
  comment: z.string().optional(),
  media: z.array(mediaItemSchema).optional().default([]),
});

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

    if (!restaurantId && !userId) {
      return res.status(400).json({ error: 'Se requiere restaurantId o userId' });
    }

    const reviews = await service.getReviews({ restaurantId, userId });
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

module.exports = {
  healthCheck,
  createReview,
  getReviews,
  voteReview,
  reportReview,
  getReportedReviews,
  hideReview,
  deleteReview,
};
