const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const moment = require("moment");
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
} = require("../../model/repositories/gameRepository");
const constMessages = (module.exports = require("../../config/messages.json"));
const config = (module.exports = require("../../config/config.json"));

async function userLogin(req, res) {
  try {
    const { gamecode, password } = req.body;
    const gameDetail = await getGameData(gamecode);
    if (!gameDetail)
      return res.status(200).json({
        success: false,
        message: constMessages.VALIDATION.INVALID_GAME_CODE_AND_PASSWORD,
        data: {},
        accessToken: "",
      });
    if (gameDetail.Status == 0)
      return res.status(200).json({
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
      return res.status(200).json({
        success: true,
        message: constMessages.SUCCESS.LOGIN_SUCCESS,
        data: {},
        accessToken: accessToken,
      });
    } else {
      return res.status(200).json({
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
async function scanCardTP(req, res, next) {
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
    const gameDetail = await getGameData(game_code);
    if (!gameDetail)
      return res.status(200).json({
        success: false,
        message: constMessages.VALIDATION.INVALID_GAMECODE,
        data: {},
      });
    if (gameDetail.Status == 0)
      return res.status(200).json({
        success: false,
        message: constMessages.VALIDATION.GAME_NOT_ACTIVE,
        data: {},
        accessToken: "",
      });
    const mainRunner = await getLiveRunnerAll(gameDetail.GameId);
    if (mainRunner.length == 0)
      return res.status(200).json({
        success: false,
        message: constMessages.VALIDATION.RUNNER_NOT_FOUND,
        data: {},
      });
    const AllOdds = [];
    for (const runr of mainRunner) {
      if (runr.GroupId == 2) {
        let oddObj = {
          rni: runr.RunnerId,
          bk: 0.0,
          ly: 0.0,
          st: config.ROUND.CLOSED_ROUND_STATUS,
        };
        AllOdds.push(oddObj);
      } else {
        let oddObj = {
          rni: runr.RunnerId,
          bk: parseFloat(0.0),
          ly: parseFloat(0.0),
          st: config.ROUND.DEFAULT_ROUND_STATUS,
        };
        AllOdds.push(oddObj);
      }
    }
    let getGameRound = await getRoundData(gameDetail.GameId);
    if (!getGameRound) {
      const currentRoundData = await getCurrenRoundDataInRound(
        gameDetail.GameId
      );
      if (!currentRoundData) {
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
          return res.status(200).json({
            success: false,
            message: `Please wait for ${gameDetail.GameSec} sec`,
            data: {},
          });
        } else {
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
      const checkCardAlready = await checkRoundCardAlready(
        getGameRound.RoundId,
        scannedCard
      );
      if (checkCardAlready.length > 0)
        return res.status(200).json({
          success: false,
          message: constMessages.VALIDATION.DUPLICATE_CARD_SCAN,
          data: {},
        });
      const allRoundDetails = await getCardDetailsByRoundId(
        getGameRound.RoundId
      );
      const playerArunner = mainRunner.filter(function (el) {
        return el.Rcode == "TP_PYA";
      })[0];
      if (!playerArunner)
        return res.status(200).json({
          success: false,
          message: constMessages.VALIDATION.RUNNER_NOT_FOUND,
          data: {},
        });
      const playerBrunner = mainRunner.filter(function (el) {
        return el.Rcode == "TP_PYB";
      })[0];
      if (!playerBrunner)
        return res.status(200).json({
          success: false,
          message: constMessages.VALIDATION.RUNNER_NOT_FOUND,
          data: {},
        });
      if (allRoundDetails.length == 5) {
        for (const a in AllOdds) {
          AllOdds[a].st = config.ROUND.WINNER_STATUS;
        }
        sendHub.cn.cc.cr = scannedCard;
        sendHub.cn.cc.rni = playerBrunner.RunnerId;
        sendHub.cn.nc.rni = playerArunner.RunnerId;
        let Cards = [
          { rni: playerArunner.RunnerId, cr: "", sc: "" },
          { rni: playerBrunner.RunnerId, cr: "", sc: "" },
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
        let apiResponse = await callPythonAPI(Params);
        if (apiResponse?.Error !== undefined) {
          return res.status(200).json({
            success: false,
            message: constMessages.VALIDATION.SOMETHING_WRONG,
            data: {},
          });
        }
        let WinnerName = apiResponse["Winning hand"];
        let sideWinner = mainRunner.filter(function (el) {
          return el.Name == WinnerName;
        })[0];
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
        if (!Winner)
          return res.status(200).json({
            success: false,
            message: constMessages.VALIDATION.RUNNER_NOT_FOUND,
            data: {},
          });
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
        await sendDataToHub(sendHub, req.socket);
        await sendDataToDatabase(
          `${game_code}_create_round`,
          newRound,
          req.newsocket,
          config.ROUND_CREATE_POUSE_TIME * 1000
        );
        // await createNewRoundToQueue(`${game_code}_create_round`, newRound, (config.ROUND_CREATE_POUSE_TIME * 1000));
      } else {
        let Cards = [
          { rni: playerArunner.RunnerId, cr: "", sc: "" },
          { rni: playerBrunner.RunnerId, cr: "", sc: "" },
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
        let apiResponse = await callPythonAPI(Params);
        // await sendSlackMessage(`An error occurred: ${JSON.stringify(Params)}\nStack Trace:\n${JSON.stringify(apiResponse)}`);
        if (apiResponse?.Error !== undefined) {
          return res.status(200).json({
            success: false,
            message: constMessages.VALIDATION.SOMETHING_WRONG,
            data: {},
          });
        }
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
            } else {
              Odds[0].bk = parseFloat(parseFloat(oddsPlayerA).toFixed(2));
              Odds[0].ly = parseFloat(parseFloat(NotLay).toFixed(2));
            }
            AllOdds[1].bk = parseFloat(parseFloat(oddsPlayerB).toFixed(2));
            AllOdds[1].ly = parseFloat(parseFloat(Lay).toFixed(2));
            if (gameDetail.game_type == 1) {
              AllOdds[0].bk = 0.0;
              AllOdds[0].ly = 0.0;
            } else {
              AllOdds[0].bk = parseFloat(parseFloat(oddsPlayerA).toFixed(2));
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
            await updateRunnerByCode(gameDetail.GameId, not_favourite, {
              BackOdd: playerArunner.BackOdd,
              LayOdd: playerArunner.LayOdd,
              Cards: playerA.join(" "),
              ModifiedBy: 1,
              ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
              Status: config.ROUND.DEFAULT_ROUND_STATUS,
            });
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
            } else {
              Odds[1].bk = parseFloat(parseFloat(oddsPlayerB).toFixed(2));
              Odds[1].ly = parseFloat(parseFloat(NotLay).toFixed(2));
            }
            AllOdds[0].bk = parseFloat(parseFloat(oddsPlayerA).toFixed(2));
            AllOdds[0].ly = parseFloat(parseFloat(Lay).toFixed(2));
            if (gameDetail.game_type == 1) {
              AllOdds[1].bk = 0.0;
              AllOdds[1].ly = 0.0;
            } else {
              AllOdds[1].bk = parseFloat(parseFloat(oddsPlayerB).toFixed(2));
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
            await updateRunnerByCode(gameDetail.GameId, not_favourite, {
              BackOdd: playerBrunner.BackOdd,
              LayOdd: playerBrunner.LayOdd,
              Cards: playerB.join(" "),
              ModifiedBy: 1,
              ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
              Status: config.ROUND.DEFAULT_ROUND_STATUS,
            });
          }
          let updateRounds = {
            Status: config.ROUND.DEFAULT_ROUND_STATUS,
            ModifiedBy: config.ROUND.MODIFIED_BY,
            ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
          };
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
        await sendDataToHub(sendHub, req.socket);
        await sendDataToDatabase(
          `${game_code}_update_round`,
          updateRounds,
          req.newsocket,
          gameDetail.CardSec * 1000
        );
        // await updateRoundToQueue(`${game_code}_update_round`, updateRounds, (gameDetail.CardSec * 1000))
      }
      return res.status(200).json({
        success: true,
        message: constMessages.SUCCESS.CARD_SCAN_SUCCESS,
        data: {},
      });
    }
  } catch (err) {
    await sendSlackMessage(
      `Game: TP\nAn error occurred: ${err.message}\nStack Trace: \n${err.stack}`
    );
    return res.status(200).json({ success: false, message: err.message });
  }
}
async function scanCardAB(req, res, next) {
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
    const gameDetail = await getGameData(game_code);
    if (!gameDetail)
      return res.status(200).json({
        success: false,
        message: constMessages.VALIDATION.INVALID_GAMECODE,
        data: {},
      });
    if (gameDetail.Status == 0)
      return res.status(200).json({
        success: false,
        message: constMessages.VALIDATION.GAME_NOT_ACTIVE,
        data: {},
        accessToken: "",
      });
    let getGameRound = await getRoundData(gameDetail.GameId);
    if (!getGameRound) {
      const currentRoundData = await getCurrenRoundDataInRound(
        gameDetail.GameId
      );
      if (!currentRoundData) {
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
          return res.status(200).json({
            success: false,
            message: `Please wait for ${gameDetail.GameSec} sec`,
            data: {},
          });
        } else {
          return res.status(200).json({
            success: false,
            message: `Please wait for ${gameDetail.CardSec} sec`,
            data: {},
          });
        }
      }
    } else {
      const mainRunner = await getLiveRunnerAll(gameDetail.GameId);
      if (mainRunner.length == 0)
        return res.status(200).json({
          success: false,
          message: constMessages.VALIDATION.RUNNER_NOT_FOUND,
          data: {},
        });
      const AllOdds = [];
      for (const runr of mainRunner) {
        let oddObj = {
          rni: runr.RunnerId,
          bk: parseFloat(parseFloat(runr.BackOdd).toFixed(2)),
          ly: 0.0,
          st: config.ROUND.CLOSED_ROUND_STATUS,
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
      const checkCardAlready = await checkRoundCardAlready(
        getGameRound.RoundId,
        scannedCard
      );
      if (checkCardAlready.length > 0)
        return res.status(200).json({
          success: false,
          message: constMessages.VALIDATION.DUPLICATE_CARD_SCAN,
          data: {},
        });
      const allRoundDetails = await getCardDetailsByRoundId(
        getGameRound.RoundId
      );
      const andarRunner = mainRunner.filter(function (el) {
        return el.Rcode == "AB_AN";
      })[0];
      if (!andarRunner)
        return res.status(200).json({
          success: false,
          message: constMessages.VALIDATION.RUNNER_NOT_FOUND,
          data: {},
        });
      const baharRunner = mainRunner.filter(function (el) {
        return el.Rcode == "AB_BA";
      })[0];
      if (!baharRunner)
        return res.status(200).json({
          success: false,
          message: constMessages.VALIDATION.RUNNER_NOT_FOUND,
          data: {},
        });
      const jokarRunner = mainRunner.filter(function (el) {
        return el.Rcode == "AB_J";
      })[0];
      if (!jokarRunner)
        return res.status(200).json({
          success: false,
          message: constMessages.VALIDATION.RUNNER_NOT_FOUND,
          data: {},
        });
      let Cards = [
        { rni: jokarRunner.RunnerId, cr: "", sc: "" },
        { rni: andarRunner.RunnerId, cr: "", sc: "" },
        { rni: baharRunner.RunnerId, cr: "", sc: "" },
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
        RunnerCards.push(scannedCard);
        sendHub.crs = Cards;
        let firstCardNumber = await getCardFirstForAndarBaharValue(scannedCard);
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
        await createRoundDetails(detailsInsert);
        await updateRunnerByCode(gameDetail.GameId, "AB_J", {
          BackOdd: back,
          LayOdd: 0.0,
          Cards: RunnerCards.join(" "),
          ModifiedBy: 1,
          ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
          Status: config.ROUND.DEFAULT_ROUND_STATUS,
        });
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
        await sendDataToHub(sendHub, req.socket);
        await sendDataToDatabase(
          `${game_code}_update_round`,
          updateRound1,
          req.newsocket,
          gameDetail.CardSec * 1000
        );
        // updateRoundToQueue(`${game_code}_update_round`, updateRound1, (gameDetail.CardSec * 1000))
      } else {
        let lengthDt = allRoundDetails.length;
        let firstCard = allRoundDetails[0].CurrentScannedCard;
        let newfirstCardNumber = await getCardFirstForAndarBahar(firstCard);
        let firstCardNumber = await getCardFirstForAndarBaharValue(firstCard);
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
          if (!Winner)
            return res.status(200).json({
              success: false,
              message: constMessages.VALIDATION.RUNNER_NOT_FOUND,
              data: {},
            });
          let SideRunner = { rni: [] };
          let SideWinner = mainRunner.filter(function (el) {
            return el.Rcode == SideName;
          })[0];
          if (!SideWinner)
            return res.status(200).json({
              success: false,
              message: constMessages.VALIDATION.RUNNER_NOT_FOUND,
              data: {},
            });
          if (SideWinner) {
            SideRunner.rni.push(SideWinner.RunnerId);
          }
          const BlackRedJoker = await getCardColorAndarBaharJokar(firstCard);
          const BlackRedJokererunner = mainRunner.filter(function (el) {
            return el.Rcode == BlackRedJoker;
          })[0];
          if (BlackRedJokererunner) {
            SideRunner.rni.push(BlackRedJokererunner.RunnerId);
          }
          const BlackRedSuite = await getCardColorAndarBaharSuite(scannedCard);
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
          await sendDataToHub(sendHub, req.socket);
          await sendDataToDatabase(
            `${game_code}_create_round`,
            newRound,
            req.newsocket,
            config.ROUND_CREATE_POUSE_TIME * 1000
          );
          // await createNewRoundToQueue(`${game_code}_create_round`, newRound, (config.ROUND_CREATE_POUSE_TIME * 1000));
        } else {
          Cards[player_id].cr = RoundCards.join(" ");
          let updateRounds = {
            Status: config.ROUND.SUSPENDED_ROUND_STATUS,
            ModifiedBy: config.ROUND.MODIFIED_BY,
            ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
          };
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
          await createRoundDetails(detailsInsert);
          sendHub.crs = Cards;
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
          await sendDataToHub(sendHub, req.socket);
          await sendDataToDatabase(
            `${game_code}_update_round`,
            updateRoundd,
            req.newsocket,
            0
          );
          // await updateRoundToQueue(`${game_code}_update_round`, updateRoundd, 0)
        }
      }
      return res.status(200).json({
        success: true,
        message: constMessages.SUCCESS.CARD_SCAN_SUCCESS,
        data: {},
      });
    }
  } catch (err) {
    await sendSlackMessage(
      `Game: AB\nAn error occurred: ${err.message}\nStack Trace: \n${err.stack}`
    );
    return res.status(200).json({ success: false, message: err.message });
  }
}
async function scanCard32C(req, res, next) {
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
    const gameDetail = await getGameData(game_code);
    if (!gameDetail)
      return res.status(200).json({
        success: false,
        message: constMessages.VALIDATION.INVALID_GAMECODE,
        data: {},
      });
    if (gameDetail.Status == 0)
      return res.status(200).json({
        success: false,
        message: constMessages.VALIDATION.GAME_NOT_ACTIVE,
        data: {},
        accessToken: "",
      });
    let getGameRound = await getRoundData(gameDetail.GameId);
    if (!getGameRound) {
      const currentRoundData = await getCurrenRoundDataInRound(
        gameDetail.GameId
      );
      if (!currentRoundData) {
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
          return res.status(200).json({
            success: false,
            message: `Please wait for ${gameDetail.GameSec} sec`,
            data: {},
          });
        } else {
          return res.status(200).json({
            success: false,
            message: `Please wait for ${gameDetail.CardSec} sec`,
            data: {},
          });
        }
      }
    } else {
      const mainRunner = await getLiveRunnerAll(gameDetail.GameId);
      if (mainRunner.length == 0)
        return res.status(200).json({
          success: false,
          message: constMessages.VALIDATION.RUNNER_NOT_FOUND,
          data: {},
        });
      const PlayerARunner = mainRunner.filter(function (el) {
        return el.Rcode == "C32_8";
      })[0];
      const checkCardAlready = await checkRoundCardAlready(
        getGameRound.RoundId,
        scannedCard
      );
      if (checkCardAlready.length > 0)
        return res.status(200).json({
          success: false,
          message: constMessages.VALIDATION.DUPLICATE_CARD_SCAN,
          data: {},
        });
      const allRoundDetails = await getCardDetailsByRoundId(
        getGameRound.RoundId
      );
      const AllOdds = [];
      const AllCards = [];
      const AllScores = [];
      const AllPlayers = [];
      const AllCN = { cc: { rni: null, cr: null }, nc: { rni: null } };
      for (const runr of mainRunner) {
        if (allRoundDetails.length == 0) {
          let oddObj = {
            rni: runr.RunnerId,
            bk: parseFloat(parseFloat(1.97).toFixed(2)),
            ly: 0.0,
            st: config.ROUND.DEFAULT_ROUND_STATUS,
          };
          AllOdds.push(oddObj);
        } else {
          let oddObj = {
            rni: runr.RunnerId,
            bk: parseFloat(parseFloat(runr.BackOdd).toFixed(2)),
            ly: 0.0,
            st: config.ROUND.DEFAULT_ROUND_STATUS,
          };
          AllOdds.push(oddObj);
        }
        if (runr.GroupId == 1) {
          let NewCard = runr.Cards;
          let cardObj = {
            rni: runr.RunnerId,
            cr: runr.Cards != null ? NewCard.split(" ") : "",
            sc: parseInt(runr.Score),
          };
          AllScores.push(parseInt(runr.Score));
          AllCards.push(cardObj);
        }
        if (runr.GroupId == 1 && runr.Status == 1) {
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
        et: config.ROUND_UPDATE_HUB_STATUS,
        ts: Date.now(),
      };
      let getPlayer = await getLiveRunnerAllOpen(gameDetail.GameId);
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
        let largestValue = -Infinity;
        let largestIndices = [];
        let smallIndices = [];
        for (let i = 0; i < AllScores.length; i++) {
          if (AllScores[i] > largestValue) {
            largestValue = AllScores[i];
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
          if (score % 2 == 0) {
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
          if (SideRunner) {
            updateRounds.SideResult = JSON.stringify({
              rni: [SideRunner.RunnerId],
            });
            sendHub.sr = { rni: [SideRunner.RunnerId] };
          }
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
          await createRoundDetails(detailsInsert);
          await updateRunnerByCode(gameDetail.GameId, "C32_8", {
            BackOdd: config.THURTY_TWO_CARD.ODDS.PLAYER_A,
            LayOdd: 0,
            Cards: null,
            Score: config.THURTY_TWO_CARD.SCORE.PLAYER_A,
            Status: 1,
            ModifiedBy: 1,
            ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
          });
          await updateRunnerByCode(gameDetail.GameId, "C32_9", {
            BackOdd: config.THURTY_TWO_CARD.ODDS.PLAYER_B,
            LayOdd: 0,
            Cards: null,
            Score: config.THURTY_TWO_CARD.SCORE.PLAYER_B,
            Status: 1,
            ModifiedBy: 1,
            ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
          });
          await updateRunnerByCode(gameDetail.GameId, "C32_10", {
            BackOdd: config.THURTY_TWO_CARD.ODDS.PLAYER_C,
            LayOdd: 0,
            Cards: null,
            Score: config.THURTY_TWO_CARD.SCORE.PLAYER_C,
            Status: 1,
            ModifiedBy: 1,
            ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
          });
          await updateRunnerByCode(gameDetail.GameId, "C32_11", {
            BackOdd: config.THURTY_TWO_CARD.ODDS.PLAYER_D,
            LayOdd: 0,
            Cards: null,
            Score: config.THURTY_TWO_CARD.SCORE.PLAYER_D,
            Status: 1,
            ModifiedBy: 1,
            ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
          });
          sendHub.rs = mainRunner[largestIndices[0]].RunnerId;
          sendHub.od = AllOdds;
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
          await sendDataToHub(sendHub, req.socket);
          await sendDataToDatabase(
            `${game_code}_create_round`,
            newRound,
            req.newsocket,
            config.ROUND_CREATE_POUSE_TIME * 1000
          );
          // await createNewRoundToQueue(`${game_code}_create_round`, newRound, (config.ROUND_CREATE_POUSE_TIME * 1000));
        } else {
          await updateRunnerByCode(gameDetail.GameId, currentPlayer.Rcode, {
            BackOdd: config.THURTY_TWO_CARD.DEFAULT_ODDS,
            LayOdd: 0,
            Cards: Cards.join(" "),
            Score: score,
            Status: 2,
            ModifiedBy: 1,
            ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
          });
          if (smallIndices.length > 0) {
            for (const k of smallIndices) {
              // AllOdds[k].st = 3;
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
                    ModifiedBy: 1,
                    ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
                  }
                );
              } else {
                await updateRunnerByCode(gameDetail.GameId, removeRunner, {
                  BackOdd: config.THURTY_TWO_CARD.DEFAULT_ODDS,
                  LayOdd: 0,
                  Cards: removeCards.join(" "),
                  Score: removeScore,
                  Status: 3,
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
              // AllOdds[j].st = 1;
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
                    ModifiedBy: 1,
                    ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
                  }
                );
              } else {
                await updateRunnerByCode(gameDetail.GameId, removeRunner1, {
                  BackOdd: config.THURTY_TWO_CARD.DEFAULT_ODDS,
                  LayOdd: 0,
                  Cards: removeCards1.join(" "),
                  Score: removeScore1,
                  Status: 1,
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
          sendHub.od = AllOdds;
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
          await sendDataToHub(sendHub, req.socket);
          await sendDataToDatabase(
            `${game_code}_update_round`,
            updateRoundd,
            req.newsocket,
            gameDetail.CardSec * 1000
          );
          // await updateRoundToQueue(`${game_code}_update_round`, updateRoundd, (gameDetail.CardSec * 1000))
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
          Status: config.ROUND.SUSPENDED_ROUND_STATUS,
          ModifiedBy: config.ROUND.MODIFIED_BY,
          ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
        };
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
        await createRoundDetails(detailsInsert);
        if (allRoundDetails.length > 0) {
          await updateRunnerByCode(gameDetail.GameId, currentPlayer.Rcode, {
            BackOdd: config.THURTY_TWO_CARD.DEFAULT_ODDS,
            LayOdd: 0.0,
            Cards: Cards.join(" "),
            Score: score,
            Status: 2,
            ModifiedBy: 1,
            ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
          });
        } else {
          for (const j in mainRunner) {
            if (mainRunner[j].Rcode == currentPlayer.Rcode) {
              await updateRunnerByCode(gameDetail.GameId, currentPlayer.Rcode, {
                BackOdd: config.THURTY_TWO_CARD.DEFAULT_ODDS,
                LayOdd: 0.0,
                Cards: Cards.join(" "),
                Score: score,
                Status: 2,
                ModifiedBy: 1,
                ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
              });
            } else {
              await updateRunnerByCode(gameDetail.GameId, mainRunner[j].Rcode, {
                BackOdd: config.THURTY_TWO_CARD.DEFAULT_ODDS,
                LayOdd: 0.0,
                Cards: null,
                Score: mainRunner[j].Score,
                Status: 1,
                ModifiedBy: 1,
                ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
              });
            }
          }
        }
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
        await sendDataToHub(sendHub, req.socket);
        await sendDataToDatabase(
          `${game_code}_update_round`,
          updateRoundd,
          req.newsocket,
          gameDetail.CardSec * 1000
        );
        // await updateRoundToQueue(`${game_code}_update_round`, updateRoundd, (gameDetail.CardSec * 1000))
      }
      return res.status(200).json({
        success: true,
        message: constMessages.SUCCESS.CARD_SCAN_SUCCESS,
        data: {},
      });
    }
  } catch (err) {
    await sendSlackMessage(
      `Game: 32C\nAn error occurred: ${err.message}\nStack Trace: \n${err.stack}`
    );
    return res.status(200).json({ success: false, message: err.message });
  }
}
async function scanCardARW(req, res, next) {
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
    const gameDetail = await getGameData(game_code);
    if (!gameDetail)
      return res.status(200).json({
        success: false,
        message: constMessages.VALIDATION.INVALID_GAMECODE,
        data: {},
      });
    if (gameDetail.Status == 0)
      return res.status(200).json({
        success: false,
        message: constMessages.VALIDATION.GAME_NOT_ACTIVE,
        data: {},
        accessToken: "",
      });
    let getGameRound = await getRoundData(gameDetail.GameId);
    if (!getGameRound) {
      const currentRoundData = await getCurrenRoundDataInRound(
        gameDetail.GameId
      );
      if (!currentRoundData) {
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
          return res.status(200).json({
            success: false,
            message: `Please wait for ${gameDetail.GameSec} sec`,
            data: {},
          });
        } else {
          return res.status(200).json({
            success: false,
            message: `Please wait for ${gameDetail.CardSec} sec`,
            data: {},
          });
        }
      }
    } else {
      const mainRunner = await getLiveRunnerAll(gameDetail.GameId);
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
        if (runr.GroupId == 1) {
          let NewCard = runr.Cards;
          let cardObj = {
            rni: runr.RunnerId,
            cr: runr.Cards != null ? NewCard.split(" ") : "",
            sc: "",
          };
          AllCards.push(cardObj);
        }
      }
      let NewCards = {
        rni: null,
        cr: "",
        sc: "",
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
      if (checkCardAlready.length > 0)
        return res.status(200).json({
          success: false,
          message: constMessages.VALIDATION.DUPLICATE_CARD_SCAN,
          data: {},
        });
      let Cards = [];
      let Odds = [];
      let RunnerCards = [];
      RunnerCards.push(scannedCard);
      let currentCardNumber = await getCardFirstForAndarBahar(scannedCard);
      let Akbar = ["A", "2", "3", "4", "5", "6"];
      let Romeo = ["7", "8", "9", "10"];
      let Walter = ["J", "Q", "K"];
      let Name = "";
      let Player = 0;
      if (Akbar.includes(currentCardNumber)) {
        Name = "AB_AK";
        Player = 0;
      } else if (Romeo.includes(currentCardNumber)) {
        Name = "AB_RO";
        Player = 1;
      } else {
        Name = "AB_WR";
        Player = 2;
      }
      let Winner = mainRunner.filter(function (el) {
        return el.Rcode == Name;
      })[0];
      if (!Winner)
        return res.status(200).json({
          success: false,
          message: constMessages.VALIDATION.RUNNER_NOT_FOUND,
          data: {},
        });
      let SideRunner = { rni: [] };
      let firstCardNumber = await getCardFirstForAndarBaharValue(scannedCard);
      let OddEven = "";
      if (firstCardNumber % 2 == 0) {
        OddEven = "AB_EV";
      } else {
        OddEven = "AB_OD";
      }
      const OddEvenrunner = mainRunner.filter(function (el) {
        return el.Rcode == OddEven;
      })[0];
      if (OddEvenrunner) {
        SideRunner.rni.push(OddEvenrunner.RunnerId);
      }
      const BlackRed = await getCardColor(scannedCard);
      const BlackRedrunner = mainRunner.filter(function (el) {
        return el.Rcode == BlackRed;
      })[0];
      if (BlackRedrunner) {
        SideRunner.rni.push(BlackRedrunner.RunnerId);
      }
      if (firstCardNumber == 7) {
        SideName = "AB_7";
      } else if (firstCardNumber > 7) {
        SideName = "AB_7U";
      } else if (firstCardNumber < 7) {
        SideName = "AB_7D";
      }
      const SUDrunner = mainRunner.filter(function (el) {
        return el.Rcode == SideName;
      })[0];
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
      await sendDataToHub(sendHub, req.socket);
      await sendDataToDatabase(
        `${game_code}_create_round`,
        newRound,
        req.newsocket,
        config.ROUND_CREATE_POUSE_TIME * 1000
      );
      // await createNewRoundToQueue(`${game_code}_create_round`, newRound, (config.ROUND_CREATE_POUSE_TIME * 1000));
    }
    return res.status(200).json({
      success: true,
      message: constMessages.SUCCESS.CARD_SCAN_SUCCESS,
      data: {},
    });
  } catch (err) {
    await sendSlackMessage(
      `Game: ARW\nAn error occurred: ${err.message}\nStack Trace: \n${err.stack}`
    );
    return res.status(200).json({ success: false, message: err.message });
  }
}
async function scanCardLS(req, res, next) {
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
    const gameDetail = await getGameData(game_code);
    if (!gameDetail)
      return res.status(200).json({
        success: false,
        message: constMessages.VALIDATION.INVALID_GAMECODE,
        data: {},
      });
    if (gameDetail.Status == 0)
      return res.status(200).json({
        success: false,
        message: constMessages.VALIDATION.GAME_NOT_ACTIVE,
        data: {},
        accessToken: "",
      });
    let getGameRound = await getRoundData(gameDetail.GameId);
    if (!getGameRound) {
      return res.status(200).json({
        success: false,
        message: constMessages.VALIDATION.ROUND_NOT_EXIST,
        data: {},
      });
    } else {
      const mainRunner = await getLiveRunnerAll(gameDetail.GameId);
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
          };
          AllCards.push(cardObj);
        }
      }
      let NewCards = {
        rni: null,
        cr: "",
        sc: "",
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
      if (checkCardAlready.length > 0)
        return res.status(200).json({
          success: false,
          message: constMessages.VALIDATION.DUPLICATE_CARD_SCAN,
          data: {},
        });
      let Cards = [];
      let RunnerCards = [];
      RunnerCards.push(scannedCard);
      let firstCardNumber = await getCardFirstForAndarBaharValue(scannedCard);
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
      if (!Winner)
        return res.status(200).json({
          success: false,
          message: constMessages.VALIDATION.RUNNER_NOT_FOUND,
          data: {},
        });
      let SideWinner = mainRunner.filter(function (el) {
        return el.Name == SideName;
      })[0];
      if (!SideWinner)
        return res.status(200).json({
          success: false,
          message: constMessages.VALIDATION.RUNNER_NOT_FOUND,
          data: {},
        });
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
      await sendDataToHub(sendHub, req.socket);
      await sendDataToDatabase(
        `${game_code}_create_round`,
        newRound,
        req.newsocket,
        config.ROUND_CREATE_POUSE_TIME * 1000
      );
      // await createNewRoundToQueue(`${game_code}_create_round`, newRound, (config.ROUND_CREATE_POUSE_TIME * 1000));
    }
    return res.status(200).json({
      success: true,
      message: constMessages.SUCCESS.CARD_SCAN_SUCCESS,
      data: {},
    });
  } catch (err) {
    await sendSlackMessage(
      `Game: LS\nAn error occurred: ${err.message}\nStack Trace: \n${err.stack}`
    );
    return res.status(200).json({ success: false, message: err.message });
  }
}
async function scanCardTP20(req, res, next) {
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
    const gameDetail = await getGameData(game_code);
    if (!gameDetail)
      return res.status(200).json({
        success: false,
        message: constMessages.VALIDATION.INVALID_GAMECODE,
        data: {},
      });
    if (gameDetail.Status == 0)
      return res.status(200).json({
        success: false,
        message: constMessages.VALIDATION.GAME_NOT_ACTIVE,
        data: {},
        accessToken: "",
      });
    const mainRunner = await getLiveRunnerAll(gameDetail.GameId);
    if (mainRunner.length == 0)
      return res.status(200).json({
        success: false,
        message: constMessages.VALIDATION.RUNNER_NOT_FOUND,
        data: {},
      });
    const AllOdds = [];
    for (const runr of mainRunner) {
      let oddObj = {
        rni: runr.RunnerId,
        bk: parseFloat(parseFloat(runr.BackOdd).toFixed(2)),
        ly: 0.0,
        st: config.ROUND.CLOSED_ROUND_STATUS,
      };
      AllOdds.push(oddObj);
    }
    let getGameRound = await getRoundData(gameDetail.GameId);
    if (!getGameRound) {
      const currentRoundData = await getCurrenRoundDataInRound(
        gameDetail.GameId
      );
      if (!currentRoundData) {
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
          return res.status(200).json({
            success: false,
            message: `Please wait for ${gameDetail.GameSec} sec`,
            data: {},
          });
        } else {
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
      const checkCardAlready = await checkRoundCardAlready(
        getGameRound.RoundId,
        scannedCard
      );
      if (checkCardAlready.length > 0)
        return res.status(200).json({
          success: false,
          message: constMessages.VALIDATION.DUPLICATE_CARD_SCAN,
          data: {},
        });
      const allRoundDetails = await getCardDetailsByRoundId(
        getGameRound.RoundId
      );
      const playerArunner = mainRunner.filter(function (el) {
        return el.Rcode == "TP20_PYA";
      })[0];
      if (!playerArunner)
        return res.status(200).json({
          success: false,
          message: constMessages.VALIDATION.RUNNER_NOT_FOUND,
          data: {},
        });
      const playerBrunner = mainRunner.filter(function (el) {
        return el.Rcode == "TP20_PYB";
      })[0];
      if (!playerBrunner)
        return res.status(200).json({
          success: false,
          message: constMessages.VALIDATION.RUNNER_NOT_FOUND,
          data: {},
        });
      if (allRoundDetails.length == 5) {
        for (const a in AllOdds) {
          AllOdds[a].st = config.ROUND.WINNER_STATUS;
        }
        sendHub.cn.cc.cr = scannedCard;
        sendHub.cn.cc.rni = playerBrunner.RunnerId;
        sendHub.cn.nc.rni = playerArunner.RunnerId;
        let Cards = [
          { rni: playerArunner.RunnerId, cr: "", sc: "" },
          { rni: playerBrunner.RunnerId, cr: "", sc: "" },
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
        let apiResponse = await callPythonAPI(Params);
        let WinnerId = 0;
        let runnerTitle = "";
        let RoundStatus = config.ROUND.WINNER_STATUS;
        if (apiResponse["Odds A win"] == "Winner!") {
          runnerTitle = "Player A";
        }
        if (apiResponse["Odds B win"] == "Winner!") {
          runnerTitle = "Player B";
        }
        if (apiResponse["Odds draw"] == "Draw!") {
          runnerTitle = "Draw";
          RoundStatus = config.ROUND.CANCEL_ROUND_STATUS;
        }
        let Winner = mainRunner.filter(function (el) {
          return el.Name == runnerTitle;
        })[0];
        if (!Winner)
          return res.status(200).json({
            success: false,
            message: constMessages.VALIDATION.RUNNER_NOT_FOUND,
            data: {},
          });
        let WinnerName = apiResponse["Winning hand"];
        let sideWinner = mainRunner.filter(function (el) {
          return el.Name == WinnerName;
        })[0];
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
        await sendDataToHub(sendHub, req.socket);
        await sendDataToDatabase(
          `${game_code}_create_round`,
          newRound,
          req.newsocket,
          config.ROUND_CREATE_POUSE_TIME * 1000
        );
        // await createNewRoundToQueue(`${game_code}_create_round`, newRound, (config.ROUND_CREATE_POUSE_TIME * 1000));
      } else {
        let Cards = [
          { rni: playerArunner.RunnerId, cr: "", sc: "" },
          { rni: playerBrunner.RunnerId, cr: "", sc: "" },
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
          Status: config.ROUND.DEFAULT_ROUND_STATUS,
        });
        await updateRunnerByCode(gameDetail.GameId, "TP20_PYB", {
          BackOdd: config.TEEN_PATTI_TWENTY_TWENTY.PLAYER_B.BackOdd,
          LayOdd: config.TEEN_PATTI_TWENTY_TWENTY.PLAYER_B.LayOdd,
          Cards: playerB.join(" "),
          ModifiedBy: 1,
          ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
          Status: config.ROUND.DEFAULT_ROUND_STATUS,
        });
        Cards[player_id].cr = RoundCards.join(" ");
        let updateRounds = {
          Status: config.ROUND.SUSPENDED_ROUND_STATUS,
          ModifiedBy: config.ROUND.MODIFIED_BY,
          ModifiedOn: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
        };
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
        await sendDataToHub(sendHub, req.socket);
        await sendDataToDatabase(
          `${game_code}_update_round`,
          updateRoundd,
          req.newsocket,
          gameDetail.CardSec * 1000
        );
        // await updateRoundToQueue(`${game_code}_update_round`, updateRoundd, (gameDetail.CardSec * 1000))
      }
      return res.status(200).json({
        success: true,
        message: constMessages.SUCCESS.CARD_SCAN_SUCCESS,
        data: {},
      });
    }
  } catch (err) {
    await sendSlackMessage(
      `Game: LS\nAn error occurred: ${err.message}\nStack Trace: \n${err.stack}`
    );
    return res.status(200).json({ success: false, message: err.message });
  }
}

module.exports = {
  userLogin,
  scanCardTP,
  scanCardAB,
  scanCard32C,
  scanCardARW,
  scanCardLS,
  scanCardTP20,
};
