const express = require('express');
const router = express.Router();
const controller = require('../controllers/plan.controller');
const auth = require('../middlewares/auth.middleware');

router.use(auth);

router.get('/', controller.getMyPlans);
router.post('/', controller.createPlan);
router.get('/:id', controller.getPlanById);
router.post('/:id/accept', controller.acceptPlan);
router.post('/:id/reject', controller.rejectPlan);
router.patch('/:id/complete', controller.completePlan);

module.exports = router;
