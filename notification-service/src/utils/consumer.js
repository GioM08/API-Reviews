const amqp = require('amqplib');
const Notification = require('../models/notification.model');
const DeviceToken = require('../models/device_token.model');
const { sendPush } = require('./firebase');

const HANDLERS = {
  // ── Amistad ──────────────────────────────────────────────
  friend_request_sent: (payload) => [{
    userId: payload.recipientId,
    type: 'friend_request_sent',
    title: 'Nueva solicitud de amistad',
    body: 'Alguien quiere ser tu amigo.',
    data: { requesterId: payload.requesterId },
  }],

  friend_request_accepted: (payload) => [{
    userId: payload.requesterId,
    type: 'friend_request_accepted',
    title: 'Solicitud aceptada',
    body: '¡Tu solicitud de amistad fue aceptada!',
    data: { recipientId: payload.recipientId },
  }],

  // ── Planes ───────────────────────────────────────────────
  plan_proposed: (payload) =>
    (payload.participantIds || []).map((uid) => ({
      userId: uid,
      type: 'plan_proposed',
      title: 'Nueva propuesta de quedada',
      body: `Te han propuesto una quedada en ${payload.restaurantName || 'un restaurante'}.`,
      data: { planId: payload.planId, restaurantId: payload.restaurantId },
    })),

  plan_accepted: (payload) => [{
    userId: payload.proposerId || payload.userId,
    type: 'plan_accepted',
    title: 'Quedada aceptada',
    body: 'Un amigo aceptó tu propuesta de quedada.',
    data: { planId: payload.planId },
  }],

  plan_rejected: (payload) => [{
    userId: payload.proposerId || payload.userId,
    type: 'plan_rejected',
    title: 'Quedada rechazada',
    body: 'Un amigo rechazó tu propuesta de quedada.',
    data: { planId: payload.planId },
  }],

  plan_completed: (payload) =>
    (payload.participants || []).map((uid) => ({
      userId: uid,
      type: 'plan_completed',
      title: '¿Qué tal la quedada?',
      body: `¡Comparte tu opinión sobre ${payload.restaurantName || 'el restaurante'}!`,
      data: { planId: payload.planId, restaurantId: payload.restaurantId },
    })),

  // ── Interacciones en reseñas — actorName ya viene en el payload ──
  review_liked: (payload) => [{
    userId: payload.ownerId,
    type: 'review_liked',
    title: `${payload.actorName || 'Alguien'} le dio like a tu reseña`,
    body: '',
    data: { reviewId: payload.reviewId, actorId: payload.actorId, restaurantId: payload.restaurantId },
  }],

  review_upvoted: (payload) => [{
    userId: payload.ownerId,
    type: 'review_upvoted',
    title: `${payload.actorName || 'Alguien'} votó tu reseña`,
    body: '',
    data: { reviewId: payload.reviewId, actorId: payload.actorId, restaurantId: payload.restaurantId },
  }],

  review_commented: (payload) => [{
    userId: payload.ownerId,
    type: 'review_commented',
    title: `${payload.actorName || 'Alguien'} comentó tu reseña`,
    body: payload.text?.length > 60 ? payload.text.slice(0, 60) + '…' : (payload.text || ''),
    data: { reviewId: payload.reviewId, actorId: payload.actorId, restaurantId: payload.restaurantId },
  }],
};

const pushToUsers = async (notifications) => {
  const userIds = [...new Set(notifications.map((n) => n.userId))];
  const tokenDocs = await DeviceToken.find({ userId: { $in: userIds } });

  const tokensByUser = {};
  for (const doc of tokenDocs) {
    if (!tokensByUser[doc.userId]) tokensByUser[doc.userId] = [];
    tokensByUser[doc.userId].push(doc.token);
  }

  const invalidTokens = [];
  for (const notif of notifications) {
    const tokens = tokensByUser[notif.userId] || [];
    if (tokens.length === 0) continue;
    const { invalidTokens: bad } = await sendPush(tokens, {
      title: notif.title,
      body: notif.body,
      data: notif.data,
    });
    invalidTokens.push(...bad);
  }

  if (invalidTokens.length > 0) {
    await DeviceToken.deleteMany({ token: { $in: invalidTokens } });
    console.log(` [v] Tokens inválidos eliminados: ${invalidTokens.length}`);
  }
};

const handleMessage = async (msg, channel) => {
  if (!msg) return;
  try {
    const payload = JSON.parse(msg.content.toString());
    const { eventType, ...data } = payload;

    const handler = HANDLERS[eventType];
    if (!handler) {
      channel.ack(msg);
      return;
    }

    const notifications = handler(data);

    await Notification.insertMany(notifications);
    console.log(` [v] Notificaciones creadas [${eventType}]:`, notifications.length);

    pushToUsers(notifications).catch((err) =>
      console.error(' [!] Error FCM push:', err.message)
    );

    channel.ack(msg);
  } catch (err) {
    console.error(' [!] Error procesando notificación:', err.message, err.stack);
    channel.nack(msg, false, false);
  }
};

const consumeExchange = async (channel, exchangeName, queueName) => {
  await channel.assertExchange(exchangeName, 'fanout', { durable: true });
  const q = await channel.assertQueue(queueName, { durable: true });
  await channel.bindQueue(q.queue, exchangeName, '');
  channel.consume(q.queue, (msg) => handleMessage(msg, channel), { noAck: false });
  console.log(` [*] Notification-Service: escuchando ${queueName}`);
};

const startConsumers = async () => {
  let connection;
  try {
    console.log(' [.] Notification-Service: conectando a RabbitMQ...');
    connection = await amqp.connect(process.env.RABBITMQ_URL);

    connection.on('error', (err) => {
      console.error(' [!] Conexión RabbitMQ error:', err.message);
    });
    connection.on('close', () => {
      console.log(' [!] Conexión RabbitMQ cerrada, reconectando en 5s...');
      setTimeout(startConsumers, 5000);
    });

    const channel = await connection.createChannel();

    channel.on('error', (err) => {
      console.error(' [!] Canal RabbitMQ error:', err.message);
    });
    channel.on('close', () => {
      console.log(' [!] Canal RabbitMQ cerrado');
    });

    await consumeExchange(channel, 'plan_events',                'notification_plan_queue');
    await consumeExchange(channel, 'friendship_events',          'notification_friendship_queue');
    await consumeExchange(channel, 'review_interaction_events',  'notification_interaction_queue');

    console.log(' [v] Consumers activos, esperando mensajes...');

  } catch (error) {
    console.error(' [X] Error en consumers:', error.message);
    if (connection) await connection.close().catch(() => {});
    setTimeout(startConsumers, 5000);
  }
};

module.exports = { startConsumers };
