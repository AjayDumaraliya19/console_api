const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const moment = require("moment");
const { v4: uuidv4 } = require("uuid");
const redis = require("redis");
const logger = require("../../lib/logger");
const axios = require("axios");
const {
  validateCardCode,
  callPythonAPI,
  getBackAndLay,
  sendDataToHub,
  getCardFirstForAndarBahar,
  getCardFirstForAndarBaharValue,
  getCardColor,
  getCardColorAndarBaharJokar,
  getCardColorAndarBaharSuite,
  sendSlackMessage,
  sendDataToDatabase,
} = require("../../config/common");
const {
  getGameData,
  getRoundData,
  getRoundDataByRoundId,
  getCardDetailsByRoundId,
  createRound,
  createRoundDetails,
  checkRoundCardAlready,
  updateRunner,
  updateRound,
  getLiveRunnerForResult,
  getLiveRunnerAll,
  getLiveRunnerAllOpen,
  getCurrenRoundDataInRound,
  updateRunnerByCode,
  getGames,
} = require("../../model/repositories/gameRepository");
const constMessages = (module.exports = require("../../config/messages.json"));
const config = (module.exports = require("../../config/config.json"));

// Variable declaration
const atemminiCameraSwitchApi = config.ATEMMINI_SWITCH_CAMERA_API;

const redisClient = redis.createClient({
  host: "127.0.0.1",
  port: 6379,
});

(async () => {
  redisClient.on("error", (err) => {
    console.log("Redis Client Error", err);
  });
  redisClient.on("ready", () => console.log("Redis is ready"));
  await redisClient.connect();
  await redisClient.ping();
  const working = await redisClient.get("TP");
  if (working) {
    await redisClient.del("TP");
  }
  const working1 = await redisClient.get("AB");
  if (working1) {
    await redisClient.del("AB");
  }
  const working2 = await redisClient.get("32C");
  if (working2) {
    await redisClient.del("32C");
  }
  const working3 = await redisClient.get("ARW");
  if (working3) {
    await redisClient.del("ARW");
  }
  const working4 = await redisClient.get("LS");
  if (working4) {
    await redisClient.del("LS");
  }
  const working5 = await redisClient.get("TP20");
  if (working5) {
    await redisClient.del("TP20");
  }
  const working6 = await redisClient.get("DT");
  if (working6) {
    await redisClient.del("DT");
  }
})();

async function userLogin(req, res) {
  try {
    const { gamecode, password } = req.body;
    const gameDetail = await getGameData(gamecode);
    if (!gameDetail)
      return res
        .status(200)
        .json({
          success: false,
          message: constMessages.VALIDATION.INVALID_GAME_CODE_AND_PASSWORD,
          data: {},
          accessToken: "",
        });
    if (gameDetail.Status == 0)
      return res
        .status(200)
        .json({
          success: false,
          message: constMessages.VALIDATION.GAME_NOT_ACTIVE,
          data: {},
          accessToken: "",
        });
    let checkPassword = await bcrypt.compare(
      password,
      gameDetail.ConsolePassword
    );
    if (checkPassword) {
      let accessToken = jwt.sign(
        { id: gameDetail.Code },
        process.env.JWT_SECRET,
        {}
      );
      delete gameDetail.Password;
      return res
        .status(200)
        .json({
          success: true,
          message: constMessages.SUCCESS.LOGIN_SUCCESS,
          data: {},
          accessToken: accessToken,
        });
    } else {
      return res
        .status(200)
        .json({
          success: false,
          message: constMessages.VALIDATION.INVALID_PASSWORD,
        });
    }
  } catch (err) {
    await sendSlackMessage(
      `An error occurred: ${err.message}\nStack Trace:\n${err.stack}`
    );
    return res.status(200).json({ success: false, message: err.message });
  }
}

async function cancelRound(req, res) {
  const uniqueNumber = uuidv4();
  await logger.info(
    "------------------------------------------------------------------------------------------------------------------------------------"
  );
  await logger.info(
    "Call Cancel API :" + uniqueNumber + " " + " " + JSON.stringify(req.body)
  );
  try {
    const { game_code, user_id } = req.body;
    const gameDetail = await getGameData(game_code);
    await logger.info(
      uniqueNumber +
        ":[" +
        game_code +
        "]: gameDetail :" +
        JSON.stringify(gameDetail)
    );
    if (!gameDetail)
      return res
        .status(200)
        .json({
          success: false,
          message: constMessages.VALIDATION.INVALID_GAME_CODE_AND_PASSWORD,
          data: {},
          accessToken: "",
        });
    if (gameDetail.Status == 0)
      return res
        .status(200)
        .json({
          success: false,
          message: constMessages.VALIDATION.GAME_NOT_ACTIVE,
          data: {},
          accessToken: "",
        });
    let getGameRound = await getCurrenRoundDataInRound(gameDetail.GameId);
    if (!getGameRound)
      return res
        .status(200)
        .json({
          success: false,
          message: constMessages.VALIDATION.GAME_NOT_ACTIVE,
          data: {},
          accessToken: "",
        });
    await logger.info(
      uniqueNumber +
        ":[" +
        game_code +
        "]: getGameRound :" +
        JSON.stringify(getGameRound)
    );
    let sendHub = {
      ri: getGameRound.RoundId,
      gc: game_code,
      cn: { cc: { rni: null, cr: null }, nc: { rni: null } },
      crs: [],
      od: [],
      rs: 0,
      sr: { rni: [] },
      st: 5,
      iro: true,
      trs: gameDetail.CardSec,
      et: config.ROUND_CANCEL_HUB_STATUS,
      ts: Date.now(),
    };
    const mainRunner = await getLiveRunnerAll(gameDetail.GameId);
    if (mainRunner.length == 0) {
      await logger.info(
        uniqueNumber +
          ":[" +
          game_code +
          "]: mainRunner :" +
          JSON.stringify(mainRunner)
      );
      return res
        .status(200)
        .json({
          success: false,
          message: constMessages.VALIDATION.RUNNER_NOT_FOUND,
          data: {},
        });
    }
    const nextRunner = mainRunner.filter(function (el) {
      return el.GroupId == 1;
    })[0];
    sendHub.cn.nc.rni = nextRunner.RunnerId;
    const AllOdds = [];
    const AllCards = [];
    for (const runr of mainRunner) {
      if (runr.GroupId == 1) {
        let oddObj = {
          rni: runr.RunnerId,
          bk: parseFloat(parseFloat(runr.BackOdd).toFixed(2)),
          ly: parseFloat(parseFloat(runr.LayOdd).toFixed(2)),
          st: runr.Status,
        };
        AllOdds.push(oddObj);
        let cardObj = {
          rni: runr.RunnerId,
          cr: runr.Cards != null ? runr.Cards : "",
          sc: runr.Score ? parseInt(runr.Score) : "",
          ek: runr.Score ? parseInt(runr.ExternalKey) : "",
        };
        AllCards.push(cardObj);
      } else {
        let oddObj = {
          rni: runr.RunnerId,
          bk: parseFloat(parseFloat(runr.BackOdd).toFixed(2)),
          ly: parseFloat(parseFloat(runr.LayOdd).toFixed(2)),
          st: runr.Status,
        };
        AllOdds.push(oddObj);
      }
    }
    sendHub.crs = AllCards;
    sendHub.od = AllOdds;
    let updateRounds = {
      Status: config.ROUND.CANCEL_ROUND_STATUS,
      IsSettled: config.ROUND.IS_SETTLED,
      Result: 0,
      SideResult: `{ "rni": [] }`,
      ModifiedBy: user_id,
      ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
    };
    await logger.info(
      uniqueNumber +
        ":[" +
        game_code +
        "]: updateRounds : " +
        JSON.stringify(updateRounds)
    );
    await updateRound(getGameRound.RoundId, updateRounds);
    if (game_code == "TP") {
      await updateRunnerByCode(gameDetail.GameId, "TP_PYA", {
        BackOdd: config.TEEN_PATTI.PLAYER_A.BackOdd,
        LayOdd: config.TEEN_PATTI.PLAYER_A.LayOdd,
        Cards: null,
        ModifiedBy: 1,
        ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
        Status: config.ROUND.CANCEL_ROUND_STATUS,
      });
      await updateRunnerByCode(gameDetail.GameId, "TP_PYB", {
        BackOdd: config.TEEN_PATTI.PLAYER_B.BackOdd,
        LayOdd: config.TEEN_PATTI.PLAYER_B.LayOdd,
        Cards: null,
        ModifiedBy: 1,
        ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
        Status: config.ROUND.CANCEL_ROUND_STATUS,
      });
    } else if (game_code == "AB") {
      await updateRunnerByCode(gameDetail.GameId, "AB_BA", {
        BackOdd: config.ANDAR_BAHAR.BAHAR_BACK_ODD,
        LayOdd: 0.0,
        Cards: null,
        ModifiedBy: 1,
        ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
        Status: config.ROUND.CANCEL_ROUND_STATUS,
      });
      await updateRunnerByCode(gameDetail.GameId, "AB_AN", {
        BackOdd: config.ANDAR_BAHAR.ANDAR_BACK_ODD,
        LayOdd: 0.0,
        Cards: null,
        ModifiedBy: 1,
        ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
        Status: config.ROUND.CANCEL_ROUND_STATUS,
      });
      await updateRunnerByCode(gameDetail.GameId, "AB_J", {
        BackOdd: 0.0,
        LayOdd: 0.0,
        Cards: null,
        ModifiedBy: 1,
        ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
      });
      await updateRunnerByCode(gameDetail.GameId, "AB_7", {
        BackOdd: config.ANDAR_BAHAR.SEVEN_BACK_ODD,
        LayOdd: 0.0,
        Cards: null,
        ModifiedBy: 1,
        ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
        Status: config.ROUND.CANCEL_ROUND_STATUS,
      });
      await updateRunnerByCode(gameDetail.GameId, "AB_7U", {
        BackOdd: config.ANDAR_BAHAR.SEVEN_UP_BACK_ODD,
        LayOdd: 0.0,
        Cards: null,
        ModifiedBy: 1,
        ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
        Status: config.ROUND.CANCEL_ROUND_STATUS,
      });
      await updateRunnerByCode(gameDetail.GameId, "AB_7D", {
        BackOdd: config.ANDAR_BAHAR.SEVEN_DOWN_BACK_ODD,
        LayOdd: 0.0,
        Cards: null,
        ModifiedBy: 1,
        ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
        Status: config.ROUND.CANCEL_ROUND_STATUS,
      });
    } else if (game_code == "32C") {
      await updateRunnerByCode(gameDetail.GameId, "C32_8", {
        BackOdd: config.THURTY_TWO_CARD.ODDS.PLAYER_A,
        LayOdd: 0,
        Cards: null,
        Score: config.THURTY_TWO_CARD.SCORE.PLAYER_A,
        Status: config.ROUND.CANCEL_ROUND_STATUS,
        ExternalKey: 1,
        ModifiedBy: 1,
        ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
      });
      await updateRunnerByCode(gameDetail.GameId, "C32_9", {
        BackOdd: config.THURTY_TWO_CARD.ODDS.PLAYER_B,
        LayOdd: 0,
        Cards: null,
        Score: config.THURTY_TWO_CARD.SCORE.PLAYER_B,
        Status: config.ROUND.CANCEL_ROUND_STATUS,
        ExternalKey: 1,
        ModifiedBy: 1,
        ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
      });
      await updateRunnerByCode(gameDetail.GameId, "C32_10", {
        BackOdd: config.THURTY_TWO_CARD.ODDS.PLAYER_C,
        LayOdd: 0,
        Cards: null,
        Score: config.THURTY_TWO_CARD.SCORE.PLAYER_C,
        Status: config.ROUND.CANCEL_ROUND_STATUS,
        ExternalKey: 1,
        ModifiedBy: 1,
        ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
      });
      await updateRunnerByCode(gameDetail.GameId, "C32_11", {
        BackOdd: config.THURTY_TWO_CARD.ODDS.PLAYER_D,
        LayOdd: 0,
        Cards: null,
        Score: config.THURTY_TWO_CARD.SCORE.PLAYER_D,
        Status: config.ROUND.CANCEL_ROUND_STATUS,
        ExternalKey: 1,
        ModifiedBy: 1,
        ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
      });
    } else if (game_code == "TP20") {
      await updateRunnerByCode(gameDetail.GameId, "TP20_PYA", {
        BackOdd: config.TEEN_PATTI_TWENTY_TWENTY.PLAYER_A.BackOdd,
        LayOdd: config.TEEN_PATTI_TWENTY_TWENTY.PLAYER_A.LayOdd,
        Cards: null,
        ModifiedBy: 1,
        ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
        Status: config.ROUND.CANCEL_ROUND_STATUS,
      });
      await updateRunnerByCode(gameDetail.GameId, "TP20_PYB", {
        BackOdd: config.TEEN_PATTI_TWENTY_TWENTY.PLAYER_B.BackOdd,
        LayOdd: config.TEEN_PATTI_TWENTY_TWENTY.PLAYER_B.LayOdd,
        Cards: null,
        ModifiedBy: 1,
        ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
        Status: config.ROUND.CANCEL_ROUND_STATUS,
      });
    } else if (game_code == "DT") {
      await updateRunnerByCode(gameDetail.GameId, "DT_DG", {
        BackOdd: config.DRAGON_TIGER.DRAGON.BackOdd,
        LayOdd: config.DRAGON_TIGER.DRAGON.LayOdd,
        Cards: null,
        ModifiedBy: 1,
        ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
        Status: config.ROUND.CANCEL_ROUND_STATUS,
      });
      await updateRunnerByCode(gameDetail.GameId, "DT_TG", {
        BackOdd: config.DRAGON_TIGER.TIGER.BackOdd,
        LayOdd: config.DRAGON_TIGER.TIGER.LayOdd,
        Cards: null,
        ModifiedBy: 1,
        ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
        Status: config.ROUND.CANCEL_ROUND_STATUS,
      });
    }
    let newRound = {
      GameId: gameDetail.GameId,
      Status: config.ROUND.DEFAULT_ROUND_STATUS,
      IsActive: config.ROUND.IS_ACTIVE,
      CreatedBy: config.ROUND.CREATED_BY,
      CreatedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
      IsDelete: config.ROUND.IS_DELETE,
      updateCN: {
        cc: { rni: null, cr: null },
        nc: { rni: nextRunner.RunnerId },
      },
    };
    await logger.info(
      uniqueNumber + ":[" + game_code + "]: sendHub :" + JSON.stringify(sendHub)
    );
    await sendDataToHub(sendHub, req.socket, uniqueNumber);
    await logger.info(
      uniqueNumber +
        ":[" +
        game_code +
        "]: newRound-Socket : " +
        JSON.stringify(newRound)
    );
    await sendDataToDatabase(
      `${game_code}_create_round`,
      newRound,
      req.newsocket,
      0,
      uniqueNumber
    );
    return res
      .status(200)
      .json({
        success: true,
        message: constMessages.SUCCESS.ROUND_CANCEL_SUCCESS,
        data: {},
      });
  } catch (err) {
    await sendSlackMessage(
      `An error occurred: ${err.message}\nStack Trace:\n${err.stack}`
    );
    return res.status(200).json({ success: false, message: err.message });
  }
}

