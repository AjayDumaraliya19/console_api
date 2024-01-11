const { sendDataToHub } = require("../../config/common");
const amqp = require("amqplib");
const {
  getGameDataById,
  createRound,
  updateRound,
  getLiveRunnerAll,
  getCardDetailsByRoundId,
  getGames,
  getCurrenRoundDataInRound,
  updateRunner,
} = require("../../model/repositories/gameRepository");
var channel, connection;
const { updateRoundToQueue } = require("../controllers/rmq-pub");
const moment = require("moment");
const { sendSlackMessage } = require("../../config/common");
const config = (module.exports = require("../../config/config.json"));

// async function connectToRabbitMQ() {
//     try {
//         connection = await amqp.connect("amqp://localhost:5672");
//         channel = await connection.createChannel();

//     } catch (error) {
//         await sendSlackMessage(`An error occurred: ${error.message}\nStack Trace:\n${error.stack}`);
//     }
// }

async function getAllGames() {
  try {
    const games = await getGames();
    if (games) {
      for (const game of games) {
        connectToCreateRoundQueue(`${game.Code}_create_round`, socket);
        connectToUpdateRoundQueue(`${game.Code}_update_round`, socket);
      }
    }
  } catch (error) {
    console.error(error);
  }
}

async function connectToCreateRoundQueue(queueName, socket) {
  try {
    const FINAL_QUEUE = queueName;
    const FINAL_EXCHANGE = `${queueName}_FINAL_EXCHANGE`;
    const FINAL_EXCHANGE_TYPE = "fanout";

    connection = await amqp.connect("amqp://localhost:5672");
    channel = await connection.createChannel();

    // Increase the limit for the connection or channel EventEmitter
    connection.setMaxListeners(20); // Set the limit for the connection
    channel.setMaxListeners(20); // Set the limit for the channel

    // https://amqp-node.github.io/amqplib/channel_api.html#channel_assertExchange
    await channel.assertExchange(FINAL_EXCHANGE, FINAL_EXCHANGE_TYPE);

    const q = await channel.assertQueue(FINAL_QUEUE, {});

    console.log("Waiting for messages....");

    // binding the queue
    const binding_key = "";
    channel.bindQueue(FINAL_QUEUE, FINAL_EXCHANGE, binding_key);

    console.log("consuming messages from queue: ", FINAL_QUEUE);
    channel.consume(
      FINAL_QUEUE,
      async (msg) => {
        if (msg.content) {
          //console.log("Received message: ", JSON.parse(msg.content.toString()));
          let round = JSON.parse(msg.content.toString());
          let updateCN = { cc: { rni: null, cr: null }, nc: { rni: null } };
          if (round.updateCN) {
            updateCN = round.updateCN;
            delete round.updateCN;
          }
          let getGameRound = await getCurrenRoundDataInRound(round.GameId);
          if (!getGameRound) {
            let result = await createRound(round);
            let gameDetail = await getGameDataById(round.GameId);
            let updateRounds = {
              RoundId: result[0],
              GameId: round.GameId,
              Status: config.ROUND.SUSPENDED_ROUND_STATUS,
              ModifiedBy: config.ROUND.MODIFIED_BY,
              ModifiedOn: moment().format("YYYY-MM-DD HH:mm:ss"),
            };
            const AllOdds = [];
            const Cards = [];
            const mainRunner = await getLiveRunnerAll(gameDetail.GameId);
            for (const runr of mainRunner) {
              if (runr.GroupId == 2) {
                let oddObj = {
                  rni: runr.RunnerId,
                  bk: parseFloat(parseFloat(runr.BackOdd).toFixed(2)),
                  ly: parseFloat(parseFloat(runr.LayOdd).toFixed(2)),
                  st: config.ROUND.CLOSED_ROUND_STATUS,
                };
                await updateRunner(gameDetail.GameId, runr.Name, {
                  BackOdd: runr.BackOdd,
                  LayOdd: runr.LayOdd,
                  Cards: runr.Cards,
                  ModifiedBy: 1,
                  ModifiedOn: moment().format("YYYY-MM-DD HH:mm:ss"),
                  Status: config.ROUND.CLOSED_ROUND_STATUS,
                });
                AllOdds.push(oddObj);
              } else if (
                gameDetail.Code == "32C" ||
                gameDetail.Code == "ARW" ||
                gameDetail.Code == "LS"
              ) {
                let oddObj = {
                  rni: runr.RunnerId,
                  bk: parseFloat(parseFloat(runr.BackOdd).toFixed(2)),
                  ly: parseFloat(0.0),
                  st: config.ROUND.DEFAULT_ROUND_STATUS,
                };
                if (runr.GroupId == 1) {
                  let card = {
                    rni: runr.RunnerId,
                    cr: "",
                    sc: "",
                  };
                  Cards.push(card);
                }
                AllOdds.push(oddObj);
                if (gameDetail.Code == "32C") {
                  await updateRunner(gameDetail.GameId, runr.Name, {
                    BackOdd: runr.BackOdd,
                    LayOdd: runr.LayOdd,
                    Cards: runr.Cards,
                    ModifiedBy: 1,
                    ModifiedOn: moment().format("YYYY-MM-DD HH:mm:ss"),
                    Score: runr.Score,
                    Status: runr.Status,
                  });
                } else {
                  await updateRunner(gameDetail.GameId, runr.Name, {
                    BackOdd: runr.BackOdd,
                    LayOdd: runr.LayOdd,
                    Cards: runr.Cards,
                    ModifiedBy: 1,
                    ModifiedOn: moment().format("YYYY-MM-DD HH:mm:ss"),
                    Status: config.ROUND.DEFAULT_ROUND_STATUS,
                  });
                }
              } else {
                let oddObj = {
                  rni: runr.RunnerId,
                  bk: parseFloat(config.TEEN_PATTI.PLAYER_A.BackOdd),
                  ly: parseFloat(config.TEEN_PATTI.PLAYER_A.LayOdd),
                  st: config.ROUND.DEFAULT_ROUND_STATUS,
                };
                if (runr.GroupId == 1 || runr.GroupId == 5) {
                  let card = {
                    rni: runr.RunnerId,
                    cr: "",
                    sc: "",
                  };
                  Cards.push(card);
                }
                AllOdds.push(oddObj);
                await updateRunner(gameDetail.GameId, runr.Name, {
                  BackOdd: runr.BackOdd,
                  LayOdd: runr.LayOdd,
                  Cards: runr.Cards,
                  ModifiedBy: 1,
                  ModifiedOn: moment().format("YYYY-MM-DD HH:mm:ss"),
                  Status: config.ROUND.DEFAULT_ROUND_STATUS,
                });
              }
            }
            let createRoundSendHub = {
              ri: result[0],
              gc: gameDetail.Code,
              cn: updateCN,
              crs: Cards,
              od: AllOdds,
              rs: null,
              sr: { rni: [] },
              st: config.ROUND.DEFAULT_ROUND_STATUS,
              iro: false,
              trs: gameDetail.GameSec,
              et: config.ROUND_CREATE_HUB_STATUS,
              ts: Date.now(),
            };
            await updateRoundToQueue(
              `${gameDetail.Code}_update_round`,
              updateRounds,
              gameDetail.GameSec * 1000
            );
            await sendDataToHub(createRoundSendHub, socket);
          }

          channel.ack(msg);
        }
      },
      { noAck: false }
    );

    // Handle channel closure event
    channel.on("close", async (reason) => {
      await sendSlackMessage(`Channel closed: ${reason}`);
      setTimeout(getAllGames(), 5000); // Reconnect after 5 seconds
      // Implement recovery logic here, such as reconnecting or exiting gracefully
    });

    //channel.close();
    //connection.close();
  } catch (error) {
    await sendSlackMessage(
      `An error occurred: ${error.message}\nStack Trace:\n${error.stack}`
    );
  }
}

