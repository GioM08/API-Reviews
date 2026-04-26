const express = require('express');
const {
  healthCheck, createReview, getReviews, getSegmentedScores,
  voteReview, reportReview, getReportedReviews, hideReview, deleteReview,
  toggleLike, getComments, addComment, deleteComment,
} = require('../controllers/review.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const adminMiddleware = require('../middlewares/admin.middleware');
const optionalAuth = require('../middlewares/optional.auth.middleware');

const router = express.Router();

router.get('/health', healthCheck);

// Scores segmentados por contexto
router.get('/restaurant/:id/segmented', getSegmentedScores);

// Usuario
router.get('/', optionalAuth, getReviews);
router.post('/', authMiddleware, createReview);
router.post('/:id/vote', authMiddleware, voteReview);
router.post('/:id/report', authMiddleware, reportReview);

// Likes (toggle: 1 like por perfil por reseña)
router.post('/:id/like', authMiddleware, toggleLike);

// Comments (ilimitados por perfil)
router.get('/:id/comments', getComments);
router.post('/:id/comments', authMiddleware, addComment);
router.delete('/:id/comments/:commentId', authMiddleware, deleteComment);

// Admin
router.get('/reported', authMiddleware, adminMiddleware, getReportedReviews);
router.patch('/:id/hide', authMiddleware, adminMiddleware, hideReview);
router.delete('/:id', authMiddleware, adminMiddleware, deleteReview);

module.exports = router;