async function scanCard(req, res, next) {
  const uniqueNumber = uuidv4();
  await logger.info(
    "------------------------------------------------------------------------------------------------------------------------------------"
  );
  await logger.info(
    "Call API :" + uniqueNumber + " " + " " + JSON.stringify(req.body)
  );
  try {
    let { game_code, card_code } = req.body;
    card_code = card_code.toUpperCase();
    let scannedCard = await validateCardCode(card_code);
    if (!scannedCard)
      return res.status(200).json({
        success: false,
        message: constMessages.VALIDATION.INVALID_GAME_CODE_AND_PASSWORD,
        data: {},
      });
    switch (game_code) {
      case "TP": {
        const working = await redisClient.get("TP");
        if (working) {
          await logger.info(
            uniqueNumber + ":[TP]: working : " + JSON.stringify(working)
          );
          return res.status(200).json({
            success: false,
            message: constMessages.VALIDATION.WORK_IN_PROGRESS,
            data: {},
          });
        }
        await redisClient.set("TP", "Available");
        const gameDetail = await getGameData(game_code);
        await logger.info(
          uniqueNumber + ":[TP]: gameDetail : " + JSON.stringify(gameDetail)
        );
        if (!gameDetail) {
          await redisClient.del("TP");
          return res.status(200).json({
            success: false,
            message: constMessages.VALIDATION.INVALID_GAMECODE,
            data: {},
          });
        }
        if (gameDetail.Status == 0) {
          await redisClient.del("TP");
          return res.status(200).json({
            success: false,
            message: constMessages.VALIDATION.GAME_NOT_ACTIVE,
            data: {},
            accessToken: "",
          });
        }
        const mainRunner = await getLiveRunnerAll(gameDetail.GameId);
        await logger.info(
          uniqueNumber + ":[TP]: mainRunner :" + JSON.stringify(mainRunner)
        );
        if (mainRunner.length == 0) {
          await redisClient.del("TP");
          return res.status(200).json({
            success: false,
            message: constMessages.VALIDATION.RUNNER_NOT_FOUND,
            data: {},
          });
        }
        const AllOdds = [];
        for (const runr of mainRunner) {
          if (runr.GroupId == 1) {
            let oddObj = {
              rni: runr.RunnerId,
              bk: 0.0,
              ly: 0.0,
              st: config.ROUND.DEFAULT_ROUND_STATUS,
            };
            AllOdds.push(oddObj);
          } else {
            let oddObj = {
              rni: runr.RunnerId,
              bk: parseFloat(0.0),
              ly: parseFloat(0.0),
              st: config.ROUND.SUSPENDED_RUNNER_STATUS,
            };
            AllOdds.push(oddObj);
          }
        }
        let getGameRound = await getRoundData(gameDetail.GameId);
        await logger.info(
          uniqueNumber + ":[TP]: getGameRound : " + JSON.stringify(getGameRound)
        );
        if (!getGameRound) {
          const currentRoundData = await getCurrenRoundDataInRound(
            gameDetail.GameId
          );
          if (!currentRoundData) {
            await logger.info(
              uniqueNumber +
                ":[TP]: currentRoundData : " +
                JSON.stringify(currentRoundData)
            );
            await redisClient.del("TP");
            return res.status(200).json({
              success: false,
              message: `Please wait for ${config.ROUND_CREATE_POUSE_TIME} sec`,
              data: {},
            });
          } else {
            const allRoundDetails = await getCardDetailsByRoundId(
              currentRoundData.RoundId
            );
            if (allRoundDetails.length == 0) {
              await logger.info(
                uniqueNumber +
                  ":[TP]: allRoundDetails :" +
                  JSON.stringify(allRoundDetails)
              );
              await redisClient.del("TP");
              return res.status(200).json({
                success: false,
                message: `Please wait for ${gameDetail.GameSec} sec`,
                data: {},
              });
            } else {
              await logger.info(
                uniqueNumber +
                  ":[TP]: allRoundDetails :" +
                  JSON.stringify(allRoundDetails)
              );
              await redisClient.del("TP");
              return res.status(200).json({
                success: false,
                message: `Please wait for ${gameDetail.CardSec} sec`,
                data: {},
              });
            }
          }
        } else {
          let sendHub = {
            ri: getGameRound.RoundId,
            gc: game_code,
            cn: { cc: { rni: null, cr: null }, nc: { rni: null } },
            crs: [],
            od: [],
            rs: null,
            sr: { rni: [] },
            st: 1,
            iro: false,
            trs: gameDetail.CardSec,
            et: "CardScan",
            ts: Date.now(),
          };
          await logger.info(
            uniqueNumber + ":[TP]: sendHub :" + JSON.stringify(sendHub)
          );
          const checkCardAlready = await checkRoundCardAlready(
            getGameRound.RoundId,
            scannedCard
          );
          if (checkCardAlready.length > 0) {
            await redisClient.del("TP");
            return res.status(200).json({
              success: false,
              message: constMessages.VALIDATION.DUPLICATE_CARD_SCAN,
              data: {},
            });
          }
          const allRoundDetails = await getCardDetailsByRoundId(
            getGameRound.RoundId
          );
          if (allRoundDetails.length != 5) {
            // Switch camera for top view Params
            let cameraViewParams = {
              GameCode: "TP",
              IsTopView: true,
              IsFrontView: false,
            };
            // Switching camera for top view API Call
            await axios
              .post(atemminiCameraSwitchApi, cameraViewParams, {
                headers: {
                  "Content-Type": "application/json",
                },
              })
              .then((switcherResponse) => {
                console.log(switcherResponse);
              })
              .catch((error) => {
                console.log(
                  "Error occurred while switching camera view: ",
                  error
                );
              });

            // Switch camera to front view after 2 seconds
            setTimeout(async () => {
              // Switch camera for front view Params
              let cameraViewParams = {
                GameCode: "TP",
                IsTopView: false,
                IsFrontView: true,
              };
              // Switching camera for front view API Call
              await axios
                .post(atemminiCameraSwitchApi, cameraViewParams, {
                  headers: {
                    "Content-Type": "application/json",
                  },
                })
                .then((switcherResponse) => {
                  console.log(switcherResponse);
                })
                .catch((error) => {
                  console.log(
                    "Error occurred while switching camera view: ",
                    error
                  );
                });
            }, 4000);
          }
          const playerArunner = mainRunner.filter(function (el) {
            return el.Rcode == "TP_PYA";
          })[0];
          await logger.info(
            uniqueNumber +
              ":[TP]: playerArunner : " +
              JSON.stringify(playerArunner)
          );
          if (!playerArunner) {
            await redisClient.del("TP");
            return res.status(200).json({
              success: false,
              message: constMessages.VALIDATION.RUNNER_NOT_FOUND,
              data: {},
            });
          }
          const playerBrunner = mainRunner.filter(function (el) {
            return el.Rcode == "TP_PYB";
          })[0];
          await logger.info(
            uniqueNumber +
              ":[TP]: playerBrunner : " +
              JSON.stringify(playerBrunner)
          );
          if (!playerBrunner) {
            await redisClient.del("TP");
            return res.status(200).json({
              success: false,
              message: constMessages.VALIDATION.RUNNER_NOT_FOUND,
              data: {},
            });
          }
          if (allRoundDetails.length >= 6) {
            await redisClient.del("TP");
            return res.status(200).json({
              success: false,
              message: constMessages.VALIDATION.ALL_CARD_OPEN_THIS_ROUND,
              data: {},
            });
          }
          if (allRoundDetails.length == 5) {
            // Switch camera for top view Params
            let cameraViewParams = {
              GameCode: "TP",
              IsTopView: true,
              IsFrontView: false,
            };
            // Switching camera for top view API Call
            await axios
              .post(atemminiCameraSwitchApi, cameraViewParams, {
                headers: {
                  "Content-Type": "application/json",
                },
              })
              .then((switcherResponse) => {
                console.log(switcherResponse);
              })
              .catch((error) => {
                console.log(
                  "Error occurred while switching camera view: ",
                  error
                );
              });

            for (const a in AllOdds) {
              AllOdds[a].st = config.ROUND.WINNER_STATUS;
            }
            sendHub.cn.cc.cr = scannedCard;
            sendHub.cn.cc.rni = playerBrunner.RunnerId;
            sendHub.cn.nc.rni = playerArunner.RunnerId;
            let Cards = [
              { rni: playerArunner.RunnerId, cr: "", sc: "", ek: "" },
              { rni: playerBrunner.RunnerId, cr: "", sc: "", ek: "" },
            ];
            let CreateRoundCards = [
              { rni: playerArunner.RunnerId, cr: "", sc: "" },
              { rni: playerBrunner.RunnerId, cr: "", sc: "" },
            ];
            let Odds = [
              { rni: playerArunner.RunnerId, bk: 0.0, ly: 0.0, st: 3 },
              { rni: playerBrunner.RunnerId, bk: 0.0, ly: 0.0, st: 3 },
            ];
            //TODO Emit Socket event to create new Round.
            let RunnerCards = [];
            let Params = {};
            let RoundCards = [];
            let player_id = 0;
            let lengthDt = allRoundDetails.length;
            let lastCards = JSON.parse(allRoundDetails[lengthDt - 1].Card);
            Cards = lastCards;
            let playerA = [];
            let playerB = [];
            for (const i in allRoundDetails) {
              RunnerCards.push(allRoundDetails[i].CurrentScannedCard);
              if (i == 0 || i == 2 || i == 4) {
                playerA.push(allRoundDetails[i].CurrentScannedCard);
              } else {
                playerB.push(allRoundDetails[i].CurrentScannedCard);
              }
            }
            if (lengthDt == 2 || lengthDt == 4 || lengthDt == 6) {
              runner_id = playerArunner.RunnerId;
              playerA.push(scannedCard);
              player_id = 0;
              RoundCards = playerA;
            } else {
              runner_id = playerBrunner.RunnerId;
              playerB.push(scannedCard);
              player_id = 1;
              RoundCards = playerB;
            }
            RunnerCards.push(scannedCard);
            Params = {
              PlayerA: playerA.join(" "),
              PlayerB: playerB.join(" "),
            };
            //TODO Remove it from here and add it at the top after line 45.
            await logger.info(
              uniqueNumber + ":[TP]: Params :" + JSON.stringify(Params)
            );
            let apiResponse = await callPythonAPI(Params);
            if (apiResponse?.Error !== undefined) {
              await logger.info(
                uniqueNumber +
                  ":[TP]: Error : apiResponse :" +
                  JSON.stringify(apiResponse)
              );
              await redisClient.del("TP");
              return res.status(200).json({
                success: false,
                message: constMessages.VALIDATION.SOMETHING_WRONG,
                data: {},
              });
            }
            await logger.info(
              uniqueNumber +
                ":[TP]: apiResponse : " +
                JSON.stringify(apiResponse)
            );
            let WinnerName = apiResponse["Winning hand"];
            let sideWinner = mainRunner.filter(function (el) {
              return el.Name == WinnerName;
            })[0];
            await logger.info(
              uniqueNumber + ":[TP]: sideWinner :" + JSON.stringify(sideWinner)
            );
            //if (!sideWinner) return res.status(200).json({ success: false, message: constMessages.VALIDATION.RUNNER_NOT_FOUND, data: {} });
            let sideWinnerId = sideWinner?.RunnerId;
            let WinnerId = 0;
            let runnerTitle = "";
            let RoundStatus = config.ROUND.WINNER_STATUS;
            if (apiResponse["Odds A win"] == "Winner!") {
              runnerTitle = "TP_PYA";
            }
            if (apiResponse["Odds B win"] == "Winner!") {
              runnerTitle = "TP_PYB";
            }
            if (apiResponse["Odds draw"] == "Draw!") {
              runnerTitle = "TP_D";
              RoundStatus = config.ROUND.CANCEL_ROUND_STATUS;
            }
            let Winner = mainRunner.filter(function (el) {
              return el.Rcode == runnerTitle;
            })[0];
            await logger.info(
              uniqueNumber + ":[TP]: Winner :" + JSON.stringify(Winner)
            );
            if (!Winner) {
              await redisClient.del("TP");
              return res.status(200).json({
                success: false,
                message: constMessages.VALIDATION.RUNNER_NOT_FOUND,
                data: {},
              });
            }
            sendHub.rs = Winner ? Winner.RunnerId : null;
            WinnerId = Winner.RunnerId;
            Cards[player_id].cr = RoundCards.join(" ");
            let updateRounds = {
              Status: RoundStatus,
              IsSettled: config.ROUND.IS_SETTLED,
              Result: WinnerId,
              ModifiedBy: config.ROUND.MODIFIED_BY,
              ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
            };

            if (sideWinnerId) {
              updateRounds.SideResult = JSON.stringify({ rni: [sideWinnerId] });
            } else {
              updateRounds.SideResult = JSON.stringify({ rni: [] });
            }
            await logger.info(
              uniqueNumber +
                ":[TP]: updateRounds : " +
                JSON.stringify(updateRounds)
            );
            await updateRound(getGameRound.RoundId, updateRounds);
            await updateRunnerByCode(gameDetail.GameId, "TP_PYA", {
              BackOdd: config.TEEN_PATTI.PLAYER_A.BackOdd,
              LayOdd: config.TEEN_PATTI.PLAYER_A.LayOdd,
              Cards: null,
              ModifiedBy: 1,
              ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
              Status: config.ROUND.WINNER_STATUS,
            });
            await updateRunnerByCode(gameDetail.GameId, "TP_PYB", {
              BackOdd: config.TEEN_PATTI.PLAYER_B.BackOdd,
              LayOdd: config.TEEN_PATTI.PLAYER_B.LayOdd,
              Cards: null,
              ModifiedBy: 1,
              ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
              Status: config.ROUND.WINNER_STATUS,
            });
            let detailsInsert = {
              RoundId: getGameRound.RoundId,
              CurrentScannedCard: scannedCard,
              Card: JSON.stringify(Cards),
              Odds: JSON.stringify(Odds),
              IsActive: config.ROUND_DETAILS.IS_ACTIVE,
              CreatedBy: config.ROUND_DETAILS.CREATED_BY,
              CreatedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
            };
            await logger.info(
              uniqueNumber +
                ":[TP]: detailsInsert : " +
                JSON.stringify(detailsInsert)
            );
            await createRoundDetails(detailsInsert);
            sendHub.crs = Cards;
            sendHub.od = AllOdds;
            sendHub.iro = true;
            sendHub.st = RoundStatus;
            sendHub.et = config.ROUND_RESULT_HUB_STATUS;
            if (sideWinnerId) {
              sendHub.sr.rni.push(sideWinnerId);
            }
            let newRound = {
              GameId: gameDetail.GameId,
              Status: config.ROUND.DEFAULT_ROUND_STATUS,
              IsActive: config.ROUND.IS_ACTIVE,
              CreatedBy: config.ROUND.CREATED_BY,
              CreatedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
              IsDelete: config.ROUND.IS_DELETE,
              updateCN: {
                cc: { rni: null, cr: null },
                nc: { rni: playerArunner.RunnerId },
              },
            };
            await logger.info(
              uniqueNumber + ":[TP]: sendHub :" + JSON.stringify(sendHub)
            );
            await sendDataToHub(sendHub, req.socket, uniqueNumber);
            await logger.info(
              uniqueNumber +
                ":[TP]: newRound-Socket : " +
                JSON.stringify(newRound)
            );
            await sendDataToDatabase(
              `${game_code}_create_round`,
              newRound,
              req.newsocket,
              config.ROUND_CREATE_POUSE_TIME * 1000,
              uniqueNumber
            );
          } else {
            let Cards = [
              { rni: playerArunner.RunnerId, cr: "", sc: "", ek: "" },
              { rni: playerBrunner.RunnerId, cr: "", sc: "", ek: "" },
            ];
            let Odds = [
              {
                rni: playerArunner.RunnerId,
                bk: 0.0,
                ly: 0.0,
                st: config.ROUND.DEFAULT_ROUND_STATUS,
              },
              {
                rni: playerBrunner.RunnerId,
                bk: 0.0,
                ly: 0.0,
                st: config.ROUND.DEFAULT_ROUND_STATUS,
              },
            ];
            let RunnerCards = [];
            let RoundCards = [];
            let Params = {};
            let player_id = 0;
            let playerA = [];
            let playerB = [];
            let lengthDt = allRoundDetails.length;
            if (allRoundDetails.length == 0) {
              sendHub.cn.cc.cr = scannedCard;
              sendHub.cn.cc.rni = playerArunner.RunnerId;
              sendHub.cn.nc.rni = playerBrunner.RunnerId;
              Params = {
                PlayerA: scannedCard,
                PlayerB: "",
              };
              playerA.push(scannedCard);
              RoundCards.push(scannedCard);
              RunnerCards.push(scannedCard);
              Cards[0].cr = scannedCard;
            } else {
              let lastCards = JSON.parse(allRoundDetails[lengthDt - 1].Card);
              Cards = lastCards;
              for (const i in allRoundDetails) {
                RunnerCards.push(allRoundDetails[i].CurrentScannedCard);
                if (i == 0 || i == 2 || i == 4) {
                  playerA.push(allRoundDetails[i].CurrentScannedCard);
                } else {
                  playerB.push(allRoundDetails[i].CurrentScannedCard);
                }
              }
              sendHub.cn.cc.cr = scannedCard;
              if (lengthDt == 2 || lengthDt == 4 || lengthDt == 6) {
                player_id = 0;
                playerA.push(scannedCard);
                RoundCards = playerA;
                sendHub.cn.cc.rni = playerArunner.RunnerId;
                sendHub.cn.nc.rni = playerBrunner.RunnerId;
              } else {
                player_id = 1;
                playerB.push(scannedCard);
                RoundCards = playerB;
                sendHub.cn.cc.rni = playerBrunner.RunnerId;
                sendHub.cn.nc.rni = playerArunner.RunnerId;
              }
              RunnerCards.push(scannedCard);
              Params = {
                PlayerA: playerA.join(" "),
                PlayerB: playerB.join(" "),
              };
            }
            //TODO Move this after line 45.
            await logger.info(
              uniqueNumber + ":[TP]: Params : " + JSON.stringify(Params)
            );
            let apiResponse = await callPythonAPI(Params);
            // await sendSlackMessage(`An error occurred: ${JSON.stringify(Params)}\nStack Trace:\n${JSON.stringify(apiResponse)}`);
            if (apiResponse?.Error !== undefined) {
              await logger.info(
                uniqueNumber +
                  ":[TP]: Error : apiResponse : " +
                  JSON.stringify(apiResponse)
              );
              await redisClient.del("TP");
              return res.status(200).json({
                success: false,
                message: constMessages.VALIDATION.SOMETHING_WRONG,
                data: {},
              });
            }
            await logger.info(
              uniqueNumber +
                ":[TP]: apiResponse : " +
                JSON.stringify(apiResponse)
            );
            if (
              apiResponse["Odds A win"] == "-" &&
              apiResponse["Odds B win"] == "-"
            ) {
              //TODO Update only on the 6th card. Remove it from here.
              await updateRunnerByCode(gameDetail.GameId, "TP_PYA", {
                BackOdd: config.TEEN_PATTI.PLAYER_A.BackOdd,
                LayOdd: config.TEEN_PATTI.PLAYER_A.LayOdd,
                Cards: playerA.join(" "),
                ModifiedBy: 1,
                ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
                Status: config.ROUND.DEFAULT_ROUND_STATUS,
              });
              await updateRunnerByCode(gameDetail.GameId, "TP_PYB", {
                BackOdd: config.TEEN_PATTI.PLAYER_B.BackOdd,
                LayOdd: config.TEEN_PATTI.PLAYER_B.LayOdd,
                Cards: playerB.join(" "),
                ModifiedBy: 1,
                ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
                Status: config.ROUND.DEFAULT_ROUND_STATUS,
              });
              Cards[player_id].cr = RoundCards.join(" ");
              let updateRounds = {
                Status: config.ROUND.DEFAULT_ROUND_STATUS,
                ModifiedBy: config.ROUND.MODIFIED_BY,
                ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
              };
              await logger.info(
                uniqueNumber +
                  ":[TP]: updateRounds : " +
                  JSON.stringify(updateRounds)
              );
              await updateRound(getGameRound.RoundId, updateRounds);
              let detailsInsert = {
                RoundId: getGameRound.RoundId,
                CurrentScannedCard: scannedCard,
                Card: JSON.stringify(Cards),
                Odds: JSON.stringify(Odds),
                IsActive: config.ROUND_DETAILS.IS_ACTIVE,
                CreatedBy: config.ROUND_DETAILS.CREATED_BY,
                CreatedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
              };
              await logger.info(
                uniqueNumber +
                  ":[TP]: detailsInsert : " +
                  JSON.stringify(detailsInsert)
              );
              await createRoundDetails(detailsInsert);
              sendHub.crs = Cards;
              sendHub.od = AllOdds;
            } else {
              let oddsPlayerA = apiResponse["Odds A win"];
              let oddsPlayerB = apiResponse["Odds B win"];
              //TODO Refactor this block to remove duplicate code fragment
              if (oddsPlayerA > oddsPlayerB) {
                let favourite = "TP_PYB";
                let not_favourite = "TP_PYA";
                let Lay = await getBackAndLay(oddsPlayerB);
                let NotLay = await getBackAndLay(oddsPlayerA);
                Cards[player_id].cr = RoundCards.join(" ");
                Odds[1].bk = parseFloat(parseFloat(oddsPlayerB).toFixed(2));
                Odds[1].ly = parseFloat(parseFloat(Lay).toFixed(2));
                if (gameDetail.game_type == 1) {
                  Odds[0].bk = 0.0;
                  Odds[0].ly = 0.0;
                  Odds[0].st = config.ROUND.SUSPENDED_RUNNER_STATUS;
                } else {
                  Odds[0].bk = parseFloat(parseFloat(oddsPlayerA).toFixed(2));
                  Odds[0].ly = parseFloat(parseFloat(NotLay).toFixed(2));
                }
                AllOdds[1].bk = parseFloat(parseFloat(oddsPlayerB).toFixed(2));
                AllOdds[1].ly = parseFloat(parseFloat(Lay).toFixed(2));
                if (gameDetail.game_type == 1) {
                  AllOdds[0].bk = 0.0;
                  AllOdds[0].ly = 0.0;
                  AllOdds[0].st = config.ROUND.SUSPENDED_RUNNER_STATUS;
                } else {
                  AllOdds[0].bk = parseFloat(
                    parseFloat(oddsPlayerA).toFixed(2)
                  );
                  AllOdds[0].ly = parseFloat(parseFloat(NotLay).toFixed(2));
                }
                //TODO Convert this to Stored Proc
                await updateRunnerByCode(gameDetail.GameId, favourite, {
                  BackOdd: oddsPlayerB,
                  LayOdd: Lay,
                  Cards: playerB.join(" "),
                  ModifiedBy: 1,
                  ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
                  Status: config.ROUND.DEFAULT_ROUND_STATUS,
                });
                if (gameDetail.game_type == 1) {
                  await updateRunnerByCode(gameDetail.GameId, not_favourite, {
                    BackOdd: 0.0,
                    LayOdd: 0.0,
                    Cards: playerA.join(" "),
                    ModifiedBy: 1,
                    ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
                    Status: config.ROUND.SUSPENDED_RUNNER_STATUS,
                  });
                } else {
                  await updateRunnerByCode(gameDetail.GameId, not_favourite, {
                    BackOdd: playerArunner.BackOdd,
                    LayOdd: playerArunner.LayOdd,
                    Cards: playerA.join(" "),
                    ModifiedBy: 1,
                    ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
                    Status: config.ROUND.DEFAULT_ROUND_STATUS,
                  });
                }
              } else if (oddsPlayerA == oddsPlayerB) {
                let Lay = await getBackAndLay(oddsPlayerB);
                let NotLay = await getBackAndLay(oddsPlayerA);
                Cards[player_id].cr = RoundCards.join(" ");
                Odds[1].bk = parseFloat(parseFloat(oddsPlayerB).toFixed(2));
                Odds[1].ly = parseFloat(parseFloat(Lay).toFixed(2));
                Odds[0].bk = parseFloat(parseFloat(oddsPlayerA).toFixed(2));
                Odds[0].ly = parseFloat(parseFloat(NotLay).toFixed(2));
                AllOdds[1].bk = parseFloat(parseFloat(oddsPlayerB).toFixed(2));
                AllOdds[1].ly = parseFloat(parseFloat(Lay).toFixed(2));
                AllOdds[0].bk = parseFloat(parseFloat(oddsPlayerA).toFixed(2));
                AllOdds[0].ly = parseFloat(parseFloat(NotLay).toFixed(2));
                //TODO Convert this to Stored Proc
                await updateRunnerByCode(gameDetail.GameId, "TP_PYB", {
                  BackOdd: oddsPlayerB,
                  LayOdd: Lay,
                  Cards: playerB.join(" "),
                  ModifiedBy: 1,
                  ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
                  Status: config.ROUND.DEFAULT_ROUND_STATUS,
                });
                await updateRunnerByCode(gameDetail.GameId, "TP_PYA", {
                  BackOdd: oddsPlayerA,
                  LayOdd: NotLay,
                  Cards: playerA.join(" "),
                  ModifiedBy: 1,
                  ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
                  Status: config.ROUND.DEFAULT_ROUND_STATUS,
                });
              } else {
                let favourite = "TP_PYA";
                let not_favourite = "TP_PYB";
                let Lay = await getBackAndLay(oddsPlayerA);
                let NotLay = await getBackAndLay(oddsPlayerB);
                Cards[player_id].cr = RoundCards.join(" ");
                Odds[0].bk = parseFloat(parseFloat(oddsPlayerA).toFixed(2));
                Odds[0].ly = parseFloat(parseFloat(Lay).toFixed(2));
                if (gameDetail.game_type == 1) {
                  Odds[1].bk = 0.0;
                  Odds[1].ly = 0.0;
                  Odds[1].st = config.ROUND.SUSPENDED_RUNNER_STATUS;
                } else {
                  Odds[1].bk = parseFloat(parseFloat(oddsPlayerB).toFixed(2));
                  Odds[1].ly = parseFloat(parseFloat(NotLay).toFixed(2));
                }
                AllOdds[0].bk = parseFloat(parseFloat(oddsPlayerA).toFixed(2));
                AllOdds[0].ly = parseFloat(parseFloat(Lay).toFixed(2));
                if (gameDetail.game_type == 1) {
                  AllOdds[1].bk = 0.0;
                  AllOdds[1].ly = 0.0;
                  AllOdds[1].st = config.ROUND.SUSPENDED_RUNNER_STATUS;
                } else {
                  AllOdds[1].bk = parseFloat(
                    parseFloat(oddsPlayerB).toFixed(2)
                  );
                  AllOdds[1].ly = parseFloat(parseFloat(NotLay).toFixed(2));
                }

                //TODO Convert this to Stored Proc
                await updateRunnerByCode(gameDetail.GameId, favourite, {
                  BackOdd: oddsPlayerA,
                  LayOdd: Lay,
                  Cards: playerA.join(" "),
                  ModifiedBy: 1,
                  ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
                  Status: config.ROUND.DEFAULT_ROUND_STATUS,
                });
                if (gameDetail.game_type == 1) {
                  await updateRunnerByCode(gameDetail.GameId, not_favourite, {
                    BackOdd: 0.0,
                    LayOdd: 0.0,
                    Cards: playerB.join(" "),
                    ModifiedBy: 1,
                    ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
                    Status: config.ROUND.SUSPENDED_RUNNER_STATUS,
                  });
                } else {
                  await updateRunnerByCode(gameDetail.GameId, not_favourite, {
                    BackOdd: playerBrunner.BackOdd,
                    LayOdd: playerBrunner.LayOdd,
                    Cards: playerB.join(" "),
                    ModifiedBy: 1,
                    ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
                    Status: config.ROUND.DEFAULT_ROUND_STATUS,
                  });
                }
              }
              let updateRounds = {
                Status: config.ROUND.DEFAULT_ROUND_STATUS,
                ModifiedBy: config.ROUND.MODIFIED_BY,
                ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
              };
              await logger.info(
                uniqueNumber +
                  ":[TP]: updateRounds : " +
                  JSON.stringify(updateRounds)
              );
              await updateRound(getGameRound.RoundId, updateRounds);
              let detailsInsert = {
                RoundId: getGameRound.RoundId,
                CurrentScannedCard: scannedCard,
                Card: JSON.stringify(Cards),
                Odds: JSON.stringify(Odds),
                IsActive: config.ROUND_DETAILS.IS_ACTIVE,
                CreatedBy: config.ROUND_DETAILS.CREATED_BY,
                CreatedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
              };
              await logger.info(
                uniqueNumber +
                  ":[TP]: detailsInsert : " +
                  JSON.stringify(detailsInsert)
              );
              await createRoundDetails(detailsInsert);
              sendHub.crs = Cards;
              sendHub.od = AllOdds;
            }
            let updateRounds = {
              RoundId: getGameRound.RoundId,
              GameId: gameDetail.GameId,
              Cards: Cards,
              Status: config.ROUND.SUSPENDED_ROUND_STATUS,
              ModifiedBy: config.ROUND.MODIFIED_BY,
              ModifiedOn: moment()
                .utc()
                .add(gameDetail.CardSec, "seconds")
                .format("YYYY-MM-DD HH:mm:ss"),
              updateCN: sendHub.cn,
            };
            await logger.info(
              uniqueNumber + ":[TP]: sendHub : " + JSON.stringify(sendHub)
            );
            await sendDataToHub(sendHub, req.socket, uniqueNumber);
            await logger.info(
              uniqueNumber +
                ":[TP]: updateRounds-Socket : " +
                JSON.stringify(updateRounds)
            );
            await sendDataToDatabase(
              `${game_code}_update_round`,
              updateRounds,
              req.newsocket,
              gameDetail.CardSec * 1000,
              uniqueNumber
            );
          }
          await logger.info(
            "Finish API :[TP]:" + uniqueNumber + " " + JSON.stringify(req.body)
          );
          await redisClient.del("TP");
          return res.status(200).json({
            success: true,
            message: constMessages.SUCCESS.CARD_SCAN_SUCCESS,
            data: {},
          });
        }
      }
      case "AB": {
        const working = await redisClient.get("AB");
        if (working) {
          await logger.info(
            uniqueNumber + ":[AB]: working : " + JSON.stringify(working)
          );
          return res.status(200).json({
            success: false,
            message: constMessages.VALIDATION.WORK_IN_PROGRESS,
            data: {},
          });
        }
        await redisClient.set("AB", "Available");
        const gameDetail = await getGameData(game_code);
        await logger.info(
          uniqueNumber + ":[AB]: gameDetail : " + JSON.stringify(gameDetail)
        );
        if (!gameDetail) {
          await redisClient.del("AB");
          return res.status(200).json({
            success: false,
            message: constMessages.VALIDATION.INVALID_GAMECODE,
            data: {},
          });
        }
        if (gameDetail.Status == 0) {
          await redisClient.del("AB");
          return res.status(200).json({
            success: false,
            message: constMessages.VALIDATION.GAME_NOT_ACTIVE,
            data: {},
            accessToken: "",
          });
        }
        let getGameRound = await getRoundData(gameDetail.GameId);
        await logger.info(
          uniqueNumber + ":[AB]: getGameRound : " + JSON.stringify(getGameRound)
        );
        if (!getGameRound) {
          const currentRoundData = await getCurrenRoundDataInRound(
            gameDetail.GameId
          );
          if (!currentRoundData) {
            await logger.info(
              uniqueNumber +
                ":[AB]: currentRoundData : " +
                JSON.stringify(currentRoundData)
            );
            await redisClient.del("AB");
            return res.status(200).json({
              success: false,
              message: `Please wait for ${config.ROUND_CREATE_POUSE_TIME} sec`,
              data: {},
            });
          } else {
            const allRoundDetails = await getCardDetailsByRoundId(
              currentRoundData.RoundId
            );
            if (allRoundDetails.length == 0) {
              await logger.info(
                uniqueNumber +
                  ":[AB]: allRoundDetails : " +
                  JSON.stringify(allRoundDetails)
              );
              await redisClient.del("AB");
              return res.status(200).json({
                success: false,
                message: `Please wait for ${gameDetail.GameSec} sec`,
                data: {},
              });
            } else {
              await logger.info(
                uniqueNumber +
                  ":[AB]: allRoundDetails : " +
                  JSON.stringify(allRoundDetails)
              );
              await redisClient.del("AB");
              return res.status(200).json({
                success: false,
                message: `Please wait for ${gameDetail.CardSec} sec`,
                data: {},
              });
            }
          }
        } else {
          const mainRunner = await getLiveRunnerAll(gameDetail.GameId);
          await logger.info(
            uniqueNumber + ":[AB]: mainRunner : " + JSON.stringify(mainRunner)
          );
          if (mainRunner.length == 0) {
            await redisClient.del("AB");
            return res.status(200).json({
              success: false,
              message: constMessages.VALIDATION.RUNNER_NOT_FOUND,
              data: {},
            });
          }
          const AllOdds = [];
          for (const runr of mainRunner) {
            let oddObj = {
              rni: runr.RunnerId,
              bk: parseFloat(parseFloat(runr.BackOdd).toFixed(2)),
              ly: 0.0,
              st: config.ROUND.SUSPENDED_RUNNER_STATUS,
            };
            AllOdds.push(oddObj);
          }
          let sendHub = {
            ri: getGameRound.RoundId,
            gc: game_code,
            cn: { cc: { rni: null, cr: null }, nc: { rni: null } },
            crs: [],
            od: AllOdds,
            rs: null,
            sr: { rni: [] },
            st: 1,
            iro: false,
            trs: gameDetail.CardSec,
            et: config.ROUND_CARD_SCAN_HUB_STATUS,
            ts: Date.now(),
          };
          await logger.info(
            uniqueNumber + ":[AB]: sendHub : " + JSON.stringify(sendHub)
          );
          const checkCardAlready = await checkRoundCardAlready(
            getGameRound.RoundId,
            scannedCard
          );
          await logger.info(
            uniqueNumber +
              ":[AB]: checkCardAlready : " +
              JSON.stringify(checkCardAlready)
          );
          if (checkCardAlready.length > 0) {
            await redisClient.del("AB");
            return res.status(200).json({
              success: false,
              message: constMessages.VALIDATION.DUPLICATE_CARD_SCAN,
              data: {},
            });
          }
          const allRoundDetails = await getCardDetailsByRoundId(
            getGameRound.RoundId
          );
          await logger.info(
            uniqueNumber +
              ":[AB]: allRoundDetails : " +
              JSON.stringify(allRoundDetails)
          );
          const andarRunner = mainRunner.filter(function (el) {
            return el.Rcode == "AB_AN";
          })[0];
          await logger.info(
            uniqueNumber + ":[AB]: andarRunner : " + JSON.stringify(andarRunner)
          );
          if (!andarRunner) {
            await redisClient.del("AB");
            return res.status(200).json({
              success: false,
              message: constMessages.VALIDATION.RUNNER_NOT_FOUND,
              data: {},
            });
          }
          const baharRunner = mainRunner.filter(function (el) {
            return el.Rcode == "AB_BA";
          })[0];
          await logger.info(
            uniqueNumber + ":[AB]: baharRunner : " + JSON.stringify(baharRunner)
          );
          if (!baharRunner) {
            await redisClient.del("AB");
            return res.status(200).json({
              success: false,
              message: constMessages.VALIDATION.RUNNER_NOT_FOUND,
              data: {},
            });
          }
          const jokarRunner = mainRunner.filter(function (el) {
            return el.Rcode == "AB_J";
          })[0];
          await logger.info(
            uniqueNumber + ":[AB]: jokarRunner : " + JSON.stringify(jokarRunner)
          );
          if (!jokarRunner) {
            await redisClient.del("AB");
            return res.status(200).json({
              success: false,
              message: constMessages.VALIDATION.RUNNER_NOT_FOUND,
              data: {},
            });
          }
          let Cards = [
            { rni: jokarRunner.RunnerId, cr: "", sc: "", ek: "" },
            { rni: andarRunner.RunnerId, cr: "", sc: "", ek: "" },
            { rni: baharRunner.RunnerId, cr: "", sc: "", ek: "" },
          ];
          let Odds = [
            {
              rni: andarRunner.RunnerId,
              bk: config.ANDAR_BAHAR.ANDAR_BACK_ODD,
              ly: 0.0,
              st: 1,
            },
            {
              rni: baharRunner.RunnerId,
              bk: config.ANDAR_BAHAR.BAHAR_BACK_ODD,
              ly: 0.0,
              st: 1,
            },
          ];
          let currentCardNumber = await getCardFirstForAndarBahar(scannedCard);
          let RunnerCards = [];
          let RoundCards = [];
          if (allRoundDetails.length == 0) {
            // Switch camera for top view Params
            let cameraViewParams = {
              GameCode: "AB",
              IsTopView: true,
              IsFrontView: false,
            };
            // Switching camera for top view API Call
            await axios
              .post(atemminiCameraSwitchApi, cameraViewParams, {
                headers: {
                  "Content-Type": "application/json",
                },
              })
              .then((switcherResponse) => {
                console.log(switcherResponse);
              })
              .catch((error) => {
                console.log(
                  "Error occurred while switching camera view: ",
                  error
                );
              });
            setTimeout(async () => {
              // Switch camera for front view Params after 2 seconds
              let cameraViewParams = {
                GameCode: "AB",
                IsTopView: false,
                IsFrontView: true,
              };
              // Switching camera for front view API Call
              await axios
                .post(atemminiCameraSwitchApi, cameraViewParams, {
                  headers: {
                    "Content-Type": "application/json",
                  },
                })
                .then((switcherResponse) => {
                  console.log(switcherResponse);
                })
                .catch((error) => {
                  console.log(
                    "Error occurred while switching camera view: ",
                    error
                  );
                });
            }, 3000);
            RunnerCards.push(scannedCard);
            sendHub.crs = Cards;
            let firstCardNumber = await getCardFirstForAndarBaharValue(
              scannedCard
            );
            let back = 0.0;
            if (firstCardNumber == 7) {
              back = 10.02;
            } else if (firstCardNumber > 7) {
              back = 1.98;
            } else if (firstCardNumber < 7) {
              back = 1.98;
            }
            sendHub.cn.cc.cr = scannedCard;
            sendHub.cn.cc.rni = jokarRunner.RunnerId;
            sendHub.cn.nc.rni = andarRunner.RunnerId;
            Cards[0].cr = scannedCard;
            let updateRounds = {
              Status: config.ROUND.DEFAULT_ROUND_STATUS,
              ModifiedBy: config.ROUND.MODIFIED_BY,
              ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
            };
            await logger.info(
              uniqueNumber +
                ":[AB]: updateRounds : " +
                JSON.stringify(updateRounds)
            );
            await updateRound(getGameRound.RoundId, updateRounds);
            let detailsInsert = {
              RoundId: getGameRound.RoundId,
              CurrentScannedCard: scannedCard,
              Card: JSON.stringify(Cards),
              Odds: JSON.stringify(Odds),
              IsActive: config.ROUND_DETAILS.IS_ACTIVE,
              CreatedBy: config.ROUND_DETAILS.CREATED_BY,
              CreatedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
            };
            await logger.info(
              uniqueNumber +
                ":[AB]: detailsInsert : " +
                JSON.stringify(detailsInsert)
            );
            await createRoundDetails(detailsInsert);
            await updateRunnerByCode(gameDetail.GameId, "AB_J", {
              BackOdd: back,
              LayOdd: 0.0,
              Cards: RunnerCards.join(" "),
              ModifiedBy: 1,
              ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
              Status: config.ROUND.CLOSED_ROUND_STATUS,
            });
            let newAllOdds = [];
            for (const rur of mainRunner) {
              if (rur.GroupId == 1) {
                let oddObj = {
                  rni: rur.RunnerId,
                  bk: parseFloat(parseFloat(rur.BackOdd).toFixed(2)),
                  ly: 0.0,
                  st: config.ROUND.DEFAULT_ROUND_STATUS,
                };
                newAllOdds.push(oddObj);
                await updateRunnerByCode(gameDetail.GameId, rur.Rcode, {
                  BackOdd: rur.BackOdd,
                  LayOdd: 0.0,
                  Cards: null,
                  ModifiedBy: 1,
                  ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
                  Status: config.ROUND.DEFAULT_ROUND_STATUS,
                });
              } else if (rur.GroupId == 5) {
                let oddObj = {
                  rni: rur.RunnerId,
                  bk: parseFloat(parseFloat(back).toFixed(2)),
                  ly: 0.0,
                  st: config.ROUND.CLOSED_ROUND_STATUS,
                };
                newAllOdds.push(oddObj);
              } else {
                let oddObj = {
                  rni: rur.RunnerId,
                  bk: parseFloat(parseFloat(rur.BackOdd).toFixed(2)),
                  ly: 0.0,
                  st: config.ROUND.SUSPENDED_RUNNER_STATUS,
                };
                newAllOdds.push(oddObj);
                await updateRunnerByCode(gameDetail.GameId, rur.Rcode, {
                  BackOdd: rur.BackOdd,
                  LayOdd: 0.0,
                  Cards: null,
                  ModifiedBy: 1,
                  ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
                  Status: config.ROUND.SUSPENDED_RUNNER_STATUS,
                });
              }
            }
            sendHub.od = newAllOdds;
            let updateRound1 = {
              RoundId: getGameRound.RoundId,
              GameId: gameDetail.GameId,
              Cards: Cards,
              Status: config.ROUND.SUSPENDED_ROUND_STATUS,
              ModifiedBy: config.ROUND.MODIFIED_BY,
              ModifiedOn: moment()
                .utc()
                .add(gameDetail.CardSec, "seconds")
                .format("YYYY-MM-DD HH:mm:ss"),
              updateCN: sendHub.cn,
            };
            await logger.info(
              uniqueNumber + ":[AB]: sendHub : " + JSON.stringify(sendHub)
            );
            await sendDataToHub(sendHub, req.socket, uniqueNumber);
            await logger.info(
              uniqueNumber +
                ":[AB]: updateRound1-Socket : " +
                JSON.stringify(updateRound1)
            );
            await sendDataToDatabase(
              `${game_code}_update_round`,
              updateRound1,
              req.newsocket,
              gameDetail.CardSec * 1000,
              uniqueNumber
            );
          } else {
            if (allRoundDetails.length == 1) {
              // Switch camera for top view Params
              let cameraViewParams = {
                GameCode: "AB",
                IsTopView: true,
                IsFrontView: false,
              };
              // Switching camera for top view API Call
              await axios
                .post(atemminiCameraSwitchApi, cameraViewParams, {
                  headers: {
                    "Content-Type": "application/json",
                  },
                })
                .then((switcherResponse) => {
                  console.log(switcherResponse);
                })
                .catch((error) => {
                  console.log(
                    "Error occurred while switching camera view: ",
                    error
                  );
                });
            }
            let lengthDt = allRoundDetails.length;
            let firstCard = allRoundDetails[0].CurrentScannedCard;
            let newfirstCardNumber = await getCardFirstForAndarBahar(firstCard);
            let firstCardNumber = await getCardFirstForAndarBaharValue(
              firstCard
            );
            let lastCards = JSON.parse(allRoundDetails[lengthDt - 1].Card);
            let lastOdds = JSON.parse(allRoundDetails[lengthDt - 1].Odds);
            Cards = lastCards;
            Odds = lastOdds;
            let player_id = 0;
            let AndarCards = [];
            let BaharCards = [];
            let RunnerCards = [];
            for (const i in allRoundDetails) {
              RunnerCards.push(allRoundDetails[i].CurrentScannedCard);
              if (i > 0) {
                if (i % 2 == 0) {
                  BaharCards.push(allRoundDetails[i].CurrentScannedCard);
                } else {
                  AndarCards.push(allRoundDetails[i].CurrentScannedCard);
                }
              }
            }
            sendHub.cn.cc.cr = scannedCard;
            if (lengthDt % 2 == 0) {
              player_id = 2;
              BaharCards.push(scannedCard);
              RoundCards = BaharCards;
              sendHub.cn.cc.rni = baharRunner.RunnerId;
              sendHub.cn.nc.rni = andarRunner.RunnerId;
            } else {
              player_id = 1;
              AndarCards.push(scannedCard);
              RoundCards = AndarCards;
              sendHub.cn.cc.rni = andarRunner.RunnerId;
              sendHub.cn.nc.rni = baharRunner.RunnerId;
            }
            RunnerCards.push(scannedCard);
            if (currentCardNumber == newfirstCardNumber) {
              sendHub.cn.nc.rni = jokarRunner.RunnerId;
              for (const a in AllOdds) {
                AllOdds[a].st = config.ROUND.WINNER_STATUS;
              }
              let Name = "";
              if (lengthDt % 2 == 0) {
                Name = "AB_BA";
              } else {
                Name = "AB_AN";
              }
              let SideName = "";
              if (firstCardNumber == 7) {
                SideName = "AB_7";
              } else if (firstCardNumber > 7) {
                SideName = "AB_7U";
              } else if (firstCardNumber < 7) {
                SideName = "AB_7D";
              }
              let Winner = mainRunner.filter(function (el) {
                return el.Rcode == Name;
              })[0];
              await logger.info(
                uniqueNumber + ":[AB]: Winner : " + JSON.stringify(Winner)
              );
              if (!Winner) {
                await redisClient.del("AB");
                return res.status(200).json({
                  success: false,
                  message: constMessages.VALIDATION.RUNNER_NOT_FOUND,
                  data: {},
                });
              }
              let SideRunner = { rni: [] };
              let SideWinner = mainRunner.filter(function (el) {
                return el.Rcode == SideName;
              })[0];
              await logger.info(
                uniqueNumber +
                  ":[AB]: SideWinner : " +
                  JSON.stringify(SideWinner)
              );
              if (!SideWinner) {
                await redisClient.del("AB");
                return res.status(200).json({
                  success: false,
                  message: constMessages.VALIDATION.RUNNER_NOT_FOUND,
                  data: {},
                });
              }
              if (SideWinner) {
                SideRunner.rni.push(SideWinner.RunnerId);
              }
              const BlackRedJoker = await getCardColorAndarBaharJokar(
                firstCard
              );
              const BlackRedJokererunner = mainRunner.filter(function (el) {
                return el.Rcode == BlackRedJoker;
              })[0];
              if (BlackRedJokererunner) {
                SideRunner.rni.push(BlackRedJokererunner.RunnerId);
              }
              const BlackRedSuite = await getCardColorAndarBaharSuite(
                scannedCard
              );
              const BlackRedSuiterunner = mainRunner.filter(function (el) {
                return el.Rcode == BlackRedSuite;
              })[0];
              if (BlackRedSuiterunner) {
                SideRunner.rni.push(BlackRedSuiterunner.RunnerId);
              }
              sendHub.rs = Winner.RunnerId;
              sendHub.sr = SideRunner;
              let WinnerId = Winner.RunnerId;
              Cards[player_id].cr = RoundCards.join(" ");
              let updateRounds = {
                Status: config.ROUND.WINNER_STATUS,
                IsSettled: config.ROUND.IS_SETTLED,
                Result: WinnerId,
                SideResult: JSON.stringify(SideRunner),
                ModifiedBy: config.ROUND.MODIFIED_BY,
                ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
              };
              await logger.info(
                uniqueNumber +
                  ":[AB]: updateRounds : " +
                  JSON.stringify(updateRounds)
              );
              await updateRound(getGameRound.RoundId, updateRounds);
              await updateRunnerByCode(gameDetail.GameId, "AB_BA", {
                BackOdd: config.ANDAR_BAHAR.BAHAR_BACK_ODD,
                LayOdd: 0.0,
                Cards: null,
                ModifiedBy: 1,
                ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
                Status: config.ROUND.WINNER_STATUS,
              });
              await updateRunnerByCode(gameDetail.GameId, "AB_AN", {
                BackOdd: config.ANDAR_BAHAR.ANDAR_BACK_ODD,
                LayOdd: 0.0,
                Cards: null,
                ModifiedBy: 1,
                ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
                Status: config.ROUND.WINNER_STATUS,
              });
              await updateRunnerByCode(gameDetail.GameId, "AB_J", {
                BackOdd: 0.0,
                LayOdd: 0.0,
                Cards: null,
                ModifiedBy: 1,
                ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
              });
              await updateRunnerByCode(gameDetail.GameId, "AB_7", {
                BackOdd: config.ANDAR_BAHAR.SEVEN_BACK_ODD,
                LayOdd: 0.0,
                Cards: null,
                ModifiedBy: 1,
                ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
                Status: config.ROUND.WINNER_STATUS,
              });
              await updateRunnerByCode(gameDetail.GameId, "AB_7U", {
                BackOdd: config.ANDAR_BAHAR.SEVEN_UP_BACK_ODD,
                LayOdd: 0.0,
                Cards: null,
                ModifiedBy: 1,
                ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
                Status: config.ROUND.WINNER_STATUS,
              });
              await updateRunnerByCode(gameDetail.GameId, "AB_7D", {
                BackOdd: config.ANDAR_BAHAR.SEVEN_DOWN_BACK_ODD,
                LayOdd: 0.0,
                Cards: null,
                ModifiedBy: 1,
                ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
                Status: config.ROUND.WINNER_STATUS,
              });
              let detailsInsert = {
                RoundId: getGameRound.RoundId,
                CurrentScannedCard: scannedCard,
                Card: JSON.stringify(Cards),
                Odds: JSON.stringify(Odds),
                IsActive: config.ROUND_DETAILS.IS_ACTIVE,
                CreatedBy: config.ROUND_DETAILS.CREATED_BY,
                CreatedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
              };
              await logger.info(
                uniqueNumber +
                  ":[AB]: detailsInsert : " +
                  JSON.stringify(detailsInsert)
              );
              await createRoundDetails(detailsInsert);
              sendHub.crs = Cards;
              sendHub.iro = true;
              sendHub.st = 3;
              sendHub.et = config.ROUND_RESULT_HUB_STATUS;
              let newRound = {
                GameId: gameDetail.GameId,
                Status: config.ROUND.DEFAULT_ROUND_STATUS,
                IsActive: config.ROUND.IS_ACTIVE,
                CreatedBy: config.ROUND.CREATED_BY,
                CreatedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
                IsDelete: config.ROUND.IS_DELETE,
                updateCN: {
                  cc: { rni: null, cr: null },
                  nc: { rni: jokarRunner.RunnerId },
                },
              };
              await logger.info(
                uniqueNumber + ":[AB]: sendHub : " + JSON.stringify(sendHub)
              );
              await sendDataToHub(sendHub, req.socket, uniqueNumber);
              await logger.info(
                uniqueNumber +
                  ":[AB]: newRound-Socket : " +
                  JSON.stringify(newRound)
              );
              await sendDataToDatabase(
                `${game_code}_create_round`,
                newRound,
                req.newsocket,
                config.ROUND_CREATE_POUSE_TIME * 1000,
                uniqueNumber
              );
            } else {
              Cards[player_id].cr = RoundCards.join(" ");
              let updateRounds = {
                Status: config.ROUND.DEFAULT_ROUND_STATUS,
                ModifiedBy: config.ROUND.MODIFIED_BY,
                ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
              };
              await logger.info(
                uniqueNumber +
                  ":[AB]: updateRounds : " +
                  JSON.stringify(updateRounds)
              );
              await updateRound(getGameRound.RoundId, updateRounds);
              let detailsInsert = {
                RoundId: getGameRound.RoundId,
                CurrentScannedCard: scannedCard,
                Card: JSON.stringify(Cards),
                Odds: JSON.stringify(Odds),
                IsActive: config.ROUND_DETAILS.IS_ACTIVE,
                CreatedBy: config.ROUND_DETAILS.CREATED_BY,
                CreatedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
              };
              await logger.info(
                uniqueNumber +
                  ":[AB]: detailsInsert : " +
                  JSON.stringify(detailsInsert)
              );
              await createRoundDetails(detailsInsert);
              sendHub.crs = Cards;
              sendHub.trs = 0;
              await updateRunnerByCode(gameDetail.GameId, "AB_AN", {
                BackOdd: config.ANDAR_BAHAR.ANDAR_BACK_ODD,
                LayOdd: 0.0,
                Cards: AndarCards.join(" "),
                ModifiedBy: 1,
                ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
                Status: config.ROUND.DEFAULT_ROUND_STATUS,
              });
              await updateRunnerByCode(gameDetail.GameId, "AB_BA", {
                BackOdd: config.ANDAR_BAHAR.BAHAR_BACK_ODD,
                LayOdd: 0.0,
                Cards: BaharCards.join(" "),
                ModifiedBy: 1,
                ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
                Status: config.ROUND.DEFAULT_ROUND_STATUS,
              });
              let updateRoundd = {
                RoundId: getGameRound.RoundId,
                GameId: gameDetail.GameId,
                Cards: Cards,
                Status: config.ROUND.SUSPENDED_ROUND_STATUS,
                ModifiedBy: config.ROUND.MODIFIED_BY,
                ModifiedOn: moment()
                  .utc()
                  .add(gameDetail.CardSec, "seconds")
                  .format("YYYY-MM-DD HH:mm:ss"),
                updateCN: sendHub.cn,
              };
              await logger.info(
                uniqueNumber + ":[AB]: sendHub : " + JSON.stringify(sendHub)
              );
              await sendDataToHub(sendHub, req.socket, uniqueNumber);
              await logger.info(
                uniqueNumber +
                  ":[AB]: updateRoundd-Socket : " +
                  JSON.stringify(updateRoundd),
                uniqueNumber
              );
              await sendDataToDatabase(
                `${game_code}_update_round`,
                updateRoundd,
                req.newsocket,
                0
              );
            }
          }
          await logger.info(
            "Finish API :[AB]:" + uniqueNumber + " " + JSON.stringify(req.body)
          );
          await redisClient.del("AB");
          return res.status(200).json({
            success: true,
            message: constMessages.SUCCESS.CARD_SCAN_SUCCESS,
            data: {},
          });
        }
      }
      case "32C": {
        let validateCard = await getCardFirstForAndarBaharValue(scannedCard);
        if (validateCard < 6) {
          await logger.info(
            uniqueNumber +
              ":[32C]: Validate Card : " +
              JSON.stringify(validateCard)
          );
          return res.status(200).json({
            success: false,
            message: constMessages.VALIDATION.INVALID_CARD_SCAN,
            data: {},
          });
        }
        const working = await redisClient.get("32C");
        if (working) {
          await logger.info(
            uniqueNumber + ":[32C]: working : " + JSON.stringify(working)
          );
          return res.status(200).json({
            success: false,
            message: constMessages.VALIDATION.WORK_IN_PROGRESS,
            data: {},
          });
        }
        await redisClient.set("32C", "Available");
        const gameDetail = await getGameData(game_code);
        await logger.info(
          uniqueNumber + ":[32C]: gameDetail : " + JSON.stringify(gameDetail)
        );
        if (!gameDetail) {
          await redisClient.del("32C");
          return res.status(200).json({
            success: false,
            message: constMessages.VALIDATION.INVALID_GAMECODE,
            data: {},
          });
        }
        if (gameDetail.Status == 0) {
          await redisClient.del("32C");
          return res.status(200).json({
            success: false,
            message: constMessages.VALIDATION.GAME_NOT_ACTIVE,
            data: {},
            accessToken: "",
          });
        }
        let getGameRound = await getRoundData(gameDetail.GameId);
        await logger.info(
          uniqueNumber +
            ":[32C]: getGameRound : " +
            JSON.stringify(getGameRound)
        );
        if (!getGameRound) {
          const currentRoundData = await getCurrenRoundDataInRound(
            gameDetail.GameId
          );
          await logger.info(
            uniqueNumber +
              ":[32C]: currentRoundData : " +
              JSON.stringify(currentRoundData)
          );
          if (!currentRoundData) {
            await logger.info(
              uniqueNumber +
                ":[32C]: currentRoundData : Error : " +
                JSON.stringify(currentRoundData)
            );
            await redisClient.del("32C");
            return res.status(200).json({
              success: false,
              message: `Please wait for ${config.ROUND_CREATE_POUSE_TIME} sec`,
              data: {},
            });
          } else {
            const allRoundDetails = await getCardDetailsByRoundId(
              currentRoundData.RoundId
            );
            if (allRoundDetails.length == 0) {
              await logger.info(
                uniqueNumber +
                  ":[32C]: allRoundDetails : " +
                  JSON.stringify(allRoundDetails)
              );
              await redisClient.del("32C");
              return res.status(200).json({
                success: false,
                message: `Please wait for ${gameDetail.GameSec} sec`,
                data: {},
              });
            } else {
              await logger.info(
                uniqueNumber +
                  ":[32C]: allRoundDetails : " +
                  JSON.stringify(allRoundDetails)
              );
              await redisClient.del("32C");
              return res.status(200).json({
                success: false,
                message: `Please wait for ${gameDetail.CardSec} sec`,
                data: {},
              });
            }
          }
        } else {
          const mainRunner = await getLiveRunnerAll(gameDetail.GameId);
          await logger.info(
            uniqueNumber + ":[32C]: mainRunner : " + JSON.stringify(mainRunner)
          );
          if (mainRunner.length == 0) {
            await redisClient.del("32C");
            return res.status(200).json({
              success: false,
              message: constMessages.VALIDATION.RUNNER_NOT_FOUND,
              data: {},
            });
          }
          const PlayerARunner = mainRunner.filter(function (el) {
            return el.Rcode == "C32_8";
          })[0];
          await logger.info(
            uniqueNumber +
              ":[32C]: PlayerARunner : " +
              JSON.stringify(PlayerARunner)
          );
          const checkCardAlready = await checkRoundCardAlready(
            getGameRound.RoundId,
            scannedCard
          );
          await logger.info(
            uniqueNumber +
              ":[32C]: checkCardAlready : " +
              JSON.stringify(checkCardAlready)
          );
          if (checkCardAlready.length > 0) {
            await redisClient.del("32C");
            return res.status(200).json({
              success: false,
              message: constMessages.VALIDATION.DUPLICATE_CARD_SCAN,
              data: {},
            });
          }
          const allRoundDetails = await getCardDetailsByRoundId(
            getGameRound.RoundId
          );
          const AllOdds = [];
          const AllCards = [];
          const AllScores = [];
          const AllPlayers = [];
          const AllCN = { cc: { rni: null, cr: null }, nc: { rni: null } };
          for (const runr of mainRunner) {
            if (runr.GroupId == 1) {
              if (allRoundDetails.length == 0) {
                let oddObj = {
                  rni: runr.RunnerId,
                  bk: parseFloat(parseFloat(1.97).toFixed(2)),
                  ly: 0.0,
                  st: config.ROUND.SUSPENDED_RUNNER_STATUS,
                };
                AllOdds.push(oddObj);
              } else {
                let oddObj = {
                  rni: runr.RunnerId,
                  bk: parseFloat(parseFloat(runr.BackOdd).toFixed(2)),
                  ly: 0.0,
                  st: config.ROUND.SUSPENDED_RUNNER_STATUS,
                };
                AllOdds.push(oddObj);
              }
            } else {
              let oddObj = {
                rni: runr.RunnerId,
                bk: parseFloat(parseFloat(1.97).toFixed(2)),
                ly: 0.0,
                st: config.ROUND.SUSPENDED_RUNNER_STATUS,
              };
              AllOdds.push(oddObj);
            }
            if (runr.GroupId == 1) {
              let NewCard = runr.Cards;
              let cardObj = {
                rni: runr.RunnerId,
                cr: runr.Cards != null ? NewCard.split(" ") : "",
                sc: parseInt(runr.Score),
                ek: parseInt(runr.ExternalKey),
              };
              AllScores.push(parseInt(runr.Score));
              AllCards.push(cardObj);
            }
            if (runr.GroupId == 1 && runr.ExternalKey == 1) {
              AllPlayers.push(runr.RunnerId);
            }
          }
          AllCN.cc.cr = scannedCard;
          if (AllPlayers.length == 1) {
            AllCN.cc.rni = AllPlayers[0];
            AllCN.nc.rni = PlayerARunner.RunnerId;
          } else if (AllPlayers.length > 1) {
            AllCN.cc.rni = AllPlayers[0];
            AllCN.nc.rni = AllPlayers[1];
          }
          let sendHub = {
            ri: getGameRound.RoundId,
            gc: game_code,
            cn: AllCN,
            crs: [],
            od: AllOdds,
            rs: null,
            sr: { rni: [] },
            st: 1,
            iro: false,
            trs: gameDetail.CardSec,
            et: config.ROUND_CARD_SCAN_HUB_STATUS,
            ts: Date.now(),
          };
          await logger.info(
            uniqueNumber + ":[32C]: sendHub : " + JSON.stringify(sendHub)
          );
          let getPlayer = await getLiveRunnerAllOpen(gameDetail.GameId);
          await logger.info(
            uniqueNumber + ":[32C]: getPlayer : " + JSON.stringify(getPlayer)
          );
          if (getPlayer.length == 1) {
            let currentPlayer = getPlayer[0];
            let currentCards = currentPlayer.Cards;
            let currentPlayerCards =
              currentPlayer.Cards != null ? currentCards.split(" ") : "";
            let CardNumber = await getCardFirstForAndarBaharValue(scannedCard);
            let score = parseInt(currentPlayer.Score) + parseInt(CardNumber);
            let Cards = [];
            if (currentPlayerCards.length == 0) {
              Cards.push(scannedCard);
            } else {
              Cards = currentPlayerCards;
              Cards.push(scannedCard);
            }
            for (const k in mainRunner) {
              if (mainRunner[k].GroupId == 1) {
                if (mainRunner[k].Name == currentPlayer.Name) {
                  AllCards[k].cr = Cards.join(" ");
                  AllCards[k].sc = score;
                  AllScores[k] = score;
                } else {
                  if (mainRunner[k].Cards != null) {
                    AllCards[k].cr = mainRunner[k].Cards;
                  }
                }
              }
            }
            sendHub.crs = AllCards;
            let largestValue = Math.max(...AllScores);
            let largestIndices = [];
            let smallIndices = [];
            for (let i = 0; i < AllScores.length; i++) {
              if (AllScores[i] > largestValue) {
                largestIndices = [i];
              } else if (AllScores[i] === largestValue) {
                largestIndices.push(i);
              } else {
                smallIndices.push(i);
              }
            }
            if (largestIndices.length == 1) {
              for (const a in AllOdds) {
                AllOdds[a].st = config.ROUND.WINNER_STATUS;
              }
              for (const a in AllCards) {
                AllCards[a].ek = 1;
              }

              if (largestValue % 2 == 0) {
                SideName = "C32_WEV";
              } else {
                SideName = "C32_WOD";
              }
              let updateRounds = {
                Status: config.ROUND.WINNER_STATUS,
                IsSettled: config.ROUND.IS_SETTLED,
                Result: mainRunner[largestIndices[0]].RunnerId,
                SideResult: JSON.stringify({ rni: [] }),
                ModifiedBy: config.ROUND.MODIFIED_BY,
                ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
              };
              const SideRunner = mainRunner.filter(function (el) {
                return el.Rcode == SideName;
              })[0];
              await logger.info(
                uniqueNumber +
                  ":[32C]: SideRunner : " +
                  JSON.stringify(SideRunner)
              );
              if (SideRunner) {
                updateRounds.SideResult = JSON.stringify({
                  rni: [SideRunner.RunnerId],
                });
                sendHub.sr = { rni: [SideRunner.RunnerId] };
              }
              await logger.info(
                uniqueNumber +
                  ":[32C]: updateRounds : " +
                  JSON.stringify(updateRounds)
              );
              await updateRound(getGameRound.RoundId, updateRounds);
              let detailsInsert = {
                RoundId: getGameRound.RoundId,
                CurrentScannedCard: scannedCard,
                Card: JSON.stringify(AllCards),
                Odds: JSON.stringify(AllOdds),
                Score: score,
                IsActive: config.ROUND_DETAILS.IS_ACTIVE,
                CreatedBy: config.ROUND_DETAILS.CREATED_BY,
                CreatedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
              };
              await logger.info(
                uniqueNumber +
                  ":[32C]: detailsInsert : " +
                  JSON.stringify(detailsInsert)
              );
              await createRoundDetails(detailsInsert);
              await updateRunnerByCode(gameDetail.GameId, "C32_8", {
                BackOdd: config.THURTY_TWO_CARD.ODDS.PLAYER_A,
                LayOdd: 0,
                Cards: null,
                Score: config.THURTY_TWO_CARD.SCORE.PLAYER_A,
                Status: 3,
                ExternalKey: 1,
                ModifiedBy: 1,
                ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
              });
              await updateRunnerByCode(gameDetail.GameId, "C32_9", {
                BackOdd: config.THURTY_TWO_CARD.ODDS.PLAYER_B,
                LayOdd: 0,
                Cards: null,
                Score: config.THURTY_TWO_CARD.SCORE.PLAYER_B,
                Status: 3,
                ExternalKey: 1,
                ModifiedBy: 1,
                ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
              });
              await updateRunnerByCode(gameDetail.GameId, "C32_10", {
                BackOdd: config.THURTY_TWO_CARD.ODDS.PLAYER_C,
                LayOdd: 0,
                Cards: null,
                Score: config.THURTY_TWO_CARD.SCORE.PLAYER_C,
                Status: 3,
                ExternalKey: 1,
                ModifiedBy: 1,
                ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
              });
              await updateRunnerByCode(gameDetail.GameId, "C32_11", {
                BackOdd: config.THURTY_TWO_CARD.ODDS.PLAYER_D,
                LayOdd: 0,
                Cards: null,
                Score: config.THURTY_TWO_CARD.SCORE.PLAYER_D,
                Status: 3,
                ExternalKey: 1,
                ModifiedBy: 1,
                ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
              });
              sendHub.rs = mainRunner[largestIndices[0]].RunnerId;
              sendHub.od = AllOdds;
              sendHub.crs = AllCards;
              sendHub.iro = true;
              sendHub.st = 3;
              sendHub.et = config.ROUND_RESULT_HUB_STATUS;
              let newRound = {
                GameId: gameDetail.GameId,
                Status: config.ROUND.DEFAULT_ROUND_STATUS,
                IsActive: config.ROUND.IS_ACTIVE,
                CreatedBy: config.ROUND.CREATED_BY,
                CreatedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
                IsDelete: config.ROUND.IS_DELETE,
                updateCN: {
                  cc: { rni: null, cr: null },
                  nc: { rni: PlayerARunner.RunnerId },
                },
              };
              await logger.info(
                uniqueNumber + ":[32C]: sendHub : " + JSON.stringify(sendHub)
              );
              await sendDataToHub(sendHub, req.socket, uniqueNumber);
              await logger.info(
                uniqueNumber +
                  ":[32C]: newRound-Socket : " +
                  JSON.stringify(newRound)
              );
              await sendDataToDatabase(
                `${game_code}_create_round`,
                newRound,
                req.newsocket,
                config.ROUND_CREATE_POUSE_TIME * 1000,
                uniqueNumber
              );
            } else {
              await updateRunnerByCode(gameDetail.GameId, currentPlayer.Rcode, {
                BackOdd: config.THURTY_TWO_CARD.DEFAULT_ODDS,
                LayOdd: 0,
                Cards: Cards.join(" "),
                Score: score,
                Status: 3,
                ExternalKey: 2,
                ModifiedBy: 1,
                ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
              });
              if (smallIndices.length > 0) {
                for (const k of smallIndices) {
                  AllOdds[k].st = 3;
                  AllCards[k].ek = 3;
                  let removeRunner = mainRunner[k].Rcode;
                  let removeCards = AllCards[k].cr;
                  removeCards = removeCards.split(" ");
                  let removeScore = AllCards[k].sc;
                  if (currentPlayer.Rcode == removeRunner) {
                    await updateRunnerByCode(
                      gameDetail.GameId,
                      currentPlayer.Rcode,
                      {
                        BackOdd: config.THURTY_TWO_CARD.DEFAULT_ODDS,
                        LayOdd: 0,
                        Cards: removeCards.join(" "),
                        Score: score,
                        Status: 3,
                        ExternalKey: 3,
                        ModifiedBy: 1,
                        ModifiedOn: moment()
                          .utc()
                          .format("YYYY-MM-DD HH:mm:ss"),
                      }
                    );
                  } else {
                    await updateRunnerByCode(gameDetail.GameId, removeRunner, {
                      BackOdd: config.THURTY_TWO_CARD.DEFAULT_ODDS,
                      LayOdd: 0,
                      Cards: removeCards.join(" "),
                      Score: removeScore,
                      Status: 3,
                      ExternalKey: 3,
                      ModifiedBy: 1,
                      ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
                    });
                  }
                }
              }
              if (largestIndices.length > 0) {
                let abc = 0;
                for (const j of largestIndices) {
                  if (abc == 0) {
                    sendHub.cn.nc.rni = mainRunner[j].RunnerId;
                  }
                  AllOdds[j].st = 1;
                  AllCards[j].ek = 1;
                  let removeRunner1 = mainRunner[j].Rcode;
                  let removeCards1 = AllCards[j].cr;
                  removeCards1 = removeCards1.split(" ");
                  let removeScore1 = AllCards[j].sc;
                  if (currentPlayer.Rcode == removeRunner1) {
                    await updateRunnerByCode(
                      gameDetail.GameId,
                      currentPlayer.Rcode,
                      {
                        BackOdd: config.THURTY_TWO_CARD.DEFAULT_ODDS,
                        LayOdd: 0,
                        Cards: removeCards1.join(" "),
                        Score: score,
                        Status: 1,
                        ExternalKey: 1,
                        ModifiedBy: 1,
                        ModifiedOn: moment()
                          .utc()
                          .format("YYYY-MM-DD HH:mm:ss"),
                      }
                    );
                  } else {
                    await updateRunnerByCode(gameDetail.GameId, removeRunner1, {
                      BackOdd: config.THURTY_TWO_CARD.DEFAULT_ODDS,
                      LayOdd: 0,
                      Cards: removeCards1.join(" "),
                      Score: removeScore1,
                      Status: 1,
                      ExternalKey: 1,
                      ModifiedBy: 1,
                      ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
                    });
                  }
                  abc++;
                }
              }
              let updateRounds = {
                Status: config.ROUND.SUSPENDED_ROUND_STATUS,
                ModifiedBy: config.ROUND.MODIFIED_BY,
                ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
              };
              await logger.info(
                uniqueNumber +
                  ":[32C]: updateRounds : " +
                  JSON.stringify(updateRounds)
              );
              await updateRound(getGameRound.RoundId, updateRounds);
              let detailsInsert = {
                RoundId: getGameRound.RoundId,
                CurrentScannedCard: scannedCard,
                Card: JSON.stringify(AllCards),
                Odds: JSON.stringify(AllOdds),
                Score: score,
                IsActive: config.ROUND_DETAILS.IS_ACTIVE,
                CreatedBy: config.ROUND_DETAILS.CREATED_BY,
                CreatedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
              };
              sendHub.crs = AllCards;
              sendHub.od = AllOdds;
              await logger.info(
                uniqueNumber +
                  ":[32C]: detailsInsert : " +
                  JSON.stringify(detailsInsert)
              );
              await createRoundDetails(detailsInsert);
              let updateRoundd = {
                RoundId: getGameRound.RoundId,
                GameId: gameDetail.GameId,
                Cards: AllCards,
                Status: config.ROUND.SUSPENDED_ROUND_STATUS,
                ModifiedBy: config.ROUND.MODIFIED_BY,
                ModifiedOn: moment()
                  .utc()
                  .add(gameDetail.CardSec, "seconds")
                  .format("YYYY-MM-DD HH:mm:ss"),
                updateCN: sendHub.cn,
              };
              await logger.info(
                uniqueNumber + ":[32C]: sendHub : " + JSON.stringify(sendHub)
              );
              await sendDataToHub(sendHub, req.socket, uniqueNumber);
              await logger.info(
                uniqueNumber +
                  ":[32C]: updateRoundd-Socket : " +
                  JSON.stringify(updateRoundd)
              );
              await sendDataToDatabase(
                `${game_code}_update_round`,
                updateRoundd,
                req.newsocket,
                gameDetail.CardSec * 1000,
                uniqueNumber
              );
            }
          } else {
            let currentPlayer = getPlayer[0];
            let currentCards = currentPlayer.Cards;
            let currentPlayerCards =
              currentPlayer.Cards != null ? currentCards.split(" ") : "";
            let CardNumber = await getCardFirstForAndarBaharValue(scannedCard);
            let score = parseInt(currentPlayer.Score) + parseInt(CardNumber);
            let Cards = [];
            if (currentPlayerCards.length == 0) {
              Cards.push(scannedCard);
            } else {
              Cards = currentPlayerCards;
              Cards.push(scannedCard);
            }
            for (const k in mainRunner) {
              if (mainRunner[k].Name == currentPlayer.Name) {
                AllCards[k].cr = Cards.join(" ");
                AllCards[k].sc = score;
                AllCards[k].ek = 2;
              } else {
                if (mainRunner[k].Cards != null) {
                  AllCards[k].cr = mainRunner[k].Cards;
                }
              }
              // if(mainRunner[k].Status == 3){
              // 	AllOdds[k].st = 3;
              // }
            }
            sendHub.crs = AllCards;
            let updateRounds = {
              Status: config.ROUND.DEFAULT_ROUND_STATUS,
              ModifiedBy: config.ROUND.MODIFIED_BY,
              ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
            };
            await logger.info(
              uniqueNumber +
                ":[32C]: updateRounds : " +
                JSON.stringify(updateRounds)
            );
            await updateRound(getGameRound.RoundId, updateRounds);
            if (allRoundDetails.length > 0) {
              await updateRunnerByCode(gameDetail.GameId, currentPlayer.Rcode, {
                BackOdd: config.THURTY_TWO_CARD.DEFAULT_ODDS,
                LayOdd: 0.0,
                Cards: Cards.join(" "),
                Score: score,
                Status: 3,
                ExternalKey: 2,
                ModifiedBy: 1,
                ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
              });
            } else {
              for (const j in mainRunner) {
                if (mainRunner[j].Rcode == currentPlayer.Rcode) {
                  AllOdds[j].st = 3;
                  await updateRunnerByCode(
                    gameDetail.GameId,
                    currentPlayer.Rcode,
                    {
                      BackOdd: config.THURTY_TWO_CARD.DEFAULT_ODDS,
                      LayOdd: 0.0,
                      Cards: Cards.join(" "),
                      Score: score,
                      Status: 3,
                      ExternalKey: 2,
                      ModifiedBy: 1,
                      ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
                    }
                  );
                } else {
                  if (mainRunner[j].GroupId == 2) {
                    AllOdds[j].st = 3;
                    await updateRunnerByCode(
                      gameDetail.GameId,
                      mainRunner[j].Rcode,
                      {
                        BackOdd: config.THURTY_TWO_CARD.DEFAULT_ODDS,
                        LayOdd: 0.0,
                        Cards: null,
                        Score: null,
                        Status: 3,
                        ExternalKey: null,
                        ModifiedBy: 1,
                        ModifiedOn: moment()
                          .utc()
                          .format("YYYY-MM-DD HH:mm:ss"),
                      }
                    );
                  } else {
                    AllOdds[j].st = 3;
                    await updateRunnerByCode(
                      gameDetail.GameId,
                      mainRunner[j].Rcode,
                      {
                        BackOdd: config.THURTY_TWO_CARD.DEFAULT_ODDS,
                        LayOdd: 0.0,
                        Cards: null,
                        Score: mainRunner[j].Score,
                        Status: 3,
                        ExternalKey: 1,
                        ModifiedBy: 1,
                        ModifiedOn: moment()
                          .utc()
                          .format("YYYY-MM-DD HH:mm:ss"),
                      }
                    );
                  }
                }
              }
            }
            sendHub.od = AllOdds;
            let detailsInsert = {
              RoundId: getGameRound.RoundId,
              CurrentScannedCard: scannedCard,
              Card: JSON.stringify(AllCards),
              Odds: JSON.stringify(AllOdds),
              Score: score,
              IsActive: config.ROUND_DETAILS.IS_ACTIVE,
              CreatedBy: config.ROUND_DETAILS.CREATED_BY,
              CreatedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
            };
            await logger.info(
              uniqueNumber +
                ":[32C]: detailsInsert : " +
                JSON.stringify(detailsInsert)
            );
            await createRoundDetails(detailsInsert);
            let updateRoundd = {
              RoundId: getGameRound.RoundId,
              GameId: gameDetail.GameId,
              Cards: AllCards,
              Status: config.ROUND.SUSPENDED_ROUND_STATUS,
              ModifiedBy: config.ROUND.MODIFIED_BY,
              ModifiedOn: moment()
                .utc()
                .add(gameDetail.CardSec, "seconds")
                .format("YYYY-MM-DD HH:mm:ss"),
              updateCN: sendHub.cn,
            };
            await logger.info(
              uniqueNumber + ":[32C]: sendHub: " + JSON.stringify(sendHub)
            );
            await sendDataToHub(sendHub, req.socket, uniqueNumber);
            await logger.info(
              uniqueNumber +
                ":[32C]: updateRoundd-Socket: " +
                JSON.stringify(updateRoundd)
            );
            await sendDataToDatabase(
              `${game_code}_update_round`,
              updateRoundd,
              req.newsocket,
              gameDetail.CardSec * 1000,
              uniqueNumber
            );
          }
          await logger.info(
            "Finish API :[32C]:" + uniqueNumber + " " + JSON.stringify(req.body)
          );
          await redisClient.del("32C");
          return res.status(200).json({
            success: true,
            message: constMessages.SUCCESS.CARD_SCAN_SUCCESS,
            data: {},
          });
        }
      }
      case "ARW": {
        const working = await redisClient.get("ARW");
        if (working) {
          await logger.info(
            uniqueNumber + ":[ARW]: working : " + JSON.stringify(working)
          );
          return res.status(200).json({
            success: false,
            message: constMessages.VALIDATION.WORK_IN_PROGRESS,
            data: {},
          });
        }
        await redisClient.set("ARW", "Available");
        const gameDetail = await getGameData(game_code);
        await logger.info(
          uniqueNumber + ":[ARW]: gameDetail: " + JSON.stringify(gameDetail)
        );
        if (!gameDetail) {
          await redisClient.del("ARW");
          return res.status(200).json({
            success: false,
            message: constMessages.VALIDATION.INVALID_GAMECODE,
            data: {},
          });
        }
        if (gameDetail.Status == 0) {
          await redisClient.del("ARW");
          return res.status(200).json({
            success: false,
            message: constMessages.VALIDATION.GAME_NOT_ACTIVE,
            data: {},
            accessToken: "",
          });
        }
        let getGameRound = await getRoundData(gameDetail.GameId);
        await logger.info(
          uniqueNumber + ":[ARW]: getGameRound: " + JSON.stringify(getGameRound)
        );
        if (!getGameRound) {
          const currentRoundData = await getCurrenRoundDataInRound(
            gameDetail.GameId
          );
          await logger.info(
            uniqueNumber +
              ":[ARW]: currentRoundData: " +
              JSON.stringify(currentRoundData)
          );
          if (!currentRoundData) {
            await logger.info(
              uniqueNumber +
                ":[ARW]: currentRoundData-Error: " +
                JSON.stringify(currentRoundData)
            );
            await redisClient.del("ARW");
            return res.status(200).json({
              success: false,
              message: `Please wait for ${config.ROUND_CREATE_POUSE_TIME} sec`,
              data: {},
            });
          } else {
            const allRoundDetails = await getCardDetailsByRoundId(
              currentRoundData.RoundId
            );
            if (allRoundDetails.length == 0) {
              await logger.info(
                uniqueNumber +
                  ":[ARW]: allRoundDetails: " +
                  JSON.stringify(allRoundDetails)
              );
              await redisClient.del("ARW");
              return res.status(200).json({
                success: false,
                message: `Please wait for ${gameDetail.GameSec} sec`,
                data: {},
              });
            } else {
              await logger.info(
                uniqueNumber +
                  ":[ARW]: allRoundDetails: " +
                  JSON.stringify(allRoundDetails)
              );
              await redisClient.del("ARW");
              return res.status(200).json({
                success: false,
                message: `Please wait for ${gameDetail.CardSec} sec`,
                data: {},
              });
            }
          }
        } else {
          const mainRunner = await getLiveRunnerAll(gameDetail.GameId);
          await logger.info(
            uniqueNumber + ":[ARW]: mainRunner: " + JSON.stringify(mainRunner)
          );
          const AllOdds = [];
          const AllCards = [];
          // Switch camera for top view Params
          let cameraViewParams = {
            GameCode: "ARW",
            IsTopView: true,
            IsFrontView: false,
          };
          // Switching camera for top view API Call
          await axios
            .post(atemminiCameraSwitchApi, cameraViewParams, {
              headers: {
                "Content-Type": "application/json",
              },
            })
            .then((switcherResponse) => {
              console.log(switcherResponse);
            })
            .catch((error) => {
              console.log(
                "Error occurred while switching camera view: ",
                error
              );
            });
          for (const runr of mainRunner) {
            let oddObj = {
              rni: runr.RunnerId,
              bk: parseFloat(parseFloat(runr.BackOdd).toFixed(2)),
              ly: 0.0,
              st: config.ROUND.WINNER_STATUS,
            };
            AllOdds.push(oddObj);
            if (runr.GroupId == 1) {
              let NewCard = runr.Cards;
              let cardObj = {
                rni: runr.RunnerId,
                cr: runr.Cards != null ? NewCard.split(" ") : "",
                sc: "",
                ek: "",
              };
              AllCards.push(cardObj);
            }
          }
          let NewCards = {
            rni: null,
            cr: "",
            sc: "",
            ek: "",
          };
          let sendHub = {
            ri: getGameRound.RoundId,
            gc: game_code,
            cn: { cc: { rni: null, cr: scannedCard }, nc: { rni: null } },
            crs: [],
            od: [],
            rs: null,
            sr: { rni: [] },
            st: 1,
            iro: false,
            trs: gameDetail.CardSec,
            et: config.ROUND_RESULT_HUB_STATUS,
            ts: Date.now(),
          };
          await logger.info(
            uniqueNumber + ":[ARW]: sendHub: " + JSON.stringify(sendHub)
          );
          const checkCardAlready = await checkRoundCardAlready(
            getGameRound.RoundId,
            scannedCard
          );
          if (checkCardAlready.length > 0) {
            await redisClient.del("ARW");
            return res.status(200).json({
              success: false,
              message: constMessages.VALIDATION.DUPLICATE_CARD_SCAN,
              data: {},
            });
          }
          let Cards = [];
          let Odds = [];
          let RunnerCards = [];
          RunnerCards.push(scannedCard);
          let currentCardNumber = await getCardFirstForAndarBahar(scannedCard);
          let Akbar = ["A", "2", "3", "4", "5", "6"];
          let Romeo = ["7", "8", "9", "10", "T"];
          let Walter = ["J", "Q", "K"];
          let Name = "";
          let Player = 0;
          if (Akbar.includes(currentCardNumber)) {
            Name = "ARW_AK";
            Player = 0;
          } else if (Romeo.includes(currentCardNumber)) {
            Name = "ARW_RO";
            Player = 1;
          } else {
            Name = "ARW_WR";
            Player = 2;
          }
          let Winner = mainRunner.filter(function (el) {
            return el.Rcode == Name;
          })[0];
          await logger.info(
            uniqueNumber + ":[ARW]: Winner: " + JSON.stringify(Winner)
          );
          if (!Winner) {
            await redisClient.del("ARW");
            return res.status(200).json({
              success: false,
              message: constMessages.VALIDATION.RUNNER_NOT_FOUND,
              data: {},
            });
          }
          let SideRunner = { rni: [] };
          let firstCardNumber = await getCardFirstForAndarBaharValue(
            scannedCard
          );
          let OddEven = "";
          if (firstCardNumber % 2 == 0) {
            OddEven = "ARW_EV";
          } else {
            OddEven = "ARW_OD";
          }
          const OddEvenrunner = mainRunner.filter(function (el) {
            return el.Rcode == OddEven;
          })[0];
          await logger.info(
            uniqueNumber +
              ":[ARW]: OddEvenrunner: " +
              JSON.stringify(OddEvenrunner)
          );
          if (OddEvenrunner) {
            SideRunner.rni.push(OddEvenrunner.RunnerId);
          }
          const BlackRed = await getCardColor(scannedCard);
          const BlackRedrunner = mainRunner.filter(function (el) {
            return el.Rcode == BlackRed;
          })[0];
          await logger.info(
            uniqueNumber +
              ":[ARW]: BlackRedrunner: " +
              JSON.stringify(BlackRedrunner)
          );
          if (BlackRedrunner) {
            SideRunner.rni.push(BlackRedrunner.RunnerId);
          }
          if (firstCardNumber == 7) {
            SideName = "ARW_7";
          } else if (firstCardNumber > 7) {
            SideName = "ARW_7U";
          } else if (firstCardNumber < 7) {
            SideName = "ARW_7D";
          }
          const SUDrunner = mainRunner.filter(function (el) {
            return el.Rcode == SideName;
          })[0];
          await logger.info(
            uniqueNumber + ":[ARW]: SUDrunner: " + JSON.stringify(SUDrunner)
          );
          if (SUDrunner) {
            SideRunner.rni.push(SUDrunner.RunnerId);
          }
          sendHub.sr = SideRunner;
          let WinnerId = Winner.RunnerId;
          sendHub.rs = WinnerId;
          NewCards.rni = WinnerId;
          NewCards.cr = RunnerCards.join(" ");
          Cards.push(NewCards);
          AllCards[Player].cr = RunnerCards.join(" ");
          AllOdds[Player].rni = WinnerId;
          let updateRounds = {
            Status: config.ROUND.WINNER_STATUS,
            IsSettled: config.ROUND.IS_SETTLED,
            Result: WinnerId,
            SideResult: JSON.stringify(SideRunner),
            ModifiedBy: config.ROUND.MODIFIED_BY,
            ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
          };
          await logger.info(
            uniqueNumber +
              ":[ARW]: updateRounds: " +
              JSON.stringify(updateRounds)
          );
          await updateRound(getGameRound.RoundId, updateRounds);
          let detailsInsert = {
            RoundId: getGameRound.RoundId,
            CurrentScannedCard: scannedCard,
            Card: JSON.stringify(AllCards),
            Odds: JSON.stringify(AllOdds),
            IsActive: config.ROUND_DETAILS.IS_ACTIVE,
            CreatedBy: config.ROUND_DETAILS.CREATED_BY,
            CreatedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
          };
          await logger.info(
            uniqueNumber +
              ":[ARW]: detailsInsert: " +
              JSON.stringify(detailsInsert)
          );
          await createRoundDetails(detailsInsert);
          sendHub.crs = AllCards;
          sendHub.od = AllOdds;
          sendHub.iro = true;
          sendHub.st = 3;
          let newRound = {
            GameId: gameDetail.GameId,
            Status: config.ROUND.DEFAULT_ROUND_STATUS,
            IsActive: config.ROUND.IS_ACTIVE,
            CreatedBy: config.ROUND.CREATED_BY,
            CreatedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
            IsDelete: config.ROUND.IS_DELETE,
          };
          await logger.info(
            uniqueNumber + ":[ARW]: sendHub: " + JSON.stringify(sendHub)
          );
          await sendDataToHub(sendHub, req.socket, uniqueNumber);
          await logger.info(
            uniqueNumber +
              ":[ARW]: newRound-Socket: " +
              JSON.stringify(newRound)
          );
          await sendDataToDatabase(
            `${game_code}_create_round`,
            newRound,
            req.newsocket,
            config.ROUND_CREATE_POUSE_TIME * 1000,
            uniqueNumber
          );
        }
        await logger.info(
          "Finish API :" + uniqueNumber + " " + JSON.stringify(req.body)
        );
        await redisClient.del("ARW");
        return res.status(200).json({
          success: true,
          message: constMessages.SUCCESS.CARD_SCAN_SUCCESS,
          data: {},
        });
      }
      case "LS": {
        const working = await redisClient.get("LS");
        if (working) {
          await logger.info(
            uniqueNumber + ":[LS]: working : " + JSON.stringify(working)
          );
          return res.status(200).json({
            success: false,
            message: constMessages.VALIDATION.WORK_IN_PROGRESS,
            data: {},
          });
        }
        await redisClient.set("LS", "Available");
        const gameDetail = await getGameData(game_code);
        await logger.info(
          uniqueNumber + ":[LS]: gameDetail: " + JSON.stringify(gameDetail)
        );
        if (!gameDetail) {
          await redisClient.del("LS");
          return res.status(200).json({
            success: false,
            message: constMessages.VALIDATION.INVALID_GAMECODE,
            data: {},
          });
        }
        if (gameDetail.Status == 0) {
          await redisClient.del("LS");
          return res.status(200).json({
            success: false,
            message: constMessages.VALIDATION.GAME_NOT_ACTIVE,
            data: {},
            accessToken: "",
          });
        }
        let getGameRound = await getRoundData(gameDetail.GameId);
        await logger.info(
          uniqueNumber + ":[LS]: getGameRound: " + JSON.stringify(getGameRound)
        );
        if (!getGameRound) {
          await redisClient.del("LS");
          return res.status(200).json({
            success: false,
            message: constMessages.VALIDATION.ROUND_NOT_EXIST,
            data: {},
          });
        } else {
          const mainRunner = await getLiveRunnerAll(gameDetail.GameId);
          await logger.info(
            uniqueNumber + ":[LS]: mainRunner: " + JSON.stringify(mainRunner)
          );
          const AllOdds = [];
          const AllCards = [];
          for (const runr of mainRunner) {
            let oddObj = {
              rni: runr.RunnerId,
              bk: parseFloat(parseFloat(runr.BackOdd).toFixed(2)),
              ly: 0.0,
              st: config.ROUND.WINNER_STATUS,
            };
            AllOdds.push(oddObj);
            let NewCard = runr.Cards;
            if (runr.GroupId == 1) {
              let cardObj = {
                rni: runr.RunnerId,
                cr: runr.Cards != null ? NewCard.split(" ") : "",
                sc: "",
                ek: "",
              };
              AllCards.push(cardObj);
            }
          }
          let NewCards = {
            rni: null,
            cr: "",
            sc: "",
            ek: "",
          };
          let sendHub = {
            ri: getGameRound.RoundId,
            gc: game_code,
            cn: { cc: { rni: null, cr: scannedCard }, nc: { rni: null } },
            crs: [],
            od: [],
            rs: null,
            sr: { rni: [] },
            st: 1,
            iro: false,
            trs: gameDetail.CardSec,
            et: config.ROUND_RESULT_HUB_STATUS,
            ts: Date.now(),
          };
          const checkCardAlready = await checkRoundCardAlready(
            getGameRound.RoundId,
            scannedCard
          );
          if (checkCardAlready.length > 0) {
            await redisClient.del("LS");
            return res.status(200).json({
              success: false,
              message: constMessages.VALIDATION.DUPLICATE_CARD_SCAN,
              data: {},
            });
          }
          let Cards = [];
          let RunnerCards = [];
          RunnerCards.push(scannedCard);
          let firstCardNumber = await getCardFirstForAndarBaharValue(
            scannedCard
          );
          let SideName = "";
          if (firstCardNumber % 2 == 0) {
            SideName = "Even";
          } else {
            SideName = "Odd";
          }
          let Name = "";
          let Player = 0;
          if (firstCardNumber == 7) {
            Name = "7";
            Player = 0;
          } else if (firstCardNumber > 7) {
            Name = "7 Up";
            Player = 1;
          } else if (firstCardNumber < 7) {
            Name = "7 Down";
            Player = 2;
          }
          let Winner = mainRunner.filter(function (el) {
            return el.Name == Name;
          })[0];
          await logger.info(
            uniqueNumber + ":[LS]: Winner: " + JSON.stringify(Winner)
          );
          if (!Winner) {
            await redisClient.del("LS");
            return res.status(200).json({
              success: false,
              message: constMessages.VALIDATION.RUNNER_NOT_FOUND,
              data: {},
            });
          }
          let SideWinner = mainRunner.filter(function (el) {
            return el.Name == SideName;
          })[0];
          await logger.info(
            uniqueNumber + ":[LS]: SideWinner: " + JSON.stringify(SideWinner)
          );
          if (!SideWinner) {
            await redisClient.del("LS");
            return res.status(200).json({
              success: false,
              message: constMessages.VALIDATION.RUNNER_NOT_FOUND,
              data: {},
            });
          }
          if (SideWinner) {
            sendHub.sr.rni.push(SideWinner.RunnerId);
          }
          let WinnerId = Winner.RunnerId;
          sendHub.rs = WinnerId;
          NewCards.rni = WinnerId;
          NewCards.cr = RunnerCards.join(" ");
          Cards.push(NewCards);
          AllCards[Player].cr = RunnerCards.join(" ");
          AllOdds[Player].rni = WinnerId;
          let updateRounds = {
            Status: config.ROUND.WINNER_STATUS,
            IsSettled: config.ROUND.IS_SETTLED,
            Result: WinnerId,
            SideResult: JSON.stringify({ rni: [SideWinner.RunnerId] }),
            ModifiedBy: config.ROUND.MODIFIED_BY,
            ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
          };
          await logger.info(
            uniqueNumber +
              ":[LS]: updateRounds: " +
              JSON.stringify(updateRounds)
          );
          await updateRound(getGameRound.RoundId, updateRounds);
          let detailsInsert = {
            RoundId: getGameRound.RoundId,
            CurrentScannedCard: scannedCard,
            Card: JSON.stringify(AllCards),
            Odds: JSON.stringify(AllOdds),
            IsActive: config.ROUND_DETAILS.IS_ACTIVE,
            CreatedBy: config.ROUND_DETAILS.CREATED_BY,
            CreatedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
          };
          await logger.info(
            uniqueNumber +
              ":[LS]: detailsInsert: " +
              JSON.stringify(detailsInsert)
          );
          await createRoundDetails(detailsInsert);
          sendHub.crs = AllCards;
          sendHub.od = AllOdds;
          sendHub.iro = true;
          sendHub.st = 3;
          let newRound = {
            GameId: gameDetail.GameId,
            Status: config.ROUND.DEFAULT_ROUND_STATUS,
            IsActive: config.ROUND.IS_ACTIVE,
            CreatedBy: config.ROUND.CREATED_BY,
            CreatedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
            IsDelete: config.ROUND.IS_DELETE,
          };
          await logger.info(
            uniqueNumber + ":[LS]: sendHub : " + JSON.stringify(sendHub)
          );
          await sendDataToHub(sendHub, req.socket, uniqueNumber);
          await logger.info(
            uniqueNumber +
              ":[LS]: newRound-Socket : " +
              JSON.stringify(newRound)
          );
          await sendDataToDatabase(
            `${game_code}_create_round`,
            newRound,
            req.newsocket,
            config.ROUND_CREATE_POUSE_TIME * 1000,
            uniqueNumber
          );
        }
        await redisClient.del("LS");
        return res.status(200).json({
          success: true,
          message: constMessages.SUCCESS.CARD_SCAN_SUCCESS,
          data: {},
        });
      }
      case "TP20": {
        const working = await redisClient.get("TP20");
        if (working) {
          await logger.info(
            uniqueNumber + ":[TP20]: working : " + JSON.stringify(working)
          );
          return res.status(200).json({
            success: false,
            message: constMessages.VALIDATION.WORK_IN_PROGRESS,
            data: {},
          });
        }
        await redisClient.set("TP20", "Available");
        const gameDetail = await getGameData(game_code);
        await logger.info(
          uniqueNumber + ":[TP20]: gameDetail : " + JSON.stringify(gameDetail)
        );
        if (!gameDetail) {
          await redisClient.del("TP20");
          return res.status(200).json({
            success: false,
            message: constMessages.VALIDATION.INVALID_GAMECODE,
            data: {},
          });
        }
        if (gameDetail.Status == 0) {
          await redisClient.del("TP20");
          return res.status(200).json({
            success: false,
            message: constMessages.VALIDATION.GAME_NOT_ACTIVE,
            data: {},
            accessToken: "",
          });
        }
        const mainRunner = await getLiveRunnerAll(gameDetail.GameId);
        await logger.info(
          uniqueNumber + ":[TP20]: mainRunner : " + JSON.stringify(mainRunner)
        );
        if (mainRunner.length == 0) {
          await redisClient.del("TP20");
          return res.status(200).json({
            success: false,
            message: constMessages.VALIDATION.RUNNER_NOT_FOUND,
            data: {},
          });
        }
        const AllOdds = [];
        for (const runr of mainRunner) {
          if (runr.GroupId == 1) {
            let oddObj = {
              rni: runr.RunnerId,
              bk: parseFloat(parseFloat(runr.BackOdd).toFixed(2)),
              ly: 0.0,
              st: config.ROUND.SUSPENDED_RUNNER_STATUS,
            };
            AllOdds.push(oddObj);
          } else {
            let oddObj = {
              rni: runr.RunnerId,
              bk: parseFloat(parseFloat(runr.BackOdd).toFixed(2)),
              ly: 0.0,
              st: config.ROUND.SUSPENDED_RUNNER_STATUS,
            };
            AllOdds.push(oddObj);
          }
        }
        let getGameRound = await getRoundData(gameDetail.GameId);
        await logger.info(
          uniqueNumber +
            ":[TP20]: getGameRound : " +
            JSON.stringify(getGameRound)
        );
        if (!getGameRound) {
          const currentRoundData = await getCurrenRoundDataInRound(
            gameDetail.GameId
          );
          await logger.info(
            uniqueNumber +
              ":[TP20]: currentRoundData : " +
              JSON.stringify(currentRoundData)
          );
          if (!currentRoundData) {
            await logger.info(
              uniqueNumber +
                ":[TP20]: currentRoundData-Error : " +
                JSON.stringify(currentRoundData)
            );
            await redisClient.del("TP20");
            return res.status(200).json({
              success: false,
              message: `Please wait for ${config.ROUND_CREATE_POUSE_TIME} sec`,
              data: {},
            });
          } else {
            const allRoundDetails = await getCardDetailsByRoundId(
              currentRoundData.RoundId
            );
            if (allRoundDetails.length == 0) {
              await logger.info(
                uniqueNumber +
                  ":[TP20]: allRoundDetails : " +
                  JSON.stringify(allRoundDetails)
              );
              await redisClient.del("TP20");
              return res.status(200).json({
                success: false,
                message: `Please wait for ${gameDetail.GameSec} sec`,
                data: {},
              });
            } else {
              await logger.info(
                uniqueNumber +
                  ":[TP20]: allRoundDetails : " +
                  JSON.stringify(allRoundDetails)
              );
              await redisClient.del("TP20");
              return res.status(200).json({
                success: false,
                message: `Please wait for ${gameDetail.CardSec} sec`,
                data: {},
              });
            }
          }
        } else {
          let sendHub = {
            ri: getGameRound.RoundId,
            gc: game_code,
            cn: { cc: { rni: null, cr: null }, nc: { rni: null } },
            crs: [],
            od: [],
            rs: "",
            sr: { rni: [] },
            st: 1,
            iro: false,
            trs: gameDetail.CardSec,
            et: "CardScan",
            ts: Date.now(),
          };
          await logger.info(
            uniqueNumber + ":[TP20]: sendHub : " + JSON.stringify(sendHub)
          );
          const checkCardAlready = await checkRoundCardAlready(
            getGameRound.RoundId,
            scannedCard
          );
          if (checkCardAlready.length > 0) {
            await redisClient.del("TP20");
            return res.status(200).json({
              success: false,
              message: constMessages.VALIDATION.DUPLICATE_CARD_SCAN,
              data: {},
            });
          }
          const allRoundDetails = await getCardDetailsByRoundId(
            getGameRound.RoundId
          );
          const playerArunner = mainRunner.filter(function (el) {
            return el.Rcode == "TP20_PYA";
          })[0];
          await logger.info(
            uniqueNumber +
              ":[TP20]: playerArunner : " +
              JSON.stringify(playerArunner)
          );
          if (!playerArunner) {
            await redisClient.del("TP20");
            return res.status(200).json({
              success: false,
              message: constMessages.VALIDATION.RUNNER_NOT_FOUND,
              data: {},
            });
          }
          const playerBrunner = mainRunner.filter(function (el) {
            return el.Rcode == "TP20_PYB";
          })[0];
          await logger.info(
            uniqueNumber +
              ":[TP20]: playerBrunner : " +
              JSON.stringify(playerBrunner)
          );
          if (!playerBrunner) {
            await redisClient.del("TP20");
            return res.status(200).json({
              success: false,
              message: constMessages.VALIDATION.RUNNER_NOT_FOUND,
              data: {},
            });
          }
          if (allRoundDetails.length >= 6) {
            await redisClient.del("TP20");
            return res.status(200).json({
              success: false,
              message: constMessages.VALIDATION.ALL_CARD_OPEN_THIS_ROUND,
              data: {},
            });
          }
          if (allRoundDetails.length == 5) {
            // Switch camera for top view Params
            let cameraViewParams = {
              GameCode: "TP20",
              IsTopView: true,
              IsFrontView: false,
            };
            // Switching camera for top view API Call
            await axios
              .post(atemminiCameraSwitchApi, cameraViewParams, {
                headers: {
                  "Content-Type": "application/json",
                },
              })
              .then((switcherResponse) => {
                console.log(switcherResponse);
              })
              .catch((error) => {
                console.log(
                  "Error occurred while switching camera view: ",
                  error
                );
              });
            for (const a in AllOdds) {
              AllOdds[a].st = config.ROUND.WINNER_STATUS;
            }
            sendHub.cn.cc.cr = scannedCard;
            sendHub.cn.cc.rni = playerBrunner.RunnerId;
            sendHub.cn.nc.rni = playerArunner.RunnerId;
            let Cards = [
              { rni: playerArunner.RunnerId, cr: "", sc: "", ek: "" },
              { rni: playerBrunner.RunnerId, cr: "", sc: "", ek: "" },
            ];
            let CreateRoundCards = [
              { rni: playerArunner.RunnerId, cr: "", sc: "" },
              { rni: playerBrunner.RunnerId, cr: "", sc: "" },
            ];
            let Odds = [
              { rni: playerArunner.RunnerId, bk: 0.0, ly: 0.0, st: 3 },
              { rni: playerBrunner.RunnerId, bk: 0.0, ly: 0.0, st: 3 },
            ];
            //TODO Emit Socket event to create new Round.
            let RunnerCards = [];
            let Params = {};
            let RoundCards = [];
            let player_id = 0;
            let lengthDt = allRoundDetails.length;
            let lastCards = JSON.parse(allRoundDetails[lengthDt - 1].Card);
            Cards = lastCards;
            let playerA = [];
            let playerB = [];
            for (const i in allRoundDetails) {
              RunnerCards.push(allRoundDetails[i].CurrentScannedCard);
              if (i % 2 == 0) {
                playerA.push(allRoundDetails[i].CurrentScannedCard);
              } else {
                playerB.push(allRoundDetails[i].CurrentScannedCard);
              }
            }
            if (lengthDt % 2 == 0) {
              runner_id = playerArunner.RunnerId;
              playerA.push(scannedCard);
              player_id = 0;
              RoundCards = playerA;
            } else {
              runner_id = playerBrunner.RunnerId;
              playerB.push(scannedCard);
              player_id = 1;
              RoundCards = playerB;
            }
            RunnerCards.push(scannedCard);
            Params = {
              PlayerA: playerA.join(" "),
              PlayerB: playerB.join(" "),
            };
            //TODO Remove it from here and add it at the top after line 45.
            await logger.info(
              uniqueNumber + ":[TP20]: Params : " + JSON.stringify(Params)
            );
            let apiResponse = await callPythonAPI(Params);
            await logger.info(
              uniqueNumber +
                ":[TP20]: apiResponse : " +
                JSON.stringify(apiResponse)
            );
            let WinnerId = 0;
            let runnerTitle = "";
            let RoundStatus = config.ROUND.WINNER_STATUS;
            if (apiResponse["Odds A win"] == "Winner!") {
              runnerTitle = "TP20_PYA";
            }
            if (apiResponse["Odds B win"] == "Winner!") {
              runnerTitle = "TP20_PYB";
            }
            if (apiResponse["Odds draw"] == "Draw!") {
              runnerTitle = "TP20_D";
              RoundStatus = config.ROUND.CANCEL_ROUND_STATUS;
            }
            let Winner = mainRunner.filter(function (el) {
              return el.Rcode == runnerTitle;
            })[0];
            await logger.info(
              uniqueNumber + ":[TP20]: Winner : " + JSON.stringify(Winner)
            );
            if (!Winner) {
              await redisClient.del("TP20");
              return res.status(200).json({
                success: false,
                message: constMessages.VALIDATION.RUNNER_NOT_FOUND,
                data: {},
              });
            }
            let WinnerName = apiResponse["Winning hand"];
            let sideWinner = mainRunner.filter(function (el) {
              return el.Name == WinnerName;
            })[0];
            await logger.info(
              uniqueNumber +
                ":[TP20]: sideWinner : " +
                JSON.stringify(sideWinner)
            );
            let sideWinnerId = sideWinner?.RunnerId;
            sendHub.sr = { rni: [] };
            sendHub.rs = Winner ? Winner.RunnerId : null;
            WinnerId = Winner.RunnerId;
            Cards[player_id].cr = RoundCards.join(" ");
            let updateRounds = {
              Status: RoundStatus,
              IsSettled: config.ROUND.IS_SETTLED,
              Result: WinnerId,
              SideResult: JSON.stringify({ rni: [] }),
              ModifiedBy: config.ROUND.MODIFIED_BY,
              ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
            };
            if (sideWinnerId) {
              updateRounds.SideResult = JSON.stringify({ rni: [sideWinnerId] });
            } else {
              updateRounds.SideResult = JSON.stringify({ rni: [] });
            }
            await logger.info(
              uniqueNumber +
                ":[TP20]: updateRounds : " +
                JSON.stringify(updateRounds)
            );
            await updateRound(getGameRound.RoundId, updateRounds);
            await updateRunnerByCode(gameDetail.GameId, "TP20_PYA", {
              BackOdd: config.TEEN_PATTI_TWENTY_TWENTY.PLAYER_A.BackOdd,
              LayOdd: config.TEEN_PATTI_TWENTY_TWENTY.PLAYER_A.LayOdd,
              Cards: null,
              ModifiedBy: 1,
              ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
              Status: config.ROUND.WINNER_STATUS,
            });
            await updateRunnerByCode(gameDetail.GameId, "TP20_PYB", {
              BackOdd: config.TEEN_PATTI_TWENTY_TWENTY.PLAYER_B.BackOdd,
              LayOdd: config.TEEN_PATTI_TWENTY_TWENTY.PLAYER_B.LayOdd,
              Cards: null,
              ModifiedBy: 1,
              ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
              Status: config.ROUND.WINNER_STATUS,
            });
            let detailsInsert = {
              RoundId: getGameRound.RoundId,
              CurrentScannedCard: scannedCard,
              Card: JSON.stringify(Cards),
              Odds: JSON.stringify(Odds),
              IsActive: config.ROUND_DETAILS.IS_ACTIVE,
              CreatedBy: config.ROUND_DETAILS.CREATED_BY,
              CreatedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
            };
            await createRoundDetails(detailsInsert);
            await logger.info(
              uniqueNumber +
                ":[TP20]: detailsInsert : " +
                JSON.stringify(detailsInsert)
            );
            sendHub.crs = Cards;
            sendHub.od = AllOdds;
            sendHub.iro = true;
            sendHub.st = 3;
            sendHub.et = config.ROUND_RESULT_HUB_STATUS;
            sendHub.sr = { rni: [] };
            if (sideWinnerId) {
              sendHub.sr.rni.push(sideWinnerId);
            }
            let newRound = {
              GameId: gameDetail.GameId,
              Status: config.ROUND.DEFAULT_ROUND_STATUS,
              IsActive: config.ROUND.IS_ACTIVE,
              CreatedBy: config.ROUND.CREATED_BY,
              CreatedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
              IsDelete: config.ROUND.IS_DELETE,
              updateCN: {
                cc: { rni: null, cr: null },
                nc: { rni: playerArunner.RunnerId },
              },
            };
            await logger.info(
              uniqueNumber + ":[TP20]: sendHub : " + JSON.stringify(sendHub)
            );
            await sendDataToHub(sendHub, req.socket, uniqueNumber);
            await logger.info(
              uniqueNumber +
                ":[TP20]: newRound-Socket : " +
                JSON.stringify(newRound)
            );
            await sendDataToDatabase(
              `${game_code}_create_round`,
              newRound,
              req.newsocket,
              config.ROUND_CREATE_POUSE_TIME * 1000,
              uniqueNumber
            );
          } else {
            let Cards = [
              { rni: playerArunner.RunnerId, cr: "", sc: "", ek: "" },
              { rni: playerBrunner.RunnerId, cr: "", sc: "", ek: "" },
            ];
            let Odds = [
              {
                rni: playerArunner.RunnerId,
                bk: 0.0,
                ly: 0.0,
                st: config.ROUND.DEFAULT_ROUND_STATUS,
              },
              {
                rni: playerBrunner.RunnerId,
                bk: 0.0,
                ly: 0.0,
                st: config.ROUND.DEFAULT_ROUND_STATUS,
              },
            ];
            let RunnerCards = [];
            let RoundCards = [];
            let playerA = [];
            let playerB = [];
            let Params = {};
            let player_id = 0;
            let lengthDt = allRoundDetails.length;
            if (allRoundDetails.length == 0) {
              sendHub.cn.cc.cr = scannedCard;
              sendHub.cn.cc.rni = playerArunner.RunnerId;
              sendHub.cn.nc.rni = playerBrunner.RunnerId;
              Params = {
                PlayerA: scannedCard,
                PlayerB: "",
              };
              playerA.push(scannedCard);
              RoundCards.push(scannedCard);
              RunnerCards.push(scannedCard);
              Cards[0].cr = scannedCard;
            } else {
              let lastCards = JSON.parse(allRoundDetails[lengthDt - 1].Card);
              Cards = lastCards;
              for (const i in allRoundDetails) {
                RunnerCards.push(allRoundDetails[i].CurrentScannedCard);
                if (i % 2 == 0) {
                  playerA.push(allRoundDetails[i].CurrentScannedCard);
                } else {
                  playerB.push(allRoundDetails[i].CurrentScannedCard);
                }
              }
              sendHub.cn.cc.cr = scannedCard;
              if (lengthDt % 2 == 0) {
                player_id = 0;
                playerA.push(scannedCard);
                RoundCards = playerA;
                sendHub.cn.cc.rni = playerArunner.RunnerId;
                sendHub.cn.nc.rni = playerBrunner.RunnerId;
              } else {
                player_id = 1;
                playerB.push(scannedCard);
                RoundCards = playerB;
                sendHub.cn.cc.rni = playerBrunner.RunnerId;
                sendHub.cn.nc.rni = playerArunner.RunnerId;
              }
              RunnerCards.push(scannedCard);
              Params = {
                PlayerA: playerA.join(" "),
                PlayerB: playerB.join(" "),
              };
            }
            await updateRunnerByCode(gameDetail.GameId, "TP20_PYA", {
              BackOdd: config.TEEN_PATTI_TWENTY_TWENTY.PLAYER_A.BackOdd,
              LayOdd: config.TEEN_PATTI_TWENTY_TWENTY.PLAYER_A.LayOdd,
              Cards: playerA.join(" "),
              ModifiedBy: 1,
              ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
              Status: config.ROUND.SUSPENDED_RUNNER_STATUS,
            });
            await updateRunnerByCode(gameDetail.GameId, "TP20_PYB", {
              BackOdd: config.TEEN_PATTI_TWENTY_TWENTY.PLAYER_B.BackOdd,
              LayOdd: config.TEEN_PATTI_TWENTY_TWENTY.PLAYER_B.LayOdd,
              Cards: playerB.join(" "),
              ModifiedBy: 1,
              ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
              Status: config.ROUND.SUSPENDED_RUNNER_STATUS,
            });
            Cards[player_id].cr = RoundCards.join(" ");
            let updateRounds = {
              Status: config.ROUND.DEFAULT_ROUND_STATUS,
              ModifiedBy: config.ROUND.MODIFIED_BY,
              ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
            };
            await logger.info(
              uniqueNumber +
                ":[TP20]: updateRounds : " +
                JSON.stringify(updateRounds)
            );
            await updateRound(getGameRound.RoundId, updateRounds);
            let detailsInsert = {
              RoundId: getGameRound.RoundId,
              CurrentScannedCard: scannedCard,
              Card: JSON.stringify(Cards),
              Odds: JSON.stringify(Odds),
              IsActive: config.ROUND_DETAILS.IS_ACTIVE,
              CreatedBy: config.ROUND_DETAILS.CREATED_BY,
              CreatedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
            };
            await logger.info(
              uniqueNumber +
                ":[TP20]: detailsInsert : " +
                JSON.stringify(detailsInsert)
            );
            await createRoundDetails(detailsInsert);
            sendHub.crs = Cards;
            sendHub.od = AllOdds;
            let updateRoundd = {
              RoundId: getGameRound.RoundId,
              GameId: gameDetail.GameId,
              Cards: Cards,
              Status: config.ROUND.SUSPENDED_ROUND_STATUS,
              ModifiedBy: config.ROUND.MODIFIED_BY,
              ModifiedOn: moment()
                .utc()
                .add(gameDetail.CardSec, "seconds")
                .format("YYYY-MM-DD HH:mm:ss"),
              updateCN: sendHub.cn,
            };
            await logger.info(
              uniqueNumber + ":[TP20]: sendHub : " + JSON.stringify(sendHub)
            );
            await sendDataToHub(sendHub, req.socket, uniqueNumber);
            await logger.info(
              uniqueNumber +
                ":[TP20]: updateRoundd-Socket : " +
                JSON.stringify(updateRoundd)
            );
            await sendDataToDatabase(
              `${game_code}_update_round`,
              updateRoundd,
              req.newsocket,
              gameDetail.CardSec * 1000,
              uniqueNumber
            );
          }
          await redisClient.del("TP20");
          return res.status(200).json({
            success: true,
            message: constMessages.SUCCESS.CARD_SCAN_SUCCESS,
            data: {},
          });
        }
      }
      case "DT": {
        const working = await redisClient.get("DT");
        if (working) {
          await logger.info(
            uniqueNumber + ":[DT]: working : " + JSON.stringify(working)
          );
          return res.status(200).json({
            success: false,
            message: constMessages.VALIDATION.WORK_IN_PROGRESS,
            data: {},
          });
        }
        await redisClient.set("DT", "Available");
        const gameDetail = await getGameData(game_code);
        await logger.info(
          uniqueNumber + ":[DT]: gameDetail : " + JSON.stringify(gameDetail)
        );
        if (!gameDetail) {
          await redisClient.del("DT");
          return res.status(200).json({
            success: false,
            message: constMessages.VALIDATION.INVALID_GAMECODE,
            data: {},
          });
        }
        if (gameDetail.Status == 0) {
          await redisClient.del("DT");
          return res.status(200).json({
            success: false,
            message: constMessages.VALIDATION.GAME_NOT_ACTIVE,
            data: {},
            accessToken: "",
          });
        }
        const mainRunner = await getLiveRunnerAll(gameDetail.GameId);
        await logger.info(
          uniqueNumber + ":[DT]: mainRunner : " + JSON.stringify(mainRunner)
        );
        if (mainRunner.length == 0) {
          await redisClient.del("DT");
          return res.status(200).json({
            success: false,
            message: constMessages.VALIDATION.RUNNER_NOT_FOUND,
            data: {},
          });
        }
        const AllOdds = [];
        for (const runr of mainRunner) {
          let oddObj = {
            rni: runr.RunnerId,
            bk: parseFloat(parseFloat(runr.BackOdd).toFixed(2)),
            ly: 0.0,
            st: config.ROUND.SUSPENDED_RUNNER_STATUS,
          };
          AllOdds.push(oddObj);
        }
        let getGameRound = await getRoundData(gameDetail.GameId);
        await logger.info(
          uniqueNumber + ":[DT]: getGameRound : " + JSON.stringify(getGameRound)
        );
        if (!getGameRound) {
          const currentRoundData = await getCurrenRoundDataInRound(
            gameDetail.GameId
          );
          await logger.info(
            uniqueNumber +
              ":[DT]: currentRoundData : " +
              JSON.stringify(currentRoundData)
          );
          if (!currentRoundData) {
            await logger.info(
              uniqueNumber +
                ":[DT]: currentRoundData-Error : " +
                JSON.stringify(currentRoundData)
            );
            await redisClient.del("DT");
            return res.status(200).json({
              success: false,
              message: `Please wait for ${config.ROUND_CREATE_POUSE_TIME} sec`,
              data: {},
            });
          } else {
            const allRoundDetails = await getCardDetailsByRoundId(
              currentRoundData.RoundId
            );
            if (allRoundDetails.length == 0) {
              await logger.info(
                uniqueNumber +
                  ":[DT]: allRoundDetails : " +
                  JSON.stringify(allRoundDetails)
              );
              await redisClient.del("DT");
              return res.status(200).json({
                success: false,
                message: `Please wait for ${gameDetail.GameSec} sec`,
                data: {},
              });
            } else {
              await logger.info(
                uniqueNumber +
                  ":[DT]: allRoundDetails : " +
                  JSON.stringify(allRoundDetails)
              );
              await redisClient.del("DT");
              return res.status(200).json({
                success: false,
                message: `Please wait for ${gameDetail.CardSec} sec`,
                data: {},
              });
            }
          }
        } else {
          let sendHub = {
            ri: getGameRound.RoundId,
            gc: game_code,
            cn: { cc: { rni: null, cr: null }, nc: { rni: null } },
            crs: [],
            od: [],
            rs: "",
            sr: { rni: [] },
            st: 1,
            iro: false,
            trs: gameDetail.CardSec,
            et: "CardScan",
            ts: Date.now(),
          };
          await logger.info(
            uniqueNumber + ":[DT]: sendHub : " + JSON.stringify(sendHub)
          );
          const checkCardAlready = await checkRoundCardAlready(
            getGameRound.RoundId,
            scannedCard
          );
          if (checkCardAlready.length > 0) {
            await redisClient.del("DT");
            return res.status(200).json({
              success: false,
              message: constMessages.VALIDATION.DUPLICATE_CARD_SCAN,
              data: {},
            });
          }
          const allRoundDetails = await getCardDetailsByRoundId(
            getGameRound.RoundId
          );
          const playerDragon = mainRunner.filter(function (el) {
            return el.Rcode == "DT_DG";
          })[0];
          await logger.info(
            uniqueNumber +
              ":[DT]: playerDragon : " +
              JSON.stringify(playerDragon)
          );
          if (!playerDragon) {
            await redisClient.del("DT");
            return res.status(200).json({
              success: false,
              message: constMessages.VALIDATION.RUNNER_NOT_FOUND,
              data: {},
            });
          }
          const playerTiger = mainRunner.filter(function (el) {
            return el.Rcode == "DT_TG";
          })[0];
          await logger.info(
            uniqueNumber + ":[DT]: playerTiger : " + JSON.stringify(playerTiger)
          );
          if (!playerTiger) {
            await redisClient.del("DT");
            return res.status(200).json({
              success: false,
              message: constMessages.VALIDATION.RUNNER_NOT_FOUND,
              data: {},
            });
          }
          const playerTia = mainRunner.filter(function (el) {
            return el.Rcode == "DT_TIE";
          })[0];
          await logger.info(
            uniqueNumber + ":[DT]: playerTia : " + JSON.stringify(playerTia)
          );
          if (!playerTia) {
            await redisClient.del("DT");
            return res.status(200).json({
              success: false,
              message: constMessages.VALIDATION.RUNNER_NOT_FOUND,
              data: {},
            });
          }
          if (allRoundDetails.length == 1) {
            for (const a in AllOdds) {
              AllOdds[a].st = config.ROUND.WINNER_STATUS;
            }
            sendHub.cn.cc.cr = scannedCard;
            sendHub.cn.cc.rni = playerTiger.RunnerId;
            sendHub.cn.nc.rni = playerDragon.RunnerId;
            let Cards = [
              { rni: playerDragon.RunnerId, cr: "", sc: "" },
              { rni: playerTiger.RunnerId, cr: "", sc: "" },
              { rni: playerTia.RunnerId, cr: "", sc: "" },
            ];
            let Odds = [
              {
                rni: playerDragon.RunnerId,
                bk: config.DRAGON_TIGER.DRAGON.BackOdd,
                ly: 0.0,
                st: config.ROUND.WINNER_STATUS,
              },
              {
                rni: playerTiger.RunnerId,
                bk: config.DRAGON_TIGER.TIGER.BackOdd,
                ly: 0.0,
                st: config.ROUND.WINNER_STATUS,
              },
              {
                rni: playerTia.RunnerId,
                bk: config.DRAGON_TIGER.TIE.BackOdd,
                ly: 0.0,
                st: config.ROUND.WINNER_STATUS,
              },
            ];
            let player_id = 0;
            let lengthDt = allRoundDetails.length;
            let lastCards = JSON.parse(allRoundDetails[lengthDt - 1].Card);
            Cards = lastCards;
            let Dragon = [];
            let Tiger = [];
            for (const i in allRoundDetails) {
              if (i % 2 == 0) {
                Dragon.push(allRoundDetails[i].CurrentScannedCard);
              } else {
                Tiger.push(allRoundDetails[i].CurrentScannedCard);
              }
            }
            if (lengthDt % 2 == 0) {
              Dragon.push(scannedCard);
              player_id = 0;
            } else {
              Tiger.push(scannedCard);
              player_id = 1;
            }
            let dragon_value = await getCardFirstForAndarBaharValue(Dragon[0]);
            let tiger_value = await getCardFirstForAndarBaharValue(Tiger[0]);
            const dragonCard = Dragon[0].split("");
            const tigerCard = Tiger[0].split("");
            let runnerTitle = "";
            let newSideWinner = [];
            let RoundStatus = 3;
            if (dragon_value > tiger_value) {
              runnerTitle = "DT_DG";
              if (dragon_value % 2 == 0) {
                let dragon_even = mainRunner.filter(function (el) {
                  return el.Rcode == "DT_D_EV";
                })[0];
                newSideWinner.push(dragon_even.RunnerId);
              } else {
                let dragon_odd = mainRunner.filter(function (el) {
                  return el.Rcode == "DT_D_OD";
                })[0];
                newSideWinner.push(dragon_odd.RunnerId);
              }
              if (dragonCard[1] == "S" || dragonCard[1] == "C") {
                let dragon_sute_black = mainRunner.filter(function (el) {
                  return el.Rcode == "DT_DS_BK";
                })[0];
                newSideWinner.push(dragon_sute_black.RunnerId);
              } else {
                let dragon_sute_red = mainRunner.filter(function (el) {
                  return el.Rcode == "DT_DS_RD";
                })[0];
                newSideWinner.push(dragon_sute_red.RunnerId);
              }
            } else if (tiger_value > dragon_value) {
              runnerTitle = "DT_TG";
              if (tiger_value % 2 == 0) {
                let tiger_even = mainRunner.filter(function (el) {
                  return el.Rcode == "DT_T_EV";
                })[0];
                newSideWinner.push(tiger_even.RunnerId);
              } else {
                let tiger_odd = mainRunner.filter(function (el) {
                  return el.Rcode == "DT_T_OD";
                })[0];
                newSideWinner.push(tiger_odd.RunnerId);
              }
              if (tigerCard[1] == "S" || tigerCard[1] == "C") {
                let tiger_sute_black = mainRunner.filter(function (el) {
                  return el.Rcode == "DT_TS_BK";
                })[0];
                newSideWinner.push(tiger_sute_black.RunnerId);
              } else {
                let tiger_sute_red = mainRunner.filter(function (el) {
                  return el.Rcode == "DT_TS_RD";
                })[0];
                newSideWinner.push(tiger_sute_red.RunnerId);
              }
            } else {
              runnerTitle = "DT_TIE";
              RoundStatus = 5;
            }
            let Winner = mainRunner.filter(function (el) {
              return el.Rcode == runnerTitle;
            })[0];
            if (!Winner)
              return res.status(200).json({
                success: false,
                message: constMessages.VALIDATION.RUNNER_NOT_FOUND,
                data: {},
              });
            sendHub.sr = { rni: newSideWinner };
            sendHub.rs = Winner ? Winner.RunnerId : null;
            let WinnerId = Winner.RunnerId;
            Cards[player_id].cr = Tiger.join(" ");
            let updateRounds = {
              Status: RoundStatus,
              IsSettled: config.ROUND.IS_SETTLED,
              Result: WinnerId,
              SideResult: JSON.stringify({ rni: newSideWinner }),
              ModifiedBy: config.ROUND.MODIFIED_BY,
              ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
            };
            await logger.info(
              uniqueNumber +
                ":[DT]: updateRounds : " +
                JSON.stringify(updateRounds)
            );
            await updateRound(getGameRound.RoundId, updateRounds);
            await updateRunnerByCode(gameDetail.GameId, "DT_DG", {
              BackOdd: config.DRAGON_TIGER.DRAGON.BackOdd,
              LayOdd: config.DRAGON_TIGER.DRAGON.LayOdd,
              Cards: Dragon.join(" "),
              ModifiedBy: 1,
              ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
              Status: config.ROUND.WINNER_STATUS,
            });
            await updateRunnerByCode(gameDetail.GameId, "DT_TG", {
              BackOdd: config.DRAGON_TIGER.TIGER.BackOdd,
              LayOdd: config.DRAGON_TIGER.TIGER.LayOdd,
              Cards: Tiger.join(" "),
              ModifiedBy: 1,
              ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
              Status: config.ROUND.WINNER_STATUS,
            });
            let detailsInsert = {
              RoundId: getGameRound.RoundId,
              CurrentScannedCard: scannedCard,
              Card: JSON.stringify(Cards),
              Odds: JSON.stringify(Odds),
              IsActive: config.ROUND_DETAILS.IS_ACTIVE,
              CreatedBy: config.ROUND_DETAILS.CREATED_BY,
              CreatedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
            };
            await createRoundDetails(detailsInsert);
            await logger.info(
              uniqueNumber +
                ":[DT]: detailsInsert : " +
                JSON.stringify(detailsInsert)
            );
            sendHub.crs = Cards;
            sendHub.od = AllOdds;
            sendHub.iro = true;
            sendHub.st = RoundStatus;
            sendHub.et = config.ROUND_RESULT_HUB_STATUS;
            sendHub.sr = { rni: newSideWinner };
            let newRound = {
              GameId: gameDetail.GameId,
              Status: config.ROUND.DEFAULT_ROUND_STATUS,
              IsActive: config.ROUND.IS_ACTIVE,
              CreatedBy: config.ROUND.CREATED_BY,
              CreatedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
              IsDelete: config.ROUND.IS_DELETE,
              updateCN: {
                cc: { rni: null, cr: null },
                nc: { rni: playerDragon.RunnerId },
              },
            };
            await logger.info(
              uniqueNumber + ":[DT]: sendHub : " + JSON.stringify(sendHub)
            );
            await sendDataToHub(sendHub, req.socket, uniqueNumber);
            await logger.info(
              uniqueNumber +
                ":[DT]: newRound-Socket : " +
                JSON.stringify(newRound)
            );
            await sendDataToDatabase(
              `${game_code}_create_round`,
              newRound,
              req.newsocket,
              config.ROUND_CREATE_POUSE_TIME * 1000,
              uniqueNumber
            );
          } else {
            let Cards = [
              { rni: playerDragon.RunnerId, cr: "", sc: "" },
              { rni: playerTiger.RunnerId, cr: "", sc: "" },
              { rni: playerTia.RunnerId, cr: "", sc: "" },
            ];
            let Odds = [
              {
                rni: playerDragon.RunnerId,
                bk: config.DRAGON_TIGER.DRAGON.BackOdd,
                ly: 0.0,
                st: config.ROUND.DEFAULT_ROUND_STATUS,
              },
              {
                rni: playerTiger.RunnerId,
                bk: config.DRAGON_TIGER.TIGER.BackOdd,
                ly: 0.0,
                st: config.ROUND.DEFAULT_ROUND_STATUS,
              },
              {
                rni: playerTia.RunnerId,
                bk: config.DRAGON_TIGER.TIE.BackOdd,
                ly: 0.0,
                st: config.ROUND.DEFAULT_ROUND_STATUS,
              },
            ];
            let Dragon = [];
            let Tiger = [];
            if (allRoundDetails.length == 0) {
              sendHub.cn.cc.cr = scannedCard;
              sendHub.cn.cc.rni = playerDragon.RunnerId;
              sendHub.cn.nc.rni = playerTiger.RunnerId;
              Dragon.push(scannedCard);
              Cards[0].cr = scannedCard;
            }
            await updateRunnerByCode(gameDetail.GameId, "DT_DG", {
              BackOdd: config.DRAGON_TIGER.DRAGON.BackOdd,
              LayOdd: config.DRAGON_TIGER.DRAGON.LayOdd,
              Cards: Dragon.join(" "),
              ModifiedBy: 1,
              ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
              Status: config.ROUND.DEFAULT_ROUND_STATUS,
            });
            await updateRunnerByCode(gameDetail.GameId, "DT_TG", {
              BackOdd: config.DRAGON_TIGER.TIGER.BackOdd,
              LayOdd: config.DRAGON_TIGER.TIGER.LayOdd,
              Cards: Tiger.join(" "),
              ModifiedBy: 1,
              ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
              Status: config.ROUND.DEFAULT_ROUND_STATUS,
            });
            let updateRounds = {
              Status: config.ROUND.DEFAULT_ROUND_STATUS,
              ModifiedBy: config.ROUND.MODIFIED_BY,
              ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
            };
            await logger.info(
              uniqueNumber +
                ":[DT]: updateRounds : " +
                JSON.stringify(updateRounds)
            );
            await updateRound(getGameRound.RoundId, updateRounds);
            let detailsInsert = {
              RoundId: getGameRound.RoundId,
              CurrentScannedCard: scannedCard,
              Card: JSON.stringify(Cards),
              Odds: JSON.stringify(Odds),
              IsActive: config.ROUND_DETAILS.IS_ACTIVE,
              CreatedBy: config.ROUND_DETAILS.CREATED_BY,
              CreatedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
            };
            await logger.info(
              uniqueNumber +
                ":[DT]: detailsInsert : " +
                JSON.stringify(detailsInsert)
            );
            await createRoundDetails(detailsInsert);
            sendHub.crs = Cards;
            sendHub.od = AllOdds;
            let updateRoundd = {
              RoundId: getGameRound.RoundId,
              GameId: gameDetail.GameId,
              Cards: Cards,
              Status: config.ROUND.SUSPENDED_ROUND_STATUS,
              ModifiedBy: config.ROUND.MODIFIED_BY,
              ModifiedOn: moment()
                .utc()
                .add(gameDetail.CardSec, "seconds")
                .format("YYYY-MM-DD HH:mm:ss"),
              updateCN: sendHub.cn,
            };
            await logger.info(
              uniqueNumber + ":[DT]: sendHub : " + JSON.stringify(sendHub)
            );
            await sendDataToHub(sendHub, req.socket, uniqueNumber);
            await logger.info(
              uniqueNumber +
                ":[DT]: updateRoundd-Socket : " +
                JSON.stringify(updateRoundd)
            );
            await sendDataToDatabase(
              `${game_code}_update_round`,
              updateRoundd,
              req.newsocket,
              gameDetail.CardSec * 1000,
              uniqueNumber
            );
          }
          await redisClient.del("DT");
          return res.status(200).json({
            success: true,
            message: constMessages.SUCCESS.CARD_SCAN_SUCCESS,
            data: {},
          });
        }
      }
      default: {
        return res.status(200).json({
          success: false,
          message: constMessages.VALIDATION.INVALID_GAME,
          data: {},
          accessToken: "",
        });
      }
    }
  } catch (err) {
    await logger.error(
      uniqueNumber +
        " [" +
        req.body.game_code +
        "] : Error : " +
        JSON.stringify(err.message)
    );
    await logger.error(
      uniqueNumber +
        " [" +
        req.body.game_code +
        "] : Error : " +
        JSON.stringify(err.stack)
    );
    await sendSlackMessage(
      `An error occurred: ${err.message}\nStack Trace: \n${err.stack}`
    );
    return res.status(200).json({ success: false, message: err.message });
  }
}

module.exports = {
  userLogin,
  scanCard,
  cancelRound,
};