async function connectToUpdateRoundQueue(queueName, socket) {
  try {
    const FINAL_QUEUE = queueName;
    const FINAL_EXCHANGE = `${queueName}_FINAL_EXCHANGE`;
    const FINAL_EXCHANGE_TYPE = "fanout";

    connection = await amqp.connect("amqp://localhost:5672");
    channel = await connection.createChannel();

    // Increase the limit for the connection or channel EventEmitter
    connection.setMaxListeners(20); // Set the limit for the connection
    channel.setMaxListeners(20); // Set the limit for the channel

    // https://amqp-node.github.io/amqplib/channel_api.html#channel_assertExchange
    await channel.assertExchange(FINAL_EXCHANGE, FINAL_EXCHANGE_TYPE);

    const q = await channel.assertQueue(FINAL_QUEUE, {});

    console.log("Waiting for messages....");

    // binding the queue
    const binding_key = "";
    channel.bindQueue(FINAL_QUEUE, FINAL_EXCHANGE, binding_key);

    console.log("consuming messages from queue: ", FINAL_QUEUE);
    channel.consume(
      FINAL_QUEUE,
      async (msg) => {
        if (msg.content) {
          //console.log("Received update round message: ", JSON.parse(msg.content.toString()));
          let updateRoundJson = JSON.parse(msg.content.toString());
          let roundId = updateRoundJson.RoundId;
          delete updateRoundJson.RoundId;
          let GameId = updateRoundJson.GameId;
          delete updateRoundJson.GameId;
          let updateCN = { cc: { rni: null, cr: null }, nc: { rni: null } };
          if (updateRoundJson.updateCN) {
            updateCN = updateRoundJson.updateCN;
            delete updateRoundJson.updateCN;
          }
          let gameDetail = await getGameDataById(GameId);
          let roundDetails = await getCardDetailsByRoundId(roundId);
          const AllOdds = [];
          let Cards = [];
          let createRoundSendHub = {
            ri: roundId,
            gc: gameDetail.Code,
            cn: updateCN,
            crs: [],
            od: [],
            rs: null,
            sr: { rni: [] },
            st: 4,
            iro: false,
            trs: 0,
            et: "",
            ts: Date.now(),
          };
          if (roundDetails.length > 0) {
            Cards = updateRoundJson.Cards;
            delete updateRoundJson.Cards;
            const mainRunner = await getLiveRunnerAll(gameDetail.GameId);
            for (const runr of mainRunner) {
              if (runr.GroupId == 2) {
                let oddObj = {
                  rni: runr.RunnerId,
                  bk: 0.0,
                  ly: 0.0,
                  st: config.ROUND.CLOSED_ROUND_STATUS,
                };
                AllOdds.push(oddObj);
                if (gameDetail.Code == "32C") {
                  await updateRunner(gameDetail.GameId, runr.Name, {
                    BackOdd: runr.BackOdd,
                    LayOdd: runr.LayOdd,
                    Cards: runr.Cards,
                    ModifiedBy: 1,
                    ModifiedOn: moment().format("YYYY-MM-DD HH:mm:ss"),
                    Status: runr.Status,
                    Score: runr.Score,
                  });
                } else {
                  await updateRunner(gameDetail.GameId, runr.Name, {
                    BackOdd: runr.BackOdd,
                    LayOdd: runr.LayOdd,
                    Cards: runr.Cards,
                    ModifiedBy: 1,
                    ModifiedOn: moment().format("YYYY-MM-DD HH:mm:ss"),
                    Status: config.ROUND.CLOSED_ROUND_STATUS,
                  });
                }
              } else {
                let oddObj = {
                  rni: runr.RunnerId,
                  bk: parseFloat(parseFloat(runr.BackOdd).toFixed(2)),
                  ly: parseFloat(parseFloat(runr.LayOdd).toFixed(2)),
                  st: config.ROUND.SUSPENDED_ROUND_STATUS,
                };
                AllOdds.push(oddObj);
                if (gameDetail.Code == "32C") {
                  await updateRunner(gameDetail.GameId, runr.Name, {
                    BackOdd: runr.BackOdd,
                    LayOdd: runr.LayOdd,
                    Cards: runr.Cards,
                    ModifiedBy: 1,
                    ModifiedOn: moment().format("YYYY-MM-DD HH:mm:ss"),
                    Status: runr.Status,
                    Score: runr.Score,
                  });
                } else {
                  await updateRunner(gameDetail.GameId, runr.Name, {
                    BackOdd: runr.BackOdd,
                    LayOdd: runr.LayOdd,
                    Cards: runr.Cards,
                    ModifiedBy: 1,
                    ModifiedOn: moment().format("YYYY-MM-DD HH:mm:ss"),
                    Status: config.ROUND.SUSPENDED_ROUND_STATUS,
                  });
                }
              }
            }
            createRoundSendHub.od = AllOdds;
            createRoundSendHub.crs = Cards;
            createRoundSendHub.et = config.ROUND_UPDATE_HUB_STATUS;
          } else {
            const mainRunner = await getLiveRunnerAll(gameDetail.GameId);
            for (const runr of mainRunner) {
              if (runr.GroupId == 2) {
                let oddObj = {
                  rni: runr.RunnerId,
                  bk: parseFloat(parseFloat(runr.BackOdd).toFixed(2)),
                  ly: parseFloat(parseFloat(runr.LayOdd).toFixed(2)),
                  st: config.ROUND.CLOSED_ROUND_STATUS,
                };
                AllOdds.push(oddObj);
                if (gameDetail.Code == "32C") {
                  await updateRunner(gameDetail.GameId, runr.Name, {
                    BackOdd: runr.BackOdd,
                    LayOdd: runr.LayOdd,
                    Cards: runr.Cards,
                    ModifiedBy: 1,
                    ModifiedOn: moment().format("YYYY-MM-DD HH:mm:ss"),
                    Status: runr.Status,
                    Score: runr.Score,
                  });
                } else {
                  await updateRunner(gameDetail.GameId, runr.Name, {
                    BackOdd: runr.BackOdd,
                    LayOdd: runr.LayOdd,
                    Cards: runr.Cards,
                    ModifiedBy: 1,
                    ModifiedOn: moment().format("YYYY-MM-DD HH:mm:ss"),
                    Status: config.ROUND.CLOSED_ROUND_STATUS,
                  });
                }
              } else {
                let oddObj = {
                  rni: runr.RunnerId,
                  bk: parseFloat(parseFloat(runr.BackOdd).toFixed(2)),
                  ly: parseFloat(parseFloat(runr.LayOdd).toFixed(2)),
                  st: config.ROUND.SUSPENDED_ROUND_STATUS,
                };
                if (runr.GroupId == 1 || runr.GroupId == 5) {
                  let card = {
                    rni: runr.RunnerId,
                    cr: "",
                    sc: "",
                  };
                  Cards.push(card);
                }
                AllOdds.push(oddObj);
                if (gameDetail.Code == "32C") {
                  await updateRunner(gameDetail.GameId, runr.Name, {
                    BackOdd: runr.BackOdd,
                    LayOdd: runr.LayOdd,
                    Cards: runr.Cards,
                    ModifiedBy: 1,
                    ModifiedOn: moment().format("YYYY-MM-DD HH:mm:ss"),
                    Status: runr.Status,
                    Score: runr.Score,
                  });
                } else {
                  await updateRunner(gameDetail.GameId, runr.Name, {
                    BackOdd: runr.BackOdd,
                    LayOdd: runr.LayOdd,
                    Cards: runr.Cards,
                    ModifiedBy: 1,
                    ModifiedOn: moment().format("YYYY-MM-DD HH:mm:ss"),
                    Status: config.ROUND.SUSPENDED_ROUND_STATUS,
                  });
                }
              }
            }
            createRoundSendHub.od = AllOdds;
            createRoundSendHub.crs = Cards;
            createRoundSendHub.et = config.ROUND_CREATE_HUB_STATUS;
          }
          await sendDataToHub(createRoundSendHub, socket);
          updateRoundJson.ModifiedOn = moment().format("YYYY-MM-DD HH:mm:ss");
          await updateRound(roundId, updateRoundJson);
        }
        channel.ack(msg);
      },
      { noAck: false }
    );

    // Handle channel closure event
    channel.on("close", async (reason) => {
      await sendSlackMessage(`Channel closed: ${reason}`);
      setTimeout(getAllGames(), 5000); // Reconnect after 5 seconds
      // Implement recovery logic here, such as reconnecting or exiting gracefully
    });

    //channel.close();
    //connection.close();
  } catch (error) {
    await sendSlackMessage(
      `An error occurred: ${error.message}\nStack Trace:\n${error.stack}`
    );
  }
}

module.exports = { connectToCreateRoundQueue, connectToUpdateRoundQueue };
