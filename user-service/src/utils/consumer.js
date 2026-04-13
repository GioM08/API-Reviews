const amqp = require('amqplib');
const userService = require('../services/user.service'); // Asegúrate de importar tu servicio

const consumeUserCreated = async () => {
  let connection; // Definir fuera para poder cerrarla si falla algo después
  try {
    console.log(" [.] Intentando conectar a RabbitMQ...");
    connection = await amqp.connect(process.env.RABBITMQ_URL);
    
    // Si llegamos aquí, la conexión es exitosa (lo que dice el log de Rabbit)
    const channel = await connection.createChannel();
    console.log(" [v] Canal creado con éxito");

    const exchangeName = 'user_events';
    const queueName = 'user_created_queue';

    // Asegurar infraestructura
    await channel.assertExchange(exchangeName, 'fanout', { durable: true });
    const q = await channel.assertQueue(queueName, { durable: true });
    await channel.bindQueue(q.queue, exchangeName, '');

    console.log(` [*] Escuchando en ${queueName}...`);

    channel.consume(q.queue, async (msg) => {
      if (msg !== null) {
        try {
          const userData = JSON.parse(msg.content.toString());
          await userService.createInitialProfile(userData);
          channel.ack(msg);
        } catch (err) {
          console.error(" [!] Error en procesamiento:", err.message);
        }
      }
    }, { noAck: false });

  } catch (error) {
    // Especificamos el error para no adivinar
    console.error(" [X] Error detallado:", error.message);
    
    // Si la conexión se alcanzó a abrir pero falló algo después, la cerramos
    if (connection) await connection.close().catch(() => {});
    
    console.log(" [!] Reintentando en 5s...");
    setTimeout(consumeUserCreated, 5000);
  }
};

module.exports = { consumeUserCreated };