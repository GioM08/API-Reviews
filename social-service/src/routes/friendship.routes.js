const express = require('express');
const router = express.Router();
const controller = require('../controllers/friendship.controller');
const auth = require('../middlewares/auth.middleware');

router.use(auth);

router.get('/', controller.getMyFriends);
router.get('/requests', controller.getPendingRequests);
router.get('/status/:otherId', controller.getFriendshipStatus);
router.post('/request/:targetId', controller.sendRequest);
router.post('/accept/:requesterId', controller.acceptRequest);
router.post('/reject/:requesterId', controller.rejectRequest);
router.delete('/:friendId', controller.removeFriend);

module.exports = router;
