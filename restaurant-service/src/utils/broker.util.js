const amqp = require('amqplib');

const publishRestaurantCreated = async (restaurantData) => {
  const url = process.env.RABBITMQ_URL;
  let connection;

  for (let i = 0; i < 5; i++) {
    try {
      connection = await amqp.connect(url);
      break;
    } catch (err) {
      if (i === 4) throw err;
      console.log(`[!] RabbitMQ no responde, reintentando en 5s... (Intento ${i + 1}/5)`);
      await new Promise(res => setTimeout(res, 5000));
    }
  }

  try {
    const channel = await connection.createChannel();
    const exchangeName = 'restaurant_events';

    await channel.assertExchange(exchangeName, 'fanout', { durable: true });

    const sent = channel.publish(
      exchangeName,
      '',
      Buffer.from(JSON.stringify(restaurantData)),
      { persistent: true }
    );

    if (sent) console.log(' [x] Evento de restaurante enviado al Exchange:', restaurantData);

    setTimeout(async () => await connection.close(), 500);
  } catch (error) {
    console.error('Error en broker de restaurante:', error);
  }
};

module.exports = { publishRestaurantCreated };
