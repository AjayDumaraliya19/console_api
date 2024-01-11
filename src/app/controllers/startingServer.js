const {
  getLiveRunnerAll,
  getGames,
  getCurrenRoundDataInRound,
  getRoundData,
} = require("../../model/repositories/gameRepository");
const moment = require("moment");
const { sendDataToDatabase } = require("../../config/common");
const config = (module.exports = require("../../config/config.json"));

async function startingServer(newsocket) {
  try {
    console.log(`Server Starting`);
    const newgames = await getGames();
    if (newgames) {
      for (const game of newgames) {
        if (game.Code == "TP") {
          console.log(`Server Starting TP`);
          let getGameRound = await getRoundData(game.GameId);
          if (!getGameRound) {
            const mainRunner = await getLiveRunnerAll(game.GameId);
            const currentRoundData = await getCurrenRoundDataInRound(
              game.GameId
            );
            if (!currentRoundData) {
              console.log(`Server Starting TP1`);
              const playerArunner = mainRunner.filter(function (el) {
                return el.Rcode == "TP_PYA";
              })[0];
              let sendData = {
                GameId: game.GameId,
                Status: config.ROUND.DEFAULT_ROUND_STATUS,
                IsActive: config.ROUND.IS_ACTIVE,
                CreatedBy: config.ROUND.CREATED_BY,
                CreatedOn: moment().utc().utc().format("YYYY-MM-DD HH:mm:ss"),
                IsDelete: config.ROUND.IS_DELETE,
                updateCN: {
                  cc: { rni: null, cr: null },
                  nc: { rni: playerArunner.RunnerId },
                },
              };
              await sendDataToDatabase(
                `${game.Code}_create_round`,
                sendData,
                newsocket,
                0
              );
            }
          }
        } else if (game.Code == "AB") {
          console.log(`Server Starting AB`);
          let getGameRound = await getRoundData(game.GameId);
          if (!getGameRound) {
            const mainRunner = await getLiveRunnerAll(game.GameId);
            const currentRoundData = await getCurrenRoundDataInRound(
              game.GameId
            );
            if (!currentRoundData) {
              console.log(`Server Starting AB1`);
              const jokarRunner = mainRunner.filter(function (el) {
                return el.Rcode == "AB_J";
              })[0];
              let sendData = {
                GameId: game.GameId,
                Status: config.ROUND.DEFAULT_ROUND_STATUS,
                IsActive: config.ROUND.IS_ACTIVE,
                CreatedBy: config.ROUND.CREATED_BY,
                CreatedOn: moment().utc().utc().format("YYYY-MM-DD HH:mm:ss"),
                IsDelete: config.ROUND.IS_DELETE,
                updateCN: {
                  cc: { rni: null, cr: null },
                  nc: { rni: jokarRunner.RunnerId },
                },
              };
              await sendDataToDatabase(
                `${game.Code}_create_round`,
                sendData,
                newsocket,
                0
              );
            }
          }
        } else if (game.Code == "32C") {
          console.log(`Server Starting 32C`);
          let getGameRound = await getRoundData(game.GameId);
          if (!getGameRound) {
            const mainRunner = await getLiveRunnerAll(game.GameId);
            const currentRoundData = await getCurrenRoundDataInRound(
              game.GameId
            );
            if (!currentRoundData) {
              console.log(`Server Starting 32C1`);
              const PlayerARunner = mainRunner.filter(function (el) {
                return el.Rcode == "C32_8";
              })[0];
              let sendData = {
                GameId: game.GameId,
                Status: config.ROUND.DEFAULT_ROUND_STATUS,
                IsActive: config.ROUND.IS_ACTIVE,
                CreatedBy: config.ROUND.CREATED_BY,
                CreatedOn: moment().utc().utc().format("YYYY-MM-DD HH:mm:ss"),
                IsDelete: config.ROUND.IS_DELETE,
                updateCN: {
                  cc: { rni: null, cr: null },
                  nc: { rni: PlayerARunner.RunnerId },
                },
              };
              await sendDataToDatabase(
                `${game.Code}_create_round`,
                sendData,
                newsocket,
                0
              );
            }
          }
        } else if (game.Code == "ARW") {
          console.log(`Server Starting ARW`);
          let getGameRound = await getRoundData(game.GameId);
          if (!getGameRound) {
            const currentRoundData = await getCurrenRoundDataInRound(
              game.GameId
            );
            if (!currentRoundData) {
              console.log(`Server Starting ARW1`);
              let sendData = {
                GameId: game.GameId,
                Status: config.ROUND.DEFAULT_ROUND_STATUS,
                IsActive: config.ROUND.IS_ACTIVE,
                CreatedBy: config.ROUND.CREATED_BY,
                CreatedOn: moment().utc().utc().format("YYYY-MM-DD HH:mm:ss"),
                IsDelete: config.ROUND.IS_DELETE,
              };
              await sendDataToDatabase(
                `${game.Code}_create_round`,
                sendData,
                newsocket,
                0
              );
            }
          }
        } else if (game.Code == "LS") {
          console.log(`Server Starting LS`);
          let getGameRound = await getRoundData(game.GameId);
          if (!getGameRound) {
            const currentRoundData = await getCurrenRoundDataInRound(
              game.GameId
            );
            if (!currentRoundData) {
              console.log(`Server Starting LS1`);
              let sendData = {
                GameId: game.GameId,
                Status: config.ROUND.DEFAULT_ROUND_STATUS,
                IsActive: config.ROUND.IS_ACTIVE,
                CreatedBy: config.ROUND.CREATED_BY,
                CreatedOn: moment().utc().utc().format("YYYY-MM-DD HH:mm:ss"),
                IsDelete: config.ROUND.IS_DELETE,
              };
              await sendDataToDatabase(
                `${game.Code}_create_round`,
                sendData,
                newsocket,
                0
              );
            }
          }
        } else if (game.Code == "TP20") {
          console.log(`Server Starting TP20`);
          let getGameRound = await getRoundData(game.GameId);
          if (!getGameRound) {
            const mainRunner = await getLiveRunnerAll(game.GameId);
            const currentRoundData = await getCurrenRoundDataInRound(
              game.GameId
            );
            if (!currentRoundData) {
              console.log(`Server Starting TP201`);
              const playerArunner = mainRunner.filter(function (el) {
                return el.Rcode == "TP20_PYA";
              })[0];
              let sendData = {
                GameId: game.GameId,
                Status: config.ROUND.DEFAULT_ROUND_STATUS,
                IsActive: config.ROUND.IS_ACTIVE,
                CreatedBy: config.ROUND.CREATED_BY,
                CreatedOn: moment().utc().utc().format("YYYY-MM-DD HH:mm:ss"),
                IsDelete: config.ROUND.IS_DELETE,
                updateCN: {
                  cc: { rni: null, cr: null },
                  nc: { rni: playerArunner.RunnerId },
                },
              };
              await sendDataToDatabase(
                `${game.Code}_create_round`,
                sendData,
                newsocket,
                0
              );
            }
          }
        } else if (game.Code == "DT") {
          console.log(`Server Starting DT`);
          let getGameRound = await getRoundData(game.GameId);
          if (!getGameRound) {
            const mainRunner = await getLiveRunnerAll(game.GameId);
            const currentRoundData = await getCurrenRoundDataInRound(
              game.GameId
            );
            if (!currentRoundData) {
              console.log(`Server Starting DT1`);
              const playerDragon = mainRunner.filter(function (el) {
                return el.Rcode == "DT_DG";
              })[0];
              let sendData = {
                GameId: game.GameId,
                Status: config.ROUND.DEFAULT_ROUND_STATUS,
                IsActive: config.ROUND.IS_ACTIVE,
                CreatedBy: config.ROUND.CREATED_BY,
                CreatedOn: moment().utc().utc().format("YYYY-MM-DD HH:mm:ss"),
                IsDelete: config.ROUND.IS_DELETE,
                updateCN: {
                  cc: { rni: null, cr: null },
                  nc: { rni: playerDragon.RunnerId },
                },
              };
              await sendDataToDatabase(
                `${game.Code}_create_round`,
                sendData,
                newsocket,
                0
              );
            }
          }
        } else if (game.Code == "BAC") {
          console.log(`Server Starting BCA`);
          let getGameRound = await getRoundData(game.GameId);
          if (!getGameRound) {
            const mainRunner = await getLiveRunnerAll(game.GameId);
            const currentRoundData = await getCurrenRoundDataInRound(
              game.GameId
            );
            if (!currentRoundData) {
              console.log(`Server Starting BCA1`);
              const playerRunner = mainRunner.filter(function (el) {
                return el.Rcode == "BAC_PLY";
              })[0];
              console.log(playerRunner.RunnerId, "========playerrunner=======");

              let sendData = {
                GameId: game.GameId,
                Status: config.ROUND.DEFAULT_ROUND_STATUS,
                IsActive: config.ROUND.IS_ACTIVE,
                CreatedBy: config.ROUND.CREATED_BY,
                CreatedOn: moment().utc().utc().format("YYYY-MM-DD HH:mm:ss"),
                IsDelete: config.ROUND.IS_DELETE,
                updateCN: {
                  cc: { rni: null, cr: null },
                  nc: { rni: playerRunner.RunnerId },
                },
              };
              await sendDataToDatabase(
                `${game.Code}_create_round`,
                sendData,
                newsocket,
                0
              );
            }
          }
        }
      }
    }
  } catch (error) {
    console.log(
      `An error occurred: ${error.message}\nStack Trace:\n${error.stack}`
    );
  }
}
module.exports = { startingServer };
