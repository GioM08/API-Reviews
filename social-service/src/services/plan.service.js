const Plan = require('../models/plan.model');
const Friendship = require('../models/friendship.model');
const { publishPlanEvent } = require('../utils/broker.util');

class ETagMismatchError extends Error {
  constructor() {
    super('El plan fue modificado por otra acción. Recarga e intenta de nuevo.');
    this.name = 'ETagMismatchError';
  }
}

const getETag = (plan) => plan.updatedAt.toISOString();

const checkETag = (plan, etag) => {
  if (etag && getETag(plan) !== etag) throw new ETagMismatchError();
};

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

const respondToPlan = async (planId, userId, response, etag) => {
  const plan = await Plan.findById(planId);
  if (!plan) throw new Error('Plan no encontrado');

  checkETag(plan, etag);

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

const completePlan = async (planId, userId, etag) => {
  const plan = await Plan.findById(planId);
  if (!plan) throw new Error('Plan no encontrado');

  checkETag(plan, etag);

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

const updatePlanDate = async (planId, userId, proposedDate, etag) => {
  const plan = await Plan.findById(planId);
  if (!plan) throw new Error('Plan no encontrado');

  const isProposer = plan.proposerId === userId;
  const isActiveParticipant = plan.participants.some(
    (p) => p.userId === userId && p.status !== 'rejected',
  );
  if (!isProposer && !isActiveParticipant) throw new Error('No tienes acceso a este plan');
  if (plan.status === 'completed') throw new Error('No se puede modificar un plan completado');

  checkETag(plan, etag);

  plan.proposedDate = new Date(proposedDate);
  plan.status = 'proposed';
  for (const p of plan.participants) {
    p.status = 'pending';
  }
  if (!isProposer) {
    const self = plan.participants.find((p) => p.userId === userId);
    if (self) self.status = 'accepted';
  }

  await plan.save();

  const usersMap = await fetchUsersMap([userId]);
  const callerName = usersMap[userId]?.name || 'Alguien';

  const allIds = [plan.proposerId, ...plan.participants.map((p) => p.userId)];
  const recipientIds = allIds.filter((id) => id !== userId);

  await publishPlanEvent('plan_date_changed', {
    planId: plan._id.toString(),
    callerName,
    proposedDate: plan.proposedDate.toISOString(),
    recipientIds,
  });

  return plan;
};

const inviteParticipants = async (planId, userId, participantIds) => {
  const plan = await Plan.findById(planId);
  if (!plan) throw new Error('Plan no encontrado');
  if (plan.proposerId !== userId) throw new Error('Solo el proponente puede invitar participantes');
  if (plan.status === 'completed' || plan.status === 'rejected') {
    throw new Error('No se pueden añadir participantes a un plan finalizado');
  }

  for (const pid of participantIds) {
    const friends = await areFriends(userId, pid);
    if (!friends) throw new Error(`El usuario ${pid} no es tu amigo`);

    const alreadyInvited = plan.participants.some((p) => p.userId === pid);
    if (!alreadyInvited) {
      plan.participants.push({ userId: pid, status: 'pending' });
    }
  }

  await plan.save();
  return plan;
};

const removeParticipant = async (planId, userId, targetUserId, etag) => {
  const plan = await Plan.findById(planId);
  if (!plan) throw new Error('Plan no encontrado');

  checkETag(plan, etag);

  if (plan.proposerId !== userId) throw new Error('Solo el proponente puede eliminar participantes');
  if (plan.status === 'completed') throw new Error('No se puede modificar un plan completado');

  const idx = plan.participants.findIndex((p) => p.userId === targetUserId);
  if (idx === -1) throw new Error('Participante no encontrado en el plan');

  plan.participants.splice(idx, 1);

  if (plan.participants.length > 0) {
    const allResponded = plan.participants.every((p) => p.status !== 'pending');
    if (allResponded) {
      const anyRejected = plan.participants.some((p) => p.status === 'rejected');
      plan.status = anyRejected ? 'rejected' : 'accepted';
    }
  } else {
    plan.status = 'proposed';
  }

  await plan.save();
  return plan;
};

const fetchUsersMap = async (ids) => {
  if (ids.length === 0) return {};
  try {
    const res = await fetch(`${process.env.USER_SERVICE_URL}/api/users/internal/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    return res.ok ? await res.json() : {};
  } catch {
    return {};
  }
};

const enrichPlan = (planObj, usersMap) => {
  planObj.participants = planObj.participants.map((p) => ({
    ...p,
    name: usersMap[p.userId]?.name || '',
    avatar: usersMap[p.userId]?.avatar || '',
  }));
  return planObj;
};

const getMyPlans = async (userId) => {
  const plans = await Plan.find({
    $or: [{ proposerId: userId }, { 'participants.userId': userId }],
  }).sort({ createdAt: -1 });

  const allIds = [...new Set(plans.flatMap((p) => p.participants.map((pt) => pt.userId)))];
  const usersMap = await fetchUsersMap(allIds);

  return plans.map((plan) => enrichPlan(plan.toObject(), usersMap));
};

const getPlanById = async (planId, userId) => {
  const plan = await Plan.findById(planId);
  if (!plan) throw new Error('Plan no encontrado');

  const isInvolved =
    plan.proposerId === userId ||
    plan.participants.some((p) => p.userId === userId);
  if (!isInvolved) throw new Error('No tienes acceso a este plan');

  const ids = plan.participants.map((p) => p.userId);
  const usersMap = await fetchUsersMap(ids);
  return enrichPlan(plan.toObject(), usersMap);
};

module.exports = {
  ETagMismatchError,
  getETag,
  createPlan,
  respondToPlan,
  completePlan,
  updatePlanDate,
  inviteParticipants,
  removeParticipant,
  getMyPlans,
  getPlanById,
};