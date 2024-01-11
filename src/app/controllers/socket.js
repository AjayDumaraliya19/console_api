const { sendDataToHub } = require("../../config/common");
const {
  getGameDataById,
  createRound,
  updateRound,
  getLiveRunnerAll,
  getCardDetailsByRoundId,
  getGames,
  getCurrenRoundDataInRound,
  updateRunner,
  checkRoundDataByRoundId,
} = require("../../model/repositories/gameRepository");
const moment = require("moment");
const { v4: uuidv4 } = require("uuid");
const logger = require("../../lib/logger");
const { sendSlackMessage, sendDataToDatabase } = require("../../config/common");
const config = (module.exports = require("../../config/config.json"));
const { startingServer } = require("../controllers/startingServer");
const ioClient = require("socket.io-client");
const currentServerUrl = process.env.DELAY_URL; // Replace with the remote server URL
const axios = require("axios");
// Variable declaration
const atemminiCameraSwitchApi = config.ATEMMINI_SWITCH_CAMERA_API;

let newsocket = ioClient.connect(currentServerUrl, {
  transports: ["websocket"],
  reconnection: true, // Enable reconnection
  reconnectionAttempts: 10, // Number of reconnection attempts
});
newsocket.on("connect", async () => {
  console.log("Connected to game remote server");
});

newsocket.on("disconnect", async (reason) => {
  console.log(`Disconnected from the game server. Reason: ${reason}`);
  newsocket.connect();
  startingServer(newsocket);
  console.log(`Connected to game remote server`);
});

