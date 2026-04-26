const express = require('express');
const router = express.Router();
const controller = require('../controllers/notification.controller');
const auth = require('../middlewares/auth.middleware');

router.use(auth);

router.get('/', controller.getMyNotifications);
router.get('/unread-count', controller.getUnreadCount);
router.patch('/read-all', controller.markAllAsRead);
router.patch('/:id/read', controller.markAsRead);

// FCM device tokens
router.post('/token', controller.registerToken);
router.delete('/token', controller.removeToken);

module.exports = router;
