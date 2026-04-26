const service = require('../services/plan.service');
const { z } = require('zod');

const createSchema = z.object({
  restaurantId: z.number().int().positive(),
  restaurantName: z.string().optional().default(''),
  participantIds: z.array(z.string()).min(1, 'Debes invitar al menos un amigo'),
  proposedDate: z.string().refine((d) => !isNaN(Date.parse(d)), 'Fecha inválida'),
  context: z.object({
    moment: z.enum(['breakfast', 'lunch', 'dinner']).optional(),
    when: z.enum(['weekday', 'weekend']).optional(),
  }).optional().default({}),
});

const createPlan = async (req, res) => {
  try {
    const data = createSchema.parse(req.body);
    const plan = await service.createPlan(data, req.user.id);
    res.status(201).json(plan);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const acceptPlan = async (req, res) => {
  try {
    const plan = await service.respondToPlan(req.params.id, req.user.id, 'accepted');
    res.json(plan);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const rejectPlan = async (req, res) => {
  try {
    const plan = await service.respondToPlan(req.params.id, req.user.id, 'rejected');
    res.json(plan);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const completePlan = async (req, res) => {
  try {
    const plan = await service.completePlan(req.params.id, req.user.id);
    res.json(plan);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const getMyPlans = async (req, res) => {
  try {
    const plans = await service.getMyPlans(req.user.id);
    res.json(plans);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

const getPlanById = async (req, res) => {
  try {
    const plan = await service.getPlanById(req.params.id, req.user.id);
    res.json(plan);
  } catch (e) {
    res.status(404).json({ error: e.message });
  }
};

module.exports = {
  createPlan,
  acceptPlan,
  rejectPlan,
  completePlan,
  getMyPlans,
  getPlanById,
};