async function connectToCreateRoundQueueSocket(queueName, sockets, socket) {
  try {
    const uniqueNumber = uuidv4();
    sockets.on(queueName, (requestData) => {
      const { data, delayInSeconds } = requestData;
      setTimeout(async () => {
        console.log(`Running request after ${delayInSeconds} seconds`, data);

        let round = data;
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
            ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
          };
          const AllOdds = [];
          const Cards = [];
          const mainRunner = await getLiveRunnerAll(gameDetail.GameId);

          // for (const runr of mainRunner) {
          //   if (gameDetail.Code == "AB") {
          //     if (runr.GroupId == 1) {
          //       let oddObj = {
          //         rni: runr.RunnerId,
          //         bk: parseFloat(parseFloat(runr.BackOdd).toFixed(2)),
          //         ly: parseFloat(0.0),
          //         st: config.ROUND.SUSPENDED_RUNNER_STATUS,
          //       };
          //       if (runr.GroupId == 1) {
          //         let card = {
          //           rni: runr.RunnerId,
          //           cr: "",
          //           sc: "",
          //         };
          //         Cards.push(card);
          //       }
          //       AllOdds.push(oddObj);
          //       await updateRunner(gameDetail.GameId, runr.Name, {
          //         BackOdd: runr.BackOdd,
          //         LayOdd: runr.LayOdd,
          //         Cards: runr.Cards,
          //         ModifiedBy: 1,
          //         ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
          //         Status: config.ROUND.SUSPENDED_RUNNER_STATUS,
          //       });
          //     } else if (runr.GroupId == 5) {
          //       let oddObj = {
          //         rni: runr.RunnerId,
          //         bk: parseFloat(parseFloat(runr.BackOdd).toFixed(2)),
          //         ly: parseFloat(0.0),
          //         st: config.ROUND.CLOSED_ROUND_STATUS,
          //       };
          //       if (runr.GroupId == 5) {
          //         let card = {
          //           rni: runr.RunnerId,
          //           cr: "",
          //           sc: "",
          //         };
          //         Cards.push(card);
          //       }
          //       AllOdds.push(oddObj);

          //       await updateRunner(gameDetail.GameId, runr.Name, {
          //         BackOdd: runr.BackOdd,
          //         LayOdd: runr.LayOdd,
          //         Cards: runr.Cards,
          //         ModifiedBy: 1,
          //         ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
          //         Status: config.ROUND.CLOSED_ROUND_STATUS,
          //       });
          //     } else {
          //       let oddObj = {
          //         rni: runr.RunnerId,
          //         bk: parseFloat(parseFloat(runr.BackOdd).toFixed(2)),
          //         ly: parseFloat(0.0),
          //         st: config.ROUND.DEFAULT_ROUND_STATUS,
          //       };
          //       AllOdds.push(oddObj);
          //       await updateRunner(gameDetail.GameId, runr.Name, {
          //         BackOdd: runr.BackOdd,
          //         LayOdd: runr.LayOdd,
          //         Cards: runr.Cards,
          //         ModifiedBy: 1,
          //         ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
          //         Status: config.ROUND.DEFAULT_ROUND_STATUS,
          //       });
          //     }
          //   } else {
          //     if (
          //       runr.GroupId == 2 ||
          //       runr.GroupId == 3 ||
          //       runr.GroupId == 4 ||
          //       runr.GroupId == 5 ||
          //       runr.GroupId == 6
          //     ) {
          //       let oddObj = {
          //         rni: runr.RunnerId,
          //         bk: parseFloat(parseFloat(runr.BackOdd).toFixed(2)),
          //         ly: parseFloat(parseFloat(runr.LayOdd).toFixed(2)),
          //         st: config.ROUND.DEFAULT_ROUND_STATUS,
          //       };
          //       await updateRunner(gameDetail.GameId, runr.Name, {
          //         BackOdd: runr.BackOdd,
          //         LayOdd: runr.LayOdd,
          //         Cards: runr.Cards,
          //         ModifiedBy: 1,
          //         ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
          //         Status: config.ROUND.DEFAULT_ROUND_STATUS,
          //       });
          //       AllOdds.push(oddObj);
          //     } else if (
          //       gameDetail.Code == "32C" ||
          //       gameDetail.Code == "ARW" ||
          //       gameDetail.Code == "LS"
          //     ) {
          //       let oddObj = {
          //         rni: runr.RunnerId,
          //         bk: parseFloat(parseFloat(runr.BackOdd).toFixed(2)),
          //         ly: parseFloat(0.0),
          //         st: config.ROUND.DEFAULT_ROUND_STATUS,
          //       };
          //       if (runr.GroupId == 1) {
          //         let card = {
          //           rni: runr.RunnerId,
          //           cr: "",
          //           sc: "",
          //           ek: runr.ExternalKey ? parseInt(runr.ExternalKey) : "",
          //         };
          //         if (gameDetail.Code == "32C") {
          //           card.sc = parseInt(runr.Score);
          //         }
          //         Cards.push(card);
          //       }
          //       AllOdds.push(oddObj);
          //       if (gameDetail.Code == "32C") {
          //         await updateRunner(gameDetail.GameId, runr.Name, {
          //           BackOdd: runr.BackOdd,
          //           LayOdd: runr.LayOdd,
          //           Cards: runr.Cards,
          //           ModifiedBy: 1,
          //           ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
          //           Score: runr.Score,
          //           Status: config.ROUND.DEFAULT_ROUND_STATUS,
          //         });
          //       } else {
          //         await updateRunner(gameDetail.GameId, runr.Name, {
          //           BackOdd: runr.BackOdd,
          //           LayOdd: runr.LayOdd,
          //           Cards: runr.Cards,
          //           ModifiedBy: 1,
          //           ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
          //           Status: config.ROUND.DEFAULT_ROUND_STATUS,
          //         });
          //       }
          //     } else {
          //       let oddObj = {
          //         rni: runr.RunnerId,
          //         bk: parseFloat(config.TEEN_PATTI.PLAYER_A.BackOdd),
          //         ly: parseFloat(config.TEEN_PATTI.PLAYER_A.LayOdd),
          //         st: config.ROUND.DEFAULT_ROUND_STATUS,
          //       };
          //       if (runr.GroupId == 1 || runr.GroupId == 5) {
          //         let card = {
          //           rni: runr.RunnerId,
          //           cr: "",
          //           sc: "",
          //           ek: "",
          //         };
          //         Cards.push(card);
          //       }
          //       AllOdds.push(oddObj);
          //       await updateRunner(gameDetail.GameId, runr.Name, {
          //         BackOdd: runr.BackOdd,
          //         LayOdd: runr.LayOdd,
          //         Cards: runr.Cards,
          //         ModifiedBy: 1,
          //         ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
          //         Status: config.ROUND.DEFAULT_ROUND_STATUS,
          //       });
          //     }
          //   }
          // }

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

          await sendDataToDatabase(
            `${gameDetail.Code}_update_round`,
            updateRounds,
            newsocket,
            gameDetail.GameSec * 1000,
            uniqueNumber
          );

          await sendDataToHub(createRoundSendHub, socket, uniqueNumber);
        }
      }, delayInSeconds);
    });
  } catch (error) {
    console.log(
      `An error occurred: ${error.message}\nStack Trace:\n${error.stack}`
    );
  }
}

