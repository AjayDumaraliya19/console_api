var amqp = require("amqplib");
const { sendSlackMessage } = require("../../config/common");
var channel, connection;

const createNewRoundToQueue = async (taskType, data, delayInMills) => {
  try {
    const queueName = taskType;

    const INTERMEDIATE_QUEUE = `${queueName}_INTERMEDIATE_QUEUE`;
    const INTERMEDIATE_EXCHANGE = `${queueName}_INTERMEDIATE_EXCHANGE`;
    const INTERMEDIATE_EXCHANGE_TYPE = "fanout";

    const FINAL_QUEUE = queueName;
    const FINAL_EXCHANGE = `${queueName}_FINAL_EXCHANGE`;
    const FINAL_EXCHANGE_TYPE = "fanout";

    connection = await amqp.connect("amqp://localhost:5672");
    channel = await connection.createChannel();

    await channel
      .assertExchange(INTERMEDIATE_EXCHANGE, INTERMEDIATE_EXCHANGE_TYPE)
      .then((_) => channel.assertExchange(FINAL_EXCHANGE, FINAL_EXCHANGE_TYPE))
      .then((_) =>
        channel.assertQueue(INTERMEDIATE_QUEUE, {
          deadLetterExchange: FINAL_EXCHANGE,
        })
      )
      .then((_) => channel.assertQueue(FINAL_QUEUE, {}))
      .then((_) =>
        channel.bindQueue(INTERMEDIATE_QUEUE, INTERMEDIATE_EXCHANGE, "")
      )
      .then((_) => channel.bindQueue(FINAL_QUEUE, FINAL_EXCHANGE, ""))
      .then((_) => {
        channel.sendToQueue(
          INTERMEDIATE_QUEUE,
          Buffer.from(JSON.stringify(data)),
          {
            expiration: delayInMills,
          }
        );
      })
      .catch((error) => {
        sendSlackMessage(
          `An error occurred: ${error.message}\nStack Trace:\n${error.stack}`
        );
      });

    //channel.close();
    //connection.close();
  } catch (error) {
    await sendSlackMessage(
      `An error occurred: ${error.message}\nStack Trace:\n${error.stack}`
    );
  }
};

const updateRoundToQueue = async (taskType, data, delayInMills) => {
  try {
    const queueName = taskType;

    const INTERMEDIATE_QUEUE = `${queueName}_INTERMEDIATE_QUEUE`;
    const INTERMEDIATE_EXCHANGE = `${queueName}_INTERMEDIATE_EXCHANGE`;
    const INTERMEDIATE_EXCHANGE_TYPE = "fanout";

    const FINAL_QUEUE = queueName;
    const FINAL_EXCHANGE = `${queueName}_FINAL_EXCHANGE`;
    const FINAL_EXCHANGE_TYPE = "fanout";

    connection = await amqp.connect("amqp://localhost:5672");
    channel = await connection.createChannel();

    // Increase the limit for the connection or channel EventEmitter
    connection.setMaxListeners(20); // Set the limit for the connection
    channel.setMaxListeners(20); // Set the limit for the channel

    await channel
      .assertExchange(INTERMEDIATE_EXCHANGE, INTERMEDIATE_EXCHANGE_TYPE)
      .then((_) => channel.assertExchange(FINAL_EXCHANGE, FINAL_EXCHANGE_TYPE))
      .then((_) =>
        channel.assertQueue(INTERMEDIATE_QUEUE, {
          deadLetterExchange: FINAL_EXCHANGE,
        })
      )
      .then((_) => channel.assertQueue(FINAL_QUEUE, {}))
      .then((_) =>
        channel.bindQueue(INTERMEDIATE_QUEUE, INTERMEDIATE_EXCHANGE, "")
      )
      .then((_) => channel.bindQueue(FINAL_QUEUE, FINAL_EXCHANGE, ""))
      .then((_) => {
        channel.sendToQueue(
          INTERMEDIATE_QUEUE,
          Buffer.from(JSON.stringify(data)),
          {
            expiration: delayInMills,
          }
        );
      })
      .catch((error) => {
        sendSlackMessage(
          `An error occurred: ${error.message}\nStack Trace:\n${error.stack}`
        );
      });

    //channel.close();
    //connection.close();
  } catch (error) {
    await sendSlackMessage(
      `An error occurred: ${error.message}\nStack Trace:\n${error.stack}`
    );
  }
};

module.exports = {
  createNewRoundToQueue,
  updateRoundToQueue,
};
