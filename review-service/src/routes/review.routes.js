const express = require('express');
const {
  healthCheck, createReview, getReviews, voteReview,
  reportReview, getReportedReviews, hideReview, deleteReview,
} = require('../controllers/review.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const adminMiddleware = require('../middlewares/admin.middleware');

const router = express.Router();

router.get('/health', healthCheck);

// Usuario
router.get('/', getReviews);
router.post('/', authMiddleware, createReview);
router.post('/:id/vote', authMiddleware, voteReview);
router.post('/:id/report', authMiddleware, reportReview);

// Admin
router.get('/reported', authMiddleware, adminMiddleware, getReportedReviews);
router.patch('/:id/hide', authMiddleware, adminMiddleware, hideReview);
router.delete('/:id', authMiddleware, adminMiddleware, deleteReview);

module.exports = router;