// async function connectToUpdateRoundQueueSocket(queueName, sockets, socket) {
//   try {
//     const uniqueNumber = uuidv4();
//     sockets.on(queueName, (requestData) => {
//       const { data, delayInSeconds } = requestData;
//       setTimeout(async () => {
//         await logger.info(
//           uniqueNumber + ":[" + queueName + "]:" + JSON.stringify(requestData)
//         );
//         //   console.log(`Running request after ${delayInSeconds} seconds`, data);
//         let updateRoundJson = data;
//         let roundId = updateRoundJson.RoundId;
//         delete updateRoundJson.RoundId;
//         let GameId = updateRoundJson.GameId;
//         delete updateRoundJson.GameId;
//         let updateCN = { cc: { rni: null, cr: null }, nc: { rni: null } };
//         if (updateRoundJson.updateCN) {
//           updateCN = updateRoundJson.updateCN;
//           delete updateRoundJson.updateCN;
//         }
//         let completedRound = await checkRoundDataByRoundId(roundId);
//         if (!completedRound) {
//           let gameDetail = await getGameDataById(GameId);
//           await logger.info(
//             uniqueNumber +
//               ":[" +
//               queueName +
//               "]: gameDetail : " +
//               JSON.stringify(gameDetail)
//           );
//           let roundDetails = await getCardDetailsByRoundId(roundId);
//           await logger.info(
//             uniqueNumber +
//               ":[" +
//               queueName +
//               "]: roundDetails : " +
//               JSON.stringify(roundDetails)
//           );
//           const AllOdds = [];
//           let Cards = [];
//           let createRoundSendHub = {
//             ri: roundId,
//             gc: gameDetail.Code,
//             cn: updateCN,
//             crs: [],
//             od: [],
//             rs: null,
//             sr: { rni: [] },
//             st: 4,
//             iro: false,
//             trs: 0,
//             et: "",
//             ts: Date.now(),
//           };
//           if (roundDetails.length > 0) {
//             Cards = updateRoundJson.Cards;
//             delete updateRoundJson.Cards;
//             const mainRunner = await getLiveRunnerAll(gameDetail.GameId);
//             await logger.info(
//               uniqueNumber +
//                 ":[" +
//                 queueName +
//                 "]: mainRunner : " +
//                 JSON.stringify(mainRunner)
//             );
//             for (const runr of mainRunner) {
//               if (runr.GroupId == 5 && gameDetail.Code == "AB") {
//                 let oddObj = {
//                   rni: runr.RunnerId,
//                   bk: 0.0,
//                   ly: 0.0,
//                   st:
//                     roundDetails.length == 1
//                       ? config.ROUND.CLOSED_ROUND_STATUS
//                       : config.ROUND.SUSPENDED_RUNNER_STATUS,
//                 };
//                 AllOdds.push(oddObj);
//                 await updateRunner(gameDetail.GameId, runr.Name, {
//                   BackOdd: runr.BackOdd,
//                   LayOdd: runr.LayOdd,
//                   Cards: runr.Cards,
//                   ModifiedBy: 1,
//                   ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
//                   Status:
//                     roundDetails.length == 1
//                       ? config.ROUND.CLOSED_ROUND_STATUS
//                       : config.ROUND.SUSPENDED_RUNNER_STATUS,
//                 });
//               } else if (
//                 runr.GroupId == 2 ||
//                 runr.GroupId == 3 ||
//                 runr.GroupId == 4 ||
//                 runr.GroupId == 5 ||
//                 runr.GroupId == 6
//               ) {
//                 let oddObj = {
//                   rni: runr.RunnerId,
//                   bk: 0.0,
//                   ly: 0.0,
//                   st: config.ROUND.SUSPENDED_RUNNER_STATUS,
//                 };
//                 AllOdds.push(oddObj);
//                 if (gameDetail.Code == "32C") {
//                   await updateRunner(gameDetail.GameId, runr.Name, {
//                     BackOdd: runr.BackOdd,
//                     LayOdd: runr.LayOdd,
//                     Cards: runr.Cards,
//                     ModifiedBy: 1,
//                     ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
//                     Status: config.ROUND.SUSPENDED_RUNNER_STATUS,
//                     Score: runr.Score,
//                   });
//                 } else {
//                   await updateRunner(gameDetail.GameId, runr.Name, {
//                     BackOdd: runr.BackOdd,
//                     LayOdd: runr.LayOdd,
//                     Cards: runr.Cards,
//                     ModifiedBy: 1,
//                     ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
//                     Status: config.ROUND.SUSPENDED_RUNNER_STATUS,
//                   });
//                 }
//               } else {
//                 let oddObj = {
//                   rni: runr.RunnerId,
//                   bk: parseFloat(parseFloat(runr.BackOdd).toFixed(2)),
//                   ly: parseFloat(parseFloat(runr.LayOdd).toFixed(2)),
//                   st: config.ROUND.SUSPENDED_RUNNER_STATUS,
//                 };
//                 AllOdds.push(oddObj);
//                 if (gameDetail.Code == "32C") {
//                   await updateRunner(gameDetail.GameId, runr.Name, {
//                     BackOdd: runr.BackOdd,
//                     LayOdd: runr.LayOdd,
//                     Cards: runr.Cards,
//                     ModifiedBy: 1,
//                     ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
//                     Status: config.ROUND.SUSPENDED_RUNNER_STATUS,
//                     Score: runr.Score,
//                   });
//                 } else {
//                   await updateRunner(gameDetail.GameId, runr.Name, {
//                     BackOdd: runr.BackOdd,
//                     LayOdd: runr.LayOdd,
//                     Cards: runr.Cards,
//                     ModifiedBy: 1,
//                     ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
//                     Status: config.ROUND.SUSPENDED_RUNNER_STATUS,
//                   });
//                 }
//               }
//             }
//             createRoundSendHub.od = AllOdds;
//             createRoundSendHub.crs = Cards;
//             createRoundSendHub.et = config.ROUND_UPDATE_HUB_STATUS;
//           } else {
//             const mainRunner = await getLiveRunnerAll(gameDetail.GameId);
//             for (const runr of mainRunner) {
//               if (runr.GroupId == 5 && gameDetail.Code == "AB") {
//                 let oddObj = {
//                   rni: runr.RunnerId,
//                   bk: 0.0,
//                   ly: 0.0,
//                   st: config.ROUND.CLOSED_ROUND_STATUS,
//                 };
//                 AllOdds.push(oddObj);
//                 let card = {
//                   rni: runr.RunnerId,
//                   cr: "",
//                   sc: "",
//                   ek: "",
//                 };
//                 Cards.push(card);
//                 await updateRunner(gameDetail.GameId, runr.Name, {
//                   BackOdd: runr.BackOdd,
//                   LayOdd: runr.LayOdd,
//                   Cards: runr.Cards,
//                   ModifiedBy: 1,
//                   ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
//                   Status: config.ROUND.CLOSED_ROUND_STATUS,
//                 });
//               } else if (
//                 runr.GroupId == 2 ||
//                 runr.GroupId == 3 ||
//                 runr.GroupId == 4 ||
//                 runr.GroupId == 5 ||
//                 runr.GroupId == 6
//               ) {
//                 let oddObj = {
//                   rni: runr.RunnerId,
//                   bk: parseFloat(parseFloat(runr.BackOdd).toFixed(2)),
//                   ly: parseFloat(parseFloat(runr.LayOdd).toFixed(2)),
//                   st: config.ROUND.SUSPENDED_RUNNER_STATUS,
//                 };
//                 AllOdds.push(oddObj);
//                 if (gameDetail.Code == "32C") {
//                   await updateRunner(gameDetail.GameId, runr.Name, {
//                     BackOdd: runr.BackOdd,
//                     LayOdd: runr.LayOdd,
//                     Cards: runr.Cards,
//                     ModifiedBy: 1,
//                     ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
//                     Status: config.ROUND.SUSPENDED_RUNNER_STATUS,
//                     Score: runr.Score,
//                   });
//                 } else {
//                   await updateRunner(gameDetail.GameId, runr.Name, {
//                     BackOdd: runr.BackOdd,
//                     LayOdd: runr.LayOdd,
//                     Cards: runr.Cards,
//                     ModifiedBy: 1,
//                     ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
//                     Status: config.ROUND.SUSPENDED_RUNNER_STATUS,
//                   });
//                 }
//               } else {
//                 let oddObj = {
//                   rni: runr.RunnerId,
//                   bk: parseFloat(parseFloat(runr.BackOdd).toFixed(2)),
//                   ly: parseFloat(parseFloat(runr.LayOdd).toFixed(2)),
//                   st: config.ROUND.SUSPENDED_RUNNER_STATUS,
//                 };
//                 if (runr.GroupId == 1) {
//                   let card = {
//                     rni: runr.RunnerId,
//                     cr: "",
//                     sc: "",
//                     ek: "",
//                   };
//                   if (gameDetail.Code == "32C") {
//                     card.sc = parseInt(runr.Score);
//                   }
//                   Cards.push(card);
//                 }
//                 AllOdds.push(oddObj);
//                 if (gameDetail.Code == "32C") {
//                   await updateRunner(gameDetail.GameId, runr.Name, {
//                     BackOdd: runr.BackOdd,
//                     LayOdd: runr.LayOdd,
//                     Cards: runr.Cards,
//                     ModifiedBy: 1,
//                     ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
//                     Status: config.ROUND.SUSPENDED_RUNNER_STATUS,
//                     Score: runr.Score,
//                   });
//                 } else {
//                   await updateRunner(gameDetail.GameId, runr.Name, {
//                     BackOdd: runr.BackOdd,
//                     LayOdd: runr.LayOdd,
//                     Cards: runr.Cards,
//                     ModifiedBy: 1,
//                     ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
//                     Status: config.ROUND.SUSPENDED_RUNNER_STATUS,
//                   });
//                 }
//               }
//             }
//             createRoundSendHub.od = AllOdds;
//             createRoundSendHub.crs = Cards;
//             createRoundSendHub.et = config.ROUND_CREATE_HUB_STATUS;
//           }
//           await logger.info(
//             uniqueNumber +
//               ":[" +
//               queueName +
//               "]: createRoundSendHub : " +
//               JSON.stringify(createRoundSendHub)
//           );
//           await sendDataToHub(createRoundSendHub, socket, uniqueNumber);
//           updateRoundJson.ModifiedOn = moment()
//             .utc()
//             .format("YYYY-MM-DD HH:mm:ss");
//           await logger.info(
//             uniqueNumber +
//               ":[" +
//               queueName +
//               "]: updateRoundJson : " +
//               JSON.stringify(updateRoundJson)
//           );
//           await updateRound(roundId, updateRoundJson);
//         }
//       }, delayInSeconds);
//     });
//   } catch (error) {
//     await logger.info(
//       "connectToUpdateRoundQueueSocket : " +
//         `An error occurred: ${error.message}\nStack Trace:\n${error.stack}`
//     );
//     await sendSlackMessage(
//       `An error occurred: ${error.message}\nStack Trace:\n${error.stack}`
//     );
//   }
// }

module.exports = {
  connectToCreateRoundQueueSocket,
  // connectToUpdateRoundQueueSocket,
};
