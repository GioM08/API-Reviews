const amqp = require('amqplib');
const { storeRestaurant } = require('../services/review.service');

const consumeRestaurantCreated = async () => {
  let connection;
  try {
    console.log(' [.] Review-Service: conectando a RabbitMQ...');
    connection = await amqp.connect(process.env.RABBITMQ_URL);
    const channel = await connection.createChannel();
    console.log(' [v] Canal creado con éxito');

    const exchangeName = 'restaurant_events';
    const queueName = 'review_restaurant_queue';

    await channel.assertExchange(exchangeName, 'fanout', { durable: true });
    const q = await channel.assertQueue(queueName, { durable: true });
    await channel.bindQueue(q.queue, exchangeName, '');

    console.log(` [*] Review-Service: escuchando en ${queueName}...`);

    channel.consume(q.queue, async (msg) => {
      if (msg !== null) {
        try {
          const restaurantData = JSON.parse(msg.content.toString());
          await storeRestaurant(restaurantData);
          console.log(` [v] Restaurante almacenado localmente: ${restaurantData.name}`);
          channel.ack(msg);
        } catch (err) {
          console.error(' [!] Error almacenando restaurante:', err.message);
        }
      }
    }, { noAck: false });

  } catch (error) {
    console.error(' [X] Error en consumer de review-service:', error.message);
    if (connection) await connection.close().catch(() => {});
    console.log(' [!] Reintentando en 5s...');
    setTimeout(consumeRestaurantCreated, 5000);
  }
};

module.exports = { consumeRestaurantCreated };
