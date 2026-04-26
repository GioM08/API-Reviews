const Plan = require('../models/plan.model');
const Friendship = require('../models/friendship.model');
const { publishPlanEvent } = require('../utils/broker.util');

const areFriends = async (userId, friendId) => {
  const f = await Friendship.findOne({
    $or: [
      { requesterId: userId, recipientId: friendId },
      { requesterId: friendId, recipientId: userId },
    ],
    status: 'accepted',
  });
  return !!f;
};

const createPlan = async ({ restaurantId, restaurantName, participantIds, proposedDate, context }, proposerId) => {
  for (const pid of participantIds) {
    const friends = await areFriends(proposerId, pid);
    if (!friends) throw new Error(`El usuario ${pid} no es tu amigo`);
  }

  const participants = participantIds.map((uid) => ({ userId: uid, status: 'pending' }));

  const plan = await Plan.create({
    restaurantId,
    restaurantName: restaurantName || '',
    proposerId,
    participants,
    proposedDate: new Date(proposedDate),
    context: context || {},
    status: 'proposed',
  });

  await publishPlanEvent('plan_proposed', {
    planId: plan._id.toString(),
    restaurantId,
    restaurantName,
    proposerId,
    participantIds,
    proposedDate,
    context,
  });

  return plan;
};

const respondToPlan = async (planId, userId, response) => {
  const plan = await Plan.findById(planId);
  if (!plan) throw new Error('Plan no encontrado');

  const participant = plan.participants.find((p) => p.userId === userId);
  if (!participant) throw new Error('No estás invitado a este plan');
  if (participant.status !== 'pending') throw new Error('Ya respondiste a este plan');

  participant.status = response;

  const allResponded = plan.participants.every((p) => p.status !== 'pending');
  if (allResponded) {
    const anyRejected = plan.participants.some((p) => p.status === 'rejected');
    plan.status = anyRejected ? 'rejected' : 'accepted';
  }

  await plan.save();

  await publishPlanEvent(`plan_${response}`, {
    planId: plan._id.toString(),
    userId,
    planStatus: plan.status,
  });

  return plan;
};

const completePlan = async (planId, userId) => {
  const plan = await Plan.findById(planId);
  if (!plan) throw new Error('Plan no encontrado');
  if (plan.proposerId !== userId) throw new Error('Solo el proponente puede completar el plan');
  if (plan.status !== 'accepted') throw new Error('El plan debe estar aceptado para completarse');

  plan.status = 'completed';
  plan.completedAt = new Date();
  await plan.save();

  const allParticipants = [plan.proposerId, ...plan.participants.map((p) => p.userId)];

  await publishPlanEvent('plan_completed', {
    planId: plan._id.toString(),
    restaurantId: plan.restaurantId,
    participants: allParticipants,
    context: plan.context,
  });

  return plan;
};

const getMyPlans = async (userId) => {
  return Plan.find({
    $or: [{ proposerId: userId }, { 'participants.userId': userId }],
  }).sort({ createdAt: -1 });
};

const getPlanById = async (planId, userId) => {
  const plan = await Plan.findById(planId);
  if (!plan) throw new Error('Plan no encontrado');

  const isInvolved =
    plan.proposerId === userId ||
    plan.participants.some((p) => p.userId === userId);
  if (!isInvolved) throw new Error('No tienes acceso a este plan');

  return plan;
};

module.exports = {
  createPlan,
  respondToPlan,
  completePlan,
  getMyPlans,
  getPlanById,
};
