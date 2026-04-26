const amqp = require('amqplib');

const connectWithRetry = async (url) => {
  for (let i = 0; i < 5; i++) {
    try {
      return await amqp.connect(url);
    } catch (err) {
      if (i === 4) throw err;
      console.log(`[!] RabbitMQ no responde, reintentando... (${i + 1}/5)`);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
};

const publish = async (exchangeName, eventType, payload) => {
  const connection = await connectWithRetry(process.env.RABBITMQ_URL);
  try {
    const channel = await connection.createChannel();
    await channel.assertExchange(exchangeName, 'fanout', { durable: true });
    const message = { eventType, ...payload };
    channel.publish(exchangeName, '', Buffer.from(JSON.stringify(message)), { persistent: true });
    console.log(` [x] ${exchangeName} [${eventType}]:`, payload);
    setTimeout(async () => connection.close(), 500);
  } catch (error) {
    console.error(`Error publicando ${exchangeName}:`, error);
  }
};

const publishPlanEvent = (eventType, payload) => publish('plan_events', eventType, payload);
const publishFriendshipEvent = (eventType, payload) => publish('friendship_events', eventType, payload);

module.exports = { publishPlanEvent, publishFriendshipEvent };
