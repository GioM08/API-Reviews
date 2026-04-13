const amqp = require('amqplib');

const publishUserCreated = async (userData) => {
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
    const exchangeName = 'user_events';
    const exchangeType = 'fanout';

    await channel.assertExchange(exchangeName, exchangeType, { durable: true });

    const sent = channel.publish(
      exchangeName,
      '',
      Buffer.from(JSON.stringify(userData)),
      { persistent: true }
    );

    if (sent) {
      console.log(" [x] Evento enviado al Exchange:", userData);
    }


    setTimeout(async () => {
      await connection.close();
    }, 500);

  } catch (error) {
    console.error("Error en la lógica del Exchange:", error);
  }
};

module.exports = { publishUserCreated };