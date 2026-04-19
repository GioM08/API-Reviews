const amqp = require('amqplib');
const { updateScore } = require('../services/restaurant.service');

const consumeReviewCreated = async () => {
  let connection;
  try {
    console.log(' [.] Restaurant-Service: conectando a RabbitMQ...');
    connection = await amqp.connect(process.env.RABBITMQ_URL);
    const channel = await connection.createChannel();
    console.log(' [v] Canal creado con éxito');

    const exchangeName = 'review_events';
    const queueName = 'restaurant_review_queue';

    await channel.assertExchange(exchangeName, 'fanout', { durable: true });
    const q = await channel.assertQueue(queueName, { durable: true });
    await channel.bindQueue(q.queue, exchangeName, '');

    console.log(` [*] Restaurant-Service: escuchando en ${queueName}...`);

    channel.consume(q.queue, async (msg) => {
      if (msg !== null) {
        try {
          const reviewData = JSON.parse(msg.content.toString());
          await updateScore(reviewData.restaurantId, reviewData.stars);
          console.log(` [v] Score actualizado para restaurante ${reviewData.restaurantId}`);
          channel.ack(msg);
        } catch (err) {
          console.error(' [!] Error actualizando score:', err.message);
        }
      }
    }, { noAck: false });

  } catch (error) {
    console.error(' [X] Error en consumer de restaurant-service:', error.message);
    if (connection) await connection.close().catch(() => {});
    console.log(' [!] Reintentando en 5s...');
    setTimeout(consumeReviewCreated, 5000);
  }
};

module.exports = { consumeReviewCreated };
